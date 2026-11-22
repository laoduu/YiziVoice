# 开发指南（Development）

> 本文写给贡献者：开发环境、目录说明、门禁脚本。架构见 [architecture.md](architecture.md)，
> 发版见 [releasing.md](releasing.md)。英文摘要见 README.en.md 的 Build from Source。

## 前置条件

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | 18+ | 前端构建 |
| Rust | stable | [rustup](https://rustup.rs) |
| Visual Studio Build Tools | — | **Windows only**：勾选「使用 C++ 的桌面开发」 |
| WebKitGTK 4.1 等 | — | **Linux only**：`libwebkit2gtk-4.1-dev libdbus-1-dev libfuse2`（打包另见 [releasing.md](releasing.md)） |
| Xcode CLT | — | **macOS only** |

## 启动

```bash
npm install
npm run tauri:dev     # 开发模式：Vite(5173) + Rust 热编译
```

浏览器纯前端调试可用 `npm run dev`（无桌面桥，配置/历史等能力不可用）。

## 目录结构

```
YiziVoice/
├── src/                      # React 前端
│   ├── pages/                # 三个工作台页面（TTS / 克隆 / 音转文）
│   ├── components/           # 布局、ui/ 基础组件、hub/ 设置中心
│   └── services/             # API / 配置 / 历史 / 主题 / 桌面桥
├── src-tauri/                # Tauri 2 Rust 壳
│   ├── src/cmds/             # 36 条命令（config/voices/styles/audio_tags/
│   │                         #   history/settings/storage/export）
│   ├── src/secrets.rs        # API Key 系统凭据库存取
│   └── tauri.conf.json       # 窗口 / CSP / 打包配置
├── docs/                     # 本文档目录
├── default-config/           # 出厂预置配置（随安装包分发）
├── scripts/                  # 门禁脚本（见下）
├── website/                  # 官网单页
└── .github/workflows/        # ci.yml / release.yml
```

## 门禁脚本（提交前必跑）

```bash
npx tsc --noEmit                    # TypeScript 类型
npm run csp:check                   # CSP 白名单与代码一致性
npm run design:check                # 视觉规范静态门禁
cargo test --manifest-path src-tauri/Cargo.toml
```

| 脚本 | 守住什么 |
|------|---------|
| `csp:check` | `tauri.conf.json` 的 CSP 与代码中的网络/资源来源一致；接口锁死回归 |
| `design:check` | 字号/圆角/字重/文字色/图标档位/图标按钮文案等静态项（见 [design-system.md](design-system.md)） |
| `release:check` | 版本号三处一致、工作区干净、HEAD == tag（发版用） |

## 关键红线

1. **CSP 只在打包态生效** —— `tauri dev` 不注入 CSP。涉及下载、资源加载、网络调用的改动必须 `npm run tauri:build` 装包复验。详见 [pitfalls.md](pitfalls.md)。
2. **改 `tailwind.config.js` 必须进程级重启 dev server** —— Vite 的 `server.restart()` 不会让 Tailwind 重建工具类。
3. **禁在模块顶层读取 `window.desktopAPI`** —— 桥在 boot 阶段注入，必须在组件渲染时读取。
4. **密钥只经 `src-tauri/src/secrets.rs`** —— 任何文件不落明文。
5. **文档不写死版本号** —— `release:check` 扫描；界面版本用 `__APP_VERSION__`。

## 开发环境清理（可删与恢复）

| 目录 | 大小 | 删除影响 | 恢复 |
|------|------|---------|------|
| `node_modules/` | ~600MB | 依赖丢失 | `npm install` |
| `src-tauri/target/` | 1–2GB | Rust 编译缓存 | 重新 `tauri:dev` / `tauri:build` |
| `dist/` | <1MB | 前端构建产物 | `npm run build` |

换电脑时只需克隆仓库 + `npm install`，配置与历史数据在系统 `文档/YiziVoice/`（可在设置中重定向），与源码分离。

## 测试

- Rust 单测 13 项（`src-tauri/src/cmds/` 下的纯函数测试）
- 前端暂无自动化测试；UI 改动请人工过一遍主路径 + 装包冒烟（见 [releasing.md](releasing.md)）
