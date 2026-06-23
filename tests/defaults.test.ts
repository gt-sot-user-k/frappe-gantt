import { describe, it, expect } from 'vitest';
import { DEFAULT_OPTIONS, DEFAULT_VIEW_MODES } from '../src/core/defaults';

describe('defaults', () => {
  it('exposes camelCase default options', () => {
    expect(DEFAULT_OPTIONS.barHeight).toBe(30);
    expect(DEFAULT_OPTIONS.padding).toBe(18);
    expect(DEFAULT_OPTIONS.viewMode).toBe('Day');
    expect(DEFAULT_OPTIONS.language).toBe('en');
  });

  it('ships the 7 built-in view modes', () => {
    const names = DEFAULT_VIEW_MODES.map((v) => v.name);
    expect(names).toEqual(['Hour', 'Quarter Day', 'Half Day', 'Day', 'Week', 'Month', 'Year']);
  });

  it('Week mode has a fixed column width', () => {
    const week = DEFAULT_VIEW_MODES.find((v) => v.name === 'Week')!;
    expect(week.column_width).toBe(140);
    expect(week.step).toBe('7d');
  });
});
