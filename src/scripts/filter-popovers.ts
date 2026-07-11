function closeAllPopovers() {
  document
    .querySelectorAll<HTMLElement>(".filter-popover-open")
    .forEach((el) => {
      el.classList.remove("filter-popover-open");
      const chip = el
        .closest<HTMLElement>("[data-filter-chip-wrapper]")
        ?.querySelector<HTMLElement>("[data-filter-chip]");
      if (chip) chip.setAttribute("aria-expanded", "false");
    });
}

export function initFilterPopovers() {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const chip = target.closest<HTMLElement>("[data-filter-chip]");

    if (chip) {
      const wrapper = chip.closest<HTMLElement>("[data-filter-chip-wrapper]");
      const popover = wrapper?.querySelector<HTMLElement>("[data-filter-popover]");
      const isOpen = popover?.classList.contains("filter-popover-open");

      closeAllPopovers();

      if (popover && !isOpen) {
        popover.classList.add("filter-popover-open");
        chip.setAttribute("aria-expanded", "true");
      }
      return;
    }

    // Close when clicking outside any popover or chip
    if (!target.closest("[data-filter-popover]")) {
      closeAllPopovers();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllPopovers();
    }
  });
}
