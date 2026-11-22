use serde_json::{json, Value};
use tauri::AppHandle;

use crate::paths;
use crate::util;

const SERVICE: &str = "YiziVoice";
const ACCOUNT: &str = "mimo-api-key";

fn entry() -> Option<keyring::Entry> {
    keyring::Entry::new(SERVICE, ACCOUNT).ok()
}

pub fn get() -> Option<String> {
    let entry = entry()?;
    match entry.get_password() {
        Ok(password) if !password.is_empty() => Some(password),
        Ok(_) => None,
        Err(keyring::Error::NoEntry) => None,
        Err(e) => {
            eprintln!("[YiziVoice] credential get failed: {}", e);
            None
        }
    }
}

// Returns false when the OS credential store is unavailable or silently mocked.
// Callers must treat that as a hard failure: the API key is never written to
// settings.json as a fallback.
//
// Write-then-read-back verification is intentional. Some platforms silently
// substitute a mock keyring that returns Ok from set_password without persisting
// anything (see docs/pitfalls.md (keyring silent mock)); without this check the app would pretend
// the key was saved and then lose it on restart.
pub fn set(key: &str) -> bool {
    let Some(entry) = entry() else { return false };
    if let Err(e) = entry.set_password(key) {
        eprintln!("[YiziVoice] credential set failed: {}", e);
        return false;
    }
    match entry.get_password() {
        Ok(stored) if stored == key => true,
        Ok(_) => {
            eprintln!(
                "[YiziVoice] credential set NOT persisted: read-back mismatch (keyring may be mocked)"
            );
            false
        }
        Err(e) => {
            eprintln!("[YiziVoice] credential set NOT persisted: read-back failed: {}", e);
            false
        }
    }
}

pub fn delete() -> bool {
    let Some(entry) = entry() else { return false };
    match entry.delete_credential() {
        Ok(()) => true,
        Err(keyring::Error::NoEntry) => true,
        Err(e) => {
            eprintln!("[YiziVoice] credential delete failed: {}", e);
            false
        }
    }
}

// Legacy migration: builds up to v2.1.2 could leave the key in settings.json
// as plaintext (either from before the credential store existed, or from the
// old "keyring failed, keep it in the file" fallback). Move it into the OS
// credential store once, then scrub the file.
//
// If the store is unavailable we leave the legacy value in place rather than
// silently deleting the user's only copy, but new saves never fall back to
// plaintext.
pub fn migrate_file_key_if_needed(app: &AppHandle) {
    let path = paths::settings_path(app);
    let mut data = util::read_json(&path, Value::Null);
    let file_key = data
        .get("api")
        .and_then(|api| api.get("apiKey"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if file_key.is_empty() {
        return;
    }

    // If a credential already exists the store is authoritative; the file copy
    // is stale either way and must still be scrubbed.
    let stored = crate::secrets::get().is_some() || set(file_key);
    if !stored {
        eprintln!(
            "[YiziVoice] legacy plaintext API key could not migrate to the OS credential store; leaving the file untouched"
        );
        return;
    }

    if let Some(api) = data.get_mut("api").and_then(|v| v.as_object_mut()) {
        api.insert("apiKey".into(), json!(""));
    }
    util::write_json(&path, &data);
    println!("[YiziVoice] legacy API key migrated to the OS credential store and scrubbed from settings.json");
}
