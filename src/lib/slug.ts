export function generateSlug(brand: string, name: string): string {
  const combined = `${brand} ${name}`.toLowerCase();
  let slug = combined
    .replace(/[\s_/]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) slug = "unknown";
  return slug;
}

export function uniqueSlug(brand: string, name: string, existingSlugs: Set<string>): string {
  const base = generateSlug(brand, name);
  let slug = base;
  let counter = 2;
  while (existingSlugs.has(slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  existingSlugs.add(slug);
  return slug;
}
