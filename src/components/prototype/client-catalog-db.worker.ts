import sqlite3InitModule, {
  type Database,
  type SAHPoolUtil,
  type SqlValue
} from "@sqlite.org/sqlite-wasm";
import { normalizeSearchText } from "../../lib/search-normalization";
import {
  buildCatalogSearchStatement,
  CATALOG_SEARCH_READ_BUDGET
} from "../../server/catalog-search-query";

// PROTOTYPE: validates a D1-free search path against a browser-persistent SQLite artifact.
const artifactUrl = "/prototype/catalog-search.sqlite3";
const databaseFilename = "/catalog-search.sqlite3";
const poolDirectory = "/sff-builder-client-catalog-prototype";
const poolName = "sff-client-catalog-prototype";

type SearchRow = {
  id: string;
  kind: string;
  display_name: string;
  normalized_search_text: string;
};

type DatabaseStatus = {
  artifactBytes: number;
  imported: boolean;
  rows: number;
  sqliteVersion: string;
  storage: "opfs-sahpool";
};

type ClientMessage =
  | { requestId: number; type: "initialize" }
  | { requestId: number; type: "refresh" }
  | { requestId: number; type: "search"; query: string };

type WorkerMessage =
  | { requestId: number; type: "ready"; status: DatabaseStatus }
  | { requestId: number; type: "results"; query: string; rows: SearchRow[] }
  | { requestId: number; type: "error"; message: string };

let database: Database | undefined;
let pool: SAHPoolUtil | undefined;
let initialization: Promise<DatabaseStatus> | undefined;

function post(message: WorkerMessage) {
  self.postMessage(message);
}

async function fetchArtifact(): Promise<Uint8Array> {
  const response = await fetch(artifactUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Catalog artifact request failed: ${response.status} ${response.statusText}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function openDatabase(refresh: boolean): Promise<DatabaseStatus> {
  if (database) {
    database.close();
    database = undefined;
  }

  const sqlite3 = await sqlite3InitModule();
  pool ??= await sqlite3.installOpfsSAHPoolVfs({
    directory: poolDirectory,
    initialCapacity: 3,
    name: poolName
  });

  const hasStoredArtifact = pool.getFileNames().includes(databaseFilename);
  let artifactBytes = 0;
  const imported = refresh || !hasStoredArtifact;
  if (imported) {
    if (hasStoredArtifact) pool.unlink(databaseFilename);
    const artifact = await fetchArtifact();
    artifactBytes = await pool.importDb(databaseFilename, artifact);
  }

  database = new pool.OpfsSAHPoolDb(databaseFilename);
  database.exec("pragma query_only = on; pragma temp_store = memory");
  const row = database.selectValue("select count(*) from catalog_search") as SqlValue;
  if (typeof row !== "number") {
    throw new Error("Catalog artifact did not return a numeric row count.");
  }

  return {
    artifactBytes,
    imported,
    rows: row,
    sqliteVersion: sqlite3.version.libVersion,
    storage: "opfs-sahpool"
  };
}

async function initialize(refresh = false): Promise<DatabaseStatus> {
  if (refresh || !initialization) {
    initialization = openDatabase(refresh);
  }

  return initialization;
}

async function search(query: string): Promise<SearchRow[]> {
  const normalized = normalizeSearchText(query);
  if (normalized.length < 3) {
    throw new Error("Search needs at least three normalized characters.");
  }

  await initialize();
  if (!database) throw new Error("Catalog database is not initialized.");

  const statement = buildCatalogSearchStatement(normalized, undefined, CATALOG_SEARCH_READ_BUDGET);
  return database.selectObjects(statement.sql, statement.values) as SearchRow[];
}

self.onmessage = async (event: MessageEvent<ClientMessage>) => {
  const message = event.data;

  try {
    if (message.type === "initialize") {
      post({ requestId: message.requestId, type: "ready", status: await initialize() });
      return;
    }

    if (message.type === "refresh") {
      post({ requestId: message.requestId, type: "ready", status: await initialize(true) });
      return;
    }

    post({
      requestId: message.requestId,
      type: "results",
      query: normalizeSearchText(message.query),
      rows: await search(message.query)
    });
  } catch (error) {
    post({
      requestId: message.requestId,
      type: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
};
