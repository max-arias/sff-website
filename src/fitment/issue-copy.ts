/**
 * Friendly copy for fitment evidence codes.
 *
 * Engine evidence carries a stable `code` plus a detailed sentence that often
 * interpolates measurements. This map owns the short heading rendered wherever
 * issues are listed (each part's issue list, the ignored-warning list), so
 * warning copy can change without touching engine rules.
 *
 * Codes produced by `compareMaxDimension` are families — `unknown-<metric>`,
 * `exceeds-<metric>`, `tight-<metric>` — and compose their heading from the
 * metric's human label. Anything unmapped falls back to the caller's text.
 */

const ISSUE_TITLES: Record<string, string> = {
  "possibly-no-discrete-gpu-support": "Discrete GPU support unclear",
  "low-profile-only": "Low-profile GPUs only",
  "sandwich-layout-mode": "Sandwich layout mode",
  "requires-riser": "GPU riser cable required",
  "riser-optional": "GPU riser optional",
  "watercooled-gpu": "Watercooled GPU",
  "power-connector-psu-warning": "GPU power connector",
  "case-status": "Case status note",
  "unknown-case-cooler-limit": "Cooler height limit unknown",
  "unknown-cooler-height": "Cooler height unknown",
  "cooler-height-exceeds": "Cooler height exceeds case limit",
  "unknown-psu-form-factor": "PSU form factor unknown",
  "custom-psu": "Custom PSU support",
  "psu-form-factor-mismatch": "PSU form factor mismatch",
  "unknown-motherboard-form-factor": "Unknown form factor",
  "custom-motherboard": "Custom motherboard support",
  "motherboard-form-factor-mismatch": "Motherboard form factor mismatch",
  "unknown-ram-type": "RAM type unknown",
  "ram-type-mismatch": "RAM type mismatch",
  "unknown-ram-clearance": "RAM clearance unknown",
  "ram-height-exceeds": "RAM height exceeds cooler clearance",
};

/** Metric keys used by `compareMaxDimension`, in the order they are checked. */
const METRIC_LABELS: Record<string, string> = {
  gpuLengthMm: "GPU length",
  gpuWidthMm: "GPU width",
  gpuThicknessMm: "GPU thickness",
  pcieSlots: "PCIe slot count",
};

const METERED_TITLES: Record<string, (label: string) => string> = {
  unknown: (label) => `${label} not fully verifiable`,
  exceeds: (label) => `${label} exceeds case limit`,
  tight: (label) => `${label} clearance is tight`,
};

/**
 * Heading for an evidence code, falling back to `fallback` when the code has
 * no mapping (for example a new engine rule that has not been given copy yet).
 */
export function issueTitle(code: string, fallback: string): string {
  const known = ISSUE_TITLES[code];
  if (known) return known;

  const separator = code.indexOf("-");
  if (separator > 0) {
    const form = METERED_TITLES[code.slice(0, separator)];
    const label = METRIC_LABELS[code.slice(separator + 1)];
    if (form && label) return form(label);
  }

  return fallback;
}

/** Heading for a stored code with no evidence in hand, such as a stale ignore. */
export function issueTitleForCode(code: string): string {
  return issueTitle(code, code.replace(/-/g, " "));
}

/**
 * The detail line for an issue, or "" when the heading already carries it.
 * A one-line finding such as "Unknown form factor" should read as one line
 * rather than the same sentence twice.
 */
export function issueDetail(title: string, message: string): string {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[.\s]+$/, "").replace(/\s+/g, " ");
  return normalize(title) === normalize(message) ? "" : message;
}
