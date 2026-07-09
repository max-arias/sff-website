import type { APIContext } from "astro";
import {
  buildUrl,
  parseBuildQuery,
  slotOrder,
  tabOrder,
  type BuildQueryState,
  type SelectableKind,
} from "../lib/build-state";
import { checkCaseGpuCompatibility } from "../lib/compatibility";
import { loadCatalog, loadCatalogPartsByIds, loadParts, searchCatalog } from "./d1";
import type { CasePart, FitVerdict, GenericPart, GpuPart } from "../types";

type PartRecord = GenericPart | CasePart | GpuPart;
type DisplayVerdict = FitVerdict | "unscored";
type BuildStatus = FitVerdict | "in-progress";
type FitmentCheck = {
  verdict: DisplayVerdict;
  message: string;
  cellIndex?: number;
  advisory?: boolean;
};
type FitmentSummary = {
  verdict: DisplayVerdict;
  messages: string[];
  notes: string[];
  highlightCellIndex: number | null;
};
type SlotSpec = {
  label: string;
  value: string;
};

export interface BuildViewSlot {
  kind: SelectableKind;
  label: string;
  actionLabel: string;
  id: string;
  state: "resolved" | "unresolved";
  title: string;
  subtitle: string;
  note: string;
  verdict: DisplayVerdict;
  verdictCopy: string;
  verdictTooltip: string;
  specs: SlotSpec[];
  clearUrl: string;
  browseUrl: string;
}

export interface BuildViewRow {
  id: string;
  kind: SelectableKind;
  title: string;
  subtitle: string;
  cells: string[];
  verdict: DisplayVerdict;
  verdictLabel: string;
  verdictTooltip: string;
  note: string;
  selected: boolean;
  actionLabel: string;
  actionTone: "add" | "remove" | "swap";
  actionUrl: string;
  highlightCellIndex: number | null;
  releaseYear: number | null;
  mobileMetrics: Array<{ label: string; value: string; alert: boolean }>;
}

export interface BuildViewTableHeader {
  key: string;
  label: string;
  sortable: boolean;
  sortUrl: string;
  sortDir: "asc" | "desc" | null;
}

export interface BuildViewNumericFilter {
  name: "case-max-volume-l" | "case-max-gpu-length-mm" | "case-max-gpu-thickness-mm" | "case-max-pcie-slots" | "max-gpu-length-mm" | "max-gpu-slots" | "max-gpu-thickness-mm";
  label: string;
  unit: "L" | "mm" | "slots";
  max: number;
  step: number;
  value: number;
  active: boolean;
}

export interface BuildView {
  state: BuildQueryState;
  slotOrder: typeof slotOrder;
  tabOrder: typeof tabOrder;
  slots: BuildViewSlot[];
  buildStatus: BuildStatus;
  buildStatusLabel: string;
  buildStatusCopy: string;
  buildIssues: Array<{ kind: SelectableKind; label: string; issues: string[] }>;
  activeConstraintLabel: string;
  constraintMeters: Array<{
    label: string;
    value: string;
    tone: "pass" | "conditional" | "neutral";
    ratio: number;
  }>;
  kindTabs: Array<{ kind: SelectableKind; href: string; active: boolean }>;
  searchAction: string;
  hiddenInputs: Array<{ name: string; value: string }>;
  numericFilters: BuildViewNumericFilter[];
  clearFiltersUrl: string;
  tableHeaders: BuildViewTableHeader[];
  rows: BuildViewRow[];
  totalRows: number;
  displayStart: number;
  displayEnd: number;
  pageCount: number;
  previousUrl: string;
  nextUrl: string;
  psuTierSourceUrl: string;
  activeFilterChips: Array<{ label: string; href: string; tone?: "neutral" | "active" }>;
  tableNotice: string;
}

const pageSize = 25;
const psuPageSize = 500;
const psuTierSourceUrl =
  "https://docs.google.com/spreadsheets/d/1akCHL7Vhzk_EhrpIGkz8zTEvYfLDcaSpZRB6Xt6JWkc/edit";
const psuTokenAliases: Record<string, string> = {
  sfx: "sfx",
  sfxl: "sfxl",
  flexatx: "flexatx",
  flex: "flexatx",
  atx: "atx",
  tfx: "tfx",
  dcatx: "dcatx",
  dc: "dcatx",
  external: "external",
  custom: "custom",
  "1u": "1u",
};
const motherboardTokenAliases: Record<string, string> = {
  mitx: "mitx",
  miniitx: "mitx",
  matx: "matx",
  microatx: "matx",
  mdtx: "mdtx",
  minidtx: "mdtx",
  atx: "atx",
  eatx: "eatx",
  mstx: "mstx",
  ministx: "mstx",
  ssiceb: "ssiceb",
  ssieeb: "ssieeb",
  xlatx: "xlatx",
  custom: "custom",
};

export async function getBuildView(context: APIContext, url: URL): Promise<BuildView> {
  const state = parseBuildQuery(url);
  const selectedIds = state.selectedIds;
  const parts = await loadParts(context);
  const selectedIdList = slotOrder
    .map(({ kind }) => selectedIds[kind])
    .filter((id): id is string => Boolean(id));
  const lookup = await loadCatalogPartsByIds(context, selectedIdList);
  const partIndex = new Map<string, PartRecord>();

  parts.cases.forEach((part) => partIndex.set(part.id, part));
  parts.gpus.forEach((part) => partIndex.set(part.id, part));
  lookup.parts.forEach((part) => {
    if (!partIndex.has(part.id)) partIndex.set(part.id, part);
  });

  const activeCase = partByKind(partIndex, selectedIds.case, "case");
  const activeGpu = partByKind(partIndex, selectedIds.gpu, "gpu");
  const activeCpuCooler = partByKind(partIndex, selectedIds["cpu-cooler"], "cpu-cooler");
  const activePsu = partByKind(partIndex, selectedIds.psu, "psu");
  const activeMotherboard = partByKind(partIndex, selectedIds.motherboard, "motherboard");
  const activeRam = partByKind(partIndex, selectedIds.ram, "ram");
  const ctx = {
    state,
    partIndex,
    activeCase,
    activeGpu,
    activeCpuCooler,
    activePsu,
    activeMotherboard,
    activeRam,
  };

  // Auto-populate GPU numeric filter defaults from the active case
  if (state.kind === "gpu" && activeCase) {
    if (state.gpuMaxLengthMm === null && activeCase.dimensions.gpuLengthMm != null) {
      state.gpuMaxLengthMm = activeCase.dimensions.gpuLengthMm;
    }
    if (state.gpuMaxSlots === null && activeCase.dimensions.pcieSlots != null) {
      state.gpuMaxSlots = activeCase.dimensions.pcieSlots;
    }
    if (state.gpuMaxThicknessMm === null && activeCase.dimensions.gpuThicknessMm != null) {
      state.gpuMaxThicknessMm = activeCase.dimensions.gpuThicknessMm;
    }
  }

  const { candidates, totalRows } = await loadCandidates(context, state, parts);
  const builtRows = candidates.map((part) => buildRow(ctx, part));
  const sortedRows = state.search.trim() && state.sort === "release-year"
    ? builtRows
    : builtRows.sort((a, b) => rowSort(a, b, state));
  const rows = sortedRows.slice(
    (state.page - 1) * activePageSize(state.kind),
    state.page * activePageSize(state.kind),
  );
  const pageCount = Math.max(1, Math.ceil(totalRows / activePageSize(state.kind)));
  const displayStart = totalRows ? (state.page - 1) * activePageSize(state.kind) + 1 : 0;
  const displayEnd = Math.min(state.page * activePageSize(state.kind), totalRows);
  const slots = slotOrder.map((slot) => buildSlot(ctx, slot.kind));
  const selectedFitments = slotOrder
    .map(({ kind }) => {
      const id = selectedIds[kind];
      const part = id ? partIndex.get(id) : null;
      return part ? { kind, summary: evaluateCandidateFitment(ctx, part) } : null;
    })
    .filter((entry): entry is { kind: SelectableKind; summary: FitmentSummary } => Boolean(entry));
  const buildStatus = getBuildStatus(selectedFitments, activeCase, activeGpu);

  return {
    state,
    slotOrder,
    tabOrder,
    slots,
    buildStatus,
    buildStatusLabel: buildStatus === "in-progress" ? "IN PROGRESS" : buildStatus.toUpperCase(),
    buildStatusCopy: buildStatusCopy(buildStatus),
    buildIssues: buildIssues(ctx, selectedFitments),
    activeConstraintLabel: activeConstraintLabel(activeCase, activeGpu),
    constraintMeters: constraintMeters(ctx),
    kindTabs: tabOrder.map((kind) => ({
      kind,
      href: buildUrl(state, { kind, resetPage: true }),
      active: kind === state.kind,
    })),
    searchAction: "/build",
    hiddenInputs: searchHiddenInputs(state),
    numericFilters: numericFilters(state, parts),
    clearFiltersUrl: buildUrl(state, {
      caseMaxVolumeL: null,
      caseMaxGpuLengthMm: null,
      caseMaxGpuThicknessMm: null,
      caseMaxPcieSlots: null,
      gpuMaxLengthMm: null,
      gpuMaxSlots: null,
      gpuMaxThicknessMm: null,
      resetPage: true,
    }),
    tableHeaders: tableHeaders(state),
    rows,
    totalRows,
    displayStart,
    displayEnd,
    pageCount,
    previousUrl: buildUrl(state, { page: Math.max(1, state.page - 1) }),
    nextUrl: buildUrl(state, { page: Math.min(pageCount, state.page + 1) }),
    psuTierSourceUrl,
    activeFilterChips: buildFilterChips(state),
    tableNotice: buildTableNotice(ctx, state),
  };
}

async function loadCandidates(
  context: APIContext,
  state: BuildQueryState,
  parts: Awaited<ReturnType<typeof loadParts>>,
) {
  if (state.kind === "case" || state.kind === "gpu") {
    const pool = state.kind === "case" ? parts.cases : parts.gpus;
    const filtered = state.search.trim()
      ? state.kind === "case"
        ? await searchTypedCandidates(context, parts.cases, state.kind, state.search)
        : await searchTypedCandidates(context, parts.gpus, state.kind, state.search)
      : pool;
    const narrowed = applyNumericFilters(filtered, state);
    const totalRows = narrowed.length;
    return {
      totalRows,
      candidates: narrowed,
    };
  }

  const catalog = await loadCatalog(context, {
    kind: state.kind,
    page: 1,
    pageSize: 5000,
    search: state.search,
  });

  return {
    totalRows: catalog.summary.filteredTotal,
    candidates: catalog.parts.filter(
      (part): part is GenericPart & { kind: SelectableKind } => part.kind === state.kind,
    ),
  };
}

function applyNumericFilters(parts: Array<CasePart | GpuPart>, state: BuildQueryState) {
  return parts.filter((part) => {
    if (isCasePart(part)) {
      return (
        withinMax(part.dimensions.volumeL, state.caseMaxVolumeL) &&
        withinMax(part.dimensions.gpuLengthMm, state.caseMaxGpuLengthMm) &&
        withinMax(part.dimensions.gpuThicknessMm, state.caseMaxGpuThicknessMm) &&
        withinMax(part.dimensions.pcieSlots, state.caseMaxPcieSlots)
      );
    }

    if (isGpuPart(part)) {
      return (
        withinMax(part.dimensions.lengthMm, state.gpuMaxLengthMm) &&
        withinMax(part.dimensions.pcieSlots, state.gpuMaxSlots) &&
        withinMax(part.dimensions.thicknessMm, state.gpuMaxThicknessMm)
      );
    }

    return true;
  });
}

function withinMax(value: number | null | undefined, max: number | null) {
  if (max === null) return true;
  return value !== null && value !== undefined && value <= max;
}

async function searchTypedCandidates<T extends CasePart | GpuPart>(
  context: APIContext,
  pool: T[],
  kind: SelectableKind,
  query: string,
) {
  const partsById = new Map(pool.map((part) => [part.id, part]));
  const suggestions = (await searchCatalog(context, { query, kind, limit: 1000 })).suggestions;

  return suggestions
    .map((suggestion) => partsById.get(suggestion.id))
    .filter((part): part is T => Boolean(part));
}

function activePageSize(kind: SelectableKind) {
  return kind === "psu" ? psuPageSize : pageSize;
}

function partByKind<K extends PartRecord["kind"]>(
  index: Map<string, PartRecord>,
  id: string | undefined,
  kind: K,
) {
  const part = id ? index.get(id) : null;
  return part?.kind === kind ? (part as Extract<PartRecord, { kind: K }>) : null;
}

function isCasePart(part: PartRecord): part is CasePart {
  return part.kind === "case" && "seller" in part;
}

function isGpuPart(part: PartRecord): part is GpuPart {
  return part.kind === "gpu" && "chipset" in part;
}

function isGenericPart(part: PartRecord): part is GenericPart {
  return "displayName" in part;
}

function partReleaseYear(part: PartRecord): number | null {
  return part.releaseYear ?? null;
}

type EvalContext = {
  state: BuildQueryState;
  partIndex: Map<string, PartRecord>;
  activeCase: CasePart | null;
  activeGpu: GpuPart | null;
  activeCpuCooler: GenericPart | null;
  activePsu: GenericPart | null;
  activeMotherboard: GenericPart | null;
  activeRam: GenericPart | null;
};

function buildSlot(ctx: EvalContext, kind: SelectableKind): BuildViewSlot {
  const descriptor = slotOrder.find((slot) => slot.kind === kind)!;
  const id = ctx.state.selectedIds[kind] ?? "";
  const part = id ? (ctx.partIndex.get(id) ?? null) : null;
  const verdict = slotVerdict(ctx, kind, part);

  return {
    kind,
    label: descriptor.label,
    actionLabel: descriptor.actionLabel,
    id,
    state: id && !part ? "unresolved" : "resolved",
    title: id ? (part ? displayTitle(part) : "Unresolved selection") : "Empty",
    subtitle: part ? displaySubtitle(part) : id || "",
    note:
      id && !part
        ? "The id is still preserved in URL state, but the catalog can no longer resolve it."
        : slotNote(ctx, kind),
    verdict,
    verdictCopy: verdictCopy(verdict),
    verdictTooltip: verdictTooltip(verdict),
    specs: slotSpecs(ctx, kind, part),
    clearUrl: buildUrl(ctx.state, { clearSlot: kind, resetPage: true }),
    browseUrl: buildUrl(ctx.state, { kind, resetPage: true }),
  };
}

function buildRow(ctx: EvalContext, part: PartRecord): BuildViewRow {
  const kind = part.kind as SelectableKind;
  const selected = ctx.state.selectedIds[kind] === part.id;
  const hasSelection = Boolean(ctx.state.selectedIds[kind]);
  const fitment = evaluateCandidateFitment(ctx, part);
  const note = fitment.messages[0] || fitment.notes[0] || fallbackNote(ctx, part);
  const cells = metricCells(part);
  const metricLabels = tableHeaderLabels(ctx.state.kind).slice(2, -2);

  return {
    id: part.id,
    kind,
    title: displayTitle(part),
    subtitle: displaySubtitle(part),
    cells,
    mobileMetrics: metricLabels.map((label, i) => ({
      label,
      value: cells[i] ?? "",
      alert: fitment.highlightCellIndex === i,
    })),
    verdict: fitment.verdict,
    verdictLabel: verdictLabel(fitment.verdict),
    verdictTooltip: verdictTooltip(fitment.verdict),
    note,
    selected,
    actionLabel: selected ? "Remove" : hasSelection ? "Swap" : "Add",
    actionTone: selected ? "remove" : hasSelection ? "swap" : "add",
    actionUrl: selected
      ? buildUrl(ctx.state, { clearSlot: kind, resetPage: true })
      : buildUrl(ctx.state, { selectedIds: { [kind]: part.id }, search: "", resetPage: true }),
    highlightCellIndex: fitment.highlightCellIndex,
    releaseYear: partReleaseYear(part),
  };
}

function rowSort(a: BuildViewRow, b: BuildViewRow, state: BuildQueryState) {
  const direction = state.dir === "desc" ? -1 : 1;

  if (state.sort !== "fitment") {
    const delta = compareSortValue(sortValue(a, state.sort), sortValue(b, state.sort));
    if (delta !== 0) return delta * direction;
  }

  const verdictDelta = verdictRank(a.verdict) - verdictRank(b.verdict);
  if (verdictDelta !== 0) return verdictDelta;
  if (state.kind === "psu") {
    const tierDelta = psuTierRank(a.cells[0]) - psuTierRank(b.cells[0]);
    if (tierDelta !== 0) return tierDelta;
  }
  if (a.selected !== b.selected) return a.selected ? -1 : 1;
  return a.title.localeCompare(b.title);
}

function sortValue(row: BuildViewRow, key: string) {
  if (key === "status") return verdictRank(row.verdict);
  if (key === "name") return row.title;
  if (key === "notes") return row.note;
  if (key === "release-year") return row.releaseYear ?? "";
  const metricMatch = key.match(/^metric-(\d+)$/);
  if (metricMatch) return row.cells[Number(metricMatch[1])] ?? "";
  return row.title;
}

function compareSortValue(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const aNumber = numericPrefix(String(a));
  const bNumber = numericPrefix(String(b));
  if (aNumber !== null || bNumber !== null) {
    if (aNumber === null) return 1;
    if (bNumber === null) return -1;
    return aNumber - bNumber;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function numericPrefix(value: string) {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function psuTierRank(label: string) {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : 99;
}

function getBuildStatus(
  selectedFitments: Array<{ kind: SelectableKind; summary: FitmentSummary }>,
  activeCase: CasePart | null,
  activeGpu: GpuPart | null,
): BuildStatus {
  const verdicts = selectedFitments
    .map(({ summary }) => summary.verdict)
    .filter((verdict): verdict is FitVerdict => verdict !== "unscored");
  if (verdicts.includes("fail")) return "fail";
  if (verdicts.includes("conditional")) return "conditional";
  return verdicts.length && activeCase && activeGpu ? "pass" : "in-progress";
}

function buildStatusCopy(status: BuildStatus) {
  if (status === "in-progress") return "";
  if (status === "pass") return "All known dimensions fit.";
  if (status === "conditional") return "Build has warnings — tight clearances, missing data, or practical risks.";
  return "Build contains at least one hard dimensional conflict.";
}

function buildIssues(
  ctx: EvalContext,
  selectedFitments: Array<{ kind: SelectableKind; summary: FitmentSummary }>,
) {
  const sections: Array<{ kind: SelectableKind; label: string; issues: string[] }> = [];

  selectedFitments
    .filter(
      ({ summary }) =>
        summary.verdict !== "pass" && summary.verdict !== "unscored" && summary.messages.length,
    )
    .forEach(({ kind, summary }) => {
      sections.push({
        kind,
        label: slotOrder.find((slot) => slot.kind === kind)!.label,
        issues: summary.messages,
      });
    });

  slotOrder.forEach(({ kind, label }) => {
    const id = ctx.state.selectedIds[kind];
    if (id && !ctx.partIndex.has(id)) {
      sections.push({
        kind,
        label,
        issues: [
          `Selected ${label.toLowerCase()} id "${id}" could not be loaded from the current catalog.`,
        ],
      });
    }
  });

  return sections;
}

function searchHiddenInputs(state: BuildQueryState) {
  const inputs: Array<{ name: string; value: string }> = [{ name: "kind", value: state.kind }];
  slotOrder.forEach(({ kind }) => {
    const value = state.selectedIds[kind];
    if (value) inputs.push({ name: kind, value });
  });
  if (state.sort !== "release-year") inputs.push({ name: "sort", value: state.sort });
  if (state.sort !== "release-year" && state.dir === "desc")
    inputs.push({ name: "dir", value: state.dir });
  if (state.sort === "release-year" && state.dir !== "desc")
    inputs.push({ name: "dir", value: state.dir });
  numericFilterInputs(state).forEach((input) => inputs.push(input));
  return inputs;
}

function numericFilterInputs(state: BuildQueryState) {
  const inputs: Array<{ name: string; value: string }> = [];
  if (state.kind === "case") {
    if (state.caseMaxVolumeL !== null)
      inputs.push({ name: "case-max-volume-l", value: formatQueryNumber(state.caseMaxVolumeL) });
    if (state.caseMaxGpuLengthMm !== null)
      inputs.push({ name: "case-max-gpu-length-mm", value: formatQueryNumber(state.caseMaxGpuLengthMm) });
    if (state.caseMaxGpuThicknessMm !== null)
      inputs.push({ name: "case-max-gpu-thickness-mm", value: formatQueryNumber(state.caseMaxGpuThicknessMm) });
    if (state.caseMaxPcieSlots !== null)
      inputs.push({ name: "case-max-pcie-slots", value: formatQueryNumber(state.caseMaxPcieSlots) });
  }
  if (state.kind === "gpu") {
    if (state.gpuMaxLengthMm !== null)
      inputs.push({ name: "max-gpu-length-mm", value: formatQueryNumber(state.gpuMaxLengthMm) });
    if (state.gpuMaxSlots !== null)
      inputs.push({ name: "max-gpu-slots", value: formatQueryNumber(state.gpuMaxSlots) });
    if (state.gpuMaxThicknessMm !== null)
      inputs.push({ name: "max-gpu-thickness-mm", value: formatQueryNumber(state.gpuMaxThicknessMm) });
  }
  return inputs;
}

function numericFilters(
  state: BuildQueryState,
  parts: Awaited<ReturnType<typeof loadParts>>,
): BuildViewNumericFilter[] {
  if (state.kind === "case") {
    const maxVolume = maxDimension(parts.cases.map((p) => p.dimensions.volumeL));
    const maxGpuLen = maxDimension(parts.cases.map((p) => p.dimensions.gpuLengthMm));
    const maxGpuThick = maxDimension(parts.cases.map((p) => p.dimensions.gpuThicknessMm));
    const maxPcieSlots = maxDimension(parts.cases.map((p) => p.dimensions.pcieSlots));
    return [
      makeNumericFilter("case-max-volume-l", "Max volume", "L", maxVolume, 0.5, state.caseMaxVolumeL),
      makeNumericFilter("case-max-gpu-length-mm", "Max GPU length", "mm", maxGpuLen, 1, state.caseMaxGpuLengthMm),
      makeNumericFilter("case-max-gpu-thickness-mm", "Max GPU thickness", "mm", maxGpuThick, 1, state.caseMaxGpuThicknessMm),
      makeNumericFilter("case-max-pcie-slots", "Max PCIe slots", "slots", maxPcieSlots, 1, state.caseMaxPcieSlots),
    ];
  }

  if (state.kind === "gpu") {
    const maxLength = maxDimension(parts.gpus.map((p) => p.dimensions.lengthMm));
    const maxSlots = maxDimension(parts.gpus.map((p) => p.dimensions.pcieSlots));
    const maxThickness = maxDimension(parts.gpus.map((p) => p.dimensions.thicknessMm));
    return [
      makeNumericFilter("max-gpu-length-mm", "Max GPU length", "mm", maxLength, 1, state.gpuMaxLengthMm),
      makeNumericFilter("max-gpu-slots", "Max GPU slots", "slots", maxSlots, 1, state.gpuMaxSlots),
      makeNumericFilter("max-gpu-thickness-mm", "Max GPU thickness", "mm", maxThickness, 1, state.gpuMaxThicknessMm),
    ];
  }

  return [];
}

function makeNumericFilter(
  name: BuildViewNumericFilter["name"],
  label: string,
  unit: BuildViewNumericFilter["unit"],
  max: number,
  step: number,
  value: number | null,
): BuildViewNumericFilter {
  return { name, label, unit, max, step, value: value ?? max, active: value !== null };
}

function maxDimension(values: Array<number | null | undefined>) {
  const max = Math.max(
    0,
    ...values.filter((value): value is number => value !== null && value !== undefined),
  );
  return Math.ceil(max || 1);
}

function tableHeaders(state: BuildQueryState): BuildViewTableHeader[] {
  const labels = tableHeaderLabels(state.kind);
  return labels.map((label, index) => {
    const key = headerSortKey(index, labels.length);
    const sortable = key !== "notes" && key !== "action";
    const nextDir = state.sort === key && state.dir === "asc" ? "desc" : "asc";
    return {
      key,
      label,
      sortable,
      sortUrl: sortable ? buildUrl(state, { sort: key, dir: nextDir, resetPage: true }) : "",
      sortDir: state.sort === key ? state.dir : null,
    };
  });
}

function tableHeaderLabels(kind: SelectableKind) {
  if (kind === "gpu")
    return ["Status", "Model", "Length", "Width", "Height", "Slots", "Power", "Notes", "Action"];
  if (kind === "case")
    return [
      "Status",
      "Case",
      "Volume",
      "GPU max length",
      "GPU max thickness",
      "PCIe slots",
      "Notes",
      "Action",
    ];
  if (kind === "cpu-cooler")
    return ["Status", "Name", "Height", "Footprint", "TDP", "Fan", "Notes", "Action"];
  if (kind === "psu")
    return ["Status", "Name", "Tier", "Form factor", "Wattage", "12VHPWR", "Notes", "Action"];
  if (kind === "motherboard")
    return ["Status", "Name", "Form factor", "Socket", "Chipset", "RAM", "Notes", "Action"];
  if (kind === "ram") return ["Status", "Name", "Height", "Type", "RGB", "Notes", "Action"];
  return ["Status", "Name", "Notes", "Action"];
}

function headerSortKey(index: number, headerCount: number) {
  if (index === 0) return "status";
  if (index === 1) return "name";
  if (index === headerCount - 2) return "notes";
  if (index === headerCount - 1) return "action";
  return `metric-${index - 2}`;
}

function constraintMeters(ctx: EvalContext) {
  if (ctx.state.kind === "gpu" && ctx.activeCase) {
    return [
      {
        label: "Length",
        value: ctx.activeCase.dimensions.gpuLengthMm
          ? `Max ${formatValue(ctx.activeCase.dimensions.gpuLengthMm, "mm")}`
          : "Unknown",
        tone: "pass" as const,
        ratio: ratioFromLimit(ctx.activeCase.dimensions.gpuLengthMm, 400),
      },
      {
        label: "Thickness",
        value: ctx.activeCase.dimensions.gpuThicknessMm
          ? `Max ${formatValue(ctx.activeCase.dimensions.gpuThicknessMm, "mm")}`
          : "Unknown",
        tone: "conditional" as const,
        ratio: ratioFromLimit(ctx.activeCase.dimensions.gpuThicknessMm, 90),
      },
      {
        label: "Slots",
        value: ctx.activeCase.dimensions.pcieSlots
          ? `Max ${formatValue(ctx.activeCase.dimensions.pcieSlots)}`
          : "Unknown",
        tone: "neutral" as const,
        ratio: ratioFromLimit(ctx.activeCase.dimensions.pcieSlots, 4),
      },
    ];
  }

  if (ctx.state.kind === "case" && ctx.activeGpu) {
    return [
      {
        label: "GPU length",
        value: ctx.activeGpu.dimensions.lengthMm
          ? `${formatValue(ctx.activeGpu.dimensions.lengthMm, "mm")} required`
          : "Unknown",
        tone: "pass" as const,
        ratio: ratioFromLimit(ctx.activeGpu.dimensions.lengthMm, 400),
      },
      {
        label: "GPU thickness",
        value: ctx.activeGpu.dimensions.thicknessMm
          ? `${formatValue(ctx.activeGpu.dimensions.thicknessMm, "mm")} required`
          : "Unknown",
        tone: "conditional" as const,
        ratio: ratioFromLimit(ctx.activeGpu.dimensions.thicknessMm, 90),
      },
      {
        label: "Slots",
        value: ctx.activeGpu.dimensions.pcieSlots
          ? `${formatValue(ctx.activeGpu.dimensions.pcieSlots)} required`
          : "Unknown",
        tone: "neutral" as const,
        ratio: ratioFromLimit(ctx.activeGpu.dimensions.pcieSlots, 4),
      },
    ];
  }

  if (ctx.state.kind === "cpu-cooler" && ctx.activeCase) {
    return [
      {
        label: "Cooler height",
        value: ctx.activeCase.dimensions.cpuCoolerHeightMm
          ? `Max ${formatValue(ctx.activeCase.dimensions.cpuCoolerHeightMm, "mm")}`
          : "Unknown",
        tone: "pass" as const,
        ratio: ratioFromLimit(ctx.activeCase.dimensions.cpuCoolerHeightMm, 90),
      },
    ];
  }

  if (ctx.state.kind === "psu" && ctx.activeCase) {
    return [
      {
        label: "PSU envelope",
        value: ctx.activeCase.psu || "Unknown",
        tone: "neutral" as const,
        ratio: 0.44,
      },
    ];
  }

  return [
    {
      label: "No derived constraints",
      value: "Select a case or GPU to shape this table",
      tone: "neutral" as const,
      ratio: 0.28,
    },
  ];
}

function activeConstraintLabel(activeCase: CasePart | null, activeGpu: GpuPart | null) {
  if (activeCase) {
    return `${displayTitle(activeCase)}${activeCase.dimensions.volumeL ? ` (${formatValue(activeCase.dimensions.volumeL, "L")})` : ""}`;
  }
  if (activeGpu) return displayTitle(activeGpu);
  return "No active constraints";
}

function buildFilterChips(state: BuildQueryState): BuildView["activeFilterChips"] {
  const chips: BuildView["activeFilterChips"] = [];

  chips.push({ label: state.kind, href: buildUrl(state, {}), tone: "neutral" });

  if (state.search.trim()) {
    chips.push({
      label: `"${state.search.trim()}"`,
      href: buildUrl(state, { search: "", resetPage: true }),
      tone: "active",
    });
  }

  if (state.sort !== "release-year") {
    chips.push({
      label: `Sort: ${state.sort}`,
      href: buildUrl(state, { sort: "release-year", dir: "desc", resetPage: true }),
      tone: "active",
    });
  }

  if (state.page > 1) {
    chips.push({
      label: `Page ${state.page}`,
      href: buildUrl(state, { page: 1 }),
      tone: "active",
    });
  }

  // Case filter chips
  if (state.kind === "case") {
    if (state.caseMaxVolumeL !== null) {
      chips.push({
        label: `Max volume: ${state.caseMaxVolumeL}L`,
        href: buildUrl(state, { caseMaxVolumeL: null, resetPage: true }),
        tone: "active",
      });
    }
    if (state.caseMaxGpuLengthMm !== null) {
      chips.push({
        label: `Max GPU length: ${state.caseMaxGpuLengthMm}mm`,
        href: buildUrl(state, { caseMaxGpuLengthMm: null, resetPage: true }),
        tone: "active",
      });
    }
    if (state.caseMaxGpuThicknessMm !== null) {
      chips.push({
        label: `Max GPU thickness: ${state.caseMaxGpuThicknessMm}mm`,
        href: buildUrl(state, { caseMaxGpuThicknessMm: null, resetPage: true }),
        tone: "active",
      });
    }
    if (state.caseMaxPcieSlots !== null) {
      chips.push({
        label: `Max PCIe slots: ${state.caseMaxPcieSlots}`,
        href: buildUrl(state, { caseMaxPcieSlots: null, resetPage: true }),
        tone: "active",
      });
    }
  }

  // GPU filter chips
  if (state.kind === "gpu") {
    if (state.gpuMaxLengthMm !== null) {
      chips.push({
        label: `Max GPU length: ${state.gpuMaxLengthMm}mm`,
        href: buildUrl(state, { gpuMaxLengthMm: null, resetPage: true }),
        tone: "active",
      });
    }
    if (state.gpuMaxSlots !== null) {
      chips.push({
        label: `Max GPU slots: ${state.gpuMaxSlots}`,
        href: buildUrl(state, { gpuMaxSlots: null, resetPage: true }),
        tone: "active",
      });
    }
    if (state.gpuMaxThicknessMm !== null) {
      chips.push({
        label: `Max GPU thickness: ${state.gpuMaxThicknessMm}mm`,
        href: buildUrl(state, { gpuMaxThicknessMm: null, resetPage: true }),
        tone: "active",
      });
    }
  }

  return chips;
}

function buildTableNotice(ctx: EvalContext, state: BuildQueryState): string {
  if (state.kind === "gpu" && !ctx.activeCase) {
    return "Select a case to expose hard fitment limits and cautionary rows.";
  }
  if (state.kind === "case" && !hasActiveCaseConstraint(ctx)) {
    return "Select another part to evaluate case-side fitment evidence.";
  }
  return "";
}

function slotVerdict(
  ctx: EvalContext,
  kind: SelectableKind,
  part: PartRecord | null = null,
): DisplayVerdict {
  if (part) {
    const summary = evaluateCandidateFitment(ctx, part);
    if (summary.verdict !== "unscored") return summary.verdict;
    if (kind === "case") return "pass";
  }
  return "unscored";
}

function slotNote(ctx: EvalContext, kind: SelectableKind) {
  const id = ctx.state.selectedIds[kind];
  const part = id ? ctx.partIndex.get(id) : null;
  const summary = part ? evaluateCandidateFitment(ctx, part) : null;
  if (summary?.messages.length && summary.verdict !== "pass") return summary.messages[0];
  if (summary?.notes.length) return summary.notes[0];
  if (kind === "psu" && ctx.activeCase?.psu) return `Constraint: ${ctx.activeCase.psu}`;
  if (kind === "cpu-cooler" && ctx.activeCase?.dimensions.cpuCoolerHeightMm) {
    return `Constraint: max ${formatValue(ctx.activeCase.dimensions.cpuCoolerHeightMm, "mm")}`;
  }
  return "";
}

function metricCells(part: PartRecord) {
  if (isCasePart(part)) {
    return [
      formatValue(part.dimensions.volumeL, "L"),
      formatValue(part.dimensions.gpuLengthMm, "mm"),
      formatValue(part.dimensions.gpuThicknessMm, "mm"),
      formatValue(part.dimensions.pcieSlots),
    ];
  }
  if (isGpuPart(part)) {
    return [
      formatValue(part.dimensions.lengthMm, "mm"),
      formatValue(part.dimensions.widthMm, "mm"),
      formatValue(part.dimensions.thicknessMm, "mm"),
      formatValue(part.dimensions.pcieSlots),
      formatValue(part.tdpW, "W"),
    ];
  }
  if (isGenericPart(part) && part.kind === "cpu-cooler") {
    return [
      dimensionValue(part, ["height", "cooler_height"], "mm"),
      footprintValue(part, "mm"),
      dimensionValue(part, ["tdp"], "W"),
      specValue(part, ["fan_size"]),
    ];
  }
  if (isGenericPart(part) && part.kind === "psu") {
    return [
      psuTierLabel(part) || "-",
      specValue(part, ["form_factor", "psu"]),
      dimensionValue(part, ["wattage", "watt", "watts"], "W"),
      specValue(part, ["12vhpwr_12v_2x6_connectors"]) || "-",
    ];
  }
  if (isGenericPart(part) && part.kind === "motherboard") {
    return [
      motherboardFormFactor(part),
      specValue(part, ["socket"]),
      specValue(part, ["chipset"]),
      [dimensionValue(part, ["ram_slots"]), specValue(part, ["ram_type"])]
        .filter((value) => value && value !== "—")
        .join(" / ") || "—",
    ];
  }
  if (isGenericPart(part) && part.kind === "ram") {
    return [
      dimensionValue(part, ["height_incl_contact_pins", "height"], "mm"),
      specValue(part, ["memory_type"]),
      yesNoValue(part, ["rgb"]),
    ];
  }
  return [];
}

function fallbackNote(ctx: EvalContext, part: PartRecord) {
  if (isCasePart(part)) {
    return "";
  }
  if (isGpuPart(part)) {
    return "";
  }
  if (isGenericPart(part) && part.kind === "cpu-cooler") {
    return compactJoin([
      specValue(part, ["type"]),
      `Height ${dimensionValue(part, ["height", "cooler_height"], "mm")}`,
    ]);
  }
  if (isGenericPart(part) && part.kind === "psu") {
    return compactJoin([
      psuTierLabel(part),
      specValue(part, ["form_factor", "psu"]),
      `Wattage ${dimensionValue(part, ["wattage", "watt", "watts"], "W")}`,
    ]);
  }
  if (isGenericPart(part) && part.kind === "motherboard")
    return compactJoin([
      motherboardFormFactor(part),
      specValue(part, ["socket"]),
      specValue(part, ["chipset"]),
    ]);
  if (isGenericPart(part) && part.kind === "ram")
    return compactJoin([
      specValue(part, ["memory_type"]),
      `Height ${dimensionValue(part, ["height_incl_contact_pins", "height"], "mm")}`,
    ]);
  return "Catalog-backed selection for this slot.";
}

function evaluateCandidateFitment(ctx: EvalContext, part: PartRecord): FitmentSummary {
  const checks: FitmentCheck[] = [];
  if (isCasePart(part)) {
    if (ctx.activeGpu) checks.push(...evaluateGpuAgainstCase(ctx.activeGpu, part));
    if (ctx.activeCpuCooler) checks.push(evaluateCpuCoolerAgainstCase(ctx.activeCpuCooler, part));
    if (ctx.activePsu) checks.push(evaluatePsuAgainstCase(ctx.activePsu, part));
    if (ctx.activeMotherboard)
      checks.push(evaluateMotherboardAgainstCase(ctx.activeMotherboard, part));
  } else if (isGpuPart(part)) {
    if (ctx.activeCase) checks.push(...evaluateGpuAgainstCase(part, ctx.activeCase));
  } else if (isGenericPart(part) && part.kind === "cpu-cooler") {
    if (ctx.activeCase) checks.push(evaluateCpuCoolerAgainstCase(part, ctx.activeCase));
    if (ctx.activeRam) checks.push(evaluateRamAgainstCpuCooler(ctx.activeRam, part));
  } else if (isGenericPart(part) && part.kind === "psu") {
    if (ctx.activeCase) checks.push(evaluatePsuAgainstCase(part, ctx.activeCase));
  } else if (isGenericPart(part) && part.kind === "motherboard") {
    if (ctx.activeCase) checks.push(evaluateMotherboardAgainstCase(part, ctx.activeCase));
    if (ctx.activeRam) checks.push(evaluateRamAgainstMotherboard(ctx.activeRam, part));
  } else if (isGenericPart(part) && part.kind === "ram") {
    if (ctx.activeMotherboard)
      checks.push(evaluateRamAgainstMotherboard(part, ctx.activeMotherboard));
    if (ctx.activeCpuCooler) checks.push(evaluateRamAgainstCpuCooler(part, ctx.activeCpuCooler));
  }
  return summarizeFitmentChecks(checks);
}

function summarizeFitmentChecks(checks: FitmentCheck[]): FitmentSummary {
  const messages = checks
    .filter((check) => check.message && check.verdict !== "pass" && !check.advisory)
    .map((check) => check.message);
  const notes = checks
    .filter((check) => check.advisory && check.message)
    .map((check) => check.message);
  const firstHighlight =
    checks.find(
      (check) => check.verdict !== "pass" && !check.advisory && check.cellIndex !== undefined,
    )?.cellIndex ?? null;
  if (!checks.length)
    return { verdict: "unscored", messages: [], notes: [], highlightCellIndex: null };
  if (checks.some((check) => check.verdict === "fail" && !check.advisory))
    return { verdict: "fail", messages, notes, highlightCellIndex: firstHighlight };
  if (checks.some((check) => check.verdict === "conditional" && !check.advisory))
    return { verdict: "conditional", messages, notes, highlightCellIndex: firstHighlight };
  return { verdict: "pass", messages: [], notes, highlightCellIndex: null };
}

function evaluateGpuAgainstCase(gpu: GpuPart, casePart: CasePart): FitmentCheck[] {
  const result = checkCaseGpuCompatibility(casePart, gpu);
  if (!result.issues.length)
    return [{ verdict: "pass", message: "GPU dimensions fit the case GPU envelope." }];
  const advisoryGpuIssueCodes = new Set([
    "case-status",
    "tight-gpuLengthMm",
    "tight-gpuWidthMm",
    "tight-gpuThicknessMm",
  ]);
  return result.issues.map((issue) => ({
    verdict:
      issue.severity === "error"
        ? "fail"
        : advisoryGpuIssueCodes.has(issue.code)
          ? "pass"
          : "conditional",
    message: issue.message,
    cellIndex: gpuIssueCellIndex(issue.code),
    advisory: advisoryGpuIssueCodes.has(issue.code),
  }));
}

function evaluateCpuCoolerAgainstCase(cooler: GenericPart, casePart: CasePart): FitmentCheck {
  const maxHeight = casePart.dimensions.cpuCoolerHeightMm;
  const coolerHeight = dimensionNumber(cooler, ["height", "cooler_height"]);
  if (!maxHeight)
    return { verdict: "conditional", message: "Case CPU cooler height limit is unknown." };
  if (coolerHeight === null)
    return {
      verdict: "conditional",
      message: `Cooler height is unknown; case max is ${formatValue(maxHeight, "mm")}.`,
      cellIndex: 0,
    };
  if (coolerHeight > maxHeight)
    return {
      verdict: "fail",
      message: `Cooler height ${formatValue(coolerHeight, "mm")} exceeds case max ${formatValue(maxHeight, "mm")}.`,
      cellIndex: 0,
    };
  return {
    verdict: "pass",
    message: `Cooler height ${formatValue(coolerHeight, "mm")} fits case max ${formatValue(maxHeight, "mm")}.`,
  };
}

function evaluatePsuAgainstCase(psu: GenericPart, casePart: CasePart): FitmentCheck {
  const caseSupport = casePart.psu;
  const psuFormFactor = specValue(psu, ["form_factor", "psu"]);
  const caseTokens = parseSupportTokens(caseSupport, psuTokenAliases);
  const psuToken = canonicalToken(psuFormFactor, psuTokenAliases);
  if (!caseTokens.size || !psuToken)
    return {
      verdict: "conditional",
      message: `PSU form factor cannot be fully checked; case support is "${caseSupport || "unknown"}" and PSU form factor is "${psuFormFactor || "unknown"}".`,
      cellIndex: 0,
    };
  if (psuToken === "custom" || caseTokens.has("custom"))
    return {
      verdict: "conditional",
      message: `Custom PSU support requires manual verification (${psuFormFactor} in ${caseSupport}).`,
      cellIndex: 0,
    };
  if (caseTokens.has(psuToken))
    return {
      verdict: "pass",
      message: `PSU form factor ${psuFormFactor} is supported by case envelope ${caseSupport}.`,
    };
  return {
    verdict: "fail",
    message: `PSU form factor ${psuFormFactor} is not supported by case envelope ${caseSupport}.`,
    cellIndex: 0,
  };
}

function evaluateMotherboardAgainstCase(
  motherboard: GenericPart,
  casePart: CasePart,
): FitmentCheck {
  const caseSupport = casePart.raw.Motherboard || casePart.raw.motherboard || "";
  const boardFormFactor = motherboardFormFactor(motherboard);
  const caseTokens = parseSupportTokens(caseSupport, motherboardTokenAliases);
  const boardToken = canonicalToken(boardFormFactor, motherboardTokenAliases);
  if (!caseTokens.size || !boardToken)
    return {
      verdict: "conditional",
      message: `Motherboard form factor cannot be fully checked; case support is "${caseSupport || "unknown"}" and board form factor is "${boardFormFactor || "unknown"}".`,
      cellIndex: 0,
    };
  if (caseTokens.has("custom") || boardToken === "custom")
    return {
      verdict: "conditional",
      message: `Custom motherboard support requires manual verification (${boardFormFactor} in ${caseSupport}).`,
      cellIndex: 0,
    };
  if (caseTokens.has(boardToken))
    return {
      verdict: "pass",
      message: `Motherboard form factor ${boardFormFactor} is supported by case envelope ${caseSupport}.`,
    };
  return {
    verdict: "fail",
    message: `Motherboard form factor ${boardFormFactor} is not supported by case envelope ${caseSupport}.`,
    cellIndex: 0,
  };
}

function evaluateRamAgainstMotherboard(ram: GenericPart, motherboard: GenericPart): FitmentCheck {
  const ramType = specValue(ram, ["memory_type"]);
  const motherboardRamType = specValue(motherboard, ["ram_type"]);
  if (!ramType || !motherboardRamType)
    return {
      verdict: "conditional",
      message: `RAM type cannot be fully checked; RAM is "${ramType || "unknown"}" and motherboard requires "${motherboardRamType || "unknown"}".`,
      cellIndex: 1,
    };
  if (normalizeSpecToken(ramType) === normalizeSpecToken(motherboardRamType))
    return {
      verdict: "pass",
      message: `${ramType} RAM matches motherboard memory type ${motherboardRamType}.`,
    };
  return {
    verdict: "fail",
    message: `${ramType} RAM does not match motherboard memory type ${motherboardRamType}.`,
    cellIndex: 1,
  };
}

function evaluateRamAgainstCpuCooler(ram: GenericPart, cooler: GenericPart): FitmentCheck {
  const ramHeight = dimensionNumber(ram, ["height_incl_contact_pins", "height"]);
  const clearanceText = specValue(cooler, ["ram_clearance"]);
  const clearance = dimensionOrSpecNumber(cooler, ["ram_clearance"]);
  if (/no\s*limit/i.test(clearanceText))
    return { verdict: "pass", message: "CPU cooler lists no RAM height limit." };
  if (ramHeight === null || clearance === null)
    return {
      verdict: "conditional",
      message: `RAM clearance cannot be fully checked; RAM height is ${formatValue(ramHeight, "mm")} and cooler clearance is ${clearanceText || "unknown"}.`,
      cellIndex: 0,
    };
  if (ramHeight > clearance)
    return {
      verdict: "fail",
      message: `RAM height ${formatValue(ramHeight, "mm")} exceeds CPU cooler RAM clearance ${formatValue(clearance, "mm")}.`,
      cellIndex: 0,
    };
  return {
    verdict: "pass",
    message: `RAM height ${formatValue(ramHeight, "mm")} fits CPU cooler RAM clearance ${formatValue(clearance, "mm")}.`,
  };
}

function displayTitle(part: PartRecord | null) {
  if (!part) return "Missing catalog record";
  if (isCasePart(part)) return `${part.seller} ${part.name}`.trim();
  if (isGpuPart(part)) {
    const gpuTokens = [part.model, part.name]
      .map((value) => value.trim())
      .filter((value) => value && value.toLowerCase() !== "gpu");
    return (
      gpuTokens
        .filter((value, index) => gpuTokens.indexOf(value) === index)
        .join(" ")
        .trim() ||
      part.chipset ||
      part.id
    );
  }
  return part.displayName || [part.brand, part.name].filter(Boolean).join(" ").trim() || part.id;
}

function displaySubtitle(part: PartRecord | null) {
  if (!part) return "";
  if (isCasePart(part))
    return part.dimensions.volumeL
      ? `${formatValue(part.dimensions.volumeL, "L")} volume`
      : part.style || part.sourceSheet;
  if (isGpuPart(part))
    return (
      part.brand ||
      (part.tdpW ? `${formatValue(part.tdpW, "W")} TDP` : `${part.sourceSheet} #${part.rowNumber}`)
    );
  if (isGenericPart(part) && part.kind === "cpu-cooler")
    return [specValue(part, ["type"]), "CPU cooler"].filter(Boolean).join(" / ");
  if (isGenericPart(part) && part.kind === "psu")
    return (
      [specValue(part, ["form_factor"]), psuTierLabel(part), specValue(part, ["80_plus_rating"])]
        .filter(Boolean)
        .join(" / ") || "Power supply"
    );
  if (isGenericPart(part) && part.kind === "motherboard")
    return [motherboardFormFactor(part), specValue(part, ["socket", "chipset"])]
      .filter(Boolean)
      .join(" / ");
  if (isGenericPart(part) && part.kind === "ram")
    return specValue(part, ["memory_type"]) || "Memory";
  return part.kind;
}

function slotSpecs(ctx: EvalContext, kind: SelectableKind, part: PartRecord | null): SlotSpec[] {
  if (part && isCasePart(part)) {
    return [
      { label: "Volume", value: formatValue(part.dimensions.volumeL, "L") },
      { label: "GPU max L", value: formatValue(part.dimensions.gpuLengthMm, "mm") },
      { label: "GPU max T", value: formatValue(part.dimensions.gpuThicknessMm, "mm") },
      { label: "Slots", value: formatValue(part.dimensions.pcieSlots) },
      { label: "CPU cooler", value: formatValue(part.dimensions.cpuCoolerHeightMm, "mm") },
      { label: "PSU", value: part.psu || "-" },
      { label: "Riser", value: part.gpuRiser || "-" },
    ];
  }
  if (part && isGpuPart(part)) {
    return [
      { label: "Length", value: formatValue(part.dimensions.lengthMm, "mm") },
      { label: "Width", value: formatValue(part.dimensions.widthMm, "mm") },
      { label: "Thickness", value: formatValue(part.dimensions.thicknessMm, "mm") },
      { label: "Slots", value: formatValue(part.dimensions.pcieSlots) },
      { label: "Power", value: part.pciePins || "-" },
      { label: "TDP", value: formatValue(part.tdpW, "W") },
      { label: "Low profile", value: part.lowProfile ? "Yes" : "No" },
    ];
  }
  if (part && isGenericPart(part) && part.kind === "cpu-cooler")
    return compactSpecs([
      ["Height", dimensionValue(part, ["height", "cooler_height"], "mm")],
      ["Footprint", footprintValue(part, "mm")],
      ["TDP", dimensionValue(part, ["tdp"], "W")],
      ["RAM clear", dimensionOrSpecValue(part, ["ram_clearance"], "mm")],
      ["Fan", specValue(part, ["fan_size"])],
      ["Type", specValue(part, ["type"])],
    ]);
  if (part && isGenericPart(part) && part.kind === "psu")
    return compactSpecs([
      ["Tier", psuTierLabel(part) || "-"],
      ["Form factor", specValue(part, ["form_factor", "psu"])],
      ["Wattage", dimensionValue(part, ["wattage", "watt", "watts"], "W")],
      ["Modular", yesNoValue(part, ["modular"])],
      ["12VHPWR", specValue(part, ["12vhpwr_12v_2x6_connectors"])],
      ["Rating", specValue(part, ["80_plus_rating"])],
    ]);
  if (part && isGenericPart(part) && part.kind === "motherboard")
    return compactSpecs([
      ["Form factor", motherboardFormFactor(part)],
      ["Socket", specValue(part, ["socket"])],
      ["Chipset", specValue(part, ["chipset"])],
      ["RAM slots", dimensionValue(part, ["ram_slots"])],
      ["RAM type", specValue(part, ["ram_type"])],
      ["PCIe x16", specValue(part, ["pcie_x16_slot"])],
    ]);
  if (part && isGenericPart(part) && part.kind === "ram")
    return compactSpecs([
      ["Height", dimensionValue(part, ["height_incl_contact_pins", "height"], "mm")],
      ["Type", specValue(part, ["memory_type"])],
      ["RGB", yesNoValue(part, ["rgb"])],
    ]);
  if (kind === "gpu" && ctx.activeCase)
    return [
      { label: "Max length", value: formatValue(ctx.activeCase.dimensions.gpuLengthMm, "mm") },
      {
        label: "Max thickness",
        value: formatValue(ctx.activeCase.dimensions.gpuThicknessMm, "mm"),
      },
      { label: "Max slots", value: formatValue(ctx.activeCase.dimensions.pcieSlots) },
      { label: "Low profile", value: formatValue(ctx.activeCase.dimensions.lpPcieSlots) },
    ];
  if (kind === "psu" && ctx.activeCase)
    return [{ label: "Allowed PSU", value: ctx.activeCase.psu || "-" }];
  if (kind === "cpu-cooler" && ctx.activeCase)
    return [
      {
        label: "Max height",
        value: formatValue(ctx.activeCase.dimensions.cpuCoolerHeightMm, "mm"),
      },
    ];
  return [];
}

function verdictRank(verdict: DisplayVerdict) {
  if (verdict === "pass") return 0;
  if (verdict === "conditional") return 1;
  if (verdict === "fail") return 2;
  return 3;
}

function verdictLabel(verdict: DisplayVerdict) {
  return verdict === "unscored" ? "CLEAR" : verdict.toUpperCase();
}

function verdictCopy(verdict: DisplayVerdict) {
  if (verdict === "pass") return "Known fit";
  if (verdict === "conditional") return "Caution";
  if (verdict === "fail") return "Conflict";
  return "No conflicts found";
}

function verdictTooltip(verdict: DisplayVerdict) {
  if (verdict === "pass") return "Dimensions fit within known tolerances.";
  if (verdict === "conditional") return "This part may fit, but the data is incomplete. Check the notes for specific warnings about missing dimensions, tight clearances, or practical build risks.";
  if (verdict === "fail") return "Physical dimensions conflict.";
  return "No dimensional conflicts found.";
}

function hasActiveCaseConstraint(ctx: EvalContext) {
  return Boolean(ctx.activeGpu || ctx.activeCpuCooler || ctx.activePsu || ctx.activeMotherboard);
}

function compactSpecs(entries: Array<[string, string]>): SlotSpec[] {
  return entries
    .map(([label, value]) => ({ label, value: emptyToDash(value) }))
    .filter((spec) => spec.value !== "—");
}

function compactJoin(values: string[]) {
  return (
    values.filter((value) => value && value !== "—").join(" / ") ||
    "Catalog-backed selection for this slot."
  );
}

function specValue(part: GenericPart, keys: string[]) {
  for (const key of keys) {
    const value = part.specs[key]?.trim() || part.raw[key]?.trim();
    if (value && !isBlankSpec(value)) return value;
  }
  return "";
}

function psuTierLabel(part: GenericPart) {
  const tier = specValue(part, ["psu_tier"]);
  return tier ? `Tier ${tier}` : "";
}

function dimensionValue(part: GenericPart, keys: string[], unit = "") {
  for (const key of keys) {
    const value = part.dimensions[key];
    if (value !== undefined) return formatValue(value, unit);
  }
  return "—";
}

function dimensionNumber(part: GenericPart, keys: string[]) {
  for (const key of keys) {
    const value = part.dimensions[key];
    if (value !== undefined) return value;
  }
  return null;
}

function dimensionOrSpecValue(part: GenericPart, keys: string[], unit = "") {
  const dimension = dimensionValue(part, keys, unit);
  return dimension !== "—" ? dimension : specValue(part, keys) || "—";
}

function dimensionOrSpecNumber(part: GenericPart, keys: string[]) {
  const dimension = dimensionNumber(part, keys);
  if (dimension !== null) return dimension;
  for (const key of keys) {
    const match = specValue(part, [key]).match(/-?\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return null;
}

function footprintValue(part: GenericPart, unit = "") {
  const length = dimensionValue(part, ["length"], unit);
  const width = dimensionValue(part, ["width"], unit);
  if (length === "—" && width === "—") return "—";
  return `${length} x ${width}`;
}

function yesNoValue(part: GenericPart, keys: string[]) {
  const value = specValue(part, keys).toLowerCase();
  if (!value) return "—";
  if (["y", "yes", "true", "1"].includes(value)) return "Yes";
  if (["n", "no", "false", "0"].includes(value)) return "No";
  return specValue(part, keys);
}

function parseSupportTokens(value: string, aliases: Record<string, string>) {
  const tokens = new Set<string>();
  value
    .replace(/\([^)]*\)/g, "")
    .split(/[\/,+]/)
    .map((token) => canonicalToken(token, aliases))
    .filter(Boolean)
    .forEach((token) => tokens.add(token));
  return tokens;
}

function canonicalToken(value: string, aliases: Record<string, string>) {
  return aliases[normalizeSpecToken(value)] ?? "";
}

function normalizeSpecToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function gpuIssueCellIndex(code: string) {
  if (code.includes("gpuLengthMm")) return 0;
  if (code.includes("gpuWidthMm")) return 1;
  if (code.includes("gpuThicknessMm")) return 2;
  if (code.includes("pcieSlots")) return 3;
  return undefined;
}

function formatQueryNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function motherboardFormFactor(part: GenericPart) {
  const explicit = specValue(part, ["form_factor"]);
  if (explicit) return explicit;
  const source = part.sourceSheet.toLowerCase();
  if (source.includes("mitx")) return "mITX";
  if (source.includes("matx")) return "mATX";
  return "—";
}

function emptyToDash(value: string) {
  return value && !isBlankSpec(value) ? value : "—";
}

function isBlankSpec(value: string) {
  return ["", "-", "?", "n/a", "na", "tbd"].includes(value.trim().toLowerCase());
}

function formatValue(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined) return "—";
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${formatted}${unit}`;
}

function ratioFromLimit(value: number | null | undefined, ceiling: number) {
  if (!value) return 0.34;
  return Math.max(0.12, Math.min(0.94, value / ceiling));
}
