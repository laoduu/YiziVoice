# 架构说明（Architecture）

> 本文写给想理解代码结构的贡献者。开发环境见 [development.md](development.md)。

## 总览

YiziVoice 是 **Tauri 2 桌面应用**：Rust 壳负责窗口、文件、凭据、打包；React 前端负责全部 UI 与 API 调用。两者通过 `invoke` 命令桥接。

```
┌─────────────────────────────────────────────┐
│  React (src/)                                │
│  pages / components / services               │
│        │  (window.desktopAPI)                │
├────────┼────────────────────────────────────┤
│  tauriShim.ts ── installTauriBridge()        │
│        │  invoke("history_load_index", …)    │
├────────┼────────────────────────────────────┤
│  Rust (src-tauri/)                           │
│  cmds/ 36 条命令 · secrets · paths · init    │
└─────────────────────────────────────────────┘
```

## 桌面桥（desktopAPI）

- 由 `src/services/tauriShim.ts` 的 `installTauriBridge()` 在渲染前注入（`main.tsx` boot 流程）
- 服务层统一经 `src/services/configService.ts` 的 `getBridge()` 取用
- **禁止在模块顶层读取 `window.desktopAPI`**：静态导入提升会早于桥安装求值
- 非 Tauri 宿主（浏览器 `npm run dev`）无桥，依赖桥的功能不可用

## Rust 命令（36 条，八组）

| 组 | 职责 |
|----|------|
| `config` | 配置目录、全量配置加载 |
| `voices` | 音色列表 / 角色 profile / 分类管理 |
| `styles` / `audio_tags` | 风格与音频标签配置 |
| `history` | 历史索引增删查、音频路径推导、孤儿清理 |
| `settings` | 应用设置、API Key 钥匙串存取与迁移 |
| `storage` | 数据目录读取 / 重定向 / 迁移 |
| `export` | 另存为导出、历史音频下载（`export_history_audio`）、Linux 回放读字节（`history_read_audio`） |

约定：命令**失败返回默认值、从不 reject**；opaque JSON 用 `serde_json::Value` 透传。
失败需要用户知晓时必须显式回传状态并由前端消费（详见 [pitfalls.md](pitfalls.md)）。

## 数据目录

默认 `文档/YiziVoice/`（`paths.rs` 解析，支持用户重定向与旧版继承）：

```
YiziVoice/
├── config/
│   ├── settings.json        # 应用设置（无明文 Key）
│   ├── voices/              # 克隆音色 profile（含 audioBase64）
│   ├── styles/  audio-tags/
├── History/
│   ├── index.json           # 历史元数据
│   ├── tts/<id>.wav         # 生成音频
│   └── asr/<id>.wav         # 录音来源的转写音频
```

出厂预置由 `default-config/` 在首启拷贝（`init.rs`）。

## API Key 安全模型

- 只存系统凭据库：Windows 凭据管理器（DPAPI）/ macOS Keychain / Linux Secret Service
- `keyring` crate 必须带三平台特性（`apple-native` / `windows-native` / `sync-secret-service`），缺特性会**静默 mock** 导致假写入
- 设置页只写不回显；`settings_load` 只返回 `apiKeyConfigured`
- 旧文件明文由 `migrate_file_key_if_needed` 迁入凭据库并抹除

## 网络与 CSP

- 唯一外部 API：`https://api.xiaomimimo.com`（`MIMO_BASE_URL` 锁死，`csp:check` 守住）
- CSP 见 `tauri.conf.json`：`media-src` 含 `asset: / blob: / data:`；`connect-src` 含 `ipc: / data: / blob:`
- **CSP 只在打包态生效**（dev 直连 devUrl 不注入）
- asset protocol scope 限定 `$DOCUMENT/YiziVoice/History/**`

## 历史音频回放（平台差异）

| 平台 | 方式 | 原因 |
|------|------|------|
| Windows / macOS | `convertFileSrc` → asset URL | WebView 网络层可走自定义协议 |
| Linux | `history_read_audio` → `data:audio/wav;base64,…` | WebKitGTK 媒体走 GStreamer，不经过 WebKit 网络层，`asset://` 喂不进 `<audio>` |

Linux 路径**不能用 blob URL**：StrictMode 挂载 cleanup 会提前 `revokeObjectURL`（见 [pitfalls.md](pitfalls.md)）。

## 前端状态传递约定

- **`resetSignal` 类「清空」effect 必须做变化门**（用上次处理过的信号值，不用「是否首次」布尔量）
- **一次性指令用「signal 触发 + ref 承载」**（范例：`ttsLoadSignal` + `takeTtsEntry()`），不要用 state 承载待处理数据

## Linux 专项

- 录音需要 wry 的 media stream + permission handler（`linux_media.rs`，必须等事件循环起来）
- 历史回放见上表
- 输入法（IME）：进程需带 `GTK_IM_MODULE` / `XMODIFIERS` 等会话环境变量（从桌面终端启动即可）
- 打包基线 ubuntu-22.04（glibc）；deb 为推荐格式，AppImage 实验性

更多踩坑见 [pitfalls.md](pitfalls.md)。
