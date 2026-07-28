use crate::timer::Phase;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn new_id() -> String {
    let ms = now_ms();
    let n = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("ses-{ms}-{n}")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionOutcome {
    Completed,
    Skipped,
    Aborted,
}

impl SessionOutcome {
    pub fn as_str(self) -> &'static str {
        match self {
            SessionOutcome::Completed => "completed",
            SessionOutcome::Skipped => "skipped",
            SessionOutcome::Aborted => "aborted",
        }
    }
}

/// In-progress timer session waiting to be written when it ends.
#[derive(Debug, Clone)]
pub struct OpenSession {
    pub id: String,
    pub phase: Phase,
    pub started_at_ms: u64,
    pub planned_ms: u64,
    pub todo_id: Option<String>,
    pub todo_title: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionRecord {
    pub id: String,
    pub phase: String,
    pub outcome: String,
    pub todo_id: Option<String>,
    pub todo_title: Option<String>,
    pub started_at: u64,
    pub ended_at: u64,
    pub planned_ms: u64,
    pub elapsed_ms: u64,
}

pub fn open(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS sessions (
            id          TEXT PRIMARY KEY NOT NULL,
            phase       TEXT NOT NULL,
            outcome     TEXT NOT NULL,
            todo_id     TEXT,
            todo_title  TEXT,
            started_at  INTEGER NOT NULL,
            ended_at    INTEGER NOT NULL,
            planned_ms  INTEGER NOT NULL,
            elapsed_ms  INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON sessions(ended_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sessions_todo_id ON sessions(todo_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_phase ON sessions(phase);
        ",
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn insert_session(
    conn: &Connection,
    open: &OpenSession,
    outcome: SessionOutcome,
    ended_at_ms: u64,
    elapsed_ms: u64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO sessions
            (id, phase, outcome, todo_id, todo_title, started_at, ended_at, planned_ms, elapsed_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            open.id,
            open.phase.as_str(),
            outcome.as_str(),
            open.todo_id,
            open.todo_title,
            open.started_at_ms as i64,
            ended_at_ms as i64,
            open.planned_ms as i64,
            elapsed_ms as i64,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_sessions(conn: &Connection, limit: u32) -> Result<Vec<SessionRecord>, String> {
    let limit = limit.clamp(1, 500) as i64;
    let mut stmt = conn
        .prepare(
            "SELECT id, phase, outcome, todo_id, todo_title,
                    started_at, ended_at, planned_ms, elapsed_ms
             FROM sessions
             ORDER BY ended_at DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(SessionRecord {
                id: row.get(0)?,
                phase: row.get(1)?,
                outcome: row.get(2)?,
                todo_id: row.get(3)?,
                todo_title: row.get(4)?,
                started_at: row.get::<_, i64>(5)? as u64,
                ended_at: row.get::<_, i64>(6)? as u64,
                planned_ms: row.get::<_, i64>(7)? as u64,
                elapsed_ms: row.get::<_, i64>(8)? as u64,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn session_count(conn: &Connection) -> Result<u64, String> {
    conn.query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get::<_, i64>(0))
        .map(|n| n as u64)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::timer::Phase;

    fn mem_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE sessions (
                id TEXT PRIMARY KEY NOT NULL,
                phase TEXT NOT NULL,
                outcome TEXT NOT NULL,
                todo_id TEXT,
                todo_title TEXT,
                started_at INTEGER NOT NULL,
                ended_at INTEGER NOT NULL,
                planned_ms INTEGER NOT NULL,
                elapsed_ms INTEGER NOT NULL
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn insert_and_list_session_with_task() {
        let conn = mem_db();
        let open = OpenSession {
            id: "ses-1".into(),
            phase: Phase::Focus,
            started_at_ms: 1_000,
            planned_ms: 25 * 60 * 1000,
            todo_id: Some("todo-1".into()),
            todo_title: Some("Write docs".into()),
        };
        insert_session(&conn, &open, SessionOutcome::Completed, 2_000, 25 * 60 * 1000)
            .unwrap();

        let rows = list_sessions(&conn, 10).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].phase, "focus");
        assert_eq!(rows[0].outcome, "completed");
        assert_eq!(rows[0].todo_title.as_deref(), Some("Write docs"));
        assert_eq!(session_count(&conn).unwrap(), 1);
    }

    #[test]
    fn session_without_task() {
        let conn = mem_db();
        let open = OpenSession {
            id: "ses-2".into(),
            phase: Phase::ShortBreak,
            started_at_ms: 1_000,
            planned_ms: 5 * 60 * 1000,
            todo_id: None,
            todo_title: None,
        };
        insert_session(&conn, &open, SessionOutcome::Skipped, 1_500, 30_000).unwrap();
        let rows = list_sessions(&conn, 10).unwrap();
        assert_eq!(rows[0].todo_id, None);
        assert_eq!(rows[0].outcome, "skipped");
    }
}
