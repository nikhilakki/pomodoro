# Setup from source

Build and run Pomodoro on your machine for development.

## Prerequisites

| Tool | Notes |
| ---- | ----- |
| **Rust** (stable) | Install via [rustup](https://rustup.rs) |
| **Node.js 20+** | LTS recommended |
| **pnpm** | `npm i -g pnpm` or [corepack](https://nodejs.org/api/corepack.html) |
| **OS SDKs** | See below |

### macOS

```bash
xcode-select --install
```

### Windows

- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (usually preinstalled on Win11)
- MSVC Build Tools (Visual Studio “Desktop development with C++”)

### Linux (Debian / Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libxdo-dev \
  libssl-dev \
  xdg-utils
```

## Clone and run

```bash
git clone https://github.com/nikhilakki/pomodoro.git
cd pomodoro
pnpm install
pnpm tauri dev
```

This starts Vite for the frontend and a debug Tauri window with hot reload.

Useful scripts from the app `package.json`:

| Script | Command |
| ------ | ------- |
| Frontend only | `pnpm dev` |
| Tauri dev | `pnpm tauri dev` / `pnpm tauri:dev` |
| Production frontend build | `pnpm build` |
| Full app bundle | `pnpm tauri build` / `pnpm tauri:build` |

## Tests

Rust unit tests (timer, todos, session DB):

```bash
cd src-tauri
cargo test
```

## Production bundle (local)

```bash
pnpm install
pnpm tauri build
```

Artifacts appear under `src-tauri/target/release/bundle/`:

| Platform | Artifacts |
| -------- | --------- |
| macOS | `.app`, `.dmg` |
| Windows | `.msi`, NSIS `.exe` |
| Linux | `.AppImage`, `.deb`, `.rpm` |

Cross-compiling desktop targets is not supported - build on the OS you care about, or use the [CI release matrix](/develop/releasing).

## Next

- [Architecture](/develop/architecture)
- [Releasing](/develop/releasing)
