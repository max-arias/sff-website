import type { CasePart, GenericPart, GpuPart } from "../types";

// ---------------------------------------------------------------------------
// Domain types for the fitment engine (pure, no UI concerns)
// ---------------------------------------------------------------------------

/**
 * FitmentVerdict for individual evidence items.
 * Never "unscored" — each piece of evidence always has a concrete evaluation.
 */
export type FitmentVerdict = "pass" | "conditional" | "fail";

/**
 * Verdict for a decision or report, which may also be "unscored"
 * when there is no evidence at all.
 */
export type FitmentDecisionVerdict = FitmentVerdict | "unscored";

export interface FitmentEvidence {
  code: string;
  verdict: FitmentVerdict;
  message: string;
  /** Part-kind slot this evidence is about (e.g. "case" for a riser requirement). */
  subject?: string;
  /** Optional domain metric key for the dimension/spec this evidence evaluates. */
  metric?: string;
  /** True when this evidence is an advisory/note, not a hard issue. */
  advisory?: boolean;
}

export interface FitmentDecision {
  verdict: FitmentDecisionVerdict;
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
  verdict: FitmentDecisionVerdict;
  slotDecisions: Record<string, FitmentDecision>;
  overallEvidence: FitmentEvidence[];
}
