type CatalogSuggestion = {
  id: string;
  kind: string;
  displayName: string;
  sourceSheet: string;
  rowNumber: number;
};

const selectableKinds = new Set(["case", "gpu", "psu", "cpu-cooler", "motherboard", "ram"]);

export function initAutocomplete() {
  document.querySelectorAll<HTMLButtonElement>("[data-suggested-part]").forEach((button) => {
    button.addEventListener("click", async () => {
      const query = button.dataset.launchQuery ?? "";
      const launchKind = button.dataset.launchKind ?? "";
      const params = new URLSearchParams({ q: query, limit: "1" });
      if (launchKind) params.set("kind", launchKind);

      try {
        const response = await fetch(`/api/catalog/search?${params.toString()}`);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const payload = (await response.json()) as { suggestions?: CatalogSuggestion[] };
        window.location.href = toBuildUrl(payload.suggestions?.[0], query, launchKind);
      } catch {
        window.location.href = toBuildUrl(undefined, query, launchKind);
      }
    });
  });

  document.querySelectorAll<HTMLElement>("[data-autocomplete-root]").forEach((root) => {
    const input = root.querySelector<HTMLInputElement>("[data-autocomplete-input]");
    const panel = root.querySelector<HTMLElement>("[data-autocomplete-panel]");
    const status = root.querySelector<HTMLElement>("[data-autocomplete-status]");
    const results = root.querySelector<HTMLElement>("[data-autocomplete-results]");
    const kind = root.dataset.kind ?? "";
    const launchKind = root.dataset.launchKind ?? kind;

    if (!input || !panel || !status || !results) return;

    panel.setAttribute("role", "listbox");
    panel.setAttribute("aria-busy", "false");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    let debounceTimer = 0;
    let activeRequest = 0;
    let suggestions: CatalogSuggestion[] = [];

    const closePanel = () => panel.classList.add("hidden");
    const openPanel = () => panel.classList.remove("hidden");
    const setStatus = (message: string) => {
      status.textContent = message;
      results.replaceChildren();
    };

    const navigate = (suggestion?: CatalogSuggestion) => {
      window.location.href = toBuildUrl(suggestion, input.value.trim(), launchKind);
    };

    const renderSuggestions = () => {
      results.replaceChildren();
      suggestions.forEach((suggestion) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "autocomplete-result";
        button.setAttribute("role", "option");

        const title = document.createElement("strong");
        title.className = "text-sm font-semibold text-base-content";
        title.textContent = suggestion.displayName;

        const meta = document.createElement("span");
        meta.className = "font-mono text-[0.7rem] uppercase tracking-[0.16em] text-base-content/50";
        meta.textContent = `${suggestion.kind} / ${suggestion.sourceSheet} #${suggestion.rowNumber}`;

        button.appendChild(title);
        button.appendChild(meta);
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          navigate(suggestion);
        });
        results.appendChild(button);
      });
    };

    const fetchSuggestions = async () => {
      const query = input.value.trim();
      if (query.length < 2) {
        suggestions = [];
        closePanel();
        return;
      }

      const requestId = ++activeRequest;
      const params = new URLSearchParams({ q: query, limit: "8" });
      if (kind) params.set("kind", kind);

      openPanel();
      panel.setAttribute("aria-busy", "true");
      setStatus("Searching components...");

      try {
        const response = await fetch(`/api/catalog/search?${params.toString()}`);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const payload = (await response.json()) as { suggestions?: CatalogSuggestion[] };
        if (requestId !== activeRequest) return;

        panel.setAttribute("aria-busy", "false");
        suggestions = payload.suggestions ?? [];
        if (!suggestions.length) {
          setStatus("No matching components found.");
          return;
        }

        status.textContent = `${suggestions.length} component${suggestions.length === 1 ? "" : "s"} found`;
        renderSuggestions();
      } catch {
        if (requestId === activeRequest) {
          panel.setAttribute("aria-busy", "false");
          setStatus("Search is unavailable right now.");
        }
      }
    };

    input.addEventListener("input", () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(fetchSuggestions, 180);
    });

    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) void fetchSuggestions();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      navigate(suggestions[0]);
    });

    root.addEventListener("submit", (event) => {
      event.preventDefault();
      navigate();
    });

    input.addEventListener("blur", () => {
      window.setTimeout(closePanel, 120);
    });
  });
}

function toBuildUrl(suggestion: CatalogSuggestion | undefined, query: string, launchKind: string) {
  const params = new URLSearchParams();
  if (suggestion && selectableKinds.has(suggestion.kind)) {
    params.set(suggestion.kind, suggestion.id);
    params.set("kind", suggestion.kind === "case" ? "gpu" : suggestion.kind === "gpu" ? "case" : suggestion.kind);
  } else {
    if (launchKind) params.set("kind", launchKind);
    if (query) params.set("search", query);
  }
  const suffix = params.toString();
  return suffix ? `/?${suffix}` : "/";
}
