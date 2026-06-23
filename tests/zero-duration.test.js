import { DEFAULT_OPTIONS } from '../src/defaults.js';
import Bar, { ZERO_DURATION_NUB_WIDTH } from '../src/bar.js';

test('zero_duration_editable defaults to true', () => {
    expect(DEFAULT_OPTIONS.zero_duration_editable).toBe(true);
});

function stateCtx({ invalid = false, editable = true } = {}) {
    return {
        invalid,
        gantt: { options: { zero_duration_editable: editable } },
        compute_zero_duration_state: Bar.prototype.compute_zero_duration_state,
    };
}

test('zero logical width + option on => ghost nub', () => {
    const r = stateCtx().compute_zero_duration_state(0);
    expect(r.is_zero_duration).toBe(true);
    expect(r.render_width).toBe(ZERO_DURATION_NUB_WIDTH);
});

test('zero logical width + option off => not a ghost, width stays 0', () => {
    const r = stateCtx({ editable: false }).compute_zero_duration_state(0);
    expect(r.is_zero_duration).toBe(false);
    expect(r.render_width).toBe(0);
});

test('invalid bar is never a ghost', () => {
    const r = stateCtx({ invalid: true }).compute_zero_duration_state(0);
    expect(r.is_zero_duration).toBe(false);
});

test('positive logical width => not a ghost, render width = logical', () => {
    const r = stateCtx().compute_zero_duration_state(90);
    expect(r.is_zero_duration).toBe(false);
    expect(r.render_width).toBe(90);
});
