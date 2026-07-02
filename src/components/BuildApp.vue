<script setup lang="ts">
import Fuse from "fuse.js";
import { computed, onMounted, ref, watch } from "vue";
import { checkCaseGpuCompatibility } from "../lib/compatibility";
import type {
  CasePart,
  CompatibilityIssue,
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
const genericKinds = new Set<SelectableKind>(["psu", "cpu-cooler", "motherboard", "ram"]);
const selectedIds = ref<SelectedIds>({});
const activeKind = ref<SelectableKind>("gpu");
const search = ref("");
const page = ref(1);
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
const compatibility = computed<CompatibilityResult | null>(() => {
  if (!activeCase.value || !activeGpu.value) return null;
  return checkCaseGpuCompatibility(activeCase.value, activeGpu.value);
});
const buildStatus = computed<BuildStatus>(() => compatibility.value?.verdict ?? "in-progress");
const buildStatusLabel = computed(() => {
  if (buildStatus.value === "in-progress") return "IN PROGRESS";
  return buildStatus.value.toUpperCase();
});
const buildStatusCopy = computed(() => {
  if (buildStatus.value === "in-progress") return "Select a case and a GPU to evaluate fitment.";
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
const pageCount = computed(() => Math.max(1, Math.ceil(totalRows.value / pageSize)));
const displayStart = computed(() => (totalRows.value ? (page.value - 1) * pageSize + 1 : 0));
const displayEnd = computed(() => Math.min(page.value * pageSize, totalRows.value));

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

  if (activeGpu.value && compatibility.value?.issues.length) {
    sections.push({
      kind: "gpu",
      issues: compatibility.value.issues.map((issue) => issue.message)
    });
  }

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

  if (activeKind.value === "case" || activeKind.value === "gpu") {
    rows.sort((a, b) => {
      const verdictDelta = verdictRank(a.verdict) - verdictRank(b.verdict);
      if (verdictDelta !== 0) return verdictDelta;
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

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
      pageSize: String(pageSize)
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

function slotVerdict(kind: SelectableKind): DisplayVerdict {
  if (kind === "gpu" && activeGpu.value && compatibility.value) return compatibility.value.verdict;
  if (kind === "case" && activeCase.value) return "pass";
  if (genericKinds.has(kind) && selectedIds.value[kind]) return "conditional";
  return "unscored";
}

function slotNote(kind: SelectableKind) {
  if (kind === "gpu" && compatibility.value?.issues.length) {
    return firstIssue(compatibility.value.issues);
  }

  if (kind === "psu" && activeCase.value?.psu) {
    return `Constraint: ${activeCase.value.psu}`;
  }

  if (kind === "cpu-cooler" && activeCase.value?.dimensions.cpuCoolerHeightMm) {
    return `Constraint: max ${formatValue(activeCase.value.dimensions.cpuCoolerHeightMm, "mm")}`;
  }

  if (genericKinds.has(kind) && selectedIds.value[kind]) {
    return "Selection stored in the build, fitment logic for this slot lands in a later layer.";
  }

  return "";
}

function displayTitle(part: PartRecord | null) {
  if (!part) return "Missing catalog record";
  if (part.kind === "case") return `${part.seller} ${part.name}`.trim();
  if (part.kind === "gpu") return `${part.brand} ${part.model || part.name}`.trim();
  return part.displayName || [part.brand, part.name].filter(Boolean).join(" ").trim() || part.id;
}

function displaySubtitle(part: PartRecord | null) {
  if (!part) return "";
  if (part.kind === "case") {
    return part.dimensions.volumeL ? `${formatValue(part.dimensions.volumeL, "L")} volume` : part.style || part.sourceSheet;
  }
  if (part.kind === "gpu") {
    return part.chipset || `${formatValue(part.tdpW, "W")} TDP`;
  }
  return `${part.sourceSheet} #${part.rowNumber}`;
}

function buildCaseRow(part: CasePart): CandidateRow {
  const selected = selectedIds.value.case === part.id;
  const result = activeGpu.value ? checkCaseGpuCompatibility(part, activeGpu.value) : null;

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
    verdict: result?.verdict ?? (activeGpu.value ? "conditional" : "unscored"),
    note: result ? firstIssue(result.issues) : "Select a GPU to evaluate case-side fitment evidence.",
    selected,
    actionLabel: selected ? "Remove" : "Add",
    actionTone: selected ? "remove" : "add",
    source: part
  };
}

function buildGpuRow(part: GpuPart): CandidateRow {
  const selected = selectedIds.value.gpu === part.id;
  const result = activeCase.value ? checkCaseGpuCompatibility(activeCase.value, part) : null;
  const lengthCell = formatValue(part.dimensions.lengthMm, "mm");
  const thicknessCell = formatValue(part.dimensions.thicknessMm, "mm");
  const slotsCell = formatValue(part.dimensions.pcieSlots);

  return {
    id: part.id,
    kind: "gpu",
    title: displayTitle(part),
    subtitle: part.chipset || part.name || "GPU",
    details: part.pciePins || "Power connector unknown",
    numericCells: [lengthCell, thicknessCell, slotsCell, formatValue(part.tdpW, "W")],
    verdict: result?.verdict ?? (activeCase.value ? "conditional" : "unscored"),
    note: result ? firstIssue(result.issues) : "Select a case to expose hard fitment limits and cautionary rows.",
    selected,
    actionLabel: selected ? "Remove" : "Add",
    actionTone: selected ? "remove" : "add",
    source: part
  };
}

function buildGenericRow(part: GenericPart & { kind: SelectableKind }): CandidateRow {
  const selected = selectedIds.value[part.kind] === part.id;
  const specs = Object.entries(part.raw)
    .filter(([, value]) => value.trim())
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" / ");

  return {
    id: part.id,
    kind: part.kind,
    title: displayTitle(part),
    subtitle: part.status || part.sourceSheet,
    details: specs || "No structured fitment evidence yet for this slot.",
    numericCells: [part.sourceSheet, `#${part.rowNumber}`, part.status || "Catalog record", String(part.flags.length)],
    verdict: "conditional",
    note: "This slot is stored in URL state today, detailed fitment rules land in a later layer.",
    selected,
    actionLabel: selected ? "Remove" : "Add",
    actionTone: selected ? "remove" : "add",
    source: part
  };
}

function formatValue(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined) return "—";
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  return `${formatted}${unit}`;
}

function firstIssue(issues: CompatibilityIssue[]) {
  return issues[0]?.message ?? "No immediate issues in the active fitment rules.";
}

function ratioFromLimit(value: number | null | undefined, ceiling: number) {
  if (!value) return 0.34;
  return Math.max(0.12, Math.min(0.94, value / ceiling));
}

function systemPath() {
  if (typeof window === "undefined") return "/build";
  return `${window.location.host}${window.location.pathname}${window.location.search}`;
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

    <div class="system-bar">
      <div class="system-bar__inner">
        <div class="system-link">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.5 14.5l-2 2a3 3 0 01-4.2-4.2l3.2-3.2a3 3 0 014.2 0" />
            <path d="M14.5 9.5l2-2a3 3 0 114.2 4.2l-3.2 3.2a3 3 0 01-4.2 0" />
            <path d="M8.8 15.2l6.4-6.4" />
          </svg>
          <span>{{ systemPath() }}</span>
        </div>

        <div class="system-state">
          <span :class="['system-state__dot', `system-state__dot--${buildStatus === 'in-progress' ? 'conditional' : buildStatus}`]"></span>
          <span>{{ buildStatus === "fail" ? "Conflict" : buildStatus === "conditional" ? "Warning" : buildStatus === "pass" ? "Clear" : "Draft" }}</span>
          <span>v2.0.4-build</span>
        </div>
      </div>
    </div>

    <main class="workspace">
      <aside class="sidebar">
        <div class="sidebar__header">
          <h1>Current Build</h1>
          <p>
            Compatibility status:
            <strong :class="`text-${buildStatus === 'in-progress' ? 'conditional' : buildStatus}`">{{ buildStatusLabel }}</strong>
          </p>
          <span class="sidebar__summary">{{ buildStatusCopy }}</span>
        </div>

        <div class="slot-stack">
          <article
            v-for="slot in selectedSlots"
            :key="slot.kind"
            :class="[
              'slot-card',
              `slot-card--${slotVerdict(slot.kind)}`,
              {
                'slot-card--empty': !slot.id,
                'slot-card--unresolved': slot.state === 'unresolved'
              }
            ]"
          >
            <div class="slot-card__top">
              <span class="slot-card__label">{{ slotOrder.find((entry) => entry.kind === slot.kind)?.label }}</span>
              <span v-if="slot.id" :class="['badge', `badge--${slotVerdict(slot.kind)}`]">
                {{ verdictCopy(slotVerdict(slot.kind)) }}
              </span>
            </div>

            <template v-if="slot.id && slot.part">
              <h2>{{ displayTitle(slot.part) }}</h2>
              <p class="slot-card__meta">{{ displaySubtitle(slot.part) }}</p>
              <p v-if="slotNote(slot.kind)" class="slot-card__note">{{ slotNote(slot.kind) }}</p>

              <div class="slot-card__actions">
                <button class="button button--ghost" type="button" @click="openSlot(slot.kind)">Inspect</button>
                <button class="button button--danger" type="button" @click="clearSlot(slot.kind)">Clear</button>
              </div>
            </template>

            <template v-else-if="slot.id && slot.state === 'unresolved'">
              <h2>Unresolved selection</h2>
              <p class="slot-card__meta">{{ slot.id }}</p>
              <p class="slot-card__note">The id is still preserved in URL state, but the catalog can no longer resolve it.</p>
              <div class="slot-card__actions">
                <button class="button button--ghost" type="button" @click="openSlot(slot.kind)">Review slot</button>
                <button class="button button--danger" type="button" @click="clearSlot(slot.kind)">Clear</button>
              </div>
            </template>

            <template v-else>
              <h2>Empty</h2>
              <p class="slot-card__meta">{{ slotNote(slot.kind) || "No part selected yet." }}</p>
              <div class="slot-card__actions">
                <button class="button button--ghost" type="button" @click="openSlot(slot.kind)">
                  {{ slotOrder.find((entry) => entry.kind === slot.kind)?.actionLabel }}
                </button>
              </div>
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
                  <th>Action</th>
                </tr>
                <tr v-else-if="activeKind === 'case'">
                  <th>Status</th>
                  <th>Case</th>
                  <th>Volume</th>
                  <th>GPU max length</th>
                  <th>GPU max thickness</th>
                  <th>PCIe slots</th>
                  <th>Action</th>
                </tr>
                <tr v-else>
                  <th>Status</th>
                  <th>Part</th>
                  <th>Source</th>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Flags</th>
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
                      <small>{{ row.note }}</small>
                    </div>
                  </td>
                  <td
                    v-for="value in row.numericCells"
                    :key="`${row.id}-${value}`"
                    :class="['mono-cell', { 'mono-cell--alert': row.verdict === 'fail' && value === row.numericCells[0] }]"
                  >
                    {{ value }}
                  </td>
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

.topbar,
.system-bar {
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.94);
}

.topbar__inner,
.system-bar__inner,
.workspace {
  max-width: 1280px;
  margin: 0 auto;
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

.system-bar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 2rem;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.78rem;
  color: var(--ink-soft);
}

.system-link,
.system-state {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.system-state__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
}

.system-state__dot--pass {
  background: var(--accent);
}

.system-state__dot--conditional {
  background: #d28c00;
}

.system-state__dot--fail {
  background: var(--danger);
}

.workspace {
  display: grid;
  grid-template-columns: 20rem minmax(0, 1fr);
  min-height: calc(100vh - 6.6rem);
  border-left: 1px solid var(--line);
  border-right: 1px solid var(--line);
  background: rgba(248, 249, 255, 0.9);
}

.sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.92);
}

.sidebar__header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--line);
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
.main-panel__header,
.toolbar,
.table-footer,
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
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

.button,
.table-button,
.kind-tab,
.search-field input,
.icon-button {
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
  background: #eef3ff;
  color: var(--ink-soft);
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

@media (max-width: 1080px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: none;
    border-bottom: 1px solid var(--line);
  }
}

@media (max-width: 720px) {
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
    min-width: 44rem;
  }
}
</style>
