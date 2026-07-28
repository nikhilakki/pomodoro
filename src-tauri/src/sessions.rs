//! Tracks open timer sessions and persists them to SQLite when they end.

use crate::db::{self, OpenSession, SessionOutcome};
use crate::timer::{Event, Phase, Settings, Status, Timer};
use crate::todos::TodoState;
use crate::AppState;
use rusqlite::Connection;
use tauri::{AppHandle, Manager};

/// Snapshot of the active todo for denormalized session rows.
pub fn active_todo_meta(todos: &TodoState) -> (Option<String>, Option<String>) {
    match &todos.active_id {
        Some(id) => {
            if let Some(t) = todos.items.iter().find(|t| t.id == *id) {
                (Some(t.id.clone()), Some(t.title.clone()))
            } else {
                (Some(id.clone()), None)
            }
        }
        None => (None, None),
    }
}

fn planned_ms_for(phase: Phase, settings: &Settings) -> u64 {
    let mins = match phase {
        Phase::Focus => settings.focus_min,
        Phase::ShortBreak => settings.short_break_min,
        Phase::LongBreak => settings.long_break_min,
    };
    u64::from(mins.max(1)) * 60 * 1000
}

pub fn begin_session(
    open: &mut Option<OpenSession>,
    phase: Phase,
    settings: &Settings,
    todos: &TodoState,
) {
    let (todo_id, todo_title) = if phase == Phase::Focus {
        active_todo_meta(todos)
    } else {
        (None, None)
    };
    *open = Some(OpenSession {
        id: db::new_id(),
        phase,
        started_at_ms: db::now_ms(),
        planned_ms: planned_ms_for(phase, settings),
        todo_id,
        todo_title,
    });
}

/// Close the open session (if any) and write it to the DB.
pub fn end_session(
    conn: &Connection,
    open: &mut Option<OpenSession>,
    outcome: SessionOutcome,
    remaining_ms: u64,
) {
    let Some(session) = open.take() else {
        return;
    };
    let elapsed = session.planned_ms.saturating_sub(remaining_ms);
    let ended = db::now_ms();
    if let Err(e) = db::insert_session(conn, &session, outcome, ended, elapsed) {
        eprintln!("pomodoro: failed to persist session: {e}");
    }
}

/// After a non-tick timer command, open/close sessions.
pub fn sync_after_command(
    app: &AppHandle,
    pre_status: Status,
    pre_remaining_ms: u64,
    event: Event,
    timer: &Timer,
    settings: &Settings,
    todos: &TodoState,
) {
    let state = app.state::<AppState>();
    let mut open = state.open_session.lock().unwrap();
    let db = state.db.lock().unwrap();

    match event {
        Event::Start => {
            if matches!(pre_status, Status::Idle)
                && matches!(timer.status, Status::Running { .. })
            {
                begin_session(&mut open, timer.phase, settings, todos);
            }
        }
        Event::Toggle => {
            if matches!(pre_status, Status::Idle)
                && matches!(timer.status, Status::Running { .. })
            {
                begin_session(&mut open, timer.phase, settings, todos);
            }
        }
        Event::Skip => {
            end_session(&db, &mut open, SessionOutcome::Skipped, pre_remaining_ms);
        }
        Event::Reset => {
            end_session(&db, &mut open, SessionOutcome::Aborted, pre_remaining_ms);
        }
        Event::SetPhase(_) => {
            if !matches!(pre_status, Status::Idle) {
                end_session(&db, &mut open, SessionOutcome::Aborted, pre_remaining_ms);
            }
        }
        Event::Pause | Event::Resume | Event::Tick => {}
    }
}

/// Natural phase completion from the tick loop.
pub fn on_phase_completed(
    app: &AppHandle,
    from: Phase,
    auto_started: bool,
    timer: &Timer,
    settings: &Settings,
) {
    let state = app.state::<AppState>();

    {
        let mut open = state.open_session.lock().unwrap();
        let db = state.db.lock().unwrap();
        end_session(&db, &mut open, SessionOutcome::Completed, 0);
    }

    if from == Phase::Focus {
        let mut todos = state.todos.lock().unwrap();
        if todos.increment_active_pomodoro() {
            crate::todos::persist_and_emit(app, &todos);
        }
    }

    if auto_started && matches!(timer.status, Status::Running { .. }) {
        let todos = state.todos.lock().unwrap();
        let mut open = state.open_session.lock().unwrap();
        begin_session(&mut open, timer.phase, settings, &todos);
    }
}
