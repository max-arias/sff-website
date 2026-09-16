import type { CasePart, GenericPart, GpuPart } from "../types";
import type { CatalogSearchSuggestion, CatalogStore } from "../lib/catalog-store";
import {
  findCaseAndGpu,
  loadCatalogKind,
  loadCatalogPartsByIds,
  loadParts,
  searchCatalog,
} from "./d1";

/**
 * D1-backed CatalogStore that delegates to the existing D1 functions.
 *
 * The `context` parameter (usually Astro's APIContext or event) is captured
 * at construction time so consumers do not need to pass it around.
 */
export class D1CatalogStore implements CatalogStore {
  constructor(private context: unknown) {}

  async loadParts(): Promise<{ cases: CasePart[]; gpus: GpuPart[] }> {
    const result = await loadParts(this.context);
    return { cases: result.cases, gpus: result.gpus };
  }

  async loadPartsByIds(ids: string[]): Promise<GenericPart[]> {
    const result = await loadCatalogPartsByIds(this.context, ids);
    return result.parts;
  }

  async loadKindCatalog(kind: string, search?: string): Promise<GenericPart[]> {
    return loadCatalogKind(this.context, kind, search);
  }

  async searchSuggestions(
    query: string,
    kind?: string,
    limit?: number,
  ): Promise<CatalogSearchSuggestion[]> {
    const result = await searchCatalog(this.context, {
      query,
      kind,
      limit: limit ?? 1000,
    });
    return result.suggestions;
  }

  async findCaseAndGpu(
    caseId: string,
    gpuId: string,
  ): Promise<{ casePart: CasePart | null; gpuPart: GpuPart | null }> {
    return findCaseAndGpu(this.context, caseId, gpuId);
  }
}
