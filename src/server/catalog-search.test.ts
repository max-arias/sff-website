/**
 * Regression tests for fuseSearchRows (catalog search/ranking).
 *
 * Run with:  npm run test:search
 * Requires:  tsx (already a devDependency)
 * No D1 or cloudflare:workers needed — pure function test.
 */

import assert from "node:assert/strict";
import { fuseSearchRows, type CatalogSearchRow } from "./catalog-search";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function row(overrides: Partial<CatalogSearchRow> & { id: string }): CatalogSearchRow {
  return {
    kind: "case",
    source_sheet: "test",
    source_row_number: 1,
    brand: "",
    name: "",
    display_name: "",
    status: "",
    gpu_chipset: "",
    gpu_model: "",
    case_seller: "",
    case_style: "",
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Fixture data set  — mimics real catalog rows
// ---------------------------------------------------------------------------

const FIXTURES: CatalogSearchRow[] = [
  row({
    id: "thor-zone-pro",
    display_name: "Thor Zone Pro",
    brand: "Thor Zone",
    name: "Thor Zone Pro",
    case_seller: "Thor Zone",
    case_style: "Pro",
    kind: "case"
  }),
  row({
    id: "thor-zone-mjolnir",
    display_name: "Thor Zone Mjolnir",
    brand: "Thor Zone",
    name: "Thor Zone Mjolnir",
    case_seller: "Thor Zone",
    case_style: "Mjolnir",
    kind: "case"
  }),
  row({
    id: "winter-one",
    display_name: "Winter One",
    brand: "Winter",
    name: "Winter One",
    kind: "case"
  }),
  row({
    id: "shark-zone",
    display_name: "Shark Zone",
    brand: "Shark",
    name: "Shark Zone",
    kind: "case"
  }),
  row({
    id: "enthoo-pro",
    display_name: "Enthoo Pro",
    brand: "Phanteks",
    name: "Enthoo Pro",
    case_seller: "Phanteks",
    case_style: "Pro",
    kind: "case"
  })
];

// ---------------------------------------------------------------------------
// Tests
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

// --- compact query "thorzone" ---

test('compact query "thorzone" returns Thor Zone cases', () => {
  const results = fuseSearchRows(FIXTURES, "thorzone", 10);
  const ids = results.map((r) => r.id);

  assert.ok(ids.includes("thor-zone-pro"), "expected thor-zone-pro in results");
  assert.ok(ids.includes("thor-zone-mjolnir"), "expected thor-zone-mjolnir in results");
});

test('compact query "thorzone" excludes unrelated Enthoo', () => {
  const results = fuseSearchRows(FIXTURES, "thorzone", 10);
  const ids = results.map((r) => r.id);

  assert.ok(!ids.includes("enthoo-pro"), "Enthoo Pro should not match 'thorzone'");
});

test('compact query "thorzone" ranks Thor Zone above any other match', () => {
  const results = fuseSearchRows(FIXTURES, "thorzone", 10);
  const ids = results.map((r) => r.id);

  // Every returned result should be a Thor Zone case
  for (const id of ids) {
    assert.ok(
      id.startsWith("thor-zone"),
      `non-Thor-Zone result "${id}" should not appear before Thor Zone items`
    );
  }
});

// --- spaced query "thor zone" ---

test('spaced query "thor zone" returns both Thor Zone cases', () => {
  const results = fuseSearchRows(FIXTURES, "thor zone", 10);
  const ids = results.map((r) => r.id);

  assert.ok(ids.includes("thor-zone-pro"), "expected thor-zone-pro");
  assert.ok(ids.includes("thor-zone-mjolnir"), "expected thor-zone-mjolnir");
});

test('spaced query "thor zone" does not include Winter One', () => {
  const results = fuseSearchRows(FIXTURES, "thor zone", 10);
  const ids = results.map((r) => r.id);

  assert.ok(!ids.includes("winter-one"), "Winter One should not match 'thor zone'");
});

test('spaced query "thor zone" does not include Shark Zone', () => {
  const results = fuseSearchRows(FIXTURES, "thor zone", 10);
  const ids = results.map((r) => r.id);

  assert.ok(!ids.includes("shark-zone"), "Shark Zone should not match 'thor zone'");
});

// --- model query "mjolnir" ---

test('model query "mjolnir" returns Thor Zone Mjolnir', () => {
  const results = fuseSearchRows(FIXTURES, "mjolnir", 10);
  const ids = results.map((r) => r.id);

  assert.ok(ids.includes("thor-zone-mjolnir"), "expected thor-zone-mjolnir");
});

test('model query "mjolnir" ranks Mjolnir first', () => {
  const results = fuseSearchRows(FIXTURES, "mjolnir", 10);
  assert.equal(results[0]?.id, "thor-zone-mjolnir", "mjolnir should be top result");
});

// --- edge cases ---

test('empty query returns empty results', () => {
  const results = fuseSearchRows(FIXTURES, "", 10);
  assert.equal(results.length, 0);
});

test('empty fixture set returns empty results', () => {
  const results = fuseSearchRows([], "thorzone", 10);
  assert.equal(results.length, 0);
});

test('limit is respected', () => {
  // Add a third Thor Zone item so we have enough to test limiting
  const extended = [...FIXTURES, row({
    id: "thor-zone-nano",
    display_name: "Thor Zone Nano",
    brand: "Thor Zone",
    name: "Thor Zone Nano",
    case_seller: "Thor Zone",
    case_style: "Nano",
    kind: "case"
  })];

  const results = fuseSearchRows(extended, "thorzone", 2);
  assert.equal(results.length, 2);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(48)}`);
console.log(`  Results:  ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(48)}`);

process.exit(failed > 0 ? 1 : 0);
