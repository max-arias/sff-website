/**
 * Tests for GenericPart accessor helpers.
 *
 * Run with:  npx tsx src/lib/generic-part.test.ts
 */

import assert from "node:assert/strict";
import type { GenericPart } from "../types";
import {
  dimensionNumber,
  dimensionValue,
  dimensionOrSpecNumber,
  formatValue,
  isBlankSpec,
  motherboardFormFactor,
  normalizeSpecToken,
  psuTierRank,
  specRaw,
  specValue,
  yesNoValue,
} from "./generic-part";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function gp(overrides: Partial<GenericPart> & { id?: string } = {}): GenericPart {
  return {
    id: overrides.id ?? "test-1",
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
// dimensionNumber
// ---------------------------------------------------------------------------

test("dimensionNumber returns first matching dimension", () => {
  const p = gp({ dimensions: { height: 120, width: 50 } });
  assert.equal(dimensionNumber(p, ["height"]), 120);
  assert.equal(dimensionNumber(p, ["width"]), 50);
});

test("dimensionNumber returns null when no match", () => {
  const p = gp({ dimensions: { height: 120 } });
  assert.equal(dimensionNumber(p, ["width"]), null);
});

test("dimensionNumber tries keys in order", () => {
  const p = gp({ dimensions: { case_height: 100, height: 120 } });
  assert.equal(dimensionNumber(p, ["height", "case_height"]), 120);
  assert.equal(dimensionNumber(p, ["case_height", "height"]), 100);
});

// ---------------------------------------------------------------------------
// dimensionValue
// ---------------------------------------------------------------------------

test("dimensionValue returns formatted string", () => {
  const p = gp({ dimensions: { height: 120 } });
  assert.equal(dimensionValue(p, ["height"]), "120");
  assert.equal(dimensionValue(p, ["height"], "mm"), "120mm");
});

test("dimensionValue returns em-dash when missing", () => {
  const p = gp({ dimensions: {} });
  assert.equal(dimensionValue(p, ["height"]), "—");
});

// ---------------------------------------------------------------------------
// dimensionOrSpecNumber
// ---------------------------------------------------------------------------

test("dimensionOrSpecNumber prefers dimension", () => {
  const p = gp({ dimensions: { ram_clearance: 45 }, specs: { ram_clearance: "40" } });
  assert.equal(dimensionOrSpecNumber(p, ["ram_clearance"]), 45);
});

test("dimensionOrSpecNumber falls back to spec parse", () => {
  const p = gp({ specs: { ram_clearance: "45mm" } });
  assert.equal(dimensionOrSpecNumber(p, ["ram_clearance"]), 45);
});

// ---------------------------------------------------------------------------
// specRaw (original sql.ts behavior)
// ---------------------------------------------------------------------------

test("specRaw returns first truthy spec value", () => {
  const p = gp({ specs: { form_factor: "SFX", psu: "ATX" } });
  assert.equal(specRaw(p, ["form_factor"]), "SFX");
  assert.equal(specRaw(p, ["psu"]), "ATX");
});

test("specRaw tries multiple keys", () => {
  const p = gp({ specs: { model: "RM750x" } });
  assert.equal(specRaw(p, ["name", "model"]), "RM750x");
});

test("specRaw returns empty string when no match", () => {
  const p = gp({ specs: {} });
  assert.equal(specRaw(p, ["missing"]), "");
});

// ---------------------------------------------------------------------------
// specValue (build-view.ts behavior — checks raw, filters blanks)
// ---------------------------------------------------------------------------

test("specValue returns first non-blank value from specs", () => {
  const p = gp({ specs: { form_factor: "mITX" } });
  assert.equal(specValue(p, ["form_factor"]), "mITX");
});

test("specValue returns spec even when blank (does not fall back to raw when spec is truthy)", () => {
  const p = gp({ specs: { form_factor: "-" }, raw: { form_factor: "mITX" } });
  // rawSpecValue("-") returns "-", which is truthy; || short-circuits so raw is not checked;
  // then isBlankSpec("-") returns true, so the value is skipped. Returns "".
  assert.equal(specValue(p, ["form_factor"]), "");
});

test("specValue falls back to raw when spec is missing/falsy", () => {
  const p = gp({ specs: {}, raw: { form_factor: "mITX" } });
  assert.equal(specValue(p, ["form_factor"]), "mITX");
});

test("specValue filters blank spec values", () => {
  const p = gp({ specs: { form_factor: "n/a" } });
  assert.equal(specValue(p, ["form_factor"]), "");
});

test("specValue returns empty when nothing found", () => {
  const p = gp({ specs: {} });
  assert.equal(specValue(p, ["missing"]), "");
});

// ---------------------------------------------------------------------------
// yesNoValue
// ---------------------------------------------------------------------------

test("yesNoValue returns Yes for Y/y", () => {
  const p = gp({ specs: { rgb: "Y" } });
  assert.equal(yesNoValue(p, ["rgb"]), "Yes");
});

test("yesNoValue returns em-dash for N/n", () => {
  const p = gp({ specs: { rgb: "N" } });
  assert.equal(yesNoValue(p, ["rgb"]), "—");
});

test("yesNoValue returns raw value for non-boolean", () => {
  const p = gp({ specs: { psu: "SFX" } });
  assert.equal(yesNoValue(p, ["psu"]), "SFX");
});

test("yesNoValue returns em-dash when missing", () => {
  const p = gp({ specs: {} });
  assert.equal(yesNoValue(p, ["rgb"]), "—");
});

// ---------------------------------------------------------------------------
// motherboardFormFactor
// ---------------------------------------------------------------------------

test("motherboardFormFactor returns explicit spec", () => {
  const p = gp({ specs: { form_factor: "mATX" } });
  assert.equal(motherboardFormFactor(p), "mATX");
});

test("motherboardFormFactor infers from sourceSheet", () => {
  const p = gp({ sourceSheet: "2025-03-mITX" });
  assert.equal(motherboardFormFactor(p), "mITX");
});

test("motherboardFormFactor returns em-dash when unknown", () => {
  const p = gp({ sourceSheet: "OddSheet" });
  assert.equal(motherboardFormFactor(p), "—");
});

// ---------------------------------------------------------------------------
// formatValue
// ---------------------------------------------------------------------------

test("formatValue formats integers without decimal", () => {
  assert.equal(formatValue(120), "120");
  assert.equal(formatValue(120, "mm"), "120mm");
});

test("formatValue formats floats nicely", () => {
  assert.equal(formatValue(3.5), "3.5");
  assert.equal(formatValue(3.0), "3");
});

test("formatValue returns em-dash for null/undefined", () => {
  assert.equal(formatValue(null), "—");
  assert.equal(formatValue(undefined), "—");
});

// ---------------------------------------------------------------------------
// isBlankSpec
// ---------------------------------------------------------------------------

test("isBlankSpec identifies blank values", () => {
  assert.ok(isBlankSpec("-"));
  assert.ok(isBlankSpec("?"));
  assert.ok(isBlankSpec("n/a"));
  assert.ok(isBlankSpec("N/A"));
  assert.ok(isBlankSpec("tbd"));
  assert.ok(isBlankSpec(""));
  assert.ok(!isBlankSpec("SFX"));
  assert.ok(!isBlankSpec("120"));
});

// ---------------------------------------------------------------------------
// normalizeSpecToken
// ---------------------------------------------------------------------------

test("normalizeSpecToken lowercases and removes non-alphanumeric", () => {
  assert.equal(normalizeSpecToken("SFX-L"), "sfxl");
  assert.equal(normalizeSpecToken("Flex ATX"), "flexatx");
  assert.equal(normalizeSpecToken("mITX"), "mitx");
});

// ---------------------------------------------------------------------------
// psuTierRank
// ---------------------------------------------------------------------------

test("psuTierRank ranks tiers correctly", () => {
  assert.equal(psuTierRank("A+"), -0.2);
  assert.equal(psuTierRank("Platinum · Tier A+"), -0.2);
  assert.equal(psuTierRank("Tier B"), 1);
  assert.equal(psuTierRank("B"), 1);
  assert.equal(psuTierRank(""), 99);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(48)}`);
console.log(`  GenericPart accessors: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(48)}`);

process.exit(failed > 0 ? 1 : 0);
