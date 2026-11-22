# YiziVoice — AI 开发助手指南

## 项目简介

YiziVoice 是面向内容创作者的桌面语音工具，基于小米 MiMo-V2.5-TTS 系列模型，提供语音克隆、文字转语音（TTS）、语音转文字（ASR）等功能。

## 技术栈

- 前端：React 18 + TypeScript + Vite
- 桌面端：**Tauri 2（Rust + 系统 WebView：Windows WebView2 / macOS WKWebView / Linux WebKitGTK）**——唯一运行时。Electron 旧线与 Capacitor 移动端线均已移除
- 样式：Tailwind CSS
- API：OpenAI 兼容 SDK；接口地址锁死为 `https://api.xiaomimimo.com/v1`（`src/services/mimoApi.ts` 的 `MIMO_BASE_URL`）
- 密钥存储：系统钥匙串（Windows 凭据管理器 DPAPI 加密 / macOS Keychain / Linux Secret Service，keyring crate）；设置页只写不回显
- 打包：Tauri bundler（Windows NSIS 安装器、macOS dmg、Linux deb amd64 + AppImage）；发版由 tag 触发 CI 构建，本机 `npm run tauri:build` 用于本地验证/备用

## 代码规范

1. 用中文与用户交流
2. 代码注释用英文
3. 组件文件放在 `src/` 目录下
4. Rust 命令代码放在 `src-tauri/src/cmds/` 目录下
5. 不要在代码中硬编码 API 密钥；密钥只经 `src-tauri/src/secrets.rs` 存取
6. 修改前端代码后务必检查 TypeScript 类型（`npx tsc --noEmit`）；修改 Rust 后跑 `cargo check`
7. 新增网络调用或资源来源后跑 `npm run csp:check`
8. **任何界面改动先读 [`docs/design-system.md`](docs/design-system.md)（v4）**——它是唯一的视觉事实来源。凭感觉调样式会重新引入已清理掉的漂移

## 视觉规范（Design System）

**唯一视觉事实来源是 [`docs/design-system.md`](docs/design-system.md)（v4）。**

任何界面改动先读该文档；`npm run design:check` 静态门禁逐条对应其 §5。本文不再复制条款——同一规则只许有一份，改一处漏一处是回归事故的来源。历史审计与实施记录见 [`docs/archive/design-audit-v4.md`](docs/archive/design-audit-v4.md)。

硬性红线速览（完整判据以 design-system.md 为准）：

- 字号只用 `text-xs|sm|base|xl|3xl`；圆角只用 `rounded-sm|md|lg|full`；**禁止任意值**
- 字重只有 400/500/600，禁止 `font-bold`
- 交互控件的标签文字一律 body(14px)；12px 只用于 caption / 头像首字 / 密集列表内容预览
- 图标只用 6 档：12 / 14 / 16 / 24 / 30 / 36；无文字图标按钮必须有 `<Tooltip>` 文案
- 文字色只认 token：`text-ink` / `text-ink-2` / `text-ink-3`
- 装饰标识不得借语义调色板；一个图标只承担一个功能
- 亮表面用阴影读边界（`--shadow-card` → `--shadow-lg`），不用位移；描边落在元素最外一像素
- 实心主色上的文字一律 `text-accent-on`，不许 `text-white`

## 重要约定

- 配色方案：边线克莱因蓝 #002FA7、点缀爱马仕橙 #F37021、背景婴儿蓝 #E8F4FD。
  **两个品牌色在两个主题里都在，只是主次对调**（v4.2）：浅色 `--accent`=克莱因蓝、
  `--accent-2`=爱马仕橙；暗色反过来，`--accent`=爱马仕橙、`--accent-2`=克莱因蓝系 `#8AA2FF`。
  暗色画布是中性近黑 `#0A0A0B`（实测通道差 1/255），除主题色外表面与文字一律 R=G=B。
  完整条款见 [`docs/design-system.md`](docs/design-system.md) §5.4「主题色：明暗两个主题主次对调」
- 窗口无边框（`decorations:false`），自定义标题栏；拖拽区用 `data-tauri-drag-region`
- 数据持久化：JSON 文件存 `文档/YiziVoice/`（数据根可被用户重定向）；**API Key 只存系统钥匙串（Windows 凭据管理器 / macOS Keychain），任何文件不落明文**
- **`resetSignal` 这类"清空" effect 必须做变化门**：effect 在**挂载时也会执行一遍**，会覆盖同一轮挂载中"还原历史"写入的状态（曾导致从别的页面第一次点历史记录看似无效、toast 却说已还原）。用「上次处理过的信号值」比较，**不要用"是否首次"布尔量**——StrictMode 下挂载期 effect 会执行两次，布尔量第二次就失效。`TextToSpeech` / `SpeechToText` / `VoiceClone` 三处均已加门
- **App 向页面下达一次性指令用「signal 触发 + ref 承载」**：范例是 `ttsLoadSignal` + `takeTtsEntry()`（取走即清）。**不要用 state 承载待处理数据 + 回调"取走并置 null"**——StrictMode 挂载期 effect 跑两次时，该回调在同一轮渲染里被调两次会两次都返回同一份数据（实测：还原执行 2 次、弹 2 条提示）

### Tauri 架构要点（必须遵守）

- **桌面桥**：前端统一访问 `(window as any).desktopAPI`；由 `src/services/tauriShim.ts` 的 `installTauriBridge()` 在渲染前注入（`main.tsx` boot 流程）。服务层统一经 `configService.ts` 的 `getBridge()` 取用。新增桌面能力需同时改 Rust 命令 + 垫片
- **禁止在模块顶层读取 `window.desktopAPI`**：静态导入提升会早于桥安装求值（踩坑 17）；必须在组件渲染时读取
- **Rust 命令语义**：失败返回默认值、从不 reject；opaque JSON 用 `serde_json::Value` 透传；maximize 用 toggleMaximize
- **历史音频回放**：走 asset protocol（`convertFileSrc`）+ 运行时 `allow_directory`，禁止回退到 `file://`
- **keyring 必须带平台特性**：`features = ["apple-native", "windows-native", "sync-secret-service"]`，缺对应平台特性时静默 mock 导致密钥假写入（踩坑 13，曾丢失真实 Key）；macOS 走 Keychain、Windows 走 DPAPI、Linux 走 Secret Service（经 dbus；**不能用 `linux-native`**，那是 keyutils 内核钥匙环，重启即丢）。注意 Linux 下 mock 的行为：进程内 set→get 能读回，`secrets::set` 的回读校验**挡不住它**，表现为「保存成功、重启后 Key 丢失」——所以三个平台特性必须齐全。Linux 运行时前提是系统有 Secret Service 实现（gnome-keyring/KWallet，主流桌面默认有；最小 WM 环境没有时保存会失败报错，不降级明文，符合设计）。`secrets::set` 已加写入后回读校验。**设置页对 Key 只写不回显**：`settings_load` 只返回 `apiKeyConfigured`，明文只由 `settings_load_api_key` 交给启动时的客户端装配；旧版残留在 `settings.json` 的明文由 `migrate_file_key_if_needed` 迁入钥匙串并抹除，凭据库写入失败**不再回退文件明文**
- **bundle.resources 必须 map 形式**：`{"../default-config/**/*": "default-config/"}`（数组形式落 `_up_/` 目录）
- **AI 文本模型配置**（v2.1.3）：`settings.textModel` 是唯一来源，`textGenerate` 每次从
  `loadAppSettings()` 读取，默认 `mimo-v2.6-flash`；不要再把文本模型 ID 硬编码进调用点。
  `mimo-v2.5` 文本模型已于 2026-10-21 下线（TTS/ASR 的 v2.5 模型不受影响）。
  设置页「获取模型」调用 `GET /models`，过滤 `tts` / `asr` 后供选择；选中即写回配置。
- 打包命令：`npm run tauri:dev` / `npm run tauri:build`；Linux 打包用 `npm run tauri:build -- --bundles deb,appimage`（CLI 参数覆盖 conf 的 targets，否则 Linux 上会把 conf 里的 nsis 也一并打出来）

### Linux 打包要点（WSL/CI 实测，2026-11-15）

- **构建基线必须是 ubuntu-22.04**（CI 已用），不要 ubuntu-latest(24.04)：glibc 基线，24.04 构建的 deb/AppImage 在 22.04 上跑不起来。本地验证可在 WSL 里完整构建（`tauri build --bundles deb`，release 全量约 8 分钟）
- **deb 图标注册三件套**（曾出现「deb 安装后图标未注册」，2026-11-15 WSLg 实测定位 + 修复）：
  1. `bundle.icon` 必须列出**多尺寸 PNG**（32/64/128/256/512）——bundler 只装列表里的 PNG 且按解码尺寸落 hicolor 对应档位，只给 icon.png 就是全系统只有一个 512 档
  2. **`StartupWMClass` 要匹配窗口的实际 WM_CLASS class 字段**：二进制名 `yizivoice`（小写）经 GTK 首字母大写后窗口 WM_CLASS = `("yizivoice", "Yizivoice")`（WSLg `xprop` 实测），而 Tauri 默认模板写的是小写 `yizivoice`——GNOME/KDE 宽松匹配能兜住，Xfce/i3 等严格匹配器下 dock/任务栏显示通用占位图标。已用自定义模板 `src-tauri/deb/main.desktop` 写死 `StartupWMClass=Yizivoice`（conf 的 `bundle.linux.deb.desktopTemplate`）
  3. postinst 兜底：`src-tauri/deb/postinst` 跑 `gtk-update-icon-cache` + `update-desktop-database`（Tauri 默认**不生成** postinst）。主流 Debian/Ubuntu 有 `hicolor-icon-theme` / `desktop-file-utils` 的 dpkg triggers 自动刷新，postinst 主要兜极简镜像
- **deb 包名是 `yizi-voice`**（bundler 对 productName 做 kebab-case），不是 `yizivoice`；包内二进制 `/usr/bin/yizivoice`，desktop 文件 `/usr/share/applications/YiziVoice.desktop`，图标 `/usr/share/icons/hicolor/<N>x<N>/apps/yizivoice.png`
- **`bundle.category` 是 cargo-bundle 风格枚举**（`Music`/`Video`/`Utility`/`Business` 等 PascalCase 值），**写 freedesktop 的 `AudioVideo` 会直接报 `invalid category` 构建失败**；`Music` 才映射为 desktop 的 `Categories=AudioVideo;Audio`（现为 Music）。conf 不配时 Categories 为空行（desktop-file-validate 能过但不规范）
- AppImage 是 Tauri 默认全捆绑 GTK/Wayland 库的方案，在 Mesa 25+ 新发行版上有已知 EGL 崩溃问题（tauri#15665/#15976），**deb 是 Linux 主推格式，AppImage 标注实验性**
- **⚠️ Linux 的两个「WebKitGTK 才有的」坑**（2026-11-16 实测定位，都表现为「Windows 上完全正常」）：
  1. **历史音频放不出声**：WebKitGTK 把媒体加载交给 GStreamer，**不经过 WebKit 网络层**，所以自定义协议
     `asset://` 喂不进 `<audio>`；新生成的结果能播是因为它是 `data:` URL。修法：Linux 走
     `history_read_audio`（Rust 读字节）→ 前端拼 **`data:audio/wav;base64,...`**（v2.1.4；
     不要用 `createObjectURL(blob)`——`AudioPlayer` 挂载期 cleanup 会在 StrictMode 下提前
     `revokeObjectURL`，还原历史后点播放必失败）。**不要指望给 CSP 加 `asset:` 能解决**。
  2. **录音静默失效**：wry 0.55 在 WebKitGTK 上只开了 WebGL/WebAudio，**既没 `set_enable_media_stream(true)`
     也没接 `permission-request` 信号**，两者缺任一都录不了音（前者直接 reject NotAllowedError，
     后者被默认静默 deny），所以「点了没反应、也不弹授权」。修法见 `src-tauri/src/linux_media.rs`：
     补设置 + 只放行 `UserMediaPermissionRequest`，其余权限一律 deny（WebKitGTK 没有系统级授权弹窗，
     放行即永久授权）。**`with_webview` 必须等事件循环起来**——它在 `setup` 里同步调用会与主线程
     投递互等死锁，所以要放到后台线程里延后投递。
  3. 配套：录音失败**必须给用户文案**（`audioRecorder.describeRecorderError` 把 NotAllowed/NotFound/
     NotReadable 等翻译成可操作提示）。原先 `await startRecording()` 没有 try/catch，异常被静默吞掉，
     这是「毫无反应」难查的原因。

### ⚠️ CSP 只在打包态生效（本仓库最重要的坑）

桌面 `tauri dev` 下 webview 直连 `devUrl`（`PROXY_DEV_SERVER = cfg!(all(dev, mobile))`，桌面为 false），CSP 响应头只注入到 `tauri://` 协议响应上。**因此 `tauri dev` 通过不等于打包通过。**

涉及 CSP、asset protocol、凭据库、打包资源的改动**必须装包复验**，验收项见 [`docs/releasing.md`](docs/releasing.md)「发版清单」第 7 步（装包冒烟）。

历史教训（v2.0.2 引入、直到 v2.0.4 后才被发现）：下载音频走 `fetch(data:...)`，而 `connect-src` 未放行 `data:`，打包态被 CSP 拦掉；rejection 又被 `void downloadUrl(...)` 吞掉，表现为「点下载完全无反应」。**下载路径禁止使用 `fetch`**，见 `src/services/storage.ts`。

### 历史记录功能（开发参考）

- **存储**：单一路径——`文档/YiziVoice/History/index.json`（元数据）+ `History/tts/<id>.wav`（音频）。数据根可被用户重定向，实际路径经 `src-tauri/src/paths.rs` 解析
- **Rust 命令（9 个）**：`history_load_index`、`history_save_entry`、`history_delete_entry`、`history_get_audio_path`、`history_read_audio`（Linux 回放读字节，在 `cmds/export.rs`）、`history_clear_all`、`history_open_folder`、`history_prune_orphan_audio`、`export_history_audio`（下载，在 `cmds/export.rs`）
- **音频路径不按类型硬编码**：统一用 `history::audio_path_for(app, id)` 从索引推导子目录（`tts/` 或 `asr/`）。新增涉及历史音频的命令时复用它，不要再手写 `join("tts")`
- **UI**：`src/components/LeftPane.tsx`（左侧栏，**不是** `HistorySidebar.tsx`，该文件已不存在）。Tab 筛选：全部 / 文生音 / 音转文；条目操作：播放与下载（**两者都按 `audioFileName` 是否存在决定是否显示**）、复制、**还原任务**（仅 TTS，即把该条历史的生成条件完整装回编辑器；旧名「加载到编辑器」）、删除。**5 个操作默认全部 hover 才显示**，每个都有 `Tooltip` 文案；播放中该行整组保持可见（见「视觉规范」与 [`docs/design-system.md`](docs/design-system.md) §5.9）
- **回填**：点击 TTS 条目 → `App.tsx` 的 `loadTts` → `TextToSpeech.tsx` 的 `restoreFromEntry` 完整还原生成时的编辑器状态（一级模式 / 自然语言子模式与明细 / 风格 chip / 文本 / 展开的面板），并把当时的音频**替换**回工作台结果区——否则会出现「文本/模式已换成历史的、结果还留着旧的」错配
- **旧记录兼容**：`TtsHistoryEntry` 的界面状态字段全部可选，≤v2.0.4 的记录没有它们，由 `legacyNaturalState()` 从组装后的 `style` 推断。注意历史上导演模式有两种前缀写法（`角色：` 与 `【角色】`），两种都要认
- **还原音频的下载必须按记录 id 走**：还原后结果卡片的 `src` 是 asset URL，而 asset 不在 CSP `connect-src` 内、前端 fetch 会被拦。`AudioPlayer` 的 `historyId` 属性就是为此存在——传了它走 Rust `export_history_audio`，没传则回落到 data URL 路径
- **schema 兼容**：`HistoryIndex` 有 `version: 1` 但加载时**从不校验/迁移**。新增字段必须可选，消费端用 `??` 兜底，不要指望版本门控
- **ASR 音频**：只有「录音」来源落盘到 `History/asr/`（上传来源刻意不落，原文件在用户手里，且存的是转码后 WAV）。旧记录没有 `audioFileName` 字段，故播放/下载按钮按该字段是否存在来渲染
- **清理孤儿音频**：`history_prune_orphan_audio` 有 `dry_run` 参数。**清理类操作必须用 `load_index_strict`**——`util::read_json` 解析失败时返回默认空索引，直接用它会把「索引读不出来」当成「没有记录」而删光音频

### 音色分类管理

- 分类列表持久化在 `config/voices/list.json` 的 `VoiceList.categories` 字段
- **默认分类含「设计音色」**（v2.1.3）：`init::default_voice_categories()` 维护内置表；
  `voices_load_categories` 用 `categoryVersion < 2` 做一次性补入，随后写入 2 ——
  **删除后不会再复活**。新增内置分类时必须同时 bump 这个版本号，并处理 `categories` 缺失的旧文件
  （回落到内置表，不能只剩新分类）
- 分类相关命令（4 个）：`voices_load_categories`、`voices_save_categories`、`voices_update_category`（单个角色改分类）、`voices_reassign_category`（删除分类时批量迁移）
- 修改角色分类时会同步写入该角色 profile JSON，保证元数据一致
- 删除分类时该分类下角色自动移至「未分类」
- 前端 `VoiceClone.tsx` 不使用硬编码分类常量，读取动态分类列表；角色移动下拉框保证「未分类」始终可选
- **克隆音色 voiceName 坑**：克隆音色 `voice` 状态值是 `clone_<id>`，查找角色名必须先去掉 `clone_` 前缀再匹配 `voiceList.voices`
- **「设计音色」不是服务端音色**：`voicedesign` 只返回音频（+ `final_text_preview`），没有可复用的音色 ID。应用把生成音频当**样本**保存，之后文生音仍走 `voiceclone` 发送该样本；界面文案不要暗示“在云端创建/保存了一个音色”。采集入口见 [`docs/design-system.md`](docs/design-system.md) §5.16

### 发版与 CI

- `npm run csp:check`：CSP 白名单与代码一致性（含「接口地址锁死」回归门）
- `npm run design:check`：[`docs/design-system.md`](docs/design-system.md) v4 视觉规范静态门禁（任意值字号/圆角、字重 700、非 token 文字色、图标档位、无文案图标按钮、装饰色族对比度与配色数）。只能查静态可判定项
- `npm run release:check`：版本号三处一致（`package.json` / `tauri.conf.json` / `Cargo.toml`；界面版本由 Vite 构建时从 `package.json` 注入 `__APP_VERSION__`，不手工同步）+ 工作区干净 + HEAD 必须就是该 tag
- `.github/workflows/ci.yml`：push/PR 跑类型检查 + CSP 校验 + 视觉规范校验 + 前端构建 + `cargo test`
- `.github/workflows/release.yml`：tag `v*` 推送触发，校验 → 构建（Windows NSIS + macOS universal dmg + **Linux deb/AppImage，ubuntu-22.04 job**）→ 创建 GitHub Release；也保留 `workflow_dispatch` 手动补跑。Linux job 装系统依赖（官方 prerequisite + `libdbus-1-dev`（keyring 的 Secret Service build script 需要）+ `libfuse2`（linuxdeploy 需要））
- 完整清单见 [`docs/releasing.md`](docs/releasing.md)

## 文件结构

```
YiziVoice/
├── src-tauri/            # Tauri 2 Rust 壳
│   ├── src/
│   │   ├── lib.rs        # 应用装配：插件/36条命令注册/启动初始化
│   │   ├── paths.rs      # 数据目录逻辑（默认/重定向/旧版继承）
│   │   ├── secrets.rs    # API Key 凭据管理（Windows 凭据管理器 / macOS Keychain / Linux Secret Service）
│   │   ├── init.rs       # 默认配置初始化与复制
│   │   ├── util.rs       # JSON 读写/目录复制/base64 解码/时间工具
│   │   └── cmds/         # 八组命令（config/voices/styles/audio_tags/
│   │                     #   history/settings/storage/export）
│   ├── tauri.conf.json   # 窗口/CSP/bundle（NSIS/dmg/deb）/图标/分类配置
│   ├── deb/              # Linux 打包资源：main.desktop（StartupWMClass 对齐实测 WM_CLASS）+ postinst
│   ├── capabilities/     # 最小权限声明
│   └── icons/            # 全套图标（npx tauri icon 生成）
├── src/
│   ├── services/
│   │   ├── mimoApi.ts         # MiMo API 封装（TTS/ASR/VoiceClone + MIMO_BASE_URL）
│   │   ├── audioRecorder.ts   # 录音 + WebM→WAV 转换
│   │   ├── storage.ts         # 类型定义 + 下载入口 + 遗留设置迁移
│   │   ├── runtime.ts         # 运行时检测（tauri/browser）
│   │   ├── tauriShim.ts       # 桌面桥（注入 window.desktopAPI）
│   │   ├── configService.ts   # 配置服务（经 getBridge() 统一入口）
│   │   ├── configTypes.ts     # 配置类型定义
│   │   ├── audioTags.ts       # 音频标签服务
│   │   ├── theme.ts           # 主题（缓存 + 设置持久化）
│   │   ├── historyService.ts  # 历史记录服务（含 asset protocol 回放）
│   │   └── historyTypes.ts    # 历史记录类型定义
│   ├── pages/                 # 三个工作台页面
│   │   ├── TextToSpeech.tsx   # 文生音
│   │   ├── VoiceClone.tsx     # 音色克隆（含分类管理）
│   │   └── SpeechToText.tsx   # 音转文
│   ├── components/
│   │   ├── LeftPane.tsx       # 左侧栏（导航 + 历史记录列表，无底部入口）
│   │   ├── TitleBar.tsx       # 自绘标题栏（主题切换 + 设置中心入口）
│   │   ├── Welcome.tsx        # 欢迎页（主文案含词汇轮播，见 ui/WordReel）
│   │   ├── AudioTagMenu.tsx   # 音频标签菜单
│   │   ├── Toast.tsx          # Toast 通知
│   │   ├── hub/               # HubPage（设置中心整页视图，非弹窗：设置/教程/关于）
│   │   │                      #   + SettingsPanel / TutorialPanel / AboutPanel / tutorialMocks
│   │   ├── tts/               # NaturalLanguagePanel
│   │   └── ui/                # Button/Chip/Dialog/DropdownMenu/Input/
│   │                          #   Segmented/Skeleton/Tooltip/AudioPlayer/WordReel
│   ├── App.tsx                # 主布局 + 三栏壳 + context
│   ├── main.tsx               # 入口（先装桌面桥再渲染）
│   └── index.css              # 全局样式
├── scripts/
│   ├── csp-check.mjs     # CSP 白名单一致性校验
│   ├── design-check.mjs  # 视觉规范静态门禁（任意值/字重/文字色/图标档位/图标按钮文案/装饰色族）
│   └── release-check.mjs # 发版前置校验
├── .github/workflows/    # ci.yml（日常门禁）/ release.yml（tag 发版）
├── default-config/       # 默认配置目录（随安装包分发）
├── dist/                 # Vite 构建输出
├── public/               # 静态资源（界面内 icon.png 在此）
├── website/              # 官网（单页静态 HTML）
├── docs/                 # 开发文档：design-system.md（视觉规范唯一事实来源）/
│   │                     #   development.md / architecture.md / pitfalls.md /
│   │                     #   releasing.md / faq.md
│   ├── archive/          # 历史存档（不维护）：审计记录/计划/项目记忆
├── THIRD_PARTY_NOTICES.md  # 第三方许可声明
├── 启动YiziVoice.bat      # 开发启动（转 npm run tauri:dev）
├── package.json          # 项目配置 + tauri/csp/release 脚本
├── vite.config.ts        # Vite 配置
└── tailwind.config.js    # Tailwind 配置
```
