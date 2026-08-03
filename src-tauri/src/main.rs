mod commands;
mod db;
mod sessions;
mod timer;
mod todos;
mod tray;

use db::OpenSession;
use rusqlite::Connection;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;
use timer::{Effect, Event, Phase, Settings, Timer};
use todos::TodoState;

pub struct AppState {
    pub timer: Mutex<Timer>,
    pub settings: Mutex<Settings>,
    pub todos: Mutex<TodoState>,
    pub db: Mutex<Connection>,
    pub open_session: Mutex<Option<OpenSession>>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::start_timer,
            commands::pause_timer,
            commands::resume_timer,
            commands::toggle_timer,
            commands::skip_phase,
            commands::reset_timer,
            commands::set_phase,
            commands::get_timer_state,
            commands::get_settings,
            commands::set_settings,
            commands::get_todos,
            commands::add_todo,
            commands::update_todo,
            commands::delete_todo,
            commands::set_todo_completed,
            commands::set_active_todo,
            commands::start_todo,
            commands::list_sessions,
            commands::session_count,
        ])
        .setup(|app| {
            // Open local SQLite database under the app data directory.
            let db_path = app
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?
                .join("pomodoro.db");
            let conn = db::open(&db_path).map_err(|e| e.to_string())?;

            app.manage(AppState {
                timer: Mutex::new(Timer::new()),
                settings: Mutex::new(Settings::default()),
                todos: Mutex::new(TodoState::default()),
                db: Mutex::new(conn),
                open_session: Mutex::new(None),
            });

            // Restore persisted settings.
            if let Ok(store) = app.store("settings.json") {
                if let Some(value) = store.get("settings") {
                    if let Ok(mut saved) = serde_json::from_value::<Settings>(value.clone()) {
                        saved.sanitize();
                        *app.state::<AppState>().settings.lock().unwrap() = saved;
                    }
                }
            }

            // Restore persisted todos.
            {
                let loaded = todos::load_from_store(app.handle());
                *app.state::<AppState>().todos.lock().unwrap() = loaded;
            }

            let _ = app.notification().request_permission();

            tray::setup(app.handle())?;

            let window = app.get_webview_window("main").expect("main window");

            // Frosted-glass background per platform.
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{
                    apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState,
                };
                let _ = apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::HudWindow,
                    Some(NSVisualEffectState::Active),
                    Some(20.0),
                );
            }
            #[cfg(target_os = "windows")]
            {
                use window_vibrancy::apply_acrylic;
                let _ = apply_acrylic(&window, Some((20, 20, 20, 125)));
            }

            spawn_tick_loop(app.handle().clone());

            Ok(())
        })
        .on_window_event(|window, event| {
            // Close button hides the window; the app lives on in the tray.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running pomodoro");
}

/// Authoritative 1s ticker. Emits `timer://tick` snapshots to the frontend
/// and `timer://phase-complete` (+ native notification) on phase rollover.
/// Also polls task due-date reminders every 15s when notifications are on.
fn spawn_tick_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        let mut last_status = String::new();
        let mut due_poll_counter: u8 = 0;

        loop {
            interval.tick().await;

            let state = app.state::<AppState>();
            let (snapshot, effect, notifications_on, settings_clone) = {
                let mut timer = state.timer.lock().unwrap();
                let settings = state.settings.lock().unwrap();
                let effect = timer.apply(Event::Tick, &settings, Instant::now());
                (
                    timer.snapshot(&settings, Instant::now()),
                    effect,
                    settings.notifications,
                    settings.clone(),
                )
            };

            tray::set_tray_title(&app, &snapshot);
            if snapshot.status != last_status {
                tray::set_tray_menu(&app, &snapshot);
                last_status = snapshot.status.clone();
            }

            let _ = app.emit("timer://tick", &snapshot);

            if let Some(Effect::PhaseCompleted {
                from,
                to,
                auto_started,
            }) = effect
            {
                {
                    let timer = state.timer.lock().unwrap();
                    sessions::on_phase_completed(
                        &app,
                        from,
                        auto_started,
                        &timer,
                        &settings_clone,
                    );
                }

                if notifications_on {
                    let (title, body) = match to {
                        Phase::Focus => ("Break over", "Time to focus."),
                        _ => ("Focus complete", "Take a break — you earned it."),
                    };
                    let _ = app.notification().builder().title(title).body(body).show();
                }
                let _ = app.emit(
                    "timer://phase-complete",
                    serde_json::json!({ "to": to.as_str() }),
                );
            }

            // Due-date reminders (every 15s). Flags only advance when
            // notifications are enabled so toggling on later still delivers.
            due_poll_counter = due_poll_counter.wrapping_add(1);
            if notifications_on && due_poll_counter % 15 == 0 {
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                let reminders = {
                    let mut todos = state.todos.lock().unwrap();
                    let r = todos.poll_due_reminders(now_ms);
                    if !r.is_empty() {
                        todos::persist_and_emit(&app, &todos);
                    }
                    r
                };
                for rem in reminders {
                    let _ = app
                        .notification()
                        .builder()
                        .title(&rem.title)
                        .body(&rem.body)
                        .show();
                }
            }
        }
    });
}
