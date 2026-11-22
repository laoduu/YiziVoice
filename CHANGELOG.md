# 更新日志

本文件记录 YiziVoice 每个版本的开发变更。

格式约定：版本标题 `## [X.Y.Z] - YYYY-MM-DD`；未发布版本标「开发中」；条目按 **新增 / 变更 / 修复 / 工程** 归类，保留现象-根因-修复-验证的复盘式写法。
英文摘要见 [CHANGELOG.en.md](./CHANGELOG.en.md)（待补）。

## [2.1.4] - 开发中

### 修复:Linux 还原历史后点播放报「音频播放失败」

- **现象**:从历史记录还原任务后，工作台结果区点播放提示「音频播放失败，请尝试下载后播放」；
  左侧历史列表直接播放正常，Windows 全程正常。
- **根因**:Linux 历史回放曾把 Rust 读出的字节拼成 **blob URL**。`AudioPlayer` 在
  `useEffect` cleanup 里对当前 `src` 调用 `URL.revokeObjectURL`；React StrictMode 挂载期
  会 mount → cleanup → remount，cleanup 把刚挂上的 blob 提前吊销，随后 `el.play()` 必失败。
  左侧栏是在点击时才 `createObjectURL`，不经过该挂载 cleanup，所以不受影响；Windows 走
  asset URL，`releaseAudioSrc` 只碰 `blob:`，也不受影响。
- **修复**:`getHistoryAudioSrc` 在 Linux 改为返回 **`data:audio/wav;base64,...`**
  （与新生成结果同一形态，无需释放生命周期）；`AudioPlayer` cleanup 改为只释放 effect
  闭包捕获的旧 `src`，不再读 `el.src`（React 会在 cleanup 前改写 DOM，读 `el.src`
  会误伤新地址）。`releaseAudioSrc` 仍只 revoke `blob:`，作兜底保留。
- **验证**:`cargo test --locked --offline` 13 项通过；`npx tsc --noEmit` / `npm run csp:check` /
  `npm run design:check` / `npm run build` 全绿；`tauri:dev` 热更新后 Vite 已提供
  `data:audio/wav;base64,...` 路径（`historyService` 实测）。桌面端还原→播放请在 Linux 客户端点验。

## [2.1.3] - 2026-11-14

**设置页与音色工作流扩展**：API Key 改为只写式并支持验证；新增可配置的 AI 文本模型；
音色克隆页新增 `voicedesign` 与 AI 生成描述/试听文本；教程页改为流程图 + 左图右文。
数据格式新增 `settings.textModel` 与 `VoiceList.categoryVersion`；Rust 命令新增
`settings_load_api_key`（共 36 条）。TTS/ASR 的音频接口与格式未变。

### 变更:API Key 改为只写式密钥（保存后不可回看）

- 设置页不再把已保存的 Key 回填到输入框：`settings_load` 只返回 `apiKeyConfigured`，
  明文仅由新命令 `settings_load_api_key` 在启动时交给 API 客户端装配。
- 输入框留空 = 保持现有 Key；输入新值 = 替换；删除需点「清除」并在确认弹窗中二次确认。
  Key 输入始终是明文，但已保存的 Key 不再回填，所以没有回显路径；眼睛按钮已移除。
- 输入框内部右侧提供「验证 / 保存」：验证通过显示主题色「验证通过」，失败显示红色
  「验证失败」，保存后回到绿色「已配置」。验证调用 `/models` 探针，不消耗 token。
- 保存按钮收口在输入框内，草稿为空时禁用；不再有整页底部的「保存设置」。
- 移除 Key 输入框下方的接口地址与「保存后不再显示明文」两行说明文案，密钥区更紧凑。
- 保留 `input::-ms-reveal` / `::-ms-clear` 的隐藏规则作为兜底（当前 Key 输入已改为 `type="text"`）。
- **删除 settings.json 明文兜底**：`settings_save` 的凭据库写入失败不再把 Key 写进文件，
  而是返回错误并保留输入草稿；`settings_migrate` 同样只写空字段。
- 旧版残留在 `settings.json` 的明文 Key 由 `migrate_file_key_if_needed` 迁入系统钥匙串
  并从文件抹除；若钥匙串不可用则保留旧值（不再新增明文）。
- 覆盖平台：Windows 凭据管理器（DPAPI）/ macOS Keychain（`keyring` 的
  `windows-native` + `apple-native` 特性）。

### 新增:音色设计（`voicedesign`）

- 音色克隆页的采集入口从两个变三个：**开始录音 / 上传文件 / 设计音色**，三个 64px 圆钮
  同尺寸、同底色、同图标色；「设计音色」点击后展开自己的文字表单，不接收文件。
- 表单：音色描述（多行）+ 可选试听文本。试听文本留空时启用 `optimize_text_preview`，
  由模型自动生成播报文案；生成结果会回填 `final_text_preview` 并显示为「朗读文本」。
- 生成结果进入与录音/上传相同的试听槽位；「确认并保存角色」直接进入现有保存弹窗，
  不再额外调用 `voiceclone` 生成预览。
- 音色描述右上角新增「AI 生成描述与试听文本」：一次调用文本模型，返回
  `{description, sampleText}`；描述自动填回，试听文本仅在为空时填入，已有内容会被保留。
  **空/非空判断读取试听输入框的 DOM 当前值**（而非 React state），避免中文输入法尚未提交
  时状态滞后导致误覆盖。描述变化会清空旧试听音频。prompt 在 `VoiceClone.tsx`，模型取 `settings.textModel`。
- **数据链路**：`voicedesign` 不返回可复用的音色 ID，保存的是生成音频样本；之后在文生音里
  仍走 `voiceclone` 发送该样本，与现有克隆音色复用方式一致。
- 顺带更新 `voiceDesignGenerate` 返回 `{ audioUrl, finalText }`，此前它只有定义、没有任何调用点。

### 变更:音色分类新增默认「设计音色」

- `init::default_voice_categories()` 增加「设计音色」；新安装直接可见。
- 旧数据一次性迁移：`voices_load_categories` 在 `categoryVersion < 2` 时补入该分类并写入
  `categoryVersion: 2`。**只在首次补一次**——用户之后删掉它不会被下次启动复活。
- 保存设计音色时，保存弹窗默认选中「设计音色」；录音/上传生成的音色仍默认「未分类」。
- `voice_list` 的 shipped fixture 可能没有 `categories` 字段；迁移时回落到内置分类集合，
  不会出现只剩「设计音色」一个分类的情况。

### 新增:AI 文本模型可配置

- 设置页「接口密钥」左列新增 **AI 文本模型**：模型 ID 输入框 +「获取模型」。问号提示
  “用于本应用内 AI 生成风格描述”；下方 12px 友情提示说明 TTS 免费、ASR/2.6 文本付费。
- 「获取模型」调用 `GET /v1/models`，过滤掉 `tts` / `asr`，在输入框下方展示模型下拉；
  选中后自动回填并立即写入设置。手动改 ID 时失焦/回车也会保存。
- 配置存于 `settings.textModel`，默认 `mimo-v2.6-flash`（设置页首次加载即显示）。
- 模型下方友情提示：TTS 免费、ASR / 2.6 文本模型付费；并以主题色补充
  “建议使用 mimo-v2.6-flash，性能足够，每次生成音色描述仅需几分钱”。
- **移除文本模型的硬编码**：`MODELS.TEXT` 删除，`textGenerate` 每次从
  `loadAppSettings()` 读取 `textModel`；`mimo-v2.5` 文本模型已于 2026-10-21 下线，
  TTS/ASR 的 v2.5 模型不受影响。

### 文档:教程页刷新

- 步骤顺序改为 **API Key → AI 文本模型 → 音色克隆与设计 → 文生音 → 音转文 → 历史记录**，
  与左侧导航的实际顺序一致；补回此前缺失的音转文步骤。
- 更新为当前界面：Key 的「验证 / 保存 / 清除」与只写不回显、AI 文本模型获取与计费说明、
  音色克隆的三种入口与「AI 生成描述与试听文本」、文生音三种风格写法、历史记录的
  「还原任务 / 下载音频 / 清理孤儿音频」等。
- 文件存储卡补充 `History/tts` / `History/asr`、`config/` 与「API Key 只在系统钥匙串」。
- 教程页视觉升级：顶部五节点流程、步骤卡左图右文，新增 `components/hub/tutorialMocks.tsx`
  的 CSS 迷你界面（设置、模型、三入口、文生音、音转文、历史、目录树），明暗主题自适应。
- 教程页头副标题从「三步开始使用 YiziVoice」改为「从配置到生成，一步步上手」，
  不再绑定可能过时的固定步数。
- 官网同步 v2.1.3 事实：新增 AI 音色设计、可配置 AI 文本模型卡片；FAQ 更新计费、系统钥匙串与
  数据边界；更新日志把 v2.1.3（2026-11-14）标为最新，v2.1.2 转为历史版本。

### 工程:发版 CI 恢复 tag 触发

- `.github/workflows/release.yml` 恢复 `push: tags: ['v*']`，tag 推送会校验 → 构建 Windows/macOS
  并创建 GitHub Release；保留 `workflow_dispatch` 手动补跑。
- 本机 `npm run tauri:build` 改为本地验证/备用，不再作为唯一发版路径。
- v2.1.3 tag 已触发 CI：Windows 10.56 MB / macOS 12.29 MB，Release 已生成。

### 新增:Linux 产物（deb amd64 + AppImage，追加进 v2.1.3 Release）

- `release.yml` 新增 `linux` job：**ubuntu-22.04 基线**构建（24.04 的 glibc 产物在 22.04 跑不起来），
  产出 deb（amd64）与 AppImage 挂到 GitHub Release；`workflow_dispatch` 增加 `job` 入参，
  支持单独跑某个平台的构建（为 v2.1.3 追加 Linux 产物即为单跑，版本号不变）。
- **keyring 补上 Linux 特性**（`sync-secret-service`，Secret Service/dbus）：此前 Linux 下静默落到
  mock 凭据库——进程内 set→get 能读回，写入后回读校验挡不住它，表现为「保存成功、重启后
  Key 丢失」。不能用 `linux-native`（keyutils 内核钥匙环，重启即丢）。运行时需要系统有
  Secret Service 实现（gnome-keyring/KWallet，主流桌面默认有；没有时保存报错，不降级明文）。
- **deb 图标注册三件套**（修复「deb 安装后图标未注册」，WSLg 实测定位）：
  1. `bundle.icon` 列全多尺寸 PNG（32/64/128/256/512）——bundler 只装列表里的 PNG 并按解码尺寸
     落 hicolor 各档，此前只装了 icon.png 一个 512 档；
  2. 自定义 desktop 模板（`src-tauri/deb/main.desktop`）写 `StartupWMClass=Yizivoice`：二进制名
     `yizivoice` 经 GTK 首字母大写后，窗口 WM_CLASS 实测为 `("yizivoice", "Yizivoice")`，默认模板的
     小写值在 Xfce/i3 等严格匹配器下会导致 dock/任务栏显示通用占位图标（GNOME/KDE 宽松匹配能兜住）；
  3. 新增 postinst（`src-tauri/deb/postinst`）刷新 icon cache / desktop database 兜底
     （Tauri 默认不生成 postinst；主流发行版由 dpkg triggers 自动刷新）。
- `bundle.category` 设为 `Music`（映射 desktop `Categories=AudioVideo;Audio`）。注意该字段是
  cargo-bundle 风格枚举，写 freedesktop 的 `AudioVideo` 会直接报 `invalid category` 构建失败。
- deb 包名为 `yizi-voice`（productName 的 kebab-case）；desktop 文件
  `/usr/share/applications/YiziVoice.desktop`；图标 `/usr/share/icons/hicolor/<N>x<N>/apps/yizivoice.png`。
- 实测链路（WSLg Ubuntu）：构建 → `dpkg -i` 安装 → 五档图标落位 → icon cache 含 yizivoice →
  `desktop-file-validate` 通过 → `xprop` 确认 WM_CLASS；Windows 侧 `cargo check` 回归通过。
- AppImage 为实验性：Tauri 默认捆绑的 GTK/Wayland 库在 Mesa 25+ 新发行版上有已知 EGL 兼容问题
  （tauri#15665/#15976），Linux 主推 deb。
- **`workflow_dispatch` 单跑某个 job 时 checkout 必须 `fetch-depth: 0`**：默认浅克隆且不拉 tags，
  `release:check` 的 `git rev-parse <tag>` 会误报「tag 不存在」。tag 推送事件下 checkout 天然带 tag，
  所以这个坑只在手动补跑时暴露。三个 job 均已显式声明。
- **Linux 录音与历史回放的修复**（2026-11-16，用户实测反馈「录音无效 / 历史记录播放无声」）：
  - **录音无效**：wry 在 WebKitGTK 上只开了 WebGL/WebAudio，既没有 `set_enable_media_stream(true)`，
    也没有连接 `permission-request` 信号——前者让 `getUserMedia` 直接 reject，后者让 WebKit 静默 deny，
    所以既没有授权弹窗也没有任何提示。新增 `src-tauri/src/linux_media.rs` 补齐两者
    （只放行 `UserMediaPermissionRequest`，其余权限 deny）；前端补 `try/catch` 与
    `describeRecorderError`，把 NotAllowed / NotFound / NotReadable 翻译成可操作提示。
    `with_webview` 需在事件循环起来后调用，故用后台线程延后投递，避免与主线程互等死锁。
  - **历史记录无声音**：WebKitGTK 的媒体加载由 GStreamer 完成，不经过 WebKit 网络层，
    自定义协议 `asset://` 因此喂不进 `<audio>`；而「刚生成的结果能播」是因为它是 `data:` URL。
    新增 Rust 命令 `history_read_audio`（读字节，安全校验与导出命令一致）→ 前端转 blob URL，
    卸载/换源时 `URL.revokeObjectURL`。Windows/macOS 仍走 asset protocol。
  - 顺带修正：录制容器原来只认 `webm`/`wav`，其它容器（如 WebKitGTK 可能给出的 ogg）
    会被当成 wav 直接发给 ASR；现在非 wav 一律先转码。
- **手动跑时 Release 上传要用推导出的 `tag_name`**：`workflow_dispatch` 的 `github.ref` 是分支名，
  `softprops/action-gh-release` 会报 `⚠️ GitHub Releases requires a tag`；三个 job 统一从
  `package.json` 推导 `v<version>`。`job` 入参支持 `all` / `windows` / `macos` / `linux` 单跑。
- v2.1.3 的 Linux 产物（deb 10.56 MB / AppImage 85.29 MB）即以此方式**版本号不变**追加进
  已发布 Release：先把修复提交并前移 tag → 取消强推顺带触发的全平台构建 → 手动 dispatch `job=linux`。

## [2.1.2] - 2026-10-13

**视觉重做 + 交互收口**：v4 视觉规范（审计 + 规范 + 实施记录）全量落地，液态玻璃上机，两个主题重做；
随后三个工作台页面各减一层控制层级，「二选一」不再靠分段控件，音色卡片补上样本波形水印。
数据格式只新增一个可选字段 `waveform`（样本读不出来时为 `null`），Rust 命令语义与 API 调用未变。

### 新增:视觉规范 v4（`DESIGN.md`）

- 一次全量审计把「字号 8 档挤在 10–16px、任意值 71 处、签名 40 种、6 项对比度不达标（明暗两主题）」
  收敛为「**5 档字号**（12/14/16/20/30）/ **3 档字重**（400/500/600，700 已全量清除）/
  **6 档图标**（12/14/16/24/30/36）/ **27 种签名上限** / **0 项不达标**」。
- `DESIGN.md` 从「审计报告」升级为「唯一视觉事实来源」：§5 逐条规范（含 §5.10 装饰色族、
  §5.11 文本输入区指针）、§9.2 实施期教训、§10.2 液态玻璃。**任何界面改动先读它**已写进 `AGENTS.md`。
- 图标档位不是审美微调：`VoiceClone` 24 / `SpeechToText` 26 / 28 三种尺寸画的是同一个「空态与拖放区
  插图」，这类同角色多尺寸即漂移。判据按「图标跟随它伴读的文字档」+「伴读多行块时按块高定」+
  「图标按钮按边长取档」三条，新增 36px 档（首页三张功能卡，全应用唯一「图标本身是主角」的位置）。

### 新增:液态玻璃（M1 面板 / M2 卡片 / M3 浮层）

- 三件事共用同一套概念，三种材质不许长出自己的配方：① 表面透在**有结构**的场景上
  ② 边由 `--glass-edge` 画（padding-box 遮罩法，`::after` 承载）③ 顶部有镜面高光（`--glass-sheen`）。
- **先造场景，再降表面**：`backdrop-filter` 在平底上是**数学空操作** —— 原先 `body` 只有一层
  `radial-gradient`，与画布只差 1–2 级，整块背底变化约 2%，这是「怎么调都不像玻璃」的根因。
  现由 `--bg-scene` 提供结构（画布 + 三个大半径径向渐变）。
- **M2 卡片永远不许有 `backdrop-filter`**：卡片永远坐在已经模糊过的面板/浮层里，自己的背底本就平滑，
  再模糊一次视觉上买不到东西，却要多付一整块 render surface（v4 写的理由是「性能红线」，那是错的）。
- **亮色卡片改淡蓝** `rgba(226,240,254,0.56)`：白卡与白面板只差亮度 —— 没有颜色就没有玻璃；
  且**两层半透明相叠时压缩是相乘的**（`(1-0.56)×(1-0.58)=18%`），不能用加法估。
  代价是卡片变暗、深色文字掉对比度，亮色三个最边缘的 token 各压深一档才过。

### 变更:指针灯跟随鼠标（取代固定路径扫光）

- 扫光是固定角度、固定路径的一条光带，和鼠标在哪无关，读起来就是「机械」。现由
  `services/glassLight.ts` 写 `--glass-x/-y`，`::before` 上的径向渐变读它。用**背景**而不是位移的
  浮层，所以永远出不了盒子、卡片不需要 `overflow: hidden`（卡片里要弹下拉与 Tooltip）。
  默认值是盒外的 `-9999px`，不是 50% —— 固定半径下居中的默认值会在鼠标还没靠近时点亮小卡片。
- **灯的色相必须服从表面的色相**：亮色 **白**（`@0.55`），暗色 **爱马仕橙**（`@0.06`）。
  这条被推翻过两次：暖白打在淡蓝卡上是色相打架；而「蓝通道封顶 ⇒ 必须把余量花光」推出 0.85 后
  被用户判为「还是有点干扰」——**花光天花板 ≠ 花光设计需要的那部分**。0.55 实测 +11/+5/+0
  （欧氏距 12）＝「若隐若现」，它付得起是因为 hover 反馈已交给阴影（−46 级）。
- **灯的半径相对元素**：`min(主题上限, max(60px, 0.7 × 短边))`。300px 死值落在首页 190×132 的卡上
  会盖满整张卡，灯就从「跟着鼠标的光斑」变成「整张卡微微变色」（四角与光心仅差 11 级）。
- **只给 M2/M3，不给 M1**：实测重绘带 `backdrop-filter` 祖先里的任何东西要 50ms/帧，
  且**与面积无关**（125×26 的浮层与 796×110 的卡片一样贵）；关掉面板的 `backdrop-filter` 成本归零。
  鼠标基本一直停在面板上，在面板上这个代价是常驻的。

### 变更:暗色主题重做

- 画布改为**中性近黑 `#0A0A0B`**，除主题色外表面与文字一律 R=G=B。
- **两个品牌色在两个主题里都在，只是主次对调**：浅色 `--accent`=克莱因蓝、`--accent-2`=爱马仕橙；
  暗色反过来。因此**实心主色上的文字一律用 `text-accent-on`，不许写 `text-white`** ——
  白字在暗色的 `#F37021` 上只有 2.97:1（v4.2 已改 4 处）。
- `--danger` 两主题统一 `#DA3733`：v4.1 的两个值都有蓝通道比绿通道高 5，在深色画布上读作「玫红」，
  且都撑不住白字（3.91 / 3.05:1）；`#DA3733` 白字 4.59:1，两主题都合法。
- 三种「输入框旁一颗绿圆勾」改用主题色并统一 24px：绿色在那个位置不表达任何状态，只是装饰，
  何况也真的不达标（暗色白勾 2.47:1）。

### 新增:文本输入区的主题色指针（`DESIGN.md` §5.11）

- 浏览器自带的 I 形光标是 1px 细线，在这个界面上「经常看不见」。现为**主题色圆角竖条**：
  3×20（rx 1.5）+ 1px 描边、画布 9×24、屏幕约 **4×21px**、热点 `4 12`。填色 = 该主题的 `--accent`；
  描边**照着文字而不是照着底**选（浅色主题深色字 ⇒ 白描边；暗色主题浅色字 ⇒ 画布黑描边）。
- 必须用 SVG：指针图片按 CSS px 给尺寸再由 DPI 缩放，PNG 在 125%/150% 的笔记本上必然发虚；
  且 Chromium 的指针图片上限是 128×128，**超过会被静默忽略**（只会看到原生指针，没有任何报错）。
- 这份取值必须写两遍且只许颜色不同（data URI 不能插值 `var()`），是本仓库**唯一一处必须复制**的
  设计取值，由 `design:check` 盯着两边一致性（抹掉颜色后逐字比较，并断言填色等于该主题 `--accent`）。
- 文本输入区**不能有指针灯**，而且只能靠「位置」排除、不能靠透明度：灯最亮处正落在光标处，
  实测此时 `::before` 的 `opacity` 仍是 1（卡片确实还是 hover 态）。实现在 `glassLight.ts` 的
  `TEXT_ENTRY`，判据是「浏览器在这里给不给 I 形光标」。

### 修复:首页卡片「两层边线」

- 现象：首页三张功能卡看起来有**两条**边线。根因不在取值，在**描边画在哪一像素上**：
  绝对定位元素的 `inset` 相对包含块的 **padding box** 解析，而三种材质都带
  `border: 1px solid transparent`，于是描边浮在真边缘内 1px；同时表面底色按默认
  `background-clip: border-box` **涂满那圈透明边框** —— 元素「看起来」到边框盒为止、描边却在里面。
  实测剖面（两主题、四条边一致）：`阴影 → 1px 纯表面色 → 1px 描边 → 表面色`；125% 缩放下那条带
  约 1.25 设备像素，就读成两条线。
- 修法：共享 `::after` 改用 `inset: -1px`，把描边本身推进那圈透明边框里。**26 个材质矩形实测零位移**。
- 两条「看起来更聪明」的绕法都试过并留档：去掉边框（位置对了但内容盒各长 2px，16/26 个材质位移，
  且沿页面累积到 4px）；`background-clip: padding-box`（那条带露出元素**背后**的东西，比外侧阴影
  还亮，还是两层）；`border-image` 无视 `border-radius`（实测圆角矩形角上照样实心红）。
- 附带新增 `.mat-clip`（`overflow: clip` + `overflow-clip-margin: 1px`）：`overflow: hidden` 在后代的
  padding box 处裁，会把描边**整条**吃掉。7 处已改（6 个面板 + 文生音那张卡片）。必须滚动的
  `AudioTagMenu` 卡片是结构性例外（`overflow-clip-margin` 只对 `clip` 生效），它按设计只有阴影边。

### 变更:首页与历史列表

- **欢迎页词汇轮播**：主文案在 7 个词间轮播，每个词一套独立装饰色 `--hero-1..7`（**不借语义色**）。
  取值按「常态 / `--surface-hover` / `--surface-active` / `--accent-soft` 四种底里最差的那个」求解，
  且七个值落在**同一对比度带**内。排列顺序按**相邻 CIE Lab ΔE 最大化**穷举 720 个排列（最差相邻
  ΔE 30.0 → 88.8）—— 按色相降序排会让蓝→青→绿连成渐变，首尾「模仿→创造」只差 30.0。
  位移量必须按格高显式相乘 `translateY(calc(var(--reel-item-h) * -N))`：`translateY(%)` 相对**轨道
  自身高度**解析，`-100%` 会把整列甩出屏幕 8 格。
- 三张功能卡：hover 从 `-translate-y-0.5` 改为**只用阴影**（抬升是阴影的概念；transform 经过小数
  偏移会让文字每帧重新栅格化，卡片像和内容脱开），`transition-all` 收窄到只留 `box-shadow`。
  卡片行 `overflow-x-auto` 会把纵向一起裁掉（`overflow-x` 非 visible 时 `overflow-y: visible` 计算成
  `auto`），实测切掉了 `hover:shadow-lg`；修法是给滚动容器留够内边距再用等量负外边距拉回来
  （`px-16 pt-10 pb-24` 配 `-mx-16 -mt-10 -mb-24`），并同时检查「页面没多出横向滚动条」与「两者严格配平」。
- 历史条目 5 个操作统一改为**默认 hover 才显示**（进行中的整行保持可见），每个都有 `Tooltip` 文案，
  且**一个图标只承担一个功能**（播放与「还原任务」曾共用 `AudioLines`，而它同时还是「文生音」徽标）。
- 设置中心从弹窗改为**整页视图**（设置 / 教程 / 关于三个页签）。

### 工程

- `npm run design:check` 从「查任意值」扩为静态门禁：任意值字号/圆角、字重 700、非 token 文字色、
  图标档位、无文案的图标按钮、装饰色族对比度与配色数、材质边框与描边 `inset` 的**配对**、`.mat-clip`
  的声明。它只能查静态可判定项，渲染结果必须在生产构建上实测（`DESIGN.md` §9.2）。
- `DESIGN.md` §9.2 收录实施期教训（本轮从 17 条增到 21 条），其中三条是方法论级的：
  **验证代码自己有「这条路径根本不存在」的失败模式**、**`getComputedStyle` 说「应用了」不等于
  「画出来了」**、**验收判据要复述物理事实而不是你猜的形状，且必须有反向对照**。
- `.review/`（本地视觉验收截图）加入 `.gitignore` —— 不是构建输入。

### 新增:音色样本波形水印

- `voices_load_list` 返回的音色带上 `waveform` —— **样本**（`audioBase64`）的峰值包络（34 根，0~1），由
  Rust 在保存时算出。旧记录没有这个字段，`voices_load_list` 会在加载时**回填一次**并写回 `list.json`
  （样本读不出来则写 `null`，避免每次加载都重算）：所以老版本的音色卡片也会自动有水印，无需重新导入。
  消费端按「可能缺失」处理，读不出来就只是不画装饰 —— 它绝不能让保存失败。
- 水印画在音色卡片名称与日期**下面**，所以强度不是审美旋钮：上限由 12px 日期的对比度决定，两个主题为
  同一个数字付的代价不同，实测浅色 5% / 暗色 10%（日期保持 5.20:1）。见 `DESIGN.md` §5.13。
- 附两条单测：安静的一半保持安静、读不出来的输入直接拒绝。

### 变更:文生音——先问「写到哪里」，再问「怎么写」

- 控制方式从「两层四种」合并为**三种互斥方式**：标签方式 / 自由描述 / 导演演绎，一排三选一 + 一句随
  选择变化的说明；方式内部不再有第二级选择。
- 开场标签与内嵌标签是**写进朗读文本的插入工具**，与「怎么写」不同目的地，因此只在标签方式下出现
  （文字卡工具栏里）——一个触发器必须和它写的东西在同一张卡里。见 `DESIGN.md` §5.15。
- 示例 chip 不再无声覆盖正文：正文为空才填入，已有内容则保留并提示；风格描述两种情况下都写入。
- 标签 chip 从 `<span onClick>` 改为真 `<button>`（Tab 可达、Enter/Space 可插），删除角标是它的兄弟按钮。
- 一致性收口：三处「清空」统一 24×24 + 12px 图标；字数一律在文本域右下角（文字中心距底边 13px）；
  三个多行文本域一律 `placeholder:text-xs`；同一音色库里两个音色的试听播放态统一为 `accent-strong`。
- 「当前音色」pill 从「看着能选、其实只展开侧栏」改成纯状态（不可点）。

### 变更:采集入口不再二选一（音色克隆 / 音转文）

- 「录音 / 上传文件」原先是一组分段控件 + 两个互斥分支，拖放区只在其中一个分支里存在。现改为**同一个
  投递面**上两个并列的 64px 圆钮：拖文件进这块就是上传、点圆钮就是录音，各自付什么代价写在各自下面；
  录音中换「停止」字形。取值抽到 `components/ui/entryDisc.ts` 两页共用，避免以后各改一半。见 `DESIGN.md` §5.14。
- 音转文顺带修正一处语义错位：原先的 `inputMode` 既当界面模式、又被历史记录当「音频来源」用（决定
  `sourceType` 与是否落盘 WAV），现改为真正的 `source`，在两处入口赋值，落盘规则不变。

### 变更:其余收口

- 历史记录条目的行内操作补上键盘可达（`group-has-[:focus-visible]`；不用 `focus-within`——鼠标点过的按钮
  会长期持有焦点，整排就再也不收起）。
- 下拉菜单支持无文字触发器：图标按钮按边长取 12px 图标、无文字时不画 chevron（它只是在重复说「这里能
  展开」）、`tooltip` 兼作 aria-label、贴近视口底部时改为向上展开。
- 音色卡片与左栏两处 kebab 触发器统一几何。

## [2.1.1] - 2026-09-21

### 修复:从其它页面第一次点历史记录不生效

- 现象：在音转文等页面点历史记录，界面切到文生音但参数没还原，toast 却提示「已还原」；再点一次才正常。
- 根因：`TextToSpeech` 的「清空」effect 依赖 `[resetSignal]`，而 **effect 在挂载时也会执行一遍**，且按声明顺序排在「还原」effect 之后——还原刚写入的文本/模式/草稿被立即清空。第二次点击时页面已挂载、`resetSignal` 未变，清空 effect 不再重跑，于是表现为「第二次才生效」。
- 修复：三个页面（`TextToSpeech` / `SpeechToText` / `VoiceClone`）的清空 effect 都加「上次处理过的信号值」变化门；并把成功 toast 移到还原真正完成之后，避免再出现「提示说成功了其实没成功」。
- 注意：**不能用「是否首次执行」布尔量**——StrictMode 下挂载期 effect 会执行两次，布尔量第二次就失效。已用最小复现验证：旧写法 `(empty)`、布尔量写法 `(empty)`、信号值比较 `RESTORED`。
- 附带修复「第一次加载会弹两条提示」：`App` 向页面传递待载入记录的方式由「state 承载 + `consumeTtsEntry()` 取走并置 null」改为「`ttsLoadSignal` 触发 + `takeTtsEntry()` 取走即清」。原写法在 StrictMode 挂载期 effect 跑两次时，回调会被调用两次且**两次都返回同一条记录**，于是还原执行两遍。改为 ref 承载后结构性幂等，实测 2 次 → 1 次。

### 新增:音转文记录音频落盘

- 音转文的「录音」来源现在会把音频存到 `History/asr/`，因此历史列表里的音转文记录也能播放与下载（此前 ASR 完全不落音频，只有文本）。
- 上传来源刻意不落盘：原文件在用户手里，且这里存的是转码后的 WAV，再存一份会让数据目录无谓膨胀。`AsrHistoryEntry.audioFileName` 为可选字段，据此决定是否显示播放/下载按钮。
- Rust 侧去掉音频路径对 `tts/` 的硬编码：新增 `history::audio_path_for()` 统一按记录类型推导子目录，`history_save_entry` / `history_delete_entry` / `history_get_audio_path` / `history_clear_all` / `export_history_audio` 全部改用它。

### 新增:清理孤儿音频

- 历史菜单新增「清理孤儿音频」：删除 `History/` 下已不对应任何记录的 wav（删除记录时未清掉的残留）。
- **安全设计**：先 dry-run 拿到数量、弹确认再真删；Rust 侧用严格解析读索引，**解析失败或结构异常时直接拒绝执行**——`util::read_json` 在解析失败时返回默认空索引，若直接使用会把「索引读不出来」当成「没有任何记录」而删光全部音频。附 4 个单元测试。

### 工程:版本号去硬编码

- 版本号改为构建时由 `vite.config.ts` 从 `package.json` 注入 `__APP_VERSION__`，关于弹窗不再硬编码，需同步的位置从 5 处降为 3 处。
- 刻意不用 Tauri 的 `getVersion()`：那需要额外的 `core:app:allow-version` capability，又多一个「只在打包态暴露」的改动面。
- `release:check` 同步更新：校验三处一致，并新增断言防止版本号被改回硬编码。

### 新增:文生音历史记录完整状态还原

- 点击左栏历史中的文生音记录，完整还原生成时的编辑器状态：一级模式（音频标签控制 / 自然语言控制）、自然语言子模式（一段话描述 / 导演演绎）与明细字段、风格 chip、朗读文本、以及当时展开的控制面板。
- `TtsHistoryEntry` 新增可选字段承载界面状态（`ttsMode` / `nlMode` / `nlParagraph` / `nlRole` / `nlScene` / `nlDirection` / `openPanel`）。**既有 `style` 字段语义不变**——它是真正发给 API 的 userPrompt、决定音频内容，不能拿来承载界面状态。
- 旧记录（≤v2.0.4）没有这些字段，由 `legacyNaturalState()` 从 `style` 推断；历史上导演模式存在 `角色：` 与 `【角色】` 两种前缀写法，均已兼容。用真实历史 66 条文生音记录验证分类：tags 29 / director 21 / paragraph 2 / 空值回落 tags 14。
- 同时把当时的音频**替换**回工作台结果区。此前只还原输入态，会出现「文本/模式已换成历史的、结果还留着旧的」错配。
- 还原结果的 `src` 是 asset URL，而 asset 不在 CSP `connect-src` 内、前端 fetch 会被拦，因此 `AudioPlayer` 新增 `historyId` 属性：传了它就按记录 id 走 Rust 读盘下载，否则回落到 data URL 路径（新生成的结果不受影响）。

### 新增:历史记录音频下载

- 左侧栏历史列表的文生音条目新增下载按钮，弹出系统「另存为」。
- 新增 Rust 命令 `export_history_audio`：**入参是记录 id 而非文件路径**——路径在 Rust 侧解析并 canonicalize 校验仍落在 `History/tts/` 内，避免把「任意文件读取」能力暴露给前端；用 `fs::copy` 直接落盘，不经 base64 往返。附 3 个单元测试覆盖 id 与文件名的净化逻辑（`cargo test`）。
- 历史音频走 asset protocol，而 `asset:` 不在 CSP `connect-src` 内，前端 fetch 会被拦——因此下载必须走 Rust 读盘，不能复用前端取数路径。

### 工程:Electron 旧线与 Capacitor 移动端线彻底移除

- 删除 `electron/`、`dist_electron/`（311MB 构建产物）、`android/`（Capacitor 工程）、`build/`、`capacitor.config.json`、`.npmrc`、`打包桌面版.bat`、`ANDROID.md`、`src/App.mobile.tsx`、`src/AppContext.tsx`。
- `package.json` 移除 `main`、electron-builder 配置块、6 个脚本、8 个 devDependencies 与 5 个 `@capacitor/*` 依赖。
- 前端桥由 `window.electronAPI` 改名为 `window.desktopAPI`；`getElectronAPI()` → `getBridge()`；删除无调用方的 `isElectron()` / `isTauri()` / `shouldInstallTauriBridge()`；`detectRuntime()` 收窄为 `tauri | browser`。
- **接口地址锁死**为 `MIMO_BASE_URL`（仅支持小米 MiMo 服务），设置页不再允许自定义——自定义域名会在打包态被 CSP 拦掉，而 dev 正常，属同一类陷阱。
- `src-tauri/src/paths.rs` 中继承 Electron 时代 `%APPDATA%/YiziVoice/data-location.json` 的逻辑**刻意保留**，否则老用户数据目录会失联。
- 全部文档同步（`AGENTS.md` / `HEARTBEAT.md` / `README.md` / `MEMORY.md` / `SOUL.md` / `项目.md`），并修复 `MEMORY.md` 中 2 处控制字符损坏。

### 工程:发版与校验基建

- `.github/workflows/release.yml`：tag 触发校验 → 构建 → 自动创建 GitHub Release（Windows NSIS + macOS universal dmg），使发布产物可追溯到确定的源码。
- `.github/workflows/ci.yml`：push/PR 跑类型检查 + CSP 校验 + 前端构建 + `cargo test`。
- `npm run release:check`：版本号五处一致 + 工作区干净 + HEAD 必须就是该 tag。
- `npm run csp:check`：CSP 白名单与代码一致性，含「接口地址锁死」回归门。
- `secrets::set` 增加写入后回读校验，避免凭据库静默 mock 时先抹掉明文再丢 Key。

### 修复:打包版点击「下载」音频无反应

- 打包版(NSIS 安装版)生成语音后点下载按钮无任何反应,而开发模式正常。根因是 CSP:下载走 `fetch(url)` 取音频,而 `connect-src` 未放行 `data:/blob:`,打包态 fetch 被拦;rejection 又被 `void downloadUrl(...)` 吞掉,于是既无报错也无弹窗。桌面 `tauri dev` 下 webview 直连 `devUrl`、不注入 CSP,所以该问题只在装包后暴露(v2.0.2 起一直存在)。
- `downloadUrl` 改为直接从 `data:` URL 切出 base64 段交 Rust `export_binary_file`,不再 `fetch`;入参非 `data:` 形式时 `console.warn` 并返回 false,不再静默。
- 录音回显(音转文 / 克隆音色)由 `URL.createObjectURL(blob)` 改为 `data:audio/wav;base64,${wavBase64}`,顺带消除每次渲染新建 objectURL 的泄漏。
- `tauri.conf.json` 的 `connect-src` 补 `data: blob:`(外部域名仍被拦)。

## [2.0.4] - 2026-09-07

### 克隆音色:分类快速定位

- 右侧「分类管理」每个分类项支持点击,中间「我的音色库」平滑滚动定位到对应分类分组;整行可点(含键盘 Enter/空格),重命名/删除操作互不干扰。

### 关于弹窗:产品入口图标

- 「我们的其他产品」中 YiziMarkdown 与荔书的入口行新增品牌图标(36×36 圆角,`public/yizimarkdown.png` / `public/lishu.png`),与「官方网站」入口排版对齐。

### 工程

- 应用图标全套焕新:以新 logo 源图(`new-logo.png`,1024×1024)重新生成 Tauri 全套图标(ico/icns/多尺寸 png/Windows Store Square*Logo/android/ios),并同步旧线 Electron 打包图标(`build/`)、界面内 logo(`public/icon.png`)。

### 文生音:页面布局重构(小屏友好)

- 顶部控制区(模式切换/风格/标签/自然语言面板)从固定 `shrink-0` 块移入统一滚动区,与小屏/未全屏窗口下不再挤压生成结果区——控件展开后可随滚动查看,结果列表始终可见。
- 中央编辑台重组为「语音设置卡 + 朗读文本卡 + 结果列表」三层卡片结构:
  - **朗读文本卡**新增「朗读文本」标题与说明文字,右上角提供一键清空按钮(有内容时显示),新用户不再困惑文本框用途。
  - 生成结果列表并入主滚动区,生成后自动滚到最新一条。

### 文生音:风格控制表单增强

- 「新增自定义风格」表单带标题,保存/取消按钮在表单右下角;隐藏了原「选中风格后微调」文本框。
- 每个自定义风格 chip 悬停显示**修改 / 删除**两个按钮;点「修改」自动载入已有标签名与描述供编辑,标题切换为「修改自定义风格」。
- chip 默认不再为悬停按钮预留空白,悬停时才让位展开,视觉更干净。

### 自然语言控制:输入引导

- 「一段话描述」与「导演演绎」文本框的占位文案升级为「引导问句 + 示例 + AI 提示」的多行指引,并提示可只填核心关键字后点「AI 生成风格描述」;导演模式占位为两行,占位字号调小以突出示例。

### 界面:三栏布局与导航优化

- **左/中/右三栏顶部对齐**:移除中央顶部工具条,左栏收起按钮与「新建生成」同行,右栏收起按钮与栏头标题同行。
- **左栏收起态**:改为纵向 icon 导航(展开/克隆音色/文生音/音转文/设置/教程/关于),不放其他内容;克隆音色图标更换为 `ScanFace`。
- **右栏收起态**:完全隐藏(不再保留窄条),展开按钮移至主卡片右上角(仅收起时显示)。
- 三个右栏栏头统一为 H3 样式(名称/字号/顶部间距一致,与主面板标题对齐)。
- 四个主入口(新建生成/克隆音色/文生音/音转文)icon 与文案统一为 16px。
- 侧栏收折快捷键由 `Ctrl+B/J` 调整为 `Ctrl+L/R`,hover 文案随状态显示「收起/展开」。

### 工程

- 版本号同步升至 `2.0.4`(`package.json` / `tauri.conf.json` / `Cargo.toml` / 关于对话框)。
- `vite.config.ts` 新增 `server.watch.ignored: ['**/src-tauri/**']`,修复 Windows 下 Vite 监听 Rust 编译产物(dll/exe)抛 `EBUSY` 导致 `tauri:dev` 崩溃的问题。

## [2.0.3] - 2026-09-01

### 文生音:自然语言控制

- **一级模式切换**:顶部新增 `Segmented`「音频标签控制 / 自然语言控制」。音频标签控制保留原有 3 个 trigger + 3 个 panel,零回归;自然语言控制提供全新的自由填写面板。
- **二级模式**(自然语言控制下):
  - 「一段话描述」:单 Textarea,适合用一段话描述风格、语速、情绪、年龄等。
  - 「导演演绎」:角色 / 场景 / 指导 三个 Textarea,贴合 MiMo-V2.5-TTS 官方「导演模式」API。
- **AI 生成风格描述**:按钮(右下角,Wand2 图标)接 MiMo-V2.5 文本大模型,使用结构化输出(JSON 模式) + 显式关闭深度思考(`extra_body.thinking.type=disabled`)以降低延迟。用户输入关键字(如「考试少年」「公关总监」),模型参照内置示例的语体、约束风格生成详细风格指令,自动回填到对应文本框;只生成风格指令,不会触碰播报文本。
- **示例 chips**:保留原有「考试少年 / 公关总监 / 骄傲明星」一键填完整示例的入口,作为零成本上手参考。
- **互斥语义**:任一请求只发一条 user-content——自然语言模式下不再发送 chip 选中的 style;反之亦然。

### 克隆音色:分类重命名

- 右侧「分类管理」每个非「未分类」项新增编辑按钮(铅笔图标),可内联重命名分类;后端同步更新 `categories` 数组与所有引用该分类的 voice profile 文件。冲突重名会被拒绝并提示。

### 文生音:风格控制新增自定义风格入口

- 「风格控制」面板风格 chip 列表末尾新增 `+` 按钮,沿用 `AudioTagMenu` 视觉,点击展开「标签名 / 风格描述」添加表单。

### 工程

- 版本号同步从 `2.0.2` 升至 `2.0.3`(`package.json` / `tauri.conf.json` / `Cargo.toml` / 关于对话框)。
- Tauri 端新增 `voices_rename_category` 命令;Electron 端配套 `voices:rename-category` IPC。
- `mimoApi.ts` 新增 `textGenerate` 包装,使用 MiMo-V2.5 文本模型 + json_object 结构化输出。

## [2.0.2] - 2026-08-25

### 重大更新:全新界面「精致玻璃 Pro」

界面整体重设计(设计规范见 `DESIGN.md`),从"网页感"升级为桌面创作软件:

**三栏工作台布局**(对齐主流 AI 客户端心智)

- 左侧栏:「新建生成」+ 功能菜单(克隆音色 / 文生音 / 音转文)+ **常驻历史记录**(搜索、类型筛选、回放、一键加载到编辑器)
- 欢迎页:启动即达,居中欢迎语 + 三个功能入口卡片
- 右侧配置面板:随工具切换——音色库(搜索/分组/试听)、转写设置、分类管理

**设计体系**

- **亮 / 暗双主题**:TitleBar 一键切换,设置持久化;暗色下品牌蓝自动提亮保证对比度
- 三级玻璃材质(面板/卡片/弹层)+ 四档阴影 + 11–24 字阶 + 4px 网格,全部 Token 化
- **lucide 线性图标**全面替换 emoji;自绘波形播放器、下拉菜单、确认弹窗替代原生控件
- 全套快捷键:`Ctrl+1/2/3` 切换工具、`Ctrl+B/J` 折叠左右栏、`Ctrl+F` 搜索历史、`Ctrl+,` 设置、`Esc` 关层

**功能修复与增强**

- 修复:保存 API Key 后所有功能不可用(界面重构遗漏客户端初始化;现启动时自动从凭据库装配,自愈)
- 修复:标签/分类选中态透明不可见(Tailwind 色键名错配,全应用统一选中样式)
- 修复:弹窗从右下角跳入(入场动画与居中 transform 冲突)
- 克隆音色卡片重设计:两行结构、分组顺序稳定(移动角色不再导致分组前移)、预览数据源与文生音统一
- 保存音色弹窗支持**内联新增分类**并自动选中
- 文生音工具条三联动:风格控制 / 开场标签 / 内嵌标签点击展开;工具条实时显示当前音色
- 全局字体与对比度优化,长按钮统一为标准尺寸

### Release 后补充修复(已同步进安装包)

- 修复:「导出全部」与音频下载静默失效——WebView2 不响应 `<a download>` 锚点下载,现统一改走系统"另存为"对话框 + 原生写盘
- 恢复:设置与操作教程中的 MiMo 注册链接、邀请码 DHLC96 高亮与复制(界面重构时遗漏,从 v1.x 原样移植)
- 官网:导航与页脚 logo 替换为品牌 logo.svg

**升级说明**:数据目录与凭据库密钥自动继承,无破坏性变更;界面布局变化不影响任何历史数据。Release 安装包已覆盖更新,包含本条目全部内容(2026-08-25)。

### macOS 适配(2026-08-26)

首次在 Intel Mac 上完成 Universal 双架构(x86_64 + arm64)打包,一个 DMG 同时原生支持 Intel 与 Apple Silicon 两种芯片:

- 修复:Tauri 下按住标题栏无法拖动窗口(补齐 `data-tauri-drag-region` 属性;Windows Tauri 同步受益,Electron 旧线不受影响)
- 调整:macOS 上「最大化」按钮改为进入**原生全屏**(对齐系统习惯);Windows/Linux 维持放大/还原不变
- 修复:设置/教程/关于弹窗右上角关闭按钮在入场动画结束后跳到窗口角落(定位上下文缺失,全平台问题)
- 「关于」弹窗改版:顶部居中品牌 logo + 版本号;新增「官方网站」入口(voice.yizigpt.com,新窗口打开);底部文案更新为「为冰冷的文字，赋予有温度的声音」
- 修复打包资源压平:`default-config` 改为按子目录映射进安装包,避免预置音色/风格在全新安装时丢失(Windows NSIS 打包建议下次一并核验)

产物:`YiziVoice_2.0.2_universal.dmg`(约 12MB)。未签名分发,首次打开需右键 → 打开,或 `xattr -cr /Applications/YiziVoice.app`。

## [2.0.1] - 2026-08-25

### 重大变更：桌面框架迁移 Electron → Tauri 2（Rust）

v1.x 全系列基于 Electron 33,固有携带完整 Chromium 运行时（约 207MB,占安装内容 94%）。v2.0.1 切换到 Tauri 2 + 系统 WebView2,前端 React 代码**零改动**（通过 `tauriShim.ts` 兼容垫片伪装原有 `window.electronAPI` 接口）,原 765 行 Electron 主进程逻辑由 Rust 重写为七组共 29 条命令（配置/音色/风格/音频标签/历史/设置/数据目录）,数据目录与 Electron 版完全互通（同一 `文档/YiziVoice/`）。

#### 性能实测对比

| 指标 | Electron（v1.0.5） | Tauri 2（v2.0.1） | 变化 |
|------|------------------|------------------|------|
| 安装包（NSIS） | 78.23 MB | **10.21 MB** | **−87%** |
| 安装后占用 | 233 MB | **16.38 MB**（exe 3.64 + 预置资源 12.74） | **−93%** |
| 启动到窗口出现 | 2–3 秒（Chromium 初始化） | **441 ms**（冷盘首启）/ 81–95 ms（常态） | **−80% 以上** |
| 空闲内存 | 约 180–260 MB | 预计 −35%~50%（WebView2 与系统共享） | 待长期实测 |

体积构成变化：不再捆绑任何浏览器内核,WebView2 复用系统组件（Win10 1803+/Win11 出厂自带）;安装器内置 bootstrapper 为缺失环境兜底（仅 +约 2MB）。

#### 附带技术升级

- **消除 `webSecurity: false` hack**：v1.x 为播放本地历史音频关闭了 WebView 安全策略；现改用 Tauri asset protocol（`convertFileSrc`）按目录授权访问
- **CSP 内容安全策略白名单**：网络出口仅放行 MiMo API 域名,能力（capabilities）最小权限模型
- **exe 编译期内嵌图标与版本信息**：修复 v1.x 因 `signAndEditExecutable: false` 导致安装后 exe 显示默认图标的问题（rcedit 补丁流程随之废弃）
- **双轨并行**：`electron:*` 构建脚本全部保留可用,验证稳定后再移除（P5 阶段）

### 安全增强：API Key 迁入 Windows 凭据管理器

v1.x 的 API Key 以**明文**存于 settings.json（更早版本在浏览器 localStorage）。v2.0.1 起：

- Key 存储于 **Windows 凭据管理器**（DPAPI 加密,按用户 + 本机绑定）,拷贝文件到他机/其他账户无法解出
- `settings.json` 不再落明文 Key（该字段恒为空串）
- 老版本存量 Key 首次启动**自动迁移**入凭据库并抹除文件明文；早期 localStorage 数据经两级接力同样自动处理（极老旧版本直接升级则需重输一次）
- 凭据库不可用（组策略限制等罕见场景）时自动降级回文件持久化,保证应用始终可用（**该兜底已于 v2.1.3 删除**：现在报错并保留输入草稿，不再写明文）
- 凭据条目名:`mimo-api-key.YiziVoice`

### 修复

- **音转文误报「请先在设置中配置 API Key」**（历史遗留 bug）：ASR 页读取了从未被写入的 localStorage 旧存储源,而设置页保存的是文件/凭据库——现已统一取值路径
- Tauri 下标题栏最小化/最大化/关闭按钮不渲染（模块顶层求值早于接口注入的时序问题）

### 升级须知

- 从 v1.x 升级：数据与 Key 全自动继承,无需手动操作
- 双轨期内若混用两个版本：在 Tauri 版保存过 Key 后,Electron 版需重新输入一次（P5 移除 Electron 后此现象消失）

### 待办（后续版本）

- Android 线从 Capacitor 迁移至 Tauri 2（`tauri:android:*` 脚本已就绪）
- Electron / Capacitor 代码与依赖清理删除
- 应用图标源图升级至 ≥1024×1024 并重新生成全套

## [1.0.5] - 2026-08-05

### 功能优化

- **音色克隆页重构**：
  - 移除「3. 使用克隆音色生成语音」步骤——与「文生音」功能重复，克隆页只负责复刻与管理音色角色，语音生成统一在「文生音」中完成
  - 标题调整：「1. 获取音色样本」→「提交音色样本」、「2. 选择音色角色」→「已克隆角色」
  - **新增分类管理**：「已克隆角色」支持新增分类、删除分类（分类下角色自动移至「未分类」）、以及通过下拉框修改角色所属分类
  - 保存角色弹窗的分类选项改为读取动态分类列表（替代原硬编码常量）

### 修复

- **历史记录音色名称**：文生音记录中 `voiceName` 现在记录并显示所选音色的昵称，而非音色编号。克隆音色会去掉 `clone_` 前缀匹配真实角色名

### 数据层 / 底层

- 音色配置 `VoiceList` 新增 `categories` 字段，用于持久化分类列表
- 新增 IPC：`voices:load-categories`、`voices:save-categories`、`voices:update-category`（修改单个角色分类）、`voices:reassign-category`（批量迁移分类下角色）
- 修改角色分类时同步写入角色 profile 文件，保证元数据一致

### 官网

- **新增单页静态官网** `website/index.html`（自包含，单个 HTML 文件即可部署）：
  - 品牌配色：克莱因蓝 #002FA7 + 爱马仕橙 #F37021 + 婴儿蓝 #E8F4FD
  - 纯代码动画：hero 波形动画、滚动揭示、毛玻璃液态玻璃卡片
  - 响应式：桌面 / 平板 / 移动端自适应
  - 下载：网盘
  - 定位更新为「面向内容创作者的一站式 AI 语音工具」

## [1.0.4]

- 历史记录功能完善：删除确认弹窗、音频文件同步清理、打开文件夹
- 数据目录自定义与迁移功能
- 音色克隆页新增导入导出
- 打包优化与图标补丁流程
