use serde_json::{json, Value};
use std::fs;
use tauri::AppHandle;

use crate::init;
use crate::paths;
use crate::util;

pub fn load_voice_list(app: &AppHandle) -> Value {
    let path = paths::voices_dir(app).join("list.json");
    util::read_json(&path, init::default_voice_list())
}

fn load_voice_by_meta(app: &AppHandle, meta: &Value) -> Value {
    let file_path = meta.get("filePath").and_then(|v| v.as_str()).unwrap_or("");
    if file_path.is_empty() {
        return Value::Null;
    }
    let voice_path = paths::voices_dir(app).join(file_path);
    util::read_json(&voice_path, Value::Null)
}

fn truthy_string(obj: &serde_json::Map<String, Value>, key: &str, fallback: &str) -> Value {
    match obj.get(key).and_then(|v| v.as_str()) {
        Some(s) if !s.is_empty() => json!(s),
        _ => json!(fallback),
    }
}

/// How many bars a voice card draws across its width. It lives here rather than in the UI
/// because the envelope and the drawing have to agree on the count.
pub const WAVEFORM_BARS: usize = 34;

/// Peak envelope of a 16-bit PCM WAV, normalized to 0..1 with two decimals - the decoration
/// the voice card draws behind its name.
///
/// This is derived data, and it is computed HERE rather than in the UI on purpose: the
/// library renders from `list.json` alone, so a front-end implementation would have to
/// decode and scan every sample of every voice on every visit.
///
/// Returns `None` for anything it cannot read (another bit depth, a truncated payload, pure
/// silence). A voice without a waveform simply draws no decoration - it must never fail a
/// save.
pub fn waveform_peaks(audio_base64: &str, bars: usize) -> Option<Vec<f64>> {
    let bytes = util::decode_base64(audio_base64)?;
    if bytes.len() < 44 || &bytes[0..4] != &b"RIFF"[..] || &bytes[8..12] != &b"WAVE"[..] {
        return None;
    }

    let (mut channels, mut bits, mut data_start, mut data_len) = (1usize, 16u16, 0usize, 0usize);
    let mut saw_fmt = false;
    let mut pos = 12usize;
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size =
            u32::from_le_bytes([bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]])
                as usize;
        let body = pos + 8;
        if id == &b"fmt "[..] && size >= 16 && body + 16 <= bytes.len() {
            channels = u16::from_le_bytes([bytes[body + 2], bytes[body + 3]]).max(1) as usize;
            bits = u16::from_le_bytes([bytes[body + 14], bytes[body + 15]]);
            saw_fmt = true;
        } else if id == &b"data"[..] {
            data_start = body;
            data_len = size.min(bytes.len().saturating_sub(body));
        }
        pos = body + size + (size & 1); // chunks are word aligned
    }
    if !saw_fmt || bits != 16 || data_len < 2 {
        return None;
    }

    let samples: Vec<i16> = bytes[data_start..data_start + data_len]
        .chunks_exact(2)
        .step_by(channels)
        .map(|c| i16::from_le_bytes([c[0], c[1]]))
        .collect();
    if samples.is_empty() {
        return None;
    }

    let step = (samples.len() / bars.max(1)).max(1);
    let peaks: Vec<f64> = (0..bars)
        .map(|i| {
            let from = i * step;
            let to = ((i + 1) * step).min(samples.len());
            if from >= to {
                return 0.0;
            }
            samples[from..to]
                .iter()
                .map(|s| (*s as f64).abs())
                .fold(0.0, f64::max)
        })
        .collect();
    let loudest = peaks.iter().cloned().fold(0.0, f64::max);
    if loudest <= 0.0 {
        return None;
    }
    Some(
        peaks
            .iter()
            .map(|p| (p / loudest * 100.0).round() / 100.0)
            .collect(),
    )
}

/// The `waveform` field of one list entry: the envelope, or null when it cannot be read.
fn waveform_for(obj: &serde_json::Map<String, Value>) -> Value {
    match obj
        .get("audioBase64")
        .and_then(|v| v.as_str())
        .and_then(|b64| waveform_peaks(b64, WAVEFORM_BARS))
    {
        Some(peaks) => json!(peaks),
        None => Value::Null,
    }
}

/// v2.1.2: voices saved before the waveform existed carry no envelope, so their cards would
/// draw no decoration at all. Compute it once from the stored sample and write the list
/// back; the second call is a no-op. A voice whose sample cannot be read is stamped with a
/// null too, so it is not decoded again on every list load.
fn backfill_waveforms(app: &AppHandle, list: &mut Value) {
    let voices_dir = paths::voices_dir(app);
    let pending: Vec<(usize, String)> = list
        .get("voices")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .enumerate()
                .filter(|(_, m)| m.get("waveform").is_none())
                .filter_map(|(i, m)| {
                    m.get("filePath")
                        .and_then(|f| f.as_str())
                        .map(|f| (i, f.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();
    if pending.is_empty() {
        return;
    }

    let computed: Vec<(usize, Value)> = pending
        .into_iter()
        .map(|(index, file)| {
            let profile = util::read_json(&voices_dir.join(&file), Value::Null);
            let peaks = profile
                .get("audioBase64")
                .and_then(|v| v.as_str())
                .and_then(|b64| waveform_peaks(b64, WAVEFORM_BARS));
            (index, peaks.map(|p| json!(p)).unwrap_or(Value::Null))
        })
        .collect();

    if let Some(arr) = list.get_mut("voices").and_then(|v| v.as_array_mut()) {
        for (index, peaks) in computed {
            if let Some(obj) = arr.get_mut(index).and_then(|v| v.as_object_mut()) {
                obj.insert("waveform".into(), peaks);
            }
        }
    }
    util::write_json(&voices_dir.join("list.json"), list);
}

#[tauri::command]
pub fn voices_load_list(app: AppHandle) -> Value {
    let mut list = load_voice_list(&app);
    backfill_waveforms(&app, &mut list);
    list
}

#[tauri::command]
pub fn voices_load_voice(app: AppHandle, id: String) -> Value {
    let list = load_voice_list(&app);
    let meta = list
        .get("voices")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|v| v.get("id").and_then(|x| x.as_str()) == Some(id.as_str()))
        });
    match meta {
        Some(meta) => load_voice_by_meta(&app, meta),
        None => Value::Null,
    }
}

#[tauri::command]
pub fn voices_save_voice(app: AppHandle, mut voice: Value) -> Value {
    let voices_dir = paths::voices_dir(&app);

    let (voice_id, created_at) = {
        let obj = match voice.as_object_mut() {
            Some(o) => o,
            None => return json!({ "voice": null, "list": load_voice_list(&app) }),
        };
        let voice_id = match obj
            .get("id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
        {
            Some(id) => id.to_string(),
            None => {
                let id = format!("voice_{}_{}", util::now_ms(), util::rand_suffix(6));
                obj.insert("id".into(), json!(id.clone()));
                id
            }
        };
        if !obj.contains_key("createdAt") || obj.get("createdAt").map(|v| v.is_null()).unwrap_or(false)
        {
            obj.insert("createdAt".into(), json!(util::now_ms()));
        }
        let created_at = obj.get("createdAt").cloned().unwrap_or(json!(util::now_ms()));
        (voice_id, created_at)
    };

    let file_name = format!("{}.json", voice_id);
    let voice_path = voices_dir.join(&file_name);
    util::write_json(&voice_path, &voice);

    let mut list = load_voice_list(&app);
    let meta = {
        let obj = voice.as_object().expect("voice object");
        json!({
            "id": voice_id,
            "name": truthy_string(obj, "name", "未命名音色"),
            "category": truthy_string(obj, "category", "未分类"),
            "description": obj.get("description").cloned().unwrap_or(json!("")),
            "filePath": file_name,
            "createdAt": created_at,
            "previewAvailable": obj
                .get("previewAudioBase64")
                .and_then(|v| v.as_str())
                .map(|s| !s.is_empty())
                .unwrap_or(false),
            "waveform": waveform_for(obj),
        })
    };

    if let Some(list_obj) = list.as_object_mut() {
        if let Some(arr) = list_obj.get_mut("voices").and_then(|v| v.as_array_mut()) {
            match arr
                .iter()
                .position(|v| v.get("id").and_then(|x| x.as_str()) == Some(voice_id.as_str()))
            {
                Some(i) => arr[i] = meta,
                None => arr.push(meta),
            }
        }
        list_obj.insert("lastUpdated".into(), json!(util::now_ms()));
    }
    util::write_json(&voices_dir.join("list.json"), &list);

    json!({ "voice": voice, "list": list })
}

#[tauri::command]
pub fn voices_delete_voice(app: AppHandle, id: String) -> Value {
    let voices_dir = paths::voices_dir(&app);
    let mut list = load_voice_list(&app);
    let meta = list
        .get("voices")
        .and_then(|v| v.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|v| v.get("id").and_then(|x| x.as_str()) == Some(id.as_str()))
        })
        .cloned();

    if let Some(meta) = meta {
        let voice_path = voices_dir.join(
            meta.get("filePath")
                .and_then(|v| v.as_str())
                .unwrap_or_default(),
        );
        if voice_path.exists() {
            let _ = fs::remove_file(&voice_path);
        }
        if let Some(list_obj) = list.as_object_mut() {
            if let Some(arr) = list_obj.get_mut("voices").and_then(|v| v.as_array_mut()) {
                arr.retain(|v| v.get("id").and_then(|x| x.as_str()) != Some(id.as_str()));
            }
            list_obj.insert("lastUpdated".into(), json!(util::now_ms()));
        }
        util::write_json(&voices_dir.join("list.json"), &list);
    }

    list
}

#[tauri::command]
pub fn voices_load_categories(app: AppHandle) -> Value {
    ensure_design_category(&app);
    let list = load_voice_list(&app);
    match list.get("categories").filter(|c| c.is_array()) {
        Some(c) => c.clone(),
        None => init::default_voice_categories(),
    }
}

const DESIGN_CATEGORY: &str = "设计音色";
// Bump when a new built-in category is introduced. This is a one-shot offer: once the
// marker is present, deleting the category in the UI keeps it deleted.
const CATEGORY_VERSION: u64 = 2;

fn ensure_design_category(app: &AppHandle) {
    let mut list = load_voice_list(app);
    let version = list
        .get("categoryVersion")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    if version >= CATEGORY_VERSION {
        return;
    }

    // A list copied from the shipped default fixture may carry no `categories` yet;
    // start from the built-in set instead of ending up with only this one category.
    let mut categories: Vec<String> = match list.get("categories").and_then(|v| v.as_array()) {
        Some(arr) => arr
            .iter()
            .filter_map(|v| v.as_str())
            .map(|s| s.to_string())
            .collect(),
        None => init::default_voice_categories()
            .as_array()
            .cloned()
            .unwrap_or_default()
            .iter()
            .filter_map(|v| v.as_str())
            .map(|s| s.to_string())
            .collect(),
    };
    if !categories.iter().any(|c| c == DESIGN_CATEGORY) {
        categories.push(DESIGN_CATEGORY.to_string());
    }

    if let Some(obj) = list.as_object_mut() {
        obj.insert("categories".into(), json!(categories));
        obj.insert("categoryVersion".into(), json!(CATEGORY_VERSION));
        obj.insert("lastUpdated".into(), json!(util::now_ms()));
    }
    util::write_json(&paths::voices_dir(app).join("list.json"), &list);
}

#[tauri::command]
pub fn voices_save_categories(app: AppHandle, categories: Vec<String>) -> Vec<String> {
    let mut list = load_voice_list(&app);
    if let Some(list_obj) = list.as_object_mut() {
        list_obj.insert("categories".into(), json!(categories));
        list_obj.insert("lastUpdated".into(), json!(util::now_ms()));
    }
    util::write_json(&paths::voices_dir(&app).join("list.json"), &list);
    categories
}

#[tauri::command]
pub fn voices_update_category(app: AppHandle, id: String, category: String) -> Value {
    let voices_dir = paths::voices_dir(&app);
    let mut list = load_voice_list(&app);
    let index = list
        .get("voices")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .position(|v| v.get("id").and_then(|x| x.as_str()) == Some(id.as_str()))
        })
        .unwrap_or(None);

    let index = match index {
        Some(i) => i,
        None => return list,
    };

    if let Some(list_obj) = list.as_object_mut() {
        if let Some(arr) = list_obj.get_mut("voices").and_then(|v| v.as_array_mut()) {
            if let Some(meta_obj) = arr[index].as_object_mut() {
                meta_obj.insert("category".into(), json!(category.clone()));
            }
        }
        list_obj.insert("lastUpdated".into(), json!(util::now_ms()));
    }
    util::write_json(&voices_dir.join("list.json"), &list);

    // 同步到音色详情文件
    let voice_path = voices_dir.join(
        list.get("voices")
            .and_then(|v| v.get(index))
            .and_then(|m| m.get("filePath"))
            .and_then(|f| f.as_str())
            .unwrap_or_default(),
    );
    let voice_data = util::read_json(&voice_path, Value::Null);
    if !voice_data.is_null() {
        let mut updated = voice_data;
        if let Some(obj) = updated.as_object_mut() {
            obj.insert("category".into(), json!(category));
        }
        util::write_json(&voice_path, &updated);
    }

    list
}

#[tauri::command]
pub fn voices_reassign_category(
    app: AppHandle,
    from_category: String,
    to_category: String,
) -> Value {
    let voices_dir = paths::voices_dir(&app);
    let mut list = load_voice_list(&app);

    let targets: Vec<(usize, String)> = list
        .get("voices")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .enumerate()
                .filter(|(_, v)| {
                    v.get("category").and_then(|c| c.as_str()) == Some(from_category.as_str())
                })
                .filter_map(|(i, v)| {
                    v.get("filePath")
                        .and_then(|f| f.as_str())
                        .map(|f| (i, f.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();

    for (_, file_path) in &targets {
        let voice_path = voices_dir.join(file_path);
        let voice_data = util::read_json(&voice_path, Value::Null);
        if !voice_data.is_null() {
            let mut updated = voice_data;
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("category".into(), json!(to_category.clone()));
            }
            util::write_json(&voice_path, &updated);
        }
    }

    if let Some(list_obj) = list.as_object_mut() {
        if let Some(arr) = list_obj.get_mut("voices").and_then(|v| v.as_array_mut()) {
            for (i, _) in &targets {
                if let Some(meta_obj) = arr[*i].as_object_mut() {
                    meta_obj.insert("category".into(), json!(to_category.clone()));
                }
            }
        }
        list_obj.insert("lastUpdated".into(), json!(util::now_ms()));
    }
    util::write_json(&voices_dir.join("list.json"), &list);

    list
}

#[tauri::command]
pub fn voices_rename_category(
    app: AppHandle,
    from_category: String,
    to_category: String,
) -> Value {
    let from = from_category.trim().to_string();
    let to = to_category.trim().to_string();
    if from.is_empty() || to.is_empty() || from == to {
        return load_voice_list(&app);
    }

    let voices_dir = paths::voices_dir(&app);
    let mut list = load_voice_list(&app);

    let conflict = list
        .get("categories")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .any(|c| c.as_str() == Some(to.as_str()) && c.as_str() != Some(from.as_str()))
        })
        .unwrap_or(false);
    if conflict {
        return json!({ "error": "分类名称已存在" });
    }

    let targets: Vec<(usize, String)> = list
        .get("voices")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .enumerate()
                .filter(|(_, v)| {
                    v.get("category").and_then(|c| c.as_str()) == Some(from.as_str())
                })
                .filter_map(|(i, v)| {
                    v.get("filePath")
                        .and_then(|f| f.as_str())
                        .map(|f| (i, f.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();

    for (_, file_path) in &targets {
        let voice_path = voices_dir.join(file_path);
        let voice_data = util::read_json(&voice_path, Value::Null);
        if !voice_data.is_null() {
            let mut updated = voice_data;
            if let Some(obj) = updated.as_object_mut() {
                obj.insert("category".into(), json!(to.clone()));
            }
            util::write_json(&voice_path, &updated);
        }
    }

    if let Some(list_obj) = list.as_object_mut() {
        if let Some(arr) = list_obj.get_mut("voices").and_then(|v| v.as_array_mut()) {
            for (i, _) in &targets {
                if let Some(meta_obj) = arr[*i].as_object_mut() {
                    meta_obj.insert("category".into(), json!(to.clone()));
                }
            }
        }
        if let Some(cats) = list_obj.get_mut("categories").and_then(|v| v.as_array_mut()) {
            for c in cats.iter_mut() {
                if c.as_str() == Some(from.as_str()) {
                    *c = json!(to.clone());
                }
            }
        }
        list_obj.insert("lastUpdated".into(), json!(util::now_ms()));
    }
    util::write_json(&voices_dir.join("list.json"), &list);

    list
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    /// A minimal 16-bit PCM WAV: canonical 44-byte header plus `samples`.
    fn wav(samples: &[i16], channels: u16, bits: u16) -> String {
        let data_len = (samples.len() * 2) as u32;
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&(36 + data_len).to_le_bytes());
        bytes.extend_from_slice(b"WAVE");
        bytes.extend_from_slice(b"fmt ");
        bytes.extend_from_slice(&16u32.to_le_bytes());
        bytes.extend_from_slice(&1u16.to_le_bytes()); // PCM
        bytes.extend_from_slice(&channels.to_le_bytes());
        bytes.extend_from_slice(&24000u32.to_le_bytes());
        bytes.extend_from_slice(&(24000u32 * channels as u32 * 2).to_le_bytes());
        bytes.extend_from_slice(&(channels * 2).to_le_bytes());
        bytes.extend_from_slice(&bits.to_le_bytes());
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&data_len.to_le_bytes());
        for s in samples {
            bytes.extend_from_slice(&s.to_le_bytes());
        }
        base64::engine::general_purpose::STANDARD.encode(bytes)
    }

    #[test]
    fn waveform_peaks_keeps_a_quiet_half_quiet() {
        // Each bar takes the max of its own slice, so a quiet first half and a loud second
        // half must come out as a step. A flat line would mean the bar is averaging.
        let mut samples = vec![100i16; 3400];
        samples.extend(std::iter::repeat(20000i16).take(3400));
        let peaks = waveform_peaks(&wav(&samples, 1, 16), 34).expect("16-bit PCM is readable");
        assert_eq!(peaks.len(), 34);
        assert!(peaks.iter().all(|p| (0.0..=1.0).contains(p)), "{peaks:?}");
        assert_eq!(peaks.iter().cloned().fold(0.0, f64::max), 1.0);
        assert!(peaks[0] < 0.05, "quiet half stays quiet: {}", peaks[0]);
        assert!(peaks[33] > 0.95, "loud half reaches full scale: {}", peaks[33]);
    }

    #[test]
    fn waveform_peaks_refuses_what_it_cannot_read() {
        let b64 = |b: &[u8]| base64::engine::general_purpose::STANDARD.encode(b);
        // 8-bit samples are not what the recorder writes; refusing beats drawing noise.
        assert!(waveform_peaks(&wav(&[1, 2, 3, 4], 1, 8), 34).is_none());
        assert!(waveform_peaks("not base64!!", 34).is_none());
        assert!(waveform_peaks(&b64(b"RIFFnope"), 34).is_none());
        assert!(
            waveform_peaks(&wav(&[0; 400], 1, 16), 34).is_none(),
            "silence has no envelope to draw"
        );
    }
}
