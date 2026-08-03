use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

const MS_HOUR: u64 = 60 * 60 * 1000;
const MS_DAY: u64 = 24 * MS_HOUR;

fn new_id() -> String {
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let n = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{ms}-{n}")
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Todo {
    pub id: String,
    pub title: String,
    pub completed: bool,
    pub pomodoros: u32,
    pub created_at: u64,
    /// Optional deadline as unix milliseconds.
    pub due_at: Option<u64>,
    /// Reminder flags for the current `due_at` value (reset when due changes).
    pub due_reminded_day: bool,
    pub due_reminded_hour: bool,
    pub due_reminded_at: bool,
}

impl Default for Todo {
    fn default() -> Self {
        Self {
            id: String::new(),
            title: String::new(),
            completed: false,
            pomodoros: 0,
            created_at: 0,
            due_at: None,
            due_reminded_day: false,
            due_reminded_hour: false,
            due_reminded_at: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DueReminder {
    pub title: String,
    pub body: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct TodoState {
    pub items: Vec<Todo>,
    pub active_id: Option<String>,
}

impl TodoState {
    pub fn add(&mut self, title: String) -> Result<&Todo, String> {
        let title = title.trim().to_string();
        if title.is_empty() {
            return Err("title cannot be empty".into());
        }
        let todo = Todo {
            id: new_id(),
            title,
            completed: false,
            pomodoros: 0,
            created_at: now_ms(),
            due_at: None,
            due_reminded_day: false,
            due_reminded_hour: false,
            due_reminded_at: false,
        };
        self.items.insert(0, todo);
        Ok(self.items.first().expect("just inserted"))
    }

    pub fn delete(&mut self, id: &str) {
        self.items.retain(|t| t.id != id);
        if self.active_id.as_deref() == Some(id) {
            self.active_id = None;
        }
    }

    pub fn set_completed(&mut self, id: &str, completed: bool) -> Result<(), String> {
        let todo = self
            .items
            .iter_mut()
            .find(|t| t.id == id)
            .ok_or_else(|| format!("todo not found: {id}"))?;
        todo.completed = completed;
        if completed && self.active_id.as_deref() == Some(id) {
            self.active_id = None;
        }
        Ok(())
    }

    pub fn set_active(&mut self, id: Option<String>) -> Result<(), String> {
        match &id {
            None => {
                self.active_id = None;
                Ok(())
            }
            Some(id) => {
                let todo = self
                    .items
                    .iter()
                    .find(|t| t.id == *id)
                    .ok_or_else(|| format!("todo not found: {id}"))?;
                if todo.completed {
                    return Err("cannot activate a completed task".into());
                }
                self.active_id = Some(id.clone());
                Ok(())
            }
        }
    }

    /// Replace title and due date for a task.
    ///
    /// `due_at: None` clears the deadline. Changing due (including clear)
    /// resets reminder flags for that task.
    pub fn update(
        &mut self,
        id: &str,
        title: String,
        due_at: Option<u64>,
    ) -> Result<(), String> {
        let next = title.trim().to_string();
        if next.is_empty() {
            return Err("title cannot be empty".into());
        }
        let todo = self
            .items
            .iter_mut()
            .find(|t| t.id == id)
            .ok_or_else(|| format!("todo not found: {id}"))?;

        todo.title = next;

        let changed = todo.due_at != due_at;
        todo.due_at = due_at;
        if changed {
            todo.due_reminded_day = false;
            todo.due_reminded_hour = false;
            todo.due_reminded_at = false;
        }

        Ok(())
    }

    /// Evaluate due reminders for incomplete tasks. Marks flags and returns
    /// notifications to show. Does nothing for completed tasks.
    pub fn poll_due_reminders(&mut self, now_ms: u64) -> Vec<DueReminder> {
        let mut out = Vec::new();

        for todo in self.items.iter_mut() {
            if todo.completed {
                continue;
            }
            let Some(due) = todo.due_at else {
                continue;
            };

            // At / past due (highest urgency).
            if now_ms >= due && !todo.due_reminded_at {
                todo.due_reminded_at = true;
                // Also mark earlier tiers so we don't fire them after the fact.
                todo.due_reminded_hour = true;
                todo.due_reminded_day = true;
                out.push(DueReminder {
                    title: "Task due".into(),
                    body: todo.title.clone(),
                });
                continue;
            }

            if now_ms >= due {
                continue;
            }

            // Within 1 hour of due.
            if now_ms + MS_HOUR >= due && !todo.due_reminded_hour {
                todo.due_reminded_hour = true;
                todo.due_reminded_day = true;
                out.push(DueReminder {
                    title: "Task due in 1 hour".into(),
                    body: todo.title.clone(),
                });
                continue;
            }

            // Within 24 hours of due.
            if now_ms + MS_DAY >= due && !todo.due_reminded_day {
                todo.due_reminded_day = true;
                out.push(DueReminder {
                    title: "Task due tomorrow".into(),
                    body: todo.title.clone(),
                });
            }
        }

        out
    }

    /// Credit one completed focus session to the active incomplete task.
    /// Returns true if a task was incremented.
    pub fn increment_active_pomodoro(&mut self) -> bool {
        let Some(id) = self.active_id.clone() else {
            return false;
        };
        if let Some(todo) = self.items.iter_mut().find(|t| t.id == id && !t.completed) {
            todo.pomodoros = todo.pomodoros.saturating_add(1);
            return true;
        }
        false
    }
}

/// Persist todos and notify the frontend.
pub fn persist_and_emit(app: &AppHandle, state: &TodoState) {
    if let Ok(store) = app.store("todos.json") {
        if let Ok(value) = serde_json::to_value(state) {
            store.set("todos".to_string(), value);
            let _ = store.save();
        }
    }
    let _ = app.emit("todos://changed", state);
}

pub fn load_from_store(app: &AppHandle) -> TodoState {
    if let Ok(store) = app.store("todos.json") {
        if let Some(value) = store.get("todos") {
            if let Ok(saved) = serde_json::from_value::<TodoState>(value.clone()) {
                return saved;
            }
        }
    }
    TodoState::default()
}

/// Snapshot helper used by commands that only touch todos.
pub fn with_todos_mut<F, R>(app: &AppHandle, f: F) -> R
where
    F: FnOnce(&mut TodoState) -> R,
{
    let state = app.state::<crate::AppState>();
    let mut todos = state.todos.lock().unwrap();
    let result = f(&mut todos);
    persist_and_emit(app, &todos);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_rejects_empty_title() {
        let mut s = TodoState::default();
        assert!(s.add("   ".into()).is_err());
        assert!(s.items.is_empty());
    }

    #[test]
    fn add_inserts_at_front() {
        let mut s = TodoState::default();
        s.add("first".into()).unwrap();
        s.add("second".into()).unwrap();
        assert_eq!(s.items[0].title, "second");
        assert_eq!(s.items[1].title, "first");
    }

    #[test]
    fn increment_only_active_incomplete() {
        let mut s = TodoState::default();
        s.add("A".into()).unwrap();
        s.add("B".into()).unwrap();
        let a_id = s.items[1].id.clone();
        let b_id = s.items[0].id.clone();

        assert!(!s.increment_active_pomodoro());

        s.set_active(Some(a_id.clone())).unwrap();
        assert!(s.increment_active_pomodoro());
        assert_eq!(s.items.iter().find(|t| t.id == a_id).unwrap().pomodoros, 1);
        assert_eq!(s.items.iter().find(|t| t.id == b_id).unwrap().pomodoros, 0);

        s.set_completed(&a_id, true).unwrap();
        assert!(s.active_id.is_none());
        assert!(!s.increment_active_pomodoro());
        assert_eq!(s.items.iter().find(|t| t.id == a_id).unwrap().pomodoros, 1);
    }

    #[test]
    fn delete_clears_active() {
        let mut s = TodoState::default();
        s.add("A".into()).unwrap();
        let id = s.items[0].id.clone();
        s.set_active(Some(id.clone())).unwrap();
        s.delete(&id);
        assert!(s.items.is_empty());
        assert!(s.active_id.is_none());
    }

    #[test]
    fn cannot_activate_completed() {
        let mut s = TodoState::default();
        s.add("A".into()).unwrap();
        let id = s.items[0].id.clone();
        s.set_completed(&id, true).unwrap();
        assert!(s.set_active(Some(id)).is_err());
    }

    #[test]
    fn update_renames_and_rejects_empty() {
        let mut s = TodoState::default();
        s.add("Old".into()).unwrap();
        let id = s.items[0].id.clone();
        s.update(&id, "  New  ".into(), None).unwrap();
        assert_eq!(s.items[0].title, "New");
        assert!(s.update(&id, "   ".into(), None).is_err());
        assert_eq!(s.items[0].title, "New");
    }

    #[test]
    fn update_sets_and_clears_due_resetting_flags() {
        let mut s = TodoState::default();
        s.add("A".into()).unwrap();
        let id = s.items[0].id.clone();
        s.update(&id, "A".into(), Some(1_000_000)).unwrap();
        assert_eq!(s.items[0].due_at, Some(1_000_000));
        s.items[0].due_reminded_day = true;
        s.items[0].due_reminded_hour = true;
        s.items[0].due_reminded_at = true;

        s.update(&id, "A".into(), Some(2_000_000)).unwrap();
        assert_eq!(s.items[0].due_at, Some(2_000_000));
        assert!(!s.items[0].due_reminded_day);
        assert!(!s.items[0].due_reminded_hour);
        assert!(!s.items[0].due_reminded_at);

        s.items[0].due_reminded_day = true;
        s.update(&id, "A".into(), None).unwrap();
        assert!(s.items[0].due_at.is_none());
        assert!(!s.items[0].due_reminded_day);
    }

    #[test]
    fn poll_due_reminders_tiers_and_no_double_fire() {
        let mut s = TodoState::default();
        s.add("Ship".into()).unwrap();
        let due = 200_000_000u64; // far above MS_DAY so subtractions don't overflow
        s.items[0].due_at = Some(due);

        // Far before: nothing.
        assert!(s.poll_due_reminders(due - MS_DAY - 1).is_empty());

        // Enter 24h window.
        let day = s.poll_due_reminders(due - MS_DAY);
        assert_eq!(day.len(), 1);
        assert_eq!(day[0].title, "Task due tomorrow");
        assert!(s.items[0].due_reminded_day);
        assert!(s.poll_due_reminders(due - MS_DAY + 1).is_empty());

        // Enter 1h window.
        let hour = s.poll_due_reminders(due - MS_HOUR);
        assert_eq!(hour.len(), 1);
        assert_eq!(hour[0].title, "Task due in 1 hour");
        assert!(s.items[0].due_reminded_hour);
        assert!(s.poll_due_reminders(due - MS_HOUR + 1).is_empty());

        // At due.
        let at = s.poll_due_reminders(due);
        assert_eq!(at.len(), 1);
        assert_eq!(at[0].title, "Task due");
        assert!(s.items[0].due_reminded_at);
        assert!(s.poll_due_reminders(due + 1).is_empty());
    }

    #[test]
    fn poll_due_skips_completed_and_jumps_to_due() {
        let mut s = TodoState::default();
        s.add("Done".into()).unwrap();
        s.add("Late".into()).unwrap();
        let done_id = s.items[1].id.clone();
        let late_id = s.items[0].id.clone();
        let due = 5_000_000u64;
        s.items.iter_mut().for_each(|t| t.due_at = Some(due));
        s.set_completed(&done_id, true).unwrap();

        // Past due: only incomplete fires, and at-due swallows earlier tiers.
        let r = s.poll_due_reminders(due + 100);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].body, "Late");
        let late = s.items.iter().find(|t| t.id == late_id).unwrap();
        assert!(late.due_reminded_at && late.due_reminded_hour && late.due_reminded_day);
        let done = s.items.iter().find(|t| t.id == done_id).unwrap();
        assert!(!done.due_reminded_at);
    }

    #[test]
    fn old_json_without_due_fields_deserializes() {
        let json = r#"{"items":[{"id":"1","title":"Legacy","completed":false,"pomodoros":2,"created_at":1}],"active_id":null}"#;
        let s: TodoState = serde_json::from_str(json).unwrap();
        assert_eq!(s.items.len(), 1);
        assert_eq!(s.items[0].title, "Legacy");
        assert!(s.items[0].due_at.is_none());
        assert!(!s.items[0].due_reminded_day);
    }
}
