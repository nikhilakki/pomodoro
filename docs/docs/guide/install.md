# Install

You do not need Rust or Node.js to use the app.

## Quick install (macOS & Linux)

```bash
curl -fsSL https://atmd.cc/pomodoro | bash
```

The installer:

1. Detects OS (`macOS` / `Linux`) and CPU (`x86_64` / `aarch64` / `arm64`)
2. Picks a package for your distro (`.dmg` / `.deb` / `.rpm` / AppImage)
3. Downloads the matching asset from [GitHub Releases](https://github.com/nikhilakki/pomodoro/releases/latest)
4. Installs it (and clears macOS quarantine when needed)

| Platform | Default package |
| -------- | --------------- |
| macOS | `.dmg` → `/Applications/Pomodoro.app` |
| Debian, Ubuntu, Mint, Pop!_OS, Elementary, … | `.deb` |
| Fedora, RHEL, Rocky, Alma, Amazon Linux, openSUSE, … | `.rpm` |
| Arch, Alpine, Gentoo, NixOS, Void, other | AppImage → `~/.local/bin/pomodoro` |

### Options

| Variable | Meaning |
| -------- | ------- |
| `POMODORO_VERSION` | Pin a version (e.g. `0.1.1`) instead of latest |
| `POMODORO_FORMAT` | Force `deb`, `rpm`, or `appimage` |
| `POMODORO_INSTALL_DIR` | AppImage destination (default `~/.local/bin`) |
| `POMODORO_PREFIX` | macOS Applications folder (default `/Applications`) |
| `POMODORO_NO_SUDO` | Set to `1` to refuse elevated installs (use AppImage) |
| `POMODORO_DRY_RUN` | Set to `1` to print actions without installing |

```bash
# Pin version
POMODORO_VERSION=0.1.1 curl -fsSL https://atmd.cc/pomodoro | bash

# Force portable AppImage (no root)
POMODORO_FORMAT=appimage curl -fsSL https://atmd.cc/pomodoro | bash
```

## Manual download

**[→ Latest release](https://github.com/nikhilakki/pomodoro/releases/latest)**

| Platform | Arch | Typical file |
| -------- | ---- | ------------ |
| macOS | Apple Silicon (M1-M4) | `..._aarch64.dmg` |
| macOS | Intel | `..._x64.dmg` |
| Windows | amd64 | `..._x64-setup.exe` or `..._x64_en-US.msi` |
| Windows | arm64 | `..._arm64-setup.exe` or `..._arm64_en-US.msi` |
| Linux | amd64 | `..._amd64.AppImage` / `.deb` / `.rpm` |
| Linux | arm64 | `..._aarch64.AppImage` / `..._arm64.deb` / `.rpm` |

Also available: `.app.tar.gz` archives on macOS for portable use.

## macOS

1. Open the `.dmg` and drag **Pomodoro** into **Applications**.
2. Open the app from Applications.

Or use the [quick install](#quick-install-macos--linux) script above.

### Gatekeeper (“damaged” app)

Unsigned builds may show:

> Pomodoro is damaged and can’t be opened.

The binary is not corrupted - macOS quarantine is blocking it. Clear the flag once:

```bash
xattr -cr /Applications/Pomodoro.app
```

Then open Pomodoro again from Applications. Right-click → **Open** can also work for some Gatekeeper prompts.

See the main repo’s [DISTRIBUTING.md](https://github.com/nikhilakki/pomodoro/blob/main/DISTRIBUTING.md) for signing/notarization if you package your own builds.

## Windows

1. Run the `.exe` (NSIS) or `.msi` installer.
2. Launch **Pomodoro** from the Start menu.

### SmartScreen

You may see a SmartScreen warning on unsigned builds. Choose **More info** → **Run anyway** if you trust the release from this project’s GitHub.

## Linux

### AppImage

```bash
chmod +x Pomodoro_*.AppImage
./Pomodoro_*.AppImage
```

### Debian / Ubuntu (`.deb`)

```bash
sudo dpkg -i Pomodoro_*.deb
# if needed:
sudo apt-get install -f
```

### Fedora / RHEL (`.rpm`)

```bash
sudo rpm -i Pomodoro-*.rpm
# or
sudo dnf install ./Pomodoro-*.rpm
```

## Moving the window

The title bar uses an overlay style (traffic lights on macOS, no classic chrome). Drag:

- The **title bar** area (between traffic lights and the toolbar icons), or
- **Empty stage space** and the **timer ring**

Buttons and controls stay clickable and do not start a drag.

## Next steps

- [Using the app](/guide/usage)
- [Keyboard shortcuts](/guide/keyboard)
- [Privacy](/guide/privacy)
