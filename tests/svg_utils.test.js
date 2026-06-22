import { $ } from '../src/svg_utils';

function fakeEl() {
    const store = {};
    return {
        store,
        setAttribute: (k, v) => (store[k] = v),
        getAttribute: (k) => (k in store ? store[k] : null),
    };
}

test('$.attr writes a numeric attribute even when the value is 0', () => {
    const el = fakeEl();
    $.attr(el, 'cx', 0);
    expect(el.store.cx).toBe(0);
});

test('$.attr still reads when called as a getter', () => {
    const el = fakeEl();
    el.setAttribute('cx', 5);
    expect($.attr(el, 'cx')).toBe(5);
});

test('$.attr sets multiple attributes from an object', () => {
    const el = fakeEl();
    $.attr(el, { x: 0, width: 100 });
    expect(el.store.x).toBe(0);
    expect(el.store.width).toBe(100);
});
