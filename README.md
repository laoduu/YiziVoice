# YiziVoice

[![CI](https://github.com/laoduu/YiziVoice/actions/workflows/ci.yml/badge.svg)](https://github.com/laoduu/YiziVoice/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/laoduu/YiziVoice)](https://github.com/laoduu/YiziVoice/releases)

**面向内容创作者的免费 AI 语音工作台**——文生音、音色克隆、音转文一站式完成，基于小米 MiMo 系列模型，覆盖短视频、有声书、播客、游戏配音等场景。

桌面端（Windows / macOS / Linux），安装包约 10MB，本地存储、离线可用（生成需联网调用 API）。

> English version: [README.en.md](./README.en.md)

## 功能

| 功能 | 说明 | 底层模型 |
|------|------|---------|
| **文生音** | 输入文案、选择音色，一键生成语音 | `mimo-v2.5-tts` / `mimo-v2.5-tts-voiceclone` |
| **音色克隆** | 录音、上传音频或文字描述，复刻/设计音色并保存为角色，支持分类管理 | `mimo-v2.5-tts-voiceclone` / `mimo-v2.5-tts-voicedesign` |
| **音转文** | 录音或上传音频，自动转为文字 | `mimo-v2.5-asr` |
| **AI 文本模型** | 设置内获取并选择文本模型，用于「AI 生成风格描述」 | 可配置，默认 `mimo-v2.6-flash` |
| **风格控制** | 音频标签 / 一段话描述 / 导演演绎三种写法，12 种预设风格 + 自定义 | - |
| **自然语言控制** | 用自然语言描述风格、语速、情绪，AI 一键扩展为详细风格指令 | `mimo-v2.6-flash` |
| **历史记录** | 自动保存所有生成记录，支持播放、下载、复制、还原任务 | - |
| **生成状态还原** | 点击历史记录完整还原生成时的编辑器状态，并把音频放回工作台 | - |

### 预置音色（9 个）

- 中文：MiMo-默认、冰糖、茉莉、苏打、白桦
- 英文：Mia、Chloe、Milo、Dean

另有出厂演示音色库（玲玲姐、山山大叔等虚构角色），可在应用内试听与管理。

## 安装

从 [GitHub Releases](https://github.com/laoduu/YiziVoice/releases) 下载对应平台安装包（国内用户也可从[官网](https://voice.yizigpt.com)的网盘镜像下载）。

| 平台 | 产物 | 安装 |
|------|------|------|
| **Windows** | `YiziVoice_<版本>_x64-setup.exe` | 双击运行，向导式安装，免管理员权限 |
| **macOS** | `YiziVoice_<版本>_universal.dmg` | 打开拖入 Applications。未签名：首次打开若被 Gatekeeper 拦截，右键选「打开」或执行 `xattr -cr /Applications/YiziVoice.app` |
| **Linux** | `YiziVoice_<版本>_amd64.deb`（推荐） | `sudo apt install ./YiziVoice_<版本>_amd64.deb`（自动补依赖） |
| **Linux** | `YiziVoice_<版本>_amd64.AppImage`（实验性） | `chmod +x` 后直接运行，需系统有 libfuse2 |

> Windows 上若弹 SmartScreen 提示（未签名安装器），选「更多信息 → 仍要运行」。

## 快速开始

1. 启动 YiziVoice，点击「设置」→ 填入 **MiMo API Key** → 保存
2. 在左侧选择功能（文生音 / 音色克隆 / 音转文）
3. 输入文本或录音 → 点击生成 → 试听 / 下载

### 获取 API Key 与计费

前往 [MiMo 控制台](https://platform.xiaomimimo.com/console/balance) 注册并获取 API Key。注册时填写邀请码 `DHLC96` 可额外获得体验金。

| 能力 | 计费 |
|------|------|
| MiMo-TTS 系列（文生音/克隆/设计） | **免费** |
| MiMo-ASR（音转文） | 付费，需账户余额 |
| MiMo-2.6 系列文本模型（AI 生成风格描述） | 付费，需账户余额 |

**API Key 安全**：Key 仅加密存储在本机系统凭据库（Windows 凭据管理器 / macOS Keychain / Linux Secret Service），不写入任何明文文件，也不会上传到任何服务器。设置页对 Key 只写不回显。

## 使用指南

### 文生音

1. 左侧导航点击「文生音」
2. 选择音色：「中文音色」「英文音色」或「克隆音色」分组
3. （可选）展开「语音设置」：音频标签控制（风格胶囊 / 开场风格标签 / 内嵌音频标签）或自然语言控制（一段话描述 / 导演演绎）
4. 在「朗读文本」输入或粘贴文案
5. 点击「生成语音」，完成后可播放或下载 WAV

> 两种控制方式互斥，每次只发一种风格指令。

### 音色克隆

1. 点击「音色克隆」
2. 选择获取方式：**开始录音**（20 秒内）/ **上传文件**（WAV/MP3/WebM/OGG/FLAC，≤10MB）/ **设计音色**（文字描述生成）
3. 确认后在弹窗中试听，填写角色名称、选择分类，保存到「我的音色库」
4. 克隆音色可在「文生音」中选用；支持导出/导入 JSON 与协作者共享

### 音转文

1. 点击「音转文」
2. 开始录音（或上传音频文件）
3. 自动识别为文字，支持中文、英文及自动语言检测；录音可回放、下载与复制

### 历史记录

左侧栏自动保存所有生成记录：播放、下载、复制、**还原任务**（把生成时的完整状态装回编辑器）。数据存储在本地 `文档/YiziVoice/`，可在设置中重定向数据目录。

## 数据与隐私

- 所有数据（配置、音色、历史记录）保存在本地 `文档/YiziVoice/`，可整体迁移备份
- API Key 只存系统凭据库，不落明文（见上文安全说明）
- 生成音频需联网调用 MiMo API；文本与音频仅发往 `api.xiaomimimo.com`
- 无遥测、无统计上报、无账号系统

## 从源码构建

**前置条件**

- Node.js 18+
- Rust stable（[rustup](https://rustup.rs)）
- Windows：Visual Studio Build Tools（勾选「使用 C++ 的桌面开发」）
- Linux：`libwebkit2gtk-4.1-dev`、`libdbus-1-dev` 等（见 [docs/releasing.md](./docs/releasing.md)）
- macOS：Xcode Command Line Tools

```bash
git clone https://github.com/laoduu/YiziVoice.git
cd YiziVoice
npm install
npm run tauri:dev     # 开发模式（热更新）
npm run tauri:build   # 生产打包
```

**提交前门禁**（详见 [CONTRIBUTING.md](./CONTRIBUTING.md)）：

```bash
npx tsc --noEmit        # 类型检查
npm run csp:check       # CSP 白名单一致性
npm run design:check    # 视觉规范静态门禁
cargo test --manifest-path src-tauri/Cargo.toml
```

> ⚠️ **CSP 只在打包态生效**：`tauri dev` 不注入 CSP，涉及下载/资源加载的改动必须装包验证。

## 项目结构

```
YiziVoice/
├── src/                  # React 前端（页面 / 组件 / 服务）
├── src-tauri/            # Tauri 2 Rust 壳（命令 / 密钥 / 打包配置）
├── docs/                 # 开发文档（开发 / 规范 / 发版 / 陷阱）
├── default-config/       # 出厂预置配置（音色 / 风格 / 标签）
├── scripts/              # 门禁脚本（csp-check / design-check / release-check）
├── website/              # 官网（单页静态）
└── .github/workflows/    # CI 与发版流水线
```

更细的架构说明见 [docs/architecture.md](./docs/architecture.md)。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+1 / 2 / 3` | 克隆音色 / 文生音 / 音转文 |
| `Ctrl+L` / `Ctrl+R` | 收起/展开左侧栏 / 右侧栏 |
| `Ctrl+F` | 搜索历史记录 |
| `Ctrl+,` | 设置中心 |
| `Esc` | 关闭弹窗 / 设置 |

## 技术栈

- **桌面**：[Tauri 2](https://tauri.app)（Rust + 系统 WebView）
- **前端**：React 18 + TypeScript + Vite 5 + Tailwind CSS
- **API**：OpenAI 兼容 SDK，接口锁定 `https://api.xiaomimimo.com/v1`
- **密钥**：系统钥匙串（Windows DPAPI / macOS Keychain / Linux Secret Service）

## 常见问题

**Q：工具收费吗？**
工具本身免费开源，仅需自备 MiMo API Key。TTS 系列模型免费调用；ASR 与 2.6 系列文本模型付费，需账户余额。

**Q：升级后 API Key 为什么需要重填？**
Key 一直加密存在系统凭据库，升级一般无需重填；仅从很老的版本跨级升级时可能需要输入一次。

**Q：数据存在哪里？**
本地 `文档/YiziVoice/`（可在设置中重定向）。删除该目录即恢复出厂状态。

**Q：支持哪些平台？**
Windows / macOS / Linux（AMD64）。详见上文安装表。

**Q：克隆音色需要多长时间？**
录音或上传后确认即复刻，通常几秒内出结果。

更多问题见 [docs/faq.md](./docs/faq.md)。

## 文档

| 文档 | 内容 |
|------|------|
| [docs/development.md](./docs/development.md) | 开发环境、目录说明、门禁脚本 |
| [docs/architecture.md](./docs/architecture.md) | 架构说明、桌面桥、数据目录 |
| [docs/design-system.md](./docs/design-system.md) | 视觉规范 v4（唯一事实来源） |
| [docs/pitfalls.md](./docs/pitfalls.md) | 常见陷阱（CSP / keyring / StrictMode 等） |
| [docs/releasing.md](./docs/releasing.md) | 打包与发版清单 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更记录 |

## 贡献

欢迎 Issue 与 Pull Request！提交前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 并通过全部门禁。安全问题请见 [SECURITY.md](./SECURITY.md)。

## 许可证

[MIT License](./LICENSE)

第三方组件许可见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## 致谢

- [小米 MiMo](https://platform.xiaomimimo.com) 系列开源模型——中文表现力与声音克隆能力的底座
- [Tauri](https://tauri.app) / [React](https://react.dev) / [Vite](https://vite.dev) / [Tailwind CSS](https://tailwindcss.com) / [lucide](https://lucide.dev) 等优秀开源项目
- 每一位试用、反馈、提 PR 的用户

---

如果这个项目对你有帮助，欢迎点个 Star ⭐
