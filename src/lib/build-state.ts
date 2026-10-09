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
  sort: string;
  dir: "asc" | "desc";
  showSparseRows: boolean;
  caseVolumeTier: CaseVolumeTier | null;
  caseIntent: CaseIntent | null;
  caseSource: CaseSource | null;
  gpuBrand: string | null;
  /** Generic numeric max filters keyed by query param name (e.g. "case-max-volume-l", "max-gpu-length-mm") */
  numericFilters: Record<string, number>;
  psuTier: PsuTierFilter | null;
  psuFormFactor: PsuFormFactorFilter | null;
  psuFeatures: PsuFeatureFilter[];
  caseMotherboardFormFactor: MotherboardFormFactorFilter | null;
  casePsuFormFactor: PsuFormFactorFilter | null;
  motherboardFormFactor: MotherboardFormFactorFilter | null;
}

export type CaseVolumeTier = "sub-10l" | "10l-20l" | "over-20l";

export type CaseIntent = "steam-machine";

export type CaseSource = "commercial" | "printed" | "printable";

export type PsuTierFilter = "a-or-better" | "b-or-better" | "c-or-better";

export type PsuFormFactorFilter =
  | "sfx"
  | "sfx-l"
  | "flex-atx"
  | "atx"
  | "tfx"
  | "1u";

export type MotherboardFormFactorFilter =
  | "mitx"
  | "matx"
  | "mdtx"
  | "atx"
  | "eatx"
  | "mstx"
  | "ssiceb"
  | "ssieeb"
  | "xlatx"
  | "custom";

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
  sort: string;
  dir: "asc" | "desc";
  showSparseRows: boolean;
  caseVolumeTier: CaseVolumeTier | null;
  caseIntent: CaseIntent | null;
  caseSource: CaseSource | null;
  gpuBrand: string | null;
  numericFilters: Record<string, number>;
  psuTier: PsuTierFilter | null;
  psuFormFactor: PsuFormFactorFilter | null;
  psuFeatures: PsuFeatureFilter[];
  caseMotherboardFormFactor: MotherboardFormFactorFilter | null;
  casePsuFormFactor: PsuFormFactorFilter | null;
  motherboardFormFactor: MotherboardFormFactorFilter | null;
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

const numericFilterParamPrefixesByKind: Record<SelectableKind, string[]> = {
  case: ["case-max-"],
  gpu: ["max-gpu-"],
  "cpu-cooler": ["cooler-max-"],
  psu: ["psu-max-"],
  motherboard: ["mobo-max-"],
  ram: ["ram-max-"],
};

function numericFilterAppliesToKind(paramName: string, kind: SelectableKind) {
  return numericFilterParamPrefixesByKind[kind].some((prefix) =>
    paramName.startsWith(prefix),
  );
}

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
    caseSource: sanitizeCaseSource(url.searchParams.get("case-source")),
    gpuBrand: sanitizeGpuBrand(url.searchParams.get("gpu-brand")),
    numericFilters: parseNumericFilters(url),
    psuTier: sanitizePsuTier(url.searchParams.get("psu-tier")),
    psuFormFactor: sanitizePsuFormFactor(url.searchParams.get("psu-form")),
    psuFeatures: url.searchParams.getAll("psu-feature").filter(isPsuFeature),
    caseMotherboardFormFactor: sanitizeMotherboardFormFactor(
      url.searchParams.get("case-mobo"),
    ),
    casePsuFormFactor: sanitizePsuFormFactor(url.searchParams.get("case-psu")),
    motherboardFormFactor: sanitizeMotherboardFormFactor(
      url.searchParams.get("mobo-form"),
    ),
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
  const search = patch.kind !== undefined && patch.kind !== state.kind
    ? ""
    : (patch.search ?? state.search);
  const sort = patch.sort ?? state.sort;
  const dir = patch.dir ?? state.dir;
  const showSparseRows = patch.showSparseRows ?? state.showSparseRows;
  const caseVolumeTier =
    patch.caseVolumeTier !== undefined
      ? patch.caseVolumeTier
      : state.caseVolumeTier;
  const caseIntent =
    patch.caseIntent !== undefined ? patch.caseIntent : state.caseIntent;
  const caseSource = patch.caseSource !== undefined ? patch.caseSource : state.caseSource;
  const gpuBrand = patch.gpuBrand !== undefined ? patch.gpuBrand : state.gpuBrand;
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
  const caseMotherboardFormFactor =
    patch.caseMotherboardFormFactor !== undefined
      ? patch.caseMotherboardFormFactor
      : state.caseMotherboardFormFactor;
  const casePsuFormFactor =
    patch.casePsuFormFactor !== undefined
      ? patch.casePsuFormFactor
      : state.casePsuFormFactor;
  const motherboardFormFactor =
    patch.motherboardFormFactor !== undefined
      ? patch.motherboardFormFactor
      : state.motherboardFormFactor;
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
  if (kind === "case" && caseSource) params.set("case-source", caseSource);
  if (kind === "gpu" && gpuBrand) params.set("gpu-brand", gpuBrand);
  if (kind === "psu" && psuTier) params.set("psu-tier", psuTier);
  if (kind === "psu" && psuFormFactor) params.set("psu-form", psuFormFactor);
  if (kind === "psu") {
    for (const feature of psuFeatures) params.append("psu-feature", feature);
  }
  if (kind === "case" && caseMotherboardFormFactor) {
    params.set("case-mobo", caseMotherboardFormFactor);
  }
  if (kind === "case" && casePsuFormFactor) {
    params.set("case-psu", casePsuFormFactor);
  }
  if (kind === "motherboard" && motherboardFormFactor) {
    params.set("mobo-form", motherboardFormFactor);
  }
  for (const [paramName, value] of Object.entries(numericFilters)) {
    if (
      value !== null &&
      value !== undefined &&
      numericFilterParamNames.includes(paramName as any) &&
      numericFilterAppliesToKind(paramName, kind)
    ) {
      params.set(paramName, formatQueryNumber(value));
    }
  }

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

function sanitizeCaseSource(value: string | null): CaseSource | null {
  return value === "commercial" || value === "printed" || value === "printable" ? value : null;
}

function sanitizeGpuBrand(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
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

const MOTHERBOARD_FORM_FACTOR_VALUES: Record<string, true> = {
  mitx: true,
  matx: true,
  mdtx: true,
  atx: true,
  eatx: true,
  mstx: true,
  ssiceb: true,
  ssieeb: true,
  xlatx: true,
  custom: true,
};

function sanitizeMotherboardFormFactor(
  value: string | null,
): MotherboardFormFactorFilter | null {
  return value && Object.hasOwn(MOTHERBOARD_FORM_FACTOR_VALUES, value)
    ? (value as MotherboardFormFactorFilter)
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
