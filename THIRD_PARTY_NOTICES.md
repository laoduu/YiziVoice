# Third-Party Notices

YiziVoice is distributed under the [MIT License](./LICENSE). It bundles or
links against the following third-party software. Each component remains under
its own license; the texts below are for attribution and compliance.

## Frontend (npm dependencies)

| Package | License | Notes |
|---|---|---|
| `react`, `react-dom` | MIT | React |
| `react-router-dom` | MIT | Routing |
| `lucide-react` | ISC | Icon set |
| `openai` | **Apache-2.0** | OpenAI-compatible SDK (MiMo API client). Apache-2.0 requires preserving attribution; a copy of the license is at <https://www.apache.org/licenses/LICENSE-2.0>. If a `NOTICE` file is shipped with the package, it must be retained when redistributing. |
| `vite`, `@vitejs/plugin-react` | MIT | Build toolchain |
| `tailwindcss`, `autoprefixer`, `postcss` | MIT | Styling toolchain |
| `typescript` | Apache-2.0 | TypeScript compiler |

## Tauri (Rust / desktop shell)

| Crate / Plugin | License | Notes |
|---|---|---|
| `tauri`, `tauri-build`, `tauri-utils`, `wry`, `tao`, `tauri-plugin-dialog`, `tauri-plugin-opener`, `@tauri-apps/*` | MIT OR Apache-2.0 | Dual-licensed; use is under MIT for this distribution. See <https://github.com/tauri-apps/tauri> |
| `keyring` | MIT | OS credential store bindings |
| `serde`, `serde_json` | MIT OR Apache-2.0 | Serialization |
| `base64` | MIT OR Apache-2.0 | Encoding |

## System / runtime components redistributed or depended upon

- **Windows**: Microsoft Edge WebView2 Runtime (bootstrapper installer). Its
  use is governed by the Microsoft Edge WebView2 Runtime License Terms.
- **macOS**: WebKit framework (system-provided, Apple terms apply).
- **Linux (deb / AppImage)**: WebKitGTK 4.1, GTK 3, GLib/GObject, GStreamer
  (LGPL-2.1+/LGPL-3 dynamic linking; the distributed `.deb` links against
  system libraries and does not vendor them). The experimental AppImage bundles
  GTK/Wayland libraries under their respective LGPL terms; corresponding source
  is available from the upstream projects.

## Trademarks and third-party content

- "MiMo" and the MiMo model family are trademarks of their respective owners.
  YiziVoice is an independent client for the MiMo API and is not an official
  Xiaomi product.
- Voice-cloning samples shipped in `default-config/voices/` are demonstration
  clips produced with synthetic/fictional personas. Any resemblance to real
  persons is coincidental; rename mapping is maintained in the repository.

## Font / asset attribution

- `lucide-react` icons (ISC) rendered in the UI.
- Brand palette and glass-material styling are original work, MIT.
