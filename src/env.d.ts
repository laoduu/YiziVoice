/// <reference types="vite/client" />

// 由 vite.config.ts 的 define 在构建时注入，来源是 package.json 的 version。
// 这样版本号只有 package.json / tauri.conf.json / Cargo.toml 三处需要同步，
// 界面里不再硬编码版本字符串（见 scripts/release-check.mjs）。
declare const __APP_VERSION__: string
