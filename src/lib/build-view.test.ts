/**
 * Tests for build-view with an in-memory CatalogStore.
 *
 * Run with:  npx tsx src/lib/build-view.test.ts
 *
 * Verifies that getBuildView can be invoked without D1/Cloudflare
 * infrastructure, using InMemoryCatalogStore fixture data.
 */

import assert from "node:assert/strict";
import { getBuildView } from "./build-view";
import { InMemoryCatalogStore } from "../server/in-memory-catalog-store";
import type { CasePart, GpuPart } from "../types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function fakeCase(overrides: Partial<CasePart> = {}): CasePart {
  return {
    kind: "case",
    id: "test-case-1",
    sourceSheet: "TestSheet",
    rowNumber: 1,
    seller: "TestCo",
    name: "Test Case One",
    style: "Mini-Tower",
    sidePanel: "Mesh",
    caseMaterial: "Aluminum",
    status: "",
    availabilityStatus: "available",
    gpuRiser: "",
    psu: "SFX",
    motherboard: "",
    radiatorSupportRaw: "",
    sffNetLink: "",
    lastUpdate: "",
    dimensions: {
      lengthMm: 300,
      widthMm: 150,
      heightMm: 250,
      volumeL: 11.25,
      footprintCm2: null,
      weightKg: null,
      cpuCoolerHeightMm: 135,
      gpuLengthMm: 320,
      gpuWidthMm: 160,
      gpuThicknessMm: 60,
      pcieSlots: 3,
      lpPcieSlots: 0,
    },
    counts: {
      drive25Max: null, drive35Max: null, drive525Max: null,
      fan40mm: null, fan60mm: null, fan80mm: null, fan92mm: null,
      fan120mm: null, fan140mm: null, fan180mm: null, fan200mm: null,
      usbA20: null, usbA32: null, usbC: null,
    },
    radiatorFlags: {
      has120mm: false, has140mm: false, has200mm: false,
      has240mm: false, has280mm: false, has360mm: false,
      has420mm: false, hasTopHat: false,
    },
    hasJack35mm: false,
    priceCny: null,
    priceUsd: null,
    releaseYear: null,
    flags: [],
    raw: {},
    ...overrides,
  };
}

function fakeGpu(overrides: Partial<GpuPart> = {}): GpuPart {
  return {
    kind: "gpu",
    id: "test-gpu-1",
    sourceSheet: "TestGPU",
    rowNumber: 1,
    chipset: "RTX 4090",
    model: "RTX 4090",
    brand: "NVIDIA",
    name: "GeForce RTX 4090",
    lowProfile: false,
    watercooled: false,
    blower: false,
    pciePins: "3x 8-pin",
    tdpW: 450,
    boostClockMhz: 2520,
    memorySpeedGbps: 21,
    fanCount: 3,
    displayportCount: 3,
    hdmiCount: 1,
    usbCCount: 0,
    dviD: false,
    remarks: "",
    availabilityStatus: "available",
    dimensions: {
      lengthMm: 300,
      widthMm: 140,
      thicknessMm: 50,
      pcieSlots: 3,
    },
    releaseYear: 2022,
    flags: [],
    raw: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result
        .then(() => {
          console.log(`  ✓ ${name}`);
          passed++;
        })
        .catch((e) => {
          console.log(`  ✗ ${name}`);
          console.error(`    ${(e as Error).message}`);
          failed++;
        });
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("getBuildView returns view with empty store", async () => {
  const store = new InMemoryCatalogStore({ cases: [], gpus: [], parts: [] });
  const url = new URL("http://localhost/build?kind=case");
  const view = await getBuildView(url, store);

  assert.equal(view.state.kind, "case");
  assert.equal(view.rows.length, 0);
  assert.equal(view.totalRows, 0);
  // slotOrder defines 6 slots: case, gpu, cpu-cooler, motherboard, psu, ram
  assert.equal(view.slots.length, 6);
  assert.equal(view.buildStatus, "in-progress");
});

test("getBuildView with case fixtures produces rows", async () => {
  const store = new InMemoryCatalogStore({
    cases: [
      fakeCase({ id: "case-a", name: "Case A" }),
      fakeCase({ id: "case-b", name: "Case B" }),
    ],
    gpus: [],
    parts: [],
  });
  const url = new URL("http://localhost/build?kind=case");
  const view = await getBuildView(url, store);

  assert.equal(view.rows.length, 2);
  assert.equal(view.totalRows, 2);
  // displayTitle for cases returns "${seller} ${name}"
  assert.equal(view.rows[0].title, "TestCo Case A");
  assert.equal(view.rows[1].title, "TestCo Case B");
});

test("getBuildView with GPU kind", async () => {
  const store = new InMemoryCatalogStore({
    cases: [],
    gpus: [
      fakeGpu({ id: "gpu-a", name: "GPU A" }),
    ],
    parts: [],
  });
  const url = new URL("http://localhost/build?kind=gpu");
  const view = await getBuildView(url, store);

  assert.equal(view.rows.length, 1);
  assert.equal(view.totalRows, 1);
  // displayTitle for GPU joins model + name (deduped)
  assert.equal(view.rows[0].title, "RTX 4090 GPU A");
});

test("GPU brand filter exposes catalog brands and narrows rows", async () => {
  const store = new InMemoryCatalogStore({
    cases: [],
    gpus: [
      fakeGpu({ id: "pny", name: "PNY card", brand: "PNY" }),
      fakeGpu({ id: "asus", name: "ASUS card", brand: "ASUS" }),
    ],
    parts: [],
  });
  const view = await getBuildView(new URL("http://localhost/build?kind=gpu&gpu-brand=PNY"), store);

  assert.deepEqual(view.rows.map((row) => row.id), ["pny"]);
  const brandGroup = view.numericFilterGroups.find((group) => group.label === "Brand");
  assert.ok(brandGroup, "brand filter group exists");
  assert.deepEqual(brandGroup!.options.map((option) => option.label), ["ASUS", "PNY"]);
  assert.equal(brandGroup!.options.find((option) => option.label === "PNY")!.active, true);
  assert.doesNotMatch(brandGroup!.options.find((option) => option.label === "PNY")!.href, /gpu-brand/);
  assert.match(brandGroup!.options.find((option) => option.label === "ASUS")!.href, /gpu-brand=ASUS/);
});

test("adding or swapping a table row advances to the next tab, but removing does not", async () => {
  const store = new InMemoryCatalogStore({
    cases: [fakeCase({ id: "case-a" })],
    gpus: [fakeGpu({ id: "gpu-a" })],
    parts: [],
  });
  const addView = await getBuildView(new URL("http://localhost/build?kind=case"), store);
  assert.match(addView.rows[0].actionUrl, /kind=gpu/);
  assert.match(addView.rows[0].actionUrl, /case=case-a/);

  const removeView = await getBuildView(new URL("http://localhost/build?kind=case&case=case-a"), store);
  assert.match(removeView.rows[0].actionUrl, /kind=case/);
  assert.doesNotMatch(removeView.rows[0].actionUrl, /kind=gpu/);
});

test("getBuildView with selected parts produces slots with verdicts", async () => {
  const casePart = fakeCase({ id: "selected-case" });
  const gpuPart = fakeGpu({ id: "selected-gpu" });
  const store = new InMemoryCatalogStore({
    cases: [casePart, fakeCase({ id: "other", name: "Other" })],
    gpus: [gpuPart],
    parts: [],
  });
  const url = new URL(
    "http://localhost/build?kind=case&case=selected-case&gpu=selected-gpu",
  );
  const view = await getBuildView(url, store);

  // Slots should include the selected case and GPU
  const caseSlot = view.slots.find((s) => s.kind === "case");
  const gpuSlot = view.slots.find((s) => s.kind === "gpu");
  assert.ok(caseSlot, "case slot exists");
  assert.ok(gpuSlot, "gpu slot exists");
  assert.equal(caseSlot!.id, "selected-case");
  assert.equal(gpuSlot!.id, "selected-gpu");
  assert.equal(caseSlot!.state, "resolved");
  assert.equal(gpuSlot!.state, "resolved");
});

test("getBuildView with case+GPU selection shows build status", async () => {
  const store = new InMemoryCatalogStore({
    cases: [fakeCase({ id: "c" })],
    gpus: [fakeGpu({ id: "g" })],
    parts: [],
  });
  const url = new URL("http://localhost/build?kind=case&case=c&gpu=g");
  const view = await getBuildView(url, store);

  // With a compatible case and GPU, status should be pass or conditional
  assert.ok(
    view.buildStatus === "pass" || view.buildStatus === "conditional",
    `expected pass or conditional, got ${view.buildStatus}`,
  );
});

test("riser advisory is omitted from GPU candidates until a GPU is selected", async () => {
  const store = new InMemoryCatalogStore({
    cases: [fakeCase({
      id: "c",
      gpuRiser: "Y",
      dimensions: { ...fakeCase().dimensions, gpuLengthMm: null },
    })],
    gpus: [fakeGpu({ id: "g" }), fakeGpu({ id: "g2", name: "Second GPU" })],
    parts: [],
  });
  const view = await getBuildView(new URL("http://localhost/build?kind=gpu&case=c"), store);

  assert.ok(view.rows.length > 0);
  assert.ok(view.rows.every((row) => !row.note.includes("requires a GPU riser")));
  assert.equal(
    view.rows.find((row) => row.id === "g")?.cells[1].evidenceVerdict,
    "conditional",
    "dimensional GPU evidence remains visible",
  );
  assert.ok(
    !view.slots.some((slot) =>
      slot.issues.some((issue) => issue.message.includes("requires a GPU riser")),
    ),
  );
});

test("a shared finding is listed once, on the part whose data caused it", async () => {
  const store = new InMemoryCatalogStore({
    cases: [fakeCase({ id: "c", gpuRiser: "Y" })],
    gpus: [fakeGpu({ id: "g" })],
    parts: [],
  });
  const view = await getBuildView(new URL("http://localhost/build?kind=gpu&case=c&gpu=g"), store);

  const caseSlot = view.slots.find((slot) => slot.kind === "case")!;
  const gpuSlot = view.slots.find((slot) => slot.kind === "gpu")!;
  assert.deepEqual(
    caseSlot.issues.map((issue) => issue.code),
    ["requires-riser"],
  );
  assert.deepEqual(gpuSlot.issues, []);

  const riserIssue = caseSlot.issues[0];
  assert.equal(riserIssue.message, "This case requires a GPU riser.");
  assert.equal(riserIssue.title, "GPU riser cable required");
  assert.equal(riserIssue.dismissible, true);
  assert.equal(caseSlot.verdict, "conditional");
  assert.equal(gpuSlot.verdict, "conditional");
});

test("a part card lists every warning on that part", async () => {
  const store = new InMemoryCatalogStore({
    cases: [fakeCase({ id: "c", style: "Sandwich", gpuRiser: "Y" })],
    gpus: [fakeGpu({ id: "g" })],
    parts: [],
  });
  const view = await getBuildView(new URL("http://localhost/build?kind=gpu&case=c&gpu=g"), store);

  const caseSlot = view.slots.find((slot) => slot.kind === "case")!;
  assert.deepEqual(
    caseSlot.issues.map((issue) => issue.code),
    ["sandwich-layout-mode", "requires-riser"],
  );
  assert.equal(
    view.slots.find((slot) => slot.kind === "gpu")!.issues.length,
    0,
  );
  assert.equal(view.buildStatus, "conditional");
});

test("a dimension conflict is listed on the part whose measurement caused it", async () => {
  const store = new InMemoryCatalogStore({
    cases: [
      fakeCase({
        id: "c",
        dimensions: { ...fakeCase().dimensions, gpuLengthMm: 200 },
      }),
    ],
    gpus: [fakeGpu({ id: "g" })],
    parts: [],
  });
  const view = await getBuildView(new URL("http://localhost/build?kind=gpu&case=c&gpu=g"), store);

  const caseSlot = view.slots.find((slot) => slot.kind === "case")!;
  const gpuSlot = view.slots.find((slot) => slot.kind === "gpu")!;
  assert.deepEqual(
    gpuSlot.issues.map((issue) => issue.code),
    ["exceeds-gpuLengthMm"],
  );
  assert.ok(caseSlot.issues.every((issue) => issue.code !== "exceeds-gpuLengthMm"));
  assert.equal(gpuSlot.verdict, "fail");
});

test("ignoring a warning clears the build verdict but keeps the warning listed", async () => {
  const store = new InMemoryCatalogStore({
    cases: [fakeCase({ id: "c", style: "Sandwich", gpuRiser: "Y" })],
    gpus: [fakeGpu({ id: "g" })],
    parts: [],
  });
  const url = new URL("http://localhost/build?kind=gpu&case=c&gpu=g");

  const before = await getBuildView(url, store);
  assert.equal(before.buildStatus, "conditional");
  const issues = before.slots.find((slot) => slot.kind === "case")!.issues;
  assert.ok(issues.length > 0);
  assert.ok(issues.every((issue) => !issue.ignored));
  assert.ok(issues.every((issue) => issue.dismissible));

  const ignoredCodes = issues.map((issue) => issue.code);
  const after = await getBuildView(url, store, { ignored: new Set(ignoredCodes) });

  assert.equal(after.buildStatus, "pass");
  assert.equal(after.slots.find((slot) => slot.kind === "gpu")!.verdict, "pass");
  for (const slot of after.slots) {
    if (!slot.id) continue;
    assert.equal(slot.verdict, "pass");
    for (const issue of slot.issues) {
      assert.equal(
        issue.ignored,
        ignoredCodes.includes(issue.code),
        `${issue.code} keeps its ignored state on the ${slot.kind} card`,
      );
    }
  }
});

test("a satisfied constraint is not repeated as a card note", async () => {
  const store = new InMemoryCatalogStore({
    cases: [fakeCase({ id: "c", psu: "SFX / SFX-L" })],
    parts: [
      { kind: "psu", id: "psu-1", displayName: "Test PSU", name: "Test PSU", brand: "Test", sourceSheet: "PSU", rowNumber: 1, status: "", availabilityStatus: "available" as const, sellerUrl: "", productUrl: "", specs: { form_factor: "SFX" }, dimensions: {}, releaseYear: null, flags: [], raw: {}, links: {} },
    ],
  });
  const view = await getBuildView(
    new URL("http://localhost/build?kind=psu&case=c&psu=psu-1"),
    store,
  );

  const psuSlot = view.slots.find((slot) => slot.kind === "psu")!;
  assert.equal(psuSlot.verdict, "pass");
  assert.deepEqual(psuSlot.issues, []);
  assert.equal(psuSlot.note, "", "the case envelope stays on the case card");
});

test("a tight clearance still surfaces as a card note", async () => {
  const store = new InMemoryCatalogStore({
    cases: [
      fakeCase({
        id: "c",
        dimensions: { ...fakeCase().dimensions, gpuWidthMm: 145 },
      }),
    ],
    gpus: [fakeGpu({ id: "g" })],
    parts: [],
  });
  const view = await getBuildView(
    new URL("http://localhost/build?kind=gpu&case=c&gpu=g"),
    store,
  );

  const gpuSlot = view.slots.find((slot) => slot.kind === "gpu")!;
  assert.equal(gpuSlot.verdict, "pass");
  assert.deepEqual(gpuSlot.issues, [], "a pass advisory is not an issue");
  assert.match(gpuSlot.note, /GPU width has only 5mm of clearance/);
  assert.equal(
    view.slots.find((slot) => slot.kind === "case")!.note,
    "",
    "the note belongs to the part being measured",
  );
});

test("hard conflicts cannot be ignored", async () => {
  const store = new InMemoryCatalogStore({
    cases: [
      fakeCase({
        id: "c",
        dimensions: { ...fakeCase().dimensions, gpuLengthMm: 200 },
      }),
    ],
    gpus: [fakeGpu({ id: "g" })],
    parts: [],
  });
  const view = await getBuildView(
    new URL("http://localhost/build?kind=gpu&case=c&gpu=g"),
    store,
    { ignored: new Set(["exceeds-gpuLengthMm"]) },
  );

  assert.equal(view.buildStatus, "fail");
  const issue = view.slots
    .flatMap((slot) => slot.issues)
    .find((candidate) => candidate.code === "exceeds-gpuLengthMm");
  assert.ok(issue, "length conflict is listed on a part card");
  assert.equal(issue!.dismissible, false);
  assert.equal(issue!.ignored, false);
  assert.equal(issue!.title, "GPU length exceeds case limit");
});

// ---------------------------------------------------------------------------
// Cell-level evidence tests
// ---------------------------------------------------------------------------

test("cell-level evidence — GPU length conditional highlights length cell", async () => {
  // GPU too long for case → length cell should have evidenceVerdict="fail"
  // Case gpuLengthMm is null so no auto-populated filter blocks the row
  const store = new InMemoryCatalogStore({
    cases: [fakeCase({ id: "c", dimensions: { ...fakeCase().dimensions, gpuLengthMm: null } })],
    gpus: [fakeGpu({ id: "g", dimensions: { lengthMm: 300, widthMm: 140, thicknessMm: 50, pcieSlots: 3 } })],
    parts: [],
  });
  const url = new URL("http://localhost/build?kind=gpu&case=c&gpu=g");
  const view = await getBuildView(url, store);

  // Find the selected GPU row
  const gpuRow = view.rows.find((r) => r.id === "g");
  assert.ok(gpuRow, "gpu row should exist");

  // Length column: GPU columns[0] = chipset, [1] = length, [2] = width, [3] = thickness, [4] = slots
  const lengthCell = gpuRow!.cells[1];
  assert.ok(lengthCell.value.includes("300"), "length cell value should show GPU length");
  assert.equal(lengthCell.evidenceVerdict, "conditional");
  assert.ok(
    lengthCell.evidenceMessages.some((message) =>
      message.includes("GPU length cannot be fully checked"),
    ),
    "length cell should carry the GPU length evidence message",
  );
});

test("cell-level evidence — PSU form factor mismatch highlights form-factor cell", async () => {
  // PSU form factor ATX but case only supports SFX
  const store = new InMemoryCatalogStore({
    cases: [fakeCase({ id: "c", psu: "SFX" })],
    parts: [
      { kind: "psu", id: "psu-1", displayName: "Test PSU", name: "Test PSU", brand: "Test", sourceSheet: "PSU", rowNumber: 1, status: "", availabilityStatus: "available" as const, sellerUrl: "", productUrl: "", specs: { form_factor: "ATX" }, dimensions: {}, releaseYear: null, flags: [], raw: {}, links: {} },
    ],
  });
  const url = new URL("http://localhost/build?kind=psu&case=c&psu=psu-1");
  const view = await getBuildView(url, store);

  const psuRow = view.rows.find((r) => r.id === "psu-1");
  assert.ok(psuRow, "psu row should exist");

  // PSU columns[0] = tier/rating, [1] = form factor
  const ffCell = psuRow!.cells[1];
  assert.equal(ffCell.evidenceVerdict, "fail");
  assert.equal(ffCell.value, "ATX");
  assert.ok(
    ffCell.evidenceMessages.some((message) =>
      message.includes("PSU form factor ATX is not supported"),
    ),
    "form-factor cell should carry the PSU mismatch evidence message",
  );
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

test("async runner collects promises", async () => {
  // This is just to delay the summary until all async tests finish
  await Promise.resolve();
});

// We need to wait for async tests. Let's use a simple approach:
setTimeout(() => {
  console.log(`\n${"=".repeat(48)}`);
  console.log(`  Build-View (with InMemoryCatalogStore): ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(48)}`);
  process.exit(failed > 0 ? 1 : 0);
}, 500);
