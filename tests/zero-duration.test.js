import { DEFAULT_OPTIONS } from '../src/defaults.js';

test('zero_duration_editable defaults to true', () => {
    expect(DEFAULT_OPTIONS.zero_duration_editable).toBe(true);
});
