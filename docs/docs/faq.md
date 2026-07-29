# FAQ

## Is Pomodoro free?

Yes. The app is open source under the [MIT License](https://github.com/nikhilakki/pomodoro/blob/main/LICENSE).

## Which platforms are supported?

macOS (Apple Silicon and Intel), Windows (x64 and arm64), and Linux (x64 and arm64). See [Install](/guide/install).

## Why does macOS say the app is damaged?

Unsigned downloads are quarantined by Gatekeeper. Clear quarantine once:

```bash
xattr -cr /Applications/Pomodoro.app
```

Details: [Install → macOS](/guide/install#macos).

## Why can’t I drag the window?

Use the title bar strip or empty area around the timer (and the ring). Toolbar buttons are not drag handles. Fixed in **v0.1.1** for overlay title bars.

## Where is my data stored?

On your device only - settings/tasks in a local store, session history in SQLite. See [Privacy](/guide/privacy).

## Does it sync across devices?

No. There is no cloud sync. You can back up the app data directory yourself if needed.

## Can I change the 25/5/15 defaults?

Yes - open **Settings** (gear or `⌘,` on macOS) and edit phase lengths and long-break cadence.

## How do I contribute?

1. Fork [nikhilakki/pomodoro](https://github.com/nikhilakki/pomodoro)
2. Follow [Setup from source](/develop/setup)
3. Open a pull request with a clear description

Docs improvements: edit this site’s repo ([pomodoro-docs](https://github.com/nikhilakki/pomodoro-docs)) or use **Edit this page** on any article.

## Who maintains this?

**nikhilakki** - [GitHub](https://github.com/nikhilakki) · [@nik_akki](https://x.com/nik_akki)

## Where do I report bugs?

Open an issue on [github.com/nikhilakki/pomodoro](https://github.com/nikhilakki/pomodoro/issues) with OS, arch, app version, and steps to reproduce.
