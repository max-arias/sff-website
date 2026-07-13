/**
 * Tests for the fitment engine.
 *
 * Run with:  npx tsx src/fitment/engine.test.ts
 */

import assert from "node:assert/strict";
import type { CasePart, GenericPart, GpuPart } from "../types";
import type { BuildContext } from "./types";
import {
  evaluateBuildFitment,
  evaluateCandidateFitment,
  evaluateCpuCoolerAgainstCase,
  evaluateGpuAgainstCase,
  evaluateMotherboardAgainstCase,
  evaluatePsuAgainstCase,
  evaluateRamAgainstCpuCooler,
  evaluateRamAgainstMotherboard,
} from "./engine";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function fakeCase(overrides: Partial<CasePart> = {}): CasePart {
  return {
    kind: "case",
    id: "test-case",
    sourceSheet: "TestCase",
    rowNumber: 1,
    seller: "TestCo",
    name: "Test Case",
    style: "Mini-Tower",
    sidePanel: "Mesh",
    caseMaterial: "Aluminum",
    status: "",
    availabilityStatus: "available",
    gpuRiser: "",
    psu: "SFX",
    motherboard: "mITX",
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
      drive25Max: null,
      drive35Max: null,
      drive525Max: null,
      fan40mm: null,
      fan60mm: null,
      fan80mm: null,
      fan92mm: null,
      fan120mm: null,
      fan140mm: null,
      fan180mm: null,
      fan200mm: null,
      usbA20: null,
      usbA32: null,
      usbC: null,
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
    id: "test-gpu",
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

function gp(overrides: Partial<GenericPart> & { id?: string } = {}): GenericPart {
  return {
    id: overrides.id ?? "test-part",
    kind: overrides.kind ?? "cpu-cooler",
    sourceSheet: overrides.sourceSheet ?? "TestSheet",
    rowNumber: 1,
    brand: "TestBrand",
    name: "Test Name",
    displayName: "Test Display Name",
    status: "",
    availabilityStatus: "available",
    sellerUrl: "",
    productUrl: "",
    specs: {},
    dimensions: {},
    releaseYear: null,
    flags: [],
    raw: {},
    links: {},
    ...overrides,
  };
}

function buildContext(overrides: Partial<BuildContext> = {}): BuildContext {
  return {
    activeCase: null,
    activeGpu: null,
    activeCpuCooler: null,
    activePsu: null,
    activeMotherboard: null,
    activeRam: null,
    ...overrides,
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
// Case / GPU checks
// ---------------------------------------------------------------------------

test("GPU fits case dimensions → pass", () => {
  const evidence = evaluateGpuAgainstCase(
    fakeGpu({ dimensions: { lengthMm: 300, widthMm: 140, thicknessMm: 50, pcieSlots: 3 } }),
    fakeCase({ dimensions: { ...fakeCase().dimensions, gpuLengthMm: 350, gpuWidthMm: 160, gpuThicknessMm: 60, pcieSlots: 4 } }),
  );
  const fails = evidence.filter((e) => e.verdict === "fail");
  assert.equal(fails.length, 0, `expected no fails, got: ${fails.map((e) => e.message).join("; ")}`);
});

test("GPU exceeds case length → fail", () => {
  const evidence = evaluateGpuAgainstCase(
    fakeGpu({ dimensions: { lengthMm: 350, widthMm: 140, thicknessMm: 50, pcieSlots: 3 } }),
    fakeCase({ dimensions: { ...fakeCase().dimensions, gpuLengthMm: 320 } }),
  );
  const hasFail = evidence.some((e) => e.code === "exceeds-gpuLengthMm");
  assert.ok(hasFail, "expected exceeds-gpuLengthMm evidence");
});

test("GPU tight fit for length → advisory (pass verdict)", () => {
  const evidence = evaluateGpuAgainstCase(
    fakeGpu({ dimensions: { lengthMm: 319, widthMm: 140, thicknessMm: 50, pcieSlots: 3 } }),
    fakeCase({ dimensions: { ...fakeCase().dimensions, gpuLengthMm: 320 } }),
  );
  const tight = evidence.find((e) => e.code === "tight-gpuLengthMm");
  assert.ok(tight, "expected tight-gpuLengthMm evidence");
  assert.equal(tight!.verdict, "pass");
  assert.ok(tight!.advisory);
});

test("Low profile only case with full-height GPU → fail", () => {
  const evidence = evaluateGpuAgainstCase(
    fakeGpu({ lowProfile: false }),
    fakeCase({ dimensions: { ...fakeCase().dimensions, lpPcieSlots: 2, pcieSlots: 0 } }),
  );
  const hasFail = evidence.some((e) => e.code === "low-profile-only");
  assert.ok(hasFail);
});

test("Sandwich case → conditional advisory", () => {
  const evidence = evaluateGpuAgainstCase(
    fakeGpu(),
    fakeCase({ style: "Sandwich" }),
  );
  const hasSandwich = evidence.some((e) => e.code === "sandwich-layout-mode");
  assert.ok(hasSandwich);
});

test("Case requires riser → conditional advisory", () => {
  const evidence = evaluateGpuAgainstCase(
    fakeGpu(),
    fakeCase({ gpuRiser: "Y" }),
  );
  const hasRiser = evidence.some((e) => e.code === "requires-riser");
  assert.ok(hasRiser);
});

test("Watercooled GPU → conditional advisory", () => {
  const evidence = evaluateGpuAgainstCase(
    fakeGpu({ watercooled: true }),
    fakeCase(),
  );
  const hasWatercooled = evidence.some((e) => e.code === "watercooled-gpu");
  assert.ok(hasWatercooled);
});

test("Case with unknown GPU dimensions → conditional", () => {
  const evidence = evaluateGpuAgainstCase(
    fakeGpu({ dimensions: { lengthMm: null, widthMm: 140, thicknessMm: 50, pcieSlots: 3 } }),
    fakeCase({ dimensions: { ...fakeCase().dimensions, gpuLengthMm: null } }),
  );
  const unknowns = evidence.filter((e) => e.code.startsWith("unknown-"));
  assert.ok(unknowns.length > 0);
});

// ---------------------------------------------------------------------------
// Cooler vs Case
// ---------------------------------------------------------------------------

test("Cooler fits case → pass", () => {
  const evidence = evaluateCpuCoolerAgainstCase(
    gp({ dimensions: { height: 130 } }),
    fakeCase({ dimensions: { ...fakeCase().dimensions, cpuCoolerHeightMm: 135 } }),
  );
  assert.equal(evidence.verdict, "pass");
});

test("Cooler exceeds case → fail", () => {
  const evidence = evaluateCpuCoolerAgainstCase(
    gp({ dimensions: { height: 140 } }),
    fakeCase({ dimensions: { ...fakeCase().dimensions, cpuCoolerHeightMm: 135 } }),
  );
  assert.equal(evidence.verdict, "fail");
});

test("Unknown cooler height → conditional", () => {
  const evidence = evaluateCpuCoolerAgainstCase(
    gp({ dimensions: {} }),
    fakeCase({ dimensions: { ...fakeCase().dimensions, cpuCoolerHeightMm: 135 } }),
  );
  assert.equal(evidence.verdict, "conditional");
});

test("Unknown case cooler limit → conditional", () => {
  const evidence = evaluateCpuCoolerAgainstCase(
    gp({ dimensions: { height: 130 } }),
    fakeCase({ dimensions: { ...fakeCase().dimensions, cpuCoolerHeightMm: null } }),
  );
  assert.equal(evidence.verdict, "conditional");
});

// ---------------------------------------------------------------------------
// PSU vs Case
// ---------------------------------------------------------------------------

test("PSU form factor supported by case → pass", () => {
  const evidence = evaluatePsuAgainstCase(
    gp({ kind: "psu", specs: { form_factor: "SFX" } }),
    fakeCase({ psu: "SFX" }),
  );
  assert.equal(evidence.verdict, "pass");
});

test("PSU form factor not supported → fail", () => {
  const evidence = evaluatePsuAgainstCase(
    gp({ kind: "psu", specs: { form_factor: "ATX" } }),
    fakeCase({ psu: "SFX" }),
  );
  assert.equal(evidence.verdict, "fail");
});

test("Unknown PSU form factor → conditional", () => {
  const evidence = evaluatePsuAgainstCase(
    gp({ kind: "psu", specs: {} }),
    fakeCase({ psu: "SFX" }),
  );
  assert.equal(evidence.verdict, "conditional");
});

test("Custom PSU → conditional", () => {
  const evidence = evaluatePsuAgainstCase(
    gp({ kind: "psu", specs: { form_factor: "custom" } }),
    fakeCase({ psu: "SFX, ATX" }),
  );
  assert.equal(evidence.verdict, "conditional");
});

// ---------------------------------------------------------------------------
// Motherboard vs Case
// ---------------------------------------------------------------------------

test("Motherboard form factor supported → pass", () => {
  const evidence = evaluateMotherboardAgainstCase(
    gp({ kind: "motherboard", specs: { form_factor: "mITX" } }),
    fakeCase({ raw: { Motherboard: "mITX" } }),
  );
  assert.equal(evidence.verdict, "pass");
});

test("Motherboard form factor not supported → fail", () => {
  const evidence = evaluateMotherboardAgainstCase(
    gp({ kind: "motherboard", specs: { form_factor: "ATX" } }),
    fakeCase({ raw: { Motherboard: "mITX" } }),
  );
  assert.equal(evidence.verdict, "fail");
});

test("Motherboard form factor unknown → conditional", () => {
  const evidence = evaluateMotherboardAgainstCase(
    gp({ kind: "motherboard", specs: {} }),
    fakeCase({ raw: { Motherboard: "mITX" } }),
  );
  assert.equal(evidence.verdict, "conditional");
});

// ---------------------------------------------------------------------------
// RAM vs Motherboard
// ---------------------------------------------------------------------------

test("RAM type matches motherboard → pass", () => {
  const evidence = evaluateRamAgainstMotherboard(
    gp({ kind: "ram", specs: { memory_type: "DDR5" } }),
    gp({ kind: "motherboard", specs: { ram_type: "DDR5" } }),
  );
  assert.equal(evidence.verdict, "pass");
});

test("RAM type mismatch → fail", () => {
  const evidence = evaluateRamAgainstMotherboard(
    gp({ kind: "ram", specs: { memory_type: "DDR4" } }),
    gp({ kind: "motherboard", specs: { ram_type: "DDR5" } }),
  );
  assert.equal(evidence.verdict, "fail");
});

test("RAM type unknown → conditional", () => {
  const evidence = evaluateRamAgainstMotherboard(
    gp({ kind: "ram", specs: {} }),
    gp({ kind: "motherboard", specs: { ram_type: "DDR5" } }),
  );
  assert.equal(evidence.verdict, "conditional");
});

// ---------------------------------------------------------------------------
// RAM vs CPU Cooler
// ---------------------------------------------------------------------------

test("RAM height fits cooler clearance → pass", () => {
  const evidence = evaluateRamAgainstCpuCooler(
    gp({ kind: "ram", dimensions: { height_incl_contact_pins: 33 } }),
    gp({ kind: "cpu-cooler", dimensions: { ram_clearance: 45 } }),
  );
  assert.equal(evidence.verdict, "pass");
});

test("RAM height exceeds cooler clearance → fail", () => {
  const evidence = evaluateRamAgainstCpuCooler(
    gp({ kind: "ram", dimensions: { height_incl_contact_pins: 50 } }),
    gp({ kind: "cpu-cooler", dimensions: { ram_clearance: 45 } }),
  );
  assert.equal(evidence.verdict, "fail");
});

test("Cooler with no RAM limit → pass", () => {
  const evidence = evaluateRamAgainstCpuCooler(
    gp({ kind: "ram", dimensions: { height_incl_contact_pins: 50 } }),
    gp({ kind: "cpu-cooler", specs: { ram_clearance: "No limit" } }),
  );
  assert.equal(evidence.verdict, "pass");
});

test("RAM height or cooler clearance unknown → conditional", () => {
  const evidence = evaluateRamAgainstCpuCooler(
    gp({ kind: "ram", dimensions: {} }),
    gp({ kind: "cpu-cooler", dimensions: {} }),
  );
  assert.equal(evidence.verdict, "conditional");
});

// ---------------------------------------------------------------------------
// evaluateCandidateFitment
// ---------------------------------------------------------------------------

test("candidate GPU against active case → evaluates GPU fitment", () => {
  const build = buildContext({
    activeCase: fakeCase(),
  });
  const decision = evaluateCandidateFitment(build, fakeGpu());
  assert.equal(decision.verdict, "pass");
});

test("candidate case against active GPU → evaluates GPU fitment", () => {
  const build = buildContext({
    activeGpu: fakeGpu(),
  });
  const decision = evaluateCandidateFitment(build, fakeCase());
  assert.equal(decision.verdict, "pass");
});

test("candidate cooler against active case → evaluates cooler fitment", () => {
  const build = buildContext({
    activeCase: fakeCase(),
  });
  const decision = evaluateCandidateFitment(
    build,
    gp({ kind: "cpu-cooler", dimensions: { height: 130 } }),
  );
  assert.equal(decision.verdict, "pass");
});

test("candidate with no active counterparts → unscored", () => {
  const build = buildContext();
  const decision = evaluateCandidateFitment(build, fakeCase());
  assert.equal(decision.verdict, "unscored");
});

// ---------------------------------------------------------------------------
// evaluateBuildFitment — overall build check
// ---------------------------------------------------------------------------

test("complete compatible build → pass", () => {
  const build = buildContext({
    activeCase: fakeCase({ raw: { Motherboard: "mITX" } }),
    activeGpu: fakeGpu(),
    activeCpuCooler: gp({ kind: "cpu-cooler", dimensions: { height: 130, ram_clearance: 45 } }),
    activePsu: gp({ kind: "psu", specs: { form_factor: "SFX" } }),
    activeMotherboard: gp({ kind: "motherboard", specs: { form_factor: "mITX", ram_type: "DDR5" } }),
    activeRam: gp({ kind: "ram", specs: { memory_type: "DDR5" }, dimensions: { height_incl_contact_pins: 33 } }),
  });
  const result = evaluateBuildFitment(build);
  assert.equal(result.verdict, "pass");
});

test("build with GPU exceeding case → fail", () => {
  const build = buildContext({
    activeCase: fakeCase({ dimensions: { ...fakeCase().dimensions, gpuLengthMm: 280 } }),
    activeGpu: fakeGpu({ dimensions: { lengthMm: 300, widthMm: 140, thicknessMm: 50, pcieSlots: 3 } }),
  });
  const result = evaluateBuildFitment(build);
  assert.equal(result.verdict, "fail");
});

test("build with partially unknown data → conditional", () => {
  const build = buildContext({
    activeCase: fakeCase({ dimensions: { ...fakeCase().dimensions, cpuCoolerHeightMm: null } }),
    activeCpuCooler: gp({ kind: "cpu-cooler", dimensions: { height: 130 } }),
  });
  const result = evaluateBuildFitment(build);
  assert.equal(result.verdict, "conditional");
});

test("empty build → unscored", () => {
  const build = buildContext();
  const result = evaluateBuildFitment(build);
  assert.equal(result.verdict, "unscored");
});

// ---------------------------------------------------------------------------
// Verdict aggregation
// ---------------------------------------------------------------------------

test("fail wins over conditional", () => {
  const build = buildContext({
    activeCase: fakeCase({
      psu: "SFX",
      dimensions: { ...fakeCase().dimensions, gpuLengthMm: 280 },
      raw: { Motherboard: "mITX" },
    }),
    activeGpu: fakeGpu({ dimensions: { lengthMm: 300, widthMm: 140, thicknessMm: 50, pcieSlots: 3 } }),
    activePsu: gp({ kind: "psu", specs: { form_factor: "SFX" } }),
    activeMotherboard: gp({ kind: "motherboard", specs: {} }),
  });
  const result = evaluateBuildFitment(build);
  assert.equal(result.verdict, "fail", "GPU exceeding case should produce fail, overriding conditional");
});

test("conditional with no fail → conditional", () => {
  const build = buildContext({
    activeCase: fakeCase({ dimensions: { ...fakeCase().dimensions, cpuCoolerHeightMm: null } }),
    activeCpuCooler: gp({ kind: "cpu-cooler", dimensions: { height: 130 } }),
  });
  const result = evaluateBuildFitment(build);
  assert.equal(result.verdict, "conditional");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(48)}`);
console.log(`  Fitment Engine: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(48)}`);

process.exit(failed > 0 ? 1 : 0);
