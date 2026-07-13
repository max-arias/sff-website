/**
 * Tests for the canonical numeric filter parameter definitions.
 *
 * Verifies that every param name in NUMERIC_FILTER_PARAM_NAMES has a
 * corresponding FILTER_GROUPS entry (by kind), and vice versa — except
 * for the small pre-existing set of drive-related params that are in the
 * flat list but lack column definitions (and thus no filter-group entry).
 *
 * Run with:  npx tsx src/lib/build-filter-params.test.ts
 */

import assert from "node:assert/strict";
import {
  FILTER_GROUPS,
  NUMERIC_FILTER_PARAM_NAMES,
} from "./build-filter-params";

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

test("NUMERIC_FILTER_PARAM_NAMES is a non-empty array", () => {
  assert.ok(Array.isArray(NUMERIC_FILTER_PARAM_NAMES));
  assert.ok(NUMERIC_FILTER_PARAM_NAMES.length > 0);
});

test("NUMERIC_FILTER_PARAM_NAMES contains at least one param from each kind prefix", () => {
  const names = NUMERIC_FILTER_PARAM_NAMES as readonly string[];
  assert.ok(names.some((n) => n.startsWith("case-")), "case params present");
  assert.ok(names.some((n) => n.startsWith("max-gpu-")), "gpu params present");
  assert.ok(names.some((n) => n.startsWith("cooler-")), "cooler params present");
  assert.ok(names.some((n) => n.startsWith("psu-")), "psu params present");
  assert.ok(names.some((n) => n.startsWith("mobo-")), "motherboard params present");
  assert.ok(names.some((n) => n.startsWith("ram-")), "ram params present");
});

test("FILTER_GROUPS has entries for every kind", () => {
  assert.ok(FILTER_GROUPS.case, "case key present");
  assert.ok(FILTER_GROUPS.gpu, "gpu key present");
  assert.ok(FILTER_GROUPS["cpu-cooler"], "cpu-cooler key present");
  assert.ok(FILTER_GROUPS.psu, "psu key present");
  assert.ok(FILTER_GROUPS.motherboard, "motherboard key present");
  assert.ok(FILTER_GROUPS.ram, "ram key present");
});

test("All FILTER_GROUPS param keys exist in NUMERIC_FILTER_PARAM_NAMES", () => {
  const nameSet = new Set<string>(NUMERIC_FILTER_PARAM_NAMES);
  for (const [kind, groups] of Object.entries(FILTER_GROUPS)) {
    for (const paramKey of Object.keys(groups)) {
      assert.ok(
        nameSet.has(paramKey),
        `FILTER_GROUPS.${kind} has key "${paramKey}" not in NUMERIC_FILTER_PARAM_NAMES`,
      );
    }
  }
});

test("Every NUMERIC_FILTER_PARAM_NAMES entry appears in at least one FILTER_GROUPS entry", () => {
  // Collect all param keys referenced in FILTER_GROUPS
  const allGroupKeys = new Set<string>();
  for (const groups of Object.values(FILTER_GROUPS)) {
    for (const key of Object.keys(groups)) {
      allGroupKeys.add(key);
    }
  }

  // Known pre-existing params that are in the flat list but have no
  // corresponding column definition or FILTER_GROUPS entry.
  // These existed before this module was extracted; fixing them is out of scope.
  const KNOWN_MISSING = new Set([
    "case-max-drive-25",
    "case-max-drive-35",
    "case-max-drive-525",
    "case-max-gpu-width-mm",
  ]);

  for (const name of NUMERIC_FILTER_PARAM_NAMES) {
    if (KNOWN_MISSING.has(name)) continue;
    assert.ok(
      allGroupKeys.has(name),
      `"${name}" is in NUMERIC_FILTER_PARAM_NAMES but has no FILTER_GROUPS entry`,
    );
  }
});

test("Every kind in FILTER_GROUPS matches the expected param key prefix pattern", () => {
  const prefixMap: Record<string, string[]> = {
    case: ["case-max-"],
    gpu: ["max-gpu-"],
    "cpu-cooler": ["cooler-max-"],
    psu: ["psu-max-"],
    motherboard: ["mobo-max-"],
    ram: ["ram-max-"],
  };

  for (const [kind, groups] of Object.entries(FILTER_GROUPS)) {
    const prefixes = prefixMap[kind];
    assert.ok(prefixes, `Unexpected kind "${kind}" in FILTER_GROUPS`);
    for (const paramKey of Object.keys(groups)) {
      const matchesPrefix = prefixes.some((p) => paramKey.startsWith(p));
      assert.ok(
        matchesPrefix,
        `FILTER_GROUPS.${kind} has "${paramKey}" which does not start with expected prefix(es): ${prefixes.join(", ")}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(48)}`);
console.log(`  Build filter params: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(48)}`);

process.exit(failed > 0 ? 1 : 0);
