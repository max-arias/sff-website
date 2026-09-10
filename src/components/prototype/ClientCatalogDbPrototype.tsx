import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { createTable, flexRender, createCoreRowModel, type ColumnDef, type TableFeatures } from "@tanstack/solid-table";

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

type WorkerReply =
  | { requestId: number; type: "ready"; status: DatabaseStatus }
  | { requestId: number; type: "results"; query: string; rows: SearchRow[] }
  | { requestId: number; type: "error"; message: string };

type WorkerRequestBody =
  | { type: "initialize" }
  | { type: "refresh" }
  | { type: "search"; query: string };

const columns = [
  { accessorKey: "display_name", header: "Model" },
  { accessorKey: "kind", header: "Kind" },
  { accessorKey: "id", header: "Catalog ID" },
  { accessorKey: "normalized_search_text", header: "Search key" }
] satisfies ColumnDef<TableFeatures, SearchRow>[];

export default function ClientCatalogDbPrototype() {
  const [databaseStatus, setDatabaseStatus] = createSignal<DatabaseStatus>();
  const [error, setError] = createSignal<string>();
  const [loading, setLoading] = createSignal(true);
  const [query, setQuery] = createSignal("rtx");
  const [normalizedQuery, setNormalizedQuery] = createSignal("");
  const [rows, setRows] = createSignal<SearchRow[]>([]);
  let worker: Worker | undefined;
  let nextRequestId = 1;
  const pending = new Map<number, { resolve: (reply: WorkerReply) => void; reject: (error: Error) => void }>();

  const table = createTable({
    get data() {
      return rows();
    },
    columns,
    features: {
      coreRowModel: createCoreRowModel()
    }
  });

  function request(message: WorkerRequestBody): Promise<WorkerReply> {
    if (!worker) return Promise.reject(new Error("Search worker is not available."));

    const requestId = nextRequestId++;
    const { promise, resolve, reject } = Promise.withResolvers<WorkerReply>();
    pending.set(requestId, { resolve, reject });
    worker.postMessage({ ...message, requestId });
    return promise;
  }

  async function runSearch() {
    setError(undefined);
    setLoading(true);
    try {
      const reply = await request({ type: "search", query: query() });
      if (reply.type !== "results") throw new Error(reply.type === "error" ? reply.message : "Unexpected worker reply.");
      setNormalizedQuery(reply.query);
      setRows(reply.rows);
    } catch (searchError) {
      setRows([]);
      setError(searchError instanceof Error ? searchError.message : String(searchError));
    } finally {
      setLoading(false);
    }
  }

  async function refreshDatabase() {
    setError(undefined);
    setLoading(true);
    try {
      const reply = await request({ type: "refresh" });
      if (reply.type !== "ready") throw new Error(reply.type === "error" ? reply.message : "Unexpected worker reply.");
      setDatabaseStatus(reply.status);
      await runSearch();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
      setLoading(false);
    }
  }

  onMount(async () => {
    worker = new Worker(new URL("./client-catalog-db.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      const resolver = pending.get(reply.requestId);
      if (!resolver) return;
      pending.delete(reply.requestId);
      if (reply.type === "error") resolver.reject(new Error(reply.message));
      else resolver.resolve(reply);
    };
    worker.onerror = (event) => {
      const message = event.message || "Catalog search worker failed.";
      for (const resolver of pending.values()) resolver.reject(new Error(message));
      pending.clear();
    };

    try {
      const reply = await request({ type: "initialize" });
      if (reply.type !== "ready") throw new Error(reply.type === "error" ? reply.message : "Unexpected worker reply.");
      setDatabaseStatus(reply.status);
      await runSearch();
    } catch (initializationError) {
      setError(initializationError instanceof Error ? initializationError.message : String(initializationError));
      setLoading(false);
    }
  });

  onCleanup(() => worker?.terminate());

  return (
    <main class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="font-mono text-xs font-bold uppercase tracking-[0.14em] text-primary">Prototype · client catalog</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">SQLite FTS search without D1</h1>
          <p class="mt-3 max-w-2xl text-base-content/70">
            The browser imports a generated catalog FTS artifact into OPFS, then executes the same bounded search statement used by the D1 path.
          </p>
        </div>
        <button class="btn btn-outline btn-sm" type="button" disabled={loading()} onClick={refreshDatabase}>
          Refresh artifact
        </button>
      </div>

      <div role="alert" class="alert alert-warning mb-6 sm:alert-horizontal">
        <span>Single-tab prototype. SQLite&apos;s OPFS SAH pool deliberately rejects concurrent tabs on this origin.</span>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div class="card card-border bg-base-200">
          <div class="card-body gap-2 p-5">
            <h2 class="card-title text-base">Database state</h2>
            <Show when={databaseStatus()} fallback={<span class="loading loading-spinner loading-sm" aria-label="Initializing database" />}>
              {(status) => <>
                <span class="badge badge-success badge-soft">{status().storage}</span>
                <p class="font-mono text-sm">SQLite {status().sqliteVersion}</p>
                <p class="text-sm text-base-content/70">{status().rows.toLocaleString()} catalog-search rows</p>
              </>}
            </Show>
          </div>
        </div>
        <div class="card card-border bg-base-200 md:col-span-2">
          <div class="card-body p-5">
            <h2 class="card-title text-base">Relevant state</h2>
            <pre class="overflow-x-auto rounded-field bg-base-300 p-3 text-xs leading-5 text-base-content">{JSON.stringify({
              phase: loading() ? "working" : error() ? "error" : "ready",
              artifact: "/prototype/catalog-search.sqlite3",
              normalizedQuery: normalizedQuery() || null,
              importedBytes: databaseStatus()?.artifactBytes ?? 0,
              resultCount: rows().length
            }, null, 2)}</pre>
          </div>
        </div>
      </div>

      <section class="card card-border mt-6 bg-base-100">
        <div class="card-body gap-5 p-5 sm:p-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 class="card-title">Catalog search</h2>
              <p class="text-sm text-base-content/70">At least three normalized characters. Maximum 100 rows.</p>
            </div>
            <span class="badge">{rows().length} results</span>
          </div>

          <form class="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}>
            <input
              class="input input-bordered w-full font-mono"
              type="search"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search models, e.g. rtx 4090"
              aria-label="Search local catalog"
            />
            <button class="btn" type="submit" disabled={loading()}>Search local SQLite</button>
          </form>

          <Show when={error()}>{(message) => <div role="alert" class="alert alert-error alert-soft"><span>{message()}</span></div>}</Show>

          <div class="overflow-x-auto">
            <table class="table table-zebra table-sm">
              <thead>
                <For each={table.getHeaderGroups()}>{(group) => <tr>
                  <For each={group.headers}>{(header) => <th>
                    <Show when={!header.isPlaceholder}>{flexRender(header.column.columnDef.header, header.getContext())}</Show>
                  </th>}</For>
                </tr>}</For>
              </thead>
              <tbody>
                <For each={table.getRowModel().rows}>{(row) => <tr>
                  <For each={row.getAllCells()}>{(cell) => <td class="font-mono text-xs">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>}</For>
                </tr>}</For>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
