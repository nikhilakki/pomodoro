mod commands;
mod timer;
mod tray;

use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;
use timer::{Effect, Event, Phase, Settings, Timer};

pub struct AppState {
    pub timer: Mutex<Timer>,
    pub settings: Mutex<Settings>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            timer: Mutex::new(Timer::new()),
            settings: Mutex::new(Settings::default()),
        })
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
        ])
        .setup(|app| {
            // Restore persisted settings.
            if let Ok(store) = app.store("settings.json") {
                if let Some(value) = store.get("settings") {
                    if let Ok(saved) = serde_json::from_value::<Settings>(value.clone()) {
                        *app.state::<AppState>().settings.lock().unwrap() = saved;
                    }
                }
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
fn spawn_tick_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        let mut last_status = String::new();

        loop {
            interval.tick().await;

            let state = app.state::<AppState>();
            let (snapshot, effect, notifications_on) = {
                let mut timer = state.timer.lock().unwrap();
                let settings = state.settings.lock().unwrap();
                let effect = timer.apply(Event::Tick, &settings, Instant::now());
                (
                    timer.snapshot(&settings, Instant::now()),
                    effect,
                    settings.notifications,
                )
            };

            tray::set_tray_title(&app, &snapshot);
            if snapshot.status != last_status {
                tray::set_tray_menu(&app, &snapshot);
                last_status = snapshot.status.clone();
            }

            let _ = app.emit("timer://tick", &snapshot);

            if let Some(Effect::PhaseCompleted { to, .. }) = effect {
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
        }
    });
}
