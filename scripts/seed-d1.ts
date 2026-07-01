import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const args = new Map<string, string | boolean>();

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) {
    args.set(arg, true);
  } else {
    args.set(arg, next);
    index += 1;
  }
}

const database = args.get("--database");
const mode = args.has("--remote") ? "--remote" : "--local";
const dryRun = args.has("--dry-run");
const seedPath = resolve(String(args.get("--file") || ".data/intake-seed.sql"));
const chunkDir = resolve(String(args.get("--chunk-dir") || ".data/seed-chunks"));
const maxChunkBytes = Number(args.get("--max-chunk-bytes") || 4_000_000);

if (!database || typeof database !== "string") {
  throw new Error("Usage: tsx scripts/seed-d1.ts --database <name> [--local|--remote] [--dry-run]");
}

async function writeChunks() {
  await rm(chunkDir, { recursive: true, force: true });
  await mkdir(chunkDir, { recursive: true });

  const chunks: string[] = [];
  const reader = createInterface({
    input: createReadStream(seedPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  let current = "";
  let currentBytes = 0;
  let chunkNumber = 1;
  let statementCount = 0;

  async function flush() {
    if (!current) return;
    const path = resolve(chunkDir, `${String(chunkNumber).padStart(4, "0")}.sql`);
    await writeFile(path, current, "utf8");
    chunks.push(path);
    chunkNumber += 1;
    current = "";
    currentBytes = 0;
  }

  for await (const line of reader) {
    const statement = `${line}\n`;
    const statementBytes = Buffer.byteLength(statement, "utf8");

    if (current && currentBytes + statementBytes > maxChunkBytes) {
      await flush();
    }

    current += statement;
    currentBytes += statementBytes;
    if (line.trim().endsWith(";")) statementCount += 1;
  }

  await flush();
  return { chunks, statementCount };
}

function runWrangler(chunkPath: string) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["wrangler", "d1", "execute", database, mode, "--file", chunkPath],
      { stdio: "inherit" }
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`wrangler d1 execute failed for ${chunkPath} with exit code ${code}`));
      }
    });
  });
}

const { chunks, statementCount } = await writeChunks();

console.log(`Prepared ${statementCount} statement(s) in ${chunks.length} chunk(s).`);
console.log(`Chunk directory: ${chunkDir}`);

if (dryRun) {
  process.exit(0);
}

for (const [index, chunk] of chunks.entries()) {
  console.log(`Applying seed chunk ${index + 1}/${chunks.length}: ${chunk}`);
  await runWrangler(chunk);
}
