import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchAndNormalizeAll } from "../src/lib/sheets";
import { buildSeedSql } from "../src/lib/sql";
import type { IntakeResult, PsuTierOverride } from "../src/types";

const snapshotPath = resolve(".data/intake-snapshot.json");
const sqlPath = resolve(".data/intake-seed.sql");
const overridesPath = resolve(".data/psu-tier-overrides.json");

/**
 * Atomically write content to a file: write to a .tmp sibling first,
 * then rename over the target so partial/failed writes never clobber
 * known-good artifacts.
 */
async function writeAtomic(targetPath: string, content: string) {
  await mkdir(dirname(targetPath), { recursive: true });
  const tmpPath = targetPath + ".tmp";
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, targetPath);
}

async function loadOverrides(): Promise<PsuTierOverride[]> {
  try {
    const data = JSON.parse(await readFile(overridesPath, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Returns true when the core catalog arrays are all empty (fetch likely failed upstream). */
function isEmptyCatalog(result: IntakeResult): boolean {
  return result.parts.length === 0 && result.cases.length === 0 && result.gpus.length === 0;
}

const sqlOnly = process.argv.includes("--sql-only");

if (sqlOnly) {
  // --sql-only: regenerate SQL from snapshot + overrides without refetching
  let result: IntakeResult;
  try {
    result = JSON.parse(await readFile(snapshotPath, "utf8"));
  } catch {
    console.error(`Cannot read ${snapshotPath}. Run "npm run intake" first.`);
    process.exit(1);
  }

  if (isEmptyCatalog(result)) {
    console.error(
      `FATAL: Snapshot at ${snapshotPath} contains empty catalog (0 parts, 0 cases, 0 GPUs).\n` +
      `Cannot generate seed SQL from empty data. This likely means a previous intake fetch failed.\n` +
      `Check the warnings logged at that time. Fix the upstream issue, then re-run "npm run intake" to get a fresh snapshot.\n` +
      `Artifacts were NOT overwritten.`,
    );
    process.exit(1);
  }

  const overrides = await loadOverrides();
  const sql = buildSeedSql(result, overrides);
  await writeAtomic(sqlPath, sql);

  console.log(
    `Regenerated SQL from snapshot (${result.parts.length} parts, ${result.psuTierEntries.length} tier entries, ${overrides.length} overrides).`,
  );
  console.log(`Wrote ${sqlPath}`);
} else {
  const result = await fetchAndNormalizeAll();

  // Fail-fast: if the core catalog is empty, something went wrong upstream.
  // Do NOT overwrite snapshot/seed — preserve known-good artifacts.
  if (isEmptyCatalog(result)) {
    console.error(
      `FATAL: Upstream catalog fetch returned empty data (0 parts, 0 cases, 0 GPUs).\n` +
      `This is likely a transient network issue or the Google Sheet export is unavailable.\n` +
      (result.psuTierEntries.length > 0
        ? `The PSU tier list fetch succeeded independently (${result.psuTierEntries.length} entries), but the main catalog did not.\n`
        : "") +
      `Existing .data/intake-snapshot.json and .data/intake-seed.sql were NOT overwritten.\n` +
      `Check the warnings below and re-run once the upstream issue is resolved.`,
    );
    if (result.warnings.length) {
      console.error(`Warnings from the fetch:`);
      for (const warning of result.warnings) console.error(`  - ${warning}`);
    }
    process.exit(1);
  }

  // Load existing overrides if present so regenerated SQL uses them
  const overrides = await loadOverrides();
  const sql = buildSeedSql(result, overrides);

  await writeAtomic(snapshotPath, JSON.stringify(result, null, 2));
  await writeAtomic(sqlPath, sql);

  console.log(
    `Fetched ${result.parts.length} generic parts, ${result.cases.length} cases, ${result.gpus.length} GPUs, ${result.psuTierEntries.length} PSU tier entries${overrides.length ? `, loaded ${overrides.length} tier override(s)` : ""}.`,
  );
  if (result.warnings.length) {
    console.warn(`Completed with ${result.warnings.length} warning(s):`);
    for (const warning of result.warnings) console.warn(`- ${warning}`);
  }
  console.log(`Wrote ${snapshotPath}`);
  console.log(`Wrote ${sqlPath}`);
}
