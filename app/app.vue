<script setup lang="ts">
import Fuse from "fuse.js";
import { checkCaseGpuCompatibility } from "./lib/compatibility";
import type { CasePart, CompatibilityResult, GenericPart, GpuPart, PartKind, SffPart } from "./types";

const { data, pending, error } = await useFetch<{ source: string; cases: CasePart[]; gpus: GpuPart[] }>("/api/parts");
const { data: catalogData, pending: catalogPending, error: catalogError } = await useFetch<{
  source: string;
  summary: {
    total: number;
    byKind: Record<string, number>;
    bySourceSheet: Record<string, number>;
  };
  parts: GenericPart[];
}>("/api/catalog");

const query = ref("");
const mode = ref<PartKind | "all">("all");
const activeView = ref<"compatibility" | "data">("compatibility");
const catalogQuery = ref("");
const catalogKind = ref<PartKind | "all">("all");
const catalogSourceSheet = ref<string>("all");
const selectedCase = ref<CasePart | null>(null);
const selectedGpu = ref<GpuPart | null>(null);

const allParts = computed<SffPart[]>(() => [...(data.value?.cases ?? []), ...(data.value?.gpus ?? [])]);
const catalogParts = computed<GenericPart[]>(() => catalogData.value?.parts ?? []);

const fuse = computed(
  () =>
    new Fuse(allParts.value, {
      keys: ["name", "model", "brand", "seller", "chipset", "style"],
      threshold: 0.32,
      ignoreLocation: true
    })
);

const visibleParts = computed(() => {
  const pool = mode.value === "all" ? allParts.value : allParts.value.filter((part) => part.kind === mode.value);
  if (!query.value.trim()) return pool.slice(0, 80);
  const ids = new Set(pool.map((part) => part.id));
  return fuse.value
    .search(query.value)
    .map((result) => result.item)
    .filter((part) => ids.has(part.id))
    .slice(0, 80);
});

const catalogFuse = computed(
  () =>
    new Fuse(catalogParts.value, {
      keys: ["displayName", "brand", "name", "kind", "sourceSheet", "status"],
      threshold: 0.3,
      ignoreLocation: true
    })
);

const kindOptions = computed(() =>
  Object.entries(catalogData.value?.summary.byKind ?? {})
    .sort(([, a], [, b]) => b - a)
    .map(([kind, count]) => ({ kind, count }))
);

const sourceSheetOptions = computed(() =>
  Object.entries(catalogData.value?.summary.bySourceSheet ?? {})
    .sort(([, a], [, b]) => b - a)
    .map(([sourceSheet, count]) => ({ sourceSheet, count }))
);

const visibleCatalogParts = computed(() => {
  const queryText = catalogQuery.value.trim();
  let pool = catalogParts.value;

  if (catalogKind.value !== "all") {
    pool = pool.filter((part) => part.kind === catalogKind.value);
  }
  if (catalogSourceSheet.value !== "all") {
    pool = pool.filter((part) => part.sourceSheet === catalogSourceSheet.value);
  }

  if (queryText) {
    const ids = new Set(pool.map((part) => part.id));
    return catalogFuse.value
      .search(queryText)
      .map((result) => result.item)
      .filter((part) => ids.has(part.id))
      .slice(0, 250);
  }

  return pool.slice(0, 250);
});

const compatibility = computed<CompatibilityResult | null>(() => {
  if (!selectedCase.value || !selectedGpu.value) return null;
  return checkCaseGpuCompatibility(selectedCase.value, selectedGpu.value);
});

function selectPart(part: SffPart) {
  if (part.kind === "case") {
    selectedCase.value = part;
    mode.value = selectedGpu.value ? "all" : "gpu";
  } else {
    selectedGpu.value = part;
    mode.value = selectedCase.value ? "all" : "case";
  }
  query.value = "";
}

function titleFor(part: SffPart | null) {
  if (!part) return "None selected";
  if (part.kind === "case") return `${part.seller} ${part.name}`.trim();
  return `${part.brand} ${part.model} ${part.name}`.trim();
}

function metaFor(part: SffPart) {
  if (part.kind === "case") {
    return `${part.style || "Unknown style"} / ${part.dimensions.volumeL ?? "?"}L / GPU ${part.dimensions.gpuLengthMm ?? "?"} x ${part.dimensions.gpuWidthMm ?? "?"} x ${part.dimensions.gpuThicknessMm ?? "?"}mm`;
  }
  return `${part.chipset} / ${part.dimensions.lengthMm ?? "?"} x ${part.dimensions.widthMm ?? "?"} x ${part.dimensions.thicknessMm ?? "?"}mm / ${part.dimensions.pcieSlots ?? "?"} slot`;
}

function partCompatibilityClass(part: SffPart) {
  if (part.kind === "gpu" && selectedCase.value) {
    return checkCaseGpuCompatibility(selectedCase.value, part).verdict === "fail" ? "ghosted" : "";
  }
  if (part.kind === "case" && selectedGpu.value) {
    return checkCaseGpuCompatibility(part, selectedGpu.value).verdict === "fail" ? "ghosted" : "";
  }
  return "";
}

function clearancePercent(value: number | null) {
  if (value === null) return 0;
  if (value < 0) return 100;
  return Math.max(8, Math.min(100, 100 - value));
}

function topEntries(entries: Record<string, number> | undefined, limit = 8) {
  return Object.entries(entries ?? {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}

function sampleSpecs(part: GenericPart) {
  return Object.entries(part.raw)
    .filter(([, value]) => value.trim())
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" / ");
}

function setCatalogKind(kind: string) {
  catalogKind.value = kind as PartKind;
}
</script>

<template>
  <main class="layout">
    <aside class="rail">
      <p class="eyebrow">SFF Builder / {{ data?.source ?? "loading" }}</p>
      <h1 class="title">Start from...</h1>

      <div class="view-switch">
        <button :class="{ active: activeView === 'compatibility' }" @click="activeView = 'compatibility'">Compatibility</button>
        <button :class="{ active: activeView === 'data' }" @click="activeView = 'data'">Data</button>
      </div>

      <template v-if="activeView === 'compatibility'">
        <input v-model="query" class="search" placeholder="Case, GPU, seller, chipset" />

        <div class="mode-grid">
          <UButton :variant="mode === 'case' ? 'solid' : 'outline'" block @click="() => { mode = 'case' }">Case</UButton>
          <UButton :variant="mode === 'gpu' ? 'solid' : 'outline'" block @click="() => { mode = 'gpu' }">GPU</UButton>
        </div>
        <UButton :variant="mode === 'all' ? 'solid' : 'ghost'" block @click="() => { mode = 'all' }">All parts</UButton>

        <div v-if="pending" class="part-list">
          <div class="part-row">Loading parts...</div>
        </div>
        <div v-else-if="error" class="part-list">
          <div class="part-row">Run npm run intake, then restart Nuxt.</div>
        </div>
        <div v-else class="part-list">
          <button
            v-for="part in visibleParts"
            :key="part.id"
            class="part-row"
            :class="[partCompatibilityClass(part), { active: selectedCase?.id === part.id || selectedGpu?.id === part.id }]"
            @click="selectPart(part)"
          >
            <span class="part-main">
              <span>{{ titleFor(part) }}</span>
              <span>{{ part.kind }}</span>
            </span>
            <span class="part-meta">{{ metaFor(part) }}</span>
          </button>
        </div>
      </template>

      <template v-else>
        <input v-model="catalogQuery" class="search" placeholder="Search imported data" />

        <label class="filter-label">
          Kind
          <select v-model="catalogKind" class="select">
            <option value="all">All kinds</option>
            <option v-for="option in kindOptions" :key="option.kind" :value="option.kind">
              {{ option.kind }} ({{ option.count }})
            </option>
          </select>
        </label>

        <label class="filter-label">
          Source tab
          <select v-model="catalogSourceSheet" class="select">
            <option value="all">All tabs</option>
            <option v-for="option in sourceSheetOptions" :key="option.sourceSheet" :value="option.sourceSheet">
              {{ option.sourceSheet }} ({{ option.count }})
            </option>
          </select>
        </label>

        <div class="summary-list">
          <div v-for="[kind, count] in topEntries(catalogData?.summary.byKind)" :key="kind" class="summary-row">
            <span>{{ kind }}</span>
            <strong>{{ count }}</strong>
          </div>
        </div>
      </template>
    </aside>

    <section v-if="activeView === 'compatibility'" class="workspace">
      <div class="build-grid">
        <section class="panel">
          <p class="eyebrow">Case</p>
          <h2>{{ titleFor(selectedCase) }}</h2>
          <p v-if="selectedCase" class="part-meta">
            {{ selectedCase.style }} / {{ selectedCase.psu || "Unknown PSU" }} / {{ selectedCase.status || "No status" }}
          </p>
        </section>

        <section class="panel">
          <p class="eyebrow">GPU</p>
          <h2>{{ titleFor(selectedGpu) }}</h2>
          <p v-if="selectedGpu" class="part-meta">
            {{ selectedGpu.chipset }} / {{ selectedGpu.pciePins || "No listed PCIe power" }} / {{ selectedGpu.tdpW ?? "?" }}W
          </p>
        </section>
      </div>

      <section class="panel" style="margin-top: 18px">
        <p class="eyebrow">Fit Verdict</p>
        <template v-if="compatibility">
          <div class="verdict" :class="compatibility.verdict">{{ compatibility.verdict }}</div>

          <div class="issues">
            <div v-for="issue in compatibility.issues" :key="issue.code + issue.message" class="issue" :class="issue.severity">
              {{ issue.message }}
            </div>
          </div>

          <h3 style="margin-top: 22px">Clearance</h3>
          <div class="clearance">
            <div v-for="(value, key) in compatibility.clearances" :key="key">
              <div class="part-main">
                <span>{{ key }}</span>
                <span>{{ value === null ? "unknown" : `${value}mm` }}</span>
              </div>
              <div class="bar"><span :style="{ width: `${clearancePercent(value)}%` }" /></div>
            </div>
          </div>
        </template>
        <p v-else class="part-meta">Select one case and one GPU.</p>
      </section>
    </section>

    <section v-else class="workspace">
      <div class="data-head">
        <div>
          <p class="eyebrow">Imported Catalog / {{ catalogData?.source ?? "loading" }}</p>
          <h2>Master list browser</h2>
        </div>
        <div class="data-total">{{ catalogData?.summary.total ?? 0 }} rows</div>
      </div>

      <div v-if="catalogPending" class="panel">Loading catalog...</div>
      <div v-else-if="catalogError" class="panel">Run npm run intake, then restart Nuxt.</div>
      <template v-else>
        <div class="stat-grid">
          <section class="panel">
            <p class="eyebrow">Kinds</p>
            <div class="chip-grid">
              <button
                v-for="[kind, count] in topEntries(catalogData?.summary.byKind, 12)"
                :key="kind"
                class="data-chip"
                :class="{ active: catalogKind === kind }"
                @click="setCatalogKind(kind)"
              >
                <span>{{ kind }}</span>
                <strong>{{ count }}</strong>
              </button>
            </div>
          </section>

          <section class="panel">
            <p class="eyebrow">Largest Source Tabs</p>
            <div class="source-bars">
              <button
                v-for="[sourceSheet, count] in topEntries(catalogData?.summary.bySourceSheet, 10)"
                :key="sourceSheet"
                class="source-row"
                :class="{ active: catalogSourceSheet === sourceSheet }"
                @click="catalogSourceSheet = sourceSheet"
              >
                <span>{{ sourceSheet }}</span>
                <strong>{{ count }}</strong>
              </button>
            </div>
          </section>
        </div>

        <section class="panel data-panel">
          <div class="table-toolbar">
            <p class="eyebrow">{{ visibleCatalogParts.length }} visible rows</p>
            <UButton
              variant="ghost"
              size="sm"
              @click="() => { catalogKind = 'all'; catalogSourceSheet = 'all'; catalogQuery = '' }"
            >
              Reset filters
            </UButton>
          </div>

          <div class="data-table">
            <div class="data-row header">
              <span>Name</span>
              <span>Kind</span>
              <span>Source</span>
              <span>Sample fields</span>
            </div>
            <div v-for="part in visibleCatalogParts" :key="part.id" class="data-row">
              <span>
                <strong>{{ part.displayName }}</strong>
                <small v-if="part.status">{{ part.status }}</small>
              </span>
              <span>{{ part.kind }}</span>
              <span>{{ part.sourceSheet }} #{{ part.rowNumber }}</span>
              <span>{{ sampleSpecs(part) }}</span>
            </div>
          </div>
        </section>
      </template>
    </section>
  </main>
</template>
