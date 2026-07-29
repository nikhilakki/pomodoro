# Install

Download a prebuilt installer from the latest GitHub Release. You do not need Rust or Node.js to use the app.

**[→ Latest release](https://github.com/nikhilakki/pomodoro/releases/latest)**

## Choose a file

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
