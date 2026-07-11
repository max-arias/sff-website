import { initAutocomplete } from "./autocomplete";
import { initAutosubmitForms } from "./autosubmit-form";
import { initNumericFilters } from "./numeric-filters";
import { initFilterPopovers } from "./filter-popovers";

const onIdle = (callback: () => void) => {
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };

  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(callback, { timeout: 1200 });
  } else {
    idleWindow.addEventListener("load", callback, { once: true });
  }
};

onIdle(() => {
  initAutocomplete();
  initAutosubmitForms();
  initNumericFilters();
  initFilterPopovers();
});
