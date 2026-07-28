import { listen } from "@tauri-apps/api/event";
import { store } from "./state";
import { TimerView } from "./ui/timer-view";
import { Controls } from "./ui/controls";
import { Segments } from "./ui/segments";
import { SettingsPanel } from "./ui/settings";
import { TodosPanel } from "./ui/todos";
import { ActiveTaskChip } from "./ui/active-task";
import "./styles/tokens.css";
import "./styles/app.css";

const GEAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

const LIST_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>`;

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
      <div class="titlebar-actions">
        <button class="gear-btn list-btn" aria-label="Tasks">${LIST_ICON}</button>
        <button class="gear-btn settings-btn" aria-label="Settings">${GEAR_ICON}</button>
      </div>
    </div>
    <div class="stage">
      <div class="ring-wrap phase-focus"></div>
      <div class="active-task-host"></div>
      <div class="segments"></div>
      <div class="controls"></div>
    </div>
    <div class="sheet-root settings-sheet-root"></div>
    <div class="sheet-root todos-sheet-root-host"></div>`;

  const view = new TimerView(app.querySelector(".ring-wrap")!);
  const segments = new Segments(app.querySelector(".segments")!);
  const controls = new Controls(app.querySelector(".controls")!);
  const panel = new SettingsPanel(app.querySelector(".settings-sheet-root")!);
  const todosPanel = new TodosPanel(app.querySelector(".todos-sheet-root-host")!);

  const openTodos = () => {
    if (panel.openState) panel.close();
    todosPanel.open();
  };
  const activeChip = new ActiveTaskChip(
    app.querySelector(".active-task-host")!,
    openTodos,
  );

  app.querySelector(".settings-btn")!.addEventListener("click", () => {
    if (todosPanel.openState) todosPanel.close();
    panel.toggle();
  });
  app.querySelector(".list-btn")!.addEventListener("click", () => {
    if (panel.openState) panel.close();
    todosPanel.toggle();
  });

  document.addEventListener("keydown", (event) => {
    const confirmOpen = !!document.querySelector(".confirm-root.open");
    if (confirmOpen) return;

    if (event.key === " " && !panel.openState && !todosPanel.openState) {
      event.preventDefault();
      void store.cmd("toggle_timer");
    } else if (event.metaKey && event.key === ",") {
      event.preventDefault();
      if (todosPanel.openState) todosPanel.close();
      panel.toggle();
    } else if (event.key === "Escape") {
      if (panel.openState) panel.close();
      if (todosPanel.openState) todosPanel.close();
    }
  });

  await listen("timer://phase-complete", () => {
    if (store.settings?.sound) chime();
  });

  function render(): void {
    if (!store.snapshot) return;
    store.applyTheme();
    view.update(store.snapshot);
    segments.update(store.snapshot);
    controls.update(store.snapshot);
    if (store.settings) panel.update(store.settings);
    todosPanel.update(store.todos, store.activeTodoId);
    activeChip.update(store.activeTodo());
  }

  store.subscribe(render);
  await store.init();
  render();
}

void bootstrap();
