export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  destructive?: boolean;
}

/**
 * iOS-style modal confirm. Resolves true if the user confirms.
 * Only one dialog is shown at a time; later calls wait in a queue.
 */
let chain: Promise<unknown> = Promise.resolve();

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  const run = () =>
    new Promise<boolean>((resolve) => {
      const root = document.createElement("div");
      root.className = "confirm-root";
      root.innerHTML = `
        <div class="confirm-scrim"></div>
        <div class="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
          <div class="confirm-title" id="confirm-title"></div>
          <div class="confirm-msg" id="confirm-msg"></div>
          <div class="confirm-actions">
            <button type="button" class="confirm-btn cancel"></button>
            <button type="button" class="confirm-btn ok"></button>
          </div>
        </div>`;

      root.querySelector(".confirm-title")!.textContent = opts.title;
      root.querySelector(".confirm-msg")!.textContent = opts.message;

      const cancelBtn = root.querySelector<HTMLButtonElement>(".confirm-btn.cancel")!;
      const okBtn = root.querySelector<HTMLButtonElement>(".confirm-btn.ok")!;
      cancelBtn.textContent = opts.cancelLabel ?? "Cancel";
      okBtn.textContent = opts.confirmLabel ?? "Switch";
      if (opts.destructive) okBtn.classList.add("destructive");

      const finish = (value: boolean) => {
        root.classList.remove("open");
        window.setTimeout(() => root.remove(), 200);
        document.removeEventListener("keydown", onKey);
        resolve(value);
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        } else if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        }
      };

      cancelBtn.addEventListener("click", () => finish(false));
      okBtn.addEventListener("click", () => finish(true));
      root.querySelector(".confirm-scrim")!.addEventListener("click", () => finish(false));

      document.body.appendChild(root);
      requestAnimationFrame(() => root.classList.add("open"));
      document.addEventListener("keydown", onKey);
      okBtn.focus();
    });

  const next = chain.then(run, run);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
