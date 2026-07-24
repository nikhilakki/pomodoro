use crate::timer::{Event, Phase, Settings, TimerSnapshot};
use crate::AppState;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_store::StoreExt;

/// Applies an event to the timer, then syncs tray + frontend.
/// Shared by Tauri commands and tray menu handlers.
pub fn dispatch(app: &AppHandle, event: Event) -> TimerSnapshot {
    let state = app.state::<AppState>();
    let snapshot = {
        let mut timer = state.timer.lock().unwrap();
        let settings = state.settings.lock().unwrap();
        timer.apply(event, &settings, std::time::Instant::now());
        timer.snapshot(&settings, std::time::Instant::now())
    };
    crate::tray::sync_tray(app, &snapshot);
    let _ = app.emit("timer://tick", &snapshot);
    snapshot
}

#[tauri::command]
pub fn start_timer(app: AppHandle) -> TimerSnapshot {
    dispatch(&app, Event::Start)
}

#[tauri::command]
pub fn pause_timer(app: AppHandle) -> TimerSnapshot {
    dispatch(&app, Event::Pause)
}

#[tauri::command]
pub fn resume_timer(app: AppHandle) -> TimerSnapshot {
    dispatch(&app, Event::Resume)
}

#[tauri::command]
pub fn toggle_timer(app: AppHandle) -> TimerSnapshot {
    dispatch(&app, Event::Toggle)
}

#[tauri::command]
pub fn skip_phase(app: AppHandle) -> TimerSnapshot {
    dispatch(&app, Event::Skip)
}

#[tauri::command]
pub fn reset_timer(app: AppHandle) -> TimerSnapshot {
    dispatch(&app, Event::Reset)
}

#[tauri::command]
pub fn set_phase(app: AppHandle, phase: String) -> Result<TimerSnapshot, String> {
    let phase = Phase::from_str(&phase).ok_or_else(|| format!("invalid phase: {phase}"))?;
    Ok(dispatch(&app, Event::SetPhase(phase)))
}

#[tauri::command]
pub fn get_timer_state(state: State<'_, AppState>) -> TimerSnapshot {
    let timer = state.timer.lock().unwrap();
    let settings = state.settings.lock().unwrap();
    timer.snapshot(&settings, std::time::Instant::now())
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
pub fn set_settings(app: AppHandle, settings: Settings) -> TimerSnapshot {
    {
        let state = app.state::<AppState>();
        *state.settings.lock().unwrap() = settings.clone();
    }
    if let Ok(store) = app.store("settings.json") {
        if let Ok(value) = serde_json::to_value(&settings) {
            store.set("settings".to_string(), value);
            let _ = store.save();
        }
    }
    // Tick is a no-op unless a deadline already passed; it recomputes the
    // snapshot so idle timers pick up new durations immediately.
    dispatch(&app, Event::Tick)
}
