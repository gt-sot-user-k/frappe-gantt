import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../src/model/dependency-graph';
import type { Task } from '../src/core/types';

const mk = (id: string, deps: string[] = []): Task => ({
  id,
  name: id,
  start: '2024-01-01',
  end: '2024-01-02',
  dependencies: deps,
});

describe('DependencyGraph', () => {
  it('finds direct dependents (reverse edges)', () => {
    const g = new DependencyGraph([mk('a'), mk('b', ['a']), mk('c', ['a'])]);
    expect(g.dependentsOf('a').sort()).toEqual(['b', 'c']);
  });

  it('finds transitive dependents without duplicates', () => {
    const g = new DependencyGraph([mk('a'), mk('b', ['a']), mk('c', ['b'])]);
    expect(g.getAllDependents('a').sort()).toEqual(['b', 'c']);
  });

  it('detects a cycle', () => {
    const g = new DependencyGraph([mk('a', ['c']), mk('b', ['a']), mk('c', ['b'])]);
    expect(g.hasCycle()).toBe(true);
  });

  it('reports no cycle for a DAG', () => {
    const g = new DependencyGraph([mk('a'), mk('b', ['a']), mk('c', ['b'])]);
    expect(g.hasCycle()).toBe(false);
  });
});
