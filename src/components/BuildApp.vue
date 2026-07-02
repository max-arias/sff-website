<script setup lang="ts">
import Fuse from "fuse.js";
import { computed, onMounted, ref, watch } from "vue";
import { checkCaseGpuCompatibility } from "../lib/compatibility";
import type {
  CasePart,
  CompatibilityResult,
  FitVerdict,
  GenericPart,
  GpuPart,
  PartKind
} from "../types";

type SelectableKind = "case" | "gpu" | "psu" | "cpu-cooler" | "motherboard" | "ram";
type SelectedIds = Partial<Record<SelectableKind, string>>;
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
type SlotDescriptor = {
  kind: SelectableKind;
  label: string;
  actionLabel: string;
};
type ResolvedSelection = {
  kind: SelectableKind;
  id: string;
  state: "resolved" | "unresolved";
  part: PartRecord | null;
};
type CandidateRow = {
  id: string;
  kind: SelectableKind;
  title: string;
  subtitle: string;
  details: string;
  numericCells: string[];
  verdict: DisplayVerdict;
  note: string;
  selected: boolean;
  actionLabel: string;
  actionTone: "add" | "remove";
  source: PartRecord;
};
type SlotSpec = {
  label: string;
  value: string;
};
type CatalogResponse = {
  source: string;
  summary: {
    total: number;
    filteredTotal: number;
    byKind: Record<string, number>;
    bySourceSheet: Record<string, number>;
  };
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
  };
  parts: GenericPart[];
};
type PartsResponse = {
  source: string;
  cases: CasePart[];
  gpus: GpuPart[];
};
type LookupResponse = {
  source: string;
  parts: GenericPart[];
};

const slotOrder: SlotDescriptor[] = [
  { kind: "case", label: "Case", actionLabel: "Browse cases" },
  { kind: "gpu", label: "GPU", actionLabel: "Browse GPUs" },
  { kind: "psu", label: "Power supply", actionLabel: "View PSUs" },
  { kind: "cpu-cooler", label: "CPU cooler", actionLabel: "Browse coolers" },
  { kind: "motherboard", label: "Motherboard", actionLabel: "Browse boards" },
  { kind: "ram", label: "RAM", actionLabel: "Browse memory" }
];

const tabOrder: SelectableKind[] = ["gpu", "cpu-cooler", "psu", "case", "motherboard", "ram"];
const pageSize = 25;
const psuPageSize = 500;
const genericKinds = new Set<SelectableKind>(["psu", "cpu-cooler", "motherboard", "ram"]);
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
  "1u": "1u"
};
const psuTierSourceUrl = "https://docs.google.com/spreadsheets/d/1akCHL7Vhzk_EhrpIGkz8zTEvYfLDcaSpZRB6Xt6JWkc/edit";
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
  custom: "custom"
};
const selectedIds = ref<SelectedIds>({});
const activeKind = ref<SelectableKind>("gpu");
const search = ref("");
const page = ref(1);
const buildDrawerOpen = ref(false);
const pending = ref(true);
const error = ref("");
const genericPending = ref(false);
const genericError = ref("");
const partsData = ref<PartsResponse | null>(null);
const genericCatalog = ref<CatalogResponse | null>(null);
const lookupParts = ref<Record<string, GenericPart>>({});
const hydrated = ref(false);

const cases = computed(() => partsData.value?.cases ?? []);
const gpus = computed(() => partsData.value?.gpus ?? []);
const partIndex = computed(() => {
  const index = new Map<string, PartRecord>();
  cases.value.forEach((part) => index.set(part.id, part));
  gpus.value.forEach((part) => index.set(part.id, part));
  Object.values(lookupParts.value).forEach((part) => index.set(part.id, part));
  return index;
});
const activeCase = computed(() => {
  const id = selectedIds.value.case;
  if (!id) return null;
  const part = partIndex.value.get(id);
  return part?.kind === "case" ? part : null;
});
const activeGpu = computed(() => {
  const id = selectedIds.value.gpu;
  if (!id) return null;
  const part = partIndex.value.get(id);
  return part?.kind === "gpu" ? part : null;
});
const activeCpuCooler = computed(() => {
  const id = selectedIds.value["cpu-cooler"];
  if (!id) return null;
  const part = partIndex.value.get(id);
  return part?.kind === "cpu-cooler" ? part : null;
});
const activePsu = computed(() => {
  const id = selectedIds.value.psu;
  if (!id) return null;
  const part = partIndex.value.get(id);
  return part?.kind === "psu" ? part : null;
});
const activeMotherboard = computed(() => {
  const id = selectedIds.value.motherboard;
  if (!id) return null;
  const part = partIndex.value.get(id);
  return part?.kind === "motherboard" ? part : null;
});
const activeRam = computed(() => {
  const id = selectedIds.value.ram;
  if (!id) return null;
  const part = partIndex.value.get(id);
  return part?.kind === "ram" ? part : null;
});
const compatibility = computed<CompatibilityResult | null>(() => {
  if (!activeCase.value || !activeGpu.value) return null;
  return checkCaseGpuCompatibility(activeCase.value, activeGpu.value);
});
const selectedFitments = computed(() =>
  slotOrder
    .map(({ kind }) => {
      const id = selectedIds.value[kind];
      const part = id ? partIndex.value.get(id) : null;
      return part ? { kind, summary: evaluateCandidateFitment(part) } : null;
    })
    .filter((entry): entry is { kind: SelectableKind; summary: FitmentSummary } => Boolean(entry))
);
const buildStatus = computed<BuildStatus>(() => {
  const verdicts = selectedFitments.value
    .map(({ summary }) => summary.verdict)
    .filter((verdict): verdict is FitVerdict => verdict !== "unscored");
  if (verdicts.includes("fail")) return "fail";
  if (verdicts.includes("conditional")) return "conditional";
  return verdicts.length && activeCase.value && activeGpu.value ? "pass" : "in-progress";
});
const buildStatusLabel = computed(() => {
  if (buildStatus.value === "in-progress") return "IN PROGRESS";
  return buildStatus.value.toUpperCase();
});
const buildStatusCopy = computed(() => {
  if (buildStatus.value === "in-progress") return "";
  if (buildStatus.value === "pass") return "Known dimensions fit within the active build.";
  if (buildStatus.value === "conditional") return "This build has warnings or uncertain fitment data.";
  return "This build contains at least one known hard conflict.";
});

const caseFuse = computed(
  () =>
    new Fuse(cases.value, {
      keys: ["name", "seller", "style", "status"],
      threshold: 0.28,
      ignoreLocation: true
    })
);
const gpuFuse = computed(
  () =>
    new Fuse(gpus.value, {
      keys: ["brand", "model", "name", "chipset"],
      threshold: 0.28,
      ignoreLocation: true
    })
);

const localCaseCandidates = computed(() => {
  if (!search.value.trim()) return cases.value;
  return caseFuse.value.search(search.value.trim()).map((match) => match.item);
});
const localGpuCandidates = computed(() => {
  if (!search.value.trim()) return gpus.value;
  return gpuFuse.value.search(search.value.trim()).map((match) => match.item);
});

const totalRows = computed(() => {
  if (activeKind.value === "case") return localCaseCandidates.value.length;
  if (activeKind.value === "gpu") return localGpuCandidates.value.length;
  return genericCatalog.value?.summary.filteredTotal ?? 0;
});
const activePageSize = computed(() => (activeKind.value === "psu" ? psuPageSize : pageSize));
const pageCount = computed(() => Math.max(1, Math.ceil(totalRows.value / activePageSize.value)));
const displayStart = computed(() => (totalRows.value ? (page.value - 1) * activePageSize.value + 1 : 0));
const displayEnd = computed(() => Math.min(page.value * activePageSize.value, totalRows.value));

const selectedSlots = computed<ResolvedSelection[]>(() =>
  slotOrder.map(({ kind }) => {
    const id = selectedIds.value[kind];
    if (!id) {
      return { kind, id: "", state: "resolved", part: null };
    }

    return {
      kind,
      id,
      state: partIndex.value.has(id) ? "resolved" : "unresolved",
      part: partIndex.value.get(id) ?? null
    };
  })
);

const buildIssues = computed(() => {
  const sections: Array<{ kind: SelectableKind; issues: string[] }> = [];

  selectedFitments.value
    .filter(({ summary }) => summary.verdict !== "pass" && summary.verdict !== "unscored" && summary.messages.length)
    .forEach(({ kind, summary }) => {
      sections.push({
        kind,
        issues: summary.messages
      });
    });

  if (selectedIds.value.case && !activeCase.value) {
    sections.push({
      kind: "case",
      issues: [`Selected case id "${selectedIds.value.case}" could not be loaded from the current catalog.`]
    });
  }

  if (selectedIds.value.gpu && !activeGpu.value) {
    sections.push({
      kind: "gpu",
      issues: [`Selected GPU id "${selectedIds.value.gpu}" could not be loaded from the current catalog.`]
    });
  }

  slotOrder
    .filter(({ kind }) => genericKinds.has(kind) && selectedIds.value[kind] && !partIndex.value.get(selectedIds.value[kind] ?? ""))
    .forEach(({ kind, label }) => {
      sections.push({
        kind,
        issues: [`Selected ${label.toLowerCase()} id "${selectedIds.value[kind]}" could not be loaded from the current catalog.`]
      });
    });

  return sections;
});

const candidateRows = computed<CandidateRow[]>(() => {
  const rows =
    activeKind.value === "case"
      ? localCaseCandidates.value.map((part) => buildCaseRow(part))
      : activeKind.value === "gpu"
        ? localGpuCandidates.value.map((part) => buildGpuRow(part))
        : (genericCatalog.value?.parts ?? []).map((part) => buildGenericRow(part as GenericPart & { kind: SelectableKind }));

  rows.sort((a, b) => {
    const verdictDelta = verdictRank(a.verdict) - verdictRank(b.verdict);
    if (verdictDelta !== 0) return verdictDelta;
    if (activeKind.value === "psu") {
      const tierDelta = psuTierRankForRow(a) - psuTierRankForRow(b);
      if (tierDelta !== 0) return tierDelta;
    }
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  if (activeKind.value === "case" || activeKind.value === "gpu") {
    const start = (page.value - 1) * pageSize;
    const end = start + pageSize;
    return rows.slice(start, end);
  }

  return rows;
});

const activeConstraintLabel = computed(() => {
  if (activeCase.value) {
    return `${displayTitle(activeCase.value)}${activeCase.value.dimensions.volumeL ? ` (${formatValue(activeCase.value.dimensions.volumeL, "L")})` : ""}`;
  }
  if (activeGpu.value) {
    return displayTitle(activeGpu.value);
  }
  return "No active constraints";
});

const constraintMeters = computed(() => {
  if (activeKind.value === "gpu" && activeCase.value) {
    return [
      {
        label: "Length",
        value: activeCase.value.dimensions.gpuLengthMm ? `Max ${formatValue(activeCase.value.dimensions.gpuLengthMm, "mm")}` : "Unknown",
        tone: "pass" as const,
        ratio: ratioFromLimit(activeCase.value.dimensions.gpuLengthMm, 400)
      },
      {
        label: "Thickness",
        value: activeCase.value.dimensions.gpuThicknessMm ? `Max ${formatValue(activeCase.value.dimensions.gpuThicknessMm, "mm")}` : "Unknown",
        tone: "conditional" as const,
        ratio: ratioFromLimit(activeCase.value.dimensions.gpuThicknessMm, 90)
      },
      {
        label: "Slots",
        value: activeCase.value.dimensions.pcieSlots ? `Max ${formatValue(activeCase.value.dimensions.pcieSlots)}` : "Unknown",
        tone: "neutral" as const,
        ratio: ratioFromLimit(activeCase.value.dimensions.pcieSlots, 4)
      }
    ];
  }

  if (activeKind.value === "case" && activeGpu.value) {
    return [
      {
        label: "GPU length",
        value: activeGpu.value.dimensions.lengthMm ? `${formatValue(activeGpu.value.dimensions.lengthMm, "mm")} required` : "Unknown",
        tone: "pass" as const,
        ratio: ratioFromLimit(activeGpu.value.dimensions.lengthMm, 400)
      },
      {
        label: "GPU thickness",
        value: activeGpu.value.dimensions.thicknessMm ? `${formatValue(activeGpu.value.dimensions.thicknessMm, "mm")} required` : "Unknown",
        tone: "conditional" as const,
        ratio: ratioFromLimit(activeGpu.value.dimensions.thicknessMm, 90)
      },
      {
        label: "Slots",
        value: activeGpu.value.dimensions.pcieSlots ? `${formatValue(activeGpu.value.dimensions.pcieSlots)} required` : "Unknown",
        tone: "neutral" as const,
        ratio: ratioFromLimit(activeGpu.value.dimensions.pcieSlots, 4)
      }
    ];
  }

  if (activeKind.value === "cpu-cooler" && activeCase.value) {
    return [
      {
        label: "Cooler height",
        value: activeCase.value.dimensions.cpuCoolerHeightMm
          ? `Max ${formatValue(activeCase.value.dimensions.cpuCoolerHeightMm, "mm")}`
          : "Unknown",
        tone: "pass" as const,
        ratio: ratioFromLimit(activeCase.value.dimensions.cpuCoolerHeightMm, 90)
      }
    ];
  }

  if (activeKind.value === "psu" && activeCase.value) {
    return [
      {
        label: "PSU envelope",
        value: activeCase.value.psu || "Unknown",
        tone: "neutral" as const,
        ratio: 0.44
      }
    ];
  }

  return [
    {
      label: "No derived constraints",
      value: "Select a case or GPU to shape this table",
      tone: "neutral" as const,
      ratio: 0.28
    }
  ];
});

onMounted(async () => {
  hydrateFromUrl();
  await loadParts();
  await loadLookupSelections();
  await loadGenericCatalog();
  hydrated.value = true;
});

watch(pageCount, (next) => {
  if (page.value > next) {
    page.value = next;
  }
});

watch(
  () => [activeKind.value, search.value, page.value, ...slotOrder.map(({ kind }) => selectedIds.value[kind] ?? "")],
  async (_, __) => {
    if (!hydrated.value) return;
    syncUrl();
    await loadLookupSelections();
    await loadGenericCatalog();
  }
);

function hydrateFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URL(window.location.href).searchParams;
  const nextIds: SelectedIds = {};

  slotOrder.forEach(({ kind }) => {
    const value = params.get(kind);
    if (value) nextIds[kind] = value;
  });

  selectedIds.value = nextIds;
  search.value = params.get("search") ?? "";
  page.value = Math.max(1, Number(params.get("page") ?? 1) || 1);
  activeKind.value = sanitizeKind(params.get("kind")) ?? inferKind(nextIds);
}

function syncUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();

  slotOrder.forEach(({ kind }) => {
    const value = selectedIds.value[kind];
    if (value) params.set(kind, value);
  });

  params.set("kind", activeKind.value);
  if (search.value.trim()) params.set("search", search.value.trim());
  if (page.value > 1) params.set("page", String(page.value));

  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", next);
}

async function loadParts() {
  pending.value = true;
  error.value = "";
  try {
    const response = await fetch("/api/parts");
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    partsData.value = (await response.json()) as PartsResponse;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    pending.value = false;
  }
}

async function loadLookupSelections() {
  const ids = slotOrder
    .map(({ kind }) => selectedIds.value[kind])
    .filter((id): id is string => Boolean(id))
    .filter((id) => !partIndex.value.has(id));

  if (!ids.length) return;

  try {
    const response = await fetch(`/api/catalog/lookup?ids=${encodeURIComponent(ids.join(","))}`);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = (await response.json()) as LookupResponse;
    const nextLookup = { ...lookupParts.value };
    payload.parts.forEach((part) => {
      nextLookup[part.id] = part;
    });
    lookupParts.value = nextLookup;
  } catch {
    // Lookup failures are surfaced through unresolved slot states in the panel.
  }
}

async function loadGenericCatalog() {
  if (!genericKinds.has(activeKind.value)) {
    genericCatalog.value = null;
    genericPending.value = false;
    genericError.value = "";
    return;
  }

  genericPending.value = true;
  genericError.value = "";

  try {
    const params = new URLSearchParams({
      kind: activeKind.value,
      page: String(page.value),
      pageSize: String(activeKind.value === "psu" ? psuPageSize : pageSize)
    });
    if (search.value.trim()) params.set("search", search.value.trim());
    const response = await fetch(`/api/catalog?${params.toString()}`);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    genericCatalog.value = (await response.json()) as CatalogResponse;
  } catch (caught) {
    genericError.value = caught instanceof Error ? caught.message : String(caught);
  } finally {
    genericPending.value = false;
  }
}

function inferKind(ids: SelectedIds): SelectableKind {
  if (ids.case && !ids.gpu) return "gpu";
  if (ids.gpu && !ids.case) return "case";
  return "gpu";
}

function sanitizeKind(value: string | null): SelectableKind | null {
  if (!value) return null;
  return slotOrder.some((slot) => slot.kind === value) ? (value as SelectableKind) : null;
}

function resetPage() {
  page.value = 1;
}

function changeKind(kind: SelectableKind) {
  if (activeKind.value === kind) return;
  activeKind.value = kind;
  resetPage();
}

function onSearchInput(event: Event) {
  search.value = (event.target as HTMLInputElement).value;
  resetPage();
}

function selectPart(part: PartRecord) {
  const kind = part.kind as SelectableKind;
  if (!slotOrder.some((slot) => slot.kind === kind)) return;
  selectedIds.value = {
    ...selectedIds.value,
    [kind]: part.id
  };
  resetPage();
}

function clearSlot(kind: SelectableKind) {
  const next = { ...selectedIds.value };
  delete next[kind];
  selectedIds.value = next;
  resetPage();
}

function openSlot(kind: SelectableKind) {
  changeKind(kind);
  buildDrawerOpen.value = false;
}

function verdictRank(verdict: DisplayVerdict) {
  if (verdict === "pass") return 0;
  if (verdict === "conditional") return 1;
  if (verdict === "fail") return 2;
  return 3;
}

function verdictLabel(verdict: DisplayVerdict) {
  if (verdict === "unscored") return "UNSCORED";
  return verdict.toUpperCase();
}

function verdictCopy(verdict: DisplayVerdict) {
  if (verdict === "pass") return "Known fit";
  if (verdict === "conditional") return "Caution";
  if (verdict === "fail") return "Conflict";
  return "Not yet evaluated";
}

function slotVerdict(kind: SelectableKind, part: PartRecord | null = null): DisplayVerdict {
  if (part) {
    const summary = evaluateCandidateFitment(part);
    if (summary.verdict !== "unscored") return summary.verdict;
    if (kind === "case") return "pass";
  }
  return "unscored";
}

function slotNote(kind: SelectableKind) {
  const id = selectedIds.value[kind];
  const part = id ? partIndex.value.get(id) : null;
  const summary = part ? evaluateCandidateFitment(part) : null;

  if (summary?.messages.length && summary.verdict !== "pass") {
    return summary.messages[0];
  }

  if (summary?.notes.length) {
    return summary.notes[0];
  }

  if (kind === "psu" && activeCase.value?.psu) {
    return `Constraint: ${activeCase.value.psu}`;
  }

  if (kind === "cpu-cooler" && activeCase.value?.dimensions.cpuCoolerHeightMm) {
    return `Constraint: max ${formatValue(activeCase.value.dimensions.cpuCoolerHeightMm, "mm")}`;
  }

  return "";
}

function displayTitle(part: PartRecord | null) {
  if (!part) return "Missing catalog record";
  if (part.kind === "case") return `${part.seller} ${part.name}`.trim();
  if (part.kind === "gpu") {
    const gpuTokens = [part.model, part.name]
      .map((value) => value.trim())
      .filter((value) => value && value.toLowerCase() !== "gpu");
    const uniqueTokens = gpuTokens.filter((value, index) => gpuTokens.indexOf(value) === index);
    return uniqueTokens.join(" ").trim() || part.chipset || part.id;
  }
  return part.displayName || [part.brand, part.name].filter(Boolean).join(" ").trim() || part.id;
}

function displaySubtitle(part: PartRecord | null) {
  if (!part) return "";
  if (part.kind === "case") {
    return part.dimensions.volumeL ? `${formatValue(part.dimensions.volumeL, "L")} volume` : part.style || part.sourceSheet;
  }
  if (part.kind === "gpu") {
    return part.brand || (part.tdpW ? `${formatValue(part.tdpW, "W")} TDP` : `${part.sourceSheet} #${part.rowNumber}`);
  }
  if (part.kind === "cpu-cooler") {
    return [specValue(part, ["type"]), "CPU cooler"].filter(Boolean).join(" / ");
  }
  if (part.kind === "psu") {
    return [specValue(part, ["form_factor"]), psuTierLabel(part), specValue(part, ["80_plus_rating"])].filter(Boolean).join(" / ") || "Power supply";
  }
  if (part.kind === "motherboard") {
    return [motherboardFormFactor(part), specValue(part, ["socket", "chipset"])].filter(Boolean).join(" / ");
  }
  if (part.kind === "ram") {
    return specValue(part, ["memory_type"]) || "Memory";
  }
  return part.kind;
}

function slotSpecs(kind: SelectableKind, part: PartRecord | null): SlotSpec[] {
  if (part?.kind === "case") {
    return [
      { label: "Volume", value: formatValue(part.dimensions.volumeL, "L") },
      { label: "GPU max L", value: formatValue(part.dimensions.gpuLengthMm, "mm") },
      { label: "GPU max T", value: formatValue(part.dimensions.gpuThicknessMm, "mm") },
      { label: "Slots", value: formatValue(part.dimensions.pcieSlots) },
      { label: "CPU cooler", value: formatValue(part.dimensions.cpuCoolerHeightMm, "mm") },
      { label: "PSU", value: part.psu || "—" },
      { label: "Riser", value: part.gpuRiser || "—" }
    ];
  }

  if (part?.kind === "gpu") {
    return [
      { label: "Length", value: formatValue(part.dimensions.lengthMm, "mm") },
      { label: "Width", value: formatValue(part.dimensions.widthMm, "mm") },
      { label: "Thickness", value: formatValue(part.dimensions.thicknessMm, "mm") },
      { label: "Slots", value: formatValue(part.dimensions.pcieSlots) },
      { label: "Power", value: part.pciePins || "—" },
      { label: "TDP", value: formatValue(part.tdpW, "W") },
      { label: "Low profile", value: part.lowProfile ? "Yes" : "No" }
    ];
  }

  if (part?.kind === "cpu-cooler") {
    return compactSpecs([
      ["Height", dimensionValue(part, ["height", "cooler_height"], "mm")],
      ["Footprint", footprintValue(part, "mm")],
      ["TDP", dimensionValue(part, ["tdp"], "W")],
      ["RAM clear", dimensionOrSpecValue(part, ["ram_clearance"], "mm")],
      ["Fan", specValue(part, ["fan_size"])],
      ["Type", specValue(part, ["type"])]
    ]);
  }

  if (part?.kind === "psu") {
    return compactSpecs([
      ["Tier", psuTierLabel(part) || "-"],
      ["Form factor", specValue(part, ["form_factor", "psu"])],
      ["Wattage", dimensionValue(part, ["wattage", "watt", "watts"], "W")],
      ["Modular", yesNoValue(part, ["modular"])],
      ["12VHPWR", specValue(part, ["12vhpwr_12v_2x6_connectors"])],
      ["Rating", specValue(part, ["80_plus_rating"])]
    ]);
  }

  if (part?.kind === "motherboard") {
    return compactSpecs([
      ["Form factor", motherboardFormFactor(part)],
      ["Socket", specValue(part, ["socket"])],
      ["Chipset", specValue(part, ["chipset"])],
      ["RAM slots", dimensionValue(part, ["ram_slots"])],
      ["RAM type", specValue(part, ["ram_type"])],
      ["PCIe x16", specValue(part, ["pcie_x16_slot"])]
    ]);
  }

  if (part?.kind === "ram") {
    return compactSpecs([
      ["Height", dimensionValue(part, ["height_incl_contact_pins", "height"], "mm")],
      ["Type", specValue(part, ["memory_type"])],
      ["RGB", yesNoValue(part, ["rgb"])]
    ]);
  }

  if (part) {
    return compactSpecs(
      Object.entries(part.raw)
        .filter(([, value]) => value.trim())
        .slice(0, 6)
        .map(([label, value]) => [label, value])
    );
  }

  if (kind === "gpu" && activeCase.value) {
    return [
      { label: "Max length", value: formatValue(activeCase.value.dimensions.gpuLengthMm, "mm") },
      { label: "Max thickness", value: formatValue(activeCase.value.dimensions.gpuThicknessMm, "mm") },
      { label: "Max slots", value: formatValue(activeCase.value.dimensions.pcieSlots) },
      { label: "Low profile", value: formatValue(activeCase.value.dimensions.lpPcieSlots) }
    ];
  }

  if (kind === "psu" && activeCase.value) {
    return [{ label: "Allowed PSU", value: activeCase.value.psu || "—" }];
  }

  if (kind === "cpu-cooler" && activeCase.value) {
    return [{ label: "Max height", value: formatValue(activeCase.value.dimensions.cpuCoolerHeightMm, "mm") }];
  }

  return [];
}

function buildCaseRow(part: CasePart): CandidateRow {
  const selected = selectedIds.value.case === part.id;
  const fitment = evaluateCandidateFitment(part);
  const note =
    fitment.messages[0] ||
    fitment.notes[0] ||
    (hasActiveCaseConstraint()
      ? "No immediate issues in the active fitment rules."
      : "Select another part to evaluate case-side fitment evidence.");

  return {
    id: part.id,
    kind: "case",
    title: displayTitle(part),
    subtitle: part.style || "Case",
    details: part.status || part.sourceSheet,
    numericCells: [
      formatValue(part.dimensions.volumeL, "L"),
      formatValue(part.dimensions.gpuLengthMm, "mm"),
      formatValue(part.dimensions.gpuThicknessMm, "mm"),
      formatValue(part.dimensions.pcieSlots)
    ],
    verdict: fitment.verdict,
    note,
    selected,
    actionLabel: selected ? "Remove" : "Add",
    actionTone: selected ? "remove" : "add",
    source: part
  };
}

function buildGpuRow(part: GpuPart): CandidateRow {
  const selected = selectedIds.value.gpu === part.id;
  const fitment = evaluateCandidateFitment(part);
  const lengthCell = formatValue(part.dimensions.lengthMm, "mm");
  const thicknessCell = formatValue(part.dimensions.thicknessMm, "mm");
  const slotsCell = formatValue(part.dimensions.pcieSlots);
  const note =
    fitment.messages[0] ||
    fitment.notes[0] ||
    (activeCase.value ? "No immediate issues in the active fitment rules." : "Select a case to expose hard fitment limits and cautionary rows.");

  return {
    id: part.id,
    kind: "gpu",
    title: displayTitle(part),
    subtitle: displaySubtitle(part),
    details: part.pciePins || "Power connector unknown",
    numericCells: [lengthCell, thicknessCell, slotsCell, formatValue(part.tdpW, "W")],
    verdict: fitment.verdict,
    note,
    selected,
    actionLabel: selected ? "Remove" : "Add",
    actionTone: selected ? "remove" : "add",
    source: part
  };
}

function buildGenericRow(part: GenericPart & { kind: SelectableKind }): CandidateRow {
  const selected = selectedIds.value[part.kind] === part.id;
  const cells = genericMetricCells(part);
  const fitment = evaluateCandidateFitment(part);
  const note = fitment.messages[0] || fitment.notes[0] || genericEvidenceNote(part);

  return {
    id: part.id,
    kind: part.kind,
    title: displayTitle(part),
    subtitle: displaySubtitle(part),
    details: note,
    numericCells: cells,
    verdict: fitment.verdict,
    note,
    selected,
    actionLabel: selected ? "Remove" : "Add",
    actionTone: selected ? "remove" : "add",
    source: part
  };
}

function genericMetricCells(part: GenericPart & { kind: SelectableKind }) {
  if (part.kind === "cpu-cooler") {
    return [
      dimensionValue(part, ["height", "cooler_height"], "mm"),
      footprintValue(part, "mm"),
      dimensionValue(part, ["tdp"], "W"),
      specValue(part, ["fan_size"])
    ];
  }

  if (part.kind === "psu") {
    return [
      psuTierLabel(part) || "-",
      specValue(part, ["form_factor", "psu"]),
      dimensionValue(part, ["wattage", "watt", "watts"], "W"),
      specValue(part, ["12vhpwr_12v_2x6_connectors"]) || "—"
    ];
  }

  if (part.kind === "motherboard") {
    return [
      motherboardFormFactor(part),
      specValue(part, ["socket"]),
      specValue(part, ["chipset"]),
      [dimensionValue(part, ["ram_slots"]), specValue(part, ["ram_type"])].filter((value) => value && value !== "—").join(" / ") || "—"
    ];
  }

  if (part.kind === "ram") {
    return [
      dimensionValue(part, ["height_incl_contact_pins", "height"], "mm"),
      specValue(part, ["memory_type"]),
      yesNoValue(part, ["rgb"])
    ];
  }

  return compactSpecs(
    Object.entries(part.raw)
      .filter(([, value]) => value.trim())
      .slice(0, 4)
      .map(([label, value]) => [label, value])
  ).map((spec) => spec.value);
}

function genericEvidenceNote(part: GenericPart & { kind: SelectableKind }) {
  if (part.kind === "cpu-cooler") {
    return compactJoin([
      specValue(part, ["type"]),
      `Height ${dimensionValue(part, ["height", "cooler_height"], "mm")}`,
      specValue(part, ["ram_clearance"]) ? `RAM clear ${specValue(part, ["ram_clearance"])}` : ""
    ]);
  }

  if (part.kind === "psu") {
    return compactJoin([
      psuTierLabel(part),
      specValue(part, ["form_factor", "psu"]),
      `Wattage ${dimensionValue(part, ["wattage", "watt", "watts"], "W")}`,
      specValue(part, ["modular"]) ? `Modular ${yesNoValue(part, ["modular"])}` : ""
    ]);
  }

  if (part.kind === "motherboard") {
    return compactJoin([motherboardFormFactor(part), specValue(part, ["socket"]), specValue(part, ["chipset"])]);
  }

  if (part.kind === "ram") {
    return compactJoin([
      specValue(part, ["memory_type"]),
      `Height ${dimensionValue(part, ["height_incl_contact_pins", "height"], "mm")}`
    ]);
  }

  return "Catalog-backed selection for this slot.";
}

function evaluateCandidateFitment(part: PartRecord): FitmentSummary {
  const checks: FitmentCheck[] = [];

  if (part.kind === "case") {
    if (activeGpu.value) checks.push(...evaluateGpuAgainstCase(activeGpu.value, part));
    if (activeCpuCooler.value) checks.push(evaluateCpuCoolerAgainstCase(activeCpuCooler.value, part));
    if (activePsu.value) checks.push(evaluatePsuAgainstCase(activePsu.value, part));
    if (activeMotherboard.value) checks.push(evaluateMotherboardAgainstCase(activeMotherboard.value, part));
  } else if (part.kind === "gpu") {
    if (activeCase.value) checks.push(...evaluateGpuAgainstCase(part, activeCase.value));
  } else if (part.kind === "cpu-cooler") {
    if (activeCase.value) checks.push(evaluateCpuCoolerAgainstCase(part, activeCase.value));
    if (activeRam.value) checks.push(evaluateRamAgainstCpuCooler(activeRam.value, part));
  } else if (part.kind === "psu") {
    if (activeCase.value) checks.push(evaluatePsuAgainstCase(part, activeCase.value));
  } else if (part.kind === "motherboard") {
    if (activeCase.value) checks.push(evaluateMotherboardAgainstCase(part, activeCase.value));
    if (activeRam.value) checks.push(evaluateRamAgainstMotherboard(activeRam.value, part));
  } else if (part.kind === "ram") {
    if (activeMotherboard.value) checks.push(evaluateRamAgainstMotherboard(part, activeMotherboard.value));
    if (activeCpuCooler.value) checks.push(evaluateRamAgainstCpuCooler(part, activeCpuCooler.value));
  }

  return summarizeFitmentChecks(checks);
}

function summarizeFitmentChecks(checks: FitmentCheck[]): FitmentSummary {
  const messages = checks
    .filter((check) => check.message && check.verdict !== "pass" && !check.advisory)
    .map((check) => check.message);
  const notes = checks.filter((check) => check.advisory && check.message).map((check) => check.message);
  const firstHighlight =
    checks.find((check) => check.verdict !== "pass" && !check.advisory && check.cellIndex !== undefined)?.cellIndex ?? null;

  if (!checks.length) {
    return {
      verdict: "unscored",
      messages: [],
      notes: [],
      highlightCellIndex: null
    };
  }

  if (checks.some((check) => check.verdict === "fail" && !check.advisory)) {
    return {
      verdict: "fail",
      messages,
      notes,
      highlightCellIndex: firstHighlight
    };
  }

  if (checks.some((check) => check.verdict === "conditional" && !check.advisory)) {
    return {
      verdict: "conditional",
      messages,
      notes,
      highlightCellIndex: firstHighlight
    };
  }

  return {
    verdict: "pass",
    messages: [],
    notes,
    highlightCellIndex: null
  };
}

function evaluateGpuAgainstCase(gpu: GpuPart, casePart: CasePart): FitmentCheck[] {
  const result = checkCaseGpuCompatibility(casePart, gpu);
  if (!result.issues.length) {
    return [
      {
        verdict: "pass",
        message: "GPU dimensions fit the case GPU envelope."
      }
    ];
  }

  const advisoryGpuIssueCodes = new Set([
    "case-status",
    "tight-gpuLengthMm",
    "tight-gpuWidthMm",
    "tight-gpuThicknessMm",
    "tight-pcieSlots"
  ]);

  return result.issues.map((issue) => ({
    verdict: issue.severity === "error" ? "fail" : advisoryGpuIssueCodes.has(issue.code) ? "pass" : "conditional",
    message: issue.message,
    cellIndex: gpuIssueCellIndex(issue.code),
    advisory: advisoryGpuIssueCodes.has(issue.code)
  }));
}

function evaluateCpuCoolerAgainstCase(cooler: GenericPart, casePart: CasePart): FitmentCheck {
  const maxHeight = casePart.dimensions.cpuCoolerHeightMm;
  const coolerHeight = dimensionNumber(cooler, ["height", "cooler_height"]);

  if (!maxHeight) {
    return {
      verdict: "conditional",
      message: "Case CPU cooler height limit is unknown."
    };
  }

  if (coolerHeight === null) {
    return {
      verdict: "conditional",
      message: `Cooler height is unknown; case max is ${formatValue(maxHeight, "mm")}.`,
      cellIndex: 0
    };
  }

  if (coolerHeight > maxHeight) {
    return {
      verdict: "fail",
      message: `Cooler height ${formatValue(coolerHeight, "mm")} exceeds case max ${formatValue(maxHeight, "mm")}.`,
      cellIndex: 0
    };
  }

  return {
    verdict: "pass",
    message: `Cooler height ${formatValue(coolerHeight, "mm")} fits case max ${formatValue(maxHeight, "mm")}.`
  };
}

function evaluatePsuAgainstCase(psu: GenericPart, casePart: CasePart): FitmentCheck {
  const caseSupport = casePart.psu;
  const psuFormFactor = specValue(psu, ["form_factor", "psu"]);
  const caseTokens = parseSupportTokens(caseSupport, psuTokenAliases);
  const psuToken = canonicalToken(psuFormFactor, psuTokenAliases);

  if (!caseTokens.size || !psuToken) {
    return {
      verdict: "conditional",
      message: `PSU form factor cannot be fully checked; case support is "${caseSupport || "unknown"}" and PSU form factor is "${psuFormFactor || "unknown"}".`,
      cellIndex: 0
    };
  }

  if (psuToken === "custom" || caseTokens.has("custom")) {
    return {
      verdict: "conditional",
      message: `Custom PSU support requires manual verification (${psuFormFactor} in ${caseSupport}).`,
      cellIndex: 0
    };
  }

  if (caseTokens.has(psuToken)) {
    return {
      verdict: "pass",
      message: `PSU form factor ${psuFormFactor} is supported by case envelope ${caseSupport}.`
    };
  }

  return {
    verdict: "fail",
    message: `PSU form factor ${psuFormFactor} is not supported by case envelope ${caseSupport}.`,
    cellIndex: 0
  };
}

function evaluateMotherboardAgainstCase(motherboard: GenericPart, casePart: CasePart): FitmentCheck {
  const caseSupport = casePart.raw.Motherboard || casePart.raw.motherboard || "";
  const boardFormFactor = motherboardFormFactor(motherboard);
  const caseTokens = parseSupportTokens(caseSupport, motherboardTokenAliases);
  const boardToken = canonicalToken(boardFormFactor, motherboardTokenAliases);

  if (!caseTokens.size || !boardToken) {
    return {
      verdict: "conditional",
      message: `Motherboard form factor cannot be fully checked; case support is "${caseSupport || "unknown"}" and board form factor is "${boardFormFactor || "unknown"}".`,
      cellIndex: 0
    };
  }

  if (caseTokens.has("custom") || boardToken === "custom") {
    return {
      verdict: "conditional",
      message: `Custom motherboard support requires manual verification (${boardFormFactor} in ${caseSupport}).`,
      cellIndex: 0
    };
  }

  if (caseTokens.has(boardToken)) {
    return {
      verdict: "pass",
      message: `Motherboard form factor ${boardFormFactor} is supported by case envelope ${caseSupport}.`
    };
  }

  return {
    verdict: "fail",
    message: `Motherboard form factor ${boardFormFactor} is not supported by case envelope ${caseSupport}.`,
    cellIndex: 0
  };
}

function evaluateRamAgainstMotherboard(ram: GenericPart, motherboard: GenericPart): FitmentCheck {
  const ramType = specValue(ram, ["memory_type"]);
  const motherboardRamType = specValue(motherboard, ["ram_type"]);

  if (!ramType || !motherboardRamType) {
    return {
      verdict: "conditional",
      message: `RAM type cannot be fully checked; RAM is "${ramType || "unknown"}" and motherboard requires "${motherboardRamType || "unknown"}".`,
      cellIndex: 1
    };
  }

  if (normalizeSpecToken(ramType) === normalizeSpecToken(motherboardRamType)) {
    return {
      verdict: "pass",
      message: `${ramType} RAM matches motherboard memory type ${motherboardRamType}.`
    };
  }

  return {
    verdict: "fail",
    message: `${ramType} RAM does not match motherboard memory type ${motherboardRamType}.`,
    cellIndex: 1
  };
}

function evaluateRamAgainstCpuCooler(ram: GenericPart, cooler: GenericPart): FitmentCheck {
  const ramHeight = dimensionNumber(ram, ["height_incl_contact_pins", "height"]);
  const clearanceText = specValue(cooler, ["ram_clearance"]);
  const clearance = dimensionOrSpecNumber(cooler, ["ram_clearance"]);

  if (/no\s*limit/i.test(clearanceText)) {
    return {
      verdict: "pass",
      message: "CPU cooler lists no RAM height limit."
    };
  }

  if (ramHeight === null || clearance === null) {
    return {
      verdict: "conditional",
      message: `RAM clearance cannot be fully checked; RAM height is ${formatValue(ramHeight, "mm")} and cooler clearance is ${clearanceText || "unknown"}.`,
      cellIndex: 0
    };
  }

  if (ramHeight > clearance) {
    return {
      verdict: "fail",
      message: `RAM height ${formatValue(ramHeight, "mm")} exceeds CPU cooler RAM clearance ${formatValue(clearance, "mm")}.`,
      cellIndex: 0
    };
  }

  return {
    verdict: "pass",
    message: `RAM height ${formatValue(ramHeight, "mm")} fits CPU cooler RAM clearance ${formatValue(clearance, "mm")}.`
  };
}

function hasActiveCaseConstraint() {
  return Boolean(activeGpu.value || activeCpuCooler.value || activePsu.value || activeMotherboard.value);
}

function compactSpecs(entries: Array<[string, string]>): SlotSpec[] {
  return entries
    .map(([label, value]) => ({ label, value: emptyToDash(value) }))
    .filter((spec) => spec.value !== "—");
}

function compactJoin(values: string[]) {
  return values.filter((value) => value && value !== "—").join(" / ") || "Catalog-backed selection for this slot.";
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

function psuTierRankForRow(row: CandidateRow) {
  if (row.kind !== "psu" || row.source.kind !== "psu") return 99;
  const rank = Number(specValue(row.source, ["psu_tier_rank"]));
  return Number.isFinite(rank) ? rank : 99;
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
  if (dimension !== "—") return dimension;
  return specValue(part, keys) || "—";
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
  const normalized = normalizeSpecToken(value);
  return aliases[normalized] ?? "";
}

function normalizeSpecToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dimensionOrSpecNumber(part: GenericPart, keys: string[]) {
  const dimension = dimensionNumber(part, keys);
  if (dimension !== null) return dimension;

  for (const key of keys) {
    const value = specValue(part, [key]);
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }

  return null;
}

function gpuIssueCellIndex(code: string) {
  if (code.includes("gpuLengthMm")) return 0;
  if (code.includes("gpuThicknessMm")) return 1;
  if (code.includes("pcieSlots")) return 2;
  return undefined;
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

</script>

<template>
  <div class="build-page">
    <header class="topbar">
      <div class="topbar__inner">
        <div class="brand">SFF_DATA_LOG</div>

        <nav class="nav" aria-label="Primary">
          <a class="nav__item nav__item--active" href="/build">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4l8 8-8 8M4 12h16" />
            </svg>
            <span>Builder</span>
          </a>
          <a class="nav__item" href="/">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 6h14v12H5zM8 10h8M8 14h5" />
            </svg>
            <span>Launcher</span>
          </a>
        </nav>

        <div class="topbar__tools">
          <button
            class="build-toggle"
            type="button"
            :aria-expanded="buildDrawerOpen"
            aria-controls="build-drawer"
            @click="buildDrawerOpen = !buildDrawerOpen"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 5h14v14H5zM9 5v14M9 10h10M9 14h10" />
            </svg>
            <span>Build</span>
          </button>
          <button class="icon-button" type="button" aria-label="Search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l5 5" />
            </svg>
          </button>
          <button class="icon-button" type="button" aria-label="Settings">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <button
      v-if="!buildDrawerOpen"
      class="drawer-handle"
      type="button"
      aria-controls="build-drawer"
      aria-label="Open current build panel"
      @click="buildDrawerOpen = true"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h14v14H5zM9 5v14M13 9l3 3-3 3" />
      </svg>
      <span>Build</span>
    </button>

    <main class="workspace">
      <button
        v-if="buildDrawerOpen"
        class="drawer-scrim"
        type="button"
        aria-label="Close current build panel"
        @click="buildDrawerOpen = false"
      ></button>
      <aside id="build-drawer" :class="['sidebar', { 'sidebar--open': buildDrawerOpen }]">
        <div class="sidebar__header">
          <div>
            <h1>Current Build</h1>
            <p>
              Compatibility status:
              <strong :class="`text-${buildStatus === 'in-progress' ? 'conditional' : buildStatus}`">{{ buildStatusLabel }}</strong>
            </p>
            <span v-if="buildStatusCopy" class="sidebar__summary">{{ buildStatusCopy }}</span>
          </div>
          <button class="sidebar__close" type="button" aria-label="Close current build panel" @click="buildDrawerOpen = false">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div class="slot-stack">
          <article
            v-for="slot in selectedSlots"
            :key="slot.kind"
            :class="[
              'slot-card',
              `slot-card--${slotVerdict(slot.kind, slot.part)}`,
              {
                'slot-card--empty': !slot.id,
                'slot-card--unresolved': slot.state === 'unresolved'
              }
            ]"
          >
            <div class="slot-card__top">
              <span class="slot-card__label">{{ slotOrder.find((entry) => entry.kind === slot.kind)?.label }}</span>
              <div v-if="slot.id" class="slot-card__top-actions">
                <span :class="['badge', `badge--${slotVerdict(slot.kind, slot.part)}`]">
                  {{ verdictCopy(slotVerdict(slot.kind, slot.part)) }}
                </span>
                <button class="slot-card__clear" type="button" :aria-label="`Clear ${slot.kind}`" title="Clear" @click="clearSlot(slot.kind)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <div v-else class="slot-card__top-actions">
                <button
                  class="slot-card__browse"
                  type="button"
                  :aria-label="slotOrder.find((entry) => entry.kind === slot.kind)?.actionLabel"
                  :title="slotOrder.find((entry) => entry.kind === slot.kind)?.actionLabel"
                  @click="openSlot(slot.kind)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="M16 16l5 5" />
                  </svg>
                </button>
              </div>
            </div>

            <template v-if="slot.id && slot.part">
              <h2>{{ displayTitle(slot.part) }}</h2>
              <p class="slot-card__meta">{{ displaySubtitle(slot.part) }}</p>
              <p v-if="slotNote(slot.kind)" class="slot-card__note">{{ slotNote(slot.kind) }}</p>
              <dl v-if="slotSpecs(slot.kind, slot.part).length" class="slot-card__specs">
                <div v-for="spec in slotSpecs(slot.kind, slot.part)" :key="`${slot.kind}-${spec.label}`" class="slot-card__spec">
                  <dt>{{ spec.label }}</dt>
                  <dd>{{ spec.value }}</dd>
                </div>
              </dl>

            </template>

            <template v-else-if="slot.id && slot.state === 'unresolved'">
              <h2>Unresolved selection</h2>
              <p class="slot-card__meta">{{ slot.id }}</p>
              <p class="slot-card__note">The id is still preserved in URL state, but the catalog can no longer resolve it.</p>
            </template>

            <template v-else>
              <h2>Empty</h2>
              <p class="slot-card__meta">{{ slotNote(slot.kind) || "No part selected yet." }}</p>
              <dl v-if="slotSpecs(slot.kind, null).length" class="slot-card__specs">
                <div v-for="spec in slotSpecs(slot.kind, null)" :key="`${slot.kind}-${spec.label}`" class="slot-card__spec">
                  <dt>{{ spec.label }}</dt>
                  <dd>{{ spec.value }}</dd>
                </div>
              </dl>
            </template>
          </article>
        </div>

        <section class="issues-panel" v-if="buildIssues.length">
          <h3>Build Issues</h3>
          <div v-for="section in buildIssues" :key="section.kind" class="issues-panel__group">
            <strong>{{ slotOrder.find((slot) => slot.kind === section.kind)?.label }}</strong>
            <ul>
              <li v-for="issue in section.issues" :key="issue">{{ issue }}</li>
            </ul>
          </div>
        </section>
      </aside>

      <section class="main-panel">
        <div class="main-panel__header">
          <div>
            <h2>Hardware Library</h2>
            <p>Active constraints: <strong>{{ activeConstraintLabel }}</strong></p>
          </div>

          <div class="toolbar">
            <label class="search-field">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l5 5" />
              </svg>
              <input :value="search" type="search" placeholder="Search models..." @input="onSearchInput" />
            </label>
          </div>
        </div>

        <div class="kind-tabs" role="tablist" aria-label="Part kinds">
          <button
            v-for="kind in tabOrder"
            :key="kind"
            :class="['kind-tab', { 'kind-tab--active': activeKind === kind }]"
            type="button"
            @click="changeKind(kind)"
          >
            {{ kind }}
          </button>
        </div>

        <div class="constraint-strip">
          <div v-for="meter in constraintMeters" :key="meter.label" class="constraint-meter">
            <div class="constraint-meter__label">
              <span>{{ meter.label }}</span>
              <strong>{{ meter.value }}</strong>
            </div>
            <div class="constraint-meter__track">
              <span :class="['constraint-meter__fill', `constraint-meter__fill--${meter.tone}`]" :style="{ width: `${meter.ratio * 100}%` }"></span>
            </div>
          </div>
        </div>

        <div v-if="pending" class="state-box">Loading build data...</div>
        <div v-else-if="error" class="state-box state-box--error">{{ error }}</div>
        <div v-else-if="genericError" class="state-box state-box--error">{{ genericError }}</div>
        <div v-else class="table-shell">
          <div class="table-scroll">
            <table class="parts-table">
              <thead>
                <tr v-if="activeKind === 'gpu'">
                  <th>Status</th>
                  <th>Model</th>
                  <th>Length</th>
                  <th>Thickness</th>
                  <th>Slots</th>
                  <th>Power</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
                <tr v-else-if="activeKind === 'case'">
                  <th>Status</th>
                  <th>Case</th>
                  <th>Volume</th>
                  <th>GPU max length</th>
                  <th>GPU max thickness</th>
                  <th>PCIe slots</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
                <tr v-else-if="activeKind === 'cpu-cooler'">
                  <th>Status</th>
                  <th>Name</th>
                  <th>Height</th>
                  <th>Footprint</th>
                  <th>TDP</th>
                  <th>Fan</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
                <tr v-else-if="activeKind === 'psu'">
                  <th>Status</th>
                  <th>Name</th>
                  <th>
                    <span class="th-with-help">
                      Tier
                      <span class="info-trigger" tabindex="0" aria-label="About PSU tier ratings">
                        i
                        <span class="info-popover" role="tooltip">
                          Community PSU quality rating from SPL's PSU Tier List. Unmatched PSUs show "-".
                          <a :href="psuTierSourceUrl" target="_blank" rel="noreferrer">Open source</a>
                        </span>
                      </span>
                    </span>
                  </th>
                  <th>Form factor</th>
                  <th>Wattage</th>
                  <th>12VHPWR</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
                <tr v-else-if="activeKind === 'motherboard'">
                  <th>Status</th>
                  <th>Name</th>
                  <th>Form factor</th>
                  <th>Socket</th>
                  <th>Chipset</th>
                  <th>RAM</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
                <tr v-else-if="activeKind === 'ram'">
                  <th>Status</th>
                  <th>Name</th>
                  <th>Height</th>
                  <th>Type</th>
                  <th>RGB</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
                <tr v-else>
                  <th>Status</th>
                  <th>Name</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody v-if="candidateRows.length">
                <tr
                  v-for="row in candidateRows"
                  :key="row.id"
                  :class="['parts-row', `parts-row--${row.verdict}`, { 'parts-row--selected': row.selected }]"
                >
                  <td class="status-cell">
                    <span :class="['status-chip', `status-chip--${row.verdict}`]">{{ verdictLabel(row.verdict) }}</span>
                  </td>
                  <td>
                    <div class="title-cell">
                      <strong>{{ row.title }}</strong>
                      <span>{{ row.subtitle }}</span>
                    </div>
                  </td>
                  <td
                    v-for="(value, index) in row.numericCells"
                    :key="`${row.id}-${index}`"
                    :class="['mono-cell', { 'mono-cell--alert': row.verdict === 'fail' && value === row.numericCells[0] }]"
                  >
                    {{ value }}
                  </td>
                  <td class="notes-cell">{{ row.note }}</td>
                  <td class="action-cell">
                    <button
                      :class="['table-button', `table-button--${row.actionTone}`]"
                      type="button"
                      @click="row.selected ? clearSlot(row.kind) : selectPart(row.source)"
                    >
                      {{ row.actionLabel }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="!candidateRows.length && !genericPending" class="state-box">No rows match the active filters.</div>
          </div>

          <footer class="table-footer">
            <span>{{ displayStart }}-{{ displayEnd }} of {{ totalRows }} rows</span>
            <div class="pager">
              <button class="button button--ghost" type="button" :disabled="page <= 1" @click="page -= 1">Previous</button>
              <strong>Page {{ page }} / {{ pageCount }}</strong>
              <button class="button button--ghost" type="button" :disabled="page >= pageCount" @click="page += 1">Next</button>
            </div>
          </footer>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
:global(html) {
  background: #f8f9ff;
}

:global(body) {
  margin: 0;
  background:
    linear-gradient(180deg, #f8f9ff 0%, #f3f6ff 52%, #eef3ff 100%);
  color: #0b1c30;
}

.build-page {
  --paper: #f8f9ff;
  --surface: #ffffff;
  --surface-soft: #eff4ff;
  --surface-strong: #dce9ff;
  --line: #c6d2e7;
  --line-strong: #8fa3c6;
  --ink: #0b1c30;
  --ink-soft: #4a566c;
  --accent: #0d9488;
  --accent-soft: #d5f6f1;
  --warning: #a46800;
  --warning-soft: #fff0cf;
  --danger: #ba1a1a;
  --danger-soft: #ffe3df;
  min-height: 100vh;
  background:
    linear-gradient(to right, rgba(211, 228, 254, 0.5) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(211, 228, 254, 0.5) 1px, transparent 1px),
    linear-gradient(180deg, #f8f9ff 0%, #f2f6ff 100%);
  background-size: 40px 40px, 40px 40px, auto;
}

.topbar {
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.94);
}

.topbar__inner,
.workspace {
  max-width: 1280px;
  margin: 0 auto;
}

.workspace {
  width: min(calc(100% - 6rem), 1600px);
  max-width: none;
}

.topbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  min-height: 4rem;
  padding: 0 2rem;
}

.brand {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.04em;
}

.nav {
  display: flex;
  gap: 1rem;
}

.nav__item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--ink-soft);
  text-decoration: none;
  font-size: 0.95rem;
  padding: 0.5rem 0.2rem;
  border-bottom: 2px solid transparent;
}

.nav__item svg,
.icon-button svg,
.build-toggle svg,
.drawer-handle svg,
.system-link svg {
  width: 1rem;
  height: 1rem;
  stroke: currentColor;
  stroke-width: 1.8;
  fill: none;
  stroke-linecap: square;
  stroke-linejoin: miter;
}

.nav__item--active {
  color: var(--accent);
  border-color: var(--accent);
  font-weight: 700;
}

.topbar__tools {
  display: flex;
  gap: 0.5rem;
}

.build-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 2.2rem;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  padding: 0 0.75rem;
}

.build-toggle:hover,
.build-toggle[aria-expanded="true"] {
  border-color: var(--accent);
  color: var(--accent);
}

.drawer-handle {
  position: fixed;
  z-index: 70;
  top: 5rem;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--line);
  border-left: 0;
  background: var(--surface);
  box-shadow: 0.35rem 0.45rem 1rem rgba(22, 35, 58, 0.12);
  color: var(--ink);
  font: inherit;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 0.55rem 0.7rem 0.55rem 0.55rem;
  text-transform: uppercase;
}

.drawer-handle:hover,
.drawer-handle:focus-visible {
  border-color: var(--accent);
  color: var(--accent);
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-soft);
}

.icon-button:hover {
  border-color: var(--line);
  background: var(--surface-soft);
  color: var(--ink);
}

.workspace {
  display: block;
  min-height: calc(100vh - 4rem);
  border-left: 1px solid var(--line);
  border-right: 1px solid var(--line);
  background: rgba(248, 249, 255, 0.9);
}

.drawer-scrim {
  position: fixed;
  z-index: 80;
  inset: 4rem 0 0;
  border: 0;
  background: rgba(21, 31, 49, 0.08);
  padding: 0;
}

.sidebar {
  position: fixed;
  z-index: 90;
  top: 4rem;
  bottom: 0;
  left: 0;
  display: flex;
  width: min(22rem, calc(100vw - 1.5rem));
  flex-direction: column;
  transform: translateX(-105%);
  border-right: 1px solid var(--line);
  box-shadow: 0.9rem 0 2rem rgba(22, 35, 58, 0.16);
  background: rgba(255, 255, 255, 0.92);
  overflow-y: auto;
  transition: transform 180ms ease-out;
}

.sidebar--open {
  transform: translateX(0);
}

.sidebar__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid var(--line);
}

.sidebar__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--ink-soft);
  padding: 0;
}

.sidebar__close:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.sidebar__close svg {
  width: 0.9rem;
  height: 0.9rem;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
  stroke-linecap: square;
}

.sidebar__header h1,
.main-panel__header h2 {
  margin: 0 0 0.4rem;
  font-size: 2rem;
  line-height: 1.1;
  letter-spacing: -0.04em;
}

.sidebar__header p,
.main-panel__header p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.95rem;
}

.sidebar__summary {
  display: block;
  margin-top: 0.65rem;
  font-size: 0.84rem;
  color: var(--ink-soft);
}

.slot-stack {
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
}

.slot-card {
  border: 1px solid var(--line);
  border-top: 2px solid var(--line-strong);
  background: var(--surface);
  padding: 0.9rem;
}

.slot-card--empty {
  background: var(--surface-soft);
  border-style: dashed;
}

.slot-card--pass {
  border-top-color: var(--accent);
}

.slot-card--conditional {
  border-top-color: #d28c00;
}

.slot-card--fail,
.slot-card--unresolved {
  border-color: #efb0a8;
  border-top-color: var(--danger);
}

.slot-card__top,
.slot-card__actions,
.slot-card__top-actions,
.main-panel__header,
.toolbar,
.table-footer,
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.slot-card__top-actions {
  justify-content: flex-end;
  gap: 0.45rem;
}

.slot-card__label,
.badge,
.parts-table th,
.issues-panel h3 {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.badge {
  padding: 0.2rem 0.45rem;
  border-radius: 2px;
}

.slot-card__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.45rem;
  height: 1.45rem;
  border: 1px solid #efb0a8;
  background: transparent;
  color: var(--danger);
  padding: 0;
}

.slot-card__browse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.45rem;
  height: 1.45rem;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--ink);
  padding: 0;
}

.slot-card__browse:hover {
  background: rgba(205, 217, 238, 0.28);
}

.slot-card__clear:hover {
  background: var(--danger-soft);
}

.slot-card__clear svg,
.slot-card__browse svg {
  width: 0.82rem;
  height: 0.82rem;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
  stroke-linecap: square;
}

.badge--pass,
.status-chip--pass {
  background: var(--accent-soft);
  color: #0b5d56;
}

.badge--conditional,
.status-chip--conditional {
  background: var(--warning-soft);
  color: var(--warning);
}

.badge--fail,
.status-chip--fail {
  background: var(--danger-soft);
  color: var(--danger);
}

.badge--unscored,
.status-chip--unscored {
  background: #edf2fb;
  color: #526277;
}

.slot-card h2 {
  margin: 0.8rem 0 0.2rem;
  font-size: 1.1rem;
  line-height: 1.25;
}

.slot-card__meta,
.slot-card__note,
.slot-card__spec dd,
.title-cell span,
.title-cell small,
.state-box {
  color: var(--ink-soft);
  font-size: 0.83rem;
}

.slot-card__note {
  margin: 0.7rem 0 0;
  padding: 0.55rem 0.65rem;
  background: rgba(255, 227, 223, 0.42);
}

.slot-card__specs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  margin: 0.75rem 0 0;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(198, 210, 231, 0.75);
}

.slot-card__spec {
  min-width: 0;
}

.slot-card__spec dt {
  margin: 0;
  color: var(--ink);
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.66rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.slot-card__spec dd {
  margin: 0.14rem 0 0;
  color: var(--ink-soft);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.3;
  word-break: break-word;
}

.button,
.table-button,
.kind-tab,
.search-field input,
.icon-button,
.build-toggle {
  font: inherit;
}

.button,
.table-button {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  padding: 0.45rem 0.7rem;
}

.button:disabled,
.table-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.button--ghost:hover,
.table-button--add:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.button--danger,
.table-button--remove {
  border-color: #efb0a8;
  color: var(--danger);
}

.button--danger:hover,
.table-button--remove:hover {
  background: var(--danger-soft);
}

.issues-panel {
  margin-top: auto;
  padding: 1rem 1rem 1.25rem;
  border-top: 1px solid #f1beb7;
  background: rgba(255, 227, 223, 0.38);
}

.issues-panel h3 {
  margin: 0 0 0.8rem;
  color: var(--danger);
}

.issues-panel__group + .issues-panel__group {
  margin-top: 0.9rem;
}

.issues-panel ul {
  margin: 0.45rem 0 0;
  padding-left: 1rem;
  color: var(--ink-soft);
  font-size: 0.88rem;
}

.main-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.main-panel__header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.88);
}

.toolbar {
  justify-content: flex-end;
}

.search-field {
  position: relative;
  display: block;
}

.search-field svg {
  position: absolute;
  left: 0.7rem;
  top: 50%;
  width: 1rem;
  height: 1rem;
  transform: translateY(-50%);
  stroke: var(--ink-soft);
  stroke-width: 1.7;
  fill: none;
}

.search-field input {
  width: min(20rem, 50vw);
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--ink);
  padding: 0.7rem 0.85rem 0.7rem 2.1rem;
}

.kind-tabs {
  display: flex;
  gap: 0.35rem;
  padding: 0.85rem 1.5rem 0;
  overflow-x: auto;
}

.kind-tab {
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  color: var(--ink-soft);
  padding: 0.55rem 0.8rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.77rem;
  text-transform: uppercase;
}

.kind-tab--active {
  background: var(--surface);
  border-color: var(--line);
  color: var(--ink);
}

.constraint-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  padding: 1rem 1.5rem 1.15rem;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.85);
}

.constraint-meter {
  display: grid;
  gap: 0.5rem;
}

.constraint-meter__label {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.73rem;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.constraint-meter__label strong {
  color: var(--ink);
}

.constraint-meter__track {
  height: 0.38rem;
  background: #dfe8f6;
}

.constraint-meter__fill {
  display: block;
  height: 100%;
}

.constraint-meter__fill--pass {
  background: var(--accent);
}

.constraint-meter__fill--conditional {
  background: #d28c00;
}

.constraint-meter__fill--neutral {
  background: #8ea0bb;
}

.state-box {
  padding: 1rem 1.5rem;
}

.state-box--error {
  color: var(--danger);
}

.table-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.table-scroll {
  position: relative;
  flex: 1;
  overflow: auto;
  padding: 1rem 1rem 0;
}

.parts-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--line);
}

.parts-table th,
.parts-table td {
  padding: 0.85rem 0.9rem;
  border-bottom: 1px solid rgba(198, 210, 231, 0.65);
  text-align: left;
  vertical-align: top;
}

.parts-table th {
  position: relative;
  z-index: 1;
  background: #eef3ff;
  color: var(--ink-soft);
}

.th-with-help {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.info-trigger {
  position: relative;
  z-index: 3;
  display: inline-grid;
  width: 1rem;
  height: 1rem;
  place-items: center;
  border: 1px solid rgba(61, 77, 106, 0.45);
  border-radius: 999px;
  color: var(--ink-soft);
  cursor: help;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
}

.info-trigger:focus-visible {
  outline: 2px solid rgba(48, 101, 193, 0.35);
  outline-offset: 2px;
}

.info-popover {
  position: absolute;
  z-index: 200;
  top: calc(100% + 0.45rem);
  left: 50%;
  display: none;
  width: min(17rem, 72vw);
  transform: translateX(-50%);
  border: 1px solid rgba(124, 140, 166, 0.5);
  border-radius: 0.45rem;
  background: #fbfcff;
  box-shadow: 0 0.75rem 1.7rem rgba(22, 35, 58, 0.16);
  color: var(--ink);
  font-size: 0.76rem;
  font-weight: 500;
  line-height: 1.35;
  padding: 0.65rem 0.7rem;
  white-space: normal;
}

.info-popover a {
  display: inline-block;
  margin-top: 0.35rem;
  color: var(--accent);
  font-weight: 800;
}

.info-trigger:hover .info-popover,
.info-trigger:focus-visible .info-popover,
.info-trigger:focus-within .info-popover {
  display: block;
}

.parts-row:hover {
  background: #f7faff;
}

.parts-row--conditional {
  background: rgba(255, 240, 207, 0.22);
}

.parts-row--fail {
  background: rgba(255, 227, 223, 0.26);
}

.parts-row--selected {
  outline: 1px solid var(--line-strong);
  outline-offset: -1px;
}

.title-cell {
  display: grid;
  gap: 0.18rem;
}

.title-cell strong {
  font-size: 0.98rem;
}

.mono-cell {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.8rem;
  color: var(--ink);
  white-space: nowrap;
}

.mono-cell--alert {
  background: rgba(255, 227, 223, 0.64);
  color: var(--danger);
  font-weight: 700;
}

.notes-cell {
  width: min(21rem, 30vw);
  max-width: 24rem;
  color: var(--ink-soft);
  font-size: 0.82rem;
  line-height: 1.35;
}

.status-cell,
.action-cell {
  white-space: nowrap;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.45rem;
  border-radius: 2px;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.68rem;
  letter-spacing: 0.06em;
}

.table-footer {
  padding: 0.9rem 1rem 1rem;
  border-top: 1px solid var(--line);
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.78rem;
  color: var(--ink-soft);
}

.pager strong {
  color: var(--ink);
}

.text-pass {
  color: var(--accent);
}

.text-conditional {
  color: var(--warning);
}

.text-fail {
  color: var(--danger);
}

@media (max-width: 720px) {
  .workspace {
    width: 100%;
    border-right: 0;
    border-left: 0;
  }

  .topbar__inner,
  .system-bar__inner,
  .main-panel__header,
  .constraint-strip {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .topbar__inner {
    flex-wrap: wrap;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .topbar__tools {
    margin-left: auto;
  }

  .drawer-handle {
    top: auto;
    bottom: 1rem;
  }

  .drawer-scrim {
    inset: 0;
  }

  .sidebar {
    top: 0;
    width: min(22rem, calc(100vw - 0.75rem));
  }

  .nav {
    order: 3;
    width: 100%;
    justify-content: flex-start;
  }

  .system-bar__inner,
  .main-panel__header,
  .slot-card__actions,
  .table-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .constraint-strip {
    grid-template-columns: 1fr;
  }

  .search-field,
  .search-field input {
    width: 100%;
  }

  .parts-table {
    min-width: 54rem;
  }

  .notes-cell {
    width: 16rem;
    max-width: 16rem;
  }
}
</style>
