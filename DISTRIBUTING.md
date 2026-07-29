# Distributing Pomodoro

How releases are built and published. For day-to-day app usage, see [README.md](README.md) or the hosted docs at [nikhilakki.github.io/pomodoro-docs](https://nikhilakki.github.io/pomodoro-docs/).

## GitHub Releases pipeline

The release workflow is [`.github/workflows/release.yml`](.github/workflows/release.yml). It builds installers for:

| Platform | Arch |
| -------- | ---- |
| macOS | arm64, x86_64 |
| Windows | x86_64, arm64 |
| Linux | x86_64, arm64 |

Artifacts are attached to a GitHub Release for the matching version tag.

### How it works

1. The workflow triggers on version tags (`v*`) or manually via **Actions → Release → Run workflow**.
2. [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action) builds each platform on its native runner and collects the bundles.
3. A release is created with artifacts attached. Review notes, then ensure the release is published (not left as draft).

### Cut a release

1. Bump version in:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml` (and refresh lockfile if needed)
2. Commit on `main`.
3. Tag and push:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Users download installers from the [Releases](https://github.com/nikhilakki/pomodoro/releases) page, or use the one-liner installer:

```bash
curl -fsSL https://atmd.cc/pomodoro | bash
```

[`install.sh`](install.sh) detects OS/CPU and installs `.dmg` (macOS), `.deb` / `.rpm` (package managers), or AppImage (portable Linux). Keep asset naming stable when changing Tauri bundle config so the script keeps matching release files.

### Code signing notes

- **macOS:** unsigned builds need the Gatekeeper workaround documented in the [README](README.md#macos-gatekeeper). For seamless installs, add Apple signing + notarization secrets so tauri-action can sign and notarize:
  - `APPLE_CERTIFICATE`
  - `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_SIGNING_IDENTITY`
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`
- **Windows:** optional EV/OV cert via `WINDOWS_CERTIFICATE` (and related secrets) to reduce SmartScreen warnings.
- Default pipeline only needs `GITHUB_TOKEN` (`contents: write`).

## Local builds

```bash
pnpm install
pnpm tauri build
```

Outputs land in `src-tauri/target/release/bundle/`:

| Platform | Artifact |
| -------- | -------- |
| macOS | `.app`, `.dmg` |
| Windows | `.msi`, `.exe` (NSIS) |
| Linux | `.AppImage`, `.deb`, `.rpm` |

Cross-compiling desktop OSes is not supported — build on the target OS, or use the CI matrix above.

## Develop from source

### Prerequisites

- **Rust** (stable, via [rustup](https://rustup.rs))
- **Node.js 20+** and **pnpm** (`npm i -g pnpm`)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Windows:** [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) + MSVC Build Tools
- **Linux** (Debian/Ubuntu):

  ```bash
  sudo apt-get install -y \
    libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
    patchelf libxdo-dev libssl-dev xdg-utils
  ```

### Run

```bash
git clone https://github.com/nikhilakki/pomodoro.git
cd pomodoro
pnpm install
pnpm tauri dev
```

### Test

```bash
cd src-tauri && cargo test
```

## Tech stack

| Layer | Tech |
| ----- | ---- |
| Core | Rust, tokio, Tauri v2, rusqlite (bundled) |
| Plugins | notification, store, opener, tray-icon, window-vibrancy |
| Frontend | Vanilla TypeScript, Vite |
| Storage | Settings/todos JSON store; session history in local SQLite |
| Tests | `cargo test` — timer, todos, session DB |

## Project structure

```
├── src/                     # Frontend (vanilla TS)
│   ├── main.ts
│   ├── state.ts
│   ├── ui/
│   └── styles/
├── src-tauri/
│   ├── src/                 # timer, todos, db, sessions, tray, commands
│   ├── capabilities/
│   └── tauri.conf.json
└── .github/workflows/       # Release pipeline
```
