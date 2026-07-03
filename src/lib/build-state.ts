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
  maxVolumeL: number | null;
  maxGpuLengthMm: number | null;
  maxGpuWidthMm: number | null;
  maxGpuHeightMm: number | null;
}

export type BuildQueryPatch = Partial<{
  selectedIds: SelectedIds;
  clearSlot: SelectableKind;
  kind: SelectableKind;
  search: string;
  page: number;
  sort: string;
  dir: "asc" | "desc";
  maxVolumeL: number | null;
  maxGpuLengthMm: number | null;
  maxGpuWidthMm: number | null;
  maxGpuHeightMm: number | null;
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

  return {
    selectedIds,
    kind: sanitizeKind(url.searchParams.get("kind")) ?? inferKind(selectedIds),
    search: url.searchParams.get("search") ?? "",
    page: Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1),
    sort: sanitizeSort(url.searchParams.get("sort")),
    dir: url.searchParams.get("dir") === "desc" ? "desc" : "asc",
    maxVolumeL: sanitizePositiveNumber(url.searchParams.get("max-volume-l")),
    maxGpuLengthMm: sanitizePositiveNumber(url.searchParams.get("max-gpu-length-mm")),
    maxGpuWidthMm: sanitizePositiveNumber(url.searchParams.get("max-gpu-width-mm")),
    maxGpuHeightMm: sanitizePositiveNumber(url.searchParams.get("max-gpu-height-mm")),
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
  const maxVolumeL = patch.maxVolumeL === undefined ? state.maxVolumeL : patch.maxVolumeL;
  const maxGpuLengthMm =
    patch.maxGpuLengthMm === undefined ? state.maxGpuLengthMm : patch.maxGpuLengthMm;
  const maxGpuWidthMm =
    patch.maxGpuWidthMm === undefined ? state.maxGpuWidthMm : patch.maxGpuWidthMm;
  const maxGpuHeightMm =
    patch.maxGpuHeightMm === undefined ? state.maxGpuHeightMm : patch.maxGpuHeightMm;
  const params = new URLSearchParams();

  slotOrder.forEach(({ kind: slotKind }) => {
    const value = selectedIds[slotKind];
    if (value) params.set(slotKind, value);
  });

  params.set("kind", kind);
  if (search.trim()) params.set("search", search.trim());
  if (sort !== "fitment") params.set("sort", sort);
  if (sort !== "fitment" && dir === "desc") params.set("dir", dir);
  if (kind === "case" && maxVolumeL !== null)
    params.set("max-volume-l", formatQueryNumber(maxVolumeL));
  if (kind === "gpu") {
    if (maxGpuLengthMm !== null) params.set("max-gpu-length-mm", formatQueryNumber(maxGpuLengthMm));
    if (maxGpuWidthMm !== null) params.set("max-gpu-width-mm", formatQueryNumber(maxGpuWidthMm));
    if (maxGpuHeightMm !== null) params.set("max-gpu-height-mm", formatQueryNumber(maxGpuHeightMm));
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
  if (!value) return "fitment";
  return /^[a-z0-9-]+$/i.test(value) ? value : "fitment";
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
