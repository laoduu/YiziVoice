# 发版与打包（Releasing）

> 本文写给维护者与发版负责人：打包流程、发版清单、分发方式与已知限制。贡献者日常开发见 [docs/development.md](development.md)。

## Tauri 打包（当前主流程）

### 前置环境（一次性）

- Node.js 18+
- Rust stable（`rustup`，`x86_64-pc-windows-msvc` 工具链）
- Visual Studio Build Tools：勾选「使用 C++ 的桌面开发」（MSVC + Windows SDK）
- WebView2 Runtime：Win10 1803+ / Win11 系统自带；安装器已内置 bootstrapper 兜底（仅 +约 2MB）

**macOS 补充（2026-08-26 起）**：

- Rust 装好 `x86_64-apple-darwin` 与 `aarch64-apple-darwin` 两个 target 即可打 Universal 包，无需 MSVC
- Intel Mac 上 `npm run tauri:build -- --target universal-apple-darwin` 分别编译两架构后 lipo 合并；首次全量约 22min + 13min，增量仅重编应用本体

### 命令与产物

```bash
npm run tauri:dev     # 开发调试（自动拉起 vite:5173 + Rust 编译热载）
npm run tauri:build   # 一键打包（Windows NSIS）
npm run tauri:build -- --target universal-apple-darwin   # macOS 双架构 DMG
```

| 产物 | 路径 | 大小 |
|------|------|------|
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/YiziVoice_2.0.3_x64-setup.exe` | 10.23 MB（v2.0.3 现状；v2.0.2 时 10.21 MB） |
| 免安装版 exe | `src-tauri/target/release/yizivoice.exe` | 3.64 MB |
| macOS Universal DMG | `src-tauri/target/universal-apple-darwin/release/bundle/dmg/YiziVoice_2.0.2_universal.dmg` | ~12 MB |

免安装版运行需将 `target/release/default-config/` 与 exe 放在一起（正式安装包已内嵌）。

### 流水线步骤（`tauri build` 自动串联）

```
步骤 1：tsc 类型门禁（strict）→ Vite 构建前端（dist/，约 324KB JS + 24KB CSS）
步骤 2：cargo build --release（LTO + opt-level=s + strip，前端产物经 frontendDist 内嵌进二进制）
步骤 3：NSIS 打包（makensis）：简中+英文双语向导、currentUser 免 UAC、可选安装目录、内嵌 WebView2 bootstrapper
```

### 配置要点（src-tauri/）

- **identifier** `com.yizivoice.app`——发布后不可再改（决定 app_data_dir 与凭据归属）
- **bundle.resources 必须用 map 形式，且按子目录逐个声明**（2026-08-26 修正）：
  ```json
  "resources": {
    "../default-config/voices/**/*.json": "default-config/voices/",
    "../default-config/styles/**/*.json": "default-config/styles/",
    "../default-config/audio-tags/**/*.json": "default-config/audio-tags/"
  }
  ```
  曾经的单个大杂烩写法 `{"../default-config/**/*": "default-config/"}` 在 macOS 打包时会把所有文件**压平到 default-config 顶层**（`voices/list.json` → `list.json`），首启整体拷贝后布局与代码期望不符，预置音色/风格丢失。数组形式 `"../default-config"` 则会落 `_up_/` 目录。改按子目录声明后无论 bundler 是否压平都能落位正确；顺带用 `*.json` 排除了 `.DS_Store`。**v2.0.3 Windows 打包验证：map 写法在 Windows NSIS 下同样不压平，路径正确**（VoiceClone 预置音色可正常显示）。
- **assetProtocol**：静态 scope 放行 `$DOCUMENT/YiziVoice/History/**`；数据根被用户重定向后由 Rust 在启动及迁移成功时调 `allow_directory` 运行时扩展
- **CSP**：`connect-src` 放行 `ipc:` / `http://ipc.localhost`、`https://api.xiaomimimo.com`，以及 `data: blob:`（应用自身资源，供 `fetch` 用）；`media-src/img-src` 含 `asset: http://asset.localhost`（历史音频回放）与 `blob:/data:`（录音回显）；`style-src 'unsafe-inline'`（React 内联样式必需）
- **CSP 只在打包态生效**：桌面 `tauri dev` 下 webview 直连 `devUrl`（`PROXY_DEV_SERVER = cfg!(all(dev, mobile))`，桌面为 false），CSP 头只注入到 `tauri://` 协议响应上。**dev 通过 ≠ 打包通过——凡涉及 CSP 的改动必须装包复验**（教训见下节「下载与导出」）
- **Cargo 特性**：tauri 需 `protocol-asset`；keyring 必须 `features = ["apple-native", "windows-native"]`（缺平台特性会静默回退 mock 存储，见 docs/pitfalls.md）
- **跨平台 targets**：`["nsis", "app", "dmg"]`——bundler 按宿主机自动过滤（Windows 只产 NSIS，macOS 产 .app/.dmg）；icon 需含 `icons/icon.icns`
- capabilities/default.json：窗口权限 minimize / toggle-maximize / is-fullscreen / set-fullscreen / close / start-dragging + dialog/opener 插件权限

### 图标更换

源图要求：PNG、正方形、透明底、≥1024×1024（勿小图放大）。放置后执行：

```bash
npx tauri icon app-icon.png
```

全套生成至 `src-tauri/icons/`（含多尺寸 icon.ico），exe **编译期内嵌**图标与版本信息——v1.x 的 rcedit 补丁流程彻底废弃。界面内显示的 `public/icon.png`（标题栏/侧栏）建议同步覆盖。

### 性能实测（2026-08-25）

| 指标 | Electron v1.0.5 | Tauri v2.0.2 | 变化 |
|------|----------------|--------------|------|
| 安装包 | 78.23 MB | 10.21 MB | −87% |
| 解压后占用 | 233 MB | 16.38 MB（exe 3.64 + 预置资源 12.74） | −93% |
| 启动到窗口出现 | 2–3 秒（Chromium 初始化） | 441 ms 冷盘首启 / 81–95 ms 常态 | −80% 以上 |

原理：不再捆绑浏览器内核（v1.x 中 Electron 运行时占解压内容 94%），WebView2 复用系统组件。

## 界面设计体系（v2.0.2 起）

- **规范来源**:项目根目录 `DESIGN.md`——所有视觉改动以它为唯一事实来源(token 表/三级材质/反模式清单)
- **双主题**:`<html data-theme>` + CSS 变量;TitleBar 日/月按钮切换,持久化于 settings.theme
- **三栏 Shell**:左 260px 历史栏(Ctrl+L 折叠)/ 中央工具区 / 右 300px 配置面板(Ctrl+R);启动进欢迎页
- **UI Kit**:`src/components/ui/*`(Button/Input/Chip/Segmented/DropdownMenu/Dialog/Skeleton/Tooltip/EmptyState/AudioPlayer),新界面元素优先复用
- **快捷键**:Ctrl+1/2/3=克隆/文生音/音转文 · Ctrl+F 搜索历史 · Ctrl+, 设置 · Esc 关层
- **性能红线**:同屏 backdrop-filter ≤3 层;M2 卡片禁止模糊

## API Key 安全存储（v2.0.1 起，v2.1.3 收口）

- 存储位置：系统钥匙串（Windows 凭据管理器 DPAPI / macOS Keychain），settings.json 不落明文
- 首次启动自动搬迁存量明文 Key 并抹除文件字段；legacy localStorage 数据两级接力自动处理
- **凭据库写入失败时返回错误并保留输入草稿，不再降级回文件持久化**（v2.1.3 删除旧兜底）
- 凭据条目名（cmdkey /list 可见）：`mimo-api-key.YiziVoice`
- 读取顺序：只读系统钥匙串；旧版 `settings.json` 中的明文 Key 启动时迁入钥匙串并抹除，写入失败不再回退文件

## 下载与导出（v2.0.2）

- **WebView2 不响应 `<a download>` 锚点下载**（Electron 时代可用）：点击后静默无反应，无报错
- 全部下载统一走 Rust 命令：`export_text_file`（文本）/ `export_binary_file`（base64→二进制）——系统"另存为"对话框 + 原生写盘；命令为 async（阻塞式对话框不允许跑在主线程）
- 前端入口：`storage.ts` 的 `downloadFile`（文本内容）/ `downloadUrl`（音频，入参为 `data:` URL，直接切 base64 段交 Rust 写盘）
- **下载路径上禁止用 `fetch`**：`fetch` 受 CSP `connect-src` 管，v2.0.2 曾用 `fetch(url)`→`FileReader` 转 base64，因 `connect-src` 未放行 `data:/blob:` 导致**打包态点下载完全无反应**（`void downloadUrl(...)` 吞掉 rejection，无报错无弹窗），而 dev 态不套 CSP 所以一直没暴露；录音回显也统一改用 `data:audio/wav;base64,${wavBase64}`，不再 `URL.createObjectURL(blob)`
- 历史音频下载：`export_history_audio`（`cmds/export.rs`）。**入参是记录 id 而非路径**——路径在 Rust 侧解析并 canonicalize 校验仍落在数据根的 `History/` 内（`tts/` 或 `asr/`，由 `audio_path_for` 推导），前端不持有任意文件读取能力；用 `fs::copy` 直接落盘，不经 base64 往返
- 新增下载需求时**勿用锚点**，直接复用上述入口；取消导出返回 `{success:false, canceled:true}`

## macOS 打包实录（2026-08-26）

首次产出 macOS 安装包（Universal DMG，Intel / Apple Silicon 通吃），过程中确认的问题与修法：

1. **标题栏拖不动**：样式里只有 `-webkit-app-region: drag`（Electron 专用）；Tauri 认 `data-tauri-drag-region` 属性且按 mousedown **目标元素**命中——header、字标 span、右侧容器都要加，按钮子元素不加即天然 no-drag。Windows Tauri 同步受益
2. **最大化语义**：`toggleMaximize()` 是 Windows 式放大还原；macOS 用户预期是原生全屏。垫片按平台分流（darwin → `setFullscreen(!isFullscreen())`），capabilities 补 `allow-is-fullscreen` / `allow-set-fullscreen`
3. **弹窗关闭按钮"闪没"**：`.mat-overlay` 未设 `position:relative`，入场动画的 transform 充当包含块时按钮贴面板右上角、动画结束 transform 归零后回退到外层 fixed 全屏容器——视觉上瞬间消失。面板加 `relative` 一行修复（全平台问题，Windows 同样存在只是没人注意）
4. **打包资源压平**：见上文「配置要点」，单 glob map 在 macOS 下压平目录导致预置音色/风格首启丢失；改按子目录声明修复
5. **工具链备忘**：GitHub HTTPS 在当前网络不可直连，需显式挂系统代理 `export https_proxy=[本地代理] 都不读 macOS 系统代理设置）；无 brew 时 gh 可从 cli/cli release 直链下载二进制放 `~/.local/bin`

## 发版清单（release checklist）

发版由 **tag 推送触发 CI**（`.github/workflows/release.yml`）：校验 → 构建 → 自动创建 GitHub Release，附 Windows NSIS、macOS universal dmg 与 Linux deb/AppImage。本机 `npm run tauri:build` 作为备用/本地验证。需补跑时在 Actions 手动运行 `release.yml`，`job` 入参可选 `all` / `windows` / `macos` / `linux` 单独出某个平台。

1. **改版本号——三处必须一致**（发版前跑 `npm run release:check` 逐项校验；本机提前跑也行，但打 tag 前它必然报「tag vX.Y.Z 不存在」，属预期）
   - `package.json` → `version`（**单一来源**）
   - `src-tauri/tauri.conf.json` → `version`
   - `src-tauri/Cargo.toml` → `[package]` 段的 `version`（跑一次 `cargo check` 会同步 `Cargo.lock`）
   - `CHANGELOG.md` → 把 `## vX.Y.Z（开发中）` 改成 `## vX.Y.Z（日期）`
   - 界面里的版本**不用改**：`vite.config.ts` 构建时从 `package.json` 注入 `__APP_VERSION__`；`release:check` 会拦住把它改回硬编码
2. `npm run csp:check` — CSP 白名单与代码一致性（新增网络调用/资源来源后必跑）
3. `npm run design:check` — 视觉规范静态门禁
4. `npx tsc --noEmit` + `npm run build`
5. 提交，确认 `git status` 无输出
6. `git tag vX.Y.Z && git push origin vX.Y.Z` → tag 推送触发 CI；等校验与 Windows/macOS 构建完成，Release 页会出现产物。本机 `npm run tauri:build` 仅作备用
7. **装包冒烟（必做，不可省）**——桌面 `tauri dev` 不套 CSP，下面这些在 dev 永远看不到问题：
   - 文生音 → 生成 → 下载音频（应弹系统另存为）
   - 音转文 / 克隆音色 → 录音 → 下载（应弹系统另存为）
   - 克隆音色 → 音色库 → 导出全部（应弹系统另存为）
   - 历史记录音频回放（asset protocol）
   - 设置里保存 API Key → 重启 → Key 仍在（证明凭据库真写入而非静默 mock）
   - 设置里点「验证」→ 状态显示「验证通过」；点「获取模型」→ 下拉中出现可用的 2.6 模型
   - 设置 AI 文本模型后，文生音「AI 生成风格描述」/ 设计音色「AI 生成描述与试听文本」均能返回
   - 设计音色 → 生成试听 → 保存角色 → 重启后角色仍在且可在文生音选用
8. macOS 若在 CI 之外手工打包：另需验证 `bundle.resources` 未压平（见「配置要点」）

CI 的两个工作流：`ci.yml` 在 push/PR 上跑类型检查 + CSP 校验 + 视觉规范 + 前端构建 + `cargo test`；`release.yml` 在 tag `v*` 上跑校验 + 打包 + 发 Release，也支持手动按 job 单跑。

**手动单跑踩过的两个坑**（v2.1.3 追加 Linux 产物时实测）：
- `actions/checkout` 默认浅克隆且不拉 tags，`--ref main` 手动跑时 `release:check` 会误报「tag 不存在」→ 三个 job 均已 `fetch-depth: 0`。
- `workflow_dispatch` 下 `github.ref` 是分支名，`softprops/action-gh-release` 报「GitHub Releases requires a tag」→ 三个 job 均从 `package.json` 推导 `tag_name`。
- 另注意：**强推 tag（`git push -f origin vX.Y.Z`）会再触发一次全平台构建**，需要单跑时先取消那次，再手动 dispatch。

## 分发方式（当前）

1. 将打包产物的 `YiziVoice_<版本>_x64-setup.exe`分发给用户
2. 双击安装：双语向导、可选目录、免管理员权限（currentUser）
3. 缺失 WebView2 的机器由内置 bootstrapper 现场拉取微软官方运行时
4. 首启自动初始化 `文档/YiziVoice/`（预置音色/风格/标签），老用户数据与 Key 自动继承

**macOS**：打包产物为 `YiziVoice_<版本>_universal.dmg`，打开拖入 Applications；未签名，Gatekeeper 拦截时右键 → 打开或 `xattr -cr /Applications/YiziVoice.app`。

**Linux**：
- `YiziVoice_<版本>_amd64.deb`为**主推**：`sudo dpkg -i`（或 `apt install ./xxx.deb` 自动补依赖）安装到 `/usr/bin/yizivoice`，菜单项与图标即注册。
- `YiziVoice_<版本>_amd64.AppImage`为**实验性**：`chmod +x` 后直接运行，需系统有 libfuse2（22.04 起默认不装）。Tauri 会捆绑 GTK/Wayland 库，在 Mesa 25+ 的新发行版上有已知 EGL 兼容问题（tauri#15665/#15976），遇到启动失败请改用 deb。
- 运行前提：WebKitGTK 4.1（deb 自动声明依赖）；Secret Service 实现（gnome-keyring/KWallet，主流桌面默认有）——缺失时 API Key 保存会明确报错，不会静默写明文。
- 构建基线固定 **ubuntu-22.04**（glibc），不要在 24.04 上出正式包。

## 已知限制

- 未签名 exe 有 SmartScreen 提示（与 v1.x 相同；后续可引入 tauri-plugin-updater 时一并建设签名体系）
- macOS DMG 同为未签名分发，Gatekeeper 首启需手动放行；正式对外分发需 Developer ID 签名 + 公证
- 移动端无可用线：Capacitor 工程已移除；`tauri:android:*` 脚本保留但尚未初始化（需 Android Studio + NDK 环境）
- 极老旧版本（localStorage 时代）直接跨级升级到 v2.0.2 需重新输入一次 API Key
