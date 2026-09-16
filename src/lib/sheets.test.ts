/**
 * Tests for the workbook sheet classifications the intake relies on.
 *
 * Run with:  npx tsx src/lib/sheets.test.ts
 */

import assert from "node:assert/strict";
import { boardFormFactorFromSheet } from "./sheets";

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

test("maps the workbook's current board sheet names", () => {
  assert.equal(boardFormFactorFromSheet("mITX Boards"), "mITX");
  assert.equal(boardFormFactorFromSheet("mATX Boards"), "mATX");
});

test("maps earlier and alternate board sheet spellings", () => {
  assert.equal(boardFormFactorFromSheet("Motherboard mITX"), "mITX");
  assert.equal(boardFormFactorFromSheet("Mini-ITX Boards"), "mITX");
  assert.equal(boardFormFactorFromSheet("MicroATX Boards"), "mATX");
});

test("leaves the form factor absent for sheets that do not classify boards", () => {
  assert.equal(boardFormFactorFromSheet("Boards"), "");
  assert.equal(boardFormFactorFromSheet("PSU"), "");
  assert.equal(boardFormFactorFromSheet(""), "");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(48)}`);
console.log(`  Workbook sheets: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(48)}`);

process.exit(failed > 0 ? 1 : 0);
