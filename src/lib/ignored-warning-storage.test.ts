/**
 * Tests for the always-ignored warning store.
 *
 * Run with:  npx tsx src/lib/ignored-warning-storage.test.ts
 */

import assert from "node:assert/strict";
import { parseIgnoredWarnings } from "./ignored-warning-storage";

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

test("missing, malformed, and stale payloads read as nothing ignored", () => {
  assert.deepEqual(parseIgnoredWarnings(null), []);
  assert.deepEqual(parseIgnoredWarnings(""), []);
  assert.deepEqual(parseIgnoredWarnings("{not json"), []);
  assert.deepEqual(parseIgnoredWarnings("null"), []);
  assert.deepEqual(parseIgnoredWarnings('{"version":0,"codes":["requires-riser"]}'), []);
  assert.deepEqual(parseIgnoredWarnings('{"version":1,"codes":"requires-riser"}'), []);
  assert.deepEqual(parseIgnoredWarnings('{"version":1}'), []);
});

test("codes are deduplicated and non-strings are dropped", () => {
  assert.deepEqual(
    parseIgnoredWarnings(
      '{"version":1,"codes":["requires-riser",42,"",null,"requires-riser"]}',
    ),
    ["requires-riser"],
  );
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(48)}`);
console.log(`  Ignored warning storage: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(48)}`);

process.exit(failed > 0 ? 1 : 0);
