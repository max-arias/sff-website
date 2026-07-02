import type { PsuTierEntry } from "../types";

export const PSU_TIER_LIST_SHEET_ID = "1akCHL7Vhzk_EhrpIGkz8zTEvYfLDcaSpZRB6Xt6JWkc";
export const PSU_TIER_LIST_SOURCE_URL = `https://docs.google.com/spreadsheets/d/${PSU_TIER_LIST_SHEET_ID}/edit`;
export const PSU_TIER_MAIN_SHEET = "Main List (Proper Ratings Only)";

const PSU_TIER_MAIN_CSV_URL = `https://docs.google.com/spreadsheets/d/${PSU_TIER_LIST_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(PSU_TIER_MAIN_SHEET)}`;

type ParsedCsvRow = string[];

function parseCsv(csv: string): ParsedCsvRow[] {
  const rows: ParsedCsvRow[] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (quoted) {
      if (char === "\"" && next === "\"") {
        value += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function clean(value: string | undefined) {
  return (value ?? "").trim();
}

function meaningful(value: string) {
  const normalized = value.trim();
  return normalized && normalized !== "-";
}

export function normalizePsuMatchKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&/g, "and")
    .replace(/\bfully modular\b/g, "")
    .replace(/\bfull modular\b/g, "")
    .replace(/\bmodular\b/g, "")
    .replace(/\bpower supply\b/g, "")
    .replace(/\bpsu\b/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function tierRank(tier: string) {
  const normalized = tier.trim().toUpperCase();
  const letter = normalized[0];
  const baseRank = letter ? "ABCDEF".indexOf(letter) : -1;
  if (baseRank < 0) return null;

  const suffix = normalized.slice(1);
  const modifier = suffix.includes("+") ? -0.2 : suffix.includes("-") ? 0.2 : 0;
  return baseRank + modifier;
}

function wattageNumbers(value: string) {
  return [...value.matchAll(/\d{3,4}(?=\s*W|\s*\/|\s*-|$)/gi)].map((match) => match[0]);
}

function compactTokens(values: string[]) {
  return values.map((value) => value.trim()).filter(meaningful);
}

function suffixMatchVariants(value: string) {
  return [
    value,
    value.replace(/\b(19|20)\d{2}\b/g, " "),
    value.replace(/\b(19|20)\d{2}\b/g, " ").replace(/[()]/g, " ")
  ]
    .map((variant) => variant.trim())
    .filter(meaningful);
}

function entryDisplayName(brand: string, series: string, qualifier: string, variant: string, wattages: string) {
  const name = compactTokens([brand, series, qualifier, variant]).join(" ");
  return compactTokens([name, wattages]).join(" ");
}

function matchKeysForEntry(brand: string, series: string, qualifier: string, variant: string, wattages: string) {
  const suffixes = compactTokens([qualifier, variant]).flatMap(suffixMatchVariants);
  const baseNames = new Set<string>();
  const brandSeries = compactTokens([brand, series]).join(" ");

  if (brandSeries) baseNames.add(brandSeries);
  if (suffixes.length) {
    baseNames.add(compactTokens([brandSeries, ...suffixes]).join(" "));
    suffixes.forEach((suffix) => baseNames.add(compactTokens([brandSeries, suffix]).join(" ")));
  }

  const keys = new Set<string>();
  baseNames.forEach((baseName) => {
    keys.add(normalizePsuMatchKey(baseName));
    wattageNumbers(wattages).forEach((wattage) => {
      keys.add(normalizePsuMatchKey(`${baseName} ${wattage}W`));
      keys.add(normalizePsuMatchKey(`${baseName}${wattage}`));
      keys.add(normalizePsuMatchKey(`${brand} ${series}${wattage}`));
      keys.add(normalizePsuMatchKey(`${brand} ${series} ${wattage}`));
      if (suffixes.length) {
        keys.add(normalizePsuMatchKey(`${brand} ${series}${wattage} ${suffixes.join(" ")}`));
        keys.add(normalizePsuMatchKey(`${brand} ${series} ${wattage} ${suffixes.join(" ")}`));
        suffixes.forEach((suffix) => {
          keys.add(normalizePsuMatchKey(`${brand} ${series}${wattage} ${suffix}`));
          keys.add(normalizePsuMatchKey(`${brand} ${series} ${wattage} ${suffix}`));
        });
      }
    });
  });

  return [...keys].filter(Boolean);
}

function rowRaw(row: ParsedCsvRow) {
  return {
    brand: clean(row[0]),
    series: clean(row[1]),
    qualifier: clean(row[2]),
    variant: clean(row[3]),
    wattages: clean(row[4]),
    tier: clean(row[5]),
    introYear: clean(row[6]),
    formFactor: clean(row[7]),
    atxVersion: clean(row[8]),
    inputRange: clean(row[9]),
    modularity: clean(row[10]),
    efficiency: clean(row[11]),
    primaryTopology: clean(row[12]),
    secondaryRectifier: clean(row[13]),
    regulation: clean(row[14]),
    odm: clean(row[15]),
    platform: clean(row[16]),
    notes: clean(row[17]),
    rowId: clean(row[18])
  };
}

export function normalizePsuTierRows(rows: ParsedCsvRow[]): PsuTierEntry[] {
  let brand = "";
  let series = "";
  const entries: PsuTierEntry[] = [];

  rows.slice(1).forEach((row, index) => {
    const raw = rowRaw(row);
    if (raw.brand) brand = raw.brand;
    if (raw.series) series = raw.series;
    if (!brand || !series || !raw.tier) return;

    const displayName = entryDisplayName(brand, series, raw.qualifier, raw.variant, raw.wattages);

    entries.push({
      sourceSheet: PSU_TIER_MAIN_SHEET,
      rowNumber: index + 2,
      rowId: raw.rowId,
      brand,
      series,
      qualifier: raw.qualifier,
      variant: raw.variant,
      wattages: raw.wattages,
      tier: raw.tier,
      tierRank: tierRank(raw.tier),
      introYear: raw.introYear,
      formFactor: raw.formFactor,
      atxVersion: raw.atxVersion,
      inputRange: raw.inputRange,
      modularity: raw.modularity,
      efficiency: raw.efficiency,
      primaryTopology: raw.primaryTopology,
      secondaryRectifier: raw.secondaryRectifier,
      regulation: raw.regulation,
      odm: raw.odm,
      platform: raw.platform,
      notes: raw.notes,
      displayName,
      matchKeys: matchKeysForEntry(brand, series, raw.qualifier, raw.variant, raw.wattages),
      raw
    });
  });

  return entries;
}

export async function fetchPsuTierEntries(): Promise<PsuTierEntry[]> {
  const response = await fetch(PSU_TIER_MAIN_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch PSU tier list: ${response.status} ${response.statusText}`);
  }

  return normalizePsuTierRows(parseCsv(await response.text()));
}
