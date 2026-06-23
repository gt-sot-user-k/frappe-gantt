import { describe, it, expect } from 'vitest';
import { Config } from '../src/core/config';

describe('Config', () => {
  it('merges user options over defaults', () => {
    const c = new Config({ barHeight: 14 });
    expect(c.get('barHeight')).toBe(14);
    expect(c.get('padding')).toBe(18); // default preserved
  });

  it('resolves a view mode by name', () => {
    const c = new Config();
    expect(c.resolveViewMode('Week').step).toBe('7d');
  });

  it('falls back to the viewMode option when no name is given', () => {
    const c = new Config({ viewMode: 'Month' });
    expect(c.resolveViewMode().name).toBe('Month');
  });

  it('throws on an unknown view mode', () => {
    const c = new Config();
    expect(() => c.resolveViewMode('Nope')).toThrow(/unknown view mode/i);
  });

  it('readonly:true implies every aspect', () => {
    const c = new Config({ readonly: true });
    expect(c.isReadonly('dates')).toBe(true);
    expect(c.isReadonly('progress')).toBe(true);
  });

  it('readonly object toggles aspects individually', () => {
    const c = new Config({ readonly: { progress: true } });
    expect(c.isReadonly('progress')).toBe(true);
    expect(c.isReadonly('dates')).toBe(false);
  });
});
