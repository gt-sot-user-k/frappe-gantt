import { describe, it, expect } from 'vitest';
import { generateDateColumns } from '../src/scale/date-columns';
import dates from '../src/util/dates';

const k = (d: Date) => dates.to_string(d).slice(0, 10);

describe('generateDateColumns', () => {
  it('produces one column per day (inclusive) in Day view', () => {
    const cols = generateDateColumns(dates.parse('2024-01-01'), dates.parse('2024-01-05'), '1d');
    expect(cols.map(k)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
    ]);
  });

  it('steps by week in Week view', () => {
    const cols = generateDateColumns(dates.parse('2024-01-01'), dates.parse('2024-01-29'), '7d');
    expect(cols.map(k)).toEqual([
      '2024-01-01',
      '2024-01-08',
      '2024-01-15',
      '2024-01-22',
      '2024-01-29',
    ]);
  });

  it('returns an empty list when start is after end', () => {
    expect(generateDateColumns(dates.parse('2024-02-01'), dates.parse('2024-01-01'), '1d')).toEqual(
      [],
    );
  });

  it('rejects a non-positive step', () => {
    expect(() => generateDateColumns(dates.parse('2024-01-01'), dates.parse('2024-01-02'), '0d')).toThrow(
      /positive/,
    );
  });
});
