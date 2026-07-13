export function initNumericFilters() {
  document.querySelectorAll<HTMLFormElement>("[data-numeric-filter-form]").forEach((form) => {
    form.querySelectorAll<HTMLElement>("[data-numeric-filter]").forEach((filter) => {
      const range = filter.querySelector<HTMLInputElement>("[data-numeric-filter-range]");
      const number = filter.querySelector<HTMLInputElement>("[data-numeric-filter-number]");
      if (!range || !number) return;

      let submitTimer = 0;
      const markExplicit = () => {
        const filterName = number.dataset.filterName;
        if (filterName && !number.name) number.name = filterName;
      };
      const submitSoon = () => {
        window.clearTimeout(submitTimer);
        submitTimer = window.setTimeout(() => form.requestSubmit(), 250);
      };

      range.addEventListener("input", () => {
        markExplicit();
        number.value = range.value;
      });

      range.addEventListener("change", () => {
        markExplicit();
        submitSoon();
      });

      number.addEventListener("input", () => {
        markExplicit();
        if (number.value) range.value = number.value;
        submitSoon();
      });
    });
  });
}
