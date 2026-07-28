import {
  formatElapsed,
  phaseLabel,
  SessionRecord,
  store,
} from "../state";

type DayKey = string; // YYYY-MM-DD local

interface DayBucket {
  key: DayKey;
  label: string;
  short: string;
  focusCompleted: number;
  focusMs: number;
  total: number;
}

interface Summary {
  focusCompleted: number;
  focusMs: number;
  weekFocus: number;
  weekMs: number;
  total: number;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function localDayKey(ms: number): DayKey {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatFocusHours(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

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
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayHeading(key: DayKey, todayKey: DayKey, yesterdayKey: DayKey): string {
  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function summarize(sessions: SessionRecord[]): Summary {
  const today = startOfLocalDay(new Date());
  const weekStart = addDays(today, -6);
  const weekStartMs = weekStart.getTime();

  let focusCompleted = 0;
  let focusMs = 0;
  let weekFocus = 0;
  let weekMs = 0;

  for (const s of sessions) {
    if (s.phase === "focus" && s.outcome === "completed") {
      focusCompleted += 1;
      focusMs += s.elapsed_ms;
      if (s.ended_at >= weekStartMs) {
        weekFocus += 1;
        weekMs += s.elapsed_ms;
      }
    }
  }

  return {
    focusCompleted,
    focusMs,
    weekFocus,
    weekMs,
    total: sessions.length,
  };
}

/** Last 7 local calendar days (oldest → newest). */
function last7Days(sessions: SessionRecord[]): DayBucket[] {
  const today = startOfLocalDay(new Date());
  const map = new Map<DayKey, SessionRecord[]>();
  for (const s of sessions) {
    const k = localDayKey(s.ended_at);
    const list = map.get(k);
    if (list) list.push(s);
    else map.set(k, [s]);
  }

  const days: DayBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = localDayKey(d.getTime());
    const list = map.get(key) ?? [];
    let focusCompleted = 0;
    let focusMs = 0;
    for (const s of list) {
      if (s.phase === "focus" && s.outcome === "completed") {
        focusCompleted += 1;
        focusMs += s.elapsed_ms;
      }
    }
    days.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
      short: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      focusCompleted,
      focusMs,
      total: list.length,
    });
  }
  return days;
}

function groupByDay(sessions: SessionRecord[]): Array<{ key: DayKey; items: SessionRecord[] }> {
  const groups: Array<{ key: DayKey; items: SessionRecord[] }> = [];
  const index = new Map<DayKey, number>();
  for (const s of sessions) {
    const key = localDayKey(s.ended_at);
    const i = index.get(key);
    if (i === undefined) {
      index.set(key, groups.length);
      groups.push({ key, items: [s] });
    } else {
      groups[i].items.push(s);
    }
  }
  return groups;
}

function sessionRow(s: SessionRecord): string {
  const task =
    s.todo_title?.trim() ||
    (s.phase === "focus" ? "No task" : "Break");
  const phase = phaseLabel(s.phase);
  const phaseClass =
    s.phase === "focus"
      ? "is-focus"
      : s.phase === "short_break"
        ? "is-short"
        : "is-long";
  return `
    <div class="sess-row">
      <span class="sess-dot ${phaseClass}" aria-hidden="true"></span>
      <div class="sess-main">
        <span class="sess-phase">${phase}</span>
        <span class="sess-task">${escapeHtml(task)}</span>
      </div>
      <div class="sess-meta">
        <span class="sess-when">${formatWhen(s.ended_at)}</span>
        <span class="sess-dur">${formatElapsed(s.elapsed_ms)} · ${outcomeLabel(s.outcome)}</span>
      </div>
    </div>`;
}

function chartHtml(days: DayBucket[]): string {
  const max = Math.max(1, ...days.map((d) => d.focusCompleted));
  const bars = days
    .map((d) => {
      const h = Math.round((d.focusCompleted / max) * 100);
      const empty = d.focusCompleted === 0;
      const title = `${d.label}: ${d.focusCompleted} focus${d.focusCompleted === 1 ? "" : "es"}`;
      return `
        <div class="sess-bar-col" title="${escapeHtml(title)}">
          <div class="sess-bar-track">
            <div class="sess-bar${empty ? " is-empty" : ""}" style="--h:${h}%"></div>
          </div>
          <span class="sess-bar-count">${d.focusCompleted || ""}</span>
          <span class="sess-bar-day">${escapeHtml(d.short)}</span>
        </div>`;
    })
    .join("");
  return `<div class="sess-chart" role="img" aria-label="Focus sessions over the last 7 days">${bars}</div>`;
}

export class SessionsPanel {
  private rootEl: HTMLElement;
  private isOpen = false;
  private bodyEl: HTMLElement;

  constructor(root: HTMLElement) {
    this.rootEl = root;
    this.rootEl.className = "sheet-root sessions-sheet-root";
    this.rootEl.innerHTML = `
      <div class="sheet-scrim"></div>
      <div class="sheet">
        <div class="sheet-grabber"></div>
        <div class="sheet-nav">
          <span class="sheet-title">Sessions</span>
          <button class="done-btn" type="button">Done</button>
        </div>
        <div class="sheet-scroll sess-scroll">
          <div class="sess-body">
            <div class="sess-loading">Loading…</div>
          </div>
        </div>
      </div>`;

    this.bodyEl = this.rootEl.querySelector(".sess-body")!;

    this.rootEl
      .querySelector(".sheet-scrim")!
      .addEventListener("click", () => this.close());
    this.rootEl
      .querySelector(".done-btn")!
      .addEventListener("click", () => this.close());
  }

  open(): void {
    this.isOpen = true;
    this.rootEl.classList.add("open");
    void this.refresh();
  }

  close(): void {
    this.isOpen = false;
    this.rootEl.classList.remove("open");
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  get openState(): boolean {
    return this.isOpen;
  }

  private async refresh(): Promise<void> {
    this.bodyEl.innerHTML = `<div class="sess-loading">Loading…</div>`;
    try {
      const sessions = await store.listSessions(500);
      this.renderBody(sessions);
    } catch {
      this.bodyEl.innerHTML = `
        <div class="sess-empty">
          <p class="sess-empty-title">Could not load sessions</p>
          <p class="sess-empty-msg">Session history lives in the local database. Try again after finishing a timer.</p>
        </div>`;
    }
  }

  private renderBody(sessions: SessionRecord[]): void {
    if (sessions.length === 0) {
      this.bodyEl.innerHTML = `
        <div class="sess-empty">
          <p class="sess-empty-title">No sessions yet</p>
          <p class="sess-empty-msg">Start a focus timer. Completed, skipped, and stopped sessions show up here with any linked task.</p>
        </div>`;
      return;
    }

    const summary = summarize(sessions);
    const days = last7Days(sessions);
    const todayKey = localDayKey(Date.now());
    const yesterdayKey = localDayKey(addDays(startOfLocalDay(new Date()), -1).getTime());
    const groups = groupByDay(sessions);

    const weekLabel =
      summary.weekFocus === 0
        ? "0 this week"
        : `${summary.weekFocus} this week`;

    this.bodyEl.innerHTML = `
      <div class="sess-stats" aria-label="Summary">
        <div class="sess-stat">
          <span class="sess-stat-value">${summary.focusCompleted}</span>
          <span class="sess-stat-label">Focus done</span>
        </div>
        <div class="sess-stat">
          <span class="sess-stat-value">${formatFocusHours(summary.focusMs)}</span>
          <span class="sess-stat-label">Focus time</span>
        </div>
        <div class="sess-stat">
          <span class="sess-stat-value">${summary.weekFocus}</span>
          <span class="sess-stat-label">Last 7 days</span>
        </div>
      </div>

      <div class="group-label">Focus · last 7 days</div>
      <div class="group sess-chart-group">
        ${chartHtml(days)}
        <p class="sess-chart-hint">${weekLabel}${summary.weekMs > 0 ? ` · ${formatFocusHours(summary.weekMs)} focused` : ""}</p>
      </div>

      <div class="group-label">Recent <span class="history-count">(${summary.total})</span></div>
      <div class="group sess-list-group">
        ${groups
          .map(
            (g) => `
          <div class="sess-day">
            <div class="sess-day-label">${dayHeading(g.key, todayKey, yesterdayKey)}</div>
            ${g.items.map(sessionRow).join("")}
          </div>`,
          )
          .join("")}
      </div>`;
  }
}
