# Events — `@gts-ui/chart-gantt`

> Reference for the typed event system introduced by the re-architecture
> (see [`../.claude/superpowers/specs/2026-06-22-gantt-re-architecture-design.md`](../.claude/superpowers/specs/2026-06-22-gantt-re-architecture-design.md),
> §2.1 *EventBus* and §3 *GanttEventMap*).
>
> Cross-references: [`./API.md`](./API.md) (public methods, the `on/off/once`
> surface, the `rows` facade) and [`./DATA-MODEL.md`](./DATA-MODEL.md) (`Task`,
> `Arrow`, `ViewMode`, `GanttEventMap` type definitions).

---

## 1. Overview — the EventBus model

In the old monolith, notifications were delivered through a single private
dispatcher, `trigger_event(name, args)`, which looked up an `on_<name>` **option
callback** and invoked it with positional arguments:

```js
// OLD — index.js
trigger_event(event, args) {
    if (this.options['on_' + event]) {
        this.options['on_' + event].apply(this, args); // positional args, `this` = gantt
    }
}
// usage: this.gantt.trigger_event('date_change', [task, start, end]);
// consumer: new Gantt(el, tasks, { on_date_change(task, start, end) { … } });
```

This had three problems: only **one** handler per event could be registered, the
arguments were **positional and untyped**, and the event surface was scattered
across `on_*` option keys that did not match the internal event names (e.g. the
documented option `on_left_resizing_end` never fired — the code emitted
`resizing_left_end`, so it looked up `on_resizing_left_end`; see §6).

The new architecture replaces all of this with a single **typed `EventBus`** that
offers `on` / `off` / `once` / `emit`. Every layer (model, scale, renderers,
controllers) emits onto the bus; nothing calls another layer's method to
"notify". The `Gantt` facade bridges the **public** event names to it.

### 1.1 Public API: `on` / `off` / `once`

```ts
// Subscribe; returns an unsubscribe function.
on<K extends keyof GanttEventMap>(
  event: K,
  handler: (payload: GanttEventMap[K]) => void,
): () => void;

// Subscribe for a single delivery, then auto-unsubscribe.
once<K extends keyof GanttEventMap>(
  event: K,
  handler: (payload: GanttEventMap[K]) => void,
): () => void;

// Unsubscribe a previously registered handler.
off<K extends keyof GanttEventMap>(
  event: K,
  handler: (payload: GanttEventMap[K]) => void,
): void;
```

Two changes versus the old model that consumers must know:

1. **Handlers receive a single typed payload object**, not positional args
   (`{ task, start, end }`, not `(task, start, end)`).
2. **Multiple handlers** can subscribe to the same event; all are invoked in
   registration order.

### 1.2 Generic-typed subscription example

```ts
import Gantt, { GanttEventMap } from '@gts-ui/chart-gantt';

const gantt = new Gantt(container, {
  tasks,
  viewMode: 'Day',
  table: { scrollElement: '#host-scroll', headerMount: '#host-header' },
});

// K is inferred from the literal event name; `payload` is fully typed.
const off = gantt.on('date-change', ({ task, start, end, source }) => {
  // task: Task, start: Date, end: Date, source: 'drag' | 'resize-left' | 'resize-right' | 'progress'
  persist(task.id, start, end, source);
});

// one-shot
gantt.once('view-change', ({ mode }) => analytics.track('first-view', mode.name));

// later
off(); // or gantt.off('date-change', handler)
```

A small generic helper reads cleanly because `GanttEventMap` keys the payloads:

```ts
function subscribeAll(gantt: Gantt) {
  const log = <K extends keyof GanttEventMap>(event: K) =>
    gantt.on(event, (payload) => console.debug(event, payload));
  ['date-change', 'progress-change', 'view-change'].forEach((e) =>
    log(e as keyof GanttEventMap),
  );
}
```

---

## 2. Master events table

All names are **kebab-case**. "Old `on_*`" is the option callback the event
replaces. "Source" applies only where a gesture distinguishes variants.

| New event              | Payload type                  | When it fires                                                                 | Old `on_*` option                |
|------------------------|-------------------------------|-------------------------------------------------------------------------------|----------------------------------|
| `date-change`          | `DateChangePayload`           | A bar's `_start` or `_end` changes via drag / resize-left / resize-right      | `on_date_change`                 |
| `dragging-end`         | `DateChangePayload`           | A move (whole-bar drag) gesture ends and changed dates                        | `on_dragging_end`                |
| `resize-left-end`      | `DateChangePayload`           | A left-edge (start-date) resize gesture ends and changed dates                | `on_left_resizing_end` *(see §6)*|
| `resize-right-end`     | `DateChangePayload`           | A right-edge (end-date) resize gesture ends and changed dates                 | `on_right_resizing_end`*(see §6)*|
| `progress-change`      | `ProgressChangePayload`       | A progress-handle drag gesture ends                                           | `on_progress_change`             |
| `click`                | `TaskPayload`                 | A bar group is clicked                                                        | `on_click`                       |
| `double-click`         | `TaskPayload`                 | A bar group is double-clicked (or double-tapped on touch)                     | *(none — was `on_double_click`)* |
| `hover`                | `HoverPayload`                | The pointer moves over a bar group                                            | *(none — was `on_hover`)*        |
| `create-dependency`    | `CreateDependencyPayload`     | A drag-to-connect (dummy arrow) is released on a different bar's handle       | `on_create_dependency`           |
| `dependency-handle-mousedown` | `DependencyHandlePayload` | A dependency handle receives a primary-button mousedown (drag-to-connect start) | `on_dependency_handle_mousedown` |
| `arrow-rclick`         | `ArrowRclickPayload`          | An arrow path receives a `contextmenu` (right-click) event                    | `on_arrow_rclick`                |
| `view-change`          | `ViewChangePayload`           | The view mode changes (select, `setViewMode`, ctrl+wheel step, refresh)       | `on_view_change`                 |
| `row-heights-change`   | `RowHeightsChangePayload`     | The effective row-height map changes (set / update / reset / host sync)       | *(new — see spec §3, §8.17/8.19)*|

> **`view-change` always fires** on every view rebuild, including the initial
> render (the old `trigger_event('view_change', [mode])` ran inside
> `change_view_mode`, which is called from the constructor). Subscribe with
> `once` if you only want subsequent changes.

---

## 3. Per-event reference

Shared payload aliases used below:

```ts
type GestureSource = 'drag' | 'resize-left' | 'resize-right' | 'progress';

interface TaskPayload {
  task: Task;
}
```

### 3.1 `date-change`

Fired whenever an interaction mutates a bar's start and/or end date. It fires
*in addition to* the gesture-specific `*-end` event (see §4 ordering). In the old
code this was `trigger_event('date_change', [task, new_start_date, new_end_date])`
from `Bar.date_changed()`, which only fired when `_start` or `_end` actually
changed.

```ts
interface DateChangePayload {
  task: Task;          // the mutated task (with updated _start/_end)
  start: Date;         // new start date (old positional arg #2)
  end: Date;           // new end date   (old positional arg #3)
  source: GestureSource; // 'drag' | 'resize-left' | 'resize-right'
}
```

- **Source mapping:** derived from the active gesture (`last_action` in the old
  code): whole-bar move → `'drag'`, left handle → `'resize-left'`, right handle
  → `'resize-right'`. (`'progress'` never appears here; progress edits emit
  `progress-change`.)
- **Timing:** the mutation is applied to the `TaskStore` first, then the event is
  emitted (spec §2.3). The payload `start`/`end` are the *new* values.
- **Note:** no event is emitted if the snapped position resolves to the same
  start and end (the old guard `if (!changed) return;`). When
  `expected_start` is set and a move would push the bar before the expected-start
  x, the move is rejected and no change fires.

```ts
gantt.on('date-change', ({ task, start, end, source }) => {
  if (source === 'resize-left') api.patch(task.id, { start });
  else if (source === 'resize-right') api.patch(task.id, { end });
  else api.patch(task.id, { start, end });
});
```

### 3.2 `dragging-end`

The gesture-specific completion event for a **whole-bar move**. Replaces
`on_dragging_end`. Same payload as `date-change`, with `source: 'drag'`.

```ts
type DraggingEndPayload = DateChangePayload; // source === 'drag'
```

- **Timing:** fires from the same `date_changed()` pass as `date-change`, after
  `date-change` (§4). Only fires if dates actually changed.

```ts
gantt.on('dragging-end', ({ task, start, end }) => {
  toast(`Moved "${task.name}" to ${start.toDateString()}`);
});
```

### 3.3 `resize-left-end` (a.k.a. left-resizing-end)

Completion of a **left-edge (start-date) resize**. Replaces the
`on_left_resizing_end` option (which, in the old code, was a documented-but-dead
key — see §6). Payload is `DateChangePayload` with `source: 'resize-left'`.

```ts
type ResizeLeftEndPayload = DateChangePayload; // source === 'resize-left'
```

```ts
gantt.on('resize-left-end', ({ task, start }) => api.patch(task.id, { start }));
```

### 3.4 `resize-right-end`

Completion of a **right-edge (end-date) resize**. Replaces
`on_right_resizing_end` (also dead in the old code — §6). Payload is
`DateChangePayload` with `source: 'resize-right'`.

```ts
type ResizeRightEndPayload = DateChangePayload; // source === 'resize-right'
```

```ts
gantt.on('resize-right-end', ({ task, end }) => api.patch(task.id, { end }));
```

### 3.5 `progress-change`

Fired when a progress-handle drag completes and progress was actually changed.
Old: `trigger_event('progress_change', [task, task.progress])` from
`Bar.progress_changed()`, called on `mouseup` of the `.handle.progress` drag.

```ts
interface ProgressChangePayload {
  task: Task;       // task with updated .progress
  progress: number; // 0..100 (recomputed via Bar.compute_progress)
}
```

- **Timing:** fires on `mouseup` of the progress handle, only when
  `$bar_progress.finaldx` is non-zero. The progress is recomputed accounting for
  ignored regions before emit.
- **Readonly:** the progress handle is not drawn when `readonly` or
  `readonly_progress` is set, so the event cannot fire (new API:
  `readonly.progress`).
- **Source:** conceptually `'progress'` in the `GestureSource` union; emitted on
  its own event, never on `date-change`.

```ts
gantt.on('progress-change', ({ task, progress }) =>
  api.patch(task.id, { progress }),
);
```

### 3.6 `click`

Fired when a bar group is clicked. Old: `trigger_event('click', [this.task])`.

```ts
type ClickPayload = TaskPayload; // { task }
```

```ts
gantt.on('click', ({ task }) => select(task.id));
```

### 3.7 `double-click` (alias: `dblclick`)

Fired on bar double-click, and on a double-tap on touch devices. Old:
`trigger_event('double_click', [this.task])` (note the old internal name was
`double_click`; the new canonical name is **`double-click`**). The handler is
suppressed while a just-completed action is settling (`action_completed`).

```ts
type DoubleClickPayload = TaskPayload; // { task }
```

```ts
gantt.on('double-click', ({ task }) => openEditor(task.id));
```

### 3.8 `hover`

Fired as the pointer moves over a bar group. Old:
`trigger_event('hover', [this.task, e.screenX, e.screenY, e])` — i.e. it carried
the screen coordinates and the raw event. The new payload preserves these:

```ts
interface HoverPayload {
  task: Task;
  screenX: number;     // old positional arg #2 (e.screenX)
  screenY: number;     // old positional arg #3 (e.screenY)
  event: MouseEvent;   // old positional arg #4 (raw DOM event)
}
```

> The spec's abbreviated `GanttEventMap` lists `hover` as `{ task }`; the real
> code also passes coordinates and the source event, retained here so existing
> consumers (e.g. custom hover tooltips) are not stranded.

```ts
gantt.on('hover', ({ task, screenX, screenY }) =>
  positionTooltip(task, screenX, screenY),
);
```

### 3.9 `create-dependency`

Fired when a drag-to-connect gesture (the `DummyArrow`) is released over a
*different* bar's dependency handle, forming a new dependency edge. Old:
`trigger_event('create_dependency', [from_task, to_task])` from
`DummyArrow.setup_listener()` mouseup.

```ts
interface CreateDependencyPayload {
  from: string;   // source task id (old: from_task — full Task; see note)
  to: string;     // target task id (old: to_task — full Task)
}
```

- **Spec contract** (§3) is `{ from: string; to: string }` (ids). The old code
  emitted the full `from_task.task` and resolved `to_task` objects; the new
  facade normalizes to ids. If you need the full tasks, look them up via
  `gantt.getTask(from)` / `gantt.getTask(to)`.
- **Timing:** fires only when the release target is a `.bar-wrapper` whose
  `data-id` differs from the source, the release button is primary (0), and the
  release happened on a `.dependency-handle`. Self-links are ignored.
- **Readonly:** dependency handles are not drawn when `readonly` or
  `readonly_dependency` (new API: `readonly.dependencies`) is set.

```ts
gantt.on('create-dependency', ({ from, to }) => api.createRelation(from, to));
```

### 3.10 `dependency-handle-mousedown`

Fired at the *start* of a drag-to-connect, on primary-button mousedown of a
dependency handle (just before the `DummyArrow` is created). Old:
`trigger_event('dependency_handle_mousedown', [this, handle])` — the `Bar`
instance and the handle SVG element.

```ts
interface DependencyHandlePayload {
  bar: Bar;            // the source Bar instance (old positional arg #1)
  handle: SVGElement;  // the dependency-handle element (old positional arg #2)
  placement: 'left' | 'right'; // from handle's data-placement attribute
}
```

> This is a low-level/advanced hook (it leaks renderer internals — the `Bar`
> instance and a DOM node). It exists to let hosts begin custom connect UX. Most
> integrations should prefer `create-dependency`.

```ts
gantt.on('dependency-handle-mousedown', ({ bar, placement }) =>
  console.debug('start link from', bar.task.id, placement),
);
```

### 3.11 `arrow-rclick`

Fired when an existing dependency arrow is right-clicked (`contextmenu`). Old:
`trigger_event('arrow_rclick', [e, this])` from `Arrow.setup_listeners()` — the
raw event and the `Arrow` instance.

```ts
interface ArrowRclickPayload {
  event: PointerEvent;   // the contextmenu event (old positional arg #1)
  arrow: Arrow;          // the Arrow ({ from_task, to_task, element }) (old arg #2)
}
```

- **Timing:** on the arrow path's `contextmenu`. Call `event.preventDefault()` in
  the handler to suppress the browser menu and show your own.

```ts
gantt.on('arrow-rclick', ({ event, arrow }) => {
  event.preventDefault();
  showMenu(event.clientX, event.clientY, {
    from: arrow.from_task.task.id,
    to: arrow.to_task.task.id,
  });
});
```

### 3.12 `view-change`

Fired whenever the view mode is (re)applied. Old:
`trigger_event('view_change', [mode])` at the end of `change_view_mode()`.

```ts
interface ViewChangePayload {
  mode: ViewMode; // the resolved (processed) view-mode object
}
```

- **Fires on:** the view-mode `<select>`, `setViewMode(name)` (old
  `change_view_mode`), host ctrl+wheel scale stepping, `setTasks`/`refresh`
  (which re-runs `change_view_mode`), and the **initial render** from the
  constructor.
- **Note:** `mode` is the *processed* view mode (string `upper_text`/`lower_text`
  formats already wrapped into functions), not necessarily the literal object the
  caller passed.

```ts
gantt.on('view-change', ({ mode }) => syncUrlParam('view', mode.name));
```

### 3.13 `row-heights-change` (new)

New event from the spec (§3 `GanttEventMap`, §8.17 *Custom row heights* and §8.19
*Table integration*). There is **no old `on_*` equivalent** — in the monolith,
`updateRowHeight` / `setRowHeights` / `resetRowHeight` mutated `row_heights` and
re-rendered silently. The re-architecture routes these through `RowHeightModel`,
which emits whenever the effective height map changes.

```ts
interface RowHeightsChangePayload {
  heights: Record<string, number>; // task id → effective height in px
}
```

- **Fires on:** `gantt.rows.set(map)`, `gantt.rows.update(id, h)`,
  `gantt.rows.reset(id)`, and host-driven sync via
  `table.syncRowHeightsFrom` (a `ResizeObserver` pushing host-row heights into the
  model — spec §2.2 *TableAdapter*).
- **Payload** is the full effective map (`getEffective()`): every row's height,
  whether custom or the default (`barHeight + padding`).
- **Validation:** invalid entries (non-finite, ≤ 0) are warned and skipped by the
  model and never appear in the payload; the event does not fire if nothing
  effectively changed.

```ts
// BDD scenario from spec §5.3:
//   Given a chart bound via table.syncRowHeightsFrom
//   When a host row grows to 96px
//   Then 'row-heights-change' is emitted with the new map
gantt.on('row-heights-change', ({ heights }) => {
  persistLayout(heights);            // mirror back to host store if desired
});
```

---

## 4. Event ordering & lifecycle

The unifying rule (spec §2.3): **mutations go through the model (`TaskStore` /
`RowHeightModel`) *before* any event is emitted.** Handlers always observe the
already-updated state.

### 4.1 During a drag / resize gesture

A single move-or-resize gesture produces, on release (`mouseup`):

1. `TaskStore.update(id, { start, end })` — the source of truth mutates first.
2. **`date-change`** is emitted (generic, with `source`).
3. The matching gesture event is emitted **after**: `dragging-end`
   (source `drag`), `resize-left-end` (source `resize-left`), or
   `resize-right-end` (source `resize-right`).

This mirrors the old `Bar.date_changed()`, which called
`trigger_event('date_change', …)` and then
`trigger_event(`${last_action}_end`, …)` back-to-back. **No event fires** if the
snapped dates equal the previous dates.

Repaint happens around the emit: renderers re-read `TimeScale`/`RowHeightModel`
and the `DependencyGraph` updates arrows; the public events are re-emitted by the
facade so the host can persist.

```
user releases a dragged bar
  → InteractionController: snap → new start/end
  → TaskStore.update(id, {start,end})
  → emit 'date-change'   { source: 'drag' }
  → emit 'dragging-end'  { source: 'drag' }
  → Bar/Grid/Arrow repaint
```

### 4.2 During a progress drag

On `mouseup` of the progress handle: progress is recomputed (ignored-region
aware) → `TaskStore` updated → **`progress-change`** emitted. Progress edits do
**not** emit `date-change` or any `*-end` date event.

### 4.3 View changes

`setViewMode` (or select / ctrl+wheel / `setTasks` / initial render) rebuilds the
scale and re-renders, then emits **`view-change`** last. Scroll position is
preserved across the rebuild when applicable.

### 4.4 Row-height changes

`rows.set/update/reset` (or host `ResizeObserver` sync) → `RowHeightModel`
validates and updates → re-render → **`row-heights-change`** emitted with the new
effective map.

### 4.5 Click vs. double-click

`click` fires on every bar click; `double-click` fires on the second click of a
double-click (or double-tap). `double-click` is suppressed for ~1s after a
move/resize/progress gesture completes (`action_completed` guard) so a drag does
not spuriously open an editor.

---

## 5. Public vs. internal events

The `EventBus` is the single channel for **all** events, including
**internal, namespaced** events used for cross-layer coordination. These are
**not part of the public contract**, are not in `GanttEventMap`, may change
without notice, and should not be subscribed to by hosts. They use a
`namespace:event` form, e.g.:

| Internal event        | Emitted by         | Purpose (not for host use)                          |
|-----------------------|--------------------|-----------------------------------------------------|
| `tasks:changed`       | `TaskStore`        | Model mutated; renderers/graph recompute            |
| `deps:changed`        | `DependencyGraph`  | Dependency map rebuilt; arrows recompute            |
| `scale:changed`       | `TimeScale`        | Geometry changed (view mode / extend); repaint      |
| `rows:changed`        | `RowHeightModel`   | Internal height map mutated (facade re-emits public `row-heights-change`) |
| `scroll:sync`         | `ScrollController`  | Header/body/label horizontal-scroll coordination    |

The **public** events — the only ones with a stable, typed contract via
`GanttEventMap` and the `on/off/once` surface — are exactly the rows of the §2
master table:

`date-change`, `dragging-end`, `resize-left-end`, `resize-right-end`,
`progress-change`, `click`, `double-click`, `hover`, `create-dependency`,
`dependency-handle-mousedown`, `arrow-rclick`, `view-change`,
`row-heights-change`.

> Rule of thumb: kebab-case, no colon = **public**. `namespace:event` (colon) =
> **internal**, do not depend on it.

---

## 6. Migration notes (old `on_*` → new `on(...)`)

See [`./MIGRATION.md`](./MIGRATION.md) for the full table. Event-specific points:

- **Single object payload, not positional args.** Old:
  `on_date_change(task, start, end)`. New:
  `on('date-change', ({ task, start, end, source }) => …)`.
- **Multiple handlers** are now supported per event; `on` returns an unsubscribe
  function, and `off`/`once` are available.
- **Resize option names were buggy.** The old monolith emitted
  `` `${last_action}_end` `` where `last_action` was `resizing_left` /
  `resizing_right`, i.e. internal events `resizing_left_end` /
  `resizing_right_end` → it looked up options `on_resizing_left_end` /
  `on_resizing_right_end`. But the *documented* options were
  `on_left_resizing_end` / `on_right_resizing_end`, which therefore **never
  fired**. The new events `resize-left-end` / `resize-right-end` fix this and are
  reliably emitted.
- **`double-click` / `hover` had no documented option** in the old `GanttOptions`
  typedef (`on_double_click` / `on_hover` were emitted internally but never
  listed). They are now first-class public events.
- **`create-dependency` payload changed** from full `Task` objects to ids
  (`{ from, to }`), per spec §3. Resolve with `gantt.getTask(id)` if needed.
- **`row-heights-change` is new** — wire it up where you previously relied on the
  silent re-render after `setRowHeights`/`updateRowHeight`/`resetRowHeight`.

---

## See also

- [`./API.md`](./API.md) — `on` / `off` / `once`, constructor, methods, `rows`.
- [`./DATA-MODEL.md`](./DATA-MODEL.md) — `Task`, `Arrow`, `ViewMode`,
  `GanttEventMap`, `GestureSource`.
- [`./INTEGRATION.md`](./INTEGRATION.md) — `table.syncRowHeightsFrom` and the
  source of `row-heights-change`.
