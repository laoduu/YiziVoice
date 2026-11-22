mod cmds;
mod init;
#[cfg(target_os = "linux")]
mod linux_media;
mod paths;
mod secrets;
mod util;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
            // 在线更新：pubkey/endpoints 在 tauri.conf.json plugins.updater
            .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            paths::init_storage_compat(&handle);
            init::initialize_config_files(&handle);
            secrets::migrate_file_key_if_needed(&handle);
            paths::ensure_history_dir(&handle);

            // 静态 scope 只兜底默认 Documents 路径;数据根被用户重定向后,
            // 由 storage_migrate_data 运行时重新放行新目录。
            let history_dir = paths::history_dir(&handle);
            let _ = app
                .asset_protocol_scope()
                .allow_directory(history_dir, true);

            // Linux:开麦克风媒体流并接管权限请求(否则录音静默失效)
            #[cfg(target_os = "linux")]
            linux_media::enable_media_capture(&handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmds::config::config_get_config_dir,
            cmds::config::config_load_all,
            cmds::voices::voices_load_list,
            cmds::voices::voices_load_voice,
            cmds::voices::voices_save_voice,
            cmds::voices::voices_delete_voice,
            cmds::voices::voices_load_categories,
            cmds::voices::voices_save_categories,
            cmds::voices::voices_update_category,
            cmds::voices::voices_reassign_category,
            cmds::voices::voices_rename_category,
            cmds::styles::styles_load,
            cmds::styles::styles_save,
            cmds::audio_tags::audio_tags_load_opening,
            cmds::audio_tags::audio_tags_load_inline,
            cmds::audio_tags::audio_tags_save_opening,
            cmds::audio_tags::audio_tags_save_inline,
            cmds::history::history_load_index,
            cmds::history::history_save_entry,
            cmds::history::history_delete_entry,
            cmds::history::history_get_audio_path,
            cmds::history::history_clear_all,
            cmds::history::history_open_folder,
            cmds::history::history_prune_orphan_audio,
            cmds::settings::settings_load,
            cmds::settings::settings_load_api_key,
            cmds::settings::settings_save,
            cmds::settings::settings_migrate_check,
            cmds::settings::settings_migrate,
            cmds::storage::storage_get_data_dir,
            cmds::storage::storage_migrate_data,
            cmds::storage::storage_reset_data_dir,
            cmds::export::export_text_file,
            cmds::export::export_binary_file,
            cmds::export::export_history_audio,
            cmds::export::history_read_audio,
            cmds::update::get_install_kind,
            cmds::update::check_manual_update,
            cmds::update::get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
