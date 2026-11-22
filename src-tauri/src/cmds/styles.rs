use serde_json::{json, Value};
use tauri::AppHandle;

use crate::init;
use crate::paths;
use crate::util;

pub fn load_styles(app: &AppHandle) -> Value {
    let path = paths::styles_dir(app).join("styles.json");
    util::read_json(&path, init::default_styles())
}

#[tauri::command]
pub fn styles_load(app: AppHandle) -> Value {
    load_styles(&app)
}

#[tauri::command]
pub fn styles_save(app: AppHandle, styles: Vec<Value>) -> Value {
    let data = json!({
        "version": 1,
        "lastUpdated": util::now_ms(),
        "styles": styles,
    });
    util::write_json(&paths::styles_dir(&app).join("styles.json"), &data);
    data
}
