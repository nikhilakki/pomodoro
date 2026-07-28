import { Todo } from "../state";

/** Compact chip on the main stage showing the task currently receiving pomodoros. */
export class ActiveTaskChip {
  private root: HTMLElement;

  constructor(root: HTMLElement, onOpen: () => void) {
    this.root = root;
    root.className = "active-task-chip hidden";
    root.setAttribute("role", "button");
    root.setAttribute("tabindex", "0");
    root.title = "Open tasks";
    root.addEventListener("click", onOpen);
    root.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    });
  }

  update(todo: Todo | null): void {
    if (!todo) {
      this.root.classList.add("hidden");
      this.root.innerHTML = "";
      this.root.setAttribute("aria-hidden", "true");
      return;
    }

    this.root.classList.remove("hidden");
    this.root.setAttribute("aria-hidden", "false");
    this.root.innerHTML = `
      <span class="active-task-label">Working on</span>
      <span class="active-task-title"></span>
      <span class="todo-badge">🍅 ${todo.pomodoros}</span>`;
    this.root.querySelector(".active-task-title")!.textContent = todo.title;
  }
}
