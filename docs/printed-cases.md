# Community 3D-printed cases

Import one project at a time by hand, including showcases without released files. Printed cases are normal credited `/build` rows, not a separate directory. The browser uses the static catalog; no request-time D1 reads or R2 image storage are added.

## File format

Commit one JSON file per case at `data/printed-cases/<slug>.json`. `case` uses workbook headers and string values. This illustrative example uses a placeholder GPU ID; replace it with an exact catalog match or omit it before importing.

```json
{
  "case": { "Case": "Riserless 3.5L", "Volume (L)": "3.5", "Motherboard": "mITX", "PSU": "Custom", "GPU Riser": "-", "Case material": "PETG" },
  "printed": {
    "creator": "u/creator",
    "creatorUrl": "https://www.reddit.com/user/creator",
    "sourceUrl": "https://www.reddit.com/r/sffpc/comments/example/",
    "postedAt": "2026-10-01",
    "files": { "status": "unreleased", "url": "", "license": "" },
    "images": [{ "url": "https://i.redd.it/example.jpg", "caption": "" }],
    "referenceBuild": { "parts": { "gpu": "<catalog id>" }, "notes": "Ryzen 5 7600, HDPlex 250W GaN" },
    "printNotes": ""
  }
}
```

Use only values from the post, creator comments, or linked project documentation. Leave unknown fields out; never guess dimensions or treat installed hardware dimensions as case clearance. Missing metrics show `—`; unknown fitment stays `conditional`. Case name, numeric volume, creator, HTTPS source URL, date (`YYYY-MM-DD`), and file status are required. URLs must use HTTPS. Published files require a URL; copy the license as written, or leave it blank if unspecified. Optional strings default to `""`, images to `[]`, and reference build to `{ "parts": {}, "notes": "" }`.

Allowed `case` columns (must match `normalizeCase`):

- `Case`, `Style`, `Side panel`, `Case material`, `GPU Riser`, `PSU`, `Motherboard`, `Radiator support`
- `Case Length (mm)`, `Case Width (mm)`, `Case Height (mm)`, `Volume (L)`, `Footprint (cm2)`, `Weight (kg)`
- `CPU Cooler Height (mm)`, `GPU Length (mm)`, `GPU Width (mm)`, `GPU Height / Thickness (mm)`, `PCIe Slot`, `LP PCIe Slot`
- `2.5" drive count`, `3.5" drive count`, `5.25" drive count`
- `40mm fan count`, `60mm fan count`, `80mm fan count`, `92mm fan count`, `120mm fan count`, `140mm fan count`, `180mm fan count`, `200mm fan count`
- `USB-A 2.0 count`, `USB-A 3.2 count`, `USB-C count`
- `Radiator 120mm`, `Radiator 140mm`, `Radiator 200mm`, `Radiator 240mm`, `Radiator 280mm`, `Radiator 360mm`, `Radiator 420mm`, `Radiator top hat`
- `3.5mm jack`, `Price (USD)`

Unknown columns fail validation. The loader owns `Seller`, `Status`, and `Release year`; do not include them. Creator becomes Seller. Unreleased files map to unavailable and sort below available cases. Every printed case has a dismissible print-tolerance advisory, even before a GPU is selected.

## Value vocabulary

- **GPU Riser:** `Y` (required), `-` (riserless/none), or `Optional`.
- **PSU:** `SFX`, `SFX / SFX-L`, `Flex ATX`, `DC-ATX`, `External`, or `Custom`. Non-standard internal units such as HDPlex GaN use `Custom`; name the unit in `printNotes`.
- **Motherboard:** `mITX`, `mITX / mATX`, or `mSTX`.
- **Case material:** filament, such as `PETG`.

## Fetch the thread

Replace `<id>` with the Reddit thread ID:

```sh
mkdir -p .data/reddit && curl -sL -A "linux:sff-builder:v0.1" "https://www.reddit.com/r/sffpc/comments/<id>/.json?raw_json=1" -o .data/reddit/<id>.json
```

If the result is not JSON, Reddit blocked this network: previously observed responses include 403, CAPTCHA, and “blocked by network security.” Open the same `.json` URL in your own logged-in browser and save it to `.data/reddit/<id>.json`. Do not scrape alternate sources or invent missing data.

## Extract with jq

Post:

```sh
jq '.[0].data.children[0].data | {title, author, permalink, created_utc, url, selftext, gallery: [.gallery_data.items[]? | {media_id, caption}], mime: ((.media_metadata // {}) | map_values(.m))}' .data/reddit/<id>.json
```

Creator comments often contain the spec list:

```sh
jq --arg op "<author>" '[.. | objects | select(.kind? == "t1") | .data | select(.author == $op) | .body]' .data/reddit/<id>.json
```

For galleries, hotlink `https://i.redd.it/<media_id>.<ext>`, with the extension from the image MIME type (`image/jpeg` → `jpg`, `image/png` → `png`, `image/webp` → `webp`). For single-image posts, use `.url` when its host is `i.redd.it`. Keep captions and creator attribution. Verify images render in the selected case card. If a real `i.redd.it` image refuses cross-site loading, use `media_metadata[id].s.u` (`preview.redd.it`, already unescaped by `raw_json=1`) instead. Do not add R2 storage.

## Field mapping

- `creator`: `u/<author>`; `creatorUrl`: `https://www.reddit.com/user/<author>`.
- `sourceUrl`: `https://www.reddit.com<permalink>`.
- `postedAt`: UTC date of `created_utc`.
- `Case`: creator's project name, otherwise `<volume>L <distinguishing feature from the title>`.
- `files`: Printables/MakerWorld/Thingiverse/GitHub print-file link → `published`, with the license as written on that page; “DM me” or “on request” → `on-request`; otherwise `unreleased`.
- `printNotes`: material, print bed size, inserts, unusual PSU, and other creator-reported build requirements.

## Reference build IDs

Look up exact models in local D1:

```sh
npx wrangler d1 execute sff-builder --local --command "select id, brand, name from gpus where normalized_search_text like '%4060%' limit 20"
```

Repeat for `psus`, `cpu_coolers`, `motherboards`, and `ram`. Use only exact model matches, in slots `gpu`, `psu`, `cpu-cooler`, `motherboard`, and `ram`. Put unmatched hardware, including CPU (not a slot), in `referenceBuild.notes`. Never choose a similar part to fill a slot. “Load creator's build” replaces the whole current selection. Stale IDs use the existing unresolved-selection state.

## Rebuild and check

```sh
npm run intake:sql && npm run db:migrate:local && npm run db:seed:local && npm run catalog:browser
```

Open `/build?kind=case&case-source=printed`. Check credit and source link in desktop table, mobile card, and selected card; images and photo credit; file status; creator-build URL; and search for `printed` with no source filter. `case-source=printable` includes only published files; `commercial` excludes printed rows. Unknown values remain conditional and parts stay selectable.

Production needs no extra command: `cf:deploy:prod` runs `intake` plus `intake:sql`, which merge `data/printed-cases/` at SQL generation. Printed entries never enter `.data/intake-snapshot.json`. The artifact content hash changes automatically after metadata changes.

## First import

`data/printed-cases/kowlick-riserless-3-5l.json` records [u/kowlick's Riserless 3.5L](https://www.reddit.com/r/sffpc/comments/1wxsonn/35l_3dprinted_case_riserless_4060_amd_7600_hdplex/) from user-supplied thread JSON. The post reports 212 × 192 × 86 mm; the creator confirms PETG and 3mm walls in a comment. Files remain unreleased. Only the HDPLEX 250W GaN PSU has an exact catalog match; unspecified hardware models remain notes, not guessed selections. Clearance limits and fan count remain absent. Three original `i.redd.it` photos rendered successfully in the selected card during the local browser check.
