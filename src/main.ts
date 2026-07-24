import { listen } from "@tauri-apps/api/event";
import { store } from "./state";
import { TimerView } from "./ui/timer-view";
import { Controls } from "./ui/controls";
import { Segments } from "./ui/segments";
import { SettingsPanel } from "./ui/settings";
import "./styles/tokens.css";
import "./styles/app.css";

const GEAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

/** iOS-style two-tone chime, synthesized — no audio asset needed. */
function chime(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const t0 = ctx.currentTime + 0.02;
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t0 + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  } catch {
    // Audio unavailable — the native notification still carries the alert.
  }
}

async function bootstrap(): Promise<void> {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div class="titlebar">
      <button class="gear-btn" aria-label="Settings">${GEAR_ICON}</button>
    </div>
    <div class="stage">
      <div class="ring-wrap phase-focus"></div>
      <div class="segments"></div>
      <div class="controls"></div>
    </div>
    <div class="sheet-root"></div>`;

  const view = new TimerView(app.querySelector(".ring-wrap")!);
  const segments = new Segments(app.querySelector(".segments")!);
  const controls = new Controls(app.querySelector(".controls")!);
  const panel = new SettingsPanel(app.querySelector(".sheet-root")!);

  app.querySelector(".gear-btn")!.addEventListener("click", () => panel.toggle());

  document.addEventListener("keydown", (event) => {
    if (event.key === " " && !panel.openState) {
      event.preventDefault();
      void store.cmd("toggle_timer");
    } else if (event.metaKey && event.key === ",") {
      event.preventDefault();
      panel.toggle();
    } else if (event.key === "Escape" && panel.openState) {
      panel.close();
    }
  });

  await listen("timer://phase-complete", () => {
    if (store.settings?.sound) chime();
  });

  function render(): void {
    if (!store.snapshot) return;
    view.update(store.snapshot);
    segments.update(store.snapshot);
    controls.update(store.snapshot);
    if (store.settings) panel.update(store.settings);
  }

  store.subscribe(render);
  await store.init();
  render();
}

void bootstrap();
