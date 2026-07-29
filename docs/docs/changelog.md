# Changelog

Release notes for the desktop app. Downloads: [GitHub Releases](https://github.com/nikhilakki/pomodoro/releases).

## [0.1.1] (2026-07-28)

### Fixed

- **Window dragging** on the overlay title bar - drag regions (`data-tauri-drag-region`) and `core:window:allow-start-dragging` so the window can be moved from the title bar and empty stage space

## [0.1.0] (2026-07-28)

Initial multi-platform release.

### Features

- Focus / Short Break / Long Break cycles with tray controls
- Tasks with per-task pomodoro counts
- Local SQLite session history and Sessions sheet (stats + 7-day chart)
- Accent colors for dial and main button
- Confirm before switching modes while a timer is active
- Native notifications and optional completion chime
- Light / dark mode following the system

### Platforms

- macOS arm64 + x64
- Windows x64 + arm64
- Linux x64 + arm64 (AppImage, deb, rpm)

### Docs

- README focused on usage; packaging notes in `DISTRIBUTING.md`
- macOS Gatekeeper quarantine workaround documented
