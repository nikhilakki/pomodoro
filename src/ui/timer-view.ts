import { formatTime, phaseLabel, TimerSnapshot } from "../state";

const R = 98;
const CIRCUMFERENCE = 2 * Math.PI * R;

export class TimerView {
  private root: HTMLElement;
  private progressEl: SVGCircleElement;
  private timeEl: HTMLElement;
  private labelEl: HTMLElement;
  private dotsEl: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <svg class="ring" width="228" height="228" viewBox="0 0 228 228">
        <circle class="ring-track" cx="114" cy="114" r="${R}"></circle>
        <circle class="ring-progress" cx="114" cy="114" r="${R}"
          stroke-dasharray="${CIRCUMFERENCE}"
          stroke-dashoffset="0"></circle>
      </svg>
      <div class="ring-center">
        <div class="phase-label"></div>
        <div class="time"></div>
        <div class="cycle-dots"></div>
      </div>`;
    this.progressEl = root.querySelector(".ring-progress")!;
    this.timeEl = root.querySelector(".time")!;
    this.labelEl = root.querySelector(".phase-label")!;
    this.dotsEl = root.querySelector(".cycle-dots")!;
  }

  update(snapshot: TimerSnapshot): void {
    this.timeEl.textContent = formatTime(snapshot.remaining_ms);
    this.labelEl.textContent = phaseLabel(snapshot.phase);

    const progress =
      snapshot.total_ms > 0 ? snapshot.remaining_ms / snapshot.total_ms : 0;
    this.progressEl.style.strokeDashoffset = String(
      CIRCUMFERENCE * (1 - progress),
    );

    const total = Math.max(1, snapshot.long_break_every);
    const done = snapshot.completed_focus % total;
    this.dotsEl.innerHTML = Array.from({ length: total }, (_, i) => {
      const filled =
        i < done || (snapshot.phase === "long_break" && snapshot.completed_focus > 0);
      return `<i class="${filled ? "done" : ""}"></i>`;
    }).join("");

    this.root.className = `ring-wrap phase-${snapshot.phase}`;
  }
}
