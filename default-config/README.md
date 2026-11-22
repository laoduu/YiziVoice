# default-config

出厂预置配置，首启时由 `src-tauri/src/init.rs` 拷贝进用户数据目录（`文档/YiziVoice/config/`）。

## 结构

```
default-config/
├── voices/
│   ├── list.json          # 克隆音色索引（id / name / category）
│   └── <id>.json          # 音色 profile：name、category、mimeType、
│                          #   audioBase64（样本 WAV）、previewAudioBase64
├── styles/styles.json     # 预设风格（value / label）
└── audio-tags/
    ├── opening-tags.json  # 开场风格标签
    └── inline-tags.json   # 内嵌音频标签
```

## 说明

- **预置音色（9 个）**由 MiMo 平台内置，代码见 `src/services/mimoApi.ts` 的 `PRESET_VOICES`，不在本目录
- 本目录的 `voices/` 是**出厂演示克隆音色**（虚构角色样本），用户可删除；删除后不复活
- 分类列表持久化在 `voices/list.json` 的 `VoiceList.categories`（旧文件由 `categoryVersion` 迁移，见 `init.rs`）
- `bundle.resources` 会把本目录打进安装包（`tauri.conf.json`）

## 修改注意

- schema 变更必须**向后兼容**：新字段可选，消费端用 `??` 兜底
- `list.json` 缺 `categories` 时代码回落到内置默认表，不要依赖它必在
- 新增内置分类需 bump `categoryVersion` 并处理旧文件缺失 `categories` 的情况
