// Dependency relationships: reverse lookup and cycle detection.
// Assumes task ids are already normalized by TaskStore.
import type { Task } from '../core/types';

export class DependencyGraph {
  /** parent id -> direct child ids (reverse of `dependencies`). */
  private reverse = new Map<string, string[]>();
  /** child id -> declared parent ids (`dependencies`). */
  private forward = new Map<string, string[]>();

  constructor(tasks: Task[]) {
    for (const task of tasks) {
      const deps = (task.dependencies as string[] | undefined) ?? [];
      this.forward.set(task.id, deps);
      for (const parent of deps) {
        const list = this.reverse.get(parent) ?? [];
        list.push(task.id);
        this.reverse.set(parent, list);
      }
    }
  }

  /** Direct dependents (tasks that declare `id` as a dependency). */
  dependentsOf(id: string): string[] {
    return this.reverse.get(id) ?? [];
  }

  /** All transitive dependents, deduplicated. */
  getAllDependents(id: string): string[] {
    const seen = new Set<string>();
    const stack = [...this.dependentsOf(id)];
    while (stack.length) {
      const next = stack.pop() as string;
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...this.dependentsOf(next));
    }
    return [...seen];
  }

  hasCycle(): boolean {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();

    const visit = (node: string): boolean => {
      color.set(node, GRAY);
      for (const dep of this.forward.get(node) ?? []) {
        const c = color.get(dep) ?? WHITE;
        if (c === GRAY) return true;
        if (c === WHITE && visit(dep)) return true;
      }
      color.set(node, BLACK);
      return false;
    };

    for (const node of this.forward.keys()) {
      if ((color.get(node) ?? WHITE) === WHITE && visit(node)) return true;
    }
    return false;
  }
}
