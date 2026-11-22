# 贡献指南

感谢你对 YiziVoice 的兴趣！本项目是一个 Tauri 2 + React 的桌面应用，欢迎 Issue 与 Pull Request。

> English: [CONTRIBUTING.en.md](./CONTRIBUTING.en.md)

## 开始之前

1. 搜索 [Issues](https://github.com/laoduu/YiziVoice/issues) 确认没有重复
2. 大改动请先开 Issue 讨论方案，避免白做
3. 安全问题请走 [SECURITY.md](./SECURITY.md) 私下报告，不要开公开 Issue

## 开发环境

```bash
git clone https://github.com/laoduu/YiziVoice.git
cd YiziVoice
npm install
npm run tauri:dev
```

前置依赖与三平台说明见 [docs/development.md](./docs/development.md)。

## 提交前门禁（必跑）

```bash
npx tsc --noEmit        # TypeScript 类型检查
npm run csp:check       # CSP 白名单与代码一致性
npm run design:check    # 视觉规范静态门禁
cargo test --manifest-path src-tauri/Cargo.toml
```

四项全绿才可提交 PR。CI（`.github/workflows/ci.yml`）会再跑一遍同样的门禁。

## 关键约定

### ⚠️ CSP 只在打包态生效

桌面 `tauri dev` 下 webview 直连 dev server，**不注入 CSP 响应头**。涉及下载、资源加载、网络调用的改动，`tauri dev` 通过**不构成证据**，必须 `npm run tauri:build` 装包后复验。详见 [docs/pitfalls.md](./docs/pitfalls.md)。

### 视觉规范

任何界面改动先读 [docs/design-system.md](./docs/design-system.md)（唯一视觉事实来源）。要点：

- 禁止任意值（`text-[13px]`、`rounded-[10px]`）；字号/圆角/图标只用既定档位
- 文字色只认 token（`text-ink` / `text-ink-2` / `text-ink-3`）
- 无文字的图标按钮必须有 `<Tooltip>` 文案
- 改样式后跑 `npm run design:check`；改 `tailwind.config.js` 需**进程级**重启 dev server

### 代码规范

- 用中文写 Issue / PR 描述 / commit message；代码注释用英文
- 组件文件放 `src/`，Rust 命令放 `src-tauri/src/cmds/`
- 不要硬编码 API 密钥；密钥只经 `src-tauri/src/secrets.rs` 存取
- 新增网络调用后跑 `npm run csp:check`
- 文档不写死版本号（`release:check` 会扫）

### 版本与变更记录

- 行为变更必须更新 `CHANGELOG.md`（`[Unreleased]` 段或对应版本）
- 版本号只在 `package.json` / `tauri.conf.json` / `Cargo.toml` 三处（`release:check` 把关）

## Pull Request 流程

1. Fork 并创建分支：`git checkout -b feature/my-change`
2. 开发并跑通全部门禁
3. 提交（commit message 说明**为什么**改，不只是**改了什么**）
4. 开 PR，填写 PR 模板（勾选门禁项与是否需要装包验证）
5. 等待 CI 与 review

## Issue 指引

**报 Bug** 请提供：

- 操作系统与版本、应用版本（设置 → 关于）
- **是装包版还是 `tauri dev`**——本项目 CSP 等行为在两者下不同，这是排查关键
- 复现步骤、期望/实际行为、截图或日志

**提功能** 请说明使用场景，不只是方案。

## 文档贡献

文档与代码同等重要。发现错漏直接提 PR 即可。文档结构：

| 文档 | 内容 |
|------|------|
| `README.md` / `README.en.md` | 用户门面（安装/上手/FAQ） |
| `docs/development.md` | 开发环境与目录说明 |
| `docs/architecture.md` | 架构与数据目录 |
| `docs/design-system.md` | 视觉规范 |
| `docs/pitfalls.md` | 常见陷阱 |
| `docs/releasing.md` | 发版清单（维护者） |
| `AGENTS.md` | AI 协作约定 |

**单一事实来源**：同一条规则只写一处，其余留链接。改规则时先找权威文件。

## 行为准则

参与即表示同意遵守 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)（待补）。
