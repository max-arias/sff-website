/**
 * Tests for the evidence-code copy map.
 *
 * Run with:  npx tsx src/fitment/issue-copy.test.ts
 */

import assert from "node:assert/strict";
import { issueTitle, issueTitleForCode } from "./issue-copy";
import { evaluateGpuAgainstCase } from "./engine";
import type { CasePart, GpuPart } from "../types";

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
// Tests
// ---------------------------------------------------------------------------

test("mapped codes return their friendly heading", () => {
  assert.equal(issueTitle("requires-riser", "unused"), "GPU riser cable required");
  assert.equal(issueTitle("sandwich-layout-mode", "unused"), "Sandwich layout mode");
  assert.equal(issueTitle("watercooled-gpu", "unused"), "Watercooled GPU");
});

test("metric-family codes compose a heading from the metric", () => {
  assert.equal(
    issueTitle("exceeds-gpuLengthMm", "unused"),
    "GPU length exceeds case limit",
  );
  assert.equal(
    issueTitle("unknown-gpuThicknessMm", "unused"),
    "GPU thickness not fully verifiable",
  );
});

test("unmapped codes fall back to the supplied text", () => {
  assert.equal(
    issueTitle("brand-new-rule", "Brand new rule fired."),
    "Brand new rule fired.",
  );
  assert.equal(issueTitleForCode("brand-new-rule"), "brand new rule");
});

test("every code the GPU/case rules can emit has a mapped heading", () => {
  const casePart = {
    kind: "case",
    style: "Sandwich",
    gpuRiser: "Y",
    status: "prototype",
    psu: "DC-ATX",
    dimensions: {
      gpuLengthMm: null,
      gpuWidthMm: null,
      gpuThicknessMm: null,
      pcieSlots: null,
      lpPcieSlots: 0,
    },
  };
  const gpu = {
    kind: "gpu",
    lowProfile: false,
    watercooled: true,
    pciePins: "3x 8-pin",
    dimensions: { lengthMm: 300, widthMm: 140, thicknessMm: 50, pcieSlots: 3 },
  };

  const codes = evaluateGpuAgainstCase(gpu as GpuPart, casePart as CasePart).map(
    (evidence) => evidence.code,
  );
  assert.ok(codes.length > 4, `expected several evidence codes, got ${codes.length}`);
  for (const code of codes) {
    assert.notEqual(
      issueTitle(code, "UNMAPPED"),
      "UNMAPPED",
      `${code} needs a heading in the copy map`,
    );
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(48)}`);
console.log(`  Issue copy map: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(48)}`);

process.exit(failed > 0 ? 1 : 0);
