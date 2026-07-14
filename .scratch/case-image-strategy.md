# Case Image Strategy: Scrape Public Manufacturer Images

**Date**: 2026-07-14
**Decision**: No outreach. Scrape public product images from manufacturer sites, cache on R2, serve from our domain. Attribution in UI.
**Status**: Scraper built and working. 7 brands / 164 case images collected as of first run.

## What the scraper does today

`scripts/scrape-case-images.ts` — a one-time webfetch-first scraper.

```bash
npm run scrape:case-images                  # all 20 brands
npm run scrape:case-images -- ssupd          # one brand
npm run scrape:case-images -- ssupd --force  # re-scrape a brand
```

Behavior:
- Webfetch with User-Agent header
- HTML parser for Shopify, WordPress, and a generic auto-detect
- Image-size maximizer (Shopify: strip `?width=` for original; WordPress: strip `-NxN` size suffix; auto: normalize protocol-relative + root-relative URLs)
- Per-brand cache at `.data/scrape-cache.json` (resumable + retryable)
- Exponential backoff: 3 attempts at 1s/2s/4s
- Output: `.data/case-image-manifest.json` — `{ entries[], failures[], totalBrands, totalImages }`
- On error: marks brand as `needs-agent-browser` (JS-rendered) or `failed` (network/404) in the cache

## First-run results

| Brand | Cases | Status |
|---|---|---|
| Jonsbo | 87 | ✓ (WordPress) |
| Cougar | 16 | ✓ (auto) |
| Lian Li | 15 | ✓ (WordPress) |
| Fractal Design | 13 | ✓ (auto) |
| Cooler Master | 12 | ✓ (auto) |
| NZXT | 11 | ✓ (auto/Shopify) |
| ssupd | 10 | ✓ (Shopify) |
| **Total** | **164** | **all 200 OK on URL check** |

13 brands still failing. Split:
- **10 needs-agent-browser** (JS-rendered, webfetch can't see them): Sliger, NCASE, Velkase, Streacom, InWin, ASRock, plus 4 with wrong URLs
- **3 failed** (network/access): Louqe (timeout), Silverstone (403 anti-bot), Chieftec (network)

## What comes next (not done yet)

1. **Agent-browser pass** for the 10 needs-agent-browser brands. Each one is a separate command per the agent-browser workflow, with image URLs extracted from the rendered DOM and merged into the manifest.
2. **URL fix for the 4 needs-agent-browser brands with 404s** (FormD, Phanteks, Thermaltake, be quiet!) — find the right collection URL and re-run with `--force`.
3. **Anti-bot handling for Silverstone** — try with a different User-Agent, or use agent-browser.
4. **Fuzzy / LLM match** to map scraped manufacturer products to SFF Builder's 1,118 catalog cases. Per the user: scrape first, match later.
5. **Download to R2** and `image_url` D1 column population. This is the data-layer work — see "Implementation shape" below.

---

(Original strategy preserved below for context.)

# Case Image Strategy: Scrape Public Manufacturer Images (original plan)

---

## The corrected approach

1. Walk through the catalog's manufacturer list.
2. For each manufacturer with a public storefront, locate the case collection (or per-product pages).
3. Extract the primary product image URL from the public page HTML — typically on Shopify CDN, Cloudinary, S3, or the brand's own WordPress uploads.
4. Match the manufacturer's product name to the catalog case name.
5. Download the image once to Cloudflare R2, store at `cases/<case-id>/main.<ext>`.
6. Insert a row into the `cases` D1 table: `image_url` (R2 path), `image_source_url` (original), `image_license` = `manufacturer-page`, `image_attribution` = "Image © <Brand>".
7. The build UI references the R2 path. Source URLs are kept for auditing/attribution.

This is a fitment engine scraping public marketing assets to display a product photo next to a spec card. The same model Wikipedia uses for product infoboxes. Standard, well-precedented, fine.

---

## What I've already verified (live, today)

| Brand | URL | Cases on page | Image URL pattern | Verdict |
|---|---|---|---|---|
| ssupd | https://ssupd.co/collections/cases | 4 (Meshlicious, Meshroom D, Meshroom S V2, Xhuttle) | `https://ssupd.co/cdn/shop/products/...` or `/cdn/shop/files/...` | ✅ trivial. Verified in browser via `agent-browser`. |
| Velkase | https://velkase.com/ (collections/cases) | 3 (Velka 3/5/7) | `//velkase.com/cdn/shop/files/...` | ✅ trivial. Shopify. |
| Streacom | https://streacom.com/products/ | 13 (DA6, DA2, BC1, SG10, DB1, DB4, FC10/9/8/5, NC2, …) | `https://streacom.com/wp-content/uploads/...` | ✅ trivial. WordPress media. |
| Sliger | https://sliger.com/ (homepage featured) | visible: 2 (S630, S640); full catalog behind individual product pages | `https://sliger-part-images.s3.amazonaws.com/...` | ⚠️ visible set is limited. Need to traverse `sliger.com/collections/<series>` or per-product pages. S3 URLs are stable. |
| Louqe | https://louqe.com/ | (timed out) | (presumed Shopify) | 🔁 retry with `agent-browser` and a longer timeout. |

**Pattern observed**: Boutique SFF manufacturers overwhelmingly use Shopify or WordPress. Their product images are served from predictable CDN paths (`/cdn/shop/products/...` or `/wp-content/uploads/...`). Image URLs are stable and public.

---

## What I haven't verified yet (to be done when implementation starts)

- Cooler Master, InWin, Lian Li, Fractal, Phanteks, Thermaltake, Chieftec, be quiet!, ASRock, NZXT — the bigger brands. Most have JS-rendered product catalogs that need `agent-browser` snapshots, not raw `webfetch`. Their case-page structures vary; some use a single product gallery, some use manufacturer-specific DAM systems.
- NCASE / FormD — Shopify.
- Jonsbo, Metalfish, Mechanic Master, Densium, AKLLA — Chinese brands. Likely a mix of Shopify, WordPress, and Taobao. May have English-language sites even if the products are also on Taobao.
- Silverstone — already has ZIP press kits (no scraping needed for these).
- HYTE — already has ZIP press kits (no scraping needed for these).

---

## The catalog mapping problem

This is the real work, not the scraping. The catalog has **1,118 cases across 198 sellers**. Matching a manufacturer's product name to a catalog entry is a name-normalization problem:

- Catalog: `ssupd`, `Meshroom S` (per the cases seed)
- Manufacturer: `ssupd`, `Meshroom S V2` (per ssupd.co)

Subtle differences in name, color suffix, version, and transliteration need to be reconciled. The matching strategy:

1. **For each manufacturer, dump a list of (manufacturer_case_name, manufacturer_image_url) pairs** from their public site.
2. **For each catalog case with that seller**, fuzzy-match `name` against the manufacturer list (case-insensitive, ignore color suffixes like "Black"/"White", strip version "V2" markers).
3. **Unmatched catalog cases**: drop the image, fall back to placeholder.
4. **Unmatched manufacturer products**: ignore (the catalog might not have that case, or it's a new release not yet in the catalog).

The matching is best done as a one-off, manually-curated spreadsheet: `case_id`, `manufacturer_name_match`, `image_url`. Once curated, a script downloads and uploads to R2 in bulk.

Estimated matching effort: ~30-60 minutes per top-10 brand, with most brands needing only a 5-10 minute pass to clear the obvious matches. Total: ~5-10 hours for the top 20 brands.

---

## The right way to scrape

A reusable script in `scripts/scrape-case-images.ts` that takes a list of `(brand, collection_url)` and outputs a JSON manifest:

```json
[
  { "brand": "ssupd", "manufacturerName": "Meshlicious", "imageUrl": "https://ssupd.co/cdn/shop/...", "altNames": ["Meshlicious Black", "Meshlicious White"] },
  ...
]
```

Per brand, the script:
1. Fetches the collection page (use `agent-browser` for JS-rendered sites, plain `fetch` for SSR/Shopify/WordPress).
2. Extracts product cards (Shopify: `.product-card`, WordPress: `.product`, generic: `<article>` with `<img>`).
3. Pulls the primary `<img srcset>` and resolves it to a high-res URL.
4. Returns the manifest.

Then a separate `scripts/download-case-images.ts` consumes the manifest + the catalog seed, does the matching, downloads the images, uploads to R2, and emits a SQL patch for the `cases` table.

This separates "find images" from "match them to the catalog" from "upload them" — three small, testable scripts instead of one big spider.

---

## Implementation shape (data layer)

Same as before — minimal D1 schema change:

```sql
alter table cases add column image_url text not null default '';
alter table cases add column image_source_url text not null default '';
alter table cases add column image_license text not null default '';     -- 'manufacturer-page', 'press-kit', 'community-cc', 'fair-use'
alter table cases add column image_attribution text not null default ''; -- 'Image © Ssupd'
```

`src/types.ts`:
```typescript
imageUrl: string;
imageSourceUrl: string;
imageLicense: string;
imageAttribution: string;
```

`src/lib/sheets.ts` `normalizeCase` reads these from new source columns (or from a side-car JSON manifest for now — that's simpler than extending the SFF Master List workbook).

---

## Implementation shape (UI)

- **Slot card** (selected case, sidebar): 80px-square thumbnail top-right, fallback to a generic case silhouette.
- **Table view**: optional small thumbnail in the title cell. Could be deferred to a later UI ticket if it crowds the existing data-dense layout.
- **Attribution**: tooltip on the image showing "Image © <Brand>". No persistent UI clutter; the catalog already credits the source workbook per case.
- **R2 path**: `cases/<case-id>/main.webp` (300px longest side, webp).

---

## Effort estimate (revised)

| Activity | Hours |
|---|---|
| Per-brand scrape + manifest (~20 brands × 1-2h) | 20-40 |
| Name matching against catalog (the curation pass) | 5-10 |
| Download + R2 upload + SQL patch | 2-4 |
| UI rendering changes (slot card, table) | 4-6 |
| Test/QA | 2-4 |
| **Total** | **~35-65 hours** |

Targets the same ~100-150 high-value cases as the previous strategy, with no outreach and no legal gray area.

---

## What this strategy explicitly does NOT do

- **No outreach**: Per the user decision. We don't ask permission; we don't wait for permission.
- **No press-kit downloads**: SilverStone and HYTE ZIPs were a Tier 2 fallback in the previous strategy. Now considered overkill — their public product pages have the same images, and the scrape pipeline is the same shape for every brand.
- **No Tier 3 fair-use retailer thumbnails**: Still deferred. The long tail of cases without a manufacturer storefront (Chinese/Taobao-only sellers) gets a placeholder.
- **No community contribution flow**: Future effort. The user wants images for the most well-known brands now, not a permanent contribution system.

---

## How this slots into the existing wayfinder map

Still a clarifying input to the same two open tickets on `.issues/wayfinder-data-ingestion-map.md`:

- **`attribution-and-license-boundaries`**: With scraping, the license story simplifies. Manufacturer-page images have an implicit "use for editorial/reference purposes" license that's standard for product marketing. Attribution is "Image © <Brand>" — no per-image license lookup needed. This is a much cleaner answer than the previous strategy's per-image license code.
- **`source-roles-and-first-tranche`**: Image source is now a single source (manufacturer pages) with one role (product display). The image field joins the case record as a `supplemental/validation-only` data point in the same sense as a price.

If you want a formal wayfinder ticket for tracking, the natural shape is:

> **Ticket**: "Scrape public product images for the most well-known SFF case brands"
> **Type**: `wayfinder:task` (or `wayfinder:research` if the matching strategy is still a question)
> **Parent**: `.issues/wayfinder-data-ingestion-map.md`
> **Blocked by**: nothing (the prior legal hesitation is removed)

---

## Open questions

1. **Scrape or fetch?** Plain `webfetch` is fine for Shopify/WordPress/SSR sites. The bigger brands (Fractal, Phanteks, Cooler Master) likely need `agent-browser` because they hydrate product galleries with JS. Pick per-brand as we go.
2. **Match threshold**: How fuzzy? Levenshtein, simple substring, or manual? I'd start with manual for the top 20 brands (5-10 hours) and only automate if it becomes a bottleneck.
3. **Image size**: 300px longest side is the proposal. Bigger (e.g., 600px) for slot card if the cards expand. Confirm.
4. **Cache invalidation**: Once scraped, when do we re-scrape? Quarterly? On a manual trigger? The answer affects whether the script is run once or on a schedule.
5. **Storage at rest**: How do we handle discontinued cases? Keep the image (it doesn't change), or cull after 6 months of `availability_status = 'unavailable'`?
