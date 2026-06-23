import { describe, it, expect } from 'vitest';
import { computeTimelineBounds } from '../src/scale/timeline-bounds';
import { TaskStore } from '../src/model/task-store';
import { Config } from '../src/core/config';
import dates from '../src/util/dates';
import type { Task } from '../src/core/types';

const cfg = new Config();
const dayMode = cfg.resolveViewMode('Day'); // padding '7d'

function store(tasks: Task[]): Task[] {
  const s = new TaskStore();
  s.setAll(tasks);
  return s.all();
}

describe('computeTimelineBounds', () => {
  it('returns null for an empty task set', () => {
    expect(computeTimelineBounds([], dayMode)).toBeNull();
  });

  it('pads the span by the view mode padding (Day = 7d)', () => {
    const tasks = store([
      { id: 'a', name: 'A', start: '2024-01-05', end: '2024-01-08' },
      { id: 'b', name: 'B', start: '2024-01-06', end: '2024-01-10' },
    ]);
    const bounds = computeTimelineBounds(tasks, dayMode)!;
    expect(dates.to_string(bounds.start).slice(0, 10)).toBe('2023-12-29'); // 2024-01-05 - 7d
    expect(dates.to_string(bounds.end).slice(0, 10)).toBe('2024-01-17'); // 2024-01-10 + 7d
  });

  it('doubles the pad when infinitePadding is on', () => {
    const tasks = store([{ id: 'a', name: 'A', start: '2024-01-15', end: '2024-01-15' }]);
    const bounds = computeTimelineBounds(tasks, dayMode, { infinitePadding: true })!;
    expect(dates.to_string(bounds.start).slice(0, 10)).toBe('2024-01-01'); // -14d
    expect(dates.to_string(bounds.end).slice(0, 10)).toBe('2024-01-29'); // +14d
  });

  it('uses the earliest start and latest end across all tasks', () => {
    const tasks = store([
      { id: 'a', name: 'A', start: '2024-03-10', end: '2024-03-12' },
      { id: 'b', name: 'B', start: '2024-01-01', end: '2024-06-30' },
      { id: 'c', name: 'C', start: '2024-02-01', end: '2024-02-05' },
    ]);
    const bounds = computeTimelineBounds(tasks, dayMode)!;
    expect(dates.to_string(bounds.start).slice(0, 10)).toBe('2023-12-25'); // 2024-01-01 - 7d
    expect(dates.to_string(bounds.end).slice(0, 10)).toBe('2024-07-07'); // 2024-06-30 + 7d
  });
});
