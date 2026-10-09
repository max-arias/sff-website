import assert from "node:assert/strict";
import { parsePrintedCaseFile, withPrintedCases, loadPrintedCases } from "./printed-cases";
import { buildSeedSql } from "./sql";
import type { IntakeResult } from "../types";

function test(name: string, fn: () => void) {
  fn();
  console.log(`  ✓ ${name}`);
}
type Input = {
  case: Record<string, string>;
  printed: { creator: string; sourceUrl: string; postedAt: string; files: { status: string; url: string }; images?: unknown[]; referenceBuild?: { parts: Record<string, string> } };
};
function input(): Input {
  return {
    case: { Case: "Riserless 3.5L", "Volume (L)": "3.5" },
    printed: { creator: "u/test", sourceUrl: "https://www.reddit.com/r/sffpc/comments/example/", postedAt: "2026-10-01", files: { status: "unreleased", url: "" } },
  };
}

test("minimal file fills optional metadata", () => {
  const file = parsePrintedCaseFile("example.json", input());
  assert.equal(file.printed.creatorUrl, "");
  assert.equal(file.printed.files.license, "");
  assert.deepEqual(file.printed.images, []);
  assert.deepEqual(file.printed.referenceBuild, { parts: {}, notes: "" });
  assert.equal(file.printed.printNotes, "");
});

for (const [name, change] of [
  ["unknown column", (value: Input) => { value.case.Volume = "3.5"; }],
  ["loader-owned column", (value: Input) => { value.case.Seller = "someone"; }],
  ["missing volume", (value: Input) => { delete value.case["Volume (L)"]; }],
  ["published files without URL", (value: Input) => { value.printed.files.status = "published"; }],
  ["HTTP image", (value: Input) => { value.printed.images = [{ url: "http://i.redd.it/example.jpg" }]; }],
  ["invalid slot", (value: Input) => { value.printed.referenceBuild = { parts: { cpu: "unknown" } }; }],
  ["non-string caption", (value: Input) => { value.printed.images = [{ url: "https://i.redd.it/example.jpg", caption: 123 }]; }],
] as const) {
  test(`rejects ${name} with filename`, () => {
    const value = input();
    change(value);
    assert.throws(() => parsePrintedCaseFile("invalid.json", value), /invalid\.json:/);
  });
}

test("unreleased import preserves creator, status, year and seed metadata", () => {
  const empty: IntakeResult = { generatedAt: "2026-10-01T00:00:00Z", rawRows: [], cases: [], parts: [], gpus: [], psuTierEntries: [], warnings: [] };
  const file = parsePrintedCaseFile("example.json", input());
  const result = withPrintedCases(empty, [file]);
  assert.equal(result.cases.length, 1);
  assert.equal(result.cases[0].seller, "u/test");
  assert.equal(result.cases[0].availabilityStatus, "unavailable");
  assert.equal(result.cases[0].releaseYear, 2026);
  assert.deepEqual(result.cases[0].printed, file.printed);
  assert.equal(result.parts[0].kind, "case");
  const sql = buildSeedSql(result);
  assert.match(sql, /insert into cases/);
  assert.match(sql, /3dprinted/);
  assert.match(sql, /printed_json/);
  assert.equal(empty.parts.length, 0);
});
assert.deepEqual(await loadPrintedCases(".data/nonexistent-printed-case-test"), []);
