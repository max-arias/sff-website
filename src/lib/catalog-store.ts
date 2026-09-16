import type { CasePart, GenericPart, GpuPart } from "../types";

export interface CatalogSearchSuggestion {
  id: string;
  kind: string;
  displayName: string;
  sourceSheet: string;
  rowNumber: number;
  score: number;
  match: string;
}

/**
 * CatalogStore is the data-access seam for the build view and API routes.
 *
 * Implementations abstract over the backing store (D1, in-memory, etc.)
 * so that consumers can be tested without Cloudflare infrastructure.
 *
 * Methods align with existing d1.ts exports — no broad abstraction invented.
 */
export interface CatalogStore {
  /** Load all cases and GPUs for the build view sidebar/selection. */
  loadParts(): Promise<{ cases: CasePart[]; gpus: GpuPart[] }>;

  /** Load arbitrary parts by their catalog IDs (supports any kind). */
  loadPartsByIds(ids: string[]): Promise<GenericPart[]>;

  /**
   * Load all parts of a given kind, with optional search filter.
   * The build view uses this to populate candidate rows for non-case/gpu kinds.
   */
  loadKindCatalog(kind: string, search?: string): Promise<GenericPart[]>;

  /** Full-text search returning ranked suggestion metadata. */
  searchSuggestions(
    query: string,
    kind?: string,
    limit?: number,
  ): Promise<CatalogSearchSuggestion[]>;

  /** Look up a single case and GPU by ID (used by the compatibility API). */
  findCaseAndGpu(
    caseId: string,
    gpuId: string,
  ): Promise<{
    casePart: CasePart | null;
    gpuPart: GpuPart | null;
  }>;
}
