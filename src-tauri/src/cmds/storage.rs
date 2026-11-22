use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::init;
use crate::paths;
use crate::util;

#[tauri::command]
pub fn storage_get_data_dir(app: AppHandle) -> Value {
    let current = paths::data_root(&app);
    let default = paths::default_data_root(&app);
    json!({
        "current": util::path_str(&current),
        "default": util::path_str(&default),
        "isCustom": current != default,
    })
}

#[tauri::command]
pub fn storage_migrate_data(app: AppHandle, new_dir: String) -> Value {
    let old_dir = paths::data_root(&app);
    let new_path = PathBuf::from(&new_dir);

    if old_dir == new_path {
        return json!({ "success": true, "message": "目录相同，无需迁移" });
    }

    if let Err(e) = fs::create_dir_all(&new_path) {
        return json!({ "success": false, "message": format!("迁移失败：{}", e) });
    }

    if new_path.join("settings.json").exists() {
        return json!({
            "success": false,
            "message": "目标目录已存在 YiziVoice 数据，请选择空目录或手动清理"
        });
    }

    let result: Result<(), String> = (|| {
        util::copy_dir(&old_dir, &new_path).map_err(|e| format!("迁移失败：{}", e))?;

        util::write_json(
            &paths::location_cfg_path(&app),
            &json!({ "dataRoot": new_dir }),
        );

        // 验证重定向已生效
        if paths::data_root(&app) != new_path {
            return Err("目录配置验证失败".to_string());
        }

        paths::ensure_history_dir(&app);
        init::initialize_config_files(&app);

        Ok(())
    })();

    match result {
        Ok(()) => {
            // 数据根可指向任意位置,运行时扩展 asset protocol 放行新 History 目录
            let _ = app
                .asset_protocol_scope()
                .allow_directory(new_path.join("History"), true);
            json!({ "success": true, "message": "迁移完成", "newPath": new_dir })
        }
        Err(message) => json!({ "success": false, "message": message }),
    }
}

#[tauri::command]
pub fn storage_reset_data_dir(app: AppHandle) -> Value {
    let config_path = paths::location_cfg_path(&app);
    if config_path.exists() {
        let _ = fs::remove_file(&config_path);
    }
    json!({
        "success": true,
        "path": util::path_str(&paths::default_data_root(&app))
    })
}
