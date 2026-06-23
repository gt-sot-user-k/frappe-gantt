// Owns per-row heights: effective height resolution, validation, persistence.
import { TaskStore } from './task-store';

export class RowHeightModel {
  private custom = new Map<string, number>();
  private defaultHeight: number;

  constructor(opts: { defaultHeight: number; seed?: Record<string, number> }) {
    this.defaultHeight = opts.defaultHeight;
    if (opts.seed) this.set(opts.seed);
  }

  private valid(height: number, id: string): boolean {
    if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) {
      // Never throw — invalid heights are skipped with a warning.
      console.warn(`[gantt] ignoring invalid row height for "${id}": ${height}`);
      return false;
    }
    return true;
  }

  /** Bulk set (invalid entries skipped). */
  set(map: Record<string, number>): this {
    for (const [id, height] of Object.entries(map)) this.setOne(id, height);
    return this;
  }

  setOne(id: string, height: number): this {
    const key = TaskStore.normalizeId(id);
    if (this.valid(height, key)) this.custom.set(key, height);
    return this;
  }

  reset(id: string): this {
    this.custom.delete(TaskStore.normalizeId(id));
    return this;
  }

  /** Custom height for the id, or the default. */
  getEffective(id: string): number {
    return this.custom.get(TaskStore.normalizeId(id)) ?? this.defaultHeight;
  }

  /** Effective height for each id, keyed by normalized id. */
  getAll(ids: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of ids) out[TaskStore.normalizeId(id)] = this.getEffective(id);
    return out;
  }

  setDefaultHeight(h: number): void {
    this.defaultHeight = h;
  }

  /** Custom-only heights, for re-applying across setTasks. */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.custom);
  }
}
