# Security Policy

> 中文版：[SECURITY.md](./SECURITY.md)

## Reporting a vulnerability

If you find a security vulnerability, please **do not** open a public issue.

- Email / private contact: reach the maintainer ([laoduu](https://github.com/laoduu)) via the GitHub repo contact, subject line `[Security] YiziVoice`
- Or use [GitHub Security Advisories](https://github.com/laoduu/YiziVoice/security/advisories) → "Report a vulnerability"

Please include: affected version, repro steps, impact scope. We aim to reply within 72 hours.

## Supported versions

| Version | Supported |
|---------|-----------|
| Latest release | ✅ |
| Older versions | ❌ please upgrade |

## Security model

### API key storage

- The key is stored **only in the OS credential store**: Windows Credential Manager (DPAPI) / macOS Keychain / Linux Secret Service
- **Never written to plaintext**: `settings.json` contains no secrets; the settings page writes but never echoes the key
- The key is never uploaded anywhere (this project has no backend; generation calls `api.xiaomimimo.com` directly)
- If the credential store is unavailable, saving fails loudly — it **never falls back to plaintext**

### Network

- Single external API: `https://api.xiaomimimo.com` (locked via CSP `connect-src`)
- No telemetry, no analytics, no third-party SDK data collection
- History audio playback uses the local asset protocol (scoped to `History/**`)

### Local data

- All user data lives in `Documents/YiziVoice/` (relocatable); delete the folder to erase it
- History cleanup commands use strict index parsing to avoid accidental deletion

## User self-check

If you suspect key leakage:

1. Rotate the key at the [MiMo console](https://platform.xiaomimimo.com/console/balance)
2. Clear the old key in app settings and paste the new one
3. Review your credential store for stray entries (Windows: `cmdkey /list`; macOS: Keychain Access)

Never paste real keys into screenshots, issues, logs, or commits. Use `sk-...` placeholders in examples.
