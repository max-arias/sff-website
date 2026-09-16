import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { decodeCatalogRow, type D1Row } from "../src/server/d1-decoders";
import type { PartKind } from "../src/types";

const databasePath = resolve("public/catalog/catalog.sqlite3");
const artifactPath = resolve("public/catalog/catalog.sqlite3.gz");
const manifestPath = resolve("public/catalog/catalog.manifest.json");
const run = promisify(execFile);
const databaseName = process.env.CATALOG_DATABASE ?? "sff-builder";
const remoteRequested = process.argv.includes("--remote");

type CatalogSource = "local" | "remote";

const catalogTables: ReadonlyArray<readonly [string, PartKind]> = [
  ["cases", "case"],
  ["gpus", "gpu"],
  ["cpu_coolers", "cpu-cooler"],
  ["fans", "fan"],
  ["motherboards", "motherboard"],
  ["psus", "psu"],
  ["ram", "ram"]
];

type WranglerResult<T> = {
  results: T[];
  success: boolean;
};

type SearchRow = {
  id: string;
  kind: string;
  display_name: string;
  normalized_search_text: string;
};

async function queryCatalogSource<T>(command: string, source: CatalogSource): Promise<T[]> {
  let stdout: string;
  try {
    ({ stdout } = await run(
      "npx",
      [
        "wrangler",
        "d1",
        "execute",
        databaseName,
        source === "remote" ? "--remote" : "--local",
        "--json",
        "--command",
        command
      ],
      { cwd: process.cwd(), maxBuffer: 64 * 1024 * 1024 }
    ));
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    const detail = failure.stdout?.trim() || failure.stderr?.trim() || String(error);
    throw new Error(
      `Catalog source query failed against ${source} D1 "${databaseName}": ${detail}\n` +
        (source === "local"
          ? `Provision local D1 first: npm run db:migrate:local && npm run db:seed:local`
          : `Check that CLOUDFLARE_API_TOKEN can read D1 database "${databaseName}".`)
    );
  }

  let parsed: WranglerResult<T>[];
  try {
    parsed = JSON.parse(stdout) as WranglerResult<T>[];
  } catch {
    throw new Error(
      `Catalog source query returned unparseable output against ${source} D1: ${stdout.slice(0, 400)}`
    );
  }

  const [result] = parsed;
  if (!result?.success || !Array.isArray(result.results)) {
    throw new Error(`Catalog source query failed against ${source} D1: ${command}`);
  }
  return result.results;
}

const catalogRowCountProbe =
  "select (select count(*) from cases) + (select count(*) from gpus) + " +
  "(select count(*) from cpu_coolers) + (select count(*) from fans) + " +
  "(select count(*) from motherboards) + (select count(*) from psus) + " +
  "(select count(*) from ram) as count";

/**
 * Local D1 is only usable after `db:migrate:local` and `db:seed:local`. A clean
 * checkout (CI) has neither, so fall back to remote D1 rather than failing the
 * build. The resolved source is always printed.
 */
async function resolveCatalogSource(): Promise<CatalogSource> {
  if (remoteRequested) return "remote";

  try {
    const [row] = await queryCatalogSource<{ count: number }>(catalogRowCountProbe, "local");
    if (row && row.count > 0) return "local";
    console.warn(
      `Local D1 "${databaseName}" has the catalog schema but no rows; building from remote D1.`
    );
  } catch {
    console.warn(`Local D1 "${databaseName}" is not provisioned; building from remote D1.`);
    console.warn("  For a local build run: npm run db:migrate:local && npm run db:seed:local");
  }
  return "remote";
}

async function main() {
  await mkdir(dirname(databasePath), { recursive: true });
  await rm(databasePath, { force: true });

  const source = await resolveCatalogSource();
  const database = new DatabaseSync(databasePath);
  const counts: Record<string, number> = {};
  const sourceHash = createHash("sha256");
  let version = "";
  try {
    database.exec(`
      pragma page_size = 4096;
      pragma journal_mode = delete;
      create table catalog_records (
        id text primary key,
        kind text not null,
        part_json text not null
      ) without rowid;
      create index catalog_records_kind on catalog_records(kind);
      create table catalog_metadata (
        key text primary key,
        value text not null
      ) without rowid;
      create virtual table catalog_search using fts5(
        id unindexed,
        kind unindexed,
        display_name,
        normalized_search_text,
        tokenize = 'trigram'
      );
    `);

    const insertRecord = database.prepare(
      "insert into catalog_records (id, kind, part_json) values (?, ?, ?)"
    );
    database.exec("begin");
    for (const [table, kind] of catalogTables) {
      const rows = await queryCatalogSource<D1Row>(`select * from ${table}`, source);
      counts[kind] = rows.length;
      for (const row of rows) {
        const part = decodeCatalogRow(row, kind);
        const partJson = JSON.stringify(part);
        sourceHash.update(part.id).update("\0").update(partJson).update("\0");
        insertRecord.run(part.id, kind, partJson);
      }
    }

    const searchRows = await queryCatalogSource<SearchRow>(
      "select id, kind, display_name, normalized_search_text from catalog_search",
      source
    );
    const insertSearch = database.prepare(
      "insert into catalog_search (id, kind, display_name, normalized_search_text) values (?, ?, ?, ?)"
    );
    for (const row of searchRows) {
      sourceHash
        .update(row.id)
        .update("\0")
        .update(row.kind)
        .update("\0")
        .update(row.display_name)
        .update("\0")
        .update(row.normalized_search_text)
        .update("\0");
      insertSearch.run(row.id, row.kind, row.display_name, row.normalized_search_text);
    }
    version = sourceHash.digest("hex");
    database
      .prepare("insert into catalog_metadata (key, value) values ('version', ?)")
      .run(version);
    database.exec("commit; pragma optimize; vacuum");

    const recordCount = database.prepare("select count(*) as count from catalog_records").get() as {
      count: number;
    };
    const expectedRecordCount = Object.values(counts).reduce((total, count) => total + count, 0);
    if (recordCount.count !== expectedRecordCount || searchRows.length !== expectedRecordCount) {
      throw new Error(
        `Artifact count mismatch: ${recordCount.count} records, ${searchRows.length} search rows, expected ${expectedRecordCount}.`
      );
    }
  } finally {
    database.close();
  }

  const sqliteBytes = await readFile(databasePath);
  await rm(databasePath, { force: true });
  const artifact = gzipSync(sqliteBytes, { level: 9 });
  await writeFile(artifactPath, artifact);

  const manifest = {
    artifact: "/catalog/catalog.sqlite3.gz",
    version,
    bytes: artifact.byteLength,
    uncompressedBytes: sqliteBytes.byteLength,
    byKind: counts,
    rows: Object.values(counts).reduce((total, count) => total + count, 0),
    sha256: createHash("sha256").update(artifact).digest("hex")
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Built ${manifest.artifact} from ${source} D1: ${manifest.rows} records, ${manifest.bytes} bytes gzip (${manifest.uncompressedBytes} bytes raw), sha256 ${manifest.sha256}`
  );
}

try {
  await main();
} catch (error) {
  // Never leave a partial working database beside a previously built artifact.
  await rm(databasePath, { force: true });
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
