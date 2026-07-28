import { store, Todo } from "../state";

const PLAY_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.7v10.6c0 .8.9 1.3 1.6.9l8.3-5.3c.6-.4.6-1.4 0-1.8l-8.3-5.3c-.7-.4-1.6.1-1.6.9z"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12z"/><path d="M10 11v6M14 11v6"/></svg>`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tomatoBadge(n: number): string {
  return `<span class="todo-badge" title="Pomodoros completed">🍅 ${n}</span>`;
}

function openRow(todo: Todo, activeId: string | null): string {
  const active = todo.id === activeId;
  return `
    <div class="todo-row${active ? " is-active" : ""}" data-id="${todo.id}">
      <button class="todo-check" data-action="complete" aria-label="Mark complete" title="Mark complete"></button>
      <div class="todo-body">
        <span class="todo-title">${escapeHtml(todo.title)}</span>
        ${tomatoBadge(todo.pomodoros)}
      </div>
      <button class="todo-play" data-action="start" aria-label="Start pomodoro" title="Start focus on this task">${PLAY_ICON}</button>
      <button class="todo-delete" data-action="delete" aria-label="Delete task" title="Delete">${TRASH_ICON}</button>
    </div>`;
}

function doneRow(todo: Todo): string {
  return `
    <div class="todo-row is-done" data-id="${todo.id}">
      <button class="todo-check is-checked" data-action="reopen" aria-label="Mark incomplete" title="Mark incomplete"></button>
      <div class="todo-body">
        <span class="todo-title">${escapeHtml(todo.title)}</span>
        ${tomatoBadge(todo.pomodoros)}
      </div>
      <button class="todo-delete" data-action="delete" aria-label="Delete task" title="Delete">${TRASH_ICON}</button>
    </div>`;
}

export class TodosPanel {
  private rootEl: HTMLElement;
  private isOpen = false;
  private listEl: HTMLElement;
  private inputEl: HTMLInputElement;

  constructor(root: HTMLElement) {
    this.rootEl = root;
    this.rootEl.className = "sheet-root todos-sheet-root";
    this.rootEl.innerHTML = `
      <div class="sheet-scrim"></div>
      <div class="sheet">
        <div class="sheet-grabber"></div>
        <div class="sheet-nav">
          <span class="sheet-title">Tasks</span>
          <button class="done-btn">Done</button>
        </div>
        <div class="sheet-scroll">
          <form class="todo-add">
            <input class="todo-input" type="text" placeholder="Add a task…" maxlength="120" autocomplete="off" />
            <button type="submit" class="todo-add-btn" aria-label="Add task">Add</button>
          </form>
          <div class="todo-list"></div>
        </div>
      </div>`;

    this.listEl = this.rootEl.querySelector(".todo-list")!;
    this.inputEl = this.rootEl.querySelector(".todo-input")!;

    this.rootEl
      .querySelector(".sheet-scrim")!
      .addEventListener("click", () => this.close());
    this.rootEl
      .querySelector(".done-btn")!
      .addEventListener("click", () => this.close());

    this.rootEl.querySelector(".todo-add")!.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = this.inputEl.value.trim();
      if (!title) return;
      this.inputEl.value = "";
      void store.addTodo(title);
    });

    this.listEl.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!target) return;
      const row = target.closest<HTMLElement>(".todo-row");
      if (!row?.dataset.id) return;
      const id = row.dataset.id;
      const action = target.dataset.action;

      if (action === "start") {
        void store.startTodo(id).then(() => this.close());
      } else if (action === "complete") {
        void store.setTodoCompleted(id, true);
      } else if (action === "reopen") {
        void store.setTodoCompleted(id, false);
      } else if (action === "delete") {
        void store.deleteTodo(id);
      }
    });
  }

  open(): void {
    this.isOpen = true;
    this.rootEl.classList.add("open");
    // Defer focus so the sheet animation doesn't steal it awkwardly.
    requestAnimationFrame(() => this.inputEl.focus());
  }

  close(): void {
    this.isOpen = false;
    this.rootEl.classList.remove("open");
    this.inputEl.blur();
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  get openState(): boolean {
    return this.isOpen;
  }

  update(todos: Todo[], activeId: string | null): void {
    const open = todos.filter((t) => !t.completed);
    const done = todos.filter((t) => t.completed);

    const parts: string[] = [];

    if (open.length === 0 && done.length === 0) {
      parts.push(
        `<div class="todo-empty">Add a task, then press play to start a focus session. Each finished pomodoro counts toward the active task.</div>`,
      );
    } else {
      if (open.length > 0) {
        parts.push(`<div class="group-label">Open</div>`);
        parts.push(
          `<div class="group todo-group">${open.map((t) => openRow(t, activeId)).join("")}</div>`,
        );
      } else {
        parts.push(
          `<div class="todo-empty subtle">No open tasks — add one above.</div>`,
        );
      }

      if (done.length > 0) {
        parts.push(`<div class="group-label">Completed</div>`);
        parts.push(
          `<div class="group todo-group">${done.map((t) => doneRow(t)).join("")}</div>`,
        );
      }
    }

    this.listEl.innerHTML = parts.join("");
  }
}
