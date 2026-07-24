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

export interface Settings {
  focus_min: number;
  short_break_min: number;
  long_break_min: number;
  long_break_every: number;
  auto_start_breaks: boolean;
  auto_start_focus: boolean;
  sound: boolean;
  notifications: boolean;
}

type Listener = () => void;

class Store {
  snapshot: TimerSnapshot | null = null;
  settings: Settings | null = null;

  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  async init(): Promise<void> {
    const [snapshot, settings] = await Promise.all([
      invoke<TimerSnapshot>("get_timer_state"),
      invoke<Settings>("get_settings"),
    ]);
    this.snapshot = snapshot;
    this.settings = settings;

    await listen<TimerSnapshot>("timer://tick", (event) => {
      this.snapshot = event.payload;
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
    this.snapshot = await invoke<TimerSnapshot>("set_settings", {
      settings: this.settings,
    });
    this.emit();
  }
}

export const store = new Store();

export function formatTime(ms: number): string {
  const secs = Math.ceil(ms / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
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
