# Pomodoro

A minimal, iOS-native Pomodoro timer for macOS, Windows, and Linux.

**Docs:** [nikhilakki.github.io/pomodoro-docs](https://nikhilakki.github.io/pomodoro-docs/) · **Download:** [GitHub Releases](https://github.com/nikhilakki/pomodoro/releases/latest)

## Install

### macOS & Linux (one-liner)

```bash
curl -fsSL https://atmd.cc/pomodoro | bash
```

The script detects your OS and CPU, then installs the right package:

| Platform | Default package |
| -------- | --------------- |
| macOS | `.dmg` → `/Applications/Pomodoro.app` (clears Gatekeeper quarantine) |
| Debian / Ubuntu / Mint / Pop!_OS | `.deb` |
| Fedora / RHEL / Rocky / Alma / openSUSE | `.rpm` |
| Other Linux | `.AppImage` → `~/.local/bin/pomodoro` |

**Options** (environment variables):

```bash
# Pin a version
POMODORO_VERSION=0.1.1 curl -fsSL https://atmd.cc/pomodoro | bash

# Force AppImage on Debian/Fedora
POMODORO_FORMAT=appimage curl -fsSL https://atmd.cc/pomodoro | bash

# Custom AppImage install dir
POMODORO_INSTALL_DIR=~/bin curl -fsSL https://atmd.cc/pomodoro | bash

# Preview without installing
POMODORO_DRY_RUN=1 curl -fsSL https://atmd.cc/pomodoro | bash
```

### Manual download

1. Open the [latest release](https://github.com/nikhilakki/pomodoro/releases/latest).
2. Download the installer for your OS and CPU:

   | Platform | Arch | Typical file |
   | -------- | ---- | ------------ |
   | macOS | Apple Silicon (M1–M4) | `…_aarch64.dmg` |
   | macOS | Intel | `…_x64.dmg` |
   | Windows | amd64 | `…_x64-setup.exe` or `…_x64_en-US.msi` |
   | Windows | arm64 | `…_arm64-setup.exe` or `…_arm64_en-US.msi` |
   | Linux | amd64 | `…_amd64.AppImage` / `.deb` / `.rpm` |
   | Linux | arm64 | `…_aarch64.AppImage` / `…_arm64.deb` / `.rpm` |

3. Install and open the app.

### macOS Gatekeeper

Unsigned downloads may show **“Pomodoro is damaged and can’t be opened.”** The app is not damaged — clear the quarantine flag once:

```bash
xattr -cr /Applications/Pomodoro.app
```

Then open Pomodoro from Applications.

### Windows SmartScreen

You may see a SmartScreen warning. Choose **More info** → **Run anyway** if you trust the release.

### Linux AppImage

```bash
chmod +x Pomodoro_*.AppImage
./Pomodoro_*.AppImage
```

## What you can do

- Run **Focus**, **Short Break**, and **Long Break** cycles (defaults 25 / 5 / 15 minutes; long break every 4 focus sessions)
- **Tasks** — add and edit todos, set due dates, get reminders as deadlines approach, start a focus session from a task, track pomodoros per task
- **Sessions** — view focus totals, a 7-day chart, and recent history (chart icon in the title bar, or **Settings → Sessions**)
- Control the timer from the window or the **menu bar tray**
- Get a notification and optional chime when a phase finishes
- Pick an **accent color** for the dial and main button (or Auto by phase)
- Use light or dark mode (follows system)

## Using the app

### Timer

1. Choose **Focus**, **Short**, or **Long** at the bottom of the dial.
2. Press the main button (or **Space**) to start / pause.
3. Use skip to jump to the next phase, or reset to restart the current one.
4. If a timer is running or paused, switching mode asks for confirmation first.

### Tasks

1. Open **Tasks** (list icon in the title bar).
2. Add a task, then press play on a row to start Focus on that task.
3. Tap a task title to edit it, set or clear a due date, then Save.
4. Finished Focus sessions count toward that task’s pomodoro total.
5. With **Notifications** on, the app alerts when a task is added and when a due date is approaching (24h, 1h, and at due).
4. The active task appears under the dial while set.

### Sessions history

1. Open **Sessions** (chart icon in the title bar).
2. Check **Focus done**, total focus time, and last-7-days count.
3. Use the bar chart for daily focus counts; scroll for the full recent list (completed, skipped, stopped).

### Settings

Open **Settings** (gear icon, or **⌘,** on macOS):

- Focus / short break / long break lengths
- Long break every *N* focus sessions
- Auto-start breaks or focus
- Completion chime and notifications
- Accent color
- Link to Sessions history

## Keyboard

| Shortcut | Action |
| -------- | ------ |
| `Space` | Start / pause (when no sheet is open) |
| `⌘,` | Open Settings (macOS) |
| `Esc` | Close Settings, Tasks, or Sessions |

## Privacy

Everything stays on your device: settings, tasks, and session history (local SQLite). No account and no cloud sync.

## Author

**nikhilakki** — [github.com/nikhilakki](https://github.com/nikhilakki) · [@nik_akki on X](https://x.com/nik_akki)

## License

[MIT](LICENSE) © 2026 nikhilakki

---

Full documentation: **[Pomodoro docs](https://nikhilakki.github.io/pomodoro-docs/)** (install, usage, develop, FAQ).

Building from source, release pipeline, and packaging: see [DISTRIBUTING.md](DISTRIBUTING.md) or the [develop section](https://nikhilakki.github.io/pomodoro-docs/develop/setup) of the docs site.
