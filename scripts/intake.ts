import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchAndNormalizeAll } from "../app/lib/sheets";
import { buildSeedSql } from "../app/lib/sql";

const snapshotPath = resolve(".data/intake-snapshot.json");
const sqlPath = resolve(".data/intake-seed.sql");

async function writeText(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

const result = await fetchAndNormalizeAll();
const sql = buildSeedSql(result);

await writeText(snapshotPath, JSON.stringify(result, null, 2));
await writeText(sqlPath, sql);

console.log(`Fetched ${result.parts.length} generic parts, ${result.cases.length} cases, and ${result.gpus.length} GPUs.`);
if (result.warnings.length) {
  console.warn(`Completed with ${result.warnings.length} warning(s):`);
  for (const warning of result.warnings) console.warn(`- ${warning}`);
}
console.log(`Wrote ${snapshotPath}`);
console.log(`Wrote ${sqlPath}`);
