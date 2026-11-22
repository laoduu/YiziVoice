> **状态：存档。** 历史版本的打包/部署实录，仅供溯源，不再维护。活的发版流程见 [docs/releasing.md](../releasing.md)。敏感环境细节已脱敏。

# 打包与部署 —— 历史实录（存档）

## v2.1.4（2026-11-22）

**开发中（尚未打 tag / 尚无 Release 产物）。**

- 版本号已升到 **2.1.4**（`package.json` / `tauri.conf.json` / `Cargo.toml` / `Cargo.lock` 四处一致）。
- **修复：Linux 从历史还原任务后，点结果区播放报「音频播放失败，请尝试下载后播放」。**
  根因是历史回放 blob URL 被 `AudioPlayer` 在 StrictMode 挂载 cleanup 里提前 revoke；
  改为 `data:audio/wav;base64,...`（与新生成结果同形态）。详见 `CHANGELOG.md` v2.1.4。
- 验证：`cargo test --locked --offline` 13 项 / `npx tsc --noEmit` / `npm run csp:check` /
  `npm run design:check` / `npm run build` 全绿；`tauri:dev` 热更新确认前端已是 data: 路径。

## v2.1.3（2026-11-14）

| 产物 | 大小 | 备注 |
|------|------|------|
| `YiziVoice_2.1.3_x64-setup.exe` | **11,076,871 字节（10.56 MB）** | tag `v2.1.3` 触发的 CI（windows-latest）产出 |
| `YiziVoice_2.1.3_universal.dmg` | **12,885,639 字节（12.29 MB）** | 同一次 CI（macos-latest，universal，未签名） |
| `YiziVoice_2.1.3_amd64.deb` | **11,075,970 字节（10.56 MB）** | 后补：`workflow_dispatch` 单跑 `job=linux`（ubuntu-22.04） |
| `YiziVoice_2.1.3_amd64.AppImage` | **89,434,616 字节（85.29 MB）** | 同上；实验性（见下） |

版本号已升到 **2.1.3**（`package.json` / `tauri.conf.json` / `Cargo.toml` / `Cargo.lock`）。
**tag `v2.1.3` 已推送并触发发版 CI；Windows 与 macOS 均构建成功，Release 已创建**：
<https://github.com/laoduu/YiziVoice/releases/tag/v2.1.3>。
Release 资产为 `YiziVoice_2.1.3_x64-setup.exe`、`YiziVoice_2.1.3_universal.dmg`、
`YiziVoice_2.1.3_amd64.deb`、`YiziVoice_2.1.3_amd64.AppImage`。
**Linux 产物是版本号不变、事后单跑追加进同一 Release 的**：Actions → Release → Run workflow，
`job` 填 `linux`（只跑 Linux，windows/macos 会被 `if` 跳过）。首发全平台构建仍由 tag 推送完成。
官网 `website/index.html` 的更新日志已把 v2.1.3 标为最新；上传官网下载区。
**Linux 版已写进官网**：下载区两张网盘卡片的平台标签改为「Windows / macOS / Linux 版」，
更新日志 v2.1.3 条目追加了 4 条 Linux 说明（deb/AppImage、Secret Service 存 Key、图标注册修复、
AppImage 实验性），FAQ「支持哪些平台」补了安装命令。**下载渠道以 GitHub Releases 为主**，
Linux 包与 Win/Mac 一样从网盘取 —— 因此**上传官网前先备好 deb / AppImage 产物**，
否则页面承诺的 Linux 版会落空。

- **API Key 改为只写式**：设置页保存后不回显，只保留「已配置」状态与「替换 / 清除」入口。
  `settings_load` 只返回 `apiKeyConfigured`；明文仅由新命令 `settings_load_api_key` 交给启动时的
  API 客户端装配。Key 输入始终明文，但已保存的 Key 不再回填，因此没有回显路径；眼睛按钮已移除。
- **验证 / 保存收进输入框**：草稿为空时两者禁用；「验证」调用 `/models` 探针（不消耗 token），
  成功显示主题色「验证通过」、失败显示红色「验证失败」、保存后回到绿色「已配置」。
  整页底部的「保存设置」已移除（它原本只保存 Key，主题与数据目录操作都是即时的，放在页尾反而误导）。
- 修掉 WebView2 自带密码框 reveal 按钮与自绘眼睛重复的问题；当前 Key 输入已改为 `type="text"`，
  该隐藏规则保留作后续密码字段的兜底。
- **新增「设计音色」入口**：克隆音色页三个同级圆钮（录音 / 上传 / 设计）。设计入口展开文字表单，
  `voicedesign` 生成样本；样本与预览直接复用，保存后仍由 `voiceclone` 在文生音里复用。
  实测用真实 Key 生成成功，`final_text_preview` 回填到「朗读文本」，样本未保存。
  音色描述右上角新增「AI 生成描述与试听文本」：一次返回 `description + sampleText`，
  描述自动填回，试听文本仅在为空时填入、已有内容保留；判空读输入框 DOM 当前值（防 IME 状态滞后）。
  描述变化会清空旧试听音频。试听文本不单独设 AI 入口。模型取 `settings.textModel`。
- **新增默认分类「设计音色」**：内置分类表 + 旧数据一次性迁移（`categoryVersion: 2`），
  设计音色保存时默认选中；录音/上传仍为「未分类」。实测已有设计音色落在该分类下。
- **新增 AI 文本模型配置**：设置页可「获取模型」并选择，默认 `mimo-v2.6-flash`；
  `textGenerate` 改读 `settings.textModel`，移除 `MODELS.TEXT` 硬编码。
  实测 `/models` 返回 `mimo-v2.6-flash / pro / pro-ultraspeed`，选择后已写入 settings.json。
- **删除明文兜底**：凭据库写入失败不再回退 `settings.json`，而是返回错误并保留输入草稿；
  legacy 明文由 `migrate_file_key_if_needed` 迁入系统钥匙串后抹除文件副本。
- 验证：`cargo test` 13 项（新增 4 项设置命令单测）/ `npx tsc --noEmit` / `npm run design:check` /
  `npm run csp:check` / `npm run build` 全绿。
  dev 窗口实测：设置页 Key 只写、AI 模型下拉、设计音色、教程页流程图与左图右文均正常；
  无效 Key 验证显示红色「验证失败」；测试草稿与样本未保存。

## v2.1.2（2026-10-13）

**纯视觉版本**：v4 视觉规范全量落地 + 液态玻璃上机 + 两个主题重做。25 个提交全部落在视觉层，
**未改任何数据格式、Rust 命令或 API 调用** —— 因此没有需要装包复验的 CSP / asset / 凭据 / 打包资源变更。

| 产物 | 大小 | 备注 |
|------|------|------|
| `YiziVoice_2.1.2_x64-setup.exe` | 待本机打包 | `v2.1.2` tag 已打；**推 tag 不再触发 CI**，需要时本机 `npm run tauri:build` 或 Actions 手动运行 `release.yml`（ref 选该 tag） |
| `YiziVoice_2.1.2_universal.dmg` | 待本机打包 | 同上，未签名 |

**本轮未打包**：版本号已升到 2.1.2 并推上 `main`，`v2.1.2` tag 也已打。tag 推送不再触发 CI，
产物需本机打包（或在 Actions 手动运行，ref 选该 tag）；打 tag 前仍按仓库惯例确认 `HEAD == tag`
（`npm run release:check` 会校验，含版本号三处一致 + 工作区干净）。
> 注：该「tag 不触发」策略只属于 v2.1.2；**v2.1.3 已恢复 tag 推送触发 CI**，见本节顶部与发版清单。

**本轮要点**（详见 CHANGELOG.md，规范与实测数据详见 DESIGN.md）：

- **视觉规范 v4**：审计把「字号 8 档、任意值 71 处、签名 40 种、6 项对比度不达标」收敛为
  「5 档字号 / 3 档字重 / 6 档图标 / 27 种签名上限 / 0 项不达标（两主题）」。`DESIGN.md` 升格为
  唯一视觉事实来源，`AGENTS.md` 顶部加了「任何界面改动先读它」。
- **液态玻璃**：先给背底造结构（`--bg-scene`）再降表面 —— `backdrop-filter` 在平底上是数学空操作，
  这是此前「怎么调都不像玻璃」的根因。三材质共用「透表面 + `--glass-edge` 描边 + 顶部镜面」，
  **M2 卡片刻意不给 `backdrop-filter`**（它的背底已被上游模糊过）。
- **指针灯跟随鼠标**取代固定路径扫光；亮色白 / 暗色橙（灯的色相服从表面色相），半径
  `min(上限, max(60px, 0.7×短边))`。**只给 M2/M3**：实测重绘 50ms/帧且与面积无关，付钱的是模糊。
- **文本输入区**：拿到主题色加粗竖条指针（≈4×21px，热点居中），且**不再被指针灯照亮** ——
  灯最亮处正落在光标处，实测排除只能靠位置（`-9999px`），透明度表达不了这件事。
- **修复首页卡片「两层边线」**：`inset` 相对 padding box 解析 + `border: 1px solid transparent`
  ⇒ 描边浮在真边缘内 1px，而表面底色涂满那圈透明边框。修法是 `::after` 用 `inset: -1px`，
  **26 个材质矩形零位移**；会裁剪的材质改用新的 `.mat-clip`，否则描边会被 `overflow: hidden` 整条吃掉。
- **工程**：`design:check` 扩为 8 类静态断言（新增装饰色族对比度、材质边框与描边 `inset` 的配对、
  `.mat-clip` 声明）；`.review/` 加入 `.gitignore`。

**发版前建议人工看一眼的**：暗色卡片的指针灯（0.06 是文字对比度的天花板，不是保守取值）、
首页三张卡的 hover 阴影（那三张是全应用唯一直接落在场景上的裸卡片）、以及两个主题的描边粗细是否对称。

**推送权限备忘（仍然有效）**：本机 git 凭据链里同时有 GCM 与 gh，而 **gh 的 token 只有
`gist`/`read:org`/`repo`，缺 `workflow` 作用域**，只要推的提交碰到 `.github/workflows/*` 就会被拒：

```
refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope
```

绕开 gh、只用 GCM（一次性 `-c` 覆盖，不改动任何 git 配置）：

```bash
**⚠️ 本机推 GitHub 必须走本地代理（v2.1.2 这轮新踩到）**：系统代理是开着的
（WinINET `ProxyEnable=1`、`ProxyServer=127.0.0.1:7897`），但 **git 自己没有配代理**
（`http.proxy` / `https.proxy` 都未设置，也没有 `HTTP(S)_PROXY` 环境变量），所以直连
`github.com:443` 被重置，表现为：

```
fatal: unable to access 'https://github.com/laoduu/YiziVoice.git/': Recv failure: Connection was reset
```

这**不是认证问题**，别去翻凭据。加两个一次性 `-c` 走代理即可（同样不改动任何配置）：

```bash
git -c http.proxy=[本地代理] -c https.proxy=[本地代理] \
自查顺序：`Test-NetConnection 127.0.0.1 -Port 7897` 看代理在不在 →
`curl.exe -sS -o NUL -w "%{http_code}" --proxy [本地代理] https://github.com`
（期望 `200`）→ 再推。**注意 `git ls-remote` 也走同一条路**，所以「本地 `origin/main`
引用是旧的」这种情况要用 fetch 对齐后再数待推提交 —— 否则会把已推送的提交重新数一遍
（本轮报「25 个」而实际是 27 个，就是因为引用停在 `2890841`）。

**发版门禁本轮修过一个真实故障**：`release:check` 写死了 `AboutDialog.tsx` 的路径，而设置中心
整页化把那页搬去 `components/hub/AboutPanel.tsx` —— 于是门禁在读文件时**直接 ENOENT 崩掉**，
版本号一致性、CHANGELOG 条目这些真算出来的结论全被吞掉。它正是 CI 发版流程的第一步，
不修的话 `v2.1.2` tag 一推、release job 立刻失败。现已改为扫 `src/` 全量（必须有文件用
`__APP_VERSION__`、且不许任何源码硬编码当前版本号）。**教训与 `AGENTS.md` 里那条同族：
门禁里写死的路径会随着重构失效，而它失效的方式是"崩"或"永远绿"，两者都不会自己报出来。**

## v2.1.1（2026-09-21）

**架构级清理 + 三处修复**：100+ 文件、净减约 1900 行（删掉了两条旧运行时线）。

| 产物 | 大小 | 备注 |
|------|------|------|
| `YiziVoice_2.1.1_x64-setup.exe` | **10,881,651 字节（10.4 MB）** | **首次由 CI 在 tag 上构建**，本机 `target/release/bundle/nsis/` 不再产出正式包 |
| `YiziVoice_2.1.1_universal.dmg` | **12,580,224 字节（12.0 MB）** | 同上，未签名 |

发布页：<https://github.com/laoduu/YiziVoice/releases/tag/v2.1.1>。Release 与 CI 两个 workflow 均 success（CI 里含 `tsc` / `csp:check` / `vite build` / `cargo test` 7 个单测）。

**推送权限备忘（下次发版会再遇到）**：本机 git 的凭据链里同时有 GCM 与 gh，而 **gh 的 token 只有 `gist`/`read:org`/`repo`，缺 `workflow` 作用域**，直接 push 会被拒：

```
refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope
```

绕开 gh、只用 GCM 即可（一次性 `-c` 覆盖，不改动任何 git 配置）：

```bash
**首次走「tag 触发 CI 发版」**（`.github/workflows/release.yml`）：推送 `v2.1.1` tag → 校验 → 构建 → 自动创建 GitHub Release。本机不再手工打包，产物可追溯到确定的源码（此前出现过 tag 打好 7.5 小时后才本机打包的情况，无法确证产物 == tag 源码）。

**本轮要点**（详见 CHANGELOG.md）：

- **修复**：打包版点「下载」无反应。根因是 CSP `connect-src` 未放行 `data:/blob:`，而下载走 `fetch()`——**v2.0.2 起潜伏三个版本**，因为桌面 `tauri dev` 不注入 CSP，只在装包后暴露。本轮起「装包冒烟」列为发版必做项。
- **修复**：从其它页面第一次点历史记录不生效、且弹两条提示。两者都是 StrictMode 挂载期 effect 跑两次引发的 React 陷阱（约定已写入 AGENTS.md）。
- **新增**：历史记录完整状态还原（含把当时音频放回工作台）、历史音频下载、音转文录音落盘、清理孤儿音频。
- **架构**：Electron 旧线与 Capacitor 移动端线彻底移除；前端桥 `window.electronAPI` → `window.desktopAPI`；接口地址锁死为 `MIMO_BASE_URL`（不再允许自定义，否则打包态会被 CSP 拦）。
- **基建**：`release:check`（版本号三处一致 + HEAD == tag）、`csp:check`（CSP 白名单一致性 + 接口地址锁死回归门）、`cargo test`（7 个单测）全部接入 CI；`secrets::set` 增加写入后回读校验，堵住「静默 mock → 抹掉明文 → 丢 Key」的不可逆路径。

**必须保留**：`src-tauri/src/paths.rs:102-119` 继承 Electron 时代 `%APPDATA%/YiziVoice/data-location.json` 的逻辑——删掉会让老用户自定义数据目录失联。建议再留 1~2 个版本。

## v2.0.4 发布（2026-09-07，本机手工打包）

| 产物 | 路径 | 大小 | 备注 |
|------|------|------|------|
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/YiziVoice_2.0.4_x64-setup.exe` | 待实测（预计 ≈10.3 MB） | 前端改动为主，Rust 壳无新增命令 |
| 免安装版 exe | `src-tauri/target/release/yizivoice.exe` | 3.64 MB（预计不变） | 需同目录放置 `default-config/`（正式安装包已内嵌） |

**v2.0.4 变更摘要**（详见 CHANGELOG.md）：

- 文生音布局重构：顶部控制区移入滚动区，编辑台卡片化（语音设置 / 朗读文本 / 结果列表），小窗口不再遮挡生成结果；朗读文本卡新增标题与清空按钮。
- 风格控制增强：自定义风格新增/修改表单、chip 悬停修改/删除按钮。
- 自然语言控制占位文案升级为「引导 + 示例 + AI 提示」多行指引。
- 三栏布局：左/右栏收起按钮与栏首内容同行、三栏顶部对齐；左栏收起态改纵向 icon 导航；右栏收起完全隐藏、展开按钮在主卡片右上角；右栏栏头统一 H3。
- 快捷键 `Ctrl+B/J` → `Ctrl+L/R`；克隆音色图标换 `ScanFace`；四个主入口 icon/文案统一 16px。
- 工程：`vite.config.ts` 忽略 `src-tauri` 监视，修复 Windows 下 `tauri:dev` 因 Rust 编译产物被 Vite 监听而抛 `EBUSY` 崩溃。

**打包备注**：

- 本次改动全部在前端（React/Tailwind）与配置层，Rust 端 `lib.rs`/`cmds/*` 无改动，release 编译应为纯增量。
- 打包命令：`npm run tauri:build`（Windows NSIS）。

## v2.0.3 发布实测（2026-09-01）

| 产物 | 路径 | 大小 | 备注 |
|------|------|------|------|
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/YiziVoice_2.0.3_x64-setup.exe` | **10.23 MB**（10,732,014 字节） | release 编译 4m 21s（增量），前端 `tsc && vite build` 30.74s（1944 modules / 主 bundle 358 KB / gzip 107 KB） |
| 免安装版 exe | `src-tauri/target/release/yizivoice.exe` | 3.64 MB | 需同目录放置 `default-config/`（正式安装包已内嵌） |

相比 v2.0.2（NSIS 10.21 MB / 免安装 3.64 MB）：安装包几乎持平（+0.02 MB 来自 NL panel + AI 调用代码 + mimoApi textGenerate）；冷启动时间未变（实测复用 v2.0.2 数据）。

**本轮闭环的旧版本遗留**：

- `bundle.resources` 的「按子目录逐个声明」map 写法在 **Windows NSIS 下也未压平**（v2.0.3 首次 Windows 打包验证：prebuilt `default-config/voices/list.json` 在装包后路径正确，VoiceClone 预置音色可正常显示）。上一版「Windows NSIS 是否同样压平尚未核验」的悬疑已解——map 写法在 macOS 与 Windows 表现一致。
- Rust 端 `voices_rename_category` 命令（v2.0.3 新增）被前端调用后 dead_code 警告自动消失（之前 turn-3 加完未触发任何 IPC 时有 warning）。

**v2.0.3 关键工程决策**（详见 CHANGELOG.md）：

- 一级 Segmented「音频标签控制 / 自然语言控制」互斥；二级 Segmented「一段话描述 / 导演演绎」互斥。每次 TTS 请求只发一条 user-content（自然语言模式下不再发送 chip 选中的 style；反之亦然），杜绝双信道拼接的不确定性。
- AI 生成走 `mimo-v2.5`（非 pro）+ 结构化输出 `response_format: { type: 'json_object' }` + 显式 `extra_body: { thinking: { type: 'disabled' } }` 关闭深度思考——文档实证 mimo-v2.5 默认开启思考，**漏传该参数会先跑 reasoning 再生成 JSON 并拖慢响应**。复用 `getClient()` 同一把 API key（与 TTS 共用），不引入新凭据。
- 新增 `voices_rename_category` 命令；落地链路：`src-tauri/src/cmds/voices.rs` + `src/services/tauriShim.ts`（桌面桥）+ `src/services/configService.ts` 包装。
- `useToast()` 在 panel 组件内直接可用（ToastProvider 在 App.tsx 顶层包住全 App），无须 prop drilling。

