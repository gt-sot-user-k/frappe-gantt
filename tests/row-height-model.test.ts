import { describe, it, expect, vi } from 'vitest';
import { RowHeightModel } from '../src/model/row-height-model';

describe('RowHeightModel', () => {
  it('returns the default height when no custom value is set', () => {
    const m = new RowHeightModel({ defaultHeight: 48 });
    expect(m.getEffective('x')).toBe(48);
  });

  it('returns a custom height when set', () => {
    const m = new RowHeightModel({ defaultHeight: 48 });
    m.setOne('a', 80);
    expect(m.getEffective('a')).toBe(80);
  });

  it('skips invalid heights with a warning, never throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = new RowHeightModel({ defaultHeight: 48 });
    m.set({ a: 0, b: -5, c: NaN, d: 64 });
    expect(m.getEffective('a')).toBe(48);
    expect(m.getEffective('d')).toBe(64);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('normalizes ids with spaces', () => {
    const m = new RowHeightModel({ defaultHeight: 48 });
    m.setOne('a a', 70);
    expect(m.getEffective('a_a')).toBe(70);
  });

  it('reset reverts a row to default', () => {
    const m = new RowHeightModel({ defaultHeight: 48 });
    m.setOne('a', 80).reset('a');
    expect(m.getEffective('a')).toBe(48);
  });

  it('getAll returns effective heights for the given ids', () => {
    const m = new RowHeightModel({ defaultHeight: 48, seed: { a: 80 } });
    expect(m.getAll(['a', 'b'])).toEqual({ a: 80, b: 48 });
  });

  it('snapshot persists only custom values (for setTasks re-apply)', () => {
    const m = new RowHeightModel({ defaultHeight: 48, seed: { a: 80 } });
    expect(m.snapshot()).toEqual({ a: 80 });
  });
});
