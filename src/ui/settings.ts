import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Settings, store } from "../state";

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

export class SettingsPanel {
  private rootEl: HTMLElement;
  private isOpen = false;

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
  }

  open(): void {
    this.isOpen = true;
    this.rootEl.classList.add("open");
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
  }
}
