import { env } from "cloudflare:workers";
import type {
  SelectableKind,
  SelectablePart,
  SelectablePartByKind,
} from "../types";
import {
  decodeSelectable,
  SELECTABLE_TABLES,
  type D1Row,
} from "./d1-decoders";

interface ReadResult<T> { results?: T[] }
interface ReadStatement {
  bind(...values: unknown[]): { all<T>(): Promise<ReadResult<T>> };
  all<T>(): Promise<ReadResult<T>>;
}
export interface ReadOnlyDatabase { prepare(query: string): ReadStatement }

function database(): ReadOnlyDatabase {
  const db = (env as { DB?: ReadOnlyDatabase }).DB;
  if (!db) throw new Error("D1 binding is unavailable.");
  return db;
}

export interface SelectedSlotReference {
  kind: SelectableKind;
  id: string;
}

export type SelectedSlotResolution<K extends SelectableKind = SelectableKind> = {
  kind: K;
  id: string;
  part: SelectablePartByKind[K] | null;
  unresolved: boolean;
};

export interface SelectedPartRepository {
  getPart<K extends SelectableKind>(kind: K, id: string): Promise<SelectablePartByKind[K] | null>;
  resolveSlots(slots: readonly SelectedSlotReference[]): Promise<SelectedSlotResolution[]>;
}

export class D1SelectedPartRepository implements SelectedPartRepository {
  constructor(private readonly db: ReadOnlyDatabase = database()) {}

  async getPart<K extends SelectableKind>(kind: K, id: string): Promise<SelectablePartByKind[K] | null> {
    const table = SELECTABLE_TABLES[kind];
    const result = await this.db
      .prepare(`select * from ${table} where id = ? limit 1`)
      .bind(id)
      .all<D1Row>();
    const row = result.results?.[0];
    return row ? decodeSelectable(kind, row) : null;
  }

  async resolveSlots(slots: readonly SelectedSlotReference[]): Promise<SelectedSlotResolution[]> {
    return Promise.all(slots.map(async ({ kind, id }) => {
      const part = await this.getPart(kind, id);
      return { kind, id, part, unresolved: part === null };
    }));
  }
}

export function selectablePartKind(part: SelectablePart): SelectableKind {
  return part.kind;
}
