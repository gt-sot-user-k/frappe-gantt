import { createSVG } from './svg_utils';
import Arrow from './arrow';

export default class DummyArrow {
    constructor(gantt, from_task) {
        this.gantt = gantt;
        this.from_task = from_task;
        const { x, y } = this.from_task;
        this.to_point = { x, y };

        this.calculate_path();
        this.draw();
    }

    setup_move_listener() {
        const mousemoveHandler = (e) => {
            if (!e || !e.offsetX || !e.offsetY) {
                return;
            }

            this.to_point = {
                x: e.offsetX,
                y: e.offsetY,
            };
            this.update();
        };
        const mouseupHandler = (e) => {
            this.gantt.$container.removeEventListener(
                'mousemove',
                mousemoveHandler,
            );

            this.gantt.layers.arrow.removeChild(this.element);
            const to_task_bar_wrapper = e.target.closest('.bar-wrapper');
            if (!to_task_bar_wrapper) {
                return;
            }
            const to_task_id = to_task_bar_wrapper?.getAttribute('data-id');
            const to_task = this.gantt.get_task(to_task_id);
            if (!to_task) {
                console.warn('the target was not found');
            }
            this.gantt.trigger_event('create_dependency', [
                this.from_task.task,
                to_task,
            ]);
        };

        this.gantt.$container.addEventListener('mousemove', mousemoveHandler);
        this.gantt.$container.addEventListener('mouseup', mouseupHandler);
    }

    calculate_path() {
        let start_x =
            this.from_task.$bar.getX() + this.from_task.$bar.getWidth() / 2;

        const condition = () =>
            this.to_point.x < start_x + this.gantt.options.padding &&
            start_x > this.from_task.$bar.getX() + this.gantt.options.padding;

        while (condition()) {
            start_x -= 10;
        }
        start_x -= 10;

        // Calculate start_y using accumulated row heights
        let start_y =
            this.gantt.config.header_height + this.gantt.options.bar_height;
        for (let i = 0; i < this.from_task.task._index; i++) {
            start_y += this.gantt.getRowHeight(i);
        }
        start_y += this.gantt.options.padding / 2;

        const from_is_below_to = start_y > this.to_point.y;

        let curve = this.gantt.options.arrow_curve;
        const clockwise = from_is_below_to ? 1 : 0;
        let curve_y = from_is_below_to ? -curve : curve;

        if (
            this.to_point.x <=
            this.from_task.$bar.getX() + this.gantt.options.padding
        ) {
            let down_1 = this.gantt.options.padding / 2 - curve;
            if (down_1 < 0) {
                down_1 = 0;
                curve = this.gantt.options.padding / 2;
                curve_y = from_is_below_to ? -curve : curve;
            }
            const down_2 = this.to_point.y - curve_y;
            const left = this.to_point.x - this.gantt.options.padding;
            this.path = `
                M ${start_x} ${start_y}
                v ${down_1}
                a ${curve} ${curve} 0 0 1 ${-curve} ${curve}
                H ${left}
                a ${curve} ${curve} 0 0 ${clockwise} ${-curve} ${curve_y}
                V ${down_2}
                a ${curve} ${curve} 0 0 ${clockwise} ${curve} ${curve_y}
                L ${this.to_point.x} ${this.to_point.y}
                m -5 -5
                l 5 5
                l -5 5`;
        } else {
            if (this.to_point.x < start_x + curve)
                curve = this.to_point.x - start_x;

            let offset = from_is_below_to
                ? this.to_point.y + curve
                : this.to_point.y - curve;

            this.path = `
              M ${start_x} ${start_y}
              V ${offset}
              a ${curve} ${curve} 0 0 ${clockwise} ${curve} ${curve}
              L ${this.to_point.x} ${this.to_point.y}
              m -5 -5
              l 5 5
              l -5 5`;
        }
    }

    draw() {
        this.element = createSVG('path', {
            d: this.path,
            'data-from': this.from_task.task.id,
        });
        this.gantt.layers.arrow.appendChild(this.element);
        this.setup_move_listener();
    }

    update() {
        this.calculate_path();
        this.element.setAttribute('d', this.path);
    }
}
