<script setup lang="ts">
import Fuse from "fuse.js";
import { checkCaseGpuCompatibility } from "./lib/compatibility";
import type { CasePart, CompatibilityResult, GpuPart, PartKind, SffPart } from "./types";

const { data, pending, error } = await useFetch<{ source: string; cases: CasePart[]; gpus: GpuPart[] }>("/api/parts");

const query = ref("");
const mode = ref<PartKind | "all">("all");
const selectedCase = ref<CasePart | null>(null);
const selectedGpu = ref<GpuPart | null>(null);

const allParts = computed<SffPart[]>(() => [...(data.value?.cases ?? []), ...(data.value?.gpus ?? [])]);

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
</script>

<template>
  <main class="layout">
    <aside class="rail">
      <p class="eyebrow">SFF Builder / {{ data?.source ?? "loading" }}</p>
      <h1 class="title">Start from...</h1>

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
    </aside>

    <section class="workspace">
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
  </main>
</template>
