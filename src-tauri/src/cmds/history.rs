use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::paths;
use crate::util;
use tauri_plugin_opener::OpenerExt;

pub fn load_history_index(app: &AppHandle) -> Value {
    let path = paths::history_dir(app).join("index.json");
    util::read_json(&path, json!({ "version": 1, "entries": [] }))
}

// 严格读取:解析失败返回 None。
// 清理类操作必须用它——util::read_json 在解析失败时返回默认空索引,
// 会被误当成"没有任何记录",从而删光全部音频。
fn load_index_strict(app: &AppHandle) -> Option<Value> {
    let path = paths::history_dir(app).join("index.json");
    let text = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&text).ok()
}

fn write_history_index(app: &AppHandle, index: &Value) {
    let path = paths::history_dir(app).join("index.json");
    util::write_json(&path, index);
}

// 音频子目录由记录类型决定(tts/ 或 asr/)
fn audio_subdir(entry: &Value) -> Option<&'static str> {
    match entry.get("type").and_then(|t| t.as_str()) {
        Some("tts") => Some("tts"),
        Some("asr") => Some("asr"),
        _ => None,
    }
}

// 记录 id → 音频绝对路径。路径完全由索引推导,不接受外部传入的路径。
// 索引里查不到时回落到 tts/<id>.wav(旧行为,保证兼容)。
pub fn audio_path_for(app: &AppHandle, id: &str) -> PathBuf {
    let index = load_history_index(app);
    let subdir = index
        .get("entries")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|e| e.get("id").and_then(|x| x.as_str()) == Some(id))
        })
        .and_then(audio_subdir)
        .unwrap_or("tts");
    paths::history_dir(app).join(subdir).join(format!("{}.wav", id))
}

#[tauri::command]
pub fn history_load_index(app: AppHandle) -> Value {
    load_history_index(&app)
}

#[tauri::command]
pub fn history_save_entry(app: AppHandle, entry: Value, audio_base64: Option<String>) -> Value {
    let mut index = load_history_index(&app);
    if let Some(entries) = index.get_mut("entries").and_then(|v| v.as_array_mut()) {
        entries.insert(0, entry.clone());
    }
    write_history_index(&app, &index);

    if let Some(b64) = audio_base64.filter(|s| !s.is_empty()) {
        if let (Some(entry_id), Some(subdir)) =
            (entry.get("id").and_then(|v| v.as_str()), audio_subdir(&entry))
        {
            let audio_path = paths::history_dir(&app)
                .join(subdir)
                .join(format!("{}.wav", entry_id));
            if let Some(bytes) = util::decode_base64(&b64) {
                if let Some(parent) = audio_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::write(&audio_path, bytes);
            }
        }
    }

    index
}

#[tauri::command]
pub fn history_delete_entry(app: AppHandle, id: String) -> Value {
    let mut index = load_history_index(&app);
    let exists = index
        .get("entries")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .any(|e| e.get("id").and_then(|x| x.as_str()) == Some(id.as_str()))
        })
        .unwrap_or(false);

    // tts 与 asr 都要清音频,不再按类型硬编码
    if exists {
        let audio_path = audio_path_for(&app, &id);
        if audio_path.exists() {
            let _ = fs::remove_file(&audio_path);
        }
    }

    if let Some(arr) = index.get_mut("entries").and_then(|v| v.as_array_mut()) {
        arr.retain(|e| e.get("id").and_then(|x| x.as_str()) != Some(id.as_str()));
    }
    write_history_index(&app, &index);
    index
}

#[tauri::command]
pub fn history_get_audio_path(app: AppHandle, id: String) -> String {
    util::path_str(&audio_path_for(&app, &id))
}

#[tauri::command]
pub fn history_clear_all(app: AppHandle) -> Value {
    for subdir in ["tts", "asr"] {
        let dir = paths::history_dir(&app).join(subdir);
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().into_owned();
                if name.ends_with(".wav") {
                    let _ = fs::remove_file(entry.path());
                }
            }
        }
    }
    let fresh = json!({ "version": 1, "entries": [] });
    write_history_index(&app, &fresh);
    json!({ "success": true })
}

// 从候选文件名里挑出未被索引引用的(纯函数,便于单测)
fn orphan_file_names(file_names: &[String], referenced: &HashSet<String>) -> Vec<String> {
    file_names
        .iter()
        .filter(|name| match name.strip_suffix(".wav") {
            Some(stem) => !referenced.contains(stem),
            None => false,
        })
        .cloned()
        .collect()
}

// 清理索引里已不存在的音频(删除记录时未清掉的残留)。
// dry_run=true 只统计不删,便于前端先让用户确认再执行。
// 安全性:索引读不出来或结构异常时直接拒绝——否则会把"读不出来"当成"没有记录"而删光音频。
#[tauri::command]
pub fn history_prune_orphan_audio(app: AppHandle, dry_run: bool) -> Value {
    let Some(index) = load_index_strict(&app) else {
        return json!({ "success": false, "message": "历史索引无法读取，已中止清理" });
    };
    let Some(entries) = index.get("entries").and_then(|v| v.as_array()) else {
        return json!({ "success": false, "message": "历史索引结构异常，已中止清理" });
    };
    let referenced: HashSet<String> = entries
        .iter()
        .filter_map(|e| e.get("id").and_then(|x| x.as_str()))
        .map(str::to_string)
        .collect();

    let mut removed = 0usize;
    for subdir in ["tts", "asr"] {
        let dir = paths::history_dir(&app).join(subdir);
        let Ok(read) = fs::read_dir(&dir) else { continue };
        let names: Vec<String> = read
            .flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        for name in orphan_file_names(&names, &referenced) {
            if dry_run {
                removed += 1;
            } else if fs::remove_file(dir.join(&name)).is_ok() {
                removed += 1;
            }
        }
    }

    json!({ "success": true, "removed": removed, "dryRun": dry_run })
}

#[tauri::command]
pub fn history_open_folder(app: AppHandle) {
    let dir = paths::history_dir(&app);
    let _ = app
        .opener()
        .open_path(util::path_str(&dir), None::<&str>);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(items: &[&str]) -> HashSet<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    fn names(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn picks_only_unreferenced_wavs() {
        let files = names(&["a.wav", "b.wav", "c.wav", "notes.txt"]);
        assert_eq!(orphan_file_names(&files, &set(&["a", "c"])), names(&["b.wav"]));
    }

    #[test]
    fn keeps_everything_when_all_referenced() {
        let files = names(&["a.wav", "b.wav"]);
        assert!(orphan_file_names(&files, &set(&["a", "b"])).is_empty());
    }

    #[test]
    fn empty_index_reports_all_wavs_as_orphans() {
        // 记录全被清掉但文件残留,正是要清理的场景
        let files = names(&["a.wav", "b.wav"]);
        assert_eq!(orphan_file_names(&files, &set(&[])).len(), 2);
    }

    #[test]
    fn ignores_non_wav_and_matches_exact_stem() {
        let files = names(&["a.wav", "a.wav.bak", "aWav.wav", "list.json"]);
        assert_eq!(orphan_file_names(&files, &set(&["a"])), names(&["aWav.wav"]));
    }
}
