/**
 * Fitment Engine — pure TypeScript fitment evaluation.
 *
 * No Astro, D1, URL state, APIContext, table columns, or cellIndex.
 * All checks are pure functions over domain types.
 */

import type { CasePart, GenericPart, GpuPart } from "../types";
import {
  dimensionNumber,
  dimensionOrSpecNumber,
  formatValue,
  motherboardFormFactor,
  normalizeSpecToken,
  specValue,
} from "../lib/generic-part";
import type {
  BuildContext,
  FitmentDecision,
  FitmentDecisionVerdict,
  FitmentEvidence,
} from "./types";

export type { BuildContext } from "./types";

// ---------------------------------------------------------------------------
// Token aliases (fitment-domain, not generic-enough for generic-part.ts)
// ---------------------------------------------------------------------------

const psuTokenAliases: Record<string, string> = {
  sfx: "sfx",
  sfxl: "sfxl",
  flexatx: "flexatx",
  flex: "flexatx",
  atx: "atx",
  tfx: "tfx",
  dcatx: "dcatx",
  dc: "dcatx",
  external: "external",
  custom: "custom",
  "1u": "1u",
};

const motherboardTokenAliases: Record<string, string> = {
  mitx: "mitx",
  miniitx: "mitx",
  matx: "matx",
  microatx: "matx",
  mdtx: "mdtx",
  minidtx: "mdtx",
  atx: "atx",
  eatx: "eatx",
  mstx: "mstx",
  ministx: "mstx",
  ssiceb: "ssiceb",
  ssieeb: "ssieeb",
  xlatx: "xlatx",
  custom: "custom",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSupportTokens(
  value: string,
  aliases: Record<string, string>,
): Set<string> {
  const tokens = new Set<string>();
  value
    .replace(/\([^)]*\)/g, "")
    .split(/[\/,+]/)
    .map((token) => {
      const norm = normalizeSpecToken(token);
      return aliases[norm] ?? "";
    })
    .filter(Boolean)
    .forEach((token) => tokens.add(token));
  return tokens;
}

function canonicalToken(value: string, aliases: Record<string, string>) {
  return aliases[normalizeSpecToken(value)] ?? "";
}

const TIGHT_FIT_MM = 5;

// ---------------------------------------------------------------------------
// Individual pair checks (pure)
// ---------------------------------------------------------------------------

/**
 * Evaluate GPU fitment against a case.
 * Returns an array of evidence (can be advisory, conditional, or fail).
 */
export function evaluateGpuAgainstCase(
  gpu: GpuPart,
  casePart: CasePart,
): FitmentEvidence[] {
  const evidence: FitmentEvidence[] = [];

  // --- Bounding-box checks ---

  if (
    casePart.dimensions.gpuLengthMm === null &&
    casePart.dimensions.pcieSlots === null
  ) {
    evidence.push({
      code: "possibly-no-discrete-gpu-support",
      verdict: "conditional",
      message:
        "This case may not support a discrete GPU; the source row does not list a clear GPU bay.",
      subject: "case",
    });
  }

  if (
    !gpu.lowProfile &&
    (casePart.dimensions.lpPcieSlots ?? 0) > 0 &&
    (casePart.dimensions.pcieSlots ?? 0) === 0
  ) {
    evidence.push({
      code: "low-profile-only",
      verdict: "fail",
      message: "This case appears to support low-profile GPUs only.",
      metric: "pcieSlots",
      subject: "case",
    });
  }

  if (casePart.style.toLowerCase() === "sandwich") {
    evidence.push({
      code: "sandwich-layout-mode",
      verdict: "conditional",
      message:
        "Sandwich layout clearances can change with GPU slot mode; verify the selected mode.",
      subject: "case",
      advisory: true,
    });
  }

  if (casePart.gpuRiser === "Y") {
    evidence.push({
      code: "requires-riser",
      verdict: "conditional",
      message: "This case requires a GPU riser.",
      subject: "case",
      advisory: true,
    });
  }

  if (casePart.gpuRiser === "Optional") {
    evidence.push({
      code: "riser-optional",
      verdict: "conditional",
      message:
        "GPU riser support is optional or configuration-dependent.",
      subject: "case",
      advisory: true,
    });
  }

  if (gpu.watercooled) {
    evidence.push({
      code: "watercooled-gpu",
      verdict: "conditional",
      message:
        "This GPU is watercooled; radiator, tubing, and pump clearance are not validated.",
      subject: "gpu",
      advisory: true,
    });
  }

  if (
    gpu.pciePins &&
    gpu.pciePins !== "-" &&
    /(dc-atx|external|flex)/i.test(casePart.psu)
  ) {
    evidence.push({
      code: "power-connector-psu-warning",
      verdict: "conditional",
      message: `GPU needs PCIe power (${gpu.pciePins}); PSU support is not validated for ${casePart.psu}.`,
      subject: "case",
      advisory: true,
    });
  }

  if (casePart.status) {
    evidence.push({
      code: "case-status",
      verdict: "conditional",
      message: `Case status from source list: ${casePart.status}.`,
      subject: "case",
      advisory: true,
    });
  }

  // --- Dimensional comparisons ---

  const dimCountBefore = evidence.length;

  compareMaxDimension(
    evidence,
    "gpuLengthMm",
    "GPU length",
    gpu.dimensions.lengthMm,
    casePart.dimensions.gpuLengthMm,
    { metricKey: "gpuLengthMm", tightFitThreshold: 2, subject: "gpu" },
  );
  compareMaxDimension(
    evidence,
    "gpuWidthMm",
    "GPU width",
    gpu.dimensions.widthMm,
    casePart.dimensions.gpuWidthMm,
    { metricKey: "gpuWidthMm", subject: "gpu" },
  );
  compareMaxDimension(
    evidence,
    "gpuThicknessMm",
    "GPU thickness",
    gpu.dimensions.thicknessMm,
    casePart.dimensions.gpuThicknessMm,
    { metricKey: "gpuThicknessMm", subject: "gpu" },
  );
  compareMaxDimension(
    evidence,
    "pcieSlots",
    "PCIe bracket slot count",
    gpu.dimensions.pcieSlots,
    casePart.dimensions.pcieSlots,
    { metricKey: "pcieSlots", tightFitThreshold: 0, subject: "gpu" },
  );

  // Add a pass signal if all dimension checks cleared (no new evidence was added
  // that is non-pass, non-advisory) and there are no hard issues.
  const newHardEvidence = evidence.slice(dimCountBefore).filter(
    (e) => e.verdict !== "pass" && !e.advisory,
  );
  if (!newHardEvidence.length && !evidence.some((e) => e.verdict === "fail")) {
    evidence.push({
      code: "gpu-dimensions-fit",
      verdict: "pass",
      message: "GPU dimensions fit the case GPU envelope.",
      subject: "gpu",
    });
  }

  return evidence;
}

function compareMaxDimension(
  evidence: FitmentEvidence[],
  code: string,
  label: string,
  used: number | null,
  limit: number | null,
  opts?: {
    tightFitThreshold?: number;
    metricKey?: string;
    subject?: string;
  },
) {
  const tightFitThreshold = opts?.tightFitThreshold ?? TIGHT_FIT_MM;
  const metric = opts?.metricKey;
  const subject = opts?.subject;

  if (used === null || limit === null) {
    evidence.push({
      code: `unknown-${code}`,
      verdict: "conditional",
      message: `${label} cannot be fully checked because the source data is incomplete.`,
      metric,
      subject,
    });
    return;
  }

  const clearance = limit - used;

  if (clearance < 0) {
    evidence.push({
      code: `exceeds-${code}`,
      verdict: "fail",
      message: `${label} exceeds the case limit by ${Math.abs(clearance)}mm.`,
      metric,
      subject,
    });
    return;
  }

  if (tightFitThreshold > 0 && clearance <= tightFitThreshold) {
    evidence.push({
      code: `tight-${code}`,
      verdict: "pass",
      message: `${label} has only ${clearance}mm of clearance.`,
      metric,
      subject,
      advisory: true,
    });
  }
}

/**
 * Evaluate CPU cooler height against case max.
 */
export function evaluateCpuCoolerAgainstCase(
  cooler: GenericPart,
  casePart: CasePart,
): FitmentEvidence {
  const maxHeight = casePart.dimensions.cpuCoolerHeightMm;
  const coolerHeight = dimensionNumber(cooler, [
    "height",
    "height_mm",
    "cooler_height",
  ]);

  if (!maxHeight) {
    return {
      code: "unknown-case-cooler-limit",
      verdict: "conditional",
      message: "Case CPU cooler height limit is unknown.",
      metric: "coolerHeight",
      subject: "case",
    };
  }

  if (coolerHeight === null) {
    return {
      code: "unknown-cooler-height",
      verdict: "conditional",
      message: `Cooler height is unknown; case max is ${formatValue(maxHeight, "mm")}.`,
      metric: "coolerHeight",
      subject: "cpu-cooler",
    };
  }

  if (coolerHeight > maxHeight) {
    return {
      code: "cooler-height-exceeds",
      verdict: "fail",
      message: `Cooler height ${formatValue(coolerHeight, "mm")} exceeds case max ${formatValue(maxHeight, "mm")}.`,
      metric: "coolerHeight",
      subject: "cpu-cooler",
    };
  }

  return {
    code: "cooler-height-fits",
    verdict: "pass",
    message: `Cooler height ${formatValue(coolerHeight, "mm")} fits case max ${formatValue(maxHeight, "mm")}.`,
    subject: "cpu-cooler",
  };
}

/**
 * Evaluate PSU form factor against case support.
 */
export function evaluatePsuAgainstCase(
  psu: GenericPart,
  casePart: CasePart,
): FitmentEvidence {
  const caseSupport = casePart.psu;
  const psuFormFactor = specValue(psu, ["form_factor", "psu"]);
  const caseTokens = parseSupportTokens(caseSupport, psuTokenAliases);
  const psuToken = canonicalToken(psuFormFactor, psuTokenAliases);

  if (!caseTokens.size || !psuToken) {
    return {
      code: "unknown-psu-form-factor",
      verdict: "conditional",
      message: `PSU form factor cannot be fully checked; case support is "${caseSupport || "unknown"}" and PSU form factor is "${psuFormFactor || "unknown"}".`,
      metric: "psuFormFactor",
      subject: "psu",
    };
  }

  if (psuToken === "custom" || caseTokens.has("custom")) {
    return {
      code: "custom-psu",
      verdict: "conditional",
      message: `Custom PSU support requires manual verification (${psuFormFactor} in ${caseSupport}).`,
      metric: "psuFormFactor",
      subject: "psu",
    };
  }

  if (caseTokens.has(psuToken)) {
    return {
      code: "psu-form-factor-fits",
      verdict: "pass",
      message: `PSU form factor ${psuFormFactor} is supported by case envelope ${caseSupport}.`,
      metric: "psuFormFactor",
      subject: "psu",
    };
  }

  return {
    code: "psu-form-factor-mismatch",
    verdict: "fail",
    message: `PSU form factor ${psuFormFactor} is not supported by case envelope ${caseSupport}.`,
    metric: "psuFormFactor",
    subject: "psu",
  };
}

/**
 * Evaluate motherboard form factor against case support.
 */
export function evaluateMotherboardAgainstCase(
  motherboard: GenericPart,
  casePart: CasePart,
): FitmentEvidence {
  const caseSupport = casePart.motherboard;
  const boardFormFactor = motherboardFormFactor(motherboard);
  const caseTokens = parseSupportTokens(caseSupport, motherboardTokenAliases);
  const boardToken = canonicalToken(boardFormFactor, motherboardTokenAliases);

  if (!caseTokens.size || !boardToken) {
    return {
      code: "unknown-motherboard-form-factor",
      verdict: "conditional",
      message: `Motherboard form factor cannot be fully checked; case support is "${caseSupport || "unknown"}" and board form factor is "${boardFormFactor || "unknown"}".`,
      metric: "motherboardFormFactor",
      subject: "motherboard",
    };
  }

  if (caseTokens.has("custom") || boardToken === "custom") {
    return {
      code: "custom-motherboard",
      verdict: "conditional",
      message: `Custom motherboard support requires manual verification (${boardFormFactor} in ${caseSupport}).`,
      metric: "motherboardFormFactor",
      subject: "motherboard",
    };
  }

  if (caseTokens.has(boardToken)) {
    return {
      code: "motherboard-form-factor-fits",
      verdict: "pass",
      message: `Motherboard form factor ${boardFormFactor} is supported by case envelope ${caseSupport}.`,
      metric: "motherboardFormFactor",
      subject: "motherboard",
    };
  }

  return {
    code: "motherboard-form-factor-mismatch",
    verdict: "fail",
    message: `Motherboard form factor ${boardFormFactor} is not supported by case envelope ${caseSupport}.`,
    metric: "motherboardFormFactor",
    subject: "motherboard",
  };
}

/**
 * Evaluate RAM type against motherboard support.
 */
export function evaluateRamAgainstMotherboard(
  ram: GenericPart,
  motherboard: GenericPart,
): FitmentEvidence {
  const ramType = specValue(ram, ["memory_type"]);
  const motherboardRamType = specValue(motherboard, ["ram_type"]);

  if (!ramType || !motherboardRamType) {
    return {
      code: "unknown-ram-type",
      verdict: "conditional",
      message: `RAM type cannot be fully checked; RAM is "${ramType || "unknown"}" and motherboard requires "${motherboardRamType || "unknown"}".`,
      metric: "ramType",
      subject: "ram",
    };
  }

  if (
    normalizeSpecToken(ramType) === normalizeSpecToken(motherboardRamType)
  ) {
    return {
      code: "ram-type-fits",
      verdict: "pass",
      message: `${ramType} RAM matches motherboard memory type ${motherboardRamType}.`,
      metric: "ramType",
      subject: "ram",
    };
  }

  return {
    code: "ram-type-mismatch",
    verdict: "fail",
    message: `${ramType} RAM does not match motherboard memory type ${motherboardRamType}.`,
    metric: "ramType",
    subject: "ram",
  };
}

/**
 * Evaluate RAM height against CPU cooler RAM clearance.
 */
export function evaluateRamAgainstCpuCooler(
  ram: GenericPart,
  cooler: GenericPart,
): FitmentEvidence {
  const ramHeight = dimensionNumber(ram, [
    "height_incl_contact_pins",
    "height",
  ]);
  const clearanceText = specValue(cooler, ["ram_clearance"]);
  const clearance = dimensionOrSpecNumber(cooler, ["ram_clearance"]);

  if (/no\s*limit/i.test(clearanceText)) {
    return {
      code: "cooler-no-ram-limit",
      verdict: "pass",
      message: "CPU cooler lists no RAM height limit.",
      metric: "ramHeight",
      subject: "ram",
    };
  }

  if (ramHeight === null || clearance === null) {
    return {
      code: "unknown-ram-clearance",
      verdict: "conditional",
      message: `RAM clearance cannot be fully checked; RAM height is ${formatValue(ramHeight, "mm")} and cooler clearance is ${clearanceText || "unknown"}.`,
      metric: "ramHeight",
      subject: "ram",
    };
  }

  if (ramHeight > clearance) {
    return {
      code: "ram-height-exceeds",
      verdict: "fail",
      message: `RAM height ${formatValue(ramHeight, "mm")} exceeds CPU cooler RAM clearance ${formatValue(clearance, "mm")}.`,
      metric: "ramHeight",
      subject: "ram",
    };
  }

  return {
    code: "ram-height-fits",
    verdict: "pass",
    message: `RAM height ${formatValue(ramHeight, "mm")} fits CPU cooler RAM clearance ${formatValue(clearance, "mm")}.`,
    metric: "ramHeight",
    subject: "ram",
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/**
 * Combine a list of evidence items into a single decision verdict.
 * "fail" wins over "conditional" wins over "pass" wins over "unscored".
 * Conditional advisories count as conditional because practical build risk
 * must remain visible in the fitment decision.
 */
export function summarizeEvidence(
  evidence: FitmentEvidence[],
): FitmentDecisionVerdict {
  if (!evidence.length) return "unscored";
  // Fail always wins
  if (evidence.some((e) => e.verdict === "fail")) return "fail";
  // Conditional includes advisory conditional — treat as real conditional
  if (evidence.some((e) => e.verdict === "conditional")) return "conditional";
  return "pass";
}

// ---------------------------------------------------------------------------
// Main entry points
// ---------------------------------------------------------------------------

/**
 * Evaluate fitment for a candidate part against a build context.
 */
export function evaluateCandidateFitment(
  build: BuildContext,
  candidate: CasePart | GpuPart | GenericPart,
): FitmentDecision {
  const evidence: FitmentEvidence[] = [];

  if (candidate.kind === "case") {
    if (build.activeGpu)
      evidence.push(
        ...evaluateGpuAgainstCase(build.activeGpu, candidate as CasePart),
      );
    if (build.activeCpuCooler)
      evidence.push(
        evaluateCpuCoolerAgainstCase(
          build.activeCpuCooler,
          candidate as CasePart,
        ),
      );
    if (build.activePsu)
      evidence.push(evaluatePsuAgainstCase(build.activePsu, candidate as CasePart));
    if (build.activeMotherboard)
      evidence.push(
        evaluateMotherboardAgainstCase(
          build.activeMotherboard,
          candidate as CasePart,
        ),
      );
  } else if (candidate.kind === "gpu") {
    if (build.activeCase)
      evidence.push(
        ...evaluateGpuAgainstCase(candidate as GpuPart, build.activeCase),
      );
  } else if (candidate.kind === "cpu-cooler") {
    if (build.activeCase)
      evidence.push(
        evaluateCpuCoolerAgainstCase(
          candidate as GenericPart,
          build.activeCase,
        ),
      );
    if (build.activeRam)
      evidence.push(
        evaluateRamAgainstCpuCooler(
          build.activeRam,
          candidate as GenericPart,
        ),
      );
  } else if (candidate.kind === "psu") {
    if (build.activeCase)
      evidence.push(
        evaluatePsuAgainstCase(candidate as GenericPart, build.activeCase),
      );
  } else if (candidate.kind === "motherboard") {
    if (build.activeCase)
      evidence.push(
        evaluateMotherboardAgainstCase(
          candidate as GenericPart,
          build.activeCase,
        ),
      );
    if (build.activeRam)
      evidence.push(
        evaluateRamAgainstMotherboard(
          build.activeRam,
          candidate as GenericPart,
        ),
      );
  } else if (candidate.kind === "ram") {
    if (build.activeMotherboard)
      evidence.push(
        evaluateRamAgainstMotherboard(
          candidate as GenericPart,
          build.activeMotherboard,
        ),
      );
    if (build.activeCpuCooler)
      evidence.push(
        evaluateRamAgainstCpuCooler(
          candidate as GenericPart,
          build.activeCpuCooler,
        ),
      );
  }

  return {
    verdict: summarizeEvidence(evidence),
    evidence,
  };
}

/**
 * Evaluate fitment for an entire build.
 */
export function evaluateBuildFitment(
  build: BuildContext,
): { verdict: FitmentDecisionVerdict; evidence: FitmentEvidence[] } {
  const allEvidence: FitmentEvidence[] = [];

  if (build.activeCase && build.activeGpu) {
    allEvidence.push(
      ...evaluateGpuAgainstCase(build.activeGpu, build.activeCase),
    );
  }
  if (build.activeCase && build.activeCpuCooler) {
    allEvidence.push(
      evaluateCpuCoolerAgainstCase(build.activeCpuCooler, build.activeCase),
    );
  }
  if (build.activeCase && build.activePsu) {
    allEvidence.push(evaluatePsuAgainstCase(build.activePsu, build.activeCase));
  }
  if (build.activeCase && build.activeMotherboard) {
    allEvidence.push(
      evaluateMotherboardAgainstCase(
        build.activeMotherboard,
        build.activeCase,
      ),
    );
  }
  if (build.activeMotherboard && build.activeRam) {
    allEvidence.push(
      evaluateRamAgainstMotherboard(build.activeRam, build.activeMotherboard),
    );
  }
  if (build.activeCpuCooler && build.activeRam) {
    allEvidence.push(
      evaluateRamAgainstCpuCooler(build.activeRam, build.activeCpuCooler),
    );
  }

  return {
    verdict: summarizeEvidence(allEvidence),
    evidence: allEvidence,
  };
}
