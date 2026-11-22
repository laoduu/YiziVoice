# YiziVoice

[![CI](https://github.com/laoduu/YiziVoice/actions/workflows/ci.yml/badge.svg)](https://github.com/laoduu/YiziVoice/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/laoduu/YiziVoice)](https://github.com/laoduu/YiziVoice/releases)

**A free AI voice studio for content creators** — text-to-speech, voice cloning, and speech-to-text in one desktop app, powered by Xiaomi MiMo models. Built for short videos, audiobooks, podcasts, game dubbing, and more.

Desktop app for Windows / macOS / Linux. ~10MB installer, local storage, works offline (generation calls the API online).

> 中文文档：[README.md](./README.md)

## Features

| Feature | Description | Model |
|---------|-------------|-------|
| **Text-to-Speech** | Type text, pick a voice, generate speech | `mimo-v2.5-tts` / `mimo-v2.5-tts-voiceclone` |
| **Voice Cloning** | Record / upload audio or describe a voice in text to clone & design voices, with role management | `mimo-v2.5-tts-voiceclone` / `mimo-v2.5-tts-voicedesign` |
| **Speech-to-Text** | Record or upload audio, transcribe to text | `mimo-v2.5-asr` |
| **AI Text Model** | Configurable text model for AI style descriptions | Configurable, default `mimo-v2.6-flash` |
| **Style Control** | Audio tags / one-paragraph description / director mode; 12 presets + custom | - |
| **Natural-Language Control** | Describe style, speed, mood in plain language; AI expands it into detailed style instructions | `mimo-v2.6-flash` |
| **History** | Auto-saves every generation: play, download, copy, restore task | - |
| **State Restore** | Click a history entry to fully restore the editor state and put the audio back on the workbench | - |

### Preset voices (9)

- Chinese: MiMo-Default (MiMo-默认), BingTang (冰糖), MoLi (茉莉), SuDa (苏打), BaiHua (白桦)
- English: Mia, Chloe, Milo, Dean

A factory demo voice library (fictional personas) is included and can be previewed in-app.

## Install

Download from [GitHub Releases](https://github.com/laoduu/YiziVoice/releases) (a domestic mirror is also available on the [official website](https://voice.yizigpt.com)).

| Platform | Artifact | Install |
|----------|----------|---------|
| **Windows** | `YiziVoice_<version>_x64-setup.exe` | Double-click, follow the wizard. No admin rights needed |
| **macOS** | `YiziVoice_<version>_universal.dmg` | Open and drag to Applications. Unsigned: if Gatekeeper blocks it, right-click → Open, or run `xattr -cr /Applications/YiziVoice.app` |
| **Linux** | `YiziVoice_<version>_amd64.deb` (recommended) | `sudo apt install ./YiziVoice_<version>_amd64.deb` |
| **Linux** | `YiziVoice_<version>_amd64.AppImage` (experimental) | `chmod +x` and run; requires libfuse2 |

> On Windows, if SmartScreen warns about an unsigned installer, choose "More info → Run anyway".

## Quick Start

1. Launch YiziVoice → **Settings** → paste your **MiMo API Key** → Save
2. Pick a tool on the left (TTS / Voice Clone / STT)
3. Type text or record → Generate → Preview / Download

### Get an API Key & Billing

Register at the [MiMo console](https://platform.xiaomimimo.com/console/balance) to get an API Key. Use invite code `DHLC96` at signup for bonus credit.

| Capability | Billing |
|-----------|---------|
| MiMo-TTS family (TTS / clone / design) | **Free** |
| MiMo-ASR (speech-to-text) | Paid, requires balance |
| MiMo-2.6 text models (AI style descriptions) | Paid, requires balance |

**API Key security**: your key is stored only in the OS credential store (Windows Credential Manager / macOS Keychain / Linux Secret Service). It is never written to a plaintext file and never uploaded anywhere.

## Usage

### Text-to-Speech

1. Open **Text to Speech** on the left
2. Choose a voice (Chinese / English / Cloned)
3. (Optional) Expand **Voice Settings**: audio-tag control (style chips / opening tag / inline tags) or natural-language control (paragraph / director mode)
4. Enter the script
5. Click **Generate**; play or download the WAV

### Voice Cloning

1. Open **Voice Clone**
2. Choose **Record** (≤20s) / **Upload** (WAV/MP3/WebM/OGG/FLAC, ≤10MB) / **Design** (describe in text)
3. Preview in the dialog, name the role, pick a category, save to your voice library
4. Cloned voices can be used in TTS; export/import JSON to share with collaborators

### Speech-to-Text

1. Open **Speech to Text**
2. Record (or upload audio)
3. Get the transcript — Chinese, English, or auto-detect; recordings can be replayed, downloaded, and copied

### History

The left pane auto-saves every generation: play, download, copy, **restore task** (load the full generation state back into the editor). Data lives in `Documents/YiziVoice/` and can be relocated in Settings.

## Data & Privacy

- All data (config, voices, history) is stored locally in `Documents/YiziVoice/`
- API Key stays in the OS credential store only
- Generation calls `api.xiaomimimo.com` over HTTPS; no telemetry, no analytics, no account system

## Build from Source

**Prerequisites**

- Node.js 18+
- Rust stable ([rustup](https://rustup.rs))
- Windows: Visual Studio Build Tools ("Desktop development with C++")
- Linux: `libwebkit2gtk-4.1-dev`, `libdbus-1-dev`, etc. (see [docs/releasing.md](./docs/releasing.md))
- macOS: Xcode Command Line Tools

```bash
git clone https://github.com/laoduu/YiziVoice.git
cd YiziVoice
npm install
npm run tauri:dev     # development mode (hot reload)
npm run tauri:build   # production build
```

**Pre-PR checks** (see [CONTRIBUTING.md](./CONTRIBUTING.md)):

```bash
npx tsc --noEmit        # type check
npm run csp:check       # CSP allowlist consistency
npm run design:check    # design-system static gate
cargo test --manifest-path src-tauri/Cargo.toml
```

> ⚠️ **CSP is only enforced in packaged builds** — `tauri dev` does not inject CSP. Changes touching downloads/resources must be verified in a packaged build.

## Project Structure

```
YiziVoice/
├── src/                  # React frontend (pages / components / services)
├── src-tauri/            # Tauri 2 Rust shell (commands / secrets / bundling)
├── docs/                 # developer docs (dev / design / releasing / pitfalls)
├── default-config/       # factory preset config (voices / styles / tags)
├── scripts/              # gate scripts (csp-check / design-check / release-check)
├── website/              # static landing page
└── .github/workflows/    # CI & release pipelines
```

See [docs/architecture.md](./docs/architecture.md) for architecture details.

## Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1 / 2 / 3` | Voice Clone / TTS / STT |
| `Ctrl+L` / `Ctrl+R` | Toggle left / right pane |
| `Ctrl+F` | Search history |
| `Ctrl+,` | Settings hub |
| `Esc` | Close dialog / settings |

## Tech Stack

- **Desktop**: [Tauri 2](https://tauri.app) (Rust + system WebView)
- **Frontend**: React 18 + TypeScript + Vite 5 + Tailwind CSS
- **API**: OpenAI-compatible SDK, locked to `https://api.xiaomimimo.com/v1`
- **Secrets**: OS keychain (Windows DPAPI / macOS Keychain / Linux Secret Service)

## FAQ

**Is it free?**
The app is free and open source. Bring your own MiMo API Key. TTS models are free to call; ASR and the 2.6 text models require balance.

**Why do I need to re-enter my API Key after upgrading?**
Your key stays in the OS credential store; upgrades normally don't require re-entry. Only very old versions may need it once.

**Where is my data?**
Locally in `Documents/YiziVoice/` (relocatable in Settings). Delete that folder to reset.

**Which platforms are supported?**
Windows / macOS / Linux (AMD64). See the install table above.

More questions: [docs/faq.md](./docs/faq.md).

## Documentation

| Doc | Content |
|-----|---------|
| [docs/development.md](./docs/development.md) | Dev setup, directory layout, gate scripts |
| [docs/architecture.md](./docs/architecture.md) | Architecture, desktop bridge, data directories |
| [docs/design-system.md](./docs/design-system.md) | Design system v4 (single source of truth) |
| [docs/pitfalls.md](./docs/pitfalls.md) | Pitfalls (CSP / keyring / StrictMode / WebKitGTK) |
| [docs/releasing.md](./docs/releasing.md) | Packaging & release checklist |
| [CHANGELOG.md](./CHANGELOG.md) | Changelog (Chinese) |

## Contributing

Issues and pull requests are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and pass all gates before submitting. Security reports: [SECURITY.md](./SECURITY.md).

## License

[MIT License](./LICENSE)

Third-party components: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Acknowledgements

- [Xiaomi MiMo](https://platform.xiaomimimo.com) models — the foundation of Chinese expressiveness and voice cloning
- [Tauri](https://tauri.app) / [React](https://react.dev) / [Vite](https://vite.dev) / [Tailwind CSS](https://tailwindcss.com) / [lucide](https://lucide.dev) and other open-source projects
- Everyone who tries the app, gives feedback, or sends a PR

---

If this project helps you, please consider giving it a Star ⭐
