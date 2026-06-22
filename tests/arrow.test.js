import Arrow from '../src/arrow.js';

function mkBar(x, y, w, h) {
    return {
        getX: () => x,
        getY: () => y,
        getWidth: () => w,
        getHeight: () => h,
    };
}

test('arrow starts at parent bar bottom and ends at child bar middle', () => {
    const ctx = {
        gantt: { options: { padding: 18, arrow_curve: 5 }, config: {} },
        from_task: { task: { _index: 0 }, $bar: mkBar(0, 0, 50, 30) },
        to_task: { task: { _index: 1 }, $bar: mkBar(200, 100, 50, 30) },
        calculate_path: Arrow.prototype.calculate_path,
    };

    ctx.calculate_path();

    // start_x = 0 + 50/2 = 25; far-apart child -> no shift loop; then -10 => 15.
    // start_y = parent bottom = 0 + 30 = 30.
    expect(ctx.path).toContain('M 15 30');
    // end_x = 200 - 13 = 187; end_y = child middle = 100 + 30/2 = 115.
    expect(ctx.path).toContain('L 187 115');
});
