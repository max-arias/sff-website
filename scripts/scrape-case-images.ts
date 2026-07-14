/**
 * Scrape public product images from SFF case manufacturer storefronts.
 *
 * One-time command. Webfetch-first; falls back to a `needs-agent-browser`
 * cache entry for JS-heavy sites so a follow-up agent-browser pass can
 * handle them. Caches per-brand results to .data/scrape-cache.json so
 * the command can be re-run safely.
 *
 * Output: .data/case-image-manifest.json
 *   { generatedAt, totalBrands, totalImages, entries[], failures[] }
 *
 * Usage:
 *   npm run scrape:case-images                  # all brands, skip completed
 *   npm run scrape:case-images -- --force       # re-scrape even completed
 *   npm run scrape:case-images -- ssupd          # only one brand
 *   npm run scrape:case-images -- ssupd --force  # one brand, force
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Strategy = "shopify" | "wordpress" | "auto";
type Status = "completed" | "needs-agent-browser" | "failed";

interface Target {
  brand: string;
  collectionUrl: string;
  strategy: Strategy;
}

interface ParsedCard {
  productName: string;
  productUrl: string;
  imageUrl: string;
}

interface ManifestEntry {
  brand: string;
  productName: string;
  productUrl: string;
  imageUrl: string;
  imageSourceUrl: string;
  fetchedAt: string;
}

interface ManifestFailure {
  brand: string;
  collectionUrl: string;
  reason: string;
  status: Status;
}

interface Manifest {
  generatedAt: string;
  totalBrands: number;
  totalImages: number;
  entries: ManifestEntry[];
  failures: ManifestFailure[];
}

interface CacheEntry {
  status: Status;
  lastAttempt: string;
  entryCount?: number;
  reason?: string;
  /** Persisted entries so the manifest can be rebuilt from the cache. */
  entries?: ManifestEntry[];
}

type Cache = Record<string, CacheEntry>;

/**
 * Manufacturer storefronts to scrape. Add more here as needed; the script
 * picks them up automatically. URL should be a public case collection page
 * (or for auto, a category landing page). Strategy is a hint for the HTML
 * parser — "auto" tries Shopify first, then WordPress patterns, then a
 * generic fallback.
 */
const TARGETS: Target[] = [
  // Boutique SFF — Shopify
  { brand: "ssupd", collectionUrl: "https://ssupd.co/collections/cases", strategy: "shopify" },
  { brand: "Sliger", collectionUrl: "https://sliger.com/products?form-factor=4", strategy: "shopify" },
  { brand: "NCASE", collectionUrl: "https://ncased.com/collections/all", strategy: "shopify" },
  { brand: "FormD", collectionUrl: "https://formdworks.com/collections/cases", strategy: "shopify" },
  { brand: "Louqe", collectionUrl: "https://louqe.com/collections/cases", strategy: "shopify" },
  { brand: "Velkase", collectionUrl: "https://velkase.com/collections", strategy: "shopify" },
  // Boutique SFF — WordPress
  { brand: "Streacom", collectionUrl: "https://streacom.com/products/", strategy: "wordpress" },
  // Mainstream — auto, likely JS-rendered (will mark needs-agent-browser)
  { brand: "Cooler Master", collectionUrl: "https://www.coolermaster.com/en-global/catalog/pc-cases", strategy: "auto" },
  { brand: "InWin", collectionUrl: "https://www.in-win.com/en/chassis", strategy: "auto" },
  { brand: "Lian Li", collectionUrl: "https://lian-li.com/product-category/cases/", strategy: "wordpress" },
  { brand: "Fractal Design", collectionUrl: "https://www.fractal-design.com/products/cases", strategy: "auto" },
  { brand: "Phanteks", collectionUrl: "https://phanteks.com/products.html", strategy: "auto" },
  { brand: "Jonsbo", collectionUrl: "https://www.jonsbo.com/en/product/ComputerCase.html", strategy: "auto" },
  { brand: "Silverstone", collectionUrl: "https://www.silverstonetek.com/en/product/info/computer-chassis/", strategy: "auto" },
  { brand: "Thermaltake", collectionUrl: "https://www.thermaltake.com/products/cases.html", strategy: "auto" },
  { brand: "Chieftec", collectionUrl: "https://www.chieftec.com/en/products/cases.html", strategy: "auto" },
  { brand: "be quiet!", collectionUrl: "https://www.bequiet.com/en/cases", strategy: "auto" },
  { brand: "ASRock", collectionUrl: "https://www.asrock.com/microsite/DeskMeet/index.asp", strategy: "auto" },
  { brand: "NZXT", collectionUrl: "https://nzxt.com/category/cases", strategy: "shopify" },
  { brand: "Cougar", collectionUrl: "https://cougargaming.com/en/cases", strategy: "auto" },
];

const CACHE_PATH = resolve(".data/scrape-cache.json");
const MANIFEST_PATH = resolve(".data/case-image-manifest.json");
const USER_AGENT = "SFFBuilderImageBot/0.1 (+https://sff.builder) fetch";
const PER_BRAND_DELAY_MS = 750;

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, attempts = 3): Promise<string> {
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
      });
      if (response.status === 404) throw new Error(`404 Not Found`);
      if (response.status >= 500) throw new Error(`Server error ${response.status}`);
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return await response.text();
    } catch (err) {
      lastError = err as Error;
      if (i < attempts - 1) await delay(1000 * 2 ** i);
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

// --- HTML parsing ---

function parseShopifyCollection(html: string, baseUrl: string): ParsedCard[] {
  const cards: ParsedCard[] = [];
  // Shopify product cards: <a href=".../products/..."> wrapping <img alt="Name" src="...">
  const linkRe = /<a[^>]+href="([^"]*\/products\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null) {
    const productUrl = decodeHtml(match[1]);
    const inner = match[2];
    const altMatch = inner.match(/<img[^>]+alt="([^"]+)"/i);
    const srcMatch = inner.match(/<img[^>]+src="([^"]+)"/i);
    if (altMatch && srcMatch && !productUrl.includes("/products/.")) {
      cards.push({
        productName: decodeHtml(altMatch[1]).trim(),
        productUrl: new URL(productUrl, baseUrl).toString(),
        imageUrl: resolveImageUrl(decodeHtml(srcMatch[1]), baseUrl),
      });
    }
  }
  return dedupeByUrl(cards);
}

function parseWordPressProducts(html: string, baseUrl: string): ParsedCard[] {
  const cards: ParsedCard[] = [];
  // WordPress product page: <a href=".../products/<slug>/"> with <img> inside
  const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null) {
    const productUrl = decodeHtml(match[1]);
    const inner = match[2];
    const srcMatch = inner.match(/<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp))"/i);
    const isProductPage = /\/(product|products|chassis|case|pc-case|mini-itx-case)\b/i.test(productUrl);
    if (srcMatch && isProductPage) {
      const altMatch = inner.match(/alt="([^"]+)"/i);
      const fallbackName = productUrl.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") ?? "";
      cards.push({
        productName: altMatch ? decodeHtml(altMatch[1]).trim() : decodeHtml(fallbackName),
        productUrl: new URL(productUrl, baseUrl).toString(),
        imageUrl: resolveImageUrl(decodeHtml(srcMatch[1]), baseUrl),
      });
    }
  }
  return dedupeByUrl(cards);
}

function parseAuto(html: string, baseUrl: string): ParsedCard[] {
  const shopify = parseShopifyCollection(html, baseUrl);
  if (shopify.length > 0) return shopify;
  return parseWordPressProducts(html, baseUrl);
}

/** Resolve a possibly-relative image src against the collection page origin. */
function resolveImageUrl(src: string, baseUrl: string): string {
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) {
    try {
      return new URL(src, baseUrl).toString();
    } catch {
      return src;
    }
  }
  return src;
}

function dedupeByUrl(cards: ParsedCard[]): ParsedCard[] {
  const seen = new Set<string>();
  const out: ParsedCard[] = [];
  for (const c of cards) {
    if (seen.has(c.productUrl)) continue;
    seen.add(c.productUrl);
    out.push(c);
  }
  return out;
}

// --- Image URL maximization (largest available) ---

function maxShopifyImage(url: string): string {
  // Shopify CDN: strip any existing ?width= to get the original.
  // ?v= (cache-buster) and other params are kept.
  let u: URL;
  try {
    u = new URL(url.startsWith("//") ? `https:${url}` : url);
  } catch {
    return url;
  }
  u.searchParams.delete("width");
  return u.toString();
}

function maxWordPressImage(url: string): string {
  // Strip -NxN size suffix to get the original
  return url.replace(/-\d+x\d+(\.(?:jpg|jpeg|png|webp))(\?|$)/i, "$1$2");
}

function maxAutoImage(url: string): string {
  // Generic: normalize protocol-relative URLs and return as-is.
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function maximizeImage(strategy: Strategy, url: string): string {
  switch (strategy) {
    case "shopify":
      return maxShopifyImage(url);
    case "wordpress":
      return maxWordPressImage(url);
    case "auto":
      return maxAutoImage(url);
  }
}

// --- Cache ---

async function loadCache(): Promise<Cache> {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8")) as Cache;
  } catch {
    return {};
  }
}

async function saveCache(cache: Cache): Promise<void> {
  await mkdir(".data", { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

// --- Per-brand scrape ---

async function scrapeBrand(target: Target): Promise<ParsedCard[]> {
  const html = await fetchWithRetry(target.collectionUrl);
  let cards: ParsedCard[];
  switch (target.strategy) {
    case "shopify":
      cards = parseShopifyCollection(html, target.collectionUrl);
      break;
    case "wordpress":
      cards = parseWordPressProducts(html, target.collectionUrl);
      break;
    case "auto":
      cards = parseAuto(html, target.collectionUrl);
      break;
  }
  if (cards.length === 0) {
    throw new Error(`Parsed 0 product cards — page likely JS-rendered, needs agent-browser`);
  }
  return cards;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const onlyBrand = args.find((a) => !a.startsWith("--"));

  const cache = await loadCache();
  // Cache is the source of truth. Manifest is rebuilt from cache for any
  // brand we're not re-scraping in this run. For brands we ARE scraping,
  // new entries replace the cached ones.
  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    totalBrands: 0,
    totalImages: 0,
    entries: [],
    failures: [],
  };

  const targets = onlyBrand
    ? TARGETS.filter((t) => t.brand.toLowerCase() === onlyBrand.toLowerCase())
    : TARGETS;

  if (onlyBrand && targets.length === 0) {
    console.error(`No target found for brand: ${onlyBrand}`);
    console.error(`Available: ${TARGETS.map((t) => t.brand).join(", ")}`);
    process.exit(1);
  }

  const targetBrands = new Set(targets.map((t) => t.brand));

  // Pre-seed from cache for brands we're not targeting
  for (const target of TARGETS) {
    if (!targetBrands.has(target.brand) && cache[target.brand]?.entries) {
      manifest.entries.push(...cache[target.brand].entries!);
    }
  }

  for (const target of targets) {
    const cached = cache[target.brand];
    if (!force && cached?.status === "completed") {
      console.log(`[skip] ${target.brand} (cached as completed, use --force to redo)`);
      if (cached.entries) manifest.entries.push(...cached.entries);
      continue;
    }

    process.stdout.write(`[scrape] ${target.brand} — ${target.collectionUrl} ... `);
    try {
      const cards = await scrapeBrand(target);
      const fetchedAt = new Date().toISOString();
      const entries: ManifestEntry[] = cards.map((c) => ({
        brand: target.brand,
        productName: c.productName,
        productUrl: c.productUrl,
        imageUrl: maximizeImage(target.strategy, c.imageUrl),
        imageSourceUrl: c.imageUrl,
        fetchedAt,
      }));

      manifest.entries.push(...entries);
      manifest.totalBrands += 1;
      cache[target.brand] = {
        status: "completed",
        lastAttempt: fetchedAt,
        entryCount: entries.length,
        entries,
      };
      console.log(`✓ ${entries.length} product(s)`);
      await saveCache(cache);
    } catch (err) {
      const reason = (err as Error).message;
      const status: Status = /0 product cards|404|parse/i.test(reason) ? "needs-agent-browser" : "failed";
      cache[target.brand] = {
        status,
        lastAttempt: new Date().toISOString(),
        reason,
      };
      manifest.failures.push({
        brand: target.brand,
        collectionUrl: target.collectionUrl,
        reason,
        status,
      });
      console.log(`✗ ${status}: ${reason}`);
      await saveCache(cache);
    }

    if (target !== targets[targets.length - 1]) await delay(PER_BRAND_DELAY_MS);
  }

  // Carry forward entries for any brand not in TARGETS (defensive — should
  // not happen, but keeps the manifest consistent if a brand is removed).
  for (const [brand, entry] of Object.entries(cache)) {
    if (entry.status === "completed" && entry.entries) {
      const already = manifest.entries.some((e) => e.brand === brand);
      if (!already) manifest.entries.push(...entry.entries);
    }
  }

  manifest.totalImages = manifest.entries.length;
  manifest.totalBrands = new Set(manifest.entries.map((e) => e.brand)).size;
  manifest.generatedAt = new Date().toISOString();

  await mkdir(".data", { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  console.log("");
  console.log(`Wrote ${MANIFEST_PATH}`);
  console.log(`  ${manifest.totalBrands} brand(s) completed`);
  console.log(`  ${manifest.totalImages} image(s) collected`);
  if (manifest.failures.length > 0) {
    console.log(`  ${manifest.failures.length} failure(s) in this run:`);
    for (const f of manifest.failures) {
      console.log(`    [${f.status}] ${f.brand}: ${f.reason}`);
    }
  }
  const remainingFailed = Object.entries(cache).filter(
    ([brand, entry]) => entry.status !== "completed" && !manifest.failures.some((f) => f.brand === brand),
  );
  if (remainingFailed.length > 0) {
    console.log(`  ${remainingFailed.length} previously failed (use --force to retry or fix URL in TARGETS):`);
    for (const [brand, entry] of remainingFailed) {
      console.log(`    [${entry.status}] ${brand}: ${entry.reason ?? ""}`);
    }
  }
}

await main();
