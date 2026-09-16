import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { createVirtualizer } from "@tanstack/solid-virtual";
import type { BuildView, BuildViewNumericFilter } from "../../lib/build-view";
import { issueDetail, issueTitleForCode } from "../../fitment/issue-copy";
import { dataSources } from "../../lib/data-sources";
import { readIgnoredWarnings, writeIgnoredWarnings } from "../../lib/ignored-warning-storage";
import { BrowserCatalogClient, type BrowserCatalogStatus } from "./catalog-client";

const sparseRowsTooltip = "Rows without fitment-relevant data are hidden by default. Turn this on to include them.";

/** Estimated row height in px; the virtualizer measures real heights as rows mount. */
const tableRowHeight = 44;
const cardRowHeight = 260;

function isPsuBadge(value: string): boolean {
  return value.includes("data-psu-tier-badge");
}

function psuBadgeBackground(value: string): string | undefined {
  return value.match(/data-psu-tier-bg="([^"]+)"/)?.[1];
}

function CatalogValue(props: { value: string }) {
  return isPsuBadge(props.value) ? <span innerHTML={props.value} /> : props.value;
}

export default function BuildClient(props: { siteOrigin?: string }) {
  const [view, setView] = createSignal<BuildView>();
  const [status, setStatus] = createSignal<BrowserCatalogStatus>();
  const [error, setError] = createSignal<string>();
  const [loading, setLoading] = createSignal(true);
  const [openFilter, setOpenFilter] = createSignal<string>();
  const [searchDraft, setSearchDraft] = createSignal("");
  const [searchDirty, setSearchDirty] = createSignal(false);
  const [numericDrafts, setNumericDrafts] = createSignal<Record<string, string>>({});
  const [isDesktop, setIsDesktop] = createSignal(true);
  const [scrollEl, setScrollEl] = createSignal<HTMLDivElement>();
  const [scrollAttached, setScrollAttached] = createSignal(false);
  const [ignoredWarnings, setIgnoredWarnings] = createSignal<string[]>(readIgnoredWarnings());
  const [copiedBuild, setCopiedBuild] = createSignal(false);
  let catalog: BrowserCatalogClient | undefined;
  let latestHref: string | undefined;
  let copyTimer: number | undefined;
  let searchTimer: number | undefined;
  const filterTimers = new Map<string, number>();

  const rows = createMemo(() => view()?.rows ?? []);
  const virtualizer = createVirtualizer({
    get count() {
      return rows().length;
    },
    getScrollElement: () => (scrollAttached() ? scrollEl() ?? null : null),
    estimateSize: () => (isDesktop() ? tableRowHeight : cardRowHeight),
    overscan: 8,
  });
  // The scroll container mounts with the catalog view. Handing it to the
  // virtualizer on the same frame it is created measures a detached element
  // (offsetHeight 0), and the resulting 0x0 scroll rect yields no rows. Wait a
  // frame so the container is laid out before the virtualizer attaches.
  createEffect(() => {
    const element = scrollEl();
    setScrollAttached(false);
    if (!element) return;
    const frame = requestAnimationFrame(() => setScrollAttached(true));
    onCleanup(() => cancelAnimationFrame(frame));
  });
  const virtualRows = () => virtualizer.getVirtualItems();
  const paddingTop = () => virtualRows()[0]?.start ?? 0;
  const paddingBottom = () => {
    const items = virtualRows();
    const last = items[items.length - 1];
    return last ? Math.max(0, virtualizer.getTotalSize() - last.end) : 0;
  };

  const applyLoadedDrafts = (nextView: BuildView) => {
    const drafts = numericDrafts();
    const kept: Record<string, string> = {};
    for (const [name, value] of Object.entries(drafts)) {
      const applied = nextView.state.numericFilters[name];
      if (applied !== undefined && String(applied) === value) continue;
      if (applied === undefined && value === "") continue;
      kept[name] = value;
    }
    setNumericDrafts(kept);
  };

  const loadView = async (href: string, pushHistory: boolean) => {
    if (!catalog) return;
    const resolved = new URL(href, window.location.href).href;
    latestHref = resolved;
    if (pushHistory) window.history.pushState({}, "", resolved);
    setLoading(true);
    setError(undefined);
    try {
      const next = await catalog.getView(resolved, ignoredWarnings(), props.siteOrigin);
      if (latestHref !== resolved) return;
      setView(next.view);
      setStatus(next.status);
      if (!searchDirty()) setSearchDraft(next.view.state.search);
      applyLoadedDrafts(next.view);
    } catch (caught) {
      if (latestHref !== resolved) return;
      setError(caught instanceof Error ? caught.message : String(caught));
      catalog.dispose();
      catalog = new BrowserCatalogClient();
    } finally {
      if (latestHref === resolved) setLoading(false);
    }
  };

  const follow = (event: MouseEvent, href: string) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void loadView(href, true);
  };

  const updateQuery = (name: string, value: string | undefined) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
    void loadView(url.href, true);
  };

  const submitSearch = (value: string) => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      setSearchDirty(false);
      updateQuery("search", value.trim() || undefined);
    }, 300);
  };

  const commitFilter = (name: string, value: string) => {
    const existing = filterTimers.get(name);
    if (existing) window.clearTimeout(existing);
    filterTimers.set(name, window.setTimeout(() => {
      filterTimers.delete(name);
      updateQuery(name, value || undefined);
    }, 400));
  };

  /**
   * Ignoring a warning recomputes the view without touching URL state: ignored
   * codes are a browser-local preference, not part of the shared build.
   */
  const ignoreWarning = (code: string) => {
    if (ignoredWarnings().includes(code)) return;
    const next = [...ignoredWarnings(), code];
    setIgnoredWarnings(next);
    writeIgnoredWarnings(next);
    void loadView(window.location.href, false);
  };

  const restoreWarning = (code: string) => {
    const next = ignoredWarnings().filter((candidate) => candidate !== code);
    setIgnoredWarnings(next);
    writeIgnoredWarnings(next);
    void loadView(window.location.href, false);
  };

  const restoreAllIgnoredWarnings = () => {
    setIgnoredWarnings([]);
    writeIgnoredWarnings([]);
    void loadView(window.location.href, false);
  };

  /**
   * Copies the build list. The async clipboard API needs a secure context and a
   * granted permission, so a hidden textarea covers the browsers that refuse it.
   */
  const copyBuild = async () => {
    const text = view()?.partListText;
    if (!text) return;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const scratch = document.createElement("textarea");
      scratch.value = text;
      scratch.setAttribute("readonly", "");
      scratch.style.position = "fixed";
      scratch.style.opacity = "0";
      document.body.appendChild(scratch);
      scratch.select();
      copied = document.execCommand("copy");
      scratch.remove();
    }
    setCopiedBuild(copied);
    window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => setCopiedBuild(false), 2000);
  };

  /**
   * Numeric inputs render from the draft so typing is not clobbered by the
   * round-trip, and apply through the debounce so a filter lands once the user
   * pauses instead of on blur.
   */
  const draftValue = (filter: BuildViewNumericFilter) =>
    numericDrafts()[filter.name] ?? String(filter.value);

  const commitDraft = (name: string, value: string) => {
    setNumericDrafts((drafts) => ({ ...drafts, [name]: value }));
    commitFilter(name, value);
  };

  onMount(() => {
    catalog = new BrowserCatalogClient();
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(desktopQuery.matches);
    const onBreakpoint = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
      virtualizer.measure();
    };
    desktopQuery.addEventListener("change", onBreakpoint);
    void loadView(window.location.href, false);
    const onPopState = () => void loadView(window.location.href, false);
    const onDocumentPointerDown = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("[data-filter-popover], [data-filter-chip]")) return;
      setOpenFilter(undefined);
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFilter(undefined);
    };
    window.addEventListener("popstate", onPopState);
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onKeydown);
    onCleanup(() => {
      window.clearTimeout(searchTimer);
      window.clearTimeout(copyTimer);
      for (const timer of filterTimers.values()) window.clearTimeout(timer);
      filterTimers.clear();
      desktopQuery.removeEventListener("change", onBreakpoint);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onKeydown);
      catalog?.dispose();
    });
  });

  return (
    <main class="build-page">
      <Show
        when={view()}
        fallback={
          <div class="grid min-h-[70vh] place-items-center px-6">
            <section class="max-w-md border border-base-300 bg-base-200 p-6 text-center shadow-sm">
              <Show
                when={error()}
                fallback={<span class="loading loading-spinner loading-md text-primary" aria-label="Loading catalog" />}
              >
                <p class="text-sm text-error">{error()}</p>
                <button class="btn btn-primary btn-sm mt-4" type="button" onClick={() => void loadView(window.location.href, false)}>
                  Retry catalog
                </button>
              </Show>
              <Show when={!error()}>
                <p class="mt-4 font-mono text-xs uppercase tracking-[0.08em] text-base-content/60">Opening local catalog</p>
                <p class="mt-2 text-sm text-base-content/60">The catalog downloads once, then stays in this browser.</p>
              </Show>
            </section>
          </div>
        }
      >
        {(currentView) => {
          const hasActiveNumericFilter = () => currentView().numericFilterGroups.some((group) => group.activeCount > 0)
            || Boolean(currentView().state.caseVolumeTier)
            || Boolean(currentView().state.caseIntent)
            || Boolean(currentView().state.gpuBrand);
          const actionHeader = () => currentView().tableHeaders.find((header) => header.label === "Action");
          const dataTableHeaders = () => currentView().tableHeaders.filter((header) => header.label !== "Action");
          const hasAnySelection = () => currentView().slots.some((slot) => slot.id);
          // Only the two targeted nudges survive: the generic "add more parts"
          // line was replaced by the copy-build action below the parts.
          const sidebarHint = () => {
            const hasCase = currentView().slots.find((slot) => slot.kind === "case")?.id;
            const hasGpu = currentView().slots.find((slot) => slot.kind === "gpu")?.id;
            if (hasCase && !hasGpu) return "Select a GPU to check case fitment";
            if (!hasCase && hasGpu) return "Select a case to check GPU fitment";
            return "";
          };

          return <>
            <div class="flex items-center justify-end max-w-[80rem] mx-auto px-4 lg:px-6 pr-14 lg:pr-6 pt-3 lg:hidden">
              <label for="build-drawer-toggle" class="btn btn-ghost btn-sm">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4">
                  <path d="M5 5h14v14H5zM9 5v14M9 10h10M9 14h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter" />
                </svg>
                <span>Build</span>
              </label>
            </div>

            <div class="drawer lg:drawer-open">
              <input id="build-drawer-toggle" type="checkbox" class="drawer-toggle" />
              <div class="drawer-content">
                <section class="main-panel flex flex-col min-h-0">
                  <div class="overflow-x-auto px-6 pt-2">
                    <div class="tabs tabs-lift min-w-max" role="tablist" aria-label="Part kinds">
                      <For each={currentView().kindTabs}>{(tab) =>
                        <a
                          class="tab font-mono text-xs font-semibold uppercase tracking-[0.06em]"
                          classList={{ "tab-active": tab.active }}
                          href={tab.href}
                          role="tab"
                          aria-selected={tab.active}
                          onClick={(event) => follow(event, tab.href)}
                        >{tab.kind}</a>
                      }</For>
                    </div>
                  </div>

                  <div class="flex items-center gap-3 px-6 py-2.5 border-b border-base-300 bg-base-200/60 flex-wrap">
                    <label class="relative flex-shrink-0 w-[14rem]">
                      <svg viewBox="0 0 24 24" aria-hidden="true" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-[0.85rem] h-[0.85rem] text-base-content/40 pointer-events-none" fill="none" stroke="currentColor" stroke-width="1.8">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="M16 16l5 5" />
                      </svg>
                      <input
                        value={searchDraft()}
                        onInput={(event) => {
                          const value = event.currentTarget.value;
                          setSearchDraft(value);
                          submitSearch(value);
                        }}
                        type="search"
                        placeholder="Search models..."
                        class="input input-bordered input-xs w-full pl-7 font-mono text-xs"
                        role="searchbox"
                        aria-label="Search models"
                      />
                    </label>

                    <Show when={currentView().numericFilterGroups.length > 0}>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <For each={currentView().numericFilterGroups}>{(group) => {
                          const id = `filter-popover-${group.label.replace(/\s+/g, "-").toLowerCase()}`;
                          return <div class="relative">
                            <button
                              type="button"
                              class="filter-chip"
                              data-filter-chip
                              classList={{ "filter-chip-active": group.activeCount > 0 }}
                              aria-expanded={openFilter() === id}
                              aria-controls={id}
                              onClick={() => setOpenFilter(openFilter() === id ? undefined : id)}
                            >
                              <span class="filter-chip-label">{group.label}</span>
                              <span class="filter-chip-value">{group.summary}</span>
                            </button>
                            <Show when={openFilter() === id}>
                              <div id={id} class="filter-popover filter-popover-open" data-filter-popover>
                                <div class="filter-popover-header">{group.label}</div>
                                <div class="filter-popover-body">
                                  <Show when={group.options.length > 0}>
                                    <div class="flex flex-col gap-1.5">
                                      <span class="font-mono text-[0.6rem] font-bold uppercase tracking-[0.06em] text-base-content/60">Options</span>
                                      <div class="flex flex-wrap gap-1.5">
                                        <For each={group.options}>{(option) =>
                                          <a
                                            href={option.href}
                                            class="btn btn-xs font-mono inline-flex items-center gap-1"
                                            classList={{ "btn-primary": option.active, "btn-outline": !option.active }}
                                            onClick={(event) => {
                                              setOpenFilter(undefined);
                                              follow(event, option.href);
                                            }}
                                          >
                                            <span>{option.label}</span>
                                            <Show when={option.tooltip}>
                                              <span class="inline-grid w-3 h-3 place-items-center border border-current rounded-full text-[0.5rem] font-extrabold leading-none cursor-help" title={option.tooltip} aria-label={option.tooltip}>i</span>
                                            </Show>
                                          </a>
                                        }</For>
                                      </div>
                                    </div>
                                  </Show>
                                  <For each={group.filters}>{(filter) =>
                                    <label class="flex flex-col gap-1">
                                      <span class="font-mono text-[0.6rem] font-bold uppercase tracking-[0.06em] text-base-content/60">{filter.label}</span>
                                      <input
                                        class="range range-xs range-primary"
                                        type="range"
                                        min="0"
                                        max={filter.max}
                                        step={filter.step}
                                        value={draftValue(filter)}
                                        aria-label={`${filter.label} slider`}
                                        onInput={(event) => commitDraft(filter.name, event.currentTarget.value)}
                                      />
                                      <div class="flex items-center gap-1">
                                        <input
                                          type="number"
                                          min="0"
                                          max={filter.max}
                                          step={filter.step}
                                          value={numericDrafts()[filter.name] ?? (filter.active || filter.derived ? String(filter.value) : "")}
                                          placeholder={`${filter.max}`}
                                          class="input input-bordered input-xs w-20 text-right font-mono text-xs"
                                          aria-label={filter.label}
                                          onInput={(event) => commitDraft(filter.name, event.currentTarget.value)}
                                        />
                                        <span class="font-mono text-[0.7rem] text-base-content/40">{filter.unit}</span>
                                      </div>
                                    </label>
                                  }</For>
                                </div>
                              </div>
                            </Show>
                          </div>;
                        }}</For>
                      </div>
                    </Show>

                    <label class="flex items-center flex-shrink-0">
                      <span
                        class="flex items-center gap-1.5 px-2 py-1 border rounded-md cursor-pointer transition"
                        classList={{ "border-primary bg-primary/5": currentView().state.showSparseRows, "border-base-300": !currentView().state.showSparseRows }}
                      >
                        <input
                          type="checkbox"
                          checked={currentView().state.showSparseRows}
                          class="toggle toggle-primary toggle-xs"
                          aria-label="Show sparse rows"
                          onChange={(event) => updateQuery("show-sparse", event.currentTarget.checked ? "1" : undefined)}
                        />
                        <span class="font-mono text-[0.6rem] font-bold uppercase tracking-[0.06em] text-base-content/60 whitespace-nowrap">Sparse</span>
                        <span class="tooltip tooltip-top z-20" data-tip={sparseRowsTooltip}>
                          <span class="inline-grid w-3.5 h-3.5 place-items-center border border-base-content/20 rounded-full text-base-content/50 text-[0.58rem] font-extrabold leading-none cursor-help" aria-label={sparseRowsTooltip}>i</span>
                        </span>
                      </span>
                    </label>

                    <Show when={hasActiveNumericFilter()}>
                      <a class="btn btn-link btn-xs font-mono font-semibold flex-shrink-0" href={currentView().clearFiltersUrl} onClick={(event) => follow(event, currentView().clearFiltersUrl)}>Clear</a>
                    </Show>
                    <Show when={loading()}>
                      <span class="loading loading-spinner loading-xs text-primary" aria-label="Updating table" />
                    </Show>
                  </div>

                  <Show when={currentView().tableNotice}>
                    <div class="mx-6 my-3 px-4 py-3 border border-base-300 rounded-btn bg-base-200 text-sm text-base-content/60">{currentView().tableNotice}</div>
                  </Show>

                  <div class="flex flex-1 flex-col min-h-0 overflow-hidden">
                    <div class="flex-1 overflow-auto" ref={(el) => setScrollEl(el)}>
                      <Show when={!isDesktop()}>
                        <div class="p-4" style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                          <For each={virtualRows()}>{(item) => {
                            const row = () => rows()[item.index];
                            return <div
                              data-index={item.index}
                              ref={(el) => virtualizer.measureElement(el)}
                              class="pb-3"
                              style={{ position: "absolute", top: "0", left: "0", width: "100%", transform: `translateY(${item.start}px)` }}
                            >
                              <div
                                class="card card-bordered bg-base-100"
                                classList={{ "bg-success/[0.05] border-success/25": row().verdict === "pass", "bg-warning/[0.06] border-warning/30": row().verdict === "conditional", "bg-error/[0.06] border-error/30": row().verdict === "fail" }}
                              >
                                <div class="flex items-center justify-end px-4 py-3 border-b border-base-300/70 bg-base-200/60">
                                  <a class="btn btn-xs" classList={{ "btn-primary": row().selected, "btn-ghost": !row().selected }} href={row().actionUrl} onClick={(event) => follow(event, row().actionUrl)}>{row().actionLabel}</a>
                                </div>
                                <div class="flex flex-col gap-2 p-4">
                                  <h2 class="truncate text-base font-semibold leading-tight" title={row().title}>{row().title}</h2>
                                  <div class="grid grid-cols-2 gap-2 py-1">
                                    <For each={row().mobileMetrics}>{(metric) =>
                                      <div class="flex flex-col p-2.5 border rounded-btn bg-base-200 font-mono" classList={{ "border-error/25 bg-error/[0.04]": metric.alert }}>
                                        <span class="text-[0.6rem] font-bold uppercase tracking-wider text-base-content/40" classList={{ "!text-error": metric.alert }}>{metric.label}</span>
                                        <span class="text-sm font-semibold" classList={{ "text-error font-bold": metric.alert }} style={isPsuBadge(metric.value) ? { "background-color": psuBadgeBackground(metric.value) } : undefined}><CatalogValue value={metric.value} /></span>
                                      </div>
                                    }</For>
                                  </div>
                                  <Show when={row().note}>
                                    <p class="px-3 py-2 text-sm text-base-content/70 bg-base-200 rounded-btn leading-relaxed"><CatalogValue value={row().note} /></p>
                                  </Show>
                                </div>
                              </div>
                            </div>;
                          }}</For>
                        </div>
                      </Show>

                      <Show when={isDesktop()}>
                      <table class="data-table">
                        <thead><tr>
                          <Show when={actionHeader()}><th class="action-column">{actionHeader()?.label}</th></Show>
                          <For each={dataTableHeaders()}>{(header) =>
                            <th classList={{ "notes-column": header.key === "notes" }} aria-sort={header.sortable ? (header.sortDir === "asc" ? "ascending" : header.sortDir === "desc" ? "descending" : "none") : undefined}>
                              <Show
                                when={header.sortable}
                                fallback={header.label}
                              >
                                <a class="inline-flex items-center gap-1 no-underline transition hover:text-primary" classList={{ "text-primary": Boolean(header.sortDir) }} href={header.sortUrl} onClick={(event) => follow(event, header.sortUrl)}>
                                  <span>{header.label}</span>
                                  <span class="flex flex-col items-center leading-[0.6] text-base-content/40" aria-hidden="true">
                                    <svg width="10" height="14" viewBox="0 0 10 14"><path d="M5 3L2 7h6L5 3z" fill="currentColor" opacity={header.sortDir === "asc" ? "1" : "0.25"} /><path d="M5 11l3-4H2l3 4z" fill="currentColor" opacity={header.sortDir === "desc" ? "1" : "0.25"} /></svg>
                                  </span>
                                </a>
                              </Show>
                            </th>
                          }</For>
                        </tr></thead>
                        <Show when={rows().length > 0}>
                          <tbody>
                            <tr aria-hidden="true" style={{ height: `${paddingTop()}px` }} />
                            <For each={virtualRows()}>{(item) => {
                              const row = () => rows()[item.index];
                              return <tr
                                data-index={item.index}
                                ref={(el) => virtualizer.measureElement(el)}
                                class={`data-row data-row-${row().verdict}`}
                                classList={{ "data-row-selected": row().selected }}
                              >
                                <td class="action-column whitespace-nowrap w-[1%]"><a class="btn btn-xs" classList={{ "btn-primary": row().selected, "btn-ghost": !row().selected }} href={row().actionUrl} onClick={(event) => follow(event, row().actionUrl)}>{row().actionLabel}</a></td>
                                <td><strong class="block max-w-[24rem] truncate text-[0.95rem] font-semibold leading-snug" title={row().title}>{row().title}</strong></td>
                                <For each={row().cells}>{(cell) =>
                                  <td class="font-mono text-sm whitespace-nowrap tabular-nums" classList={{ "bg-error/[0.06] !text-error font-bold": cell.evidenceVerdict === "fail", "bg-warning/[0.04] !text-warning font-semibold": cell.evidenceVerdict === "conditional" }} style={isPsuBadge(cell.value) ? { "background-color": psuBadgeBackground(cell.value) } : undefined} title={cell.evidenceMessages.join("; ")}><CatalogValue value={cell.value} /></td>
                                }</For>
                                <td class="notes-column text-sm text-base-content/60 leading-relaxed"><CatalogValue value={row().note} /></td>
                              </tr>;
                            }}</For>
                            <tr aria-hidden="true" style={{ height: `${paddingBottom()}px` }} />
                          </tbody>
                        </Show>
                      </table>
                      </Show>

                      <Show when={rows().length === 0}>
                        <div class="py-10 px-6 text-center">
                          <p class="text-sm font-medium text-base-content/50">No rows match the active filters.</p>
                          <Show when={hasActiveNumericFilter()}><a class="btn btn-link btn-sm mt-3" href={currentView().clearFiltersUrl} onClick={(event) => follow(event, currentView().clearFiltersUrl)}>Clear filters</a></Show>
                        </div>
                      </Show>
                    </div>

                    <footer class="flex flex-shrink-0 items-center gap-4 px-6 py-3 border-t border-base-300 bg-base-100">
                      <span class="text-sm text-base-content/40">{currentView().totalRows.toLocaleString()} rows{currentView().state.search.trim() ? ` matching “${currentView().state.search.trim()}”` : ""}</span>
                    </footer>
                  </div>
                </section>
              </div>

              <div class="drawer-side z-50">
                <label for="build-drawer-toggle" aria-label="close sidebar" class="drawer-overlay" />
                <aside id="build-drawer" class="sidebar flex flex-col w-80 h-full bg-base-200 border-r border-base-300 overflow-y-auto">
                  <div class="flex items-start justify-between gap-4 p-5 border-b border-base-300">
                    <div>
                      <h1 class="text-xl font-bold tracking-[-0.02em] mb-1">{hasAnySelection() ? "Current Build" : "SFF Builder"}</h1>
                      <Show when={hasAnySelection()} fallback={<p class="text-sm text-base-content/60">Fitment engine for small-form-factor PC builds.</p>}>
                        <p class="text-sm text-base-content/60">Status: <strong classList={{ "text-warning": currentView().buildStatus === "in-progress" || currentView().buildStatus === "conditional", "text-success": currentView().buildStatus === "pass", "text-error": currentView().buildStatus === "fail" }}>{currentView().buildStatusLabel}</strong></p>
                        <Show when={currentView().buildStatusCopy}><span class="block mt-2 text-sm text-base-content/60 leading-relaxed">{currentView().buildStatusCopy}</span></Show>
                      </Show>
                    </div>
                    <label for="build-drawer-toggle" class="btn btn-sm btn-ghost btn-square lg:hidden" aria-label="Close current build panel"><svg viewBox="0 0 24 24" aria-hidden="true" class="w-[0.9rem] h-[0.9rem]"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" /></svg></label>
                  </div>

                  <div class="grid gap-2.5 p-4">
                    <Show
                      when={hasAnySelection()}
                      fallback={<div class="card card-bordered bg-base-100"><div class="card-body p-5 gap-0"><h2 class="text-lg font-bold tracking-[-0.01em] mb-3">Getting Started</h2><p class="text-sm text-base-content/60 leading-relaxed mb-3">This tool checks whether PC parts physically fit together. Search for a case or GPU in the table, then add more parts to check compatibility.</p><p class="text-sm text-base-content/60 leading-relaxed">Dimensions are compared in millimeters. Results show <span class="badge badge-xs badge-success font-mono font-bold !text-success-content">PASS</span> (fits), <span class="badge badge-xs badge-warning font-mono font-bold !text-warning-content">CONDITIONAL</span> (may fit — check notes), or <span class="badge badge-xs badge-error font-mono font-bold !text-error-content">FAIL</span> (won&apos;t fit). You can still select failing parts to understand why.</p></div></div>}
                    >
                      <For each={currentView().slots.filter((slot) => slot.id)}>{(slot) =>
                        <div class="card bg-base-100">
                          <div class="card-body p-3.5 gap-0">
                            <div class="flex items-center justify-between gap-2"><span class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-base-content/60">{slot.label}</span><div class="flex items-center gap-1.5"><span class="badge badge-xs font-mono font-bold uppercase tracking-[0.06em]" classList={{ "badge-success": slot.verdict === "pass", "badge-warning": slot.verdict === "conditional", "badge-error": slot.verdict === "fail", "badge-ghost": slot.verdict === "unscored" }} title={slot.verdictTooltip}>{slot.verdictCopy}</span><a class="btn btn-xs btn-ghost btn-square text-error" href={slot.clearUrl} aria-label={`Clear ${slot.kind}`} title="Clear" onClick={(event) => follow(event, slot.clearUrl)}><svg viewBox="0 0 24 24" aria-hidden="true" class="w-3 h-3"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" /></svg></a></div></div>
                            <h2 class="text-base font-semibold leading-tight mt-2.5 mb-0.5">{slot.title}</h2>
                            <Show when={slot.subtitle}><p class="text-sm text-base-content/60"><CatalogValue value={slot.subtitle ?? ""} /></p></Show>
                            <Show when={slot.specs.length > 0}><dl
                              class="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-base-300"
                              classList={{ "border-b": slot.issues.length > 0 || Boolean(slot.note), "pb-2.5": slot.issues.length > 0 || Boolean(slot.note) }}
                            ><For each={slot.specs}>{(spec) => <div><dt class="font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-base-content/60">{spec.label}</dt><dd class="text-sm font-medium mt-0.5 leading-tight break-words"><CatalogValue value={spec.value} /></dd></div>}</For></dl></Show>
                            <Show
                              when={slot.issues.length > 0}
                              fallback={<Show when={slot.note}><p class="mt-2.5 p-2 rounded-btn text-sm text-base-content/60" classList={{ "bg-error/10": slot.state === "unresolved", "bg-base-200": slot.state !== "unresolved" }}>{slot.note}</p></Show>}
                            >
                              <div class="mt-2.5">
                                <h3 class="mb-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-base-content/60">Issues</h3>
                                <ul class="flex flex-col divide-y divide-base-300/60 overflow-hidden rounded-btn border border-base-300">
                                  <For each={slot.issues}>{(issue) => {
                                    const detail = issueDetail(issue.title, issue.message);
                                    return <Show
                                      when={!issue.ignored}
                                      fallback={
                                        <li class="flex items-center justify-between gap-2 bg-base-200/40 px-2.5 py-1.5">
                                          <span class="min-w-0 truncate text-xs text-base-content/45" title={issue.message}>{issue.title}</span>
                                          <button
                                            type="button"
                                            class="btn btn-ghost btn-xs btn-square shrink-0 text-base-content/50"
                                            title="Show this warning again"
                                            aria-label={`Show ${issue.title} again`}
                                            onClick={() => restoreWarning(issue.code)}
                                          >
                                            <svg viewBox="0 0 24 24" aria-hidden="true" class="w-3.5 h-3.5"><path d="M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                                          </button>
                                        </li>
                                      }
                                    >
                                      <li class="p-2.5" classList={{ "bg-error/[0.06]": issue.verdict === "fail", "bg-warning/[0.07]": issue.verdict === "conditional" }}>
                                        <div class="flex items-start justify-between gap-2">
                                          <span class="text-sm font-semibold leading-snug">{issue.title}</span>
                                          <Show
                                            when={issue.dismissible}
                                            fallback={<span class="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.04em] text-base-content/40">Hard conflict</span>}
                                          >
                                            <button
                                              type="button"
                                              class="btn btn-ghost btn-xs btn-square shrink-0 text-base-content/50 hover:text-error"
                                              title="Ignore this warning in every build on this browser"
                                              aria-label={`Ignore ${issue.title}`}
                                              onClick={() => ignoreWarning(issue.code)}
                                            >
                                              <svg viewBox="0 0 24 24" aria-hidden="true" class="w-3.5 h-3.5"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
                                            </button>
                                          </Show>
                                        </div>
                                        <Show when={detail}>
                                          <p class="mt-1 text-xs leading-relaxed text-base-content/60">{detail}</p>
                                        </Show>
                                      </li>
                                    </Show>;
                                  }}</For>
                                </ul>
                              </div>
                            </Show>
                          </div>
                        </div>
                      }</For>
                      <Show when={sidebarHint()}>
                        <p class="text-xs text-base-content/50 pt-2 text-center font-medium">{sidebarHint()}</p>
                      </Show>
                      <button
                        type="button"
                        class="btn btn-primary btn-sm w-full gap-2 mt-1"
                        aria-live="polite"
                        onClick={copyBuild}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4">
                          <path d="M9 4h6v3H9zM7 5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <span>{copiedBuild() ? "Copied to clipboard" : "Copy your build"}</span>
                      </button>
                    </Show>
                  </div>

                  <div class="mt-auto flex flex-col gap-3 mx-4 mb-4">
                    <Show when={ignoredWarnings().length > 0}>
                      <details class="p-3 border border-base-300 rounded-btn bg-base-200/60">
                      <summary class="cursor-pointer font-mono text-[0.6rem] font-bold uppercase tracking-[0.06em] text-base-content/50">
                        {ignoredWarnings().length} ignored warning{ignoredWarnings().length === 1 ? "" : "s"}
                      </summary>
                      <ul class="mt-2 flex flex-col gap-1">
                        <For each={ignoredWarnings()}>{(code) =>
                          <li class="flex items-center justify-between gap-2 text-xs leading-snug text-base-content/60">
                            <span>{issueTitleForCode(code)}</span>
                            <button
                              type="button"
                              class="btn btn-ghost btn-xs shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.04em]"
                              onClick={() => restoreWarning(code)}
                            >Restore</button>
                          </li>
                        }</For>
                      </ul>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs mt-1 font-mono text-[0.6rem] uppercase tracking-[0.04em]"
                        onClick={restoreAllIgnoredWarnings}
                      >Restore all</button>
                      </details>
                    </Show>

                    <footer class="border-t border-base-300 pt-3">
                      <p class="font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] text-base-content/50">Data sources</p>
                      <ul class="mt-1.5 flex flex-col gap-1 text-[0.7rem] leading-snug">
                        <For each={dataSources}>{(source) =>
                          <li>
                            <a
                              class="link link-hover font-medium text-base-content/60"
                              href={source.href}
                              target="_blank"
                              rel="noreferrer"
                            >{source.label}</a>
                            <span class="text-base-content/40"> — {source.note}</span>
                          </li>
                        }</For>
                      </ul>
                      <p class="mt-3 text-[0.7rem] text-base-content/50">
                        Built by{" "}
                        <a
                          class="link link-hover font-medium text-base-content/70"
                          href="https://maxarias.com"
                          target="_blank"
                          rel="noreferrer"
                        >maxarias.com</a>
                      </p>
                    </footer>
                  </div>
                  <Show when={status()}>{(catalogStatus) => <p class="px-5 pb-4 font-mono text-[0.6rem] uppercase tracking-[0.06em] text-base-content/40">{catalogStatus().rows.toLocaleString()} local records · {catalogStatus().downloaded ? "downloaded" : "ready"}</p>}</Show>
                </aside>
              </div>
            </div>
          </>;
        }}
      </Show>
    </main>
  );
}
