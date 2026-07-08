Type: grilling
Status: resolved

## Answer

### Slug generation algorithm — final specification

1. **Construction**: `normalize(brand) + "-" + normalize(name)` — no separate modifier extraction. The name column already carries the full model identifier, including variants (e.g., "RTX 4070 Windforce OC 12G" → `gigabyte-rtx-4070-windforce-oc-12g`).

2. **Normalization rules**:
   - Lowercase everything
   - Replace spaces, underscores, and slashes with hyphens
   - Strip special characters (parentheses, quotes, commas, etc.) — keep only `[a-z0-9]` and hyphens
   - Strip/transliterate non-ASCII characters (Chinese characters, trademark symbols)
   - Collapse multiple consecutive hyphens into one
   - Trim leading/trailing hyphens

3. **Collision resolution**: Append a numeric suffix (e.g., `formd-t1-2`) when a slug already exists in any table. This is a safety net — empirical check across all 3 case tabs (947 rows total) found **zero duplicate (Seller, Case) pairs**, so collisions are expected to be rare or nonexistent.

4. **Stability**: Slugs are **not stable across re-imports**. If the source sheet changes a part's name, it is treated as a new part and gets a new slug on the next import. Old URLs will hit Unresolved Slot handling, which is acceptable for v1. (The rationale: a name change in the authoritative source sheet represents a materially different part listing.)

5. **Cross-table uniqueness**: Slugs are **globally unique** across all 7 tables. The import pipeline checks for collisions across all tables and logs any conflicts. Example: `case=formd-t1` in URL state disambiguates by param key regardless, but global uniqueness simplifies the mental model.

### Verification

A duplicate check across all 947 case rows in the SFF Master List (<10L, 10L-20L, >20L tabs) confirmed zero duplicate (Seller, Case) combinations, both within and across tabs. The numeric collision fallback is a safety mechanism, not expected to activate in practice for cases. Other tables should be verified similarly before implementation.

## Question

What is the exact slug generation algorithm for the new URL-friendly IDs?

Decisions already made:
- Format: `brand-name-modifier` (modifier covers OC variants, special editions, etc.)
- Last-resort fallback: numeric suffix when everything else collides
- Uniqueness enforced at the database level

Still to decide:
1. **Normalization**: lowercase? Replace spaces with hyphens? Strip special characters? Handle non-ASCII characters?
2. **Modifier extraction**: How to detect and extract the modifier from the model name (e.g., "RTX 4070 OC Edition" → modifier "oc-edition")? Explicit source column? Pattern matching?
3. **Collision resolution**: When `brand-name` already exists, what's appended? Sequential number? Short hash? How is the fallback slug stored vs the canonical slug?
4. **Stability**: Does the slug persist across re-imports? If a part's name changes slightly in the source sheet, does the slug change?
5. **Cross-table**: Do slugs need to be unique across all tables, or just within each table?

Type: grilling
