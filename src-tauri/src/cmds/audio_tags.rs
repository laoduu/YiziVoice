use serde_json::{json, Value};
use tauri::AppHandle;

use crate::init;
use crate::paths;
use crate::util;

pub fn load_opening_tags(app: &AppHandle) -> Value {
    let path = paths::audio_tags_dir(app).join("opening-tags.json");
    util::read_json(&path, init::default_opening_tags())
}

pub fn load_inline_tags(app: &AppHandle) -> Value {
    let path = paths::audio_tags_dir(app).join("inline-tags.json");
    util::read_json(&path, init::default_inline_tags())
}

#[tauri::command]
pub fn audio_tags_load_opening(app: AppHandle) -> Value {
    load_opening_tags(&app)
}

#[tauri::command]
pub fn audio_tags_load_inline(app: AppHandle) -> Value {
    load_inline_tags(&app)
}

fn save_tags(app: &AppHandle, file_name: &str, categories: Vec<Value>) -> Value {
    let data = json!({
        "version": 1,
        "lastUpdated": util::now_ms(),
        "categories": categories,
    });
    util::write_json(&paths::audio_tags_dir(app).join(file_name), &data);
    data
}

#[tauri::command]
pub fn audio_tags_save_opening(app: AppHandle, categories: Vec<Value>) -> Value {
    save_tags(&app, "opening-tags.json", categories)
}

#[tauri::command]
pub fn audio_tags_save_inline(app: AppHandle, categories: Vec<Value>) -> Value {
    save_tags(&app, "inline-tags.json", categories)
}
