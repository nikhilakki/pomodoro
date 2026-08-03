# Using the app

Pomodoro keeps a single focus window, a menu bar tray, and three bottom sheets: **Tasks**, **Sessions**, and **Settings**.

## Timer

1. Choose **Focus**, **Short**, or **Long** under the dial (segmented control).
2. Press the large main button - or **Space** - to start or pause.
3. **Skip** jumps to the next phase in the cycle.
4. **Reset** restarts the current phase’s duration.

### Defaults

| Phase | Default length |
| ----- | -------------- |
| Focus | 25 minutes |
| Short break | 5 minutes |
| Long break | 15 minutes |
| Long break every | 4 completed focus sessions |

All of these are editable in Settings.

### Mode switch confirm

If a timer is **running or paused**, switching Focus / Short / Long asks for confirmation so you do not lose progress by accident.

### Cycle dots

Small dots under the dial show progress toward the next long break (completed focus sessions in the current set).

## Tasks

Open **Tasks** with the list icon in the title bar.

1. Type a title and add a task.
2. Press **play** on a row to start **Focus** on that task (sets it active and starts the timer when appropriate).
3. Tap a task title to **edit** — rename, set a due date and time, or clear the due date, then **Save**.
4. When a Focus phase completes while a task is active, its pomodoro count increments.
5. The active task appears as a chip under the dial - click it to reopen Tasks.

Due dates show under the title. Open tasks turn **soon** within 24 hours and **overdue** after the deadline.

With **Settings → Notifications** enabled, the app sends native alerts when a task is added and when a due date is approaching (about 24 hours before, 1 hour before, and at the due time). Completed tasks do not get due reminders. Reminders run while the app is open in the tray.

Mark tasks complete or delete them from the sheet. Data is stored locally (see [Privacy](/guide/privacy)).

## Sessions history

Open **Sessions** with the chart icon in the title bar, or from **Settings → Sessions**.

| Section | What it shows |
| ------- | ------------- |
| Stats | Focus sessions completed, total focus time, last-7-days count |
| Chart | Daily focus completions for the last 7 days |
| List | Recent sessions - completed, skipped, or stopped |

History is written to a local **SQLite** database when phases end (complete / skip / stop).

## Settings

Open **Settings** with the gear icon, or **⌘,** on macOS.

| Setting | Purpose |
| ------- | ------- |
| Focus / short / long durations | Minutes per phase |
| Long break every *N* | How many focus completions before a long break |
| Auto-start breaks | Start the next break when focus ends |
| Auto-start focus | Start focus when a break ends |
| Sound | Two-tone completion chime |
| Notifications | Native OS notifications on phase complete, task added, and due dates |
| Accent color | Dial + main button color, or **Auto** by phase |

## Tray

The menu bar / system tray icon provides quick controls so you can leave the main window in the background while a session runs.

## Accent colors

Accent applies to the progress ring and primary button:

- **Auto** - red (focus), green (short break), blue (long break) by default phase mapping
- Fixed system-style colors: red, orange, yellow, green, mint, teal, cyan, blue, indigo, purple, pink, brown

Light and dark UI follow the **system** appearance.

## Next steps

- [Keyboard shortcuts](/guide/keyboard)
- [Install notes](/guide/install)
- [Develop from source](/develop/setup)
