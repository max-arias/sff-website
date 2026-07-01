import type { CasePart, GpuPart } from "../../app/types";
import { readSnapshot, rowToCase, rowToGpu } from "./snapshot";

interface D1Result<T> {
  results?: T[];
}

interface D1DatabaseLike {
  prepare(query: string): {
    all<T>(): Promise<D1Result<T>>;
  };
}

interface CloudflareEventContext {
  context?: {
    cloudflare?: {
      env?: {
        DB?: D1DatabaseLike;
      };
    };
  };
  cloudflare?: {
    env?: {
      DB?: D1DatabaseLike;
    };
  };
}

function getDb(event: unknown) {
  const cloudflareEvent = event as CloudflareEventContext;
  return cloudflareEvent.context?.cloudflare?.env?.DB ?? cloudflareEvent.cloudflare?.env?.DB;
}

export async function loadParts(event: unknown): Promise<{ cases: CasePart[]; gpus: GpuPart[]; source: "d1" | "snapshot" }> {
  const db = getDb(event);

  if (!db) {
    const snapshot = await readSnapshot();
    return { cases: snapshot.cases, gpus: snapshot.gpus, source: "snapshot" };
  }

  const [caseRows, gpuRows] = await Promise.all([
    db.prepare("select * from cases order by seller, name").all<Record<string, unknown>>(),
    db.prepare("select * from gpus order by chipset, model, brand, name").all<Record<string, unknown>>()
  ]);

  return {
    cases: (caseRows.results ?? []).map(rowToCase),
    gpus: (gpuRows.results ?? []).map(rowToGpu),
    source: "d1"
  };
}

export async function findCaseAndGpu(event: unknown, caseId: string, gpuId: string) {
  const parts = await loadParts(event);
  return {
    casePart: parts.cases.find((part) => part.id === caseId) ?? null,
    gpuPart: parts.gpus.find((part) => part.id === gpuId) ?? null,
    source: parts.source
  };
}
