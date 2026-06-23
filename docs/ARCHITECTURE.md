# Architecture — `@gts-ui/chart-gantt`

> Status: design (re-architecture). This document is the keystone architecture
> reference derived from the canonical design spec
> (`.claude/superpowers/specs/2026-06-22-gantt-re-architecture-design.md`) and the
> current source in `src/`. It describes the **target** OOP architecture that
> replaces the ~2,240-line `Gantt` monolith in `src/index.js`.
>
> Naming convention used throughout: the **new public API** uses idiomatic
> `camelCase` (methods, options, event names). **Task-data fields the host already
> produces stay `snake_case`** (`expected_start`, `custom_class`, `color_progress`,
> `row_height`, the internal `_start`/`_end`/`_index`, …) exactly as the spec
> dictates.

---

## Table of contents

1. [Architectural overview & the "no integrated table" philosophy](#1-architectural-overview--the-no-integrated-table-philosophy)
2. [Layering](#2-layering)
3. [Units (responsibility, surface, dependencies, events, extraction map)](#3-units)
4. [Class aggregation / composition](#4-class-aggregation--composition)
5. [Data-flow walkthroughs](#5-data-flow-walkthroughs)
6. [Plugin architecture](#6-plugin-architecture)
7. [Directory / module layout](#7-directory--module-layout)
8. [Cross-references](#8-cross-references)

---

## 1. Architectural overview & the "no integrated table" philosophy

`@gts-ui/chart-gantt` is an **SVG timeline-only Gantt** (a fork lineage of
frappe-gantt / ganttflow). Its single distinguishing value proposition versus
heavyweight grids like dhtmlx-gantt is deliberately narrow:

> **A timeline-only Gantt with NO integrated grid/table.** The consumer brings
> their own table; the chart renders only the bars/arrows/timeline and binds
> itself into a single full-height cell of that host table.

The library renders **only** the chart side of a Gantt: the timeline header, the
grid, the task bars, the dependency arrows, and the interactions on them. It does
**not** render a task list / name column / data grid. That is the host's job —
and refusing to build one is the entire point of the product.

The real consumer is `susp-frontend` (Vue 3 + Pinia). It mounts the chart inside
`src/components/tables/budget/cells/chart-gantt-cell.vue` through a Pinia store
(`ganttStore.installGantt(el, options)`). In that integration the chart:

- renders its **body** into one host table cell (`height: 100%`);
- renders its **timeline header** into a *separate* sticky node (the
  `header_mount` seam — today `src/index.js:203-217`);
- delegates **vertical scroll** to the host table container (the
  `scroll_element_selector` seam — today `src/index.js:224-225`);
- aligns bar rows to the host table's row heights (`row_heights` + `padding`);
- emits domain events (`date-change`, `create-dependency`, `arrow-rclick`) that
  the host translates into API calls.

Because the differentiator (table integration) is the product, the target
architecture promotes those three seams — **header mount, external scroll,
row-height sync** — from loose, undocumented options buried in the monolith into
a first-class, documented **integration layer** (`TableAdapter`). See
[`./INTEGRATION.md`](./INTEGRATION.md).

### 1.1 Why re-architect

The current `src/index.js` is a single ~2,240-line `Gantt` class with ~64 methods
spanning config, date math, DOM creation, grid rendering, header rendering, bar /
arrow orchestration, scroll, interaction, popup, labels and row-heights. `Bar`
(`src/bar.js`) reaches back into the `Gantt` instance in 60+ places
(`this.gantt.options.*`, `this.gantt.config.*`, `this.gantt.gantt_start`,
`this.gantt.trigger_event()`, `this.gantt.$container`, …). The differentiator is
entangled and untested. The re-architecture decomposes this into small,
single-purpose, independently testable units, and makes the integration a feature
rather than a set of loose options.

### 1.2 Design principles

- **One responsibility per unit.** Pure logic (model + scale) carries no DOM;
  rendering carries no business rules; interaction mutates only through the model.
- **Geometry is a function of the scale, not the god object.** `Bar.compute_x` /
  `compute_duration` move into `TimeScale`; bars receive a read-only context.
- **Upward communication is by events, never back-references.** No unit calls a
  higher layer's methods to "notify"; it emits on the `EventBus`.
- **The table integration is a documented subsystem**, not buried options.
- **SVG stays.** No rendering-tech change; no Vue/React wrapper shipped here.
- **TypeScript-first, strict, staged migration** (bottom-up; see the spec §6).

---

## 2. Layering

Five layers plus two cross-cutting concerns. **Dependencies point downward only.**
Nothing in a lower layer imports an upper layer. All upward communication goes
through the `EventBus`.

### 2.1 Layer diagram (ASCII)

```
                ┌─────────────────────────────────────────────┐
   FACADE       │                  Gantt                       │  public API, wiring
                └─────────────────────────────────────────────┘
                          │ composes ▼
   INTEGRATION   ┌───────────────────────┐   ┌──────────────────┐
   (the          │     TableAdapter      │   │   Plugin host    │  ← LabelPanelPlugin
    differentiator)└───────────────────────┘   └──────────────────┘
                          │
   INTERACTION   ┌──────────────────────┐  ┌──────────────────┐
                 │ InteractionController │  │  ScrollController │
                 └──────────────────────┘  └──────────────────┘
                          │
   RENDER        ┌────────┬─────────┬──────────┬───────────┐
                 │ Grid   │ Header  │ Bar       │ Arrow     │   (+ LayerManager, SvgUtils)
                 │Renderer│Renderer │ Renderer  │ Renderer  │
                 └────────┴─────────┴──────────┴───────────┘
                          │
   SCALE         ┌──────────────────────────────────────────┐
                 │            TimeScale (Timeline)            │  date↔x, snap, ignored
                 └──────────────────────────────────────────┘
                          │
   MODEL         ┌───────────────┐  ┌──────────────────┐  ┌────────────────┐
                 │   TaskStore   │  │ DependencyGraph  │  │ RowHeightModel │
                 └───────────────┘  └──────────────────┘  └────────────────┘

   CROSS-CUTTING:   EventBus (typed pub/sub)   ·   Config (OptionsResolver)
```

### 2.2 The dependency rules

- **Downward only.** `Render` may read `Scale` and `Model`; `Scale` may read
  `Model`; `Model` reads nothing above it. `Interaction` orchestrates `Render`,
  `Scale` and `Model`; `Integration` sits above interaction; `Facade` sits above
  everything and wires them.
- **No upward imports.** `TimeScale` never imports a renderer; `RowHeightModel`
  never imports `GridRenderer`. A renderer never imports a controller.
- **Upward via EventBus.** When `TaskStore` mutates, it emits `tasks:changed`;
  renderers (subscribers) repaint. When `InteractionController` finishes a drag,
  it emits `task:date-change`; the facade re-emits the public `date-change`. No
  layer calls a parent's method directly to push a notification.
- **Read-only views into lower layers.** Higher units receive **injected
  read-only contexts** (e.g. `BarContext`, `ArrowContext`, `PluginContext`)
  instead of the full `Gantt`. This is what removes the 60+ `this.gantt.*`
  reach-backs in `Bar`.

This makes each pure-logic unit (model, scale, config, event bus) unit-testable
in the fast `node` vitest environment, and each rendering / interaction unit
testable in `jsdom` (see the spec §5).

---

## 3. Units

Each subsection lists **Responsibility**, **Public surface** (TS-ish
signatures), **Depends on**, **Emits / Listens**, and **Extracted from** (the
monolith methods / line ranges in the current `src/` it replaces).

> Line ranges below reference the current `src/index.js` (2,239 lines),
> `src/bar.js`, `src/arrow.js`, `src/dummy_arrow.js`, `src/defaults.js`,
> `src/label.js`, `src/popup.js`, `src/svg_utils.js`.

---

### 3.1 Cross-cutting

#### 3.1.1 EventBus

**Responsibility.** A single typed publish/subscribe channel for *all* events in
the system. It replaces the monolith's ad-hoc `trigger_event` and the scattered
`on_*` option callbacks. Every layer publishes onto the bus; nothing calls
another layer's method to notify it. The facade bridges public `on/off`
subscriptions to internal bus topics.

**Public surface**

```ts
class EventBus<M extends Record<string, unknown> = GanttEventMap> {
  on<K extends keyof M>(event: K, handler: (payload: M[K]) => void): () => void;
  once<K extends keyof M>(event: K, handler: (payload: M[K]) => void): () => void;
  off<K extends keyof M>(event: K, handler: (payload: M[K]) => void): void;
  emit<K extends keyof M>(event: K, payload: M[K]): void;
  clear(): void;
}
```

**Depends on.** Nothing (leaf).

**Emits / Listens.** Carries all topics; emits/listens to none itself.

**Extracted from.** `trigger_event(event, args)` (`src/index.js:2006-2014`) and
the `on_date_change` / `on_create_dependency` / `on_arrow_rclick` option
callbacks (documented at `src/index.js:79-90`; invoked throughout via
`trigger_event`, e.g. `Bar.date_changed` `src/bar.js:599-625`).

---

#### 3.1.2 Config (OptionsResolver)

**Responsibility.** Merges user options over defaults, validates them, resolves
CSS custom properties (e.g. holiday colors like `var(--g-weekend-highlight-color)`),
and exposes an **immutable resolved config**. Owns the typed `defaults` and
`view_modes` definitions. Contains no DOM and no rendering.

**Public surface**

```ts
class Config {
  constructor(userOptions: GanttOptions);
  readonly options: Readonly<ResolvedOptions>;   // merged, validated
  readonly viewModes: ReadonlyArray<ViewMode>;
  getViewMode(name: string): ViewMode;
  resolveCssVar(value: string): string;
}
```

**Depends on.** `defaults` (`DEFAULT_OPTIONS`, `DEFAULT_VIEW_MODES`).

**Emits / Listens.** None (pure).

**Extracted from.** `setup_options(options)` (`src/index.js:219-277`),
`update_options(options)` (`src/index.js:296-300`), and the `defaults.js`
module (`DEFAULT_OPTIONS` `src/defaults.js:130-183`, `DEFAULT_VIEW_MODES`
`src/defaults.js:31-124`). Note: `setup_options` currently also resolves the
`header_mount` / `scroll_element_selector` DOM nodes — that DOM-resolution part
moves to `TableAdapter` (§3.6.1), keeping `Config` DOM-free.

---

### 3.2 Model layer (pure data, no DOM)

#### 3.2.1 TaskStore

**Responsibility.** Owns the task array and is the single source of truth for task
data. Parses and normalizes dates into `_start` / `_end`, computes durations,
normalizes ids (space → underscore), assigns `_index`, and clamps `progress` to
`0..100`. Exposes CRUD and emits a change event so renderers repaint.

**Public surface**

```ts
class TaskStore {
  constructor(tasks: Task[]);
  set(tasks: Task[]): void;                 // full replace + re-normalize
  get(id: string): Task | undefined;
  getAll(): ReadonlyArray<Task>;
  update(id: string, patch: Partial<Task>): Task;
  refresh(tasks?: Task[]): void;
  getOldestStartingDate(): Date;
}
```

**Depends on.** `date_utils`, `EventBus`.

**Emits / Listens.** Emits `tasks:changed`. Listens to none.

**Extracted from.** `setup_tasks(tasks)` (`src/index.js:301-388`),
`update_task(id, new_details)` (`src/index.js:414-425`),
`refresh(tasks)` (`src/index.js:404-413`),
`get_task(id)` (`src/index.js:1974-1979`),
`get_oldest_starting_date()` (`src/index.js:2016-2027`). Date/duration
normalization also overlaps `Bar.prepare_values`/`compute_duration`
(`src/bar.js:73-87`, `737-773`), the duration parts of which inform the scale.

---

#### 3.2.2 DependencyGraph

**Responsibility.** Builds the forward dependency map and a reverse lookup,
performs cycle detection, and answers transitive-dependent queries
(`getAllDependents(id)`) used when a drag should move dependent tasks
(`move_dependencies`).

**Public surface**

```ts
class DependencyGraph {
  constructor(tasks: ReadonlyArray<Task>);
  rebuild(tasks: ReadonlyArray<Task>): void;
  getDependents(id: string): string[];      // direct
  getAllDependents(id: string): string[];   // transitive
  dependsOn(id: string): string[];          // reverse
  hasCycle(): boolean;
}
```

**Depends on.** `TaskStore` (read-only task view), `EventBus`.

**Emits / Listens.** Listens to `tasks:changed` (rebuild). Emits none.

**Extracted from.** `setup_dependencies()` (`src/index.js:389-403`),
`get_all_dependent_tasks(task_id)` (`src/index.js:1894-1909`), and the
`dependency_map` it builds.

---

#### 3.2.3 RowHeightModel

**Responsibility.** Owns the `{ id: height }` map and computes the **effective**
height for each row (a custom `row_height` if set, otherwise
`bar_height + padding`). Validates inputs (rejects non-finite / non-positive
heights — **warn, never throw**) and persists custom heights across `refresh`.
This is the model half of the row-height-sync seam.

**Public surface**

```ts
class RowHeightModel {
  constructor(seed: Record<string, number>, defaults: { barHeight: number; padding: number });
  set(map: Record<string, number>): this;
  update(id: string, height: number): this;     // validated; non-finite rejected with warn
  reset(id: string): this;
  getEffective(id: string): number;             // custom OR (barHeight + padding)
  getAll(): Record<string, number>;             // effective map for all known ids
}
```

**Depends on.** `Config` (for `bar_height`, `padding`), `EventBus`.

**Emits / Listens.** Emits `row-heights:changed` (payload: full effective map).
Listens to none.

**Extracted from.** `setup_row_heights()` (`src/index.js:278-295`),
`getRowHeights()` (`src/index.js:2129-2143`),
`setRowHeights(heights)` (`src/index.js:2144-2173`),
`updateRowHeight(taskIdOrIndex, height)` (`src/index.js:2086-2128`; note the
recent fix that rejects non-finite heights),
`resetRowHeight(taskIdOrIndex)` (`src/index.js:2174+`). The centering math that
consumes effective heights lives in `Bar.compute_y` (`src/bar.js:723-735`),
which moves to `TimeScale`/`GridRenderer` reading this model.

---

### 3.3 Scale layer (pure computation, no DOM)

#### 3.3.1 TimeScale

**Responsibility.** The geometry brain. Owns `view_mode`, `step`/`unit`,
`column_width`, `gantt_start`/`gantt_end`, the `dates[]` column array and the
**ignored-region model** (weekends, holidays, ignored functions). It converts
between dates and x-coordinates, snaps positions, finds the column for a date,
reports ignored regions, and extends the range for infinite padding. After this
extraction, bar geometry is a *function of the scale*, not of the god object.

**Public surface**

```ts
class TimeScale {
  constructor(config: Config, store: TaskStore);
  readonly viewMode: ViewMode;
  readonly columnWidth: number;
  readonly step: number;
  readonly unit: string;
  readonly ganttStart: Date;
  readonly ganttEnd: Date;
  readonly dates: ReadonlyArray<Date>;

  dateToX(date: Date): number;
  xToDate(x: number): Date;
  snap(x: number): number;                          // honors snap_at per view-mode
  columnFor(date: Date): number;
  getIgnoredRegion(pos: number, dir?: 1 | -1): number[];
  durationOf(start: Date, end: Date): { duration: number; actualDuration: number; ignored: number };
  setViewMode(mode: ViewMode, maintainPos?: boolean): void;
  extend(by: number): void;                          // infinite_padding growth
}
```

**Depends on.** `date_utils`, `Config`, `TaskStore` (read-only).

**Emits / Listens.** Emits `scale:changed` (on view-mode switch / extend).
Listens to `tasks:changed` (recompute bounds).

**Extracted from.** `setup_dates(refresh)` (`src/index.js:485-489`),
`setup_gantt_dates(refresh)` (`src/index.js:490-548`),
`setup_date_values()` (`src/index.js:549-562`),
`update_view_scale(mode)` (`src/index.js:447-484`),
`get_snap_position(dx, ox)` (`src/index.js:1910-1942`),
`get_ignored_region(pos, drn)` (`src/index.js:1943-1954`),
plus the per-bar geometry it absorbs: `Bar.compute_x` (`src/bar.js:688-721`),
`Bar.compute_duration` (`src/bar.js:737-773`),
`Bar.compute_start_end_date` (`src/bar.js:640-657`). The `extend_by_units`
growth used in the scroll handler (`src/index.js:1569,1616`) becomes `extend()`.

---

### 3.4 Render layer (SVG; reads Scale + Model via injected read-only views)

#### 3.4.1 LayerManager

**Responsibility.** Creates and owns the SVG root and the ordered `<g>` layers
(grid, arrow, progress, bar). Provides `clear()` for teardown / re-render.

**Public surface**

```ts
class LayerManager {
  constructor(container: HTMLElement);
  readonly svg: SVGSVGElement;
  layer(name: 'grid' | 'arrow' | 'progress' | 'bar'): SVGGElement;
  clear(): void;
}
```

**Depends on.** `SvgUtils`.

**Emits / Listens.** None.

**Extracted from.** `setup_layers()` (`src/index.js:603-623`) and the SVG-root
parts of `setup_wrapper(element)` (`src/index.js:150-202`).

---

#### 3.4.2 GridRenderer

**Responsibility.** Draws the background, per-row rects, ticks / grid-lines and
highlights (holidays / weekends, current-date line + ball, ignored regions). Row
geometry is read from `RowHeightModel`; column geometry from `TimeScale`.

**Public surface**

```ts
class GridRenderer {
  constructor(layers: LayerManager, scale: TimeScale, rows: RowHeightModel, config: Config);
  render(): void;
  highlightHolidays(): void;
  highlightCurrent(): void;
}
```

**Depends on.** `LayerManager`, `TimeScale`, `RowHeightModel`, `Config`,
`SvgUtils`.

**Emits / Listens.** Listens to `tasks:changed`, `scale:changed`,
`row-heights:changed` (repaint). Emits none.

**Extracted from.** `make_grid()` (`src/index.js:624-630`),
`make_grid_extras()` (`631-635`), `make_grid_background()` (`636-683`),
`make_grid_rows()` (`684-704`), `make_grid_ticks()` (`804-866`),
`highlight_holidays()` (`867-958`), `highlight_current()` (`959-994`),
`make_grid_highlights()` (`995-1055`), `make_side_bar()` (`794-803`). Each of
those currently calls `this.getRowHeights()` (e.g. `src/index.js:645,690,820,1001`).

---

#### 3.4.3 HeaderRenderer

**Responsibility.** Draws the upper/lower header, date columns, and side-header
controls (view-mode select, today / label / expected-line buttons). **Owns the
`header_mount` seam**: renders the header into the external sticky node when one
is provided by `TableAdapter`, otherwise into the body.

**Public surface**

```ts
class HeaderRenderer {
  constructor(scale: TimeScale, config: Config, bus: EventBus, mount?: HTMLElement);
  render(): void;
  reRender(): void;
  setMount(node: HTMLElement | null): void;   // header_mount seam
}
```

**Depends on.** `TimeScale`, `Config`, `EventBus`, `SvgUtils`.

**Emits / Listens.** Emits `view-change` (from the view-mode select),
`ui:today-click`, `ui:label-toggle`, `ui:expected-toggle`. Listens to
`scale:changed` (re-render).

**Extracted from.** `make_grid_header()` (`src/index.js:705-723`),
`make_side_header()` (`724-793`), `make_dates()` (`1068-1094`),
`get_dates_to_draw()` (`1095-1104`), `get_date_info()` (`1105-1137`),
`re_render_header()` (`594-602`), `setup_header_wrapper(opts)` (`203-218`).
The mount resolution at `src/index.js:204-217,241` is the `header_mount` seam.

---

#### 3.4.4 Bar (BarRenderer)

**Responsibility.** Renders one task's visual SVG group (bar, progress, expected
progress / line, label, thumbnail, resize handles, dependency handles) and keeps
its group structure. Its geometry is **delegated to `TimeScale`**; instead of the
full `Gantt`, it receives a read-only **`BarContext`** (resolved config + scale +
emitter + popup handle), removing the ~60 `this.gantt.*` reach-backs.

**Public surface**

```ts
interface BarContext {
  readonly config: Readonly<ResolvedOptions>;
  readonly scale: TimeScale;
  readonly rows: RowHeightModel;
  readonly bus: EventBus;
  readonly layers: LayerManager;
  showPopup(opts: PopupOptions): void;
}

class Bar {
  constructor(ctx: BarContext, task: Task);
  readonly group: SVGGElement;
  refresh(): void;
  draw(): void;
  updateBarPosition(p: { x?: number; width?: number }): void;
  updateLabelPosition(): void;
  updateHandlePosition(): void;
  updateArrowPosition(): void;
}
```

**Depends on.** `BarContext` (→ `TimeScale`, `RowHeightModel`, `Config`,
`EventBus`, `LayerManager`), `DummyArrow`, `SvgUtils`, `date_utils`.

**Emits / Listens.** Emits (via bus) `hover`, `click`, `dblclick`,
`task:date-change`, `task:progress-change`, `dependency-handle-mousedown`.
Listens to none directly (driven by `refresh()`).

**Extracted from.** The whole of `src/bar.js`, decoupled from `this.gantt`.
Geometry methods `compute_x` (`src/bar.js:688-721`), `compute_duration`
(`737-773`), `compute_y` (`723-735`), `compute_start_end_date` (`640-657`) move
to / call `TimeScale`/`RowHeightModel`. The reach-backs into
`this.gantt.$header_container` / `this.gantt.$lower_header` (`src/bar.js:211,445,454`)
and `this.gantt.create_el` (`src/bar.js:205`) are replaced by context-provided
handles. `set_defaults` (`src/bar.js:44-50`) drops the `this.gantt` assignment.

---

#### 3.4.5 Arrow

**Responsibility.** Renders a dependency arrow (an SVG path) between two bars and
keeps it in sync as bars move. Receives an **`ArrowContext`** (curve radius
option, arrow layer handle, emitter, task/bar lookup) instead of the full
`Gantt`.

**Public surface**

```ts
interface ArrowContext {
  readonly curve: number;         // arrow_curve
  readonly layers: LayerManager;
  readonly bus: EventBus;
}

class Arrow {
  constructor(ctx: ArrowContext, fromTask: Bar, toTask: Bar);
  readonly element: SVGPathElement;
  calculatePath(): string;
  update(): void;
}
```

**Depends on.** `ArrowContext` (→ `LayerManager`, `Config.arrow_curve`,
`EventBus`), `SvgUtils`.

**Emits / Listens.** Emits `arrow-rclick` (right-click). Listens to none.

**Extracted from.** `src/arrow.js` (`calculate_path` `:14`, `draw` `:86`,
`setup_listeners` `:94`, `update` `:100`) decoupled from `gantt`. Wiring from
`make_arrows()` (`src/index.js:1146-1166`) and `map_arrows_on_bars()`
(`1167-1177`) moves into the render orchestration / facade.

---

#### 3.4.6 DummyArrow

**Responsibility.** Renders the live drag-to-connect preview arrow that follows
the pointer while the user drags from a bar's dependency handle, until the
gesture lands on a target bar (which produces a real `Arrow` + a
`create-dependency` event).

**Public surface**

```ts
class DummyArrow {
  constructor(ctx: ArrowContext, fromTask: Bar, fromPoint: { x: number; y: number });
  calculatePath(): string;
  update(point: { x: number; y: number }): void;
  draw(): void;
}
```

**Depends on.** `ArrowContext`, `SvgUtils`.

**Emits / Listens.** Emits `create-dependency` on a successful drop. Listens to
none. (Note: `src/dummy_arrow.js:73` contains a stray `console.log('constructor')`
to remove during extraction.)

**Extracted from.** `src/dummy_arrow.js` (`setup_listener` `:18`,
`calculate_path` `:79`, `draw` `:140`, `update` `:149`), spawned today from
`Bar.setup_dependency_handle_click` (`src/bar.js:495-512`).

---

#### 3.4.7 SvgUtils

**Responsibility.** Pure SVG/DOM helpers: element creation, attribute animation,
selector helper, and event delegation. Unchanged in behavior.

**Public surface**

```ts
function createSVG(tag: string, attrs: Record<string, unknown>): SVGElement;
function animateSVG(el: SVGElement, attr: string, from: number, to: number): void;
const $: { (selector: string, el?: Element | Document): Element | null;
           on(el: Element, event: string, handler: EventListener): void;
           on(el: Element, event: string, selector: string, handler: EventListener): void;
           off(el: Element, event: string, handler: EventListener): void; };
```

**Depends on.** Nothing (leaf).

**Emits / Listens.** None.

**Extracted from.** `src/svg_utils.js` (already a clean leaf; only the SVGElement
prototype helpers `getX/getY/getWidth/getHeight/getEndX` currently injected by
`Bar.prepare_helpers` `src/bar.js:89-105` should move here).

---

### 3.5 Interaction layer

#### 3.5.1 InteractionController

**Responsibility.** Orchestrates all pointer gestures on bars: **move**,
**resize-left**, **resize-right**, **progress-drag** and **dependency-create**.
It computes deltas, applies `TimeScale.snap`, respects the `readonly*` flags,
mutates tasks **only through `TaskStore`** (and moves dependents via
`DependencyGraph` when `move_dependencies` is on), and emits typed events. It may
split internally into Drag/Resize/Progress/Dependency strategies but presents one
cohesive controller.

**Public surface**

```ts
class InteractionController {
  constructor(deps: {
    layers: LayerManager; scale: TimeScale; store: TaskStore;
    graph: DependencyGraph; config: Config; bus: EventBus;
    bars: () => Iterable<Bar>;
  });
  bind(): void;
  destroy(): void;
}
```

**Depends on.** `LayerManager`, `TimeScale`, `TaskStore`, `DependencyGraph`,
`Config`, `EventBus`, the `Bar` set, `DummyArrow`.

**Emits / Listens.** Emits `task:date-change` (with `source`:
`drag|resize-left|resize-right`), `task:progress-change`,
`create-dependency`, `dependency-handle-mousedown`. Listens to none.

**Extracted from.** `bind_bar_events()` (`src/index.js:1463-1808`, the ~345-line
gesture engine including snapping and dependent-move), `bind_bar_progress()`
(`1809-1893`), `get_start_end_positions()` (`1448-1462`), `unselect_all()`
(`1955-1961`), and the bar-side hooks `Bar.bind`/`setup_click_event`/
`setup_dependency_handle_click` + `date_changed`/`progress_changed`
(`src/bar.js:399-512,599-633`). The infinite-padding extension currently inlined
in the scroll branch of `bind_bar_events` (`src/index.js:1539-1645`) moves to
`ScrollController` (§3.5.2).

---

#### 3.5.2 ScrollController

**Responsibility.** Owns scroll position and synchronization. **Owns the
`scroll_element_selector` seam**: it reads/writes scroll on the host-provided
element, keeps the header (`header_mount` node) and body horizontally in sync,
maintains the current-date display, and implements `infinite_padding` by asking
`TimeScale.extend()` when the user scrolls past the edge.

**Public surface**

```ts
class ScrollController {
  constructor(deps: {
    body: HTMLElement; header: HTMLElement | null;
    scale: TimeScale; config: Config; bus: EventBus;
    scrollElement?: HTMLElement;     // scroll_element_selector seam
  });
  bind(): void;
  scrollTo(date: Date | 'today' | 'start'): void;
  scrollToToday(): void;
  destroy(): void;
}
```

**Depends on.** `TimeScale`, `Config`, `EventBus`, the body / header / host
scroll elements.

**Emits / Listens.** Emits `scroll:changed`, `scroll:extended`. Listens to
`scale:changed` (resync). Drives `TimeScale.extend()`.

**Extracted from.** `set_scroll_position(date)` (`src/index.js:1188-1289`),
`scroll_current()` (`1290-1325`), `get_closest_date()` (`1326-1382`),
`update_current_date_display()` (`1383-1411`), and the scroll/extend branch
inside `bind_bar_events` (`1539-1645`, using `extend_by_units`). The
`$scroll_element` resolution (`src/index.js:224-225`) is the seam input.

---

### 3.6 Integration layer (the differentiator)

#### 3.6.1 TableAdapter

**Responsibility.** Formalizes binding the chart into a host table. One place
that knows about the three seams:

1. **Row-height sync** — optionally observe host rows via `ResizeObserver`
   (opt-in `syncRowHeightsFrom`), push measured heights into `RowHeightModel`,
   and trigger a re-render; plus the reverse read via `getRowHeights()`. Maps
   task id ↔ host row.
2. **Header mount** — hand `HeaderRenderer` the external sticky node
   (`headerMount`).
3. **External scroll** — hand `ScrollController` the host scroll container
   (`scrollElement`).

Exposed as an explicit, documented object so integration is a feature, not a set
of loose options. Loose top-level options remain supported by the facade for
ergonomics, but route through here.

**Public surface**

```ts
class TableAdapter {
  constructor(deps: {
    rows: RowHeightModel; bus: EventBus;
    header: HeaderRenderer; scroll: ScrollController;
    options: TableIntegrationOptions;
  });
  bind(): void;
  destroy(): void;                 // disconnects ResizeObserver
}

interface TableIntegrationOptions {
  headerMount?: string | HTMLElement;
  scrollElement?: string | HTMLElement;
  rowHeights?: Record<string, number>;
  syncRowHeightsFrom?: string | HTMLElement;   // opt-in observer
}
```

**Depends on.** `RowHeightModel`, `HeaderRenderer`, `ScrollController`,
`EventBus`, the DOM (host nodes), `ResizeObserver`.

**Emits / Listens.** Emits `row-heights-change` (public). Listens to
`row-heights:changed` (model) to re-render and re-emit.

**Extracted from.** The seam plumbing currently scattered across the monolith:
`header_mount` resolution (`src/index.js:203-217,241`), `scroll_element_selector`
resolution (`224-225`), the `row_heights` seed (`setup_row_heights`,
`src/index.js:278-295`), and the header-mount branches in `set_scroll_position`
(`1193,1239`). See [`./INTEGRATION.md`](./INTEGRATION.md) for the host recipe.

---

#### 3.6.2 Plugin host

**Responsibility.** A minimal plugin registry on the facade. Installs each plugin
with a `PluginContext`, tracks them, and destroys them on teardown. Core never
references any plugin directly.

**Public surface**

```ts
class PluginHost {
  constructor(ctx: PluginContext);
  use(plugin: GanttPlugin): void;
  installAll(plugins: GanttPlugin[]): void;
  destroy(): void;                          // calls plugin.destroy() in reverse
}
```

**Depends on.** `EventBus`, `Config`, container nodes, `TimeScale` (read-only) —
i.e. it constructs the `PluginContext`.

**Emits / Listens.** None of its own; it hands the bus to plugins.

**Extracted from.** The inline label wiring `setup_labels` / `init_label`
(`src/index.js:2041-2043,2073+`) becomes the first plugin (`LabelPanelPlugin`,
§6) installed through this host instead of being hard-wired into core.

---

### 3.7 Facade

#### 3.7.1 Gantt

**Responsibility.** A thin orchestrator. It constructs `Config`, `EventBus`, the
model (`TaskStore`, `DependencyGraph`, `RowHeightModel`), `TimeScale`, the
renderers, the controllers, the `TableAdapter`, and the `PluginHost`; exposes the
new public API; and bridges public event subscriptions to the bus. Target: a few
hundred lines of *wiring*, not logic.

**Public surface (new API)**

```ts
class Gantt {
  constructor(container: string | HTMLElement, options: GanttOptions);

  // events (typed)
  on<K extends keyof GanttEventMap>(e: K, h: (p: GanttEventMap[K]) => void): () => void;
  off<K extends keyof GanttEventMap>(e: K, h: (p: GanttEventMap[K]) => void): void;

  // data
  setTasks(tasks: Task[]): this;            // replaces refresh(tasks)
  updateTask(id: string, patch: Partial<Task>): this;
  getTask(id: string): Task | undefined;

  // view
  setViewMode(mode: string): this;          // replaces change_view_mode
  scrollToToday(): this;

  // row heights (fluent sub-API)
  readonly rows: {
    set(map: Record<string, number>): Gantt['rows'];
    update(id: string, height: number): Gantt['rows'];
    reset(id: string): Gantt['rows'];
    getAll(): Record<string, number>;
  };

  // lifecycle
  destroy(): void;                          // full teardown (replaces clear())
}
```

**Depends on.** Every unit above (it composes them).

**Emits / Listens.** Bridges all public topics; re-emits internal bus topics as
public events (`date-change`, `progress-change`, `create-dependency`,
`arrow-rclick`, `view-change`, `click`/`dblclick`/`hover`, `row-heights-change`).

**Extracted from.** The constructor + wiring of `src/index.js` (`constructor`
`:139-149`, `setup_wrapper` `:150-202`, `bind_events` `:563-568`, `render`
`:569-593`, `make_bars` `:1138-1145`, `make_arrows` `:1146-1166`,
`set_dimensions` `:1178-1187`, `clear` `:2028-2040`). All business logic moves to
the units; only orchestration and the public surface remain. The old positional
constructor `new Gantt(wrapper, tasks, options)` becomes
`new Gantt(container, { tasks, ...options })`. See the old→new map in
[`./MIGRATION.md`](./MIGRATION.md).

---

## 4. Class aggregation / composition

The `Gantt` facade **composes** every unit; units reference each other only
downward (and only the read-only contexts they are given). The cross-cutting
`EventBus` and `Config` are injected into nearly everything.

### 4.1 Composition diagram (mermaid)

```mermaid
graph TD
  Gantt[Gantt facade]

  subgraph CrossCutting[cross-cutting]
    Bus[EventBus]
    Cfg[Config / OptionsResolver]
  end

  subgraph Model
    TS[TaskStore]
    DG[DependencyGraph]
    RH[RowHeightModel]
  end

  subgraph Scale
    Scale[TimeScale]
  end

  subgraph Render
    LM[LayerManager]
    Grid[GridRenderer]
    Hdr[HeaderRenderer]
    Bar[Bar]
    Arrow[Arrow]
    Dummy[DummyArrow]
    Svg[SvgUtils]
  end

  subgraph Interaction
    IC[InteractionController]
    SC[ScrollController]
  end

  subgraph Integration
    TA[TableAdapter]
    PH[PluginHost]
  end

  Gantt --> Cfg
  Gantt --> Bus
  Gantt --> TS
  Gantt --> DG
  Gantt --> RH
  Gantt --> Scale
  Gantt --> LM
  Gantt --> Grid
  Gantt --> Hdr
  Gantt --> IC
  Gantt --> SC
  Gantt --> TA
  Gantt --> PH

  DG --> TS
  RH --> Cfg
  Scale --> TS
  Scale --> Cfg

  Grid --> LM
  Grid --> Scale
  Grid --> RH
  Hdr --> Scale
  Bar --> Scale
  Bar --> RH
  Bar --> LM
  Bar --> Dummy
  Arrow --> LM
  Dummy --> LM
  Grid --> Svg
  Hdr --> Svg
  Bar --> Svg
  Arrow --> Svg

  IC --> Scale
  IC --> TS
  IC --> DG
  IC --> Bar
  IC --> Dummy
  SC --> Scale

  TA --> RH
  TA --> Hdr
  TA --> SC
  PH -. PluginContext .-> Bus

  Bus -. all units publish/subscribe .- Gantt
  Cfg -. injected into most units .- Gantt
```

### 4.2 Composition diagram (ASCII fallback)

```
Gantt (facade) ──composes──┐
   ├─ Config  (injected everywhere) ───────────────┐
   ├─ EventBus(injected everywhere) ──────────────┐│
   ├─ TaskStore ◄── DependencyGraph               ││
   │      ▲           ▲                            ││
   │      └───────────┴──── RowHeightModel ── Config
   ├─ TimeScale ──reads──► TaskStore, Config       ││
   ├─ LayerManager ──uses──► SvgUtils              ││
   ├─ GridRenderer ──reads──► TimeScale, RowHeightModel, LayerManager
   ├─ HeaderRenderer ──reads──► TimeScale; owns header_mount node
   ├─ Bar ──BarContext──► TimeScale, RowHeightModel, LayerManager, EventBus
   │      └─ spawns DummyArrow; bound by InteractionController
   ├─ Arrow / DummyArrow ──ArrowContext──► LayerManager, EventBus
   ├─ InteractionController ──► TimeScale, TaskStore, DependencyGraph, Bar
   ├─ ScrollController ──► TimeScale; owns scroll_element_selector node
   ├─ TableAdapter ──► RowHeightModel, HeaderRenderer, ScrollController
   └─ PluginHost ──hands PluginContext──► plugins (LabelPanelPlugin)

   Communication upward: every box emits on EventBus; Gantt re-emits public events.
```

---

## 5. Data-flow walkthroughs

### 5.1 Initial render

```mermaid
sequenceDiagram
  participant Host
  participant Gantt
  participant Config
  participant Store as TaskStore
  participant Scale as TimeScale
  participant Layers as LayerManager
  participant Grid as GridRenderer
  participant Hdr as HeaderRenderer
  participant Bars as Bar(s)
  participant TA as TableAdapter

  Host->>Gantt: new Gantt(el, { tasks, table, ... })
  Gantt->>Config: resolve(options)
  Gantt->>Store: set(tasks)  (normalize _start/_end/_index)
  Store-->>Gantt: tasks:changed
  Gantt->>Scale: build (gantt_start/end, dates[], ignored)
  Gantt->>Layers: create SVG root + g layers
  Gantt->>TA: bind seams (headerMount, scrollElement, rowHeights)
  Gantt->>Grid: render background/rows/ticks/highlights
  Gantt->>Hdr: render (into header_mount if provided)
  Gantt->>Bars: for each task → draw (geometry via Scale, y via RowHeightModel)
  Gantt->>Gantt: map arrows on bars; bind controllers
  Gantt->>Host: scrollTo(scroll_to ?? 'today')
```

Numbered: (1) facade resolves config; (2) `TaskStore` normalizes tasks and emits
`tasks:changed`; (3) `TimeScale` computes bounds + columns + ignored model;
(4) `LayerManager` builds the SVG; (5) `TableAdapter` wires the three seams;
(6) `GridRenderer` then `HeaderRenderer` paint; (7) each `Bar` draws using
`TimeScale` for x/width and `RowHeightModel` for the centered y; (8) arrows are
mapped onto bars; (9) controllers bind; (10) `ScrollController` scrolls to the
configured target.

### 5.2 Drag-to-move (end to end)

```mermaid
sequenceDiagram
  participant User
  participant IC as InteractionController
  participant Scale as TimeScale
  participant Store as TaskStore
  participant DG as DependencyGraph
  participant Bus as EventBus
  participant Bar
  participant Arrow
  participant Gantt
  participant Host

  User->>IC: pointerdown + drag on bar (dx)
  IC->>Scale: snap(x + dx)
  Scale-->>IC: snapped x → new start/end
  IC->>Store: update(id, { start, end })
  opt move_dependencies
    IC->>DG: getAllDependents(id)
    IC->>Store: update each dependent (shifted)
  end
  Store-->>Bus: tasks:changed
  IC->>Bus: emit task:date-change { task, source: 'drag' }
  Bus-->>Bar: repaint (read Scale) ; Bar.updateBarPosition
  Bus-->>Arrow: update() paths
  Bus-->>Gantt: re-emit public 'date-change'
  Gantt-->>Host: on('date-change') → persist via API
```

Key point: the bar never mutates task state directly; the controller mutates
**only** through `TaskStore`, and everything downstream reacts to the resulting
events. This is the spec's §2.3 flow made concrete.

### 5.3 Host-table row-height change

```mermaid
sequenceDiagram
  participant HostRow as Host <tr>
  participant RO as ResizeObserver
  participant TA as TableAdapter
  participant RH as RowHeightModel
  participant Bus as EventBus
  participant Grid as GridRenderer
  participant Bar
  participant Gantt
  participant Host

  HostRow->>RO: row height → 96px
  RO->>TA: entry (map host row → task id)
  TA->>RH: update(taskId, 96)   (validated; non-finite rejected with warn)
  RH-->>Bus: row-heights:changed { effective map }
  Bus-->>Grid: re-render row rects at new heights
  Bus-->>Bar: recompute y (RowHeightModel) → re-center bar
  TA-->>Gantt: re-emit public 'row-heights-change'
  Gantt-->>Host: on('row-heights-change') (optional persist)
```

Two directions are supported: the observer path above (opt-in
`syncRowHeightsFrom`), and the imperative push path `gantt.rows.update(id, h)` /
`gantt.rows.set(map)` which enters at `RowHeightModel` and produces the same
`row-heights:changed` event. Bars stay vertically centered because
`Bar.compute_y` reads the effective height from `RowHeightModel`
(today `src/bar.js:723-735`).

### 5.4 View-mode switch

```mermaid
sequenceDiagram
  participant Trigger as Select / host ctrl+wheel
  participant Gantt
  participant Scale as TimeScale
  participant Bus as EventBus
  participant SC as ScrollController
  participant Grid as GridRenderer
  participant Hdr as HeaderRenderer
  participant Bars as Bar(s)
  participant Host

  Trigger->>Gantt: setViewMode('Week')
  Gantt->>SC: capture current scroll anchor (date)
  Gantt->>Scale: setViewMode(mode, maintainPos)
  Scale-->>Bus: scale:changed (new step/unit/column_width/dates[])
  Bus-->>Hdr: re-render header columns
  Bus-->>Grid: re-render ticks/highlights
  Bus-->>Bars: recompute x/width via Scale; redraw
  Gantt->>SC: restore scroll to captured anchor date
  Gantt->>Bus: emit 'view-change' { mode }
  Gantt-->>Host: on('view-change')
```

Scroll position is preserved by anchoring on a date before the scale change and
re-resolving its x afterward (the monolith's `change_view_mode(mode, maintain_pos)`
at `src/index.js:426-446` / `update_view_scale` `447-484`).

---

## 6. Plugin architecture

Core is pure timeline. Optional features (starting with the label side-panel)
attach as plugins through the `PluginHost`. Core never imports a plugin.

### 6.1 The `GanttPlugin` interface

```ts
interface GanttPlugin {
  readonly name: string;
  install(ctx: PluginContext): void;
  destroy(): void;
}
```

### 6.2 `PluginContext`

A plugin receives only a **read-only** view of the system — never the `Gantt`
instance and never private flags.

```ts
interface PluginContext {
  readonly bus: EventBus;                 // subscribe + emit (coordination)
  readonly config: Readonly<ResolvedOptions>;
  readonly containers: {                  // injected DOM mount points
    root: HTMLElement;
    body: HTMLElement;
    header?: HTMLElement;
  };
  readonly scale: Readonly<TimeScale>;    // read-only geometry
}
```

### 6.3 Lifecycle

- **install(ctx)** — called once by `PluginHost.use()` / `installAll()` during
  facade construction (or later). The plugin reads `ctx`, builds its own DOM
  inside the injected containers, and subscribes to bus topics it cares about.
- **destroy()** — called by `PluginHost.destroy()` (in reverse install order)
  during `Gantt.destroy()`. The plugin tears down its DOM and unsubscribes. No
  plugin leaks listeners or nodes.

### 6.4 `LabelPanelPlugin`

The current `Label` class (`src/label.js`) becomes the first plugin, decoupled
per the spec:

- **No direct mutation of instance flags.** Today `Label` mutates
  `gantt._isSyncingLabelScroll` directly; instead it uses `ctx.bus` for
  scroll-sync coordination (publish/subscribe to `scroll:changed`).
- **Height calc injected**, not read off the god object — it reads effective
  heights via events / the read-only context rather than calling `getRowHeights`
  on `Gantt`.
- **DOM containers injected** via `ctx.containers` instead of reaching into
  `gantt.$container`.
- **Its options move under the plugin's own config namespace.** `labels`,
  `label_button`, `label_filter` (today defaults in `src/defaults.js:177-178`)
  move out of core options into the plugin's config. Core no longer references
  labels (removing `setup_labels`/`init_label`/`toggle_label_field`,
  `src/index.js:2041-2049,2073+`).

It is itself a mini-grid, which is exactly why it must not live in core — that
would contradict the "no integrated table" promise (spec §8 item 18).

`Popup` (`src/popup.js`) may also become a plugin later; for v1 it stays a core
collaborator (small, already callback-based) but is reached only through the
`BarContext.showPopup` handle, behind an interface — not via `this.gantt.popup`.

See [`./PLUGINS.md`](./PLUGINS.md) for the full plugin authoring guide.

---

## 7. Directory / module layout

Proposed `src/` tree (one file per class, grouped by layer). Files migrate to
`.ts` bottom-up per the staged migration (spec §6); shown here with target paths.

```
src/
├─ core/
│  ├─ Gantt.ts                 # facade (§3.7)
│  ├─ EventBus.ts              # cross-cutting (§3.1.1)
│  ├─ Config.ts                # OptionsResolver (§3.1.2)
│  └─ defaults.ts              # DEFAULT_OPTIONS, DEFAULT_VIEW_MODES (from src/defaults.js)
├─ model/
│  ├─ TaskStore.ts             # §3.2.1
│  ├─ DependencyGraph.ts       # §3.2.2
│  └─ RowHeightModel.ts        # §3.2.3
├─ scale/
│  └─ TimeScale.ts             # §3.3.1
├─ render/
│  ├─ LayerManager.ts          # §3.4.1
│  ├─ GridRenderer.ts          # §3.4.2
│  ├─ HeaderRenderer.ts        # §3.4.3
│  ├─ Bar.ts                   # §3.4.4 (from src/bar.js)
│  ├─ Arrow.ts                 # §3.4.5 (from src/arrow.js)
│  └─ DummyArrow.ts            # §3.4.6 (from src/dummy_arrow.js)
├─ interaction/
│  ├─ InteractionController.ts # §3.5.1
│  └─ ScrollController.ts      # §3.5.2
├─ integration/
│  ├─ TableAdapter.ts          # §3.6.1 (the differentiator)
│  └─ PluginHost.ts            # §3.6.2
├─ plugins/
│  ├─ GanttPlugin.ts           # interface + PluginContext (§6)
│  └─ LabelPanelPlugin.ts      # from src/label.js (§6.4)
├─ util/
│  ├─ svg_utils.ts             # SvgUtils (§3.4.7, from src/svg_utils.js)
│  └─ date_utils.ts            # from src/date_utils.js
├─ types/
│  └─ index.ts                 # Task, Arrow, ViewMode, GanttOptions, GanttEventMap (spec §3)
├─ styles/                     # existing SCSS/CSS
└─ index.ts                    # public entry: export { Gantt } + types
```

Mapping from today's flat `src/` (current files: `index.js`, `bar.js`,
`arrow.js`, `dummy_arrow.js`, `date_utils.js`, `defaults.js`, `label.js`,
`popup.js`, `svg_utils.js`, `styles/`): the 2,239-line `index.js` is split across
`core/`, `model/`, `scale/`, `render/`, `interaction/` and `integration/` per the
extraction maps in §3; the leaf utils and renderers move to their layer folders;
`label.js` becomes `plugins/LabelPanelPlugin.ts`. The monolith is deleted only at
migration stage 5 (strangler approach), so the lib stays shippable throughout.

---

## 8. Cross-references

- [`./API.md`](./API.md) — full public API reference: constructor, methods, the
  `rows` sub-API, and the event subscription surface.
- [`./DATA-MODEL.md`](./DATA-MODEL.md) — `Task`, `Arrow`, `ViewMode`,
  `GanttOptions`, `TableIntegrationOptions`, and the `GanttEventMap` types
  (snake_case task fields vs. camelCase public API).
- [`./EVENTS.md`](./EVENTS.md) — event reference with payloads and emission
  timing for every topic on the `EventBus` and every public event.
- [`./INTEGRATION.md`](./INTEGRATION.md) — the table-integration guide: the three
  seams (header mount, external scroll, row-height sync), the host recipe, and
  the `susp-frontend` example.
- [`./FEATURES.md`](./FEATURES.md) — all UX/UI features in BDD (Given/When/Then)
  form, 1:1 with the feature inventory (spec §8).
- [`./PLUGINS.md`](./PLUGINS.md) — the `GanttPlugin` interface, `PluginContext`,
  lifecycle, and the `LabelPanelPlugin`.
- [`./MIGRATION.md`](./MIGRATION.md) — the old→new API map and the staged TS
  migration notes.
