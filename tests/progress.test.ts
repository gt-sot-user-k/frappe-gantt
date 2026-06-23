import { describe, it, expect } from 'vitest';
import {
  clampProgress,
  progressToWidth,
  widthToProgress,
  expectedProgress,
} from '../src/scale/progress';
import dates from '../src/util/dates';

describe('progress math', () => {
  it('clamps progress into 0..100 (NaN -> 0)', () => {
    expect(clampProgress(-10)).toBe(0);
    expect(clampProgress(150)).toBe(100);
    expect(clampProgress(50)).toBe(50);
    expect(clampProgress(NaN)).toBe(0);
  });

  it('converts progress to fill width', () => {
    expect(progressToWidth(50, 200)).toBe(100);
    expect(progressToWidth(200, 200)).toBe(200); // clamped to 100%
  });

  it('converts a dragged width back to progress', () => {
    expect(widthToProgress(100, 200)).toBe(50);
    expect(widthToProgress(50, 0)).toBe(0); // guard against zero-width bars
  });

  it('derives expected progress from elapsed time', () => {
    const start = dates.parse('2024-01-01');
    const end = dates.parse('2024-01-11'); // 10-day span
    expect(expectedProgress(start, end, dates.parse('2024-01-06'))).toBe(50);
    expect(expectedProgress(start, end, dates.parse('2023-12-01'))).toBe(0); // before start
    expect(expectedProgress(start, end, dates.parse('2024-02-01'))).toBe(100); // after end
  });
});
