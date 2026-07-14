# Case Image Sourcing: Status and Next Steps

**Date**: 2026-07-14
**Status**: Scraper built and working. 7 of 20 target brands collected (164 case images, all URL-verified 200). 13 brands still failing — 10 need an agent-browser pass, 3 have network/access issues.
**Goal**: Every case in the most well-known SFF case brands shows a real product image in the SFF Builder UI.

---

## The Decision

No outreach. Scrape public product images from manufacturer storefronts, cache locally (R2), serve from our domain. Attribution in UI as "Image © <Brand>". This is the same model Wikipedia uses for product infobox images — standard, well-precedented, fine for a non-competing fitment engine.

The earlier legal-framed research (`.scratch/case-image-sources-research.md`) is kept for the record on why permissively-licensed sources were ruled out at the corpus level. The conclusion was: no single free, permissively-licensed source covers the SFF case catalog. So we scrape instead.

---

## What We Did

1. **Verified the approach end-to-end** with `agent-browser` on ssupd.co. 4 cases, all with public image URLs on Shopify CDN. The legal-framed strategy over-rotated; manufacturer pages are trivially scrapable.

2. **Wrote the strategy** at `.scratch/case-image-strategy.md`. Three scripts in concept:
   - Per-brand scrape → manifest of `(manufacturer_name, image_url)` pairs
   - Match against catalog case names (LLM/fuzzy, separate step)
   - Bulk download + R2 upload + SQL patch

3. **Built the scraper** at `scripts/scrape-case-images.ts` (422 lines). Webfetch-first, with parsers for Shopify, WordPress, and a generic auto-detect. Image URLs are maximized at extraction time (strip `?width=` for Shopify, strip `-NxN` for WordPress, normalize root-relative URLs).

4. **Wired it up** as `npm run scrape:case-images`.

5. **Ran it once** in 73 seconds. Got 164 case images from 7 brands. Verified all 164 image URLs return 200.

6. **Cached everything** to `.data/scrape-cache.json` per-brand. The cache is the source of truth — re-runs preserve completed brands, retries failed ones, and the manifest rebuilds from cache.

---

## Current State

### Manifest (`.data/case-image-manifest.json`)

| Brand | Cases | Strategy |
|---|---|---|
| Jonsbo | 87 | WordPress |
| Cougar | 16 | auto |
| Lian Li | 15 | WordPress |
| Fractal Design | 13 | auto |
| Cooler Master | 12 | auto |
| NZXT | 11 | auto/Shopify |
| ssupd | 10 | Shopify |
| **Total** | **164** | |

### Cache (`.data/scrape-cache.json`)

20 brands total: **7 completed**, **10 needs-agent-browser**, **3 failed**.

Each manifest entry has: `brand`, `productName`, `productUrl`, `imageUrl` (maximized), `imageSourceUrl` (original), `fetchedAt`.

---

## Next Steps

Ordered by leverage. Each step has a concrete command and an expected output.

### Step 1: Agent-browser pass on the 10 JS-rendered brands

This is the biggest single lever. 10 brands are cached as `needs-agent-browser` because webfetch returned an empty DOM. For each, walk the collection page in a real browser, extract product cards from the rendered DOM, capture the image URLs, and append them to the manifest.

Brands to cover (10):
- **Sliger** (sliger.com/products?form-factor=4) — verified 0 cards via webfetch; needs browser
- **NCASE** (ncased.com/collections/all) — verified 13 cases via webfetch on a different snapshot; might be Shopify-rendered now
- **Velkase** (velkase.com/collections) — was 0 cards
- **Streacom** (streacom.com/products/) — was 0 cards (previous run found 13 via direct webfetch earlier, so the parser might be the issue, not the site)
- **InWin** (in-win.com/en/chassis) — was 0 cards
- **ASRock** (asrock.com/microsite/DeskMeet/index.asp) — was 0 cards
- **FormD** (formdworks.com/collections/cases) — 404 with current URL, also needs a real browser to find the right path
- **Phanteks** (phanteks.com/products.html) — 404
- **Thermaltake** (thermaltake.com/products/cases.html) — 404
- **be quiet!** (bequiet.com/en/cases) — 404

**Workflow per brand**:
1. `agent-browser open <url>`
2. `agent-browser snapshot -i -u` to find product cards
3. Extract the primary product image src from each card
4. Save the manifest entries to `.data/case-image-manifest.json` (under the matching brand)

**Concrete command template** (for one brand):

```bash
agent-browser open https://www.sliger.com/products?form-factor=4
agent-browser wait --load networkidle
agent-browser snapshot -i -u
# Pull the img srcs and product URLs from the snapshot, append to manifest
```

**Expected outcome**: 50-150 more case images.

**Note**: For the 4 brands with 404s (FormD, Phanteks, Thermaltake, be quiet!), the agent-browser pass should also find the correct collection URL since we can navigate the site structure visually.

### Step 2: Fix or accept the 3 hard failures

- **Silverstone** (403 Forbidden) — anti-bot protection. Try a different User-Agent, or run via agent-browser. Expected outcome: ~30 cases (the biggest single brand in the catalog by count).
- **Louqe** (fetch failed, timeout) — the site is slow but exists. Try with a longer timeout, or via agent-browser. Expected outcome: ~6 cases.
- **Chieftec** (fetch failed) — intermittent network failure. Retry with `--force`; if it persists, agent-browser. Expected outcome: ~9 cases.

### Step 3: Fuzzy / LLM match scraped products to catalog cases

This is the next "loose idea" — separate from scraping. The catalog has 1,118 cases across 198 sellers. The manifest has 164 scraped products. The match step is: for each catalog case, find the best match in the manifest.

Suggested approach:
- Group manifest entries by brand
- For each catalog case with that seller, fuzzy-match the case name against the manifest's `productName` for that brand
- Use `fuse.js` (already a dependency in `package.json`) for the fuzzy match
- For ambiguous matches, defer to an LLM review pass
- Output: a `case_id → manifest_entry` mapping

This step is best done as a separate ticket on the existing `.issues/wayfinder-data-ingestion` map, since it requires:
- A schema decision (where does the mapping live? new column on `cases`? sidecar JSON?)
- A matching threshold (manual curation? fully automated?)
- An LLM-call decision (which model? what cost?)

### Step 4: Implement the data-layer changes

Once matching is done, the D1 changes are small:

```sql
alter table cases add column image_url text not null default '';
alter table cases add column image_source_url text not null default '';
alter table cases add column image_license text not null default '';
alter table cases add column image_attribution text not null default '';
```

Plus matching `CasePart` fields in `src/types.ts`, normalization in `src/lib/sheets.ts`, and seed SQL updates in `src/lib/sql.ts`.

### Step 5: Download images to R2

For each matched `(case_id, image_url)` pair, download the image, generate a derived 300px WebP thumbnail, and upload to `cases/<case-id>/main.webp` in R2. The `image_url` column stores the R2 path, not the source URL.

UI then references the R2 path. Source URLs are kept in `image_source_url` for auditing.

### Step 6: UI rendering

- **Slot card** (selected case in sidebar): 80px-square thumbnail top-right, fallback to generic case silhouette when no image.
- **Table view**: optional small thumbnail in the title cell. Could be deferred to a later UI ticket if it crowds the existing data-dense layout.
- **Attribution**: tooltip on hover showing "Image © <Brand>". No persistent UI clutter.

### Step 7: Decide on the long tail (~1,000 catalog cases without manufacturer storefronts)

The 198 sellers in the catalog split roughly:
- **~25 English-website brands** — covered by this work (and the agent-browser follow-up)
- **~130 Chinese/Taobao-only sellers** — no clean storefront to scrape (Taobao/Aliexpress product images, often Chinese-language pages, no permissively-licensed image corpus)
- **~40 discontinued/unavailable case sellers** — products may not even have live product pages

For the long tail, the options are:
- **Placeholder UI** (silhouette or spec-only card) — recommended for v1
- **Community-contributed CC images** — long-term investment, requires contribution flow
- **Tier 3 fair-use retailer thumbnails** (Amazon/Newegg) — legally gray, separate decision needed

---

## Open Questions

1. **Re-scrape cadence**: One-time is the current design. When do we re-scrape? Quarterly? On a manual trigger when a new case is added to the catalog?
2. **Discontinued cases**: Keep images for cases whose `availability_status = 'unavailable'`, or cull after N months? (User said "keep them" — answer is to keep, but worth being explicit.)
3. **Matching threshold for fuzzy/LLM step**: Manual for the top 20 brands, or fully automated?
4. **Anti-bot handling for Silverstone**: Worth the effort for one brand? Or skip and accept no Silverstone images?
5. **Long-tail path**: Placeholder, community contribution, or fair-use? This is the bigger scoping question.
6. **Image format**: The user said "biggest image you can find". Currently 300px WebP for the derived thumbnail. Should the slot card use a larger size? The current 80px-square slot card can comfortably use 400px thumbnails.

---

## Artifacts

| Path | What |
|---|---|
| `scripts/scrape-case-images.ts` | The scraper (422 lines). Run via `npm run scrape:case-images`. |
| `package.json` | Has the `scrape:case-images` script. |
| `.data/case-image-manifest.json` | Output: 164 entries with `brand`, `productName`, `productUrl`, `imageUrl`, `imageSourceUrl`, `fetchedAt`. |
| `.data/scrape-cache.json` | Per-brand status (completed / needs-agent-browser / failed), last attempt, reason, and entries. |
| `.scratch/case-image-sources-research.md` | The earlier legal-framed research. Superseded but kept for the record. |
| `.scratch/case-image-strategy.md` | Strategy doc. Updated with first-run results. |
| `.issues/wayfinder-data-ingestion-map.md` | The existing data-ingestion wayfinder map. Image work is a clarifying input to its open tickets `attribution-and-license-boundaries` and `source-roles-and-first-tranche`. |

---

## How this fits the existing wayfinder map

This work is a clarifying input to the existing data-ingestion map, not a new map. Specifically:

- **`attribution-and-license-boundaries`** — With scraping, the license story simplifies to a uniform "Image © <Brand>" attribution. No per-image license code lookup needed. The ticket's question explicitly contemplates per-source attribution rules; manufacturer-page scraping is the most common case in practice.
- **`source-roles-and-first-tranche`** — The image source is one role (product display) with one strategy (scrape manufacturer pages, cache to R2). It fits as a single supplemental data point alongside the catalog's other source-decisions.

If the user wants to formalize a tracking ticket for the matching/ingestion work, the natural shape is:

> **Ticket**: "Match scraped manufacturer images to catalog cases and ingest to D1"
> **Type**: `wayfinder:task`
> **Parent**: `.issues/wayfinder-data-ingestion-map.md`
> **Blocked by**: completion of agent-browser pass (Step 1) and the matching strategy (Step 3)
