# 安全策略

> English: [SECURITY.en.md](./SECURITY.en.md)

## 报告漏洞

如果你发现安全漏洞，请**不要**开公开 Issue。

- 邮件：请通过 GitHub 仓库主页的联系方式私信维护者（[laoduu](https://github.com/laoduu)），标题注明 `[Security] YiziVoice`
- 或使用 [GitHub Security Advisories](https://github.com/laoduu/YiziVoice/security/advisories) 的「Report a vulnerability」

请尽量提供：受影响版本、复现步骤、影响范围。通常会在 72 小时内回复。

## 支持范围

| 版本 | 支持 |
|------|------|
| 最新 Release | ✅ |
| 更早版本 | ❌ 请升级到最新版 |

## 安全模型

### API Key 存储

- Key 仅加密存储在**本机系统凭据库**：Windows 凭据管理器（DPAPI）/ macOS Keychain / Linux Secret Service
- **任何文件不落明文**：`settings.json` 不含密钥；设置页对 Key 只写不回显
- Key 不会上传到任何服务器（本项目没有后端；生成调用直连 `api.xiaomimimo.com`）
- 若凭据库不可用，保存会明确报错，**不会降级为明文存储**

### 网络

- 唯一外部 API：`https://api.xiaomimimo.com`（CSP `connect-src` 锁定）
- 无遥测、无统计上报、无第三方 SDK 数据收集
- 历史音频回放走本地 asset protocol（范围限定 `History/**`）

### 数据本地化

- 全部用户数据在 `文档/YiziVoice/`（可重定向），可整体删除以清除
- 历史记录清理类命令对索引做严格读取，避免解析失败导致误删

## 用户自查

怀疑 Key 泄露时：

1. 前往 [MiMo 控制台](https://platform.xiaomimimo.com/console/balance) 重置 Key
2. 在应用设置中清除旧 Key，填入新 Key
3. 检查本机凭据库是否有多余条目（Windows：`cmdkey /list`；macOS：钥匙串访问）

请勿把真实 Key 写入截图、Issue、日志或代码提交。示例一律使用 `sk-...` 占位符。
