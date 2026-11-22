use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::paths;
use crate::util;

pub fn default_styles() -> Value {
    json!({
        "version": 1,
        "lastUpdated": util::now_ms(),
        "styles": [
            { "id": "builtin_gentle", "label": "温柔", "value": "用温柔轻缓的语调，声音柔和，像在耳边细语", "builtin": true },
            { "id": "builtin_lively", "label": "活泼", "value": "用活泼轻快的语调，语速稍快，声音明亮有活力", "builtin": true },
            { "id": "builtin_serious", "label": "严肃", "value": "用严肃沉稳的语调，语速适中，语气庄重正式", "builtin": true },
            { "id": "builtin_broadcast", "label": "播音", "value": "用专业播音腔，字正腔圆，语速平稳，吐字清晰", "builtin": true },
            { "id": "builtin_magnetic", "label": "磁性", "value": "用磁性低沉的男声，语速偏慢，声音有质感和厚度", "builtin": true },
            { "id": "builtin_sweet", "label": "甜美", "value": "用甜美可爱的女声，语调上扬，声音清亮甜美", "builtin": true },
            { "id": "builtin_sad", "label": "悲伤", "value": "用低沉悲伤的语调，语速缓慢，声音带着哽咽和感伤", "builtin": true },
            { "id": "builtin_excited", "label": "激动", "value": "用激动高昂的语调，语速快，声音充满热情和能量", "builtin": true },
            { "id": "builtin_story", "label": "讲故事", "value": "用讲故事的口吻，语速适中，有起伏，像在给孩子讲睡前故事", "builtin": true },
            { "id": "builtin_dongbei", "label": "东北话", "value": "用东北话口音，语调夸张，语气豪爽", "builtin": true },
            { "id": "builtin_yueyu", "label": "粤语", "value": "用粤语发音，语调自然，带有广东口音", "builtin": true },
            { "id": "builtin_taiwan", "label": "台湾腔", "value": "用台湾腔普通话，语调软糯，尾音上扬", "builtin": true }
        ]
    })
}

pub fn default_opening_tags() -> Value {
    json!({
        "version": 1,
        "lastUpdated": util::now_ms(),
        "categories": [
            { "name": "基础情绪", "tags": ["开心", "悲伤", "愤怒", "恐惧", "惊讶", "兴奋", "委屈", "平静", "冷漠"], "builtin": true },
            { "name": "复合情绪", "tags": ["怅然", "欣慰", "无奈", "愧疚", "释然", "嫉妒", "厌倦", "忐忑", "动情"], "builtin": true },
            { "name": "整体语调", "tags": ["温柔", "高冷", "活泼", "严肃", "慵懒", "俏皮", "深沉", "干练", "凌厉"], "builtin": true },
            { "name": "音色定位", "tags": ["磁性", "醇厚", "清亮", "空灵", "稚嫩", "苍老", "甜美", "沙哑", "醇雅"], "builtin": true },
            { "name": "人设腔调", "tags": ["夹子音", "御姐音", "正太音", "大叔音", "台湾腔"], "builtin": true },
            { "name": "方言", "tags": ["东北话", "四川话", "河南话", "粤语"], "builtin": true },
            { "name": "角色扮演", "tags": ["孙悟空", "林黛玉"], "builtin": true },
            { "name": "唱歌", "tags": ["唱歌"], "builtin": true }
        ]
    })
}

pub fn default_inline_tags() -> Value {
    json!({
        "version": 1,
        "lastUpdated": util::now_ms(),
        "categories": [
            { "name": "语速节奏", "tags": ["吸气", "深呼吸", "叹气", "长叹一口气", "喘息", "屏息"], "builtin": true },
            { "name": "情绪状态", "tags": ["紧张", "害怕", "激动", "疲惫", "委屈", "撒娇", "心虚", "震惊", "不耐烦"], "builtin": true },
            { "name": "语音特征", "tags": ["颤抖", "声音颤抖", "变调", "破音", "鼻音", "气声", "沙哑"], "builtin": true },
            { "name": "哭笑表达", "tags": ["笑", "轻笑", "大笑", "冷笑", "抽泣", "呜咽", "哽咽", "嚎啕大哭"], "builtin": true },
            { "name": "动作描写", "tags": ["提高音量喊话", "小声", "碎碎念", "有气无力", "沉默片刻"], "builtin": true }
        ]
    })
}

pub fn default_voice_categories() -> Value {
    json!(["女声", "男声", "童声", "老年", "播音", "角色扮演", "方言", "设计音色"])
}

pub fn default_voice_list() -> Value {
    json!({
        "version": 1,
        // 2 = "设计音色" has been offered once. Bumping this lets a user delete it later
        // without it being resurrected on the next launch.
        "categoryVersion": 2,
        "lastUpdated": util::now_ms(),
        "voices": [],
        "categories": default_voice_categories()
    })
}

fn default_config_source(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let p = resource_dir.join("default-config");
        if p.exists() {
            return Some(p);
        }
    }
    // dev 模式下资源未打包,回退到仓库目录
    #[cfg(debug_assertions)]
    {
        let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../default-config");
        if let Ok(canon) = p.canonicalize() {
            if canon.exists() {
                return Some(canon);
            }
        }
    }
    None
}

pub fn initialize_config_files(app: &AppHandle) {
    let voices_dir = paths::voices_dir(app);
    let styles_dir = paths::styles_dir(app);
    let audio_tags_dir = paths::audio_tags_dir(app);

    let voice_list_path = voices_dir.join("list.json");
    let styles_path = styles_dir.join("styles.json");
    let opening_tags_path = audio_tags_dir.join("opening-tags.json");
    let inline_tags_path = audio_tags_dir.join("inline-tags.json");

    let config_is_empty = !voice_list_path.exists()
        || util::read_json(&voice_list_path, json!({ "voices": [] })) == default_voice_list();

    if let Some(source) = default_config_source(app) {
        if config_is_empty {
            println!("[YiziVoice] Copying default config from {:?}", source);
            let _ = util::copy_dir(&source, &paths::config_dir(app));
            return;
        }
    }

    if !voice_list_path.exists() {
        util::write_json(&voice_list_path, &default_voice_list());
    }
    if !styles_path.exists() {
        util::write_json(&styles_path, &default_styles());
    }
    if !opening_tags_path.exists() {
        util::write_json(&opening_tags_path, &default_opening_tags());
    }
    if !inline_tags_path.exists() {
        util::write_json(&inline_tags_path, &default_inline_tags());
    }
}
