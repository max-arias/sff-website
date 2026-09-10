# Client-Side Database Selection (2026-09-10)

Decision note. Supersedes the "no DB needed" verdict in
`browser-resident-catalog-feasibility-20260910.md`: the user chose a real
browser-resident database for the client-side catalog. Stack direction is
SolidJS + TanStack Table; this note selects the database layer.

## Candidates surveyed (primary sources)

| Candidate | What it is | Verdict for this project |
|---|---|---|
| **@sqlite.org/sqlite-wasm** | Official SQLite WASM as an ESM npm package. Apache-2.0, ~463K weekly downloads, maintained by the SQLite WASM maintainer (sgbeal) with no changes to upstream SQLite beyond TS types. | **Selected.** Only candidate that is upstream SQLite itself: FTS5 is in the canonical build, `opfs-sahpool` VFS needs no COOP/COEP, `importDb()` streams a downloaded DB into OPFS. Ships Vite/webpack/rsbuild/parcel sahpool demos + bundler-compatibility tests. |
| wa-sqlite (rhashimoto) | WASM SQLite with JS-implemented VFS layer; multiple backends (IndexedDB, OPFS variants), sync + Asyncify/JSPI builds. MIT, 1.4k stars. | Strong runner-up. More VFS options and true multi-connection OPFS, but the API is a lower-level C wrapper, and **FTS5 in their prebuilt dist is not documented** — needs verification. Choose only if we need a VFS sahpool can't provide. |
| sql.js-httpvfs (phiresky) | Read-only SQLite over HTTP Range requests against a statically hosted .sqlite3 file; downloads only touched pages. | Wrong scale fit. Designed for huge immutable datasets; a ~5–10 MB catalog is cheaper to download once. Also effectively low-maintenance, with a reported Cloudflare-hosting `HEAD`/`Content-Length` issue. |
| absurd-sql | IndexedDB-as-disk persistence for sql.js. | Legacy. Effectively unmaintained; sql.js core is in-memory only. |
| sql.js | SQLite WASM, in-memory, no persistence. | Non-starter: all data lost on reload. |
| RxDB / PouchDB / Dexie / LokiJS | Document/replication-oriented client DBs. | Wrong model. We need immutable relational data + SQL filtering + FTS trigram substring search, no writes, no sync, no conflict handling. RxDB additionally gates features behind paid plugins. |
| cr-sqlite (vlcn) | CRDT SQLite for multi-writer sync. | Writes/sync we don't have. |

## Decision

**@sqlite.org/sqlite-wasm, `opfs-sahpool` VFS, in one dedicated Web Worker.**

Key technical points, all verified against primary docs:

- Use `OpfsSAHPoolDb`, not the plain `opfs` VFS. Sahpool (SQLite 3.43+) needs
  **no COOP/COEP headers**, works on Chrome 102+/Firefox 111+/Safari 15.2+,
  and is the fastest OPFS backend. (The COOP/COEP warning in the npm README
  applies only to the plain `opfs` VFS.)
- Sahpool is **single-connection**: one Web Worker owns the database. Multi-tab
  coexistence via Web Locks leader election (the non-leader tabs wait or open
  read-only); acceptable for a build tool.
- FTS5 ships in the canonical build (maintainer statement on the SQLite forum;
  build is `--enable-all`). The **trigram tokenizer** gives indexed arbitrary
  substring matching — same semantics as today's D1 FTS autocomplete.
- `importDb(name, asyncFn)` (SQLite 3.44+) streams chunks from an async
  callback into an OPFS database file — purpose-built for "download artifact,
  write into OPFS".
- Decompress with `DecompressionStream('gzip')`: gzip is implemented
  everywhere; **brotli is NOT implemented in Chrome's DecompressionStream**.
  So the artifact ships as `.gz`, decompressed in the worker before import.

## Architecture

```mermaid
flowchart TB
  subgraph Main["Main thread (SolidJS island)"]
    UI[Table + filters + slots render\n@tanstack/solid-table, manual mode]
    Res[createResource → typed RPC]
    Engine[fitment: src/fitment/engine.ts\nunchanged, pure TS]
  end
  subgraph Worker["Catalog Worker (owns OPFS)"]
    RPC[typed postMessage RPC ~60 lines]
    Sqlite[sqlite-wasm OO1 API\nopfs-sahpool, read-only]
    Import[importDb + DecompressionStream gzip]
  end
  CI[CI: replay intake-seed.sql into sqlite file\n+ FTS5 trigram catalog_search (migration 0008 DDL)\nVACUUM → gzip → dist/client/catalog/] --> Assets[Workers static asset:\ncatalog-<version>.sqlite3.gz, immutable]
  Assets --> Import --> Sqlite
  RPC --> Sqlite
  Res -->|page rows + total| UI
  UI -->|URL state → WHERE/ORDER BY/LIMIT/OFFSET| Res
```

### Reuse this repo already has

- `buildCatalogSearchStatement` (`src/server/catalog-search-query.ts`) — the
  exact FTS5 MATCH SQL, extracted earlier for the D1 budget tests. Running the
  identical statement client-side **guarantees autocomplete parity** and keeps
  `EXPLAIN QUERY PLAN` verifiable.
- `decodeCatalogRow` + `SELECT * FROM <kind>` (`src/server/d1-decoders.ts`) —
  pure TS row decoders work unchanged on worker query results.
- `.data/intake-seed.sql` — the intake pipeline already emits full INSERT
  statements; the artifact build replays them into a fresh SQLite file and
  adds the FTS5 DDL from `migrations/0008_catalog_search_fts.sql`.
- `src/fitment/engine.ts`, `src/lib/build-state.ts` — run in the island as-is.

### Update & lifecycle model

- Versioned OPFS filenames (`catalog-v<N>.sqlite3`). Boot: read tiny
  `manifest.json` (no-cache); if version differs, stream-import the new file,
  verify by opening + `PRAGMA user_version`, flip the active pointer, delete
  the superseded file. No partial states: a file only becomes active after a
  successful open.
- Eviction (Safari 7-day rule, storage pressure): manifest says version X, no
  local file → re-import ~2 MB. `navigator.storage.persist()` after first
  meaningful interaction reduces frequency.
- Quota failure (`QuotaExceededError` on import): fall back to in-memory DB
  from the same artifact bytes; show "catalog not persisted" notice.

### TanStack Table integration

`@tanstack/solid-table` in **manual pagination + manual sorting** mode: URL
state (search, filters, sort, page) is translated to
`WHERE … ORDER BY … LIMIT/OFFSET` SQL; the worker returns one page of decoded
`PartRecord`s plus `COUNT(*)` for pagination math. TanStack manages columns,
sort state, and row model; Solid `createResource` suspends per query. The
fitment engine evaluates the returned page; verdict highlighting stays client
TS as today.

## Risks

1. **Trigram index size** — [INFERENCE] the FTS5 trigram index will inflate
   the artifact beyond raw text size; measure with `sqlite3_analyzer` before
   committing to a single-file artifact (fallback: per-kind DBs, or FTS5
   prefix index + `LIKE` for substring).
2. **Vite/worker bundling friction** — the official package documents a Vite
   config (`optimizeDeps.exclude`) and ships sahpool Vite demos; expect some
   wiring for the worker + wasm asset, not zero.
3. **Multi-tab locking** — sahpool single-connection; Web Locks election is
   the mitigation.
4. **First-load weight** — one-time ~2–4 MB gzip import (measure artifact).

## Sources

- https://github.com/sqlite/sqlite-wasm (official npm wrapper; Vite config, sahpool demos)
- https://www.npmjs.com/package/@sqlite.org/sqlite-wasm (463K weekly downloads, Apache-2.0)
- https://sqlite.org/wasm/doc/trunk/persistence.md (sahpool vs opfs VFS, COOP/COEP, importDb, locking)
- https://sqlite.org/wasm/doc/trunk/api-oo1.md (OO1 API used by the worker)
- https://www.sqlite.org/fts5.html (trigram tokenizer, substring matching)
- https://github.com/rhashimoto/wa-sqlite (runner-up; VFS comparison, MIT)
- https://github.com/phiresky/sql.js-httpvfs (range-request static SQLite)
- https://rxdb.info/alternatives.html (landscape: sql.js no persistence, absurd-sql legacy, Dexie/PouchDB document-model)
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria (quotas, eviction, Safari 7-day via webkit.org/blog/10218/)
