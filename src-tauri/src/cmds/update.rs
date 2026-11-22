// 在线更新的 Rust 侧：安装形态判定 + 手动查清单（只读 version/notes/pub_date）。
//
// 为什么手动检查放 Rust：官方 updater 只能「查 + 下 + 装」，而 macOS / Linux / 便携版
// 装不了包（清单里只有 Windows 资源），但仍然应该知道「有新版本了」。
// 抓的是 GitHub Release 资源，跨域头不受我们控制；Rust 侧没有 CORS 问题，
// 且端点与 plugins.updater.endpoints 同源，不会出现两处指向不同清单。

use serde_json::Value;
use std::time::Duration;

/// 清单端点兜底（配置缺失时也能提示）
const UPDATE_MANIFEST_FALLBACK: &str =
    "https://github.com/laoduu/YiziVoice/releases/latest/download/latest.json";

/// 与「手动更新提示」相关的字段。刻意不含 platforms：
/// 这些平台拿不到可装的资源，给了地址只会诱使界面画一个装不了的按钮。
#[derive(Debug, Clone, serde::Serialize)]
pub struct ManualUpdateInfo {
    pub version: String,
    pub notes: String,
    pub date: Option<String>,
}

/// 解析 latest.json → 提示所需字段（纯函数，便于单测）
fn manual_update_from_manifest(value: &Value) -> Result<ManualUpdateInfo, String> {
    let version = value
        .get("version")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "manifest: missing version".to_string())?;
    // 清单允许写 "v1.0.0"，界面统一按不带 v 的形态展示与比较
    let version = version
        .strip_prefix('v')
        .or_else(|| version.strip_prefix('V'))
        .unwrap_or(version)
        .to_string();
    Ok(ManualUpdateInfo {
        version,
        notes: value
            .get("notes")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        date: value
            .get("pub_date")
            .and_then(|v| v.as_str())
            .map(str::to_string),
    })
}

/// 自动更新用的清单地址（plugins.updater.endpoints 的第一项）
fn updater_endpoint(app: &tauri::AppHandle) -> String {
    app.config()
        .plugins
        .0
        .get("updater")
        .and_then(|u| u.get("endpoints"))
        .and_then(|e| e.as_array())
        .and_then(|list| list.iter().find_map(|v| v.as_str()))
        .map(str::to_string)
        .unwrap_or_else(|| UPDATE_MANIFEST_FALLBACK.to_string())
}

/// 只查版本、不安装：给非 Windows / 便携版的「有新版本，请手动下载」用。
#[tauri::command]
pub async fn check_manual_update(app: tauri::AppHandle) -> Result<ManualUpdateInfo, String> {
    let url = updater_endpoint(&app);
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(15))
        .user_agent(concat!("YiziVoice/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("http client init failed: {e}"))?;
    let resp = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let text = resp
        .text()
        .await
        .map_err(|e| format!("read response failed: {e}"))?;
    let value: Value = serde_json::from_str(&text).map_err(|e| format!("parse manifest failed: {e}"))?;
    manual_update_from_manifest(&value)
}

/// 当前运行形态，决定这个 exe 能不能走官方 updater。
///
/// - `nsis`：NSIS 安装版 —— updater 唯一支持的目标（安装包装回同一目录）
/// - `other`：便携副本 / 无法确认 / 非 Windows —— 没有安装位置可覆盖，只能手动换包
///
/// 判定不只看注册表有没有键，还要**当前 exe 确实跑在那个安装目录里**：
/// 同一台机器可能既装过安装版、又跑着别处的副本，只认注册表会更新错目标。
#[tauri::command]
pub fn get_install_kind() -> String {
    #[cfg(target_os = "windows")]
    {
        detect_windows_install_kind()
    }
    #[cfg(not(target_os = "windows"))]
    {
        String::from("other")
    }
}

#[cfg(target_os = "windows")]
fn detect_windows_install_kind() -> String {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    const UNINSTALL: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";
    const PRODUCT_NAME: &str = "YiziVoice";

    // 注册表里的 InstallLocation 常带引号或尾部分隔符
    fn norm_dir(s: &str) -> String {
        s.trim()
            .trim_matches('"')
            .trim_end_matches(|c| c == '\\' || c == '/')
            .to_lowercase()
    }

    let Ok(exe) = std::env::current_exe() else {
        return String::from("other");
    };
    let Some(parent) = exe.parent() else {
        return String::from("other");
    };
    let exe_dir = norm_dir(&parent.to_string_lossy());

    // NSIS 安装版：卸载项的键名就是 productName，卸载器是 uninstall.exe
    for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        let path = format!(r"{UNINSTALL}\{PRODUCT_NAME}");
        let Ok(key) = RegKey::predef(hive).open_subkey_with_flags(&path, KEY_READ) else {
            continue;
        };
        let uninstall: String = key.get_value("UninstallString").unwrap_or_default();
        let loc: String = key.get_value("InstallLocation").unwrap_or_default();
        if uninstall.to_lowercase().contains("uninstall.exe")
            && !loc.is_empty()
            && norm_dir(&loc) == exe_dir
        {
            return String::from("nsis");
        }
    }

    String::from("other")
}

/// 当前运行版本（安装器交接之外的另一处用途：手动更新提示要显示「你现在是 v几」）
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn manifest_parses_and_strips_v_prefix() {
        let v = json!({
            "version": "v2.1.5",
            "notes": "- fix something",
            "pub_date": "2026-11-30T00:00:00Z"
        });
        let info = manual_update_from_manifest(&v).unwrap();
        assert_eq!(info.version, "2.1.5");
        assert_eq!(info.notes, "- fix something");
        assert_eq!(info.date.as_deref(), Some("2026-11-30T00:00:00Z"));
    }

    #[test]
    fn manifest_missing_version_is_error() {
        let v = json!({ "notes": "x" });
        assert!(manual_update_from_manifest(&v).is_err());
    }

    #[test]
    fn manifest_without_date_is_none() {
        let v = json!({ "version": "1.0.0" });
        let info = manual_update_from_manifest(&v).unwrap();
        assert_eq!(info.version, "1.0.0");
        assert!(info.date.is_none());
    }
}
