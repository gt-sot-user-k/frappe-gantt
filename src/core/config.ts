// Resolves user options over defaults and answers config queries.
import type { GanttOptions, ReadonlyOptions, ViewMode } from './types';
import { DEFAULT_OPTIONS, DEFAULT_VIEW_MODES } from './defaults';

export class Config {
  readonly options: GanttOptions;

  constructor(user: Partial<GanttOptions> = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...user,
      viewModes: user.viewModes ?? DEFAULT_OPTIONS.viewModes ?? DEFAULT_VIEW_MODES,
    };
  }

  get<K extends keyof GanttOptions>(key: K): GanttOptions[K] {
    return this.options[key];
  }

  /** Resolve a view mode by name (falls back to the `viewMode` option). */
  resolveViewMode(name?: string): ViewMode {
    const target = name ?? this.options.viewMode ?? 'Day';
    const modes = this.options.viewModes ?? DEFAULT_VIEW_MODES;
    const mode = modes.find((m) => m.name === target);
    if (!mode) throw new Error(`[gantt] unknown view mode: "${target}"`);
    return mode;
  }

  isReadonly(aspect: 'dates' | 'progress' | 'dependencies'): boolean {
    const ro = this.options.readonly;
    if (ro === true) return true;
    if (!ro) return false;
    const o = ro as ReadonlyOptions;
    return Boolean(o.all || o[aspect]);
  }
}
