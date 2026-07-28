import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ACCENT_OPTIONS,
  AccentId,
  formatElapsed,
  phaseLabel,
  SessionRecord,
  Settings,
  store,
} from "../state";

const LINKS = {
  github: "https://github.com/nikhilakki",
  x: "https://x.com/nik_akki",
};

interface StepperDef {
  key: "focus_min" | "short_break_min" | "long_break_min" | "long_break_every";
  label: string;
  min: number;
  max: number;
  step: number;
}

interface ToggleDef {
  key: "auto_start_breaks" | "auto_start_focus" | "sound" | "notifications";
  label: string;
}

const STEPPERS: StepperDef[] = [
  { key: "focus_min", label: "Focus duration", min: 5, max: 90, step: 5 },
  { key: "short_break_min", label: "Short break", min: 1, max: 30, step: 1 },
  { key: "long_break_min", label: "Long break", min: 5, max: 60, step: 5 },
  { key: "long_break_every", label: "Long break every", min: 2, max: 8, step: 1 },
];

const BEHAVIOR_TOGGLES: ToggleDef[] = [
  { key: "auto_start_breaks", label: "Auto-start breaks" },
  { key: "auto_start_focus", label: "Auto-start focus" },
];

const FEEDBACK_TOGGLES: ToggleDef[] = [
  { key: "sound", label: "Completion chime" },
  { key: "notifications", label: "Notifications" },
];

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "completed":
      return "Done";
    case "skipped":
      return "Skipped";
    case "aborted":
      return "Stopped";
    default:
      return outcome;
  }
}

function formatWhen(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return time;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${time}`;
}

function sessionRow(s: SessionRecord): string {
  const task =
    s.todo_title?.trim() ||
    (s.phase === "focus" ? "No task" : "—");
  const phase = phaseLabel(s.phase as "focus" | "short_break" | "long_break");
  return `
    <div class="history-row">
      <div class="history-main">
        <span class="history-phase">${phase}</span>
        <span class="history-task"></span>
      </div>
      <div class="history-meta">
        <span class="history-when">${formatWhen(s.ended_at)}</span>
        <span class="history-stats">${formatElapsed(s.elapsed_ms)} · ${outcomeLabel(s.outcome)}</span>
      </div>
    </div>`.replace(
    // title set via textContent after insert for safety — placeholder
    '<span class="history-task"></span>',
    `<span class="history-task">${escapeHtml(task)}</span>`,
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class SettingsPanel {
  private rootEl: HTMLElement;
  private isOpen = false;
  private historyEl: HTMLElement | null = null;
  private historyCountEl: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.rootEl = root;
    this.rootEl.className = "sheet-root";
    this.render();

    this.rootEl
      .querySelector(".sheet-scrim")!
      .addEventListener("click", () => this.close());
    this.rootEl
      .querySelector(".done-btn")!
      .addEventListener("click", () => this.close());
  }

  private render(): void {
    const stepperRows = STEPPERS.map(
      (s) => `
      <div class="row">
        <span>${s.label}</span>
        <div class="stepper" data-key="${s.key}" data-min="${s.min}" data-max="${s.max}" data-step="${s.step}">
          <button data-dir="-1" aria-label="Decrease">−</button>
          <span class="step-val"></span>
          <button data-dir="1" aria-label="Increase">+</button>
        </div>
      </div>`,
    ).join("");

    const toggleRows = (defs: ToggleDef[]) =>
      defs
        .map(
          (t) => `
      <div class="row">
        <span>${t.label}</span>
        <button class="toggle" data-key="${t.key}" role="switch" aria-checked="false" aria-label="${t.label}"></button>
      </div>`,
        )
        .join("");

    this.rootEl.innerHTML = `
      <div class="sheet-scrim"></div>
      <div class="sheet">
        <div class="sheet-grabber"></div>
        <div class="sheet-nav">
          <span class="sheet-title">Settings</span>
          <button class="done-btn">Done</button>
        </div>
        <div class="sheet-scroll">
          <div class="group-label">Durations</div>
          <div class="group">${stepperRows}</div>
          <div class="group-label">Behavior</div>
          <div class="group">${toggleRows(BEHAVIOR_TOGGLES)}</div>
          <div class="group-label">Feedback</div>
          <div class="group">${toggleRows(FEEDBACK_TOGGLES)}</div>
          <div class="group-label">Appearance</div>
          <div class="group">
            <div class="accent-row">
              <span>Accent color</span>
              <div class="accent-swatches" role="radiogroup" aria-label="Accent color">
                ${ACCENT_OPTIONS.map(
                  (a) => `
                  <button type="button" class="accent-swatch" data-accent="${a.id}"
                    role="radio" aria-checked="false" title="${a.label}" aria-label="${a.label}"></button>`,
                ).join("")}
              </div>
              <div class="accent-hint">Colors the progress dial and the start/pause button. Auto follows Focus / Short / Long.</div>
            </div>
          </div>
          <div class="group-label">Session history <span class="history-count" id="history-count"></span></div>
          <div class="group history-group" id="history-list">
            <div class="history-empty">Loading…</div>
          </div>
          <div class="group-label">About</div>
          <div class="group">
            <div class="row">
              <span>Version</span>
              <span class="row-value" id="about-version">—</span>
            </div>
            <div class="row row-link" data-url="${LINKS.github}">
              <span>License</span>
              <span class="row-value">MIT <span class="chevron">›</span></span>
            </div>
            <div class="row row-link" data-url="${LINKS.github}">
              <span>GitHub</span>
              <span class="row-value">@nikhilakki <span class="chevron">›</span></span>
            </div>
            <div class="row row-link" data-url="${LINKS.x}">
              <span>X (Twitter)</span>
              <span class="row-value">@nik_akki <span class="chevron">›</span></span>
            </div>
          </div>
          <div class="about-footer">Made with Tauri &amp; Rust</div>
        </div>
      </div>`;

    this.historyEl = this.rootEl.querySelector("#history-list");
    this.historyCountEl = this.rootEl.querySelector("#history-count");

    getVersion()
      .then((v) => {
        const el = this.rootEl.querySelector("#about-version");
        if (el) el.textContent = v;
      })
      .catch(() => {});

    this.rootEl.querySelectorAll<HTMLElement>(".row-link").forEach((el) => {
      el.addEventListener("click", () => {
        const url = el.dataset.url;
        if (url) void openUrl(url);
      });
    });

    this.rootEl.querySelectorAll<HTMLElement>(".stepper").forEach((el) => {
      const key = el.dataset.key as StepperDef["key"];
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      const step = Number(el.dataset.step);
      el.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          const current = store.settings?.[key] ?? min;
          const next = Math.min(max, Math.max(min, current + Number(btn.dataset.dir) * step));
          if (next !== current) {
            void store.updateSettings({ [key]: next });
          }
        });
      });
    });

    this.rootEl.querySelectorAll<HTMLButtonElement>(".toggle").forEach((el) => {
      el.addEventListener("click", () => {
        const key = el.dataset.key as ToggleDef["key"];
        const current = store.settings?.[key] ?? false;
        void store.updateSettings({ [key]: !current });
      });
    });

    this.rootEl.querySelectorAll<HTMLButtonElement>(".accent-swatch").forEach((el) => {
      el.addEventListener("click", () => {
        const accent = el.dataset.accent as AccentId;
        if (!accent || store.settings?.accent === accent) return;
        void store.updateSettings({ accent });
      });
    });
  }

  private async refreshHistory(): Promise<void> {
    if (!this.historyEl) return;
    try {
      const [sessions, count] = await Promise.all([
        store.listSessions(40),
        store.sessionCount(),
      ]);
      if (this.historyCountEl) {
        this.historyCountEl.textContent = count > 0 ? `(${count})` : "";
      }
      if (sessions.length === 0) {
        this.historyEl.innerHTML =
          `<div class="history-empty">Completed, skipped, and stopped sessions are saved here with any linked task.</div>`;
        return;
      }
      this.historyEl.innerHTML = sessions.map(sessionRow).join("");
    } catch {
      this.historyEl.innerHTML =
        `<div class="history-empty">Could not load session history.</div>`;
    }
  }

  open(): void {
    this.isOpen = true;
    this.rootEl.classList.add("open");
    void this.refreshHistory();
  }

  close(): void {
    this.isOpen = false;
    this.rootEl.classList.remove("open");
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  get openState(): boolean {
    return this.isOpen;
  }

  update(settings: Settings): void {
    this.rootEl.querySelectorAll<HTMLElement>(".stepper").forEach((el) => {
      const key = el.dataset.key as StepperDef["key"];
      const value = settings[key];
      el.querySelector(".step-val")!.textContent = String(value);
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      el.querySelector<HTMLButtonElement>('[data-dir="-1"]')!.disabled = value <= min;
      el.querySelector<HTMLButtonElement>('[data-dir="1"]')!.disabled = value >= max;
    });
    this.rootEl.querySelectorAll<HTMLButtonElement>(".toggle").forEach((el) => {
      const key = el.dataset.key as ToggleDef["key"];
      const on = settings[key];
      el.classList.toggle("on", on);
      el.setAttribute("aria-checked", String(on));
    });

    const accent = settings.accent ?? "auto";
    this.rootEl.querySelectorAll<HTMLButtonElement>(".accent-swatch").forEach((el) => {
      const selected = el.dataset.accent === accent;
      el.classList.toggle("selected", selected);
      el.setAttribute("aria-checked", String(selected));
    });
  }
}
