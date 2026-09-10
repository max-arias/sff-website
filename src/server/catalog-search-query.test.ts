import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  buildCatalogSearchStatement,
  CATALOG_SEARCH_READ_BUDGET,
} from "./catalog-search-query";

const execFileAsync = promisify(execFile);

type D1Execution = {
  results: unknown[];
  meta: { rows_read: number };
};

function renderStatement(sql: string, values: Array<string | number>): string {
  let valueIndex = 0;
  const rendered = sql.replace(/\?/g, () => {
    const value = values[valueIndex++]!;
    return typeof value === "number"
      ? String(value)
      : `'${value.replaceAll("'", "''")}'`;
  });
  assert.equal(valueIndex, values.length, "all statement values are bound");
  return rendered;
}

async function executeRemote(statement: string): Promise<D1Execution> {
  const database = process.env.D1_BUDGET_DATABASE ?? "sff-builder";
  const { stdout } = await execFileAsync("npx", [
    "wrangler",
    "d1",
    "execute",
    database,
    "--remote",
    "--json",
    "--command",
    statement,
  ]);
  const [result] = JSON.parse(stdout) as D1Execution[];
  assert.ok(result, "D1 returned a result");
  assert.equal(
    typeof result.meta.rows_read,
    "number",
    "remote D1 result exposes rows_read metadata",
  );
  return result;
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.log(`  ✗ ${name}`);
    throw error;
  }
}

await test("broad ranked GPU search remains within the D1 request budget", async () => {
  const statement = buildCatalogSearchStatement("rtx", "gpu", CATALOG_SEARCH_READ_BUDGET);
  const result = await executeRemote(renderStatement(statement.sql, statement.values));

  assert.ok(result.results.length > 0, "fixture includes matching GPUs");
  assert.ok(
    result.meta.rows_read <= CATALOG_SEARCH_READ_BUDGET,
    `read ${result.meta.rows_read} rows; budget is ${CATALOG_SEARCH_READ_BUDGET}`,
  );
  console.log(
    `    rows_read=${result.meta.rows_read}/${CATALOG_SEARCH_READ_BUDGET}`,
  );
});

await test("autocomplete search remains within the global D1 request budget", async () => {
  const autocompleteLimit = 8;
  const statement = buildCatalogSearchStatement("asus", "gpu", autocompleteLimit);
  const result = await executeRemote(renderStatement(statement.sql, statement.values));

  assert.ok(result.results.length > 0, "fixture includes matching GPUs");
  assert.ok(
    result.meta.rows_read <= CATALOG_SEARCH_READ_BUDGET,
    `read ${result.meta.rows_read} rows; budget is ${CATALOG_SEARCH_READ_BUDGET}`,
  );
  console.log(
    `    rows_read=${result.meta.rows_read}/${CATALOG_SEARCH_READ_BUDGET}`,
  );
});

console.log("\nD1 search read budgets passed.");
