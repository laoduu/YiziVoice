use serde_json::{json, Value};
use tauri::AppHandle;

use crate::paths;
use crate::util;

#[tauri::command]
pub fn config_get_config_dir(app: AppHandle) -> String {
    util::path_str(&paths::config_dir(&app))
}

#[tauri::command]
pub fn config_load_all(app: AppHandle) -> Value {
    json!({
        "voiceList": super::voices::load_voice_list(&app),
        "styles": super::styles::load_styles(&app),
        "openingTags": super::audio_tags::load_opening_tags(&app),
        "inlineTags": super::audio_tags::load_inline_tags(&app),
    })
}
