import { describe, it, expect } from 'vitest';
import { IgnoreModel } from '../src/scale/ignore-model';
import dates from '../src/util/dates';

describe('IgnoreModel', () => {
  it('ignores weekends when configured with "weekend"', () => {
    const m = new IgnoreModel('weekend');
    expect(m.isIgnored(dates.parse('2024-01-06'))).toBe(true); // Saturday
    expect(m.isIgnored(dates.parse('2024-01-07'))).toBe(true); // Sunday
    expect(m.isIgnored(dates.parse('2024-01-08'))).toBe(false); // Monday
  });

  it('ignores explicit dates from an array', () => {
    const m = new IgnoreModel(['2024-01-10']);
    expect(m.isIgnored(dates.parse('2024-01-10'))).toBe(true);
    expect(m.isIgnored(dates.parse('2024-01-11'))).toBe(false);
  });

  it('combines "weekend" with explicit dates', () => {
    const m = new IgnoreModel(['weekend', '2024-01-10']);
    expect(m.isIgnored(dates.parse('2024-01-06'))).toBe(true); // weekend
    expect(m.isIgnored(dates.parse('2024-01-10'))).toBe(true); // explicit
    expect(m.isIgnored(dates.parse('2024-01-09'))).toBe(false);
  });

  it('supports a predicate function', () => {
    const m = new IgnoreModel((d) => d.getDate() === 15);
    expect(m.isIgnored(dates.parse('2024-03-15'))).toBe(true);
    expect(m.isIgnored(dates.parse('2024-03-16'))).toBe(false);
  });

  it('lists ignored weekend days within a range', () => {
    const m = new IgnoreModel('weekend');
    // Mon 2024-01-01 .. Mon 2024-01-08 contains Sat 6th + Sun 7th
    const ignored = m.ignoredBetween(dates.parse('2024-01-01'), dates.parse('2024-01-08'));
    const keys = ignored.map((d) => dates.to_string(d).slice(0, 10));
    expect(keys).toEqual(['2024-01-06', '2024-01-07']);
  });
});
