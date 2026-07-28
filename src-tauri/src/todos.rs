use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

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
pub struct Todo {
    pub id: String,
    pub title: String,
    pub completed: bool,
    pub pomodoros: u32,
    pub created_at: u64,
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
}
