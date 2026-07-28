import { Phase, store, TimerSnapshot } from "../state";
import { confirmDialog } from "./confirm";

const SEGMENTS: Array<{ phase: Phase; label: string }> = [
  { phase: "focus", label: "Focus" },
  { phase: "short_break", label: "Short" },
  { phase: "long_break", label: "Long" },
];

const PHASE_NAME: Record<Phase, string> = {
  focus: "Focus",
  short_break: "Short Break",
  long_break: "Long Break",
};

export class Segments {
  private buttons: HTMLButtonElement[] = [];

  constructor(root: HTMLElement) {
    this.buttons = SEGMENTS.map(({ phase, label }) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.dataset.phase = phase;
      btn.addEventListener("click", () => {
        void this.onSelect(phase);
      });
      root.appendChild(btn);
      return btn;
    });
  }

  private async onSelect(phase: Phase): Promise<void> {
    const snap = store.snapshot;
    if (!snap || snap.phase === phase) return;

    const inProgress = snap.status === "running" || snap.status === "paused";
    if (inProgress) {
      const ok = await confirmDialog({
        title: "Switch mode?",
        message: `Your ${PHASE_NAME[snap.phase]} timer is still going. Switching to ${PHASE_NAME[phase]} will reset the current countdown.`,
        confirmLabel: "Switch",
        cancelLabel: "Keep going",
        destructive: true,
      });
      if (!ok) return;
    }

    await store.setPhase(phase);
  }

  update(snapshot: TimerSnapshot): void {
    for (const btn of this.buttons) {
      btn.classList.toggle("active", btn.dataset.phase === snapshot.phase);
    }
  }
}
