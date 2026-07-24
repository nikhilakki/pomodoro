import { Phase, store, TimerSnapshot } from "../state";

const SEGMENTS: Array<{ phase: Phase; label: string }> = [
  { phase: "focus", label: "Focus" },
  { phase: "short_break", label: "Short" },
  { phase: "long_break", label: "Long" },
];

export class Segments {
  private buttons: HTMLButtonElement[] = [];

  constructor(root: HTMLElement) {
    this.buttons = SEGMENTS.map(({ phase, label }) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.dataset.phase = phase;
      btn.addEventListener("click", () => {
        if (store.snapshot?.phase !== phase) {
          void store.setPhase(phase);
        }
      });
      root.appendChild(btn);
      return btn;
    });
  }

  update(snapshot: TimerSnapshot): void {
    for (const btn of this.buttons) {
      btn.classList.toggle("active", btn.dataset.phase === snapshot.phase);
    }
  }
}
