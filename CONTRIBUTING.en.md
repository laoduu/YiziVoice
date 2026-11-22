# Contributing to YiziVoice

Thanks for your interest! YiziVoice is a Tauri 2 + React desktop app. Issues and pull requests are welcome.

> 中文版：[CONTRIBUTING.md](./CONTRIBUTING.md)

## Before you start

1. Search [Issues](https://github.com/laoduu/YiziVoice/issues) to avoid duplicates
2. For large changes, open an Issue first to discuss the approach
3. Report security issues privately via [SECURITY.md](./SECURITY.md) — never in a public Issue

## Development setup

```bash
git clone https://github.com/laoduu/YiziVoice.git
cd YiziVoice
npm install
npm run tauri:dev
```

Prerequisites and per-platform notes: [docs/development.md](./docs/development.md).

## Pre-PR gates (all required)

```bash
npx tsc --noEmit        # TypeScript type check
npm run csp:check       # CSP allowlist consistency
npm run design:check    # design-system static gate
cargo test --manifest-path src-tauri/Cargo.toml
```

All four must pass. CI (`.github/workflows/ci.yml`) runs the same gates.

## Key conventions

### ⚠️ CSP is only enforced in packaged builds

Under `tauri dev` the webview connects directly to the dev server and **no CSP header is injected**. Changes touching downloads, resource loading, or network calls must be verified in a packaged build (`npm run tauri:build`) — a passing `tauri dev` is not evidence. See [docs/pitfalls.md](./docs/pitfalls.md).

### Design system

Read [docs/design-system.md](./docs/design-system.md) (single source of truth) before UI changes. Highlights:

- No arbitrary values (`text-[13px]`, `rounded-[10px]`) — use the defined scales
- Text colors only via tokens (`text-ink` / `text-ink-2` / `text-ink-3`)
- Icon-only buttons must have a `<Tooltip>` label
- Run `npm run design:check` after style changes; `tailwind.config.js` changes need a full dev-server restart

### Code style

- Issues / PR descriptions / commit messages in Chinese; code comments in English
- Components in `src/`, Rust commands in `src-tauri/src/cmds/`
- Never hardcode API keys — secrets go through `src-tauri/src/secrets.rs` only
- Run `npm run csp:check` after adding network calls
- Never hardcode version numbers in docs (`release:check` scans for this)

### Versioning & changelog

- Behavior changes must update `CHANGELOG.md`
- Version numbers live in `package.json` / `tauri.conf.json` / `Cargo.toml` only

## Pull request process

1. Fork and branch: `git checkout -b feature/my-change`
2. Develop and pass all gates
3. Commit (explain **why**, not just **what**)
4. Open a PR using the template (check gates & packaged-verification needs)
5. Wait for CI and review

## Reporting issues

**Bugs** — please include:

- OS and version, app version (Settings → About)
- **Packaged build or `tauri dev`?** — CSP and other behaviors differ between the two
- Repro steps, expected/actual, screenshots or logs

**Features** — describe the use case, not just the solution.

## Docs contributions

Docs matter as much as code. Structure:

| Doc | Content |
|-----|---------|
| `README.md` / `README.en.md` | User-facing (install / quick start / FAQ) |
| `docs/development.md` | Dev setup & directory layout |
| `docs/architecture.md` | Architecture & data directories |
| `docs/design-system.md` | Design system |
| `docs/pitfalls.md` | Pitfalls |
| `docs/releasing.md` | Release checklist (maintainers) |
| `AGENTS.md` | AI collaboration conventions |

**Single source of truth**: each rule lives in one place; elsewhere links to it.

## Code of conduct

By participating you agree to the [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) (coming soon).
