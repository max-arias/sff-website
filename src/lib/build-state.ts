export type SelectableKind =
  "case" | "gpu" | "psu" | "cpu-cooler" | "motherboard" | "ram";

export type SelectedIds = Partial<Record<SelectableKind, string>>;

export interface SlotDescriptor {
  kind: SelectableKind;
  label: string;
  actionLabel: string;
}

export interface BuildQueryState {
  selectedIds: SelectedIds;
  kind: SelectableKind;
  search: string;
  page: number;
  sort: string;
  dir: "asc" | "desc";
  showSparseRows: boolean;
  caseVolumeTier: CaseVolumeTier | null;
  caseIntent: CaseIntent | null;
  /** Generic numeric max filters keyed by query param name (e.g. "case-max-volume-l", "max-gpu-length-mm") */
  numericFilters: Record<string, number>;
  psuTier: PsuTierFilter | null;
  psuFormFactor: PsuFormFactorFilter | null;
  psuFeatures: PsuFeatureFilter[];
}

export type CaseVolumeTier = "sub-10l" | "10l-20l" | "over-20l";

export type CaseIntent = "steam-machine";

export type PsuTierFilter = "a-or-better" | "b-or-better" | "c-or-better";

export type PsuFormFactorFilter =
  | "sfx"
  | "sfx-l"
  | "flex-atx"
  | "atx"
  | "tfx"
  | "1u";

export type PsuFeatureFilter =
  | "atx-3"
  | "12vhpwr"
  | "fully-modular"
  | "semi-passive";

export type BuildQueryPatch = Partial<{
  selectedIds: SelectedIds;
  clearSlot: SelectableKind;
  kind: SelectableKind;
  search: string;
  page: number;
  sort: string;
  dir: "asc" | "desc";
  showSparseRows: boolean;
  caseVolumeTier: CaseVolumeTier | null;
  caseIntent: CaseIntent | null;
  numericFilters: Record<string, number>;
  psuTier: PsuTierFilter | null;
  psuFormFactor: PsuFormFactorFilter | null;
  psuFeatures: PsuFeatureFilter[];
  resetPage: boolean;
}>;

export const slotOrder: SlotDescriptor[] = [
  { kind: "case", label: "Case", actionLabel: "Browse cases" },
  { kind: "gpu", label: "GPU", actionLabel: "Browse GPUs" },
  { kind: "psu", label: "Power supply", actionLabel: "View PSUs" },
  { kind: "cpu-cooler", label: "CPU cooler", actionLabel: "Browse coolers" },
  { kind: "motherboard", label: "Motherboard", actionLabel: "Browse boards" },
  { kind: "ram", label: "RAM", actionLabel: "Browse memory" },
];

export const tabOrder: SelectableKind[] = [
  "case",
  "gpu",
  "psu",
  "cpu-cooler",
  "motherboard",
  "ram",
];

export const selectableKinds = new Set<SelectableKind>(
  slotOrder.map((slot) => slot.kind),
);

import { NUMERIC_FILTER_PARAM_NAMES as numericFilterParamNames } from "./build-filter-params";

function parseNumericFilters(url: URL): Record<string, number> {
  const filters: Record<string, number> = {};
  for (const name of numericFilterParamNames) {
    const value = sanitizePositiveNumber(url.searchParams.get(name));
    if (value !== null) filters[name] = value;
  }
  return filters;
}

export function parseBuildQuery(url: URL): BuildQueryState {
  const selectedIds: SelectedIds = {};

  slotOrder.forEach(({ kind }) => {
    const value = url.searchParams.get(kind);
    if (value) selectedIds[kind] = value;
  });

  const sort = sanitizeSort(url.searchParams.get("sort"));
  const dirParam = url.searchParams.get("dir");

  return {
    selectedIds,
    kind: sanitizeKind(url.searchParams.get("kind")) ?? inferKind(selectedIds),
    search: url.searchParams.get("search") ?? "",
    page: Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1),
    sort,
    dir:
      dirParam === "desc"
        ? "desc"
        : dirParam === "asc"
          ? "asc"
          : sort === "release-year"
            ? "desc"
            : "asc",
    showSparseRows: url.searchParams.get("show-sparse") === "1",
    caseVolumeTier: sanitizeCaseVolumeTier(url.searchParams.get("case-volume")),
    caseIntent: sanitizeCaseIntent(url.searchParams.get("case-intent")),
    numericFilters: parseNumericFilters(url),
    psuTier: sanitizePsuTier(url.searchParams.get("psu-tier")),
    psuFormFactor: sanitizePsuFormFactor(url.searchParams.get("psu-form")),
    psuFeatures: url.searchParams.getAll("psu-feature").filter(isPsuFeature),
  };
}

/**
 * Canonical helper that builds URLSearchParams from BuildQueryState.
 *
 * Every query parameter that parseBuildQuery reads is written here.
 * buildUrl and searchHiddenInputs both derive from this single helper,
 * eliminating the risk of param drift.
 */
export function buildSearchParams(
  state: BuildQueryState,
  patch: BuildQueryPatch = {},
): URLSearchParams {
  const selectedIds = { ...state.selectedIds, ...(patch.selectedIds ?? {}) };
  if (patch.clearSlot) delete selectedIds[patch.clearSlot];

  const kind = patch.kind ?? state.kind;
  const search = patch.search ?? state.search;
  const page = patch.resetPage ? 1 : (patch.page ?? state.page);
  const sort = patch.sort ?? state.sort;
  const dir = patch.dir ?? state.dir;
  const showSparseRows = patch.showSparseRows ?? state.showSparseRows;
  const caseVolumeTier =
    patch.caseVolumeTier !== undefined
      ? patch.caseVolumeTier
      : state.caseVolumeTier;
  const caseIntent =
    patch.caseIntent !== undefined ? patch.caseIntent : state.caseIntent;
  const numericFilters =
    patch.numericFilters !== undefined
      ? patch.numericFilters
      : state.numericFilters;
  const psuTier = patch.psuTier !== undefined ? patch.psuTier : state.psuTier;
  const psuFormFactor =
    patch.psuFormFactor !== undefined
      ? patch.psuFormFactor
      : state.psuFormFactor;
  const psuFeatures =
    patch.psuFeatures !== undefined ? patch.psuFeatures : state.psuFeatures;
  const params = new URLSearchParams();

  slotOrder.forEach(({ kind: slotKind }) => {
    const value = selectedIds[slotKind];
    if (value) params.set(slotKind, value);
  });

  params.set("kind", kind);
  if (search.trim()) params.set("search", search.trim());
  if (sort !== "release-year") params.set("sort", sort);
  if (sort === "release-year") {
    if (dir !== "desc") params.set("dir", dir);
  } else {
    if (dir === "desc") params.set("dir", dir);
  }
  if (showSparseRows) params.set("show-sparse", "1");
  if (kind === "case" && caseVolumeTier) params.set("case-volume", caseVolumeTier);
  if (kind === "case" && caseIntent) params.set("case-intent", caseIntent);
  if (kind === "psu" && psuTier) params.set("psu-tier", psuTier);
  if (kind === "psu" && psuFormFactor) params.set("psu-form", psuFormFactor);
  if (kind === "psu") {
    for (const feature of psuFeatures) params.append("psu-feature", feature);
  }
  for (const [paramName, value] of Object.entries(numericFilters)) {
    if (value !== null && value !== undefined) {
      params.set(paramName, formatQueryNumber(value));
    }
  }
  if (page > 1) params.set("page", String(page));

  return params;
}

export function buildUrl(state: BuildQueryState, patch: BuildQueryPatch = {}) {
  const params = buildSearchParams(state, patch);
  const suffix = params.toString();
  return suffix ? `/build?${suffix}` : "/build";
}

function sanitizePositiveNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function sanitizeCaseVolumeTier(value: string | null): CaseVolumeTier | null {
  return value === "sub-10l" || value === "10l-20l" || value === "over-20l"
    ? value
    : null;
}

function sanitizeCaseIntent(value: string | null): CaseIntent | null {
  return value === "steam-machine" ? value : null;
}

function sanitizePsuTier(value: string | null): PsuTierFilter | null {
  return value === "a-or-better" || value === "b-or-better" || value === "c-or-better"
    ? value
    : null;
}

function sanitizePsuFormFactor(value: string | null): PsuFormFactorFilter | null {
  return value === "sfx" ||
    value === "sfx-l" ||
    value === "flex-atx" ||
    value === "atx" ||
    value === "tfx" ||
    value === "1u"
    ? value
    : null;
}

function isPsuFeature(value: string): value is PsuFeatureFilter {
  return value === "atx-3" ||
    value === "12vhpwr" ||
    value === "fully-modular" ||
    value === "semi-passive";
}

function formatQueryNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

function sanitizeSort(value: string | null) {
  if (!value) return "release-year";
  return /^[a-z0-9-]+$/i.test(value) ? value : "release-year";
}

export function sanitizeKind(value: string | null): SelectableKind | null {
  if (!value) return null;
  return selectableKinds.has(value as SelectableKind)
    ? (value as SelectableKind)
    : null;
}

export function inferKind(ids: SelectedIds): SelectableKind {
  if (ids.case && !ids.gpu) return "gpu";
  if (ids.gpu && !ids.case) return "case";
  return "case";
}
