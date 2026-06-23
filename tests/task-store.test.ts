import { describe, it, expect } from 'vitest';
import { TaskStore } from '../src/model/task-store';
import type { Task } from '../src/core/types';

const tasks: Task[] = [
  { id: 'a', name: 'A', start: '2024-01-01', end: '2024-01-05' },
  { id: 'b b', name: 'B', start: '2024-01-03', end: '2024-01-08', dependencies: 'a' },
];

describe('TaskStore', () => {
  it('normalizes ids with spaces to underscores', () => {
    expect(TaskStore.normalizeId('b b')).toBe('b_b');
  });

  it('parses _start/_end and assigns _index', () => {
    const s = new TaskStore();
    s.setAll(tasks);
    const a = s.get('a')!;
    expect(a._index).toBe(0);
    expect(a._start instanceof Date).toBe(true);
    expect(a._start!.getFullYear()).toBe(2024);
  });

  it('normalizes string dependencies to an array', () => {
    const s = new TaskStore();
    s.setAll(tasks);
    expect(s.get('b_b')!.dependencies).toEqual(['a']);
  });

  it('update merges a patch and keeps identity by id', () => {
    const s = new TaskStore();
    s.setAll(tasks);
    const updated = s.update('a', { progress: 50 });
    expect(updated!.progress).toBe(50);
    expect(s.get('a')!.progress).toBe(50);
  });

  it('getOldestStart returns the earliest _start', () => {
    const s = new TaskStore();
    s.setAll(tasks);
    expect(s.getOldestStart()!.getTime()).toBe(s.get('a')!._start!.getTime());
  });
});
