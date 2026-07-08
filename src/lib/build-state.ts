export type SelectableKind = "case" | "gpu" | "psu" | "cpu-cooler" | "motherboard" | "ram";

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
  // Case numeric filters
  caseMaxVolumeL: number | null;
  caseMaxGpuLengthMm: number | null;
  caseMaxGpuThicknessMm: number | null;
  caseMaxPcieSlots: number | null;
  // GPU numeric filters
  gpuMaxLengthMm: number | null;
  gpuMaxSlots: number | null;
  gpuMaxThicknessMm: number | null;
}

export type BuildQueryPatch = Partial<{
  selectedIds: SelectedIds;
  clearSlot: SelectableKind;
  kind: SelectableKind;
  search: string;
  page: number;
  sort: string;
  dir: "asc" | "desc";
  // Case numeric filters
  caseMaxVolumeL: number | null;
  caseMaxGpuLengthMm: number | null;
  caseMaxGpuThicknessMm: number | null;
  caseMaxPcieSlots: number | null;
  // GPU numeric filters
  gpuMaxLengthMm: number | null;
  gpuMaxSlots: number | null;
  gpuMaxThicknessMm: number | null;
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

export const selectableKinds = new Set<SelectableKind>(slotOrder.map((slot) => slot.kind));

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
    dir: dirParam === "desc" ? "desc" : dirParam === "asc" ? "asc" : (sort === "release-year" ? "desc" : "asc"),
    // Case numeric filters
    caseMaxVolumeL: sanitizePositiveNumber(url.searchParams.get("case-max-volume-l")),
    caseMaxGpuLengthMm: sanitizePositiveNumber(url.searchParams.get("case-max-gpu-length-mm")),
    caseMaxGpuThicknessMm: sanitizePositiveNumber(url.searchParams.get("case-max-gpu-thickness-mm")),
    caseMaxPcieSlots: sanitizePositiveNumber(url.searchParams.get("case-max-pcie-slots")),
    // GPU numeric filters
    gpuMaxLengthMm: sanitizePositiveNumber(url.searchParams.get("max-gpu-length-mm")),
    gpuMaxSlots: sanitizePositiveNumber(url.searchParams.get("max-gpu-slots")),
    gpuMaxThicknessMm: sanitizePositiveNumber(url.searchParams.get("max-gpu-thickness-mm")),
  };
}

export function buildUrl(state: BuildQueryState, patch: BuildQueryPatch = {}) {
  const selectedIds = { ...state.selectedIds, ...(patch.selectedIds ?? {}) };
  if (patch.clearSlot) delete selectedIds[patch.clearSlot];

  const kind = patch.kind ?? state.kind;
  const search = patch.search ?? state.search;
  const page = patch.resetPage ? 1 : (patch.page ?? state.page);
  const sort = patch.sort ?? state.sort;
  const dir = patch.dir ?? state.dir;
  // Case numeric filter consts
  const caseMaxVolumeL = patch.caseMaxVolumeL === undefined ? state.caseMaxVolumeL : patch.caseMaxVolumeL;
  const caseMaxGpuLengthMm = patch.caseMaxGpuLengthMm === undefined ? state.caseMaxGpuLengthMm : patch.caseMaxGpuLengthMm;
  const caseMaxGpuThicknessMm = patch.caseMaxGpuThicknessMm === undefined ? state.caseMaxGpuThicknessMm : patch.caseMaxGpuThicknessMm;
  const caseMaxPcieSlots = patch.caseMaxPcieSlots === undefined ? state.caseMaxPcieSlots : patch.caseMaxPcieSlots;
  // GPU numeric filter consts
  const gpuMaxLengthMm = patch.gpuMaxLengthMm === undefined ? state.gpuMaxLengthMm : patch.gpuMaxLengthMm;
  const gpuMaxSlots = patch.gpuMaxSlots === undefined ? state.gpuMaxSlots : patch.gpuMaxSlots;
  const gpuMaxThicknessMm = patch.gpuMaxThicknessMm === undefined ? state.gpuMaxThicknessMm : patch.gpuMaxThicknessMm;
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
  // Case numeric filters
  if (kind === "case") {
    if (caseMaxVolumeL !== null) params.set("case-max-volume-l", formatQueryNumber(caseMaxVolumeL));
    if (caseMaxGpuLengthMm !== null) params.set("case-max-gpu-length-mm", formatQueryNumber(caseMaxGpuLengthMm));
    if (caseMaxGpuThicknessMm !== null) params.set("case-max-gpu-thickness-mm", formatQueryNumber(caseMaxGpuThicknessMm));
    if (caseMaxPcieSlots !== null) params.set("case-max-pcie-slots", formatQueryNumber(caseMaxPcieSlots));
  }
  // GPU numeric filters
  if (kind === "gpu") {
    if (gpuMaxLengthMm !== null) params.set("max-gpu-length-mm", formatQueryNumber(gpuMaxLengthMm));
    if (gpuMaxSlots !== null) params.set("max-gpu-slots", formatQueryNumber(gpuMaxSlots));
    if (gpuMaxThicknessMm !== null) params.set("max-gpu-thickness-mm", formatQueryNumber(gpuMaxThicknessMm));
  }
  if (page > 1) params.set("page", String(page));

  const suffix = params.toString();
  return suffix ? `/build?${suffix}` : "/build";
}

function sanitizePositiveNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatQueryNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function sanitizeSort(value: string | null) {
  if (!value) return "release-year";
  return /^[a-z0-9-]+$/i.test(value) ? value : "release-year";
}

export function sanitizeKind(value: string | null): SelectableKind | null {
  if (!value) return null;
  return selectableKinds.has(value as SelectableKind) ? (value as SelectableKind) : null;
}

export function inferKind(ids: SelectedIds): SelectableKind {
  if (ids.case && !ids.gpu) return "gpu";
  if (ids.gpu && !ids.case) return "case";
  return "gpu";
}
