import { store, TimerSnapshot } from "../state";

const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.7v10.6c0 .8.9 1.3 1.6.9l8.3-5.3c.6-.4.6-1.4 0-1.8l-8.3-5.3c-.7-.4-1.6.1-1.6.9z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5.5" width="3.6" height="13" rx="1.2"/><rect x="13.9" y="5.5" width="3.6" height="13" rx="1.2"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V2.8c0-.5-.6-.8-1-.5L7.4 5.4c-.4.3-.4.9 0 1.2L11 9.7c.4.3 1 0 1-.5V7a5 5 0 1 1-5 5c0-.6-.4-1-1-1s-1 .4-1 1a7 7 0 1 0 7-7z"/></svg>`,
  skip: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 6.4v11.2c0 .8.9 1.3 1.6.9l7-5.6c.6-.4.6-1.4 0-1.8l-7-5.6c-.7-.5-1.6 0-1.6.9z"/><rect x="15.8" y="5.8" width="2.6" height="12.4" rx="1.1"/></svg>`,
};

export class Controls {
  private toggleBtn: HTMLButtonElement;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <button class="btn-icon" data-action="reset" title="Reset cycle">${ICONS.reset}</button>
      <button class="btn-main" data-action="toggle" title="Start / Pause">${ICONS.play}</button>
      <button class="btn-icon" data-action="skip" title="Skip phase">${ICONS.skip}</button>`;

    this.toggleBtn = root.querySelector('[data-action="toggle"]')!;

    root.querySelector('[data-action="reset"]')!.addEventListener("click", () => {
      void store.cmd("reset_timer");
    });
    this.toggleBtn.addEventListener("click", () => {
      void store.cmd("toggle_timer");
    });
    root.querySelector('[data-action="skip"]')!.addEventListener("click", () => {
      void store.cmd("skip_phase");
    });
  }

  update(snapshot: TimerSnapshot): void {
    this.toggleBtn.innerHTML =
      snapshot.status === "running" ? ICONS.pause : ICONS.play;
  }
}
