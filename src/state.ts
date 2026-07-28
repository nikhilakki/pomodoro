import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Phase = "focus" | "short_break" | "long_break";
export type Status = "idle" | "running" | "paused";

export interface TimerSnapshot {
  phase: Phase;
  status: Status;
  remaining_ms: number;
  total_ms: number;
  completed_focus: number;
  long_break_every: number;
}

/** Predefined accent keys for dial + main button. `"auto"` = by phase. */
export type AccentId =
  | "auto"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "mint"
  | "teal"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "pink"
  | "brown";

export const ACCENT_OPTIONS: ReadonlyArray<{
  id: AccentId;
  label: string;
}> = [
  { id: "auto", label: "Auto" },
  { id: "red", label: "Red" },
  { id: "orange", label: "Orange" },
  { id: "yellow", label: "Yellow" },
  { id: "green", label: "Green" },
  { id: "mint", label: "Mint" },
  { id: "teal", label: "Teal" },
  { id: "cyan", label: "Cyan" },
  { id: "blue", label: "Blue" },
  { id: "indigo", label: "Indigo" },
  { id: "purple", label: "Purple" },
  { id: "pink", label: "Pink" },
  { id: "brown", label: "Brown" },
];

export interface Settings {
  focus_min: number;
  short_break_min: number;
  long_break_min: number;
  long_break_every: number;
  auto_start_breaks: boolean;
  auto_start_focus: boolean;
  sound: boolean;
  notifications: boolean;
  accent: AccentId;
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  pomodoros: number;
  created_at: number;
}

export interface TodoState {
  items: Todo[];
  active_id: string | null;
}

export type SessionOutcome = "completed" | "skipped" | "aborted";

export interface SessionRecord {
  id: string;
  phase: Phase;
  outcome: SessionOutcome;
  todo_id: string | null;
  todo_title: string | null;
  started_at: number;
  ended_at: number;
  planned_ms: number;
  elapsed_ms: number;
}

type Listener = () => void;

class Store {
  snapshot: TimerSnapshot | null = null;
  settings: Settings | null = null;
  todos: Todo[] = [];
  activeTodoId: string | null = null;

  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  private applyTodos(state: TodoState): void {
    this.todos = state.items;
    this.activeTodoId = state.active_id;
  }

  activeTodo(): Todo | null {
    if (!this.activeTodoId) return null;
    return this.todos.find((t) => t.id === this.activeTodoId) ?? null;
  }

  async init(): Promise<void> {
    const [snapshot, settings, todos] = await Promise.all([
      invoke<TimerSnapshot>("get_timer_state"),
      invoke<Settings>("get_settings"),
      invoke<TodoState>("get_todos"),
    ]);
    this.snapshot = snapshot;
    this.settings = { ...settings, accent: settings.accent ?? "auto" };
    this.applyTodos(todos);
    this.applyTheme();

    await listen<TimerSnapshot>("timer://tick", (event) => {
      this.snapshot = event.payload;
      this.emit();
    });

    await listen<TodoState>("todos://changed", (event) => {
      this.applyTodos(event.payload);
      this.emit();
    });

    this.emit();
  }

  /** Fire a timer command; the Rust side returns the fresh snapshot. */
  async cmd(command: string): Promise<void> {
    this.snapshot = await invoke<TimerSnapshot>(command);
    this.emit();
  }

  async setPhase(phase: Phase): Promise<void> {
    this.snapshot = await invoke<TimerSnapshot>("set_phase", { phase });
    this.emit();
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    if (!this.settings) return;
    this.settings = { ...this.settings, ...patch };
    // Older builds may omit accent; keep UI safe.
    if (!this.settings.accent) this.settings.accent = "auto";
    this.snapshot = await invoke<TimerSnapshot>("set_settings", {
      settings: this.settings,
    });
    this.emit();
  }

  /** Apply accent + phase CSS vars so dial and main button stay in sync. */
  applyTheme(): void {
    const app = document.getElementById("app");
    if (!app) return;
    const accent = this.settings?.accent ?? "auto";
    const phase = this.snapshot?.phase ?? "focus";
    app.dataset.accent = accent;
    app.dataset.phase = phase;
  }

  async addTodo(title: string): Promise<void> {
    const state = await invoke<TodoState>("add_todo", { title });
    this.applyTodos(state);
    this.emit();
  }

  async deleteTodo(id: string): Promise<void> {
    const state = await invoke<TodoState>("delete_todo", { id });
    this.applyTodos(state);
    this.emit();
  }

  async setTodoCompleted(id: string, completed: boolean): Promise<void> {
    const state = await invoke<TodoState>("set_todo_completed", {
      id,
      completed,
    });
    this.applyTodos(state);
    this.emit();
  }

  async setActiveTodo(id: string | null): Promise<void> {
    const state = await invoke<TodoState>("set_active_todo", { id });
    this.applyTodos(state);
    this.emit();
  }

  async startTodo(id: string): Promise<void> {
    this.snapshot = await invoke<TimerSnapshot>("start_todo", { id });
    // active_id is updated via todos://changed from the command path,
    // but apply optimistically if the event races
    this.activeTodoId = id;
    this.emit();
  }

  async listSessions(limit = 50): Promise<SessionRecord[]> {
    return invoke<SessionRecord[]>("list_sessions", { limit });
  }

  async sessionCount(): Promise<number> {
    return invoke<number>("session_count");
  }
}

export const store = new Store();

export function formatTime(ms: number): string {
  const secs = Math.ceil(ms / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

/** Compact duration for history rows, e.g. "25m" or "4m 12s". */
export function formatElapsed(ms: number): string {
  const secs = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  if (mm === 0) return `${ss}s`;
  if (ss === 0) return `${mm}m`;
  return `${mm}m ${ss}s`;
}

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "focus":
      return "Focus";
    case "short_break":
      return "Short Break";
    case "long_break":
      return "Long Break";
  }
}
