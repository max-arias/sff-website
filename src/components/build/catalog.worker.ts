import sqlite3InitModule, { type Database, type SqlValue } from "@sqlite.org/sqlite-wasm";
import { getBuildView, type BuildView } from "../../lib/build-view";
import {
  buildCatalogSearchStatement,
  CATALOG_SEARCH_READ_BUDGET
} from "../../lib/catalog-search-query";
import type { CatalogSearchSuggestion, CatalogStore } from "../../lib/catalog-store";
import { normalizeSearchText } from "../../lib/search-normalization";
import type { CasePart, GenericPart, GpuPart } from "../../types";

const manifestUrl = "/catalog/catalog.manifest.json";
const cacheName = "sff-catalog-artifact";

type CatalogManifest = {
  artifact: string;
  bytes: number;
  rows: number;
  sha256: string;
  version: string;
};

type DatabaseStatus = {
  artifactBytes: number;
  downloaded: boolean;
  rows: number;
  sqliteVersion: string;
  version: string;
};

type CatalogPart = CasePart | GenericPart | GpuPart;
type StoredPart = { part_json: string };
type SearchRow = {
  display_name: string;
  id: string;
  kind: string;
  normalized_search_text: string;
};

type ClientMessage =
  | { base: string; requestId: number; type: "status" }
  | { base: string; href: string; requestId: number; type: "view" };

type WorkerMessage =
  | { requestId: number; status: DatabaseStatus; type: "status" }
  | { requestId: number; status: DatabaseStatus; type: "view"; view: BuildView }
  | { message: string; requestId: number; type: "error" };

let database: Database | undefined;
let initialization: Promise<DatabaseStatus> | undefined;
let baseUrl: string | undefined;

function post(message: WorkerMessage) {
  self.postMessage(message);
}

/**
 * The worker has no `self.location` in every host (the Vite dev runtime omits
 * it), and workerd rejects relative URLs outright, so artifact requests must be
 * resolved against a base the client supplies.
 */
function absoluteUrl(path: string): string {
  if (!baseUrl) throw new Error("Catalog base URL is not set.");
  return new URL(path, baseUrl).href;
}

function requireDatabase(): Database {
  if (!database) throw new Error("Catalog database is not initialized.");
  return database;
}

async function fetchManifest(): Promise<CatalogManifest> {
  const response = await fetch(absoluteUrl(manifestUrl), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Catalog manifest request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<CatalogManifest>;
}

/**
 * Reads the compressed artifact from the Cache API, falling back to the network.
 * The Cache API is shared safely by every tab, unlike an OPFS SAH pool, which
 * permits only one open access handle per directory at a time.
 */
async function loadArtifact(manifest: CatalogManifest): Promise<{ bytes: ArrayBuffer; downloaded: boolean }> {
  const cached = await readCachedArtifact(manifest);
  if (cached) return { bytes: cached, downloaded: false };

  const response = await fetch(absoluteUrl(manifest.artifact), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Catalog artifact request failed: ${response.status} ${response.statusText}`);
  }
  const bytes = await response.arrayBuffer();
  await writeCachedArtifact(manifest, bytes);
  return { bytes, downloaded: true };
}

async function readCachedArtifact(manifest: CatalogManifest): Promise<ArrayBuffer | undefined> {
  try {
    const cache = await caches.open(cacheName);
    const response = await cache.match(artifactCacheKey(manifest));
    return response ? await response.arrayBuffer() : undefined;
  } catch {
    return undefined;
  }
}

async function writeCachedArtifact(manifest: CatalogManifest, bytes: ArrayBuffer): Promise<void> {
  try {
    const cache = await caches.open(cacheName);
    // One artifact per catalog version: drop superseded entries so the browser
    // never accumulates stale multi-megabyte copies.
    for (const request of await cache.keys()) {
      if (request.url !== artifactCacheKey(manifest)) await cache.delete(request);
    }
    await cache.put(artifactCacheKey(manifest), new Response(bytes));
  } catch {
    // Storage unavailable (private mode, quota): the network path still works.
  }
}

function artifactCacheKey(manifest: CatalogManifest): string {
  return `${absoluteUrl(manifest.artifact)}?v=${manifest.version}`;
}

async function decompressArtifact(bytes: ArrayBuffer): Promise<Uint8Array> {
  // Hosts differ on who decodes the gzip stream. The Workers asset layer hands
  // over the raw gzip bytes, but the Vite dev server serves `.gz` with
  // `Content-Encoding: gzip`, so the browser has already decoded it by the time
  // we see it. Sniff the gzip magic instead of assuming either behaviour.
  const head = new Uint8Array(bytes, 0, 2);
  if (head[0] !== 0x1f || head[1] !== 0x8b) return new Uint8Array(bytes);

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readParts(sql: string, values: Array<string | number> = []): CatalogPart[] {
  const rows = requireDatabase().selectObjects(sql, values) as StoredPart[];
  return rows.map((row) => JSON.parse(row.part_json) as CatalogPart);
}

function readPartsByIds(ids: string[]): CatalogPart[] {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return [];
  return readParts(
    `select part_json from catalog_records where id in (${uniqueIds.map(() => "?").join(", ")})`,
    uniqueIds
  );
}

function isGenericPart(part: CatalogPart | undefined): part is GenericPart {
  if (!part) return false;
  return part.kind !== "case" && part.kind !== "gpu";
}

function isCasePart(part: CatalogPart | undefined): part is CasePart {
  if (!part) return false;
  return part.kind === "case";
}

function isGpuPart(part: CatalogPart | undefined): part is GpuPart {
  if (!part) return false;
  return part.kind === "gpu";
}

const browserCatalogStore: CatalogStore = {
  async loadParts() {
    const parts = readParts(
      "select part_json from catalog_records where kind in ('case', 'gpu') order by id"
    );
    return {
      cases: parts.filter((part): part is CasePart => part.kind === "case"),
      gpus: parts.filter((part): part is GpuPart => part.kind === "gpu")
    };
  },

  async loadPartsByIds(ids) {
    return readPartsByIds(ids) as unknown as GenericPart[];
  },

  async loadKindCatalog(kind, search) {
    const normalized = normalizeSearchText(search ?? "");
    if (normalized.length < 3) {
      return readParts(
        "select part_json from catalog_records where kind = ? order by id",
        [kind]
      ).filter(isGenericPart);
    }

    const statement = buildCatalogSearchStatement(normalized, kind, CATALOG_SEARCH_READ_BUDGET);
    const rows = requireDatabase().selectObjects(statement.sql, statement.values) as SearchRow[];
    const partsById = new Map(readPartsByIds(rows.map((row) => row.id)).map((part) => [part.id, part]));
    return rows
      .map((row) => partsById.get(row.id))
      .filter(isGenericPart);
  },

  async searchSuggestions(query, kind, limit = CATALOG_SEARCH_READ_BUDGET) {
    const normalized = normalizeSearchText(query);
    if (normalized.length < 3) return [];

    const statement = buildCatalogSearchStatement(
      normalized,
      kind,
      Math.min(limit, CATALOG_SEARCH_READ_BUDGET)
    );
    const rows = requireDatabase().selectObjects(statement.sql, statement.values) as SearchRow[];
    return rows.map(
      (row): CatalogSearchSuggestion => ({
        id: row.id,
        kind: row.kind,
        displayName: row.display_name,
        sourceSheet: "",
        rowNumber: 0,
        score: 0,
        match: row.normalized_search_text
      })
    );
  },

  async findCaseAndGpu(caseId, gpuId) {
    const partsById = new Map(readPartsByIds([caseId, gpuId]).map((part) => [part.id, part]));
    const casePart = partsById.get(caseId);
    const gpuPart = partsById.get(gpuId);
    return {
      casePart: isCasePart(casePart) ? casePart : null,
      gpuPart: isGpuPart(gpuPart) ? gpuPart : null
    };
  }
};

async function openDatabase(): Promise<DatabaseStatus> {
  database?.close();
  database = undefined;

  const sqlite3 = await sqlite3InitModule();
  const manifest = await fetchManifest();
  const { bytes, downloaded } = await loadArtifact(manifest);
  const sql = await decompressArtifact(bytes);

  const connection = new sqlite3.oo1.DB(":memory:");
  const pointer = connection.pointer;
  if (pointer === undefined) {
    connection.close();
    throw new Error("Catalog database handle could not be opened.");
  }
  const deserialize = sqlite3.capi.sqlite3_deserialize(
    pointer,
    "main",
    sqlite3.wasm.allocFromTypedArray(sql),
    sql.byteLength,
    sql.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
  );
  if (deserialize !== sqlite3.capi.SQLITE_OK) {
    connection.close();
    throw new Error(
      `Catalog artifact could not be opened (${sqlite3.capi.sqlite3_js_rc_str(deserialize)}).`
    );
  }

  connection.exec("pragma query_only = on; pragma temp_store = memory");
  database = connection;
  const rows = database.selectValue("select count(*) from catalog_records") as SqlValue;
  if (typeof rows !== "number") {
    throw new Error("Catalog artifact did not return a numeric row count.");
  }

  return {
    artifactBytes: bytes.byteLength,
    downloaded,
    rows,
    sqliteVersion: sqlite3.version.libVersion,
    version: manifest.version
  };
}

function initialize() {
  initialization ??= openDatabase();
  return initialization;
}

self.onmessage = async (event: MessageEvent<ClientMessage>) => {
  const message = event.data;
  try {
    baseUrl = message.base;
    const status = await initialize();
    if (message.type === "status") {
      post({ requestId: message.requestId, status, type: "status" });
      return;
    }

    post({
      requestId: message.requestId,
      status,
      type: "view",
      view: await getBuildView(new URL(message.href), browserCatalogStore)
    });
  } catch (error) {
    initialization = undefined;
    post({
      requestId: message.requestId,
      type: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
};
