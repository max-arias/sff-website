/**
 * Tests for build-state query serialization.
 *
 * Verifies that buildSearchParams and buildUrl are consistent,
 * and that repeated/multi-value params are preserved exactly.
 *
 * Run with:  npx tsx src/lib/build-state.test.ts
 */

import assert from "node:assert/strict";
import {
  buildSearchParams,
  buildUrl,
  parseBuildQuery,
  type BuildQueryState,
} from "./build-state";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function emptyState(): BuildQueryState {
  return {
    selectedIds: {},
    kind: "case",
    search: "",
    page: 1,
    sort: "release-year",
    dir: "desc", // parseBuildQuery defaults to desc for release-year
    showSparseRows: false,
    caseVolumeTier: null,
    caseIntent: null,
    numericFilters: {},
    psuTier: null,
    psuFormFactor: null,
    psuFeatures: [],
  };
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// buildSearchParams consistency with buildUrl
// ---------------------------------------------------------------------------

test("buildSearchParams empty state produces expected params", () => {
  const state = emptyState();
  const params = buildSearchParams(state);
  // Only "kind" should be set for an empty default state
  assert.equal(params.get("kind"), "case");
  assert.equal(params.get("search"), null);
  assert.equal(params.get("page"), null);
  assert.equal(params.get("sort"), null);
  assert.equal(params.get("dir"), null);
  assert.equal(params.get("show-sparse"), null);
  assert.equal([...params].length, 1, `expected 1 param, got ${[...params].length}`);
});

test("buildUrl from empty state returns /build?kind=case", () => {
  const url = buildUrl(emptyState());
  assert.equal(url, "/build?kind=case");
});

test("buildSearchParams and buildUrl produce same params", () => {
  const state: BuildQueryState = {
    ...emptyState(),
    selectedIds: { case: "case-123", gpu: "gpu-456" },
    sort: "name",
    dir: "asc",
    showSparseRows: true,
    page: 3,
  };
  const params = buildSearchParams(state);
  const url = buildUrl(state);
  // The URL path should be /build? + the same params
  assert.ok(url.startsWith("/build?"), "URL starts with /build?");
  const urlParams = new URLSearchParams(url.slice("/build?".length));
  assert.equal(urlParams.toString(), params.toString());
});

test("buildSearchParams → parseBuildQuery round-trips", () => {
  const state: BuildQueryState = {
    ...emptyState(),
    kind: "case",
    selectedIds: { case: "c1", gpu: "g2", "cpu-cooler": "cc3" },
    search: "noctua",
    page: 2,
    sort: "name",
    dir: "desc",
    showSparseRows: true,
    caseVolumeTier: "sub-10l",
    // max-gpu-length-mm is GPU-only; since kind=case it gets dropped.
    // case-max-volume-l is a case param and survives.
    numericFilters: { "max-gpu-length-mm": 320, "case-max-volume-l": 15 },
    psuFeatures: [],
    psuTier: null,
    psuFormFactor: null,
    caseIntent: null,
  };
  const url = buildUrl(state);
  const reparsed = parseBuildQuery(new URL(url, "http://localhost"));

  assert.equal(reparsed.kind, state.kind);
  assert.equal(reparsed.search, state.search);
  assert.equal(reparsed.page, state.page);
  assert.equal(reparsed.sort, state.sort);
  assert.equal(reparsed.dir, state.dir);
  assert.equal(reparsed.showSparseRows, state.showSparseRows);
  assert.equal(reparsed.caseVolumeTier, state.caseVolumeTier);
  assert.deepEqual(reparsed.selectedIds, state.selectedIds);
  // GPU-only param is dropped by kind filter; only case param survives
  assert.deepEqual(reparsed.numericFilters, { "case-max-volume-l": 15 });
});

// ---------------------------------------------------------------------------
// Repeated params (psu-feature)
// ---------------------------------------------------------------------------

test("buildSearchParams preserves repeated psu-feature params", () => {
  const state: BuildQueryState = {
    ...emptyState(),
    kind: "psu",
    psuFeatures: ["atx-3", "fully-modular", "12vhpwr"],
  };
  const params = buildSearchParams(state);
  const features = params.getAll("psu-feature");
  assert.deepEqual(features, ["atx-3", "fully-modular", "12vhpwr"]);
});

test("parseBuildQuery reads repeated psu-feature from URL", () => {
  const urlStr = "/build?kind=psu&psu-feature=atx-3&psu-feature=12vhpwr";
  const state = parseBuildQuery(new URL(urlStr, "http://localhost"));
  assert.deepEqual(state.psuFeatures, ["atx-3", "12vhpwr"]);
});

test("psu-feature round-trips through buildSearchParams → parseBuildQuery", () => {
  const original: BuildQueryState = {
    ...emptyState(),
    kind: "psu",
    psuFeatures: ["semi-passive", "fully-modular"],
  };
  const params = buildSearchParams(original);
  const url = `/build?${params.toString()}`;
  const reparsed = parseBuildQuery(new URL(url, "http://localhost"));
  assert.deepEqual(reparsed.psuFeatures, ["semi-passive", "fully-modular"]);
});

// ---------------------------------------------------------------------------
// Selected slot IDs
// ---------------------------------------------------------------------------

test("buildSearchParams includes selected slot IDs", () => {
  const state: BuildQueryState = {
    ...emptyState(),
    selectedIds: { case: "ncases-001", gpu: "rtx-4090-fe", psu: "sf750" },
  };
  const params = buildSearchParams(state);
  assert.equal(params.get("case"), "ncases-001");
  assert.equal(params.get("gpu"), "rtx-4090-fe");
  assert.equal(params.get("psu"), "sf750");
});

test("buildSearchParams applies patch clearSlot", () => {
  const state: BuildQueryState = {
    ...emptyState(),
    selectedIds: { case: "c1", gpu: "g1" },
  };
  const params = buildSearchParams(state, { clearSlot: "case" });
  assert.equal(params.get("case"), null);
  assert.equal(params.get("gpu"), "g1");
});

// ---------------------------------------------------------------------------
// Numeric filters
// ---------------------------------------------------------------------------

test("buildSearchParams includes numeric filters valid for kind", () => {
  const state: BuildQueryState = {
    ...emptyState(),
    kind: "case",
    numericFilters: { "max-gpu-length-mm": 320, "case-max-volume-l": 15 },
  };
  const params = buildSearchParams(state);
  // max-gpu-length-mm is GPU-only, dropped because kind=case
  assert.equal(params.get("max-gpu-length-mm"), null);
  // case-max-volume-l is a case param, survives
  assert.equal(params.get("case-max-volume-l"), "15");
});

test("numeric filters round-trip through buildSearchParams → parseBuildQuery", () => {
  const original: BuildQueryState = {
    ...emptyState(),
    kind: "gpu",
    numericFilters: {
      "max-gpu-length-mm": 320,
      "max-gpu-width-mm": 140,
      "case-max-volume-l": 15.5,
    },
  };
  const params = buildSearchParams(original);
  const url = `/build?${params.toString()}`;
  const reparsed = parseBuildQuery(new URL(url, "http://localhost"));
  // case-max-volume-l is case-only, dropped when kind=gpu
  assert.deepEqual(reparsed.numericFilters, {
    "max-gpu-length-mm": 320,
    "max-gpu-width-mm": 140,
  });
});

test("numeric filters preserve recognized params that are not UI grouped", () => {
  const state: BuildQueryState = {
    ...emptyState(),
    kind: "case",
    numericFilters: {
      "case-max-drive-25": 2,
      "case-max-gpu-width-mm": 145,
    },
  };
  const params = buildSearchParams(state);
  assert.equal(params.get("case-max-drive-25"), "2");
  assert.equal(params.get("case-max-gpu-width-mm"), "145");
});

// ---------------------------------------------------------------------------
// Page param
// ---------------------------------------------------------------------------

test("buildSearchParams omits page=1", () => {
  const state = { ...emptyState(), page: 1 };
  const params = buildSearchParams(state);
  assert.equal(params.get("page"), null);
});

test("buildSearchParams includes page > 1", () => {
  const state = { ...emptyState(), page: 5 };
  const params = buildSearchParams(state);
  assert.equal(params.get("page"), "5");
});

// ---------------------------------------------------------------------------
// Sparse rows
// ---------------------------------------------------------------------------

test("buildSearchParams includes show-sparse when true", () => {
  const state = { ...emptyState(), showSparseRows: true };
  const params = buildSearchParams(state);
  assert.equal(params.get("show-sparse"), "1");
});

test("buildSearchParams omits show-sparse when false", () => {
  const state = { ...emptyState(), showSparseRows: false };
  const params = buildSearchParams(state);
  assert.equal(params.get("show-sparse"), null);
});

// ---------------------------------------------------------------------------
// Case presets
// ---------------------------------------------------------------------------

test("buildSearchParams includes case-volume for case kind", () => {
  const state = { ...emptyState(), kind: "case" as const, caseVolumeTier: "sub-10l" as const };
  const params = buildSearchParams(state);
  assert.equal(params.get("case-volume"), "sub-10l");
});

test("buildSearchParams omits case-volume for non-case kind", () => {
  const state = { ...emptyState(), kind: "gpu" as const, caseVolumeTier: "sub-10l" as const };
  const params = buildSearchParams(state);
  assert.equal(params.get("case-volume"), null);
});

// ---------------------------------------------------------------------------
// PSU filters
// ---------------------------------------------------------------------------

test("buildSearchParams includes psu-tier and psu-form for psu kind", () => {
  const state = {
    ...emptyState(),
    kind: "psu" as const,
    psuTier: "a-or-better" as const,
    psuFormFactor: "sfx" as const,
  };
  const params = buildSearchParams(state);
  assert.equal(params.get("psu-tier"), "a-or-better");
  assert.equal(params.get("psu-form"), "sfx");
});

test("buildSearchParams omits psu-tier for non-psu kind", () => {
  const state = {
    ...emptyState(),
    kind: "case" as const,
    psuTier: "a-or-better" as const,
  };
  const params = buildSearchParams(state);
  assert.equal(params.get("psu-tier"), null);
});

// ---------------------------------------------------------------------------
// Search param
// ---------------------------------------------------------------------------

test("buildSearchParams includes search when non-empty", () => {
  const state = { ...emptyState(), search: "noctua" };
  const params = buildSearchParams(state);
  assert.equal(params.get("search"), "noctua");
});

test("buildSearchParams omits search when empty", () => {
  const state = { ...emptyState(), search: "" };
  const params = buildSearchParams(state);
  assert.equal(params.get("search"), null);
});

// ---------------------------------------------------------------------------
// Sort/dir logic
// ---------------------------------------------------------------------------

test("buildSearchParams default sort omits sort, dir=asc omitted for release-year", () => {
  const state = emptyState();
  const params = buildSearchParams(state);
  assert.equal(params.get("sort"), null);
  assert.equal(params.get("dir"), null);
});

test("buildSearchParams sort=name, dir=asc omits dir", () => {
  const state = { ...emptyState(), sort: "name", dir: "asc" as const };
  const params = buildSearchParams(state);
  assert.equal(params.get("sort"), "name");
  assert.equal(params.get("dir"), null);
});

test("buildSearchParams sort=name, dir=desc includes dir", () => {
  const state = { ...emptyState(), sort: "name", dir: "desc" as const };
  const params = buildSearchParams(state);
  assert.equal(params.get("sort"), "name");
  assert.equal(params.get("dir"), "desc");
});

test("buildSearchParams sort=release-year, dir=desc omits dir (default)", () => {
  const state = { ...emptyState(), sort: "release-year", dir: "desc" as const };
  const params = buildSearchParams(state);
  assert.equal(params.get("sort"), null);
  assert.equal(params.get("dir"), null);
});

test("buildSearchParams sort=release-year, dir=asc includes dir", () => {
  const state = { ...emptyState(), sort: "release-year", dir: "asc" as const };
  const params = buildSearchParams(state);
  assert.equal(params.get("dir"), "asc");
});

// ---------------------------------------------------------------------------
// Kind-switching filter cleanup
// ---------------------------------------------------------------------------

test("switching from gpu to case drops gpu numeric params", () => {
  const state: BuildQueryState = {
    ...emptyState(),
    kind: "gpu",
    numericFilters: { "max-gpu-length-mm": 320, "case-max-volume-l": 15 },
  };
  // Patch kind to case
  const params = buildSearchParams(state, { kind: "case" });
  // GPU-only param should be dropped
  assert.equal(params.get("max-gpu-length-mm"), null);
  // Case param should survive
  assert.equal(params.get("case-max-volume-l"), "15");
});

test("switching from case to gpu drops case-only numeric params", () => {
  const state: BuildQueryState = {
    ...emptyState(),
    kind: "case",
    numericFilters: { "max-gpu-length-mm": 320, "case-max-volume-l": 15, "case-max-length-mm": 400 },
  };
  // Patch kind to gpu
  const params = buildSearchParams(state, { kind: "gpu" });
  // GPU param should survive
  assert.equal(params.get("max-gpu-length-mm"), "320");
  // Case-only params should be dropped
  assert.equal(params.get("case-max-volume-l"), null);
  assert.equal(params.get("case-max-length-mm"), null);
});

test("switching from case to gpu drops case-volume and case-intent", () => {
  const state: BuildQueryState = {
    ...emptyState(),
    kind: "case",
    caseVolumeTier: "sub-10l",
    caseIntent: "steam-machine",
    numericFilters: { "case-max-volume-l": 15 },
  };
  const params = buildSearchParams(state, { kind: "gpu" });
  assert.equal(params.get("case-volume"), null, "case-volume should be dropped");
  assert.equal(params.get("case-intent"), null, "case-intent should be dropped");
  // case-max-volume-l should also be dropped since it's a case-only numeric param
  assert.equal(params.get("case-max-volume-l"), null, "case-max-volume-l should be dropped");
  assert.equal(params.get("kind"), "gpu");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(48)}`);
console.log(`  Build-state serialization: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(48)}`);

process.exit(failed > 0 ? 1 : 0);
