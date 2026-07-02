export function initDrawer() {
  const drawer = document.querySelector<HTMLElement>("[data-drawer]");
  const scrim = document.querySelector<HTMLElement>("[data-drawer-close].drawer-scrim");
  const toggles = document.querySelectorAll<HTMLButtonElement>("[data-drawer-toggle], [data-drawer-open]");
  const closers = document.querySelectorAll<HTMLButtonElement>("[data-drawer-close]:not(.drawer-scrim)");

  if (!drawer) return;

  const setOpen = (open: boolean) => {
    drawer.classList.toggle("sidebar--open", open);
    scrim?.toggleAttribute("hidden", !open);
    toggles.forEach((toggle) => toggle.setAttribute("aria-expanded", String(open)));
  };

  toggles.forEach((toggle) => toggle.addEventListener("click", () => setOpen(!drawer.classList.contains("sidebar--open"))));
  closers.forEach((closer) => closer.addEventListener("click", () => setOpen(false)));
  scrim?.addEventListener("click", () => setOpen(false));
}
