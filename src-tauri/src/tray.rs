use crate::timer::{Event, TimerSnapshot};
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

const TRAY_ID: &str = "main-tray";

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app, "idle")?;
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("default window icon is required for the tray");

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .title("🍅")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => {
                crate::commands::dispatch(app, Event::Toggle);
            }
            "skip" => {
                crate::commands::dispatch(app, Event::Skip);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn toggle_label(status: &str) -> &'static str {
    match status {
        "running" => "Pause",
        "paused" => "Resume",
        _ => "Start",
    }
}

fn build_menu(app: &AppHandle, status: &str) -> tauri::Result<Menu<Wry>> {
    MenuBuilder::new(app)
        .item(
            &MenuItemBuilder::with_id("toggle", toggle_label(status))
                .build(app)?,
        )
        .item(&MenuItemBuilder::with_id("skip", "Skip Phase").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("show", "Show Pomodoro").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("quit", "Quit Pomodoro").build(app)?)
        .build()
}

fn title_for(snapshot: &TimerSnapshot) -> String {
    let secs = snapshot.remaining_ms.div_ceil(1000);
    let (mm, ss) = (secs / 60, secs % 60);
    match snapshot.status.as_str() {
        "running" => format!("{mm}:{ss:02}"),
        "paused" => format!("⏸ {mm}:{ss:02}"),
        _ => "🍅".to_string(),
    }
}

pub fn set_tray_title(app: &AppHandle, snapshot: &TimerSnapshot) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_title(Some(title_for(snapshot)));
    }
}

pub fn set_tray_menu(app: &AppHandle, snapshot: &TimerSnapshot) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Ok(menu) = build_menu(app, &snapshot.status) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

/// Full sync — used after user-driven actions.
pub fn sync_tray(app: &AppHandle, snapshot: &TimerSnapshot) {
    set_tray_title(app, snapshot);
    set_tray_menu(app, snapshot);
}
