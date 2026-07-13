import type { GenericPart } from "../types";

// ---------------------------------------------------------------------------
// Dimension accessors
// ---------------------------------------------------------------------------

/** Returns the first non-undefined dimension value, or null. */
export function dimensionNumber(
  part: GenericPart,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = part.dimensions[key];
    if (value !== undefined) return value;
  }
  return null;
}

/** Returns the first dimension as a formatted string, or "—". */
export function dimensionOrSpecValue(
  part: GenericPart,
  keys: string[],
  unit = "",
): string {
  const dimension = dimensionValue(part, keys, unit);
  return dimension !== "—" ? dimension : specValue(part, keys) || "—";
}

/** Returns the first dimension as a formatted string, or "—". */
export function dimensionValue(
  part: GenericPart,
  keys: string[],
  unit = "",
): string {
  for (const key of keys) {
    const value = part.dimensions[key];
    if (value !== undefined) return formatValue(value, unit);
  }
  return "—";
}

/** Returns the first dimension as number, falling back to parsing from spec. */
export function dimensionOrSpecNumber(
  part: GenericPart,
  keys: string[],
): number | null {
  const dimension = dimensionNumber(part, keys);
  if (dimension !== null) return dimension;
  for (const key of keys) {
    const match = specValue(part, [key]).match(/-?\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Spec accessors
// ---------------------------------------------------------------------------

function rawSpecValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Y" : "";
  return "";
}

/** Returns the first non-blank spec value (checks part.specs and part.raw). */
export function specValue(
  part: GenericPart,
  keys: string[],
  options?: { checkRaw?: boolean },
): string {
  const checkRaw = options?.checkRaw ?? true;
  for (const key of keys) {
    const raw = rawSpecValue(part.specs[key]) || (checkRaw ? rawSpecValue(part.raw[key]) : "");
    if (raw && !isBlankSpec(raw)) return raw;
  }
  return "";
}

/** Simpler spec accessor (only part.specs, no blank-filtering). Matches legacy sql.ts behavior. */
export function specRaw(part: GenericPart, keys: string[]): string {
  for (const key of keys) {
    const value = part.specs[key]?.trim();
    if (value) return value;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Yes/No accessor
// ---------------------------------------------------------------------------

export function yesNoValue(part: GenericPart, keys: string[]) {
  for (const key of keys) {
    const rawValue =
      rawSpecValue(part.specs[key]) || rawSpecValue(part.raw[key]);
    const value = rawValue.toLowerCase();
    if (!value || isBlankSpec(value)) continue;
    if (["y", "yes", "true", "1"].includes(value)) return "Yes";
    if (["n", "no", "false", "0"].includes(value)) return "—";
    return rawValue;
  }
  return "—";
}

// ---------------------------------------------------------------------------
// Motherboard form factor
// ---------------------------------------------------------------------------

export function motherboardFormFactor(part: GenericPart): string {
  const explicit = specValue(part, ["form_factor"]);
  if (explicit) return explicit;
  const source = part.sourceSheet.toLowerCase();
  if (source.includes("mitx")) return "mITX";
  if (source.includes("matx")) return "mATX";
  return "—";
}

// ---------------------------------------------------------------------------
// Token parsing helpers
// ---------------------------------------------------------------------------

export function normalizeSpecToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseSupportTokens(
  value: string,
  aliases: Record<string, string>,
) {
  const tokens = new Set<string>();
  value
    .replace(/\([^)]*\)/g, "")
    .split(/[\/,+]/)
    .map((token) => canonicalToken(token, aliases))
    .filter(Boolean)
    .forEach((token) => tokens.add(token));
  return tokens;
}

export function canonicalToken(
  value: string,
  aliases: Record<string, string>,
) {
  return aliases[normalizeSpecToken(value)] ?? "";
}

// ---------------------------------------------------------------------------
// Formatting / blank helpers
// ---------------------------------------------------------------------------

export function isBlankSpec(value: string) {
  return ["", "-", "?", "n/a", "na", "tbd"].includes(
    value.trim().toLowerCase(),
  );
}

export function formatValue(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined) return "—";
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
  return `${formatted}${unit}`;
}

export function footprintValue(part: GenericPart, unit = "") {
  const length = dimensionValue(part, ["length"], unit);
  const width = dimensionValue(part, ["width"], unit);
  if (length === "—" && width === "—") return "—";
  return `${length} x ${width}`;
}

// ---------------------------------------------------------------------------
// PSU tier rank
// ---------------------------------------------------------------------------

export function psuTierRank(label: string) {
  const tier = (label.match(/\bTier\s+([A-F][+-]?)/i)?.[1] ?? label)
    .trim()
    .toUpperCase();
  if (!tier) return 99;
  const letter = tier[0];
  const baseRank = "ABCDEF".indexOf(letter);
  if (baseRank < 0) return 99;
  const suffix = tier.slice(1);
  const modifier = suffix.includes("+") ? -0.2 : suffix.includes("-") ? 0.2 : 0;
  return baseRank + modifier;
}
