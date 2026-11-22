use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::paths;
use crate::util;

// 弹出系统"另存为"对话框,返回用户选择的路径(取消则 None)。
// 必须在异步命令中调用:阻塞式对话框不允许跑在主线程。
async fn save_dialog(app: &AppHandle, file_name: &str, filter_name: &str, exts: &[&str]) -> Option<PathBuf> {
    let task = app
        .dialog()
        .file()
        .add_filter(filter_name, exts)
        .set_file_name(file_name);
    task.blocking_save_file()
        .map(|p| PathBuf::from(p.to_string()))
}

#[tauri::command]
pub async fn export_text_file(app: AppHandle, content: String, file_name: String) -> Value {
    let Some(path) = save_dialog(&app, &file_name, "JSON", &["json"]).await else {
        return json!({ "success": false, "canceled": true });
    };
    match fs::write(&path, content) {
        Ok(()) => json!({ "success": true, "path": path.to_string_lossy() }),
        Err(e) => json!({ "success": false, "message": e.to_string() }),
    }
}

#[tauri::command]
pub async fn export_binary_file(app: AppHandle, data_base64: String, file_name: String) -> Value {
    let Some(path) = save_dialog(&app, &file_name, "WAV 音频", &["wav"]).await else {
        return json!({ "success": false, "canceled": true });
    };
    let Some(bytes) = util::decode_base64(&data_base64) else {
        return json!({ "success": false, "message": "数据解码失败" });
    };
    match fs::write(&path, bytes) {
        Ok(()) => json!({ "success": true, "path": path.to_string_lossy() }),
        Err(e) => json!({ "success": false, "message": e.to_string() }),
    }
}

// 记录 id 形如 UUID,只允许字母数字与连字符。
// 必须校验:history_get_audio_path 会把 id 拼进路径,id 里塞 "../" 即可逃出 tts 目录。
fn is_safe_entry_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
}

// 去掉路径分隔符/Windows 保留字符/控制字符,只保留纯文件名
fn sanitize_file_name(name: &str, fallback_id: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') && !c.is_control())
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        format!("yizivoice_{}.wav", fallback_id)
    } else {
        trimmed.to_string()
    }
}

// 历史音频导出。入参是记录 id 而非路径:路径由索引推导(tts/ 或 asr/),
// 前端拿不到"任意文件读取"能力。用 fs::copy 直接落盘,不经过 base64 往返。
#[tauri::command]
pub async fn export_history_audio(app: AppHandle, id: String, file_name: String) -> Value {
    if !is_safe_entry_id(&id) {
        return json!({ "success": false, "message": "非法的记录 ID" });
    }

    // 路径完全由索引推导(tts/ 或 asr/),不接受前端传入的路径
    let source = super::history::audio_path_for(&app, &id);
    let history_root = paths::history_dir(&app);

    // 第二道防线:解析真实路径后确认仍落在 History/ 内(防符号链接逃逸)
    let (Ok(source_real), Ok(root_real)) = (source.canonicalize(), history_root.canonicalize()) else {
        return json!({ "success": false, "message": "音频文件不存在" });
    };
    if !source_real.starts_with(&root_real) {
        return json!({ "success": false, "message": "路径越界" });
    }

    let target_name = sanitize_file_name(&file_name, &id);
    let Some(dest) = save_dialog(&app, &target_name, "WAV 音频", &["wav"]).await else {
        return json!({ "success": false, "canceled": true });
    };

    match fs::copy(&source_real, &dest) {
        Ok(_) => json!({ "success": true, "path": dest.to_string_lossy() }),
        Err(e) => json!({ "success": false, "message": e.to_string() }),
    }
}

// 历史音频读取(供前端播放)。
//
// 为什么需要它:Linux 的 <audio> 取不到 asset:// —— WebKitGTK 把媒体加载交给
// GStreamer,不经过 WebKit 的网络层,自定义协议处理器因此被绕过。表现是
// 「刚生成的结果能播(那是 data URL)、历史记录点了没声音」。这里把字节读出来,
// 前端拼 data: URL 播放(blob URL 会被 StrictMode cleanup 提前 revoke)。
// 安全策略与 export_history_audio 完全一致:
// 只接受记录 id,路径由索引推导,并校验解析后的真实路径仍在 History/ 内。
#[tauri::command]
pub async fn history_read_audio(app: AppHandle, id: String) -> Value {
    use base64::Engine as _;

    if !is_safe_entry_id(&id) {
        return json!({ "success": false, "message": "非法的记录 ID" });
    }

    let source = super::history::audio_path_for(&app, &id);
    let history_root = paths::history_dir(&app);
    let (Ok(source_real), Ok(root_real)) = (source.canonicalize(), history_root.canonicalize()) else {
        return json!({ "success": false, "message": "音频文件不存在" });
    };
    if !source_real.starts_with(&root_real) {
        return json!({ "success": false, "message": "路径越界" });
    }

    match fs::read(&source_real) {
        Ok(bytes) => json!({
            "success": true,
            "dataBase64": base64::engine::general_purpose::STANDARD.encode(bytes),
        }),
        Err(e) => json!({ "success": false, "message": e.to_string() }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_uuid_style_ids() {
        assert!(is_safe_entry_id("3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6071"));
        assert!(is_safe_entry_id("abc123"));
    }

    #[test]
    fn rejects_ids_that_could_escape_the_tts_dir() {
        assert!(!is_safe_entry_id(""));
        assert!(!is_safe_entry_id(".."));
        assert!(!is_safe_entry_id("../../config/settings"));
        assert!(!is_safe_entry_id("a/b"));
        assert!(!is_safe_entry_id("a\\b"));
        assert!(!is_safe_entry_id("C:\\Windows\\win.ini"));
        assert!(!is_safe_entry_id("a.b"));
        assert!(!is_safe_entry_id(&"x".repeat(65)));
    }

    #[test]
    fn strips_separators_and_control_chars_from_file_name() {
        assert_eq!(sanitize_file_name("YiziVoice_冰糖_20260921.wav", "id"), "YiziVoice_冰糖_20260921.wav");
        assert_eq!(sanitize_file_name("../../evil.wav", "id"), "....evil.wav");
        assert_eq!(sanitize_file_name("a\\b/c:d.wav", "id"), "abcd.wav");
        assert_eq!(sanitize_file_name("bad\u{1b}name.wav", "id"), "badname.wav");
        assert_eq!(sanitize_file_name("   ", "fallback"), "yizivoice_fallback.wav");
        assert_eq!(sanitize_file_name("", "fallback"), "yizivoice_fallback.wav");
    }
}
