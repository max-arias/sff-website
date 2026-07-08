import type { CasePart, CompatibilityIssue, CompatibilityResult, GpuPart } from "../types";

const TIGHT_FIT_MM = 5;

function addIssue(
  issues: CompatibilityIssue[],
  code: string,
  severity: CompatibilityIssue["severity"],
  message: string
) {
  issues.push({ code, severity, message });
}

function compareMax(
  issues: CompatibilityIssue[],
  clearances: CompatibilityResult["clearances"],
  key: keyof CompatibilityResult["clearances"],
  label: string,
  used: number | null,
  limit: number | null,
  opts?: { tightFitThreshold?: number }
) {
  const tightFitThreshold = opts?.tightFitThreshold ?? TIGHT_FIT_MM;

  if (used === null || limit === null) {
    addIssue(
      issues,
      `unknown-${key}`,
      "warning",
      `${label} cannot be fully checked because the source data is incomplete.`
    );
    clearances[key] = null;
    return;
  }

  const clearance = limit - used;
  clearances[key] = clearance;

  if (clearance < 0) {
    addIssue(issues, `exceeds-${key}`, "error", `${label} exceeds the case limit by ${Math.abs(clearance)}mm.`);
    return;
  }

  if (tightFitThreshold > 0 && clearance <= tightFitThreshold) {
    addIssue(issues, `tight-${key}`, "warning", `${label} has only ${clearance}mm of clearance.`);
  }
}

export function checkCaseGpuCompatibility(
  casePart: CasePart,
  gpuPart: GpuPart
): CompatibilityResult {
  const issues: CompatibilityIssue[] = [];
  const clearances: CompatibilityResult["clearances"] = {
    gpuLengthMm: null,
    gpuWidthMm: null,
    gpuThicknessMm: null,
    pcieSlots: null
  };

  if (casePart.dimensions.gpuLengthMm === null && casePart.dimensions.pcieSlots === null) {
    addIssue(
      issues,
      "possibly-no-discrete-gpu-support",
      "warning",
      "This case may not support a discrete GPU; the source row does not list a clear GPU bay."
    );
  }

  if (!gpuPart.lowProfile && (casePart.dimensions.lpPcieSlots ?? 0) > 0 && (casePart.dimensions.pcieSlots ?? 0) === 0) {
    addIssue(issues, "low-profile-only", "error", "This case appears to support low-profile GPUs only.");
  }

  if (casePart.style.toLowerCase() === "sandwich") {
    addIssue(
      issues,
      "sandwich-layout-mode",
      "warning",
      "Sandwich layout clearances can change with GPU slot mode; verify the selected mode."
    );
  }

  if (casePart.gpuRiser === "Y") {
    addIssue(issues, "requires-riser", "warning", "This case requires a GPU riser.");
  }

  if (casePart.gpuRiser === "Optional") {
    addIssue(issues, "riser-optional", "warning", "GPU riser support is optional or configuration-dependent.");
  }

  if (gpuPart.watercooled) {
    addIssue(
      issues,
      "watercooled-gpu",
      "warning",
      "This GPU is watercooled; radiator, tubing, and pump clearance are not validated."
    );
  }

  if (gpuPart.pciePins && gpuPart.pciePins !== "-" && /(dc-atx|external|flex)/i.test(casePart.psu)) {
    addIssue(
      issues,
      "power-connector-psu-warning",
      "warning",
      `GPU needs PCIe power (${gpuPart.pciePins}); PSU support is not validated for ${casePart.psu}.`
    );
  }

  if (casePart.status) {
    addIssue(issues, "case-status", "warning", `Case status from source list: ${casePart.status}.`);
  }

  compareMax(issues, clearances, "gpuLengthMm", "GPU length", gpuPart.dimensions.lengthMm, casePart.dimensions.gpuLengthMm, { tightFitThreshold: 2 });
  compareMax(issues, clearances, "gpuWidthMm", "GPU width", gpuPart.dimensions.widthMm, casePart.dimensions.gpuWidthMm);
  compareMax(
    issues,
    clearances,
    "gpuThicknessMm",
    "GPU thickness",
    gpuPart.dimensions.thicknessMm,
    casePart.dimensions.gpuThicknessMm
  );
  compareMax(issues, clearances, "pcieSlots", "PCIe bracket slot count", gpuPart.dimensions.pcieSlots, casePart.dimensions.pcieSlots, { tightFitThreshold: 0 });

  const hasError = issues.some((issue) => issue.severity === "error");
  const hasWarning = issues.some((issue) => issue.severity === "warning");

  return {
    verdict: hasError ? "fail" : hasWarning ? "conditional" : "pass",
    issues,
    clearances
  };
}
