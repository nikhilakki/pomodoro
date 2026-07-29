# Architecture

Pomodoro is a **Tauri v2** desktop app: Rust owns timer state, persistence, tray, and IPC; the UI is vanilla TypeScript + CSS rendered in a system webview.

## Stack

| Layer | Technology |
| ----- | ---------- |
| Shell | Tauri v2, multi-platform webview |
| Core | Rust - timer FSM, commands, tray |
| Storage | `tauri-plugin-store` (settings, todos), **rusqlite** (sessions) |
| Frontend | TypeScript, Vite, no UI framework |
| Plugins | notification, store, opener, tray-icon |

## Repository layout

```
pomodoro/
├── src/                      # Frontend
│   ├── main.ts               # Bootstrap, title bar, sheets wiring
│   ├── state.ts              # Frontend store + invoke helpers
│   ├── ui/                   # Timer, controls, tasks, sessions, settings
│   └── styles/               # Design tokens + app CSS
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           # App setup, plugins, state
│   │   ├── timer.rs          # Phase machine, durations, effects
│   │   ├── commands.rs       # IPC commands
│   │   ├── todos.rs          # Task list persistence
│   │   ├── db.rs             # SQLite open / schema
│   │   ├── sessions.rs       # Session insert / list / stats
│   │   └── tray.rs           # Menu bar tray
│   ├── capabilities/         # Tauri ACL (e.g. start_dragging)
│   └── tauri.conf.json       # Window, bundle, identity
└── .github/workflows/        # Release CI
```

## Timer core

The Rust `Timer` keeps phase, remaining time, running/paused flags, and settings. Commands such as `start_timer`, `pause_timer`, `toggle_timer`, `skip_phase`, `reset_timer`, and `set_phase` mutate state and emit effects (notifications, session rows, UI events).

Phase completion fires a frontend event (`timer://phase-complete`) for the optional chime and works with the notification plugin.

## Frontend

- **`store`** - caches timer snapshot, settings, todos; `invoke`s Rust commands; applies accent/theme attributes on `#app`.
- **Views** - pure DOM classes (`TimerView`, `Controls`, `Segments`, `TodosPanel`, `SessionsPanel`, `SettingsPanel`).
- **Sheets** - iOS-style bottom sheets for Tasks, Sessions, and Settings.
- **Window chrome** - overlay title bar; `data-tauri-drag-region` so the window can be moved without a classic title bar.

## Data model (sessions)

Session rows are stored in SQLite for the Sessions UI (stats, 7-day bars, recent list). Outcomes typically include completed, skipped, and stopped phases with timestamps and durations.

Settings and todos use the key-value store plugin (JSON files under the app data directory).

## Security model

Tauri capabilities in `src-tauri/capabilities/default.json` grant a minimal permission set (core, tray, notifications, opener, window `start_dragging`). Prefer adding permissions only when a feature needs them.

## Identity

- Bundle / product name: **Pomodoro**
- Identifier: `com.pomodoro.app`

## Related reading

- [Tauri v2 docs](https://v2.tauri.app/)
- [Releasing](/develop/releasing)
