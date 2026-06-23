# `@gts-ui/chart-gantt` — Public API Reference

> **Status:** This document describes the **new (breaking) public API** defined by
> the [re-architecture design spec](../.claude/superpowers/specs/2026-06-22-gantt-re-architecture-design.md)
> (§3 data model, §4 public API). The previous API is documented in
> [`./MIGRATION.md`](./MIGRATION.md), which is the contract for upgrading.

`@gts-ui/chart-gantt` is an SVG Gantt chart that renders **only** a timeline
(bars, arrows, header, grid). It ships **no integrated grid/table** — the
consumer brings their own table and binds the chart into a single full-height
cell of it. The table-integration seams (`table.headerMount`,
`table.scrollElement`, `table.rowHeights`, `table.syncRowHeightsFrom`) are
first-class, documented options.

**Naming conventions used in this document**

- **Option and method names are `camelCase`** (`viewMode`, `setTasks`, `barHeight`).
- **Task-data field names stay `snake_case`** because they are part of the data
  the host already produces: `id`, `name`, `start`, `end`, `progress`,
  `dependencies`, `expected_start`, `expected_end`, `custom_class`, `color`,
  `color_progress`, `row_height`, `thumbnail`.

---

## Table of contents

1. [Installation & quick start](#1-installation--quick-start)
2. [Constructor](#2-constructor)
3. [Options reference](#3-options-reference)
4. [Instance methods](#4-instance-methods)
5. [The `rows` row-height sub-API](#5-the-rows-row-height-sub-api)
6. [Events](#6-events)
7. [TypeScript usage](#7-typescript-usage)
8. [Migration from the old API](#8-migration-from-the-old-api)

---

## 1. Installation & quick start

### npm

```bash
npm install @gts-ui/chart-gantt
```

```ts
import Gantt from '@gts-ui/chart-gantt';
import '@gts-ui/chart-gantt/dist/style.css';
```

### CDN (UMD)

```html
<link
  rel="stylesheet"
  href="https://unpkg.com/@gts-ui/chart-gantt/dist/style.css"
/>
<script src="https://unpkg.com/@gts-ui/chart-gantt/dist/gantt.umd.js"></script>
<script>
  // exposed as the global `Gantt`
  const gantt = new Gantt('#gantt', { tasks });
</script>
```

ESM builds are also published (`dist/gantt.es.js`, referenced by the package
`module` field) and resolved automatically by bundlers.

### Minimal example

```ts
import Gantt from '@gts-ui/chart-gantt';

const tasks = [
  {
    id: 'task-1',
    name: 'Design',
    start: '2026-06-01',
    end: '2026-06-10',
    progress: 40,
  },
  {
    id: 'task-2',
    name: 'Build',
    start: '2026-06-08',
    end: '2026-06-20',
    progress: 0,
    dependencies: 'task-1',
  },
];

const gantt = new Gantt('#gantt', {
  tasks,
  viewMode: 'Day',
});

gantt.on('date-change', ({ task, start, end }) => {
  console.log('moved', task.id, start, end);
});
```

### Table-integration example (susp-frontend style)

This is the library's differentiator: the chart body renders into one
full-height host-table cell, the timeline header mounts into a separate sticky
node, vertical scroll is delegated to the host scroll container, and the bar
rows are aligned to the host table's row heights. See [`./INTEGRATION.md`](./INTEGRATION.md)
for the complete host recipe.

```ts
import Gantt from '@gts-ui/chart-gantt';
import { LabelPanelPlugin } from '@gts-ui/chart-gantt/plugins';

const DEFAULT_TABLE_ROW_HEIGHT = 32;
const GANTT_BAR_HEIGHT = 14;

const gantt = new Gantt(cellEl, {
  tasks,
  viewMode: 'Day',
  barHeight: GANTT_BAR_HEIGHT,
  // align bar rows to the host table's default row height
  padding: DEFAULT_TABLE_ROW_HEIGHT - GANTT_BAR_HEIGHT,
  readonly: { progress: true },
  table: {
    headerMount: `#${headerId}`, // sticky header node (host-owned)
    scrollElement: `#universal-table-${id}`, // host-owned scroll container
    rowHeights: seed, // seed { taskId: px } from host rows
    syncRowHeightsFrom: `#universal-table-${id}`, // observe host rows (opt-in)
  },
  plugins: [],
});

// translate chart gestures into host API calls
gantt.on('date-change', ({ task, start, end }) => persist(task, start, end));
gantt.on('create-dependency', ({ from, to }) => createRelation(from, to));
gantt.on('arrow-rclick', ({ event, arrow }) => showMenu(event, arrow));

// when host rows are resized programmatically, push heights into the chart
gantt.rows.set(updatedHeights);
```

---

## 2. Constructor

```ts
new Gantt(container: string | HTMLElement | SVGElement, options: GanttOptions)
```

A single options object replaces the old positional `(wrapper, tasks, options)`
signature. Tasks are now passed as `options.tasks`.

### `container`

| Accepted type | Behavior |
| --- | --- |
| `string` | Treated as a CSS selector and resolved via `document.querySelector`. Throws `ReferenceError` if no element matches. |
| `HTMLElement` | Used as the wrapper element. If it already contains an `<svg>`, that element is reused; otherwise one is created. |
| `SVGElement` | Used directly as the chart's SVG root. |

Any other type throws a `TypeError`.

### `options`

The `GanttOptions` object. `tasks` is the only commonly-required field; every
other option has a default (see §3). Example:

```ts
const gantt = new Gantt('#gantt', {
  tasks,
  viewMode: 'Week',
  barHeight: 14,
  readonly: { progress: true, dependencies: true },
  table: { headerMount: '#hdr', scrollElement: '#scroll' },
});
```

---

## 3. Options reference

All options below are re-expressed in the **new camelCase naming**, derived from
the current `src/defaults.js`. `readonly` is now a **grouped object**, and the
table-integration options are grouped under `table`. Label-panel options have
**moved into the `LabelPanelPlugin` config** (see the note after the table).

### Core / data

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `tasks` | `Task[]` | `[]` | The task/row data. Tasks without a valid `start`/`end` are dropped with a console error. (Was the 2nd positional constructor arg.) |
| `plugins` | `GanttPlugin[]` | `[]` | Plugins to install (e.g. `LabelPanelPlugin`). |

### View / scale

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `viewMode` | `string` | `'Day'` | Active view-mode name. Must match a `viewModes[].name`. (was `view_mode`) |
| `viewModes` | `ViewMode[]` | built-in 7 | The available view-mode definitions: `Hour`, `Quarter Day`, `Half Day`, `Day`, `Week`, `Month`, `Year`. (was `view_modes`) |
| `viewModeSelect` | `boolean` | `false` | Render a view-mode `<select>` dropdown in the side header. (was `view_mode_select`) |
| `columnWidth` | `number \| null` | `null` | Override the per-mode column width (px). `null` uses each mode's own width / `45`. (was `column_width`) |
| `dateFormat` | `string` | `'YYYY-MM-DD HH:mm'` | Default date format used where a view mode doesn't specify one. (was `date_format`) |
| `language` | `string` | `'en'` | Locale for `Intl`-based month/day names. (was `language`) |

### Rendering / geometry

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `barHeight` | `number` | `30` | Height of each task bar in px. (was `bar_height`) |
| `barCornerRadius` | `number` | `3` | Corner radius of bars in px. (was `bar_corner_radius`) |
| `padding` | `number` | `18` | Vertical padding added to `barHeight` to derive the default row height (`barHeight + padding`). (was `padding`) |
| `containerHeight` | `number \| 'auto'` | `'auto'` | Fixed chart body height in px, or `'auto'` to fill the host cell. (was `container_height`) |
| `upperHeaderHeight` | `number` | `45` | Height of the upper header band in px. (was `upper_header_height`) |
| `lowerHeaderHeight` | `number` | `30` | Height of the lower header band in px. (was `lower_header_height`) |
| `lines` | `'both' \| 'vertical' \| 'horizontal' \| 'none'` | `'both'` | Which grid lines to draw. (was `lines`) |
| `arrowCurve` | `number` | `5` | Corner-curve radius for dependency arrows in px. (was `arrow_curve`) |

### Behavior

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `snapAt` | `Duration \| 'unit' \| null` | `null` | Drag/resize snap granularity (e.g. `'1d'`, `'7d'`, `'unit'`). `null` falls back to the view mode's `snap_at` or `'1d'`. (was `snap_at`) |
| `moveDependencies` | `boolean` | `true` | When dragging a bar, also move its dependent bars. (was `move_dependencies`) |
| `infinitePadding` | `boolean` | `true` | Auto-extend the timeline as the user scrolls toward either edge. (was `infinite_padding`) |
| `autoMoveLabel` | `boolean` | `false` | Reflow ("big") bar labels as the chart scrolls horizontally. (was `auto_move_label`) |
| `scrollTo` | `string \| Date \| 'start' \| 'end' \| 'today'` | `'today'` | Initial horizontal scroll target. (was `scroll_to`) |
| `ignore` | `string \| string[] \| ((d: Date) => boolean)` | `[]` | Dates/regions to exclude from progress & dragging. Accepts `'weekend'`, ISO date strings, or a predicate. (was `ignore`) |
| `holidays` | `Record<string, 'weekend' \| HolidaySpec[]>` | `{ 'var(--g-weekend-highlight-color)': 'weekend' }` | Map of CSS color → highlight rule (`'weekend'`, dates, or `{ date, name }` objects). (was `holidays`) |

### Overlays / chrome

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `showExpectedProgress` | `boolean` | `false` | Show the expected-progress overlay on bars. (was `show_expected_progress`) |
| `expectedDateLine` | `boolean` | `false` | Show expected start/end date lines on bars (requires `expected_start`/`expected_end`). (was `expected_date_line`) |
| `expectedLineButton` | `boolean` | `false` | Render a side-header button to toggle expected lines. (was `expected_line_button`) |
| `todayButton` | `boolean` | `true` | Render a side-header "Today" button (scrolls to the current date). (was `today_button`) |

### Popup

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `popup` | `((ctx: PopupContext) => void) \| false` | built-in renderer | Custom popup renderer, or `false` to disable popups. The default renders title/subtitle/date-range/progress. (was `popup`) |
| `popupOn` | `'click' \| 'hover'` | `'click'` | When the popup is shown. (was `popup_on`) |

### Readonly (grouped)

The four old boolean flags are now a single grouped object. Pass `readonly: true`
as shorthand for `{ all: true }`.

```ts
readonly?: boolean | {
  all?: boolean;          // disable all editing (was `readonly`)
  dates?: boolean;        // disable move + resize (was `readonly_dates`)
  progress?: boolean;     // disable progress drag (was `readonly_progress`)
  dependencies?: boolean; // disable drag-to-connect (was `readonly_dependency`)
};
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `readonly.all` | `boolean` | `false` | Disable all interaction (move, resize, progress, dependency creation). |
| `readonly.dates` | `boolean` | `false` | Disable bar move and resize. |
| `readonly.progress` | `boolean` | `false` | Disable progress-handle dragging. |
| `readonly.dependencies` | `boolean` | `false` | Disable drag-to-create dependency arrows. |

### Table integration (grouped, the differentiator)

```ts
table?: {
  headerMount?: string | HTMLElement;
  scrollElement?: string | HTMLElement;
  rowHeights?: Record<string, number>;
  syncRowHeightsFrom?: string | HTMLElement;
};
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `table.headerMount` | `string \| HTMLElement` | — | Detached sticky node into which the timeline **header** is rendered. When set, the header is removed from the body and mounted here. (was `header_mount`) |
| `table.scrollElement` | `string \| HTMLElement` | the chart container | Host-owned scroll container. The chart delegates vertical scroll to it and keeps header/body horizontally in sync. (was `scroll_element_selector`) |
| `table.rowHeights` | `Record<string, number>` | `{}` | Seed per-row heights keyed by task id (px). Invalid/non-positive values are warned and skipped. (was `row_heights`) |
| `table.syncRowHeightsFrom` | `string \| HTMLElement` | — | **Opt-in.** Element whose rows are observed (via `ResizeObserver`); observed heights are pushed into the chart and re-rendered. Emits `row-heights-change`. (new) |

> **Moved to `LabelPanelPlugin` config.** The label side-panel is no longer in
> core. The old options `labels`, `label_button`, and `label_filter` now live in
> the plugin's own config namespace and are passed when constructing the plugin.
> See [`./PLUGINS.md`](./PLUGINS.md).
>
> ```ts
> import { LabelPanelPlugin } from '@gts-ui/chart-gantt/plugins';
>
> const gantt = new Gantt('#gantt', {
>   tasks,
>   plugins: [
>     new LabelPanelPlugin({
>       labels: [/* column config */], // was option `labels`
>       button: true,                  // was option `label_button`
>       filter: true,                  // was option `label_filter` (max 3 columns)
>     }),
>   ],
> });
> ```

---

## 4. Instance methods

Every method below maps to the old method it replaces. Fluent setters return
`this` for chaining.

### Data

#### `setTasks(tasks)` — replaces `refresh(tasks)`

```ts
setTasks(tasks: Task[]): this
```

Replace the entire task set, re-parse dates/dependencies, and re-render.
Persisted custom row heights are re-applied by normalized id (see §5).

```ts
gantt.setTasks(nextTasks);
```

#### `updateTask(id, patch)` — replaces `update_task(id, details)`

```ts
updateTask(id: string, patch: Partial<Task>): this
```

Merge `patch` into the task with the given id and re-render only that bar.

```ts
gantt.updateTask('task-2', { progress: 75, name: 'Build (rev 2)' });
```

#### `getTask(id)` — replaces `get_task(id)`

```ts
getTask(id: string): Task | undefined
```

Return the normalized task object (with computed `_start`, `_end`, `_index`) for
the given id, or `undefined`.

```ts
const t = gantt.getTask('task-1');
```

#### `getBar(id)` — replaces `get_bar(id)`

```ts
getBar(id: string): Bar | undefined
```

Return the rendered `Bar` instance for the given task id (its SVG group lives on
`bar.group`). Mainly for advanced/plugin use.

```ts
const bar = gantt.getBar('task-1');
bar?.group.classList.add('highlighted');
```

### View

#### `setViewMode(mode)` — replaces `change_view_mode(mode)`

```ts
setViewMode(mode: string | ViewMode): this
```

Switch the active view mode by name or definition. Horizontal scroll position is
preserved across the switch.

```ts
gantt.setViewMode('Week');
```

#### `getViewMode()` — new accessor

```ts
getViewMode(): ViewMode
```

Return the currently-resolved view-mode definition.

```ts
const mode = gantt.getViewMode(); // { name: 'Week', step: '7d', ... }
```

#### `scrollToToday()` — replaces `scroll_current()`

```ts
scrollToToday(): this
```

Scroll the timeline so the current date is centered. Extends the timeline if
"today" is outside the current range.

```ts
gantt.scrollToToday();
```

#### `scrollTo(target)` — replaces `set_scroll_position(date)`

```ts
scrollTo(target: Date | string | 'start' | 'end' | 'today'): this
```

Scroll to a specific date or named anchor.

```ts
gantt.scrollTo('2026-07-01');
gantt.scrollTo('start');
```

### Lifecycle / options

#### `setOptions(patch)` — replaces `update_options(options)`

```ts
setOptions(patch: Partial<GanttOptions>): this
```

Merge new options over the originals and re-render. Use this for runtime changes
to rendering/behavior options.

```ts
gantt.setOptions({ viewModeSelect: true, readonly: { progress: true } });
```

#### `destroy()` — replaces `clear()`

```ts
destroy(): void
```

Full teardown: remove the SVG and all DOM the chart created, detach all event
listeners (including any `ResizeObserver` from `table.syncRowHeightsFrom`),
destroy plugins, and clear the event bus. Use before discarding the instance.

```ts
gantt.destroy();
```

### Events

#### `on(event, handler)`

```ts
on<K extends keyof GanttEventMap>(
  event: K,
  handler: (payload: GanttEventMap[K]) => void,
): this
```

Subscribe to a typed event. Replaces the old `on_*` option callbacks. See §6.

```ts
gantt.on('date-change', ({ task, start, end }) => persist(task, start, end));
```

#### `off(event, handler?)`

```ts
off<K extends keyof GanttEventMap>(
  event: K,
  handler?: (payload: GanttEventMap[K]) => void,
): this
```

Unsubscribe a specific handler, or all handlers for the event when `handler` is
omitted.

```ts
gantt.off('date-change', myHandler);
gantt.off('hover'); // remove all 'hover' handlers
```

#### `once(event, handler)`

```ts
once<K extends keyof GanttEventMap>(
  event: K,
  handler: (payload: GanttEventMap[K]) => void,
): this
```

Subscribe to the next emission only, then auto-unsubscribe.

```ts
gantt.once('view-change', ({ mode }) => console.log('first switch to', mode.name));
```

### Row heights

#### `rows` — replaces `setRowHeights` / `updateRowHeight` / `resetRowHeight` / `getRowHeights`

The row-height controls are grouped under the `rows` sub-API. See §5 for the
full reference.

```ts
gantt.rows.set({ 'task-1': 80 }).update('task-2', 64).reset('task-3');
gantt.rows.getAll(); // { 'task-1': 80, 'task-2': 64, ... }
```

### Method mapping summary

| New | Old | Notes |
| --- | --- | --- |
| `new Gantt(el, { tasks, ...opts })` | `new Gantt(el, tasks, opts)` | single options object |
| `setTasks(tasks)` | `refresh(tasks)` | |
| `updateTask(id, patch)` | `update_task(id, details)` | |
| `getTask(id)` | `get_task(id)` | |
| `getBar(id)` | `get_bar(id)` | |
| `setViewMode(mode)` | `change_view_mode(mode)` | |
| `getViewMode()` | read `config.view_mode` | new accessor |
| `scrollToToday()` | `scroll_current()` | |
| `scrollTo(target)` | `set_scroll_position(date)` | |
| `setOptions(patch)` | `update_options(options)` | |
| `destroy()` | `clear()` | full teardown, not partial clear |
| `rows.set/update/reset/getAll` | `setRowHeights/updateRowHeight/resetRowHeight/getRowHeights` | see §5 |
| `on/off/once(event, …)` | `on_*` option callbacks | see §6 |

---

## 5. The `rows` row-height sub-API

`gantt.rows` is the single, fluent entry point for per-row heights. It backs the
"single full-height host cell + row-height sync" integration model: the host
table owns row heights and pushes them here (or the chart observes them via
`table.syncRowHeightsFrom`).

```ts
interface RowsApi {
  set(heights: Record<string, number>): Gantt;     // bulk set, returns gantt
  update(id: string, height: number): Gantt;        // single row, returns gantt
  reset(id: string): Gantt;                          // back to default, returns gantt
  getAll(): Record<string, number>;                  // effective heights by id
}
```

### `rows.set(heights)` — replaces `setRowHeights`

```ts
rows.set(heights: Record<string, number>): Gantt
```

Bulk-set heights keyed by task id (px), then re-render. Returns the `Gantt`
instance for chaining.

```ts
gantt.rows.set({ 'task-1': 80, 'task-2': 64 });
```

### `rows.update(id, height)` — replaces `updateRowHeight`

```ts
rows.update(id: string, height: number): Gantt
```

Set one row's height (px) and re-render.

```ts
gantt.rows.update('task-2', 64);
```

### `rows.reset(id)` — replaces `resetRowHeight`

```ts
rows.reset(id: string): Gantt
```

Remove a row's custom height, reverting it to the default (`barHeight + padding`),
and re-render.

```ts
gantt.rows.reset('task-3');
```

### `rows.getAll()` — replaces `getRowHeights`

```ts
rows.getAll(): Record<string, number>
```

Return the **effective** height of every row keyed by task id — the custom
height where set, otherwise the default `barHeight + padding`.

```ts
gantt.rows.getAll(); // { 'task-1': 80, 'task-2': 64, 'task-3': 48 }
```

### Behavior contract

- **Fluent chaining.** `set`, `update`, and `reset` all return the `Gantt`
  instance, so they chain. `getAll` returns the height map (a terminal call).

  ```ts
  gantt.rows.set({ 'task-1': 80 }).update('task-2', 64).reset('task-3');
  ```

- **Validation is warn-not-throw.** A height must be a positive, finite number.
  Invalid values (non-numbers, `NaN`, `Infinity`, `<= 0`) and unknown task ids
  are logged with `console.warn` and skipped — the call never throws, and valid
  entries in the same batch still apply.

  ```ts
  gantt.rows.set({ 'task-1': 80, 'task-2': -5, 'ghost': 40 });
  // -> applies task-1; warns and skips task-2 (non-positive) and ghost (unknown)
  ```

- **Persistence across `setTasks`.** Custom heights are stored keyed by task id
  in an internal map that survives task replacement. After `setTasks(newTasks)`,
  any new task whose id matches a previously-set id keeps its custom height.

- **Keying by normalized id.** Heights are keyed by the **normalized** task id —
  the same normalization applied to task ids on load (spaces replaced with
  underscores). Use the normalized form (e.g. `'my_task'`, not `'my task'`) when
  calling `rows.*`.

- **Effective height.** The default row height is `barHeight + padding`. A custom
  height fully overrides it for that row; bars stay vertically centered within
  the row regardless of height.

- **Emits `row-heights-change`.** Mutating calls re-render and emit
  `row-heights-change` with the new effective map.

---

## 6. Events

All events are delivered through the typed event bus via `on` / `off` / `once`
(§4). This replaces the old soup of `on_*` option callbacks. The full reference,
with exact payloads and emission timing, is in [`./EVENTS.md`](./EVENTS.md).

| Event | Payload | Summary |
| --- | --- | --- |
| `date-change` | `{ task, start: Date, end: Date, source }` | A bar's dates changed via drag/resize. `source` is `'drag' \| 'resize-left' \| 'resize-right'`. (was `on_date_change` / `on_dragging_end` / `on_left_resizing_end` / `on_right_resizing_end`) |
| `progress-change` | `{ task, progress: number }` | A bar's progress was edited. (was `on_progress_change`) |
| `create-dependency` | `{ from: string, to: string }` | A dependency arrow was drawn between two bars. (was `on_create_dependency`) |
| `arrow-rclick` | `{ event: PointerEvent, arrow: Arrow }` | A dependency arrow was right-clicked (host shows a menu). (was `on_arrow_rclick`) |
| `view-change` | `{ mode: ViewMode }` | The view mode changed. (was `on_view_change`) |
| `click` | `{ task }` | A bar was clicked. (was `on_click`) |
| `dblclick` | `{ task }` | A bar was double-clicked. |
| `hover` | `{ task }` | A bar was hovered. |
| `row-heights-change` | `{ heights: Record<string, number> }` | Effective row heights changed (via `rows.*` or `table.syncRowHeightsFrom`). |

```ts
gantt.on('date-change', ({ task, start, end, source }) => {
  if (source === 'drag') persistMove(task, start, end);
});
gantt.on('create-dependency', ({ from, to }) => createRelation(from, to));
gantt.on('arrow-rclick', ({ event, arrow }) => showContextMenu(event, arrow));
```

---

## 7. TypeScript usage

The package ships strict, hand-authored types. Import the public types directly
from the package entry:

```ts
import Gantt, {
  type Task,
  type Arrow,
  type ViewMode,
  type GanttOptions,
  type GanttEventMap,
} from '@gts-ui/chart-gantt';
```

### Typed options

```ts
const options: GanttOptions = {
  tasks,
  viewMode: 'Day',
  barHeight: 14,
  readonly: { progress: true },
  table: {
    headerMount: '#hdr',
    scrollElement: '#scroll',
    rowHeights: { 'task-1': 80 },
  },
};

const gantt = new Gantt('#gantt', options);
```

### Generic-typed `on()`

`on` is generic over `GanttEventMap`, so the payload is fully inferred from the
event name — no casts needed:

```ts
gantt.on('date-change', ({ task, start, end, source }) => {
  // task: Task, start: Date, end: Date, source: 'drag' | 'resize-left' | 'resize-right'
});

gantt.on('progress-change', ({ task, progress }) => {
  // task: Task, progress: number
});

gantt.on('create-dependency', ({ from, to }) => {
  // from: string, to: string
});
```

Passing an unknown event name, or destructuring a field that isn't on that
event's payload, is a compile-time error.

### Working with `Task`

```ts
const task: Task = {
  id: 'task-1',
  name: 'Design',
  start: '2026-06-01',
  end: '2026-06-10',
  progress: 40,
  dependencies: ['task-0'],
  expected_start: '2026-06-01',
  expected_end: '2026-06-08',
  custom_class: 'critical',
  color: '#3b82f6',
  row_height: 64,
  thumbnail: '/avatars/u1.png',
};
```

See [`./DATA-MODEL.md`](./DATA-MODEL.md) for the complete `Task`, `Arrow`,
`ViewMode`, `GanttOptions`, and `GanttEventMap` definitions.

---

## 8. Migration from the old API

> **This is a breaking redesign.** If you are upgrading from the previous
> `(wrapper, tasks, options)` / `on_*` / snake_case-method API, read
> [`./MIGRATION.md`](./MIGRATION.md) — it is the full, authoritative old→new map.

Key renames at a glance:

| Old | New |
| --- | --- |
| `new Gantt(el, tasks, opts)` | `new Gantt(el, { tasks, ...opts })` |
| `refresh(tasks)` | `setTasks(tasks)` |
| `change_view_mode(m)` | `setViewMode(m)` |
| `setRowHeights` / `updateRowHeight` / `resetRowHeight` / `getRowHeights` | `rows.set` / `rows.update` / `rows.reset` / `rows.getAll` |
| `on_date_change` option | `on('date-change', …)` |
| `on_create_dependency` option | `on('create-dependency', …)` |
| `on_arrow_rclick` option | `on('arrow-rclick', …)` |
| `header_mount` | `table.headerMount` |
| `scroll_element_selector` | `table.scrollElement` |
| `row_heights` | `table.rowHeights` |
| `readonly` / `readonly_dates` / `readonly_progress` / `readonly_dependency` | `readonly.all` / `readonly.dates` / `readonly.progress` / `readonly.dependencies` |
| `labels` / `label_button` / `label_filter` options | `LabelPanelPlugin` config (`labels` / `button` / `filter`) |
| `clear()` | `destroy()` |
