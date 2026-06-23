import { describe, it, expectTypeOf } from 'vitest';
import type { Task, GanttOptions, GanttEventMap, Duration } from '../src/core/types';

describe('core types', () => {
  it('Task requires id/name/start/end and allows snake_case extras', () => {
    const t: Task = {
      id: 'a',
      name: 'A',
      start: '2024-01-01',
      end: '2024-01-02',
      expected_start: '2024-01-01',
      row_height: 40,
    };
    expectTypeOf(t.id).toEqualTypeOf<string>();
  });

  it('Duration accepts unit suffixes', () => {
    const d: Duration = '7d';
    expectTypeOf(d).toMatchTypeOf<Duration>();
  });

  it('GanttEventMap keys map to payloads', () => {
    expectTypeOf<GanttEventMap['view-change']>().toHaveProperty('mode');
  });

  it('GanttOptions groups table + readonly', () => {
    const o: GanttOptions = {
      viewMode: 'Day',
      readonly: { progress: true },
      table: { headerMount: '#h' },
    };
    expectTypeOf(o.table).toMatchTypeOf<object | undefined>();
  });
});
