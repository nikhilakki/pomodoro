# Privacy

Pomodoro is **local-first**. There is no account, no cloud sync, and no telemetry built into the app.

## What is stored

| Data | Where | Purpose |
| ---- | ----- | ------- |
| Settings | App data dir, JSON store | Durations, toggles, accent |
| Tasks / todos | App data dir, JSON store | Titles, completion, pomodoro counts, active task |
| Session history | App data dir, SQLite (`pomodoro.db`) | Phase outcomes for stats and the Sessions sheet |

Exact paths depend on the OS (Tauri app data directory for the bundle identifier `com.pomodoro.app`).

## What is not collected

- No sign-in
- No analytics or crash reporting service
- No network requirement for core timer features
- No automatic upload of tasks or history

Notifications and tray use the operating system APIs on your machine only.

## Uninstall / wipe

Removing the app does not always delete app data. To wipe local state, delete the application data folder for Pomodoro after quitting the app (location varies by OS).

## Open source

You can audit storage and behavior in the source:

- [nikhilakki/pomodoro](https://github.com/nikhilakki/pomodoro)
