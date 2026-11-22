use serde_json::json;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::util;

pub fn default_data_root(app: &AppHandle) -> PathBuf {
    app.path()
        .document_dir()
        .map(|p| p.join("YiziVoice"))
        .unwrap_or_else(|_| PathBuf::from("YiziVoice"))
}

pub fn location_cfg_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("data-location.json")
}

pub fn data_root(app: &AppHandle) -> PathBuf {
    let config = util::read_json(
        &location_cfg_path(app),
        json!({ "dataRoot": "" }),
    );
    let root = config
        .get("dataRoot")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if !root.is_empty() && fs::metadata(root).is_ok() {
        return PathBuf::from(root);
    }
    default_data_root(app)
}

pub fn config_dir(app: &AppHandle) -> PathBuf {
    let dir = data_root(app).join("config");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

pub fn voices_dir(app: &AppHandle) -> PathBuf {
    let dir = config_dir(app).join("voices");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

pub fn styles_dir(app: &AppHandle) -> PathBuf {
    let dir = config_dir(app).join("styles");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

pub fn audio_tags_dir(app: &AppHandle) -> PathBuf {
    let dir = config_dir(app).join("audio-tags");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

pub fn history_dir(app: &AppHandle) -> PathBuf {
    data_root(app).join("History")
}

pub fn ensure_history_dir(app: &AppHandle) {
    let dir = history_dir(app);
    for d in [dir.clone(), dir.join("tts"), dir.join("asr")] {
        if !d.exists() {
            let _ = fs::create_dir_all(&d);
        }
    }
    let index_path = dir.join("index.json");
    if !index_path.exists() {
        util::write_json(&index_path, &json!({ "version": 1, "entries": [] }));
    }
}

pub fn settings_dir(app: &AppHandle) -> PathBuf {
    let dir = data_root(app);
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

pub fn settings_path(app: &AppHandle) -> PathBuf {
    settings_dir(app).join("settings.json")
}

pub fn migrated_marker_path(app: &AppHandle) -> PathBuf {
    settings_dir(app).join(".migrated")
}

// Electron 的 userData(%APPDATA%/YiziVoice)与 Tauri app_data_dir 不同,
// 首次启动时继承旧版的重定向配置,避免升级用户自定义数据目录丢失。
pub fn init_storage_compat(app: &AppHandle) {
    let target = location_cfg_path(app);
    if target.exists() {
        return;
    }
    #[cfg(windows)]
    if let Ok(appdata) = std::env::var("APPDATA") {
        let legacy = PathBuf::from(appdata)
            .join("YiziVoice")
            .join("data-location.json");
        if legacy.exists() {
            if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if fs::copy(&legacy, &target).is_ok() {
                println!("[YiziVoice] Inherited Electron data-location.json");
            }
        }
    }
}
