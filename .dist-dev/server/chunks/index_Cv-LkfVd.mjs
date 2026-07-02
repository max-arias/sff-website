globalThis.process ??= {};
globalThis.process.env ??= {};
import { r as __exportAll } from "./rolldown-runtime_CTVlGNzl.mjs";
import { S as createComponent, g as addAttribute, i as renderComponent, m as maybeRenderHead, u as renderTemplate } from "./server_C1h4Dnza.mjs";
import "./compiler_w6KFsEAb.mjs";
import { t as $$BaseLayout } from "./BaseLayout_CXdPvn_n.mjs";
//#region src/pages/index.astro
var pages_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Index,
	file: () => $$file,
	url: () => ""
});
var $$Index = createComponent(($$result, $$props, $$slots) => {
	const quickSearchTerms = [
		"FormD T1",
		"RTX 4090",
		"Velka 3",
		"NH-L9i",
		"SF750"
	];
	const launchPaths = [{
		eyebrow: "Case-first flow",
		title: "Start with a case",
		copy: "Scan volume, GPU envelope, riser requirements, and thermal limits before you commit to a layout.",
		cta: "Browse case database",
		samples: [
			"FormD T1 · 9.95L",
			"Velka 3 · 3.96L",
			"A4-H2O · 11.0L"
		]
	}, {
		eyebrow: "GPU-first flow",
		title: "Start with a GPU",
		copy: "Work backward from the card you already own, then surface every enclosure that clears the real dimensions.",
		cta: "Find fitment",
		samples: [
			"RTX 4090 · 304mm",
			"RX 7900 XTX · 287mm",
			"ProArt 4080 · 300mm"
		]
	}];
	const validations = [
		["Fractal Terra + 4080 FE", "Verified: 3.4mm CPU clearance margin"],
		["FormD T1 + ProArt 4080", "Verified: 240mm radiator and tube route"],
		["Velka 3 + ITX 4060", "Verified: Flex-ATX PSU fitment"],
		["A4-H2O + Strix 4070 Ti", "Verified: Triple-slot 322mm GPU"]
	];
	const principles = [
		{
			title: "Millimeter-perfect logic",
			copy: "Dimensions are checked against the technical drawings, not rounded shopping-page guesses."
		},
		{
			title: "Uncertainty stays visible",
			copy: "Conditional fits, incomplete specs, and routing caveats stay in the result instead of getting buried."
		},
		{
			title: "Community proof matters",
			copy: "Real build notes and validated pairings turn spreadsheets into decisions you can trust."
		}
	];
	const protocol = [
		{
			stat: "2,400+",
			label: "catalog records ready for search",
			copy: "Cases, GPUs, coolers, and related fitment data normalized into one compatibility surface."
		},
		{
			stat: "pass / fail / conditional",
			label: "outcomes that show the evidence",
			copy: "The system favors clarity over confidence theater, especially when the source data is incomplete."
		},
		{
			stat: "search first",
			label: "workflow tuned for expert scanning",
			copy: "The interface is built like an instrument panel so repeat builders can move fast without losing context."
		}
	];
	return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, {
		"title": "SFF Builder | Precision PC Planning",
		"description": "A technical homepage for planning small-form-factor builds with case and GPU clearance data."
	}, { "default": async ($$result) => renderTemplate`${maybeRenderHead($$result)}<div class="min-h-screen"><header class="sticky top-0 z-50 border-b border-line/80 bg-canvas/88 backdrop-blur-md"><div class="mx-auto flex max-w-[88rem] items-center justify-between gap-6 px-shell py-4"><div class="flex items-center gap-8"><a href="#top" class="font-mono text-lg font-bold tracking-[-0.04em] text-accent-strong">SFF Builder</a><nav class="hidden items-center gap-6 text-sm text-ink-soft md:flex"><a class="transition hover:text-ink" href="#launcher">Builder</a><a class="transition hover:text-ink" href="#proof">Proof</a><a class="transition hover:text-ink" href="#method">Method</a></nav></div><button type="button" data-theme-toggle class="inline-flex items-center gap-3 rounded-full border border-line bg-panel-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft transition hover:border-line-strong hover:text-ink" aria-label="Toggle theme"><span>Theme</span><span class="relative block h-5 w-10 rounded-full bg-panel-3"><span class="theme-toggle-thumb absolute left-0.5 top-0.5 block h-4 w-4 rounded-full bg-accent"></span></span></button></div></header><main id="top"><section class="blueprint-surface relative overflow-hidden border-b border-line/70"><div class="mx-auto grid max-w-[88rem] gap-10 px-shell pb-16 pt-10 md:pb-24 md:pt-14"><div class="flex flex-wrap items-center gap-3"><div class="inline-flex items-center gap-2 border border-line bg-panel-2/80 px-3 py-1.5 font-mono text-[0.72rem] font-bold uppercase tracking-[0.18em] text-ink-soft"><span class="h-2 w-2 rounded-full bg-success"></span>System status: operational // v3.4.0</div><div class="inline-flex items-center gap-2 border border-line/60 px-3 py-1.5 font-mono text-[0.72rem] text-ink-faint">case / gpu / cooler / riser</div></div><div class="grid gap-grid-gap lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]"><section class="tech-frame grid gap-5 p-5 md:p-6"><div class="flex flex-wrap items-center justify-between gap-4 border-b border-line/70 pb-4"><div><p class="micro-label mb-2">Builder protocol</p><h1 class="font-mono text-[clamp(1.5rem,2.8vw,2.4rem)] font-bold tracking-[-0.05em] text-ink">Search first. Verify fit after.</h1></div><div class="border border-line/70 px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.16em] text-ink-faint">local d1 / live query path</div></div><div class="grid gap-3 text-sm text-ink-soft md:grid-cols-3"><div class="border border-line/60 bg-canvas/30 px-4 py-3"><div class="micro-label mb-2">Input</div><p>Search by case, GPU, or part family, then narrow to a physical envelope.</p></div><div class="border border-line/60 bg-canvas/30 px-4 py-3"><div class="micro-label mb-2">Evaluation</div><p>Compare card dimensions, slot depth, riser needs, and layout caveats against the catalog.</p></div><div class="border border-line/60 bg-canvas/30 px-4 py-3"><div class="micro-label mb-2">Output</div><p>Return pass, fail, or conditional with the exact notes that need manual verification.</p></div></div></section><aside class="tech-frame grid gap-4 p-5"><div class="micro-label">Fit states</div><div class="grid gap-3 text-sm text-ink-soft"><div class="flex items-center justify-between gap-4 border-b border-line/70 pb-3"><span>Known dimensions fit</span><strong class="font-mono text-success">PASS</strong></div><div class="flex items-center justify-between gap-4 border-b border-line/70 pb-3"><span>Hard clearance collision</span><strong class="font-mono text-danger">FAIL</strong></div><div class="flex items-center justify-between gap-4"><span>Missing data or layout caveats</span><strong class="font-mono text-warning">CONDITIONAL</strong></div></div></aside></div></div></section><section id="launcher" class="relative z-20 overflow-visible px-shell py-section"><div class="mx-auto grid max-w-[88rem] gap-grid-gap"><div class="tech-frame p-6 md:p-8"><div class="flex items-center gap-3"><svg viewBox="0 0 24 24" class="h-5 w-5 text-accent" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16L21 21"></path></svg><p class="micro-label">Quick search</p></div><div class="mt-6" data-autocomplete-root><label class="relative block"><span class="sr-only">Search components</span><svg viewBox="0 0 24 24" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16L21 21"></path></svg><input data-autocomplete-input type="text" placeholder="Search case, GPU, or CPU cooler..." class="h-14 w-full border border-line bg-canvas-2/70 pl-12 pr-4 text-base text-ink outline-none transition placeholder:text-ink-faint focus:border-accent" autocomplete="off"></label><div data-autocomplete-panel class="relative z-[70] mt-2 hidden border border-line bg-panel shadow-card"><div data-autocomplete-status class="px-4 py-3 text-sm text-ink-soft"></div><div data-autocomplete-results class="grid"></div></div></div><div class="mt-5 flex flex-wrap gap-2">${quickSearchTerms.map((term) => renderTemplate`<span class="border border-line bg-panel-2 px-3 py-1.5 font-mono text-xs text-ink-soft">${term}</span>`)}</div><div class="mt-8 border-t border-line/70 pt-5 text-sm text-ink-soft">Search 2,400+ validated components in a clearance-aware catalog designed for SFF tradeoffs.</div></div><div class="grid gap-grid-gap lg:grid-cols-2">${launchPaths.map((path, index) => renderTemplate`<section class="group tech-frame grid min-h-[23rem] gap-8 p-6 transition duration-200 hover:border-line-strong hover:bg-panel-2 md:p-8"><div class="grid gap-5"><div class="flex h-12 w-12 items-center justify-center bg-panel-3 text-accent">${index === 0 ? renderTemplate`<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M5 6.5h14v11H5z"></path><path d="M8 10h8"></path><path d="M8 13.5h5"></path></svg>` : renderTemplate`<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="4.5" y="6" width="15" height="12"></rect><path d="M8 9h8M8 12h8M8 15h5"></path></svg>`}</div><div><p class="micro-label mb-3">${path.eyebrow}</p><h2 class="font-sans text-3xl font-semibold tracking-[-0.04em] text-ink">${path.title}</h2><p class="mt-3 max-w-[48ch] text-base leading-7 text-ink-soft">${path.copy}</p></div><div class="relative block" data-autocomplete-root${addAttribute(index === 0 ? "case" : "gpu", "data-kind")}><span class="sr-only">${path.title}</span><svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16L21 21"></path></svg><input data-autocomplete-input type="text"${addAttribute(index === 0 ? "Search cases..." : "Search GPUs...", "placeholder")} class="h-11 w-full border border-line bg-canvas-2/70 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-accent" autocomplete="off"><div data-autocomplete-panel class="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[70] hidden border border-line bg-panel shadow-card"><div data-autocomplete-status class="px-4 py-3 text-sm text-ink-soft"></div><div data-autocomplete-results class="grid"></div></div></div><div class="flex flex-wrap gap-2">${path.samples.map((sample) => renderTemplate`<span class="border border-line bg-panel-2 px-2.5 py-1 font-mono text-[0.7rem] text-ink-soft">${sample}</span>`)}</div></div><div class="flex items-center justify-between gap-4"><span class="micro-label text-accent">${path.cta}</span><svg viewBox="0 0 24 24" class="h-5 w-5 text-accent transition duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg></div></section>`)}</div></div></section><section id="proof" class="relative z-0 border-y border-line/70 bg-panel/60 px-shell py-section"><div class="mx-auto grid max-w-[88rem] gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]"><div><div class="mb-6 flex items-center justify-between gap-4"><div class="flex items-center gap-3"><svg viewBox="0 0 24 24" class="h-5 w-5 text-accent" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12 3l7 3v6c0 4.3-2.6 7.6-7 9-4.4-1.4-7-4.7-7-9V6l7-3z"></path><path d="M9 12l2 2 4-4"></path></svg><p class="micro-label">Recent validations</p></div><a href="#method" class="text-sm text-ink-soft transition hover:text-accent">View community builds</a></div><div class="grid gap-4 md:grid-cols-2">${validations.map(([title, copy]) => renderTemplate`<article class="border border-line bg-canvas/40 p-5 transition hover:border-line-strong hover:bg-panel-2"><div class="flex items-start gap-4"><div class="mt-0.5 flex h-10 w-10 items-center justify-center bg-panel-3 text-accent"><svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M5 12.5l4 4 10-10"></path></svg></div><div><div class="flex flex-wrap items-center gap-2"><span class="border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-accent">Match</span><h3 class="font-mono text-sm font-semibold text-ink md:text-base">${title}</h3></div><p class="mt-2 text-sm text-ink-soft">${copy}</p></div></div></article>`)}</div></div><aside class="tech-frame p-6 md:p-8"><h2 class="font-sans text-3xl font-semibold tracking-[-0.04em] text-ink">Why SFF Builder?</h2><ul class="mt-8 grid gap-6">${principles.map((item) => renderTemplate`<li class="grid gap-2 border-b border-line/60 pb-6 last:border-b-0 last:pb-0"><p class="font-sans text-lg font-semibold text-ink">${item.title}</p><p class="max-w-[34ch] text-sm leading-7 text-ink-soft">${item.copy}</p></li>`)}</ul></aside></div></section><section id="method" class="px-shell py-section"><div class="mx-auto max-w-[88rem]"><div class="max-w-3xl"><p class="micro-label mb-4">Method</p><h2 class="font-mono text-[clamp(2rem,4vw,3.75rem)] font-bold leading-[0.95] tracking-[-0.06em] text-ink">A technical instrument, not a lifestyle configurator.</h2><p class="mt-5 max-w-[62ch] text-lg leading-8 text-ink-soft">The interface is built for people who already know that a build can be “compatible” on paper and still fail in the chassis. Search comes first, warnings stay visible, and every result is framed around the physical constraints that actually break SFF plans.</p></div><div class="mt-10 grid gap-grid-gap lg:grid-cols-3">${protocol.map((item) => renderTemplate`<article class="tech-frame grid gap-5 p-6 md:p-7"><div><p class="font-mono text-[1.7rem] font-bold tracking-[-0.05em] text-accent-strong">${item.stat}</p><p class="mt-2 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-ink-faint">${item.label}</p></div><p class="text-sm leading-7 text-ink-soft">${item.copy}</p></article>`)}</div></div></section></main><footer class="border-t border-line/80 bg-canvas/70 px-shell py-12"><div class="mx-auto grid max-w-[88rem] gap-10 md:grid-cols-[minmax(0,1fr)_auto]"><div class="max-w-md"><p class="micro-label mb-4 text-accent-strong">SFF Builder</p><p class="text-2xl font-semibold tracking-[-0.04em] text-ink">Engineered for precision, built for people who would rather verify than guess.</p><p class="mt-4 text-sm leading-7 text-ink-soft">The current homepage is a focused shell for the product reset: one route, two themes, and a clearer story around the fitment engine underneath it.</p></div><div class="grid grid-cols-2 gap-x-12 gap-y-6 text-sm"><div class="grid gap-3"><p class="micro-label">Platform</p><a href="#launcher" class="text-ink-soft transition hover:text-ink">Builder entry</a><a href="#proof" class="text-ink-soft transition hover:text-ink">Validation proof</a></div><div class="grid gap-3"><p class="micro-label">Principles</p><a href="#method" class="text-ink-soft transition hover:text-ink">Compatibility method</a><a href="#top" class="text-ink-soft transition hover:text-ink">Back to top</a></div></div></div></footer></div><script>
    const root = document.documentElement;
    const toggle = document.querySelector("[data-theme-toggle]");

    const applyTheme = (theme) => {
      root.dataset.theme = theme;
      localStorage.setItem("theme", theme);
      toggle?.setAttribute("aria-pressed", String(theme === "light"));
    };

    if (!localStorage.getItem("theme")) {
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      root.dataset.theme = prefersLight ? "light" : "dark";
    }

    toggle?.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
      applyTheme(nextTheme);
    });

    const autocompleteRoots = document.querySelectorAll("[data-autocomplete-root]");

    autocompleteRoots.forEach((autocompleteRoot) => {
      const input = autocompleteRoot.querySelector("[data-autocomplete-input]");
      const panel = autocompleteRoot.querySelector("[data-autocomplete-panel]");
      const status = autocompleteRoot.querySelector("[data-autocomplete-status]");
      const results = autocompleteRoot.querySelector("[data-autocomplete-results]");
      const kind = autocompleteRoot.dataset.kind;

      if (!input || !panel || !status || !results) return;

      let debounceTimer;
      let activeRequest = 0;

      const closePanel = () => {
        panel.classList.add("hidden");
      };

      const openPanel = () => {
        panel.classList.remove("hidden");
      };

      const renderState = (message) => {
        status.textContent = message;
        results.replaceChildren();
      };

      const renderSuggestions = (suggestions) => {
        results.replaceChildren();

        suggestions.forEach((suggestion) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "grid gap-1 border-t border-line px-4 py-3 text-left transition first:border-t-0 hover:bg-panel-2";
          button.innerHTML = \`
            <strong class="text-sm font-semibold text-ink">\${suggestion.displayName}</strong>
            <span class="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-ink-faint">\${suggestion.kind} / \${suggestion.sourceSheet} #\${suggestion.rowNumber}</span>
          \`;
          button.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            input.value = suggestion.displayName;
            closePanel();
          });
          results.append(button);
        });
      };

      const fetchSuggestions = async () => {
        const query = input.value.trim();
        if (query.length < 3) {
          closePanel();
          return;
        }

        const requestId = ++activeRequest;
        openPanel();
        renderState("Searching components...");

        const params = new URLSearchParams({ q: query, limit: "8" });
        if (kind) params.set("kind", kind);

        try {
          const response = await fetch(\`/api/catalog/search?\${params.toString()}\`);
          if (!response.ok) {
            throw new Error(\`\${response.status} \${response.statusText}\`);
          }

          const payload = await response.json();
          if (requestId !== activeRequest) return;

          const suggestions = payload.suggestions ?? [];
          if (!suggestions.length) {
            renderState("No matching components found.");
            return;
          }

          status.textContent = \`\${suggestions.length} component\${suggestions.length === 1 ? "" : "s"} found\`;
          renderSuggestions(suggestions);
        } catch (error) {
          if (requestId !== activeRequest) return;
          renderState("Search is unavailable right now.");
        }
      };

      input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(fetchSuggestions, 180);
      });

      input.addEventListener("focus", () => {
        if (input.value.trim().length >= 3) {
          void fetchSuggestions();
        }
      });

      input.addEventListener("blur", () => {
        window.setTimeout(closePanel, 120);
      });
    });
  <\/script>` })}`;
}, "D:/dev/sff-website/src/pages/index.astro", void 0);
var $$file = "D:/dev/sff-website/src/pages/index.astro";
//#endregion
//#region \0virtual:astro:page:src/pages/index@_@astro
var page = () => pages_exports;
//#endregion
export { page };
