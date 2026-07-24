# Pomodoro

A minimal, iOS-native-looking Pomodoro timer for macOS, Windows, and Linux — built with **Tauri v2** (Rust core) and a vanilla TypeScript frontend.

The timer engine lives in Rust (an authoritative state machine on a tokio tick loop), so the countdown never drifts or throttles when the window is hidden. The UI renders iOS design language: SF typography, system colors, frosted-glass vibrancy, segmented controls, and a bottom-sheet settings panel.

## Features

- 🍅 Focus / Short Break / Long Break cycles (25/5/15 by default, long break every 4)
- ⏸ Start, pause, resume, skip, reset — from the window **or the menu bar tray**
- 📊 Live countdown in the macOS menu bar (tray title)
- 🔔 Native notifications + synthesized chime on phase completion
- ⚙️ iOS-style settings sheet: durations, auto-start behavior, sound, notifications (persisted across launches)
- 🌗 Automatic light/dark mode with iOS semantic colors
- 🪟 Frosted-glass window (NSVisualEffectView on macOS, Acrylic on Windows), close-to-tray
- ⌨️ Keyboard: `Space` start/pause, `⌘,` settings, `Esc` close sheet

## Tech stack

| Layer    | Tech                                                              |
| -------- | ----------------------------------------------------------------- |
| Core     | Rust, tokio, Tauri v2                                             |
| Plugins  | notification, store, opener, tray-icon, window-vibrancy           |
| Frontend | Vanilla TypeScript, Vite (≈12 KB JS + 7 KB CSS, zero framework)   |
| Tests    | `cargo test` — 11 unit tests on the timer state machine           |

## Project structure

```
├── src/                     # Frontend (vanilla TS)
│   ├── main.ts              # Bootstrap, event wiring, chime
│   ├── state.ts             # Client store mirroring the Rust timer
│   ├── ui/                  # timer-view, controls, segments, settings
│   └── styles/              # iOS design tokens + app styles
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Setup, plugins, tick loop, vibrancy
│   │   ├── timer.rs         # Timer state machine (unit-tested)
│   │   ├── commands.rs      # IPC commands shared by UI + tray
│   │   └── tray.rs          # Menu bar icon, title, menu
│   ├── capabilities/        # Tauri v2 permissions
│   └── tauri.conf.json
└── .github/workflows/       # Release pipeline (GitHub Releases)
```

## Run locally

### Prerequisites

- **Rust** (stable, via [rustup](https://rustup.rs))
- **Node.js 20+** and **pnpm** (`npm i -g pnpm`)
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (preinstalled on Win11) + MSVC Build Tools
- **Linux** (Debian/Ubuntu):
  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libxdo-dev libssl-dev
  ```

### Develop

```bash
git clone https://github.com/nikhilakki/pomodoro.git
cd pomodoro
pnpm install
pnpm tauri dev
```

This starts Vite on `:1420` and opens the app with hot-reload for the frontend; Rust changes restart the app automatically.

### Test

```bash
cd src-tauri && cargo test    # timer state machine unit tests
```

## Build binaries locally

```bash
pnpm tauri build
```

Outputs land in `src-tauri/target/release/bundle/`:

| Platform | Artifact                    |
| -------- | --------------------------- |
| macOS    | `.app`, `.dmg`              |
| Windows  | `.msi`, `.exe` (NSIS)       |
| Linux    | `.AppImage`, `.deb`         |

Cross-compiling desktop OSes is not supported — build on the target OS (or let CI do it, see below).

## Distribution via GitHub Releases

The repo ships a release pipeline at [`.github/workflows/release.yml`](.github/workflows/release.yml). It builds signed-optional installers for **macOS (Apple Silicon + Intel), Windows, and Linux** and attaches them to a GitHub Release.

### How it works

1. The workflow triggers on version tags (`v*`) or manually via *Actions → Release → Run workflow*.
2. [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action) builds each platform on its native runner and collects the bundles.
3. A **draft release** is created with all artifacts attached — review it, edit notes, then publish.

### Cut a release

```bash
# 1. bump version in package.json AND src-tauri/tauri.conf.json, then commit
git tag v0.2.0
git push origin v0.2.0
```

Then open **GitHub → Releases → draft** and publish. Users download the installer for their OS directly from the release page.

### Notes

- **macOS Gatekeeper**: unsigned builds require right-click → *Open* on first launch. For seamless installs, add `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` secrets and tauri-action will sign + notarize automatically.
- **Windows**: consider adding an EV/OV code-signing cert via `WINDOWS_CERTIFICATE` secrets to avoid SmartScreen warnings.
- The workflow needs no extra secrets beyond the default `GITHUB_TOKEN` (permissions: `contents: write`, already declared in the workflow file).

## Author

**nikhilakki** — [github.com/nikhilakki](https://github.com/nikhilakki) · [@nik_akki on X](https://x.com/nik_akki)

## License

[MIT](LICENSE) © 2026 nikhilakki
