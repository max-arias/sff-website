/**
 * Browser-local storage for always-ignored fitment warnings.
 *
 * Storage is best-effort: private-mode and quota failures degrade to "nothing
 * ignored" rather than breaking the build page, and a corrupt or older payload
 * is discarded instead of throwing.
 *
 * Browser-only. The catalog worker imports `./ignored-warnings` instead.
 */

const storageKey = "sff.ignored-warnings";
const storageVersion = 1;

export function parseIgnoredWarnings(raw: string | null): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const payload = parsed as { version?: unknown; codes?: unknown };
  if (payload.version !== storageVersion || !Array.isArray(payload.codes)) {
    return [];
  }
  const codes = new Set<string>();
  for (const code of payload.codes) {
    if (typeof code === "string" && code) codes.add(code);
  }
  return [...codes];
}

export function readIgnoredWarnings(): string[] {
  try {
    return parseIgnoredWarnings(window.localStorage.getItem(storageKey));
  } catch {
    return [];
  }
}

export function writeIgnoredWarnings(codes: readonly string[]): void {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ version: storageVersion, codes }),
    );
  } catch {
    // Storage unavailable; the ignore still applies for this session.
  }
}
