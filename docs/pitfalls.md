# 常见陷阱（Pitfalls）

> 本文收录开发中真实踩过的坑。新贡献者提交前建议通读一遍；完整历史见 [archive/memory-notes.md](archive/memory-notes.md)。

## 范围说明

本文只保留仍在现行代码中适用的条目。Electron 时代的坑（2026-09 已移除该线）见存档。

**问题 7：MiMo TTS 流式输出格式**

MiMo API 流式 TTS 返回 PCM16 数据，采样率 24kHz。需要自己组装 WAV 头，用 Float32 归一化后写入。

**问题 8：浏览器录音格式不兼容**

MediaRecorder 输出 WebM/Opus 格式，但 MiMo API 只接受 WAV/MP3。发送前必须用 OfflineAudioContext 转换为 PCM/WAV。

**问题 9：语音克隆模型选择**

克隆音色必须用 `mimo-v2.5-tts-voiceclone` 模型，不能用 `mimo-v2.5-tts`，否则不会使用克隆的音色。

### UI/交互相关

**问题 10：无边框窗口的拖拽**

`frame: false` 后无法拖动窗口。解决：在标题栏区域设置 `-webkit-app-region: drag`，按钮区域设置 `-webkit-app-region: no-drag`。

**问题 11：自定义标题栏按钮需要 IPC 通信**

无边框窗口没有系统标题栏按钮，需要自己实现最小化/最大化/关闭，通过 preload.js 暴露 IPC 方法。

### 历史记录功能相关

**问题 12：首页卡片点击无法跳转**

根因：项目曾存在两套 React Context——`AppContext.tsx` 定义了独立的 `useApp()` + `AppProvider`（仅移动端使用），而 `App.tsx` 内部定义了自己的 context 供桌面端使用。页面错误地从 `../AppContext` 导入 `useApp`，调用的是孤立 context 的 setter，与侧栏/页面渲染用的 `App.tsx` context 互不相通。

修复：统一从 `../App` 导入 `useApp`。移动端那两个文件（`App.mobile.tsx` / `AppContext.tsx`）已随 Capacitor 线一并移除，现在只剩 `App.tsx` 一套 context。

**架构决策：历史记录存储（原为双模式，现只剩文件系统）**

- 文件系统：`文档/YiziVoice/History/`，支持大容量音频存储（唯一的现行路径）
- 早期浏览器降级走 localStorage，受 ~5MB 容量限制，已随 Capacitor 线移除
- 音频文件以 UUID 命名，与记录 ID 一一对应，便于管理和清理
- 删除记录时同步删除对应的 WAV 文件，避免孤儿文件

## 架构决策记录

- 使用 localStorage 而非 electron-store，简化依赖
- 使用 OpenAI 兼容 SDK 而非直接 fetch，便于后续切换模型
- 音色导出用 JSON 格式，导入时重新生成 ID 避免冲突
- 中国大陆网络环境必须配置 electron-builder 镜像源
- 历史记录存储在用户文档目录，便于用户手动管理和备份

### 桌面框架（Tauri 2 单轨，v2.0.1 起；Electron 双轨期已于 2026-09 结束）

- 前端通过 `tauriShim.ts` 注入 `window.desktopAPI`，服务层经 `configService.getBridge()` 取用
- 数据目录 `文档/YiziVoice/`；首启仍探测并继承 Electron 时代写入的 userData 重定向配置（`%APPDATA%/YiziVoice/data-location.json`）——**这段继承逻辑必须保留**，否则老用户数据目录会失联
- **API Key 权威存储 = 系统钥匙串**（Windows 凭据管理器 / macOS Keychain，条目 `mimo-api-key.YiziVoice`）；`settings_load` 只返回 `apiKeyConfigured`（不回显），明文仅由 `settings_load_api_key` 供启动装配，`settings_save` 剥离入库且凭据库失败时报错而非降级文件；legacy 迁移直入钥匙串并抹除文件明文——全部收敛在 Rust `secrets.rs` + `cmds/settings.rs`，前端零感知
- 历史 wav 回放用 Tauri asset protocol（convertFileSrc）+ 运行时 `allow_directory` 扩展 scope，替代 v1.x 的 `webSecurity: false`
- 大 payload（base64 音频）先用 String 直传，实测 >150ms 再切 raw IPC（当前未触发）
- 移动端无可用线：Capacitor 工程已移除，`tauri:android:*` 脚本保留待初始化

### 音色分类管理架构（v1.0.5）

- 分类列表持久化在 `config/voices/list.json` 的 `VoiceList.categories` 字段
- 分类相关 IPC：`voices:load-categories`、`voices:save-categories`、`voices:update-category`（单个角色改分类）、`voices:reassign-category`（删除分类时批量迁移）
- 修改角色分类时，主进程会同步写入该角色的 profile JSON 文件，保证元数据一致
- 删除分类时，该分类下角色自动移至「未分类」
- 前端 `VoiceClone.tsx` 不再使用硬编码 `CATEGORIES` 常量，改为读取动态分类列表；角色移动下拉框额外保证「未分类」始终可选

### 历史记录 voiceName 坑（v1.0.5 修复）

- 克隆音色的 `voice` 状态值是 `clone_<id>`（带前缀），而 `voiceList.voices` 里存的是去掉前缀的真实 `id`
- 直接用 `voice` 去查找角色名永远匹配不到，回退后会把 `clone_<id>`（编号）当作昵称存入历史记录
- 正确做法：先 `voice.startsWith('clone_')` 判断，`slice` 去掉前缀后再去匹配 `name`

### 官网（v1.0.5）

- 单页静态官网 `website/index.html`，完全自包含（CSS/JS/图标全内联），上传单个 HTML 即可部署
- 品牌配色：克莱因蓝 #002FA7（主色）+ 爱马仕橙 #F37021（点缀）+ 婴儿蓝 #E8F4FD（背景）
- 纯代码动画（无图片素材）：波形动画、IntersectionObserver 滚动揭示、毛玻璃液态玻璃卡片、呼吸/浮动 keyframes
- 下载指向网盘下载
- 产品定位为「面向内容创作者的一站式 AI 语音工具」，非限定视频剪辑
- 注意：整页截图时 `data-reveal` 元素初始 `opacity:0`，需滚动到对应区块才会显现（非 bug）；CDP 强制 390px 视口下无横向溢出

### Tauri 2 迁移踩坑记录（v2.0.1）

**问题 13：keyring v3 静默回退 mock 存储（严重，曾丢失真实 Key）**

`keyring = "3"` 未启用平台特性时，v3 会静默使用 mock 内存存储——`set_password()` 返回 Ok 但数据只存在于进程内，退出即丢。首次启动迁移逻辑因此把 settings.json 中的真实 Key 清空而凭据库实际为空。

解决：必须 `keyring = { version = "3", features = ["windows-native"] }`。验证手段：`cargo tree -p keyring -e features` 必须能看到 `windows-sys Win32_Security_Credentials`。

**教训**：涉及密钥搬迁的代码，先验证存储真身（如 `cmdkey /list`）再清空源文件；任何"写入成功"都不可信，除非跨进程能读回。

**问题 14：bundle.resources 数组形式路径错位**

`"resources": ["../default-config"]` 会把资源落到 `target/release/_up_/default-config/`，运行时 `resource_dir()/default-config` 找不到。必须用 map 形式：`{"../default-config/**/*": "default-config/"}`。

**问题 15：NSIS 配置字段不存在**

electron-builder 的 `allowToChangeInstallationDirectory` 在 Tauri NSIS 中不存在（tauri-build 直接报错）。Tauri 向导默认就允许选目录，删掉即可。

**问题 16：assetProtocol 需要 Cargo 特性**

tauri.conf.json 启用 `app.security.assetProtocol` 后，Cargo.toml 的 tauri 依赖必须加 `features = ["protocol-asset"]`，否则构建报 allowlist 不匹配。

**问题 17：模块顶层读取桌面桥在 Tauri 下恒为 false**

ES 模块静态导入提升：`main.tsx` 中 `import App` 先于 `boot()` 安装桥执行，组件模块顶层的 `!!(window as any).desktopAPI` 固化为 false → 标题栏窗口按钮永远不渲染。

解决：改为组件渲染时读取（垫片保证在 React 渲染前注入完毕）。

**问题 18：ASR 页误报「请先设置 API Key」（历史遗留）**

SpeechToText 用了同步 `loadSettings()` 读 localStorage 的 `yizivoice_api`——该 key 自设置页改文件存储后从未被写入，永远为空。其他页面均走异步 `loadAppSettings()`。已统一取值路径并删除 storage.ts 死代码。

**经验 19：语义对齐是前端零改动迁移的关键**

- main.js 的 `window-maximize` 是 toggle 语义（isMaximized ? unmaximize : maximize），垫片映射到 `win.toggleMaximize()`
- main.js 所有 handler 从不 reject（失败吞掉返回默认值），Rust 命令同样不用 Result 返回、内部复刻"失败回默认"
- opaque JSON 一律 `serde_json::Value` 透传，线上格式零漂移
- vite 自动把动态 import 的 tauriShim 拆成独立 chunk（2.8KB），Electron 主包不受污染

**经验 20：CSP 与拖拽区双运行时共存**

- `-webkit-app-region`（Electron）与 `data-tauri-drag-region`（WebView2 不支持前者）属性永久共存互不干扰；JS `startDragging()` 兜底
- CSP 必需项：`style-src 'unsafe-inline'`（React 内联样式）、media/img 含 `asset: http://asset.localhost` 与 `blob:/data:`、connect-src 含 `ipc: http://ipc.localhost` 与 `data: blob:`。**CSP 只在打包态生效**（dev 直连 devUrl 不注入 CSP 头），涉及 CSP 的改动必须装包复验——见问题 22


**问题 21：WebView2 静默丢弃锚点下载（Tauri 线）**

Tauri/wry 未设置下载处理器时,<a download>(含 blob: URL)点击后无任何反应、无报错——导出功能全部静默失效。

解决：所有下载走原生路径。已建 Rust 命令 export_text_file / export_binary_file(dialog 插件 blocking_save_file + fs 写,必须 async 命令调用);前端 storage.ts 的 downloadFile/downloadUrl 分流,新增下载需求勿用锚点。

**问题 22：打包态点下载完全无反应（CSP 拦掉 fetch；v2.0.2 引入，直到 v2.0.4 发版后才发现）**

`downloadUrl` 曾用 `fetch(url)` → `FileReader` 转 base64，而 CSP `connect-src` 未放行 `data:/blob:`，打包态 fetch 被拦；rejection 又被 `void downloadUrl(...)` 吞掉，于是既无报错也无弹窗，表现为「点了没反应」。桌面 `tauri dev` 不注入 CSP，所以只在装包后暴露——**dev 通过不构成证据**。

解决：`downloadUrl` 改为直接从 `data:` URL 切出 base64 段交 Rust 写盘，不再 fetch；录音回显统一改用 `data:audio/wav;base64,${wavBase64}`；`connect-src` 补 `data: blob:`。**下载路径禁止使用 fetch。**

**问题 23：静默降级会吞掉真实故障**

`secrets::set` 原只判断 `set_password` 是否返回 `Ok`，但某些环境下 keyring 会静默回退 mock 实现（返回 Ok 却未落盘），调用方据此抹掉 `settings.json` 里的明文 → 真实 Key 永久丢失（教训 13）。已改为写入后回读校验，不一致返回 false 并告警。

同类隐患：Rust 命令「失败返回默认值、从不 reject」+ 前端 `void xxx()` 的组合，会让失败彻底无声。新增命令时若失败需要用户知晓，必须显式回传状态并由前端消费。

**问题 24：StrictMode 下「清空」effect 会覆盖同一轮挂载中的「还原」**

现象：从音转文等页面第一次点历史记录，界面切到文生音但参数没还原，toast 却说已还原；再点一次才正常。

根因：`TextToSpeech` 的「清空」effect 依赖 `[resetSignal]`，而 **effect 在挂载时也会执行一遍**（与依赖无关），且按声明顺序排在「还原」effect 之后——还原刚写入的文本/模式/草稿被立即清空。第二次点击时页面已挂载、`resetSignal` 未变，清空 effect 不再重跑，于是表现为「第二次才生效」。

解决：用「上次处理过的信号值」做变化门（`if (handled.current === resetSignal) return`），只在信号真正变化时清理。三个页面（`TextToSpeech`/`SpeechToText`/`VoiceClone`）都加了。

**关键：不能用「是否首次执行」布尔量**——StrictMode 下挂载期 effect 会执行两次，`ref` 不重置，布尔量第二次就失效。已用最小复现实测：旧写法 `(empty)`、布尔量写法 `(empty)`、信号值比较 `RESTORED`。

**问题 25：用 state 承载「一次性指令」的数据，会被读两次**

现象：修好问题 24 后，第一次加载会弹**两条**提示。

根因：`App` 原本用 state 存待载入记录 + `consumeTtsEntry()` 取走并置 null。但该回调是闭包，**在同一轮渲染里被调用两次会两次都返回同一条记录**（`setState(null)` 只影响下一次渲染）；StrictMode 挂载期 effect 跑两次，于是还原执行两遍。实测 `consume 还原次数=2`。

解决：改为「signal 触发 + ref 承载 + 取走即清」——`ttsLoadSignal` 负责触发 effect，`pendingTtsEntry` 用 `useRef` 存数据，`takeTtsEntry()` 取走时置 null，第二次调用必然拿到 null，**结构性幂等**。实测降为 1 次。两条约定已写入 AGENTS.md。

**问题 26：Linux 历史还原后播放失败（blob URL 被 StrictMode cleanup 提前 revoke）**

现象：Linux 从历史还原任务后，工作台结果区点播放报「音频播放失败，请尝试下载后播放」；左侧历史列表直接播放正常；Windows 全程正常。

根因：`getHistoryAudioSrc` 在 Linux 把 Rust 读出的字节拼成 blob URL；`AudioPlayer` 的 `useEffect` cleanup 对当前 `src` 调 `URL.revokeObjectURL`。StrictMode 挂载期 mount→cleanup→remount，cleanup 把刚挂上的 blob 吊销。左侧栏是点击时才 `createObjectURL`，不经该 cleanup；Windows 走 asset URL，`releaseAudioSrc` 只碰 `blob:`。

解决：Linux 历史回放改回 **`data:audio/wav;base64,...`**（与新生成结果同形态，无需释放）；`AudioPlayer` cleanup 只释放 effect 闭包捕获的旧 `src`，不读 `el.src`（React 会在 cleanup 前改写 DOM，读 `el.src` 会误伤新地址）。`releaseAudioSrc` 仍只 revoke `blob:` 作兜底。写入 AGENTS.md Linux 坑与 CHANGELOG v2.1.4。
