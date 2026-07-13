import type { CasePart, GenericPart, GpuPart } from "../types";

// ---------------------------------------------------------------------------
// Domain types for the fitment engine (pure, no UI concerns)
// ---------------------------------------------------------------------------

export type FitmentVerdict = "pass" | "conditional" | "fail" | "unscored";

export interface FitmentEvidence {
  code: string;
  verdict: FitmentVerdict;
  message: string;
  /** Part-kind slots this evidence applies to (e.g. ["gpu", "case"]). */
  slots?: string[];
  /** Optional metric key for highlighting (e.g. "gpuLengthMm"). */
  metric?: string;
  /** True when this evidence is an advisory/note, not a hard issue. */
  advisory?: boolean;
}

export interface FitmentDecision {
  verdict: FitmentVerdict;
  evidence: FitmentEvidence[];
}

export interface BuildContext {
  activeCase: CasePart | null;
  activeGpu: GpuPart | null;
  activeCpuCooler: GenericPart | null;
  activePsu: GenericPart | null;
  activeMotherboard: GenericPart | null;
  activeRam: GenericPart | null;
}

export interface BuildFitmentReport {
  verdict: FitmentVerdict;
  slotDecisions: Record<string, FitmentDecision>;
  overallEvidence: FitmentEvidence[];
}
