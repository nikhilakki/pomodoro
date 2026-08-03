import {
  store,
  Todo,
  formatDue,
  dueUrgency,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from "../state";

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

/** Stable fingerprint of list UI state — skips re-renders on timer ticks. */
function listFingerprint(todos: Todo[], activeId: string | null): string {
  return JSON.stringify({
    activeId,
    items: todos.map((t) => [
      t.id,
      t.title,
      t.completed,
      t.pomodoros,
      t.due_at ?? null,
    ]),
  });
}

function dueChip(todo: Todo): string {
  if (todo.due_at == null) return "";
  const urgency = todo.completed ? "normal" : dueUrgency(todo.due_at);
  const cls =
    urgency === "overdue"
      ? "todo-due is-overdue"
      : urgency === "soon"
        ? "todo-due is-soon"
        : "todo-due";
  const label = urgency === "overdue" ? "Overdue" : "Due";
  return `<span class="${cls}" title="${escapeHtml(formatDue(todo.due_at))}">${label} ${escapeHtml(formatDue(todo.due_at))}</span>`;
}

function editForm(todo: Todo): string {
  const dueVal =
    todo.due_at != null ? escapeHtml(toDatetimeLocalValue(todo.due_at)) : "";
  return `
    <form class="todo-edit" data-id="${todo.id}">
      <input class="todo-edit-title" type="text" maxlength="120" autocomplete="off" spellcheck="false" value="${escapeHtml(todo.title)}" aria-label="Task title" />
      <div class="todo-edit-due-row">
        <label class="todo-edit-due-label">
          <span>Due</span>
          <input class="todo-edit-due" type="datetime-local" step="60" value="${dueVal}" aria-label="Due date" />
        </label>
        <button type="button" class="todo-edit-clear-due" data-action="clear-due"${todo.due_at == null ? " hidden" : ""}>Clear</button>
      </div>
      <div class="todo-edit-actions">
        <button type="button" class="todo-edit-cancel" data-action="cancel-edit">Cancel</button>
        <button type="submit" class="todo-edit-save">Save</button>
      </div>
    </form>`;
}

function openRow(todo: Todo, activeId: string | null, editingId: string | null): string {
  const active = todo.id === activeId;
  const editing = todo.id === editingId;
  if (editing) {
    return `
    <div class="todo-row is-editing${active ? " is-active" : ""}" data-id="${todo.id}">
      ${editForm(todo)}
    </div>`;
  }
  return `
    <div class="todo-row${active ? " is-active" : ""}" data-id="${todo.id}">
      <button class="todo-check" data-action="complete" aria-label="Mark complete" title="Mark complete"></button>
      <button type="button" class="todo-body" data-action="edit" aria-label="Edit task" title="Edit task">
        <span class="todo-title">${escapeHtml(todo.title)}</span>
        <span class="todo-meta">
          ${tomatoBadge(todo.pomodoros)}
          ${dueChip(todo)}
        </span>
      </button>
      <button class="todo-play" data-action="start" aria-label="Start pomodoro" title="Start focus on this task">${PLAY_ICON}</button>
      <button class="todo-delete" data-action="delete" aria-label="Delete task" title="Delete">${TRASH_ICON}</button>
    </div>`;
}

function doneRow(todo: Todo, editingId: string | null): string {
  const editing = todo.id === editingId;
  if (editing) {
    return `
    <div class="todo-row is-done is-editing" data-id="${todo.id}">
      ${editForm(todo)}
    </div>`;
  }
  return `
    <div class="todo-row is-done" data-id="${todo.id}">
      <button class="todo-check is-checked" data-action="reopen" aria-label="Mark incomplete" title="Mark incomplete"></button>
      <button type="button" class="todo-body" data-action="edit" aria-label="Edit task" title="Edit task">
        <span class="todo-title">${escapeHtml(todo.title)}</span>
        <span class="todo-meta">
          ${tomatoBadge(todo.pomodoros)}
          ${dueChip(todo)}
        </span>
      </button>
      <button class="todo-delete" data-action="delete" aria-label="Delete task" title="Delete">${TRASH_ICON}</button>
    </div>`;
}

export class TodosPanel {
  private rootEl: HTMLElement;
  private isOpen = false;
  private listEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private editingId: string | null = null;
  private lastTodos: Todo[] = [];
  private lastActiveId: string | null = null;
  private lastFingerprint = "";

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
      const action = target.dataset.action;

      if (action === "cancel-edit") {
        e.preventDefault();
        this.editingId = null;
        this.forceRender();
        return;
      }

      if (action === "clear-due") {
        e.preventDefault();
        e.stopPropagation();
        const form = target.closest<HTMLFormElement>(".todo-edit");
        const dueInput = form?.querySelector<HTMLInputElement>(".todo-edit-due");
        if (dueInput) {
          dueInput.value = "";
          target.setAttribute("hidden", "");
        }
        return;
      }

      const row = target.closest<HTMLElement>(".todo-row");
      if (!row?.dataset.id) return;
      const id = row.dataset.id;

      if (action === "edit") {
        this.beginEdit(id);
      } else if (action === "start") {
        this.editingId = null;
        void store.startTodo(id).then(() => this.close());
      } else if (action === "complete") {
        if (this.editingId === id) this.editingId = null;
        void store.setTodoCompleted(id, true);
      } else if (action === "reopen") {
        void store.setTodoCompleted(id, false);
      } else if (action === "delete") {
        if (this.editingId === id) this.editingId = null;
        void store.deleteTodo(id);
      }
    });

    this.listEl.addEventListener("submit", (e) => {
      const form = (e.target as HTMLElement).closest<HTMLFormElement>(".todo-edit");
      if (!form) return;
      e.preventDefault();
      const id = form.dataset.id;
      if (!id) return;
      const titleInput = form.querySelector<HTMLInputElement>(".todo-edit-title")!;
      const dueInput = form.querySelector<HTMLInputElement>(".todo-edit-due")!;
      const title = titleInput.value.trim();
      if (!title) {
        titleInput.focus();
        return;
      }
      const due_at = fromDatetimeLocalValue(dueInput.value);
      this.editingId = null;
      void store.updateTodo(id, title, due_at);
    });

    this.listEl.addEventListener("input", (e) => {
      const dueInput = (e.target as HTMLElement).closest<HTMLInputElement>(
        ".todo-edit-due",
      );
      if (!dueInput) return;
      const form = dueInput.closest(".todo-edit");
      const clearBtn = form?.querySelector<HTMLElement>(".todo-edit-clear-due");
      if (!clearBtn) return;
      if (dueInput.value) clearBtn.removeAttribute("hidden");
      else clearBtn.setAttribute("hidden", "");
    });

    this.listEl.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const form = (e.target as HTMLElement).closest(".todo-edit");
      if (!form || !this.editingId) return;
      e.preventDefault();
      this.editingId = null;
      this.forceRender();
    });
  }

  private beginEdit(id: string): void {
    this.editingId = id;
    this.forceRender();
    requestAnimationFrame(() => {
      const titleInput = this.listEl.querySelector<HTMLInputElement>(
        `.todo-edit[data-id="${CSS.escape(id)}"] .todo-edit-title`,
      );
      titleInput?.focus();
      titleInput?.select();
    });
  }

  open(): void {
    this.isOpen = true;
    this.rootEl.classList.add("open");
    requestAnimationFrame(() => {
      if (!this.editingId) this.inputEl.focus();
    });
  }

  close(): void {
    this.isOpen = false;
    this.editingId = null;
    this.rootEl.classList.remove("open");
    this.inputEl.blur();
    this.forceRender();
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  get openState(): boolean {
    return this.isOpen;
  }

  /**
   * Called from the global store render loop (including every 1s timer tick).
   * Must not remount the edit form while the user is typing or picking a date.
   */
  update(todos: Todo[], activeId: string | null): void {
    // While editing: keep the live form; only bail if the task was deleted.
    if (this.editingId) {
      if (!todos.some((t) => t.id === this.editingId)) {
        this.editingId = null;
        this.lastTodos = todos;
        this.lastActiveId = activeId;
        this.lastFingerprint = listFingerprint(todos, activeId);
        this.renderList();
        return;
      }
      this.lastTodos = todos;
      this.lastActiveId = activeId;
      // Do not touch lastFingerprint — after save/cancel we want a full paint.
      return;
    }

    const fp = listFingerprint(todos, activeId);
    if (fp === this.lastFingerprint) {
      this.lastTodos = todos;
      this.lastActiveId = activeId;
      return;
    }

    this.lastTodos = todos;
    this.lastActiveId = activeId;
    this.lastFingerprint = fp;
    this.renderList();
  }

  /** Always repaint (enter/leave edit, cancel, close). */
  private forceRender(): void {
    this.lastFingerprint = listFingerprint(this.lastTodos, this.lastActiveId);
    this.renderList();
  }

  private renderList(): void {
    const todos = this.lastTodos;
    const activeId = this.lastActiveId;
    const editingId = this.editingId;
    const open = todos.filter((t) => !t.completed);
    const done = todos.filter((t) => t.completed);

    const parts: string[] = [];

    if (open.length === 0 && done.length === 0) {
      parts.push(
        `<div class="todo-empty">Add a task, then press play to start a focus session. Tap a task to edit title or due date. Each finished pomodoro counts toward the active task.</div>`,
      );
    } else {
      if (open.length > 0) {
        parts.push(`<div class="group-label">Open</div>`);
        parts.push(
          `<div class="group todo-group">${open.map((t) => openRow(t, activeId, editingId)).join("")}</div>`,
        );
      } else {
        parts.push(
          `<div class="todo-empty subtle">No open tasks — add one above.</div>`,
        );
      }

      if (done.length > 0) {
        parts.push(`<div class="group-label">Completed</div>`);
        parts.push(
          `<div class="group todo-group">${done.map((t) => doneRow(t, editingId)).join("")}</div>`,
        );
      }
    }

    this.listEl.innerHTML = parts.join("");
  }
}
