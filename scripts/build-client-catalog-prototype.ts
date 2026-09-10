import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";

// PROTOTYPE: creates a minimal browser-search database from the local D1 FTS corpus.
const outputPath = resolve("public/prototype/catalog-search.sqlite3");
const manifestPath = resolve("public/prototype/catalog-search.manifest.json");
const run = promisify(execFile);

type CatalogSearchRow = {
  id: string;
  kind: string;
  display_name: string;
  normalized_search_text: string;
};

type WranglerResult = {
  results: CatalogSearchRow[];
  success: boolean;
};

async function readLocalSearchRows(): Promise<CatalogSearchRow[]> {
  const { stdout } = await run(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "sff-builder",
      "--local",
      "--json",
      "--command",
      "select id, kind, display_name, normalized_search_text from catalog_search"
    ],
    { cwd: process.cwd(), maxBuffer: 32 * 1024 * 1024 }
  );
  const [result] = JSON.parse(stdout) as WranglerResult[];

  if (!result?.success || !Array.isArray(result.results)) {
    throw new Error("Local D1 did not return the catalog_search corpus.");
  }

  return result.results;
}

async function main() {
  const rows = await readLocalSearchRows();
  await mkdir(dirname(outputPath), { recursive: true });
  await rm(outputPath, { force: true });

  const database = new DatabaseSync(outputPath);
  try {
    database.exec(`
      pragma page_size = 4096;
      pragma journal_mode = delete;
      create virtual table catalog_search using fts5(
        id unindexed,
        kind unindexed,
        display_name,
        normalized_search_text,
        tokenize = 'trigram'
      );
    `);

    const insert = database.prepare(
      "insert into catalog_search (id, kind, display_name, normalized_search_text) values (?, ?, ?, ?)"
    );
    database.exec("begin");
    for (const row of rows) {
      insert.run(row.id, row.kind, row.display_name, row.normalized_search_text);
    }
    database.exec("commit; pragma optimize; vacuum");

    const artifactCount = database.prepare("select count(*) as count from catalog_search").get() as {
      count: number;
    };
    if (artifactCount.count !== rows.length) {
      throw new Error(`Artifact has ${artifactCount.count} rows; expected ${rows.length}.`);
    }
  } finally {
    database.close();
  }

  const artifact = await readFile(outputPath);
  const manifest = {
    // PROTOTYPE: source and browser state are intentionally isolated from production catalog delivery.
    artifact: "/prototype/catalog-search.sqlite3",
    bytes: artifact.byteLength,
    rows: rows.length,
    sha256: createHash("sha256").update(artifact).digest("hex")
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `Built ${manifest.artifact}: ${manifest.rows} FTS rows, ${manifest.bytes} bytes, sha256 ${manifest.sha256}`
  );
}

await main();
