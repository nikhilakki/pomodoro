use crate::db::{self, SessionRecord};
use crate::timer::{Event, Phase, Settings, TimerSnapshot};
use crate::todos::{self, TodoState};
use crate::{sessions, AppState};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_store::StoreExt;

/// Applies an event to the timer, then syncs tray + frontend + session log.
/// Shared by Tauri commands and tray menu handlers.
pub fn dispatch(app: &AppHandle, event: Event) -> TimerSnapshot {
    let state = app.state::<AppState>();

    let (pre_status, pre_remaining_ms, snapshot, todos_snapshot, settings_snapshot) = {
        let mut timer = state.timer.lock().unwrap();
        let settings = state.settings.lock().unwrap();
        let todos = state.todos.lock().unwrap();
        let now = std::time::Instant::now();
        let pre_status = timer.status;
        let pre_remaining_ms = timer.remaining(&settings, now).as_millis() as u64;

        timer.apply(event, &settings, now);
        let snapshot = timer.snapshot(&settings, std::time::Instant::now());

        // Clone pieces needed after releasing locks for session sync.
        let todos_snapshot = todos.clone();
        let settings_snapshot = settings.clone();
        (
            pre_status,
            pre_remaining_ms,
            snapshot,
            todos_snapshot,
            settings_snapshot,
        )
    };

    // Re-lock timer briefly for session bookkeeping against post-state.
    {
        let timer = state.timer.lock().unwrap();
        sessions::sync_after_command(
            app,
            pre_status,
            pre_remaining_ms,
            event,
            &timer,
            &settings_snapshot,
            &todos_snapshot,
        );
    }

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
    let mut settings = settings;
    settings.sanitize();
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

// ── Todos ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_todos(state: State<'_, AppState>) -> TodoState {
    state.todos.lock().unwrap().clone()
}

#[tauri::command]
pub fn add_todo(app: AppHandle, title: String) -> Result<TodoState, String> {
    todos::with_todos_mut(&app, |todos| {
        todos.add(title)?;
        Ok(todos.clone())
    })
}

#[tauri::command]
pub fn delete_todo(app: AppHandle, id: String) -> TodoState {
    todos::with_todos_mut(&app, |todos| {
        todos.delete(&id);
        todos.clone()
    })
}

#[tauri::command]
pub fn set_todo_completed(
    app: AppHandle,
    id: String,
    completed: bool,
) -> Result<TodoState, String> {
    todos::with_todos_mut(&app, |todos| {
        todos.set_completed(&id, completed)?;
        Ok(todos.clone())
    })
}

#[tauri::command]
pub fn set_active_todo(app: AppHandle, id: Option<String>) -> Result<TodoState, String> {
    todos::with_todos_mut(&app, |todos| {
        todos.set_active(id)?;
        Ok(todos.clone())
    })
}

/// Bind a task as active and start a focus session for it.
/// If already mid-focus, only the active binding switches (timer continues).
/// If on a break / other phase, switches to Focus and starts.
#[tauri::command]
pub fn start_todo(app: AppHandle, id: String) -> Result<TimerSnapshot, String> {
    {
        let state = app.state::<AppState>();
        let mut todos = state.todos.lock().unwrap();
        todos.set_active(Some(id))?;
        todos::persist_and_emit(&app, &todos);
    }

    let state = app.state::<AppState>();
    let (phase, status) = {
        let timer = state.timer.lock().unwrap();
        (timer.phase, timer.status.as_str().to_string())
    };

    if phase != Phase::Focus {
        dispatch(&app, Event::SetPhase(Phase::Focus));
        Ok(dispatch(&app, Event::Start))
    } else if status == "idle" {
        Ok(dispatch(&app, Event::Start))
    } else {
        // running or paused — keep the clock, only binding changed.
        // Refresh todo metadata on the open session so history reflects the new task.
        {
            let todos = state.todos.lock().unwrap();
            let mut open = state.open_session.lock().unwrap();
            if let Some(ref mut s) = *open {
                if s.phase == Phase::Focus {
                    let (todo_id, todo_title) = sessions::active_todo_meta(&todos);
                    s.todo_id = todo_id;
                    s.todo_title = todo_title;
                }
            }
        }
        let timer = state.timer.lock().unwrap();
        let settings = state.settings.lock().unwrap();
        Ok(timer.snapshot(&settings, std::time::Instant::now()))
    }
}

// ── Session history ────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_sessions(state: State<'_, AppState>, limit: Option<u32>) -> Result<Vec<SessionRecord>, String> {
    let db = state.db.lock().unwrap();
    db::list_sessions(&db, limit.unwrap_or(50))
}

#[tauri::command]
pub fn session_count(state: State<'_, AppState>) -> Result<u64, String> {
    let db = state.db.lock().unwrap();
    db::session_count(&db)
}
