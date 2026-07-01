<script setup lang="ts">
import Fuse from "fuse.js";
import { computed, onMounted, ref, watch } from "vue";
import { checkCaseGpuCompatibility } from "../lib/compatibility";
import type { CasePart, CompatibilityResult, FitVerdict, GenericPart, GpuPart, PartKind, SffPart } from "../types";

type AppView = "builder" | "database";
type ResultStatus = FitVerdict | "idle";
type CatalogSuggestion = {
  id: string;
  kind: string;
  displayName: string;
  sourceSheet: string;
  rowNumber: number;
  score: number;
  match: string;
};

const activeView = ref<AppView>("builder");
const query = ref("");
const mode = ref<PartKind | "all">("all");
const catalogQuery = ref("");
const catalogSearch = ref("");
const catalogKind = ref<PartKind | "all">("all");
const catalogSourceSheet = ref("all");
const catalogPage = ref(1);
const catalogPageSize = ref(50);
const selectedCase = ref<CasePart | null>(null);
const selectedGpu = ref<GpuPart | null>(null);
const data = ref<{ source: string; cases: CasePart[]; gpus: GpuPart[] } | null>(null);
const pending = ref(true);
const error = ref<Error | null>(null);
const catalogData = ref<{
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
} | null>(null);
const catalogPending = ref(true);
const catalogError = ref<Error | null>(null);
const catalogSearchData = ref<{ source: string; suggestions: CatalogSuggestion[] } | null>(null);

const catalogRequestQuery = computed(() => ({
  page: catalogPage.value,
  pageSize: catalogPageSize.value,
  kind: catalogKind.value,
  sourceSheet: catalogSourceSheet.value,
  search: catalogSearch.value
}));
const catalogSuggestionQuery = computed(() => ({
  q: activeView.value === "database" && catalogQuery.value.trim().length >= 2 ? catalogQuery.value.trim() : "",
  kind: catalogKind.value,
  sourceSheet: catalogSourceSheet.value,
  limit: 8
}));

const allParts = computed<SffPart[]>(() => [...(data.value?.cases ?? []), ...(data.value?.gpus ?? [])]);
const catalogParts = computed<GenericPart[]>(() => catalogData.value?.parts ?? []);
const catalogSuggestions = computed(() => catalogSearchData.value?.suggestions ?? []);
const catalogFilteredTotal = computed(() => catalogData.value?.summary.filteredTotal ?? 0);
const catalogPageCount = computed(() => catalogData.value?.pagination.pageCount ?? 1);
const catalogDisplayStart = computed(() => {
  if (!catalogFilteredTotal.value) return 0;
  return (catalogPage.value - 1) * catalogPageSize.value + 1;
});
const catalogDisplayEnd = computed(() =>
  Math.min(catalogPage.value * catalogPageSize.value, catalogFilteredTotal.value)
);

const selectedAnchor = computed(() => {
  if (selectedCase.value && !selectedGpu.value) return "case";
  if (selectedGpu.value && !selectedCase.value) return "gpu";
  if (selectedCase.value && selectedGpu.value) return "complete";
  return "none";
});

const builderStep = computed(() => {
  if (selectedCase.value && selectedGpu.value) return "03 VALIDATE";
  if (selectedCase.value) return "02 SELECT GPU";
  if (selectedGpu.value) return "02 SELECT CASE";
  return "01 SELECT";
});

const fuse = computed(
  () =>
    new Fuse(allParts.value, {
      keys: ["name", "model", "brand", "seller", "chipset", "style"],
      threshold: 0.32,
      ignoreLocation: true
    })
);

const visibleParts = computed(() => {
  let pool = mode.value === "all" ? allParts.value : allParts.value.filter((part) => part.kind === mode.value);

  if (selectedCase.value && !selectedGpu.value && mode.value === "all") {
    pool = pool.filter((part) => part.kind === "gpu");
  }
  if (selectedGpu.value && !selectedCase.value && mode.value === "all") {
    pool = pool.filter((part) => part.kind === "case");
  }

  if (!query.value.trim()) return pool.slice(0, 80);
  const ids = new Set(pool.map((part) => part.id));
  return fuse.value
    .search(query.value)
    .map((result) => result.item)
    .filter((part) => ids.has(part.id))
    .slice(0, 80);
});

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

const compatibility = computed<CompatibilityResult | null>(() => {
  if (!selectedCase.value || !selectedGpu.value) return null;
  return checkCaseGpuCompatibility(selectedCase.value, selectedGpu.value);
});

const verifiedVisible = computed(() => visibleParts.value.filter((part) => statusForPart(part) === "pass").length);
const conditionalVisible = computed(() => visibleParts.value.filter((part) => statusForPart(part) === "conditional").length);
const incompatibleVisible = computed(() => visibleParts.value.filter((part) => statusForPart(part) === "fail").length);

let catalogSearchTimer: ReturnType<typeof setTimeout> | undefined;

function paramsFrom(query: Record<string, string | number>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    params.set(key, String(value));
  });
  return params;
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function loadParts() {
  pending.value = true;
  error.value = null;
  try {
    data.value = await fetchJson<{ source: string; cases: CasePart[]; gpus: GpuPart[] }>("/api/parts");
  } catch (caught) {
    error.value = caught instanceof Error ? caught : new Error(String(caught));
  } finally {
    pending.value = false;
  }
}

async function loadCatalog() {
  catalogPending.value = true;
  catalogError.value = null;
  try {
    catalogData.value = await fetchJson<typeof catalogData.value>(
      `/api/catalog?${paramsFrom(catalogRequestQuery.value)}`
    );
  } catch (caught) {
    catalogError.value = caught instanceof Error ? caught : new Error(String(caught));
  } finally {
    catalogPending.value = false;
  }
}

async function loadCatalogSuggestions() {
  const query = catalogSuggestionQuery.value;
  if (!query.q) {
    catalogSearchData.value = { source: catalogData.value?.source ?? "d1", suggestions: [] };
    return;
  }
  catalogSearchData.value = await fetchJson<{ source: string; suggestions: CatalogSuggestion[] }>(
    `/api/catalog/search?${paramsFrom(query)}`
  );
}

onMounted(() => {
  void loadParts();
  void loadCatalog();
});

watch(catalogRequestQuery, () => {
  void loadCatalog();
});

watch(catalogSuggestionQuery, () => {
  void loadCatalogSuggestions();
});

watch(catalogQuery, (value) => {
  if (catalogSearchTimer) clearTimeout(catalogSearchTimer);
  catalogSearchTimer = setTimeout(() => {
    catalogPage.value = 1;
    catalogSearch.value = value.trim();
  }, 220);
});

watch([catalogKind, catalogSourceSheet, catalogPageSize], () => {
  catalogPage.value = 1;
});

watch(catalogPageCount, (pageCount) => {
  if (catalogPage.value > pageCount) catalogPage.value = pageCount;
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

function resetBuilder() {
  selectedCase.value = null;
  selectedGpu.value = null;
  mode.value = "all";
  query.value = "";
}

function beginWith(kind: "case" | "gpu") {
  mode.value = kind;
  query.value = "";
}

function titleFor(part: SffPart | null) {
  if (!part) return "No anchor selected";
  if (part.kind === "case") return `${part.seller} ${part.name}`.trim();
  return `${part.brand} ${part.model} ${part.name}`.trim();
}

function shortTitleFor(part: SffPart) {
  if (part.kind === "case") return part.name || part.seller || "Unnamed case";
  return `${part.brand} ${part.model}`.trim() || part.name || "Unnamed GPU";
}

function metaFor(part: SffPart) {
  if (part.kind === "case") {
    return `${part.style || "unknown layout"} / ${formatNumber(part.dimensions.volumeL, "L")} / GPU ${formatNumber(part.dimensions.gpuLengthMm, "mm")}`;
  }
  return `${part.chipset || "unknown chipset"} / ${formatNumber(part.dimensions.lengthMm, "mm")} x ${formatNumber(part.dimensions.widthMm, "mm")} x ${formatNumber(part.dimensions.thicknessMm, "mm")}`;
}

function statusForPart(part: SffPart): ResultStatus {
  if (part.kind === "gpu" && selectedCase.value) {
    return checkCaseGpuCompatibility(selectedCase.value, part).verdict;
  }
  if (part.kind === "case" && selectedGpu.value) {
    return checkCaseGpuCompatibility(part, selectedGpu.value).verdict;
  }
  return "idle";
}

function issueCountForPart(part: SffPart) {
  if (part.kind === "gpu" && selectedCase.value) {
    return checkCaseGpuCompatibility(selectedCase.value, part).issues.length;
  }
  if (part.kind === "case" && selectedGpu.value) {
    return checkCaseGpuCompatibility(part, selectedGpu.value).issues.length;
  }
  return part.flags.length;
}

function statusLabel(status: ResultStatus) {
  if (status === "pass") return "Verified";
  if (status === "conditional") return "Tight fit";
  if (status === "fail") return "Incompatible";
  return "Unscored";
}

function formatNumber(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined) return "?";
  const numberText = Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${numberText}${unit}`;
}

function clearancePercent(value: number | null) {
  if (value === null) return 0;
  if (value < 0) return 100;
  return Math.max(6, Math.min(100, 100 - value));
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

function selectCatalogSuggestion(suggestion: CatalogSuggestion) {
  catalogQuery.value = suggestion.displayName;
  catalogSearch.value = suggestion.displayName;
  catalogPage.value = 1;
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-lockup">
        <strong>SFF_DATA_LOG</strong>
        <span>{{ data?.source ?? "d1 pending" }}</span>
      </div>

      <nav class="primary-nav" aria-label="Primary">
        <button :class="{ active: activeView === 'builder' }" @click="activeView = 'builder'">Builder</button>
        <button :class="{ active: activeView === 'database' }" @click="activeView = 'database'">Database</button>
      </nav>

      <div class="search-shell">
        <div class="global-search">
          <span>⌕</span>
          <input
            v-if="activeView === 'builder'"
            v-model="query"
            placeholder="Quick search components..."
            aria-label="Search builder parts"
          />
          <input
            v-else
            v-model="catalogQuery"
            placeholder="Search imported catalog..."
            aria-label="Search imported catalog"
          />
        </div>
        <div v-if="activeView === 'database' && catalogSuggestions.length" class="search-suggestions">
          <button
            v-for="suggestion in catalogSuggestions"
            :key="suggestion.id"
            @mousedown.prevent="selectCatalogSuggestion(suggestion)"
          >
            <strong>{{ suggestion.displayName }}</strong>
            <span>{{ suggestion.kind }} / {{ suggestion.sourceSheet }} #{{ suggestion.rowNumber }}</span>
          </button>
        </div>
      </div>
    </header>

    <template v-if="activeView === 'builder'">
      <section class="builder-grid">
        <aside class="filter-rail">
          <div class="rail-section">
            <p class="eyebrow">Filters</p>
            <h2>Technical Specs</h2>
          </div>

          <div class="filter-stack">
            <button class="filter-button" :class="{ active: mode === 'all' }" @click="mode = 'all'">
              <span>□</span>
              All Components
            </button>
            <button class="filter-button" :class="{ active: mode === 'case' }" @click="beginWith('case')">
              <span>▣</span>
              Chassis
            </button>
            <button class="filter-button" :class="{ active: mode === 'gpu' }" @click="beginWith('gpu')">
              <span>▤</span>
              GPU Clearance
            </button>
          </div>

          <div class="rail-readout">
            <p class="eyebrow">Result Telemetry</p>
            <div class="readout-row">
              <span>Visible</span>
              <strong>{{ visibleParts.length }}</strong>
            </div>
            <div class="readout-row">
              <span>Verified</span>
              <strong>{{ verifiedVisible }}</strong>
            </div>
            <div class="readout-row">
              <span>Conditional</span>
              <strong>{{ conditionalVisible }}</strong>
            </div>
            <div class="readout-row">
              <span>Blocked</span>
              <strong>{{ incompatibleVisible }}</strong>
            </div>
          </div>

          <button class="black-button" @click="resetBuilder">Clear Builder</button>
        </aside>

        <section class="workspace">
          <div class="stepper">
            <span :class="{ active: builderStep === '01 SELECT' }">01 Select</span>
            <span :class="{ active: builderStep.includes('02') }">{{ selectedGpu && !selectedCase ? "02 Select Case" : "02 Select GPU" }}</span>
            <span :class="{ active: builderStep === '03 VALIDATE' }">03 Validate</span>
          </div>

          <section v-if="selectedAnchor === 'none'" class="launch-panel blueprint-grid">
            <div class="launch-copy">
              <p class="eyebrow">Clearance Engine</p>
              <h1>Initialize Build Sequence</h1>
              <p>Select a starting anchor to begin fitment calculations against the imported SFF Master List.</p>
            </div>

            <div class="anchor-grid">
              <button class="anchor-card" @click="beginWith('case')">
                <span class="eyebrow">Strategy A</span>
                <strong>Select Chassis</strong>
                <span>Define hard volume constraints first, then filter compatible GPUs.</span>
                <i>CHASSIS_VOLUME / GPU_CLEARANCE</i>
              </button>

              <button class="anchor-card" @click="beginWith('gpu')">
                <span class="eyebrow">Strategy B</span>
                <strong>Select GPU</strong>
                <span>Start with a graphics card, then find cases that support its physical envelope.</span>
                <i>COMPONENT_MM / CASE_MAX_MM</i>
              </button>
            </div>
          </section>

          <section v-else class="analysis-grid">
            <article class="selected-card">
              <div class="card-header">
                <div>
                  <p class="eyebrow">Current Chassis</p>
                  <h2>{{ titleFor(selectedCase) }}</h2>
                </div>
                <button @click="beginWith('case')">Edit</button>
              </div>
              <div class="schematic-box blueprint-grid">
                <dl>
                  <div>
                    <dt>GPU_L</dt>
                    <dd>{{ formatNumber(selectedCase?.dimensions.gpuLengthMm, "mm") }}</dd>
                  </div>
                  <div>
                    <dt>GPU_W</dt>
                    <dd>{{ formatNumber(selectedCase?.dimensions.gpuWidthMm, "mm") }}</dd>
                  </div>
                  <div>
                    <dt>GPU_Z</dt>
                    <dd>{{ formatNumber(selectedCase?.dimensions.gpuThicknessMm, "mm") }}</dd>
                  </div>
                  <div>
                    <dt>VOLUME</dt>
                    <dd>{{ formatNumber(selectedCase?.dimensions.volumeL, "L") }}</dd>
                  </div>
                </dl>
              </div>
            </article>

            <article class="selected-card">
              <div class="card-header">
                <div>
                  <p class="eyebrow">Current GPU</p>
                  <h2>{{ titleFor(selectedGpu) }}</h2>
                </div>
                <button @click="beginWith('gpu')">Edit</button>
              </div>
              <div class="schematic-box blueprint-grid">
                <dl>
                  <div>
                    <dt>LENGTH</dt>
                    <dd>{{ formatNumber(selectedGpu?.dimensions.lengthMm, "mm") }}</dd>
                  </div>
                  <div>
                    <dt>HEIGHT</dt>
                    <dd>{{ formatNumber(selectedGpu?.dimensions.widthMm, "mm") }}</dd>
                  </div>
                  <div>
                    <dt>SLOTS</dt>
                    <dd>{{ formatNumber(selectedGpu?.dimensions.pcieSlots, "") }}</dd>
                  </div>
                  <div>
                    <dt>TDP</dt>
                    <dd>{{ formatNumber(selectedGpu?.tdpW, "W") }}</dd>
                  </div>
                </dl>
              </div>
            </article>
          </section>

          <section class="results-panel">
            <div class="table-toolbar">
              <div>
                <p class="eyebrow">{{ mode === "all" ? "Filtered Array" : mode }}</p>
                <h2>{{ selectedCase && !selectedGpu ? "Select GPU" : selectedGpu && !selectedCase ? "Select Case" : "Component Index" }}</h2>
              </div>
              <div class="toolbar-controls">
                <input v-model="query" class="inline-search" placeholder="Model, maker, dimensions..." />
                <button @click="query = ''">Reset</button>
              </div>
            </div>

            <div v-if="pending" class="empty-state">Loading part telemetry...</div>
            <div v-else-if="error" class="empty-state">Run npm run intake, then restart the dev server.</div>
            <div v-else class="fit-table">
              <div class="fit-row fit-head">
                <span>Component</span>
                <span>Physical Specs</span>
                <span>Fitment Status</span>
                <span>Action</span>
              </div>
              <button
                v-for="part in visibleParts"
                :key="part.id"
                class="fit-row"
                :class="[`status-${statusForPart(part)}`, { selected: selectedCase?.id === part.id || selectedGpu?.id === part.id }]"
                @click="selectPart(part)"
              >
                <span class="component-cell">
                  <i>{{ part.kind === "case" ? "▣" : "▤" }}</i>
                  <span>
                    <strong>{{ shortTitleFor(part) }}</strong>
                    <small>{{ metaFor(part) }}</small>
                  </span>
                </span>
                <span class="mono">{{ metaFor(part) }}</span>
                <span>
                  <em class="status-badge" :class="`status-${statusForPart(part)}`">{{ statusLabel(statusForPart(part)) }}</em>
                  <small>{{ issueCountForPart(part) }} notes</small>
                </span>
                <span class="row-action">{{ selectedCase?.id === part.id || selectedGpu?.id === part.id ? "Selected" : "Add Part" }}</span>
              </button>
            </div>
          </section>

          <section v-if="compatibility" class="verdict-panel">
            <div>
              <p class="eyebrow">Fit Verdict</p>
              <h2>
                <span class="status-badge" :class="`status-${compatibility.verdict}`">
                  {{ statusLabel(compatibility.verdict) }}
                </span>
                Clearance validation
              </h2>
            </div>

            <div class="clearance-grid">
              <div v-for="(value, key) in compatibility.clearances" :key="key" class="clearance-item">
                <div>
                  <span>{{ key }}</span>
                  <strong>{{ value === null ? "unknown" : `${value}mm` }}</strong>
                </div>
                <div class="meter"><span :style="{ width: `${clearancePercent(value)}%` }" /></div>
              </div>
            </div>

            <div class="issue-grid">
              <p v-for="issue in compatibility.issues" :key="issue.code + issue.message" :class="issue.severity">
                {{ issue.message }}
              </p>
            </div>
          </section>
        </section>
      </section>
    </template>

    <template v-else>
      <section class="database-view">
        <div class="database-tabs">
          <button
            v-for="option in kindOptions.slice(0, 6)"
            :key="option.kind"
            :class="{ active: catalogKind === option.kind }"
            @click="setCatalogKind(option.kind)"
          >
            {{ option.kind }} <span>{{ option.count }}</span>
          </button>
          <button :class="{ active: catalogKind === 'all' }" @click="catalogKind = 'all'">all</button>
        </div>

        <div class="database-filters">
          <p class="eyebrow">Filter Array</p>
          <label>
            Source tab
            <select v-model="catalogSourceSheet">
              <option value="all">All tabs</option>
              <option v-for="option in sourceSheetOptions" :key="option.sourceSheet" :value="option.sourceSheet">
                {{ option.sourceSheet }} ({{ option.count }})
              </option>
            </select>
          </label>
          <label>
            Page size
            <select v-model.number="catalogPageSize">
              <option :value="25">25 rows</option>
              <option :value="50">50 rows</option>
              <option :value="100">100 rows</option>
            </select>
          </label>
          <button @click="() => { catalogKind = 'all'; catalogSourceSheet = 'all'; catalogQuery = ''; catalogSearch = ''; catalogPage = 1 }">Reset_Filters</button>
        </div>

        <div class="database-title">
          <div>
            <h1>Case_Database</h1>
            <p>Real-time compatibility telemetry from imported SFF reference data.</p>
          </div>
          <strong>{{ catalogDisplayStart }}-{{ catalogDisplayEnd }} / {{ catalogFilteredTotal }} rows</strong>
        </div>

        <div v-if="catalogPending" class="empty-state">Loading catalog...</div>
        <div v-else-if="catalogError" class="empty-state">Run npm run intake, then restart the dev server.</div>
        <section v-else class="data-table-wrap">
          <div class="data-row data-head">
            <span>Model_Identifier</span>
            <span>Kind</span>
            <span>Source</span>
            <span>Status</span>
            <span>Sample Fields</span>
          </div>
          <div v-for="part in catalogParts" :key="part.id" class="data-row">
            <span>
              <strong>{{ part.displayName }}</strong>
              <small>
                <a v-if="part.productUrl" :href="part.productUrl" target="_blank" rel="noopener noreferrer">Product</a>
                <a v-if="part.sellerUrl" :href="part.sellerUrl" target="_blank" rel="noopener noreferrer">Seller</a>
              </small>
            </span>
            <span class="mono">{{ part.kind }}</span>
            <span>{{ part.sourceSheet }} #{{ part.rowNumber }}</span>
            <span><em class="status-badge status-idle">{{ part.status || "Community data" }}</em></span>
            <span>{{ sampleSpecs(part) }}</span>
          </div>
          <footer class="table-pagination">
            <span>
              DISPLAYING: {{ catalogDisplayStart }}-{{ catalogDisplayEnd }} OF {{ catalogFilteredTotal }} FILTERED RECORDS
              <small>({{ catalogData?.summary.total ?? 0 }} imported)</small>
            </span>
            <span class="pager-controls">
              <button :disabled="catalogPage <= 1" @click="catalogPage -= 1">Previous</button>
              <strong>Page {{ catalogPage }} / {{ catalogPageCount }}</strong>
              <button :disabled="catalogPage >= catalogPageCount" @click="catalogPage += 1">Next</button>
            </span>
          </footer>
        </section>

        <div class="protocol-grid">
          <article>
            <p class="eyebrow">Verification_Protocol</p>
            <span>Imported entries preserve source links and raw fields so uncertain measurements stay visible.</span>
          </article>
          <article>
            <p class="eyebrow">Density_Metrics</p>
            <span>Volume and clearance values are normalized where possible, with blanks treated as warnings.</span>
          </article>
          <article>
            <p class="eyebrow danger">Compatibility_Warning</p>
            <span>GPU slot depth, power cables, and radiator routing still require physical verification.</span>
          </article>
        </div>
      </section>
    </template>
  </main>
</template>
