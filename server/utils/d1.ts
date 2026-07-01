import type { CasePart, GenericPart, GpuPart } from "../../app/types";
import { readSnapshot, rowToCase, rowToGenericPart, rowToGpu } from "./snapshot";

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

  const rows = await db
    .prepare("select * from sff_parts where kind in ('case', 'gpu') order by kind, display_name")
    .all<Record<string, unknown>>();
  const parts = rows.results ?? [];

  return {
    cases: parts.filter((row) => row.kind === "case").map(rowToCase),
    gpus: parts.filter((row) => row.kind === "gpu").map(rowToGpu),
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

function summarizeParts(parts: GenericPart[]) {
  const byKind: Record<string, number> = {};
  const bySourceSheet: Record<string, number> = {};

  for (const part of parts) {
    byKind[part.kind] = (byKind[part.kind] ?? 0) + 1;
    bySourceSheet[part.sourceSheet] = (bySourceSheet[part.sourceSheet] ?? 0) + 1;
  }

  return {
    total: parts.length,
    byKind,
    bySourceSheet
  };
}

export async function loadCatalog(event: unknown): Promise<{
  parts: GenericPart[];
  source: "d1" | "snapshot";
  summary: {
    total: number;
    byKind: Record<string, number>;
    bySourceSheet: Record<string, number>;
  };
}> {
  const db = getDb(event);

  if (!db) {
    const snapshot = await readSnapshot();
    return {
      parts: snapshot.parts,
      source: "snapshot",
      summary: summarizeParts(snapshot.parts)
    };
  }

  const rows = await db
    .prepare("select * from sff_parts order by kind, display_name limit 20000")
    .all<Record<string, unknown>>();
  const parts = (rows.results ?? []).map(rowToGenericPart);

  return {
    parts,
    source: "d1",
    summary: summarizeParts(parts)
  };
}
