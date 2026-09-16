import type { CasePart, GenericPart, GpuPart } from "../types";
import type { CatalogSearchSuggestion, CatalogStore } from "../lib/catalog-store";

/**
 * In-memory CatalogStore for tests.
 *
 * Populate with fixture data via constructor, then pass to getBuildView
 * to exercise the full build-view pipeline without Cloudflare D1.
 */
export class InMemoryCatalogStore implements CatalogStore {
  constructor(
    private readonly data: {
      cases?: CasePart[];
      gpus?: GpuPart[];
      parts?: GenericPart[];
    } = {},
  ) {}

  async loadParts(): Promise<{ cases: CasePart[]; gpus: GpuPart[] }> {
    return {
      cases: this.data.cases ?? [],
      gpus: this.data.gpus ?? [],
    };
  }

  async loadPartsByIds(ids: string[]): Promise<GenericPart[]> {
    const all = [
      ...(this.data.cases ?? []),
      ...(this.data.gpus ?? []),
      ...(this.data.parts ?? []),
    ];
    const index = new Map(all.map((p) => [p.id, p]));
    return ids.map((id) => index.get(id)).filter(Boolean) as GenericPart[];
  }

  async loadKindCatalog(_kind: string, _search?: string): Promise<GenericPart[]> {
    // Filter by kind and optional search
    let results = [...(this.data.parts ?? [])];
    if (_kind) results = results.filter((p) => p.kind === _kind);
    if (_search?.trim()) {
      const q = _search.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q),
      );
    }
    return results;
  }

  async searchSuggestions(
    _query: string,
    _kind?: string,
    _limit?: number,
  ): Promise<CatalogSearchSuggestion[]> {
    // Not used in current tests — return empty
    return [];
  }

  async findCaseAndGpu(
    caseId: string,
    gpuId: string,
  ): Promise<{ casePart: CasePart | null; gpuPart: GpuPart | null }> {
    const cases = this.data.cases ?? [];
    const gpus = this.data.gpus ?? [];
    return {
      casePart: cases.find((c) => c.id === caseId) ?? null,
      gpuPart: gpus.find((g) => g.id === gpuId) ?? null,
    };
  }
}
