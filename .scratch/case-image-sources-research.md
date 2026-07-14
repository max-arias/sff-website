# Case Image Sources: Decision-Ready Brief

**Date**: 2026-07-14
**Scope**: SFF PC case images for SFF Builder (fitment engine)
**Requirement**: Permissive license (CC-BY, CC0, ODbL, etc.), free, programmatic access, covers SFF community cases

---

## Recommendation

**There is no single free, permissively-licensed, programmatically-accessible source of SFF PC case images that covers a meaningful fraction of the catalog.** The honest answer: the image problem needs a composite solution or a shift in approach.

**Primary path**: **BuildCores render API** — if SFF Builder already has a commercial relationship with BuildCores (since OpenDB ingestion is planned), their `getAvailableParts()` API returns image URLs for all catalog parts including cases. The license is commercial (not open), but if you're already paying for the API, the images come with it. This is the only source that covers the target catalog at meaningful scale.

**Secondary/fallback path**: **Fair-use thumbnail hotlinking from major retailers** (Amazon via PA-API, Newegg via affiliate feeds) — this is a legal gray area but has strong precedent (Kelly v. Arriba Soft: thumbnails for indexing/search purposes are transformative fair use). Accept the legal risk in exchange for broad coverage with zero per-image cost.

**Unacceptable trade-off accepted**: Neither path provides a permissively-licensed image corpus. You either pay for commercial API access (BuildCores) or accept legal uncertainty (retailer thumbnails). The "free + open license" option does not exist at the required scale.

---

## Source-by-Source Evaluation

### 1. BuildCores OpenDB (and render API)

| Criterion | Finding |
|-----------|---------|
| **URL** | OpenDB: https://github.com/buildcores/buildcores-open-db · Render API: https://www.buildcores.com/api |
| **Image in case records?** | **No.** The PCCase schema (`schemas/PCCase.schema.json`) contains zero image-related fields — no `image_url`, `photo`, `picture`, or `media`. Confirmed by inspecting the actual schema file and a live case record (Corsair 5000D Airflow). |
| **Image via API?** | **Yes, but commercially.** The `@buildcores/render-client` npm package (ISC license) provides `getAvailableParts()` which returns `PartDetails[]` with an `image: string` field. The npm readme states: *"⚠️ YOU MUST HAVE A LICENSE TO THE BUILDCORES API TO USE THIS."* The docs use `https://example.com/case1.jpg` as placeholders; real URLs come from BuildCores' infrastructure. |
| **License (OpenDB data)** | ODC-By v1.0 (Open Data Commons Attribution). Covers structured data only. |
| **License (images)** | Not specified as open. Images are part of BuildCores' commercial API product. Likely sourced from manufacturers or rendered 3D models. |
| **Coverage** | Unknown but likely broad — they list 1000s of parts across categories. Has SFF-adjacent cases (Corsair 5000D, MONTECH KING 95 PRO) but unclear how many SFF-specific cases (Dan A4, NCase, FormD T1, Ghost S1, Sliger) are covered. |
| **Integration** | Requires a BuildCores API license and key. Image URLs are returned from their API endpoint. Could be hotlinked or downloaded depending on ToS. |
| **Verdict** | **Best option if already paying for BuildCores API.** Not viable as a free source. Per-image costs unknown (no published pricing). |

### 2. Wikimedia Commons

| Criterion | Finding |
|-----------|---------|
| **URL** | https://commons.wikimedia.org/wiki/Category:Computer_cases |
| **Coverage** | **Extremely poor for SFF enthusiast cases.** Searches for NR200, Dan A4, NCase M1, FormD T1, Ghost S1, Sliger, Meshlicious, Lian Li A4-H2O — essentially zero results for specific models. What exists: older Cooler Master Elite/K501L/Cosmos cases, a Cooler Master NR200P themed build photo (user's personal rig), a few generic ITX cases (Acer, AOpen), NZXT H500i, and trade show booth photos. |
| **Licenses** | Vary per file: CC0, CC BY-SA 4.0, CC BY 4.0, public domain. Each file has its own license; you must check per-image. |
| **Hotlinking** | Allowed. Stable URLs at `https://upload.wikimedia.org/wikipedia/commons/...`. Thumbnails available via URL path suffix. |
| **Attribution** | Required per CC license terms. Must credit author and license for each image. |
| **Image format** | JPEG, PNG, WebM. Multiple resolutions available via thumbnail URL suffixes. |
| **Coverage estimate** | **< 2% of SFF case catalog.** Comparable to zero for practical purposes. |
| **Verdict** | **Ruled out.** Coverage is so sparse it's not worth integrating. A handful of generic cases, zero enthusiast SFF models. |

### 3. PCPartPicker

| Criterion | Finding |
|-----------|---------|
| **URL** | https://pcpartpicker.com/products/case/ |
| **Coverage** | **Excellent for mainstream cases** (Corsair, NZXT, Fractal, Cooler Master, Lian Li, Phanteks). Unknown for boutique SFF brands (Sliger, FormD, Louqe, NCase) but better than most sources. |
| **Images** | Confirmed — pypartpicker library returns `image_urls: Optional[list[str]]` per part. The PCPartPicker page HTML includes thumbnail images in the parts table. |
| **License** | **Not permissive.** PCPartPicker ToS explicitly prohibits scraping, data mining, and automated extraction. Images are copyrighted by PCPartPicker or original manufacturers. |
| **API** | **No public API.** Internal API exists but staff have explicitly declined to make it public (confirmed in their own forums). |
| **Scraping viability** | **Very difficult.** Behind Cloudflare Bot Management (TLS/JA3 fingerprinting, JS challenges) + Cloudflare Turnstile rate limiting. All naive scrapers fail. Requires curl_cffi with Chrome impersonation + residential proxies. Multiple GitHub scraper projects documented as broken. |
| **Legal risk** | **High.** ToS explicitly prohibits scraping. Commercial use carries breach-of-contract and potential CFAA exposure. |
| **Verdict** | **Ruled out.** High legal risk + technical difficulty + no API = not viable. Even if technically scrapable, the copyright status of the images remains unresolved. |

### 4. TechPowerUp

| Criterion | Finding |
|-----------|---------|
| **URL** | Case reviews: https://www.techpowerup.com/reviewdb/?category=Cases · Database licensing: https://www.techpowerup.com/database-licensing/ |
| **Coverage** | **Good for cases with reviews** — their review database lists 765 case reviews including NCASE M1, Sliger, Silverstone, Fractal, Cooler Master, etc. Each review page includes 5-20 product photos. |
| **Case database** | **Does not exist for cases.** Their commercial database licensing covers CPU, GPU, and SSD only. Their robots.txt explicitly prohibits scraping: *"Use of any device, tool, or process designed to data mine or scrape the content using automated means is prohibited without prior written permission."* |
| **Images** | Review photos are copyrighted by the reviewer/photographer. TechPowerUp's forum ToS grants them a non-exclusive license to display, not to sublicense. |
| **API** | Free API available for GPU specs only (curated subset). No case API. |
| **Verdict** | **Ruled out.** No case database. Review images are copyrighted. Database licensing doesn't cover cases. |

### 5. Open Hardware Database / OpenPCD / Similar Projects

| Criterion | Finding |
|-----------|---------|
| **OpenPCD** | RFID reader hardware project (https://openpcd.org). Not remotely related to PC components. |
| **Open Hardware Database** | No known project exists for PC hardware under this name. |
| **Kaggle PC Parts Dataset** | 3,279 images, 14 classes, 256×256 JPG, ODC-By license. Has a "case" class. **However**: images were scraped from Google Images — *"I looked for pictures of each PC part on Google Images and got the links"*. Original copyright status of each image is unknown/unlicensed. Legal risk. |
| **Roboflow PC Parts Detection** | CC BY 4.0, 408 images. Mostly internal components (disk drives, GPU slots), not product case photos. Minimal SFF coverage. |
| **Verdict** | **Ruled out.** No relevant open hardware database with licensed images. ML datasets exist but have unsourced/copyright-uncertain imagery. |

### 6. SFF Network (sff.network / smallformfactor.net)

| Criterion | Finding |
|-----------|---------|
| **URL** | https://smallformfactor.net/category/reviews/cases/ |
| **Coverage** | **Good for SFF-specific cases** — they review the exact enthusiast cases SFF Builder targets: Fractal Era 2, Corsair 2000D, Goodisory A01, InWin B1, FormD T1 variants, etc. Review articles include 10-20 detailed product photos each. |
| **License** | **Not redistributable.** Their ToS states users retain copyright over uploaded content. Review photos are produced by SFF Network or freelance reviewers and are copyrighted. Forum terms: *"You retain all copyright over your designs and content"* — not a grant of license to third parties. |
| **API** | No API. Scraping would be required. |
| **Verdict** | **Ruled out.** Review images are copyrighted. Forum images are user-copyrighted. No license grant for reuse. |

### 7. Reddit r/sffpc

| Criterion | Finding |
|-----------|---------|
| **Verdict** | **Ruled out cleanly.** User-posted content. Copyright held by individual Reddit users. No blanket license exists. Not redistributable. |

### 8. Manufacturer Spec Pages

| Criterion | Finding |
|-----------|---------|
| **Verdict** | **Ruled out cleanly.** Product photos on manufacturer websites (Cooler Master, Lian Li, Fractal Design, etc.) are proprietary/copyrighted. Using them without permission is infringement. Some manufacturers provide press kits (e.g., HYTE Press Kit at https://hyte.com/press/press-kit) but terms restrict use to editorial/review coverage, not commercial product catalogs. |

### 9. Cybenetics / SPL / TechPowerUp Review Images

| Criterion | Finding |
|-----------|---------|
| **Cybenetics** | PSU efficiency/noise certification only. No case data or images. |
| **SPL (PSU Tier List)** | Text-only PSU data. No images. |
| **TechPowerUp review images** | Covered in section 4 above. Copyrighted. Not available. |
| **Verdict** | **Ruled out completely.** No case image source among any of these. |

### 10. Amazon Product Advertising API (Bonus Evaluation)

| Criterion | Finding |
|-----------|---------|
| **URL** | https://webservices.amazon.com/paapi5/documentation/images.html (being deprecated May 2026 → Creators API) |
| **Coverage** | **Excellent** — Amazon lists virtually all case models including boutique SFF brands. |
| **Images** | Yes — `Images.Primary.Large/Medium/Small` and `Images.Variants.*` resources. Multiple sizes, stable URLs. |
| **License** | **Highly restrictive.** Amazon PA-API license grants limited rights to display images *only* in conjunction with affiliate links to Amazon product pages. Section 2(c)(i): *"You will use Product Advertising Content only in a lawful manner... within the express scope of... driving sales of products and services on an Amazon Site."* Section 2(c)(viii): *"You will not store or cache Product Advertising Content consisting of an image"* (max 24-hour link storage). Images cannot be used in a standalone product catalog. |
| **Verdict** | **Not viable for primary use.** The license explicitly prohibits use outside Amazon affiliate context. However, the fair-use thumbnail argument (see below) could apply to the image URLs themselves, separate from the API terms. |

---

## Practical Integration Notes

### Recommended Image Storage Strategy

Given the lack of a single clean source, **download-to-R2 (or equivalent object storage)** is the safest strategy, regardless of source:

1. **If using BuildCores API**: Hotlink their CDN-hosted images (their terms likely allow this as part of the API license). Add a fallback: on 404 or timeout, serve a placeholder.
2. **If using retailer thumbnails under fair use**: Download once, store in R2/Cloudflare Images/S3, serve from your own domain. This avoids hotlinking dependency and gives you control. The Kelly/Perfect 10 cases established that thumbnails for indexing are transformative — downloading them for this purpose is the same act as what the search engines did.
3. **Store original + derived**: Keep the source image (if rights permit), then generate a standardized thumbnail (e.g., 300×300 webp) at build time.

### Recommended Image Field Shape

```typescript
interface CaseImage {
  /** Primary thumbnail URL (self-hosted or hotlinked) */
  thumbnail: string;
  /** Full-size image URL if available */
  full?: string;
  /** Attribution text if license requires it */
  attribution?: string;
  /** License code if known (e.g., "CC-BY-4.0", "fair-use", "commercial-api") */
  license?: string;
}

// In the Case record itself:
interface CaseRecord {
  // ... existing fields ...
  images?: CaseImage[];
  // Simplified fallback: single optional URL
  image_url?: string;
}
```

**Recommendation**: Start with a single optional `image_url` field (nullable string). Multiple images per case can be added later as an array if needed. Thumbnails should be 300-400px on the longest side — large enough to be useful in a table UI, small enough to load fast.

### Attribution Rendering

- **BuildCores API images**: Check your API license agreement. Likely requires a "Powered by BuildCores" attribution or similar.
- **Fair-use retailer thumbnails**: No legal attribution requirement, but citing source as "Image via [retailer]" is good practice and strengthens the fair-use argument.
- **CC-licensed images (Wikimedia etc.)**: Must include author name, license name, and link to license per CC terms. Practical approach: show attribution on hover or in a tooltip; include full credits on an About page.

---

## Open Questions to Resolve Before Implementation

1. **BuildCores relationship status**: Is SFF Builder already contracted for the BuildCores API, or just planning to ingest the ODC-By OpenDB data? If the former, image URLs come bundled. If the latter only, images are NOT in OpenDB and require a separate API license.

2. **Fair-use appetite**: Is the organization willing to accept the legal risk of displaying retailer-sourced thumbnails? The Kelly/Perfect 10 precedent is strong for search engines, but SFF Builder is a product catalog — a court could distinguish this. A legal review is recommended before committing code.

3. **Image fallback strategy**: What should the UI show when no image is available? Gray placeholder? Silhouette of a case? Generated 3D render from dimensions? This affects UX design regardless of source.

4. **Budget for BuildCores API**: If not already licensed, what is the budget? BuildCores does not publish pricing publicly. Contacting sales to ask whether a small SFF-specific project qualifies for a reduced rate or whether the open-data ingestion already covers image access is step zero.

5. **Community-sourced images**: Would SFF Builder accept user-submitted case photos (uploaded by builders)? This would be permissively licensed (CC BY or similar) if contributed under those terms. This is the only path to a truly open, free image corpus — but it requires building the contribution mechanism and will cover cases slowly over time.

6. **Manufacturer outreach**: Several SFF case manufacturers (Sliger, FormD, Louqe, NCase, Streacom, Jonsbo, Lian Li, Fractal) might grant permission to use product photos for a non-competing fitment engine. Contacting them individually could yield per-image or per-manufacturer permission. This is labor-intensive but legally clean.

---

## Summary

| Source | Coverage | License | Free? | Programmatic? | Viable? |
|--------|----------|---------|-------|---------------|---------|
| BuildCores API | Good (depends on catalog) | Commercial | No (paid API) | Yes (REST) | ✅ (if budget) |
| Wikimedia Commons | <2% of SFF catalog | CC0/CC-BY | Yes | Yes (API) | ❌ (coverage) |
| PCPartPicker | Excellent | Copyright | No* | Scrape only | ❌ (legal) |
| TechPowerUp | Good (review images) | Copyright | No | No | ❌ |
| Amazon PA-API | Excellent | Restricted | Yes* | Yes (API) | ⚠️ (fair use only) |
| Manufacturer sites | Per-manufacturer | Copyright | Varies | No | ❌ |
| SFF Network | Excellent (SFF-specific) | Copyright | No | No | ❌ |
| Reddit r/sffpc | Good | Copyright | No | No | ❌ |
| Kaggle/ML datasets | Poor | ODC-By | Yes | Yes | ❌ (legal risk) |

\* *Amazon PA-API is free to use but images can only be displayed per their restrictive license. The "free" aspect refers to API access cost, not image licensing.*

**Bottom line**: The BuildCores API is the only source that combines good coverage with legal clarity, but it isn't free. If budget is unavailable, the fallback is a fair-use thumbnail strategy using Amazon/Newegg images — effective but legally unproven for this use case. A long-term investment in community-contributed images under CC license would solve the problem permanently but takes time.

---

## Follow-up: Manufacturer Website Path (Deeper Look)

### Catalog Size

SFF Builder's case catalog contains **1,118 cases** across **198 unique sellers/manufacturers** (source: `.data/seed-chunks/*.sql`). Of these, roughly 60-70 are "mainstream" brands with formal English-language websites; the remaining ~130 are Chinese/Taobao sellers (ZS Cases, Custom_Mod, Dream Case, SGPC, GEEEK, etc.), discontinued-case sellers, or very small boutiques.

---

### 1. Press Kits with Explicit Reuse Terms

Only **two manufacturers** have publicly-accessible press/media resource pages with clear product image downloads. Neither publishes explicit license terms alongside the downloads.

#### HYTE

| Criterion | Finding |
|-----------|---------|
| **URL** | https://hyte.com/press/press-kit |
| **Access** | Public, no login required |
| **What's available** | Per-product ZIP files containing high-res photos, press release PDFs, spec sheets. Products covered: Y60, Revolt 3, HG10, keeb SR65. |
| **License terms** | **Not stated on the page.** The footer links to generic Terms and Conditions (https://hyte.com/terms-and-conditions). No specific license for press kit images. Industry norm for press kits: editorial/review use, not commercial product catalogs. Requesting explicit permission from HYTE/iBUYPOWER would be necessary. |
| **Image source** | `https://content.ibuypower.com/HYTE/press-kit/...` (stable CDN URLs) |
| **Coverage in catalog** | Only covers HYTE's own cases (Y60, Revolt 3). These are a small fraction of the 1,118-case catalog. |
| **Hotlinking** | ZIP downloads, not individual hot-linkable images. Would need to extract and host yourself. |

#### SilverStone Technology

| Criterion | Finding |
|-----------|---------|
| **URL** | https://www.silverstonetek.com/en/product/info/computer-chassis/ (per product page, e.g., /PM01/) |
| **Access** | Public, no login required |
| **What's available** | Per-product "High resolution photos" ZIP download (e.g., PM01: 92 MB ZIP). Available for nearly every product. Also product sheets (PDF). |
| **License terms** | **Not stated on download page.** The site's privacy policy is accessible but no terms govern the photo downloads explicitly. Implicitly for media/retailer use. Using them in a competitive product catalog without permission is a risk. |
| **Image source** | Downloaded locally from their server |
| **Coverage in catalog** | 30 SilverStone cases in the catalog. Most active products have downloads. Discontinued models may have broken links. |
| **Hotlinking** | No — ZIP downloads only. |

#### be quiet!

| Criterion | Finding |
|-----------|---------|
| **URL** | https://www.bequiet.com/en/press/pressreleases |
| **Access** | Public |
| **What's available** | Press releases with embedded image packs for some products (e.g., "Light Mount Image Packs"). Not all case products are covered. |
| **License terms** | **Not stated.** No public image library. Contact for press inquiries: info@bequiet.com. |
| **Verdict** | Partial coverage. Press releases for recent products only. No systematic case image library. |

#### Fractal Design (Restricted Access)

| Criterion | Finding |
|-----------|---------|
| **URL** | https://group.fractal-design.com/media-2/mediabank/ |
| **Access** | **Restricted.** Legal gate: *"Due to legal restrictions, the information on this part of the website is not directed at or accessible to certain persons."* Appears to require press/investor credentials. Uses Canto DAM with portal-based access. Designed for launch partners under NDA. |
| **Verdict** | **Not accessible for a non-partnered project.** Not viable without a Fractal Design partnership agreement. |

---

### 2. Mainstream Manufacturers Without Press Kits

#### Cooler Master

| Criterion | Finding |
|-----------|---------|
| **URL** | https://www.coolermaster.com/en-global/newsroom.html |
| **Press kit** | None publicly accessible. Newsroom has press releases only. Egnyte link from Computex (https://coolermaster.egnyte.com/fl/KhAqDZL5KV) is likely restricted. |
| **Product image terms** | ToS (https://www.coolermaster.com/en-global/terms-of-use.html) is standard: all content is proprietary, no reuse without permission. |
| **Hotlinking** | Product images on their site have stable URLs under `https://www.coolermaster.com/...` but no implied license to use them. |
| **Verdict** | **Permission required.** Contact Cooler Master PR for partnership. |

#### Lian Li

| Criterion | Finding |
|-----------|---------|
| **URL** | https://lian-li.com/ (main) · https://www.globalpr.agency/press-room/lian-li/ (press) |
| **Press kit** | No public press kit. GlobalPR agency hosts press releases with images embedded (e.g., CES 2018, product launches). Images are served from `www.globalpr.agency/fileadmin/Press/Lian_Li/`. |
| **Product image terms** | No explicit license on lian-li.com. Product pages show images hosted on their CDN. |
| **Verdict** | **Permission required.** Lian Li is approachable via their PR agency but no systematic access. |

#### Fractal Design

| Criterion | Finding |
|-----------|---------|
| **URL** | https://www.fractal-design.com/ |
| **Press kit** | Restricted mediabank (see above). No public image downloads. |
| **Product image terms** | Standard copyright. No reuse without permission. |
| **Verdict** | **Permission required.** Would need to apply for partner status. |

#### Phanteks

| Criterion | Finding |
|-----------|---------|
| **URL** | https://phanteks.com/ |
| **Press kit** | No public press kit. Has a "Product Release" blog with press-style announcements but no image library. |
| **Verdict** | **Permission required.** Contact Phanteks PR. |

#### Thermaltake

| Criterion | Finding |
|-----------|---------|
| **URL** | https://www.thermaltake.com/ |
| **Press kit** | No public press kit. Press release page exists (thermaltake.com/news_category/press-release.html). Review request program (my.thermaltake.com/ctReview.aspx) requires application for review units. |
| **Verdict** | **Permission required.** Thermaltake is a large company — unlikely to grant image reuse without a formal partnership. |

#### InWin

| Criterion | Finding |
|-----------|---------|
| **URL** | https://www.in-win.com/en/ |
| **Press kit** | No press kit. News/press release page has product launch announcements. |
| **Product image terms** | ToS (https://www.in-win.com/en/terms-of-use): standard boilerplate — all content is proprietary, reuse prohibited without permission. |
| **Verdict** | **Permission required.** |

#### Jonsbo

| Criterion | Finding |
|-----------|---------|
| **URL** | https://www.jonsbo.com/en/ |
| **Press kit** | None. Product pages have gallery tabs with images. |
| **Image behavior** | Images are on the product page. No public downloads. Chinese manufacturer — harder to reach for permission. |
| **Verdict** | **Likely no systematic access.** Small SFF-oriented manufacturer; individual outreach might work. |

#### be quiet!

| Criterion | Finding |
|-----------|---------|
| **URL** | https://www.bequiet.com/en/ |
| **Press kit** | No public image library. Press releases include some image packs. Download portal (bequiet.com/en/download) has logos and brochures only, not product photos. |
| **Verdict** | **Permission required via press contact.** |

#### DeepCool

| Criterion | Finding |
|-----------|---------|
| **URL** | https://www.deepcool.com/ |
| **Press kit** | Press release page with news announcements. No image library. Contact: Globalmarketing@deepcool.com |
| **Verdict** | **Permission required.** |

---

### 3. Boutique / Enthusiast Manufacturers

These are the most critical for SFF Builder's catalog — cases like Dan A4, NCase M1/M2, FormD T1, Ghost S1, Sliger SM/CE series, Velka 3/5/7, Streacom DA2/DA6, Meshlicious, A4-H2O, etc.

| Manufacturer | Image source | Press kit? | Terms | Practical path |
|---|---|---|---|---|
| **Sliger** | Product pages: `https://sliger.com/includes/products/.../*.jpg` — stable, hotlinkable URLs, multiple angles. Excellent product photography. | None. | No explicit terms on-site. Small US manufacturer owned by a couple. | **Best candidate for direct permission.** They're approachable (orders@sliger.com, phone). Likely to say yes to a non-competing fitment engine. |
| **NCASE** | Shopify store: `https://ncased.com/cdn/shop/files/...` — product images on product pages. | None. | Standard Shopify store terms. No reuse license. | **Permission possible.** NCASE is community-oriented (started on Reddit/HardForum). Reach out via contact form or Discord. |
| **FormD (formdworks.com)** | Shopify store: product images on product pages. Now integrated with NCASE. | None. | Standard e-commerce terms. | **Same as NCASE** — merged operations. |
| **Louqe** | Shopify-based store. Product images on product pages. | None. | Standard. | **Permission possible via email.** Small Swedish operation. |
| **Velkase (Velka)** | Small e-commerce site. Product images on product pages and `velkase.com`. | None. | No explicit terms. | **Permission possible.** One-person operation (Velkase is run by a single designer). |
| **Streacom** | Product pages at `https://streacom.com/products/...` with gallery images. | None. | Standard copyright. Dutch company. | **Permission possible via contact form.** Small premium manufacturer. |
| **ssupd (Meshlicious/Meshroom)** | Product pages at `https://ssupd.com/`. | None. | Standard. | **Part of Lian Li family.** Would need Lian Li-level outreach. |
| **COOJ** | Small boutique. Product images on site. | None. | Standard. | **Individual outreach.** |
| **SFFtime** | Polish boutique. Product images on site. | None. | Standard. | **Individual outreach.** |
| **J-HACK** | Small US operation. Product images on site. | None. | Standard. | **Individual outreach.** |
| **Custom_Mod, Dream Case, SGPC, GEEEK, SKTC, LZmod, ZS Cases, Metalfish, AKLLA, etc.** | Chinese/Taobao sellers. Images on Taobao product listings, Aliexpress, or Facebook groups. | None. | Taobao/Aliexpress product images are uploaded by sellers — copyright status unclear. | **No clean path.** These cases are sold through Chinese e-commerce platforms. Images are typically product photos from the seller, which you might be able to use under Taobao's listing-image norms, but there's no legal clarity. Best option: download product photo from the listing and treat as fair-use thumbnail. |

---

### 4. Realistic Effort Estimate for a Per-Manufacturer Manual Approach

| Metric | Value |
|--------|-------|
| **Total cases in catalog** | **1,118** |
| **Unique sellers/manufacturers** | **198** |
| **Sellers with English websites & press kits** | ~2 (HYTE, SilverStone with photo downloads) |
| **Sellers with English websites, no press kit (permission approachable)** | ~25 (Cooler Master, Lian Li, Fractal, Phanteks, Thermaltake, InWin, be quiet!, DeepCool, Sliger, NCASE, Louqe, Streacom, Velkase, Jonsbo, ssupd, etc.) |
| **Sellers who are Chinese/Taobao-only** | ~130 (ZS Cases, Custom_Mod, Dream Case, SGPC, GEEEK, SKTC, LZmod, etc.) |
| **Sellers of discontinued/unavailable cases** | ~40 |

**Effort per manufacturer for formal permission:**
- Research contact info: 15-30 min
- Draft and send permission request email: 15 min
- Follow up if no response: 10 min
- On approval, locate and download/catalog images: 30-60 min per model
- **Total per manufacturer: ~1-3 hours for initial contact, plus ~5-15 min per case model**

**If pursuing formal permission from the 25 approachable English-website manufacturers:**
- Outreach time: 25 × 1.5h = **37.5 hours** (spread over weeks due to async email)
- Image cataloging time: ~400 cases × 10 min = **67 hours**
- **Total: ~100 hours** (2.5 work weeks)

**If pursuing the Taobao-only sellers (130 sellers, ~500 cases):**
- No formal permission path available
- Would need to treat as fair-use thumbnails from Taobao/Aliexpress product listings
- Scraping Taobao is technically feasible but against their ToS
- Estimated time: 50-80 hours to manually find, screenshot, and catalog images

**Reality check**: A full manual approach covering 100% of the catalog is ~180 hours. A targeted approach covering just the ~60 most popular/active cases from the 25 approachable manufacturers is **~30-40 hours**.

---

### 5. Recommended Hybrid Approach

Given the findings, the most pragmatic path is:

1. **Tier 1 — Manufacturer permission (high-value cases, ~60-80 cases):**
   - Target ~10 manufacturers who are most approachable and cover the most SFF-relevant cases: **Sliger, NCASE/FormD, Louqe, Fractal Design, Lian Li, Cooler Master, SilverStone, HYTE, Streacom, Velkase**
   - Send individual permission requests explaining SFF Builder is a non-competing fitment engine
   - Ask for permission to use product images from their website with attribution
   - Expected success rate: ~60-70% (most small SFF manufacturers are community-friendly)
   - Time estimate: **30-40 hours** for outreach + cataloging

2. **Tier 2 — SilverStone/HYTE press-kit downloads (clean, no permission needed beyond press-kit intent):**
   - SilverStone has 30 cases in catalog; download their hi-res ZIPs
   - HYTE covers their own 4-5 cases
   - **~35 cases covered**, zero email time, just download effort (~2 hours)

3. **Tier 3 — Fair-use thumbnails for remaining cases (~1,000 cases):**
   - For cases from Chinese/Taobao sellers, discontinued cases, and cases where permission is denied or unanswered
   - Source: Amazon product images (via PA-API or manual lookup), Newegg product pages, Taobao listings
   - Store as downscaled 300px thumbnails in R2, serve from your domain
   - Accept the legal gray area as a pragmatic compromise — the Kelly/Perfect 10 thumbnail precedent offers some protection for indexing purposes

**Best-case realistic coverage with this hybrid:**
- Tier 1 (permission): ~60-80 cases with clean legal status
- Tier 2 (press kit): ~35 cases with likely-clean status
- Tier 3 (fair use): ~1,000 cases with legal gray area
- **Total: ~100-115 "clean" images + ~1,000 "fair-use" images**

**Labor cost for hybrid approach:**
| Activity | Hours |
|----------|-------|
| Manufacturer outreach (10 manufacturers) | 15-20 |
| Image cataloging from permission grants | 10-15 |
| SilverStone/HYTE press kit download & process | 2-3 |
| Fair-use thumbnail sourcing (manual for first 200, script-assisted for rest) | 40-60 |
| Infrastructure (R2 bucket, image processing pipeline, attribution system) | 8-12 |
| **Total** | **~75-110 hours** |

This is not trivial, but it's a tractable project for one person over 2-3 weeks. The result is not a clean open-license corpus, but it's a functional, best-effort image set that covers the entire catalog — which is better than any single source can provide.
