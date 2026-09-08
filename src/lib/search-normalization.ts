/** Stable catalog search key shared by intake and D1 query policy. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function searchablePartText(
  brand: string,
  name: string,
  extras: string[] = [],
): string {
  return normalizeSearchText([brand, name, ...extras].filter(Boolean).join(" "));
}
