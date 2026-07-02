export function initAutosubmitForms() {
  document.querySelectorAll<HTMLFormElement>("[data-autosubmit-form]").forEach((form) => {
    const input = form.querySelector<HTMLInputElement>("[data-autosubmit-input]");
    if (!input) return;

    let timer = 0;
    input.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        form.requestSubmit();
      }, 350);
    });
  });
}
