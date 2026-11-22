use serde_json::{json, Value};
use std::collections::HashSet;
use tauri::AppHandle;

use crate::paths;
use crate::util;

const DEFAULT_TEXT_MODEL: &str = "mimo-v2.6-flash";

pub fn load_app_settings(app: &AppHandle) -> Value {
    util::read_json(
        &paths::settings_path(app),
        json!({
            "api": { "apiKey": "", "baseUrl": "https://api.xiaomimimo.com/v1" },
            "defaultVoice": "mimo_default",
            "defaultFormat": "wav",
            "textModel": DEFAULT_TEXT_MODEL
        }),
    )
}

fn needs_migration(app: &AppHandle) -> bool {
    !paths::migrated_marker_path(app).exists()
}

fn merge_tag_categories(existing: Value, incoming: &[Value]) -> Value {
    let mut result = existing.as_array().cloned().unwrap_or_default();
    for cat in incoming {
        let name = cat.get("name").and_then(|v| v.as_str());
        if name.is_none() {
            continue;
        }
        let found = result
            .iter_mut()
            .find(|c| c.get("name").and_then(|v| v.as_str()) == name);
        match found {
            Some(found) => {
                let found_obj = match found.as_object_mut() {
                    Some(o) => o,
                    None => continue,
                };
                if !found_obj.get("tags").map(|t| t.is_array()).unwrap_or(false) {
                    found_obj.insert("tags".into(), json!([]));
                }
                let tags = found_obj.get_mut("tags").unwrap();
                let tag_arr = tags.as_array_mut().expect("tags array");
                if let Some(new_tags) = cat.get("tags").and_then(|v| v.as_array()) {
                    for tag in new_tags {
                        if !tag_arr.contains(tag) {
                            tag_arr.push(tag.clone());
                        }
                    }
                }
            }
            None => {
                let mut merged = cat.clone();
                if let Some(obj) = merged.as_object_mut() {
                    obj.insert("builtin".into(), json!(false));
                }
                result.push(merged);
            }
        }
    }
    Value::Array(result)
}

#[tauri::command]
pub fn settings_load(app: AppHandle) -> Value {
    // Migrate and scrub any legacy plaintext key before returning the payload.
    // The settings UI is write-only for the key: it never receives the stored
    // value back, only whether one is configured.
    crate::secrets::migrate_file_key_if_needed(&app);
    let mut settings = load_app_settings(&app);
    // The retired `mimo-v2.5` text model must never be used again; older settings.json
    // files have no `textModel`, so surface the current default instead of an empty id.
    let text_model_empty = settings
        .get("textModel")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().is_empty())
        .unwrap_or(true);
    if text_model_empty {
        if let Some(obj) = settings.as_object_mut() {
            obj.insert("textModel".into(), json!(DEFAULT_TEXT_MODEL));
        }
    }
    let configured = crate::secrets::get().is_some();
    if let Some(api) = settings.get_mut("api").and_then(|v| v.as_object_mut()) {
        api.insert("apiKey".into(), json!(""));
        api.insert("apiKeyConfigured".into(), json!(configured));
    }
    settings
}

// The only consumer allowed to read the plaintext key is the API client boot
// path. The settings form uses `apiKeyConfigured` instead.
#[tauri::command]
pub fn settings_load_api_key() -> String {
    crate::secrets::get().unwrap_or_default()
}

fn take_key_fields(data: &mut Value) -> (String, bool) {
    let Some(api) = data.get_mut("api").and_then(|v| v.as_object_mut()) else {
        return (String::new(), false);
    };
    let key = api
        .get("apiKey")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let clear = api
        .get("clearApiKey")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    api.insert("apiKey".into(), json!(""));
    api.remove("clearApiKey");
    api.remove("apiKeyConfigured");
    (key, clear)
}

#[tauri::command]
pub fn settings_save(app: AppHandle, mut data: Value) -> Value {
    // Empty key = "keep the stored one"; a non-empty key replaces it; only an
    // explicit clearApiKey removes it. The file copy is always blank.
    let (incoming_key, clear_requested) = take_key_fields(&mut data);

    let mut success = true;
    let mut message = String::new();
    if clear_requested {
        if !crate::secrets::delete() {
            success = false;
            message = "无法从系统凭据库删除 API Key".into();
        }
    } else if !incoming_key.is_empty() && !crate::secrets::set(&incoming_key) {
        success = false;
        message = "API Key 未能写入系统凭据库（Windows 凭据管理器 / macOS 钥匙串）".into();
    }

    util::write_json(&paths::settings_path(&app), &data);
    json!({
        "success": success,
        "keyConfigured": crate::secrets::get().is_some(),
        "message": message
    })
}

#[tauri::command]
pub fn settings_migrate_check(app: AppHandle) -> bool {
    needs_migration(&app)
}

#[tauri::command]
pub fn settings_migrate(app: AppHandle, old_data: Value) -> Value {
    let empty = json!({});
    let old_settings = old_data.get("settings").cloned().unwrap_or(empty.clone());
    let old_config = old_data.get("configFallback").cloned().unwrap_or(empty);

    // 1. Legacy key goes straight into the OS credential store; the file never
    //    keeps a plaintext copy. A failed write is reported but not persisted.
    let app_settings = json!({
        "api": old_settings.get("api").cloned().unwrap_or(json!({
            "apiKey": "",
            "baseUrl": "https://api.xiaomimimo.com/v1"
        })),
        "defaultVoice": old_settings
            .get("defaultVoice")
            .filter(|v| !v.is_null())
            .cloned()
            .unwrap_or(json!("mimo_default")),
        "defaultFormat": old_settings
            .get("defaultFormat")
            .filter(|v| !v.is_null())
            .cloned()
            .unwrap_or(json!("wav")),
        "textModel": old_settings
            .get("textModel")
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(|s| json!(s))
            .unwrap_or(json!(DEFAULT_TEXT_MODEL)),
    });
    let legacy_key = app_settings
        .get("api")
        .and_then(|a| a.get("apiKey"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let mut file_version = app_settings.clone();
    if let Some(api) = file_version.get_mut("api").and_then(|v| v.as_object_mut()) {
        api.insert("apiKey".into(), json!(""));
    }
    let key_migrated = if legacy_key.is_empty() {
        true
    } else {
        crate::secrets::set(&legacy_key)
    };
    if !key_migrated {
        eprintln!("[YiziVoice] legacy API key could not be migrated to the OS credential store");
    }
    util::write_json(&paths::settings_path(&app), &file_version);

    // 2. Migrate voices.
    if let Some(profiles) = old_settings.get("voiceProfiles").and_then(|v| v.as_array()) {
        for profile in profiles {
            let has_id = profile
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| !s.is_empty())
                .unwrap_or(false);
            if !has_id {
                continue;
            }
            let obj = profile.as_object().cloned().unwrap_or_default();
            let truthy = |key: &str, fallback: &str| -> Value {
                match obj.get(key).and_then(|v| v.as_str()) {
                    Some(s) if !s.is_empty() => json!(s),
                    _ => json!(fallback),
                }
            };
            let created_at = match obj.get("createdAt") {
                Some(v) if v.is_i64() || v.is_u64() || v.is_f64() => v.clone(),
                _ => json!(util::now_ms()),
            };
            let voice = json!({
                "id": obj.get("id").cloned().unwrap_or(Value::Null),
                "name": truthy("name", "未命名音色"),
                "category": truthy("category", "未分类"),
                "description": obj.get("description").cloned().unwrap_or(json!("")),
                "audioBase64": obj.get("audioBase64").cloned().unwrap_or(json!("")),
                "mimeType": truthy("mimeType", "audio/wav"),
                "previewAudioBase64": obj.get("previewAudioBase64").cloned().unwrap_or(json!("")),
                "createdAt": created_at,
            });
            super::voices::voices_save_voice(app.clone(), voice);
        }
    }

    // 3. Migrate custom styles.
    let custom_styles = old_settings
        .get("customStyles")
        .and_then(|v| v.as_array())
        .filter(|a| !a.is_empty());
    if let Some(custom_styles) = custom_styles {
        let styles_path = paths::styles_dir(&app).join("styles.json");
        let mut current = super::styles::load_styles(&app);
        let existing_ids: HashSet<String> = current
            .get("styles")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|s| s.get("id").and_then(|i| i.as_str()))
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        if let Some(current_obj) = current.as_object_mut() {
            let styles = current_obj
                .entry("styles".to_string())
                .or_insert_with(|| json!([]));
            if let Some(arr) = styles.as_array_mut() {
                for s in custom_styles {
                    let id = s.get("id").and_then(|i| i.as_str()).unwrap_or("");
                    if id.is_empty() || existing_ids.contains(id) {
                        continue;
                    }
                    let mut entry = s.clone();
                    if let Some(obj) = entry.as_object_mut() {
                        obj.insert("builtin".into(), json!(false));
                    }
                    arr.push(entry);
                }
            }
            current_obj.insert("lastUpdated".into(), json!(util::now_ms()));
        }
        util::write_json(&styles_path, &current);
    }

    // 4. Migrate audio tag categories from configFallback.
    for (key, file_name, loader) in [
        (
            "openingTags",
            "opening-tags.json",
            super::audio_tags::load_opening_tags as fn(&AppHandle) -> Value,
        ),
        (
            "inlineTags",
            "inline-tags.json",
            super::audio_tags::load_inline_tags as fn(&AppHandle) -> Value,
        ),
    ] {
        let incoming_cats = old_config
            .get(key)
            .and_then(|t| t.get("categories"))
            .and_then(|c| c.as_array());
        if let Some(incoming) = incoming_cats {
            let current = loader(&app);
            let merged =
                merge_tag_categories(current.get("categories").cloned().unwrap_or(json!([])), incoming);
            util::write_json(
                &paths::audio_tags_dir(&app).join(file_name),
                &json!({
                    "version": 1,
                    "lastUpdated": util::now_ms(),
                    "categories": merged
                }),
            );
        }
    }

    // 5. Migration marker.
    util::write_text(&paths::migrated_marker_path(&app), &util::iso_now());

    json!({ "success": true, "keyMigrated": key_migrated })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_is_stripped_from_the_payload() {
        let mut data = json!({
            "api": { "apiKey": "sk-secret", "baseUrl": "https://example.com" },
            "defaultVoice": "mimo_default"
        });
        let (key, clear) = take_key_fields(&mut data);
        assert_eq!(key, "sk-secret");
        assert!(!clear);
        assert_eq!(data["api"]["apiKey"], "");
        assert_eq!(data["api"]["baseUrl"], "https://example.com");
    }

    #[test]
    fn empty_key_means_keep_the_stored_one() {
        let mut data = json!({ "api": { "apiKey": "", "baseUrl": "x" } });
        let (key, clear) = take_key_fields(&mut data);
        assert!(key.is_empty());
        assert!(!clear);
        assert_eq!(data["api"]["apiKey"], "");
    }

    #[test]
    fn explicit_clear_is_reported_and_not_written_to_the_file() {
        let mut data = json!({ "api": { "apiKey": "sk-secret", "clearApiKey": true } });
        let (key, clear) = take_key_fields(&mut data);
        assert_eq!(key, "sk-secret");
        assert!(clear);
        assert_eq!(data["api"]["apiKey"], "");
        assert!(data["api"].get("clearApiKey").is_none());
    }

    #[test]
    fn ui_flag_never_reaches_the_file() {
        let mut data = json!({ "api": { "apiKey": "", "apiKeyConfigured": true } });
        take_key_fields(&mut data);
        assert!(data["api"].get("apiKeyConfigured").is_none());
    }
}
