// Owns the task list: id/date normalization, indexing, and updates.
import type { GanttEventMap, Task } from '../core/types';
import type { EventBus } from '../core/event-bus';
import dates from '../util/dates';

export class TaskStore {
  private tasks: Task[] = [];
  private byId = new Map<string, Task>();

  constructor(private readonly bus?: EventBus<GanttEventMap>) {}

  /** Ids with spaces, dots, or colons are normalized to underscores. */
  static normalizeId(id: string): string {
    return String(id).replace(/[\s.:]+/g, '_');
  }

  /** Replace all tasks; normalizes ids/dependencies and parses dates. */
  setAll(tasks: Task[]): void {
    this.tasks = tasks.map((task, index) => {
      const id = TaskStore.normalizeId(task.id);
      const deps = task.dependencies;
      const dependencies = Array.isArray(deps)
        ? deps.map(TaskStore.normalizeId)
        : typeof deps === 'string' && deps.trim()
          ? deps.split(',').map((d) => TaskStore.normalizeId(d.trim()))
          : [];
      return {
        ...task,
        id,
        dependencies,
        _index: index,
        _start: dates.parse(task.start),
        _end: dates.parse(task.end),
      };
    });
    this.byId = new Map(this.tasks.map((t) => [t.id, t]));
  }

  all(): Task[] {
    return this.tasks;
  }

  get(id: string): Task | undefined {
    return this.byId.get(TaskStore.normalizeId(id));
  }

  /** Merge a patch into a task; re-parses dates when start/end change. */
  update(id: string, patch: Partial<Task>): Task | undefined {
    const task = this.get(id);
    if (!task) return undefined;
    Object.assign(task, patch);
    if (patch.start) task._start = dates.parse(patch.start);
    if (patch.end) task._end = dates.parse(patch.end);
    return task;
  }

  getOldestStart(): Date | undefined {
    if (this.tasks.length === 0) return undefined;
    const first = this.tasks[0]._start as Date;
    return this.tasks.reduce<Date>((min, t) => {
      const start = t._start as Date;
      return start < min ? start : min;
    }, first);
  }
}
