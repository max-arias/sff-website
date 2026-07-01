import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = process.argv.includes("--preview") ? "preview" : "production";
const configPath = resolve(".output/server/wrangler.json");

if (target !== "preview") {
  process.exit(0);
}

const raw = await readFile(configPath, "utf8");
const config = JSON.parse(raw) as {
  name?: string;
  d1_databases?: Array<{
    binding: string;
    database_name: string;
    database_id: string;
  }>;
};

config.name = "sff-pc-builder-preview";
config.d1_databases = [
  {
    binding: "DB",
    database_name: "sff-builder-preview",
    database_id: "e9de92a8-bf50-4726-9c38-a091f4958735"
  }
];

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Patched ${configPath} for preview deploy.`);
