# Plugins

> Part of the `@gts-ui/chart-gantt` documentation set.
> See also: [ARCHITECTURE.md](./ARCHITECTURE.md) · [API.md](./API.md) · [EVENTS.md](./EVENTS.md)

This guide describes the plugin system introduced in the re-architecture: why it
exists, the contract a plugin must satisfy, how to register and author plugins,
the rules every plugin must follow, and the first real plugin shipped on top of
the system — **`LabelPanelPlugin`**.

---

## 1. Why a plugin system

`@gts-ui/chart-gantt` has one deliberately narrow value proposition:

> **A timeline-only Gantt with NO integrated grid/table.** The consumer brings
> their own table; the chart renders the bars, arrows, and timeline and binds
> itself into a single full-height cell of that host table.

Anything that drifts toward "being a table" dilutes that promise. Yet some
consumers legitimately want table-ish surfaces — a column of row labels, a
toolbar button, an overlay marker. The old codebase resolved this tension badly:
the **label side-panel** (itself a mini-grid) shipped *inside* the core monolith
and reached directly into private `Gantt` state. The library's selling point
("no integrated table") was contradicted by its own code.

The plugin system resolves the tension cleanly:

- **The core stays a pure timeline.** It renders scale, grid, header, bars, and
  arrows — nothing else. It contains zero references to labels, toolbars, or any
  other optional surface.
- **Optional / table-ish UI ships as opt-in modules.** A plugin is a
  self-contained unit the host *chooses* to register. If you do not register it,
  not a byte of its behavior runs and not a node of its DOM is created.
- **Coupling is replaced by a contract.** Plugins talk to the core only through
  an injected, read-only `PluginContext` and the typed `EventBus`. They never
  import core internals and never mutate private fields.

The first thing extracted onto this system is the label panel — see §6.

---

## 2. The plugin contract

A plugin is any object that satisfies the `GanttPlugin` interface. The host calls
`install(ctx)` exactly once when the plugin is registered and `destroy()` exactly
once when it is removed (or when the chart is destroyed).

### 2.1 `GanttPlugin`

```ts
/**
 * A Gantt plugin. Implement this interface and register it via
 * `new Gantt(el, { plugins: [myPlugin] })` or `gantt.use(myPlugin)`.
 *
 * A plugin instance is single-use: once `destroy()` has been called it must not
 * be re-installed. Create a fresh instance to re-register.
 */
export interface GanttPlugin {
  /**
   * Stable, unique identifier for this plugin (e.g. "label-panel").
   * Used for de-duplication, lookup via `gantt.getPlugin(name)`, and as the
   * recommended namespace prefix for any events the plugin emits.
   * Registering two plugins with the same `name` is an error.
   */
  readonly name: string;

  /**
   * Called once, synchronously, when the plugin is registered. Receives the
   * host-injected context (§2.2). This is where the plugin subscribes to bus
   * events, builds and attaches its DOM into `ctx.containers`, and reads
   * `ctx.config` / `ctx.scale` to lay itself out.
   *
   * MUST NOT throw on a well-formed context. A throwing `install` aborts
   * registration; the host will not call `destroy()` for a plugin whose
   * `install` threw.
   */
  install(ctx: PluginContext): void;

  /**
   * Called once when the plugin is removed (`gantt.remove(name)`), replaced, or
   * when the host is torn down (`gantt.destroy()`). The plugin MUST:
   *   - remove every DOM node it created,
   *   - unsubscribe every bus listener it added,
   *   - remove every native DOM/window listener it added,
   *   - drop references so it can be garbage-collected.
   * After `destroy()` the plugin must leave no trace on the page or in memory.
   * MUST be idempotent-safe: calling it once is enough, and it must not throw if
   * `install` was never completed.
   */
  destroy(): void;
}
```

### 2.2 `PluginContext`

The context is the **only** channel through which a plugin observes and affects
the chart. Everything a plugin is allowed to touch is on this object; everything
else is private. Every member is either read-only data or a controlled handle.

```ts
/**
 * The capability bundle the host injects into `GanttPlugin.install`.
 * A plugin keeps the reference it is given and uses these members for the whole
 * of its life. The host guarantees these members are valid until the plugin's
 * `destroy()` returns.
 */
export interface PluginContext {
  /**
   * The shared, typed event bus — the plugin's primary communication channel.
   * Use `bus.on` to react to chart activity and `bus.emit` to announce the
   * plugin's own activity. Listeners added here MUST be removed in `destroy()`
   * (keep the references, or use the disposer the bus returns).
   *
   * The bus carries the public `GanttEventMap` (see EVENTS.md) plus any
   * namespaced events plugins emit. A plugin should NEVER call a renderer or
   * controller method to "notify" the core — emit on the bus instead.
   */
  readonly bus: EventBus<GanttEventMap & Record<string, unknown>>;

  /**
   * The fully-resolved, immutable options for this chart instance (defaults
   * merged with user options, CSS custom properties resolved). Read-only:
   * mutating it is unsupported and has no effect on the core. A plugin reads
   * its own config namespace (e.g. `config.labels`) and any rendering metrics
   * it needs (e.g. `config.barHeight`, `config.padding`).
   */
  readonly config: ResolvedConfig;

  /**
   * The DOM nodes a plugin is permitted to attach to. The host owns these
   * nodes; the plugin appends/prepends its own elements and is responsible for
   * removing them again in `destroy()`. The plugin MUST NOT remove or restyle
   * the host-owned nodes themselves — only its own children.
   */
  readonly containers: PluginContainers;

  /**
   * A read-only view of the geometry brain (date↔x, snap, columns, ranges).
   * A plugin uses it to position things on the timeline (e.g. "where is today?")
   * without recomputing scale math. It is a view: the plugin cannot mutate the
   * scale through it. The reference stays valid across re-renders; query it
   * fresh inside a render/refresh handler rather than caching derived values.
   */
  readonly scale: ReadonlyTimeScale;

  /**
   * Optional read-only view of the task model, for plugins that present
   * per-row data (the label panel uses it to align rows). Iteration order is
   * render order (`_index`). The plugin MUST treat returned tasks as immutable;
   * to change a task it emits an intent on the bus or calls the public API the
   * host wired — never mutate the task object in place.
   */
  readonly tasks: ReadonlyTaskView;

  /**
   * Inject a height calculator instead of reading core layout fields. Returns
   * the current usable body height (grid height minus header height) in px.
   * Plugins that size a scrollable column to match the chart body call this on
   * install and on every 'render' / 'refresh' event rather than reaching into
   * core fields such as `grid_height` or `config.header_height`.
   */
  readonly getBodyHeight: () => number;
}

/** DOM nodes a plugin may attach its own elements to. */
export interface PluginContainers {
  /** The chart's outermost element (the node passed to `new Gantt`). */
  readonly root: HTMLElement;
  /** The flex row that holds the side panel(s) and the SVG body. */
  readonly main: HTMLElement;
  /** The scrollable body wrapper (vertical scroll lives here). */
  readonly body: HTMLElement;
  /** The (possibly external) sticky header node, for header-adjacent UI. */
  readonly header: HTMLElement;
}

/** Read-only projection of `TimeScale` exposed to plugins. */
export interface ReadonlyTimeScale {
  readonly viewMode: ViewMode;
  readonly columnWidth: number;
  readonly ganttStart: Date;
  readonly ganttEnd: Date;
  dateToX(date: Date): number;
  xToDate(x: number): Date;
  columnFor(date: Date): number;
}

/** Read-only projection of `TaskStore` exposed to plugins. */
export interface ReadonlyTaskView {
  all(): readonly Task[];
  get(id: string): Task | undefined;
  count(): number;
}
```

> `EventBus`, `ResolvedConfig`, `ViewMode`, `Task`, and `GanttEventMap` are
> defined in [DATA-MODEL.md](./DATA-MODEL.md) and [EVENTS.md](./EVENTS.md).

### 2.3 Lifecycle

```
register (plugins:[] at construction, or gantt.use(p))
   │
   ▼
install(ctx)  ──── once, synchronously ────────────────────────────┐
   │  subscribe bus events · build & attach DOM · read config/scale │
   ▼                                                                 │
  …live…   bus emits 'render' / 'refresh' / 'view-change' / 'scroll' │
   │       the plugin re-reads ctx.scale / ctx.getBodyHeight() and   │
   │       repaints its own surface — it is never re-installed       │
   ▼                                                                 │
destroy() ─ once ─ on gantt.remove(name) | gantt.destroy() | replace┘
        remove DOM · unsubscribe bus · remove native listeners · drop refs
```

- **`install(ctx)` is called once**, synchronously, at registration time —
  either while `new Gantt(...)` processes the `plugins` array (after the core has
  built its DOM and computed an initial scale, so containers and scale are
  already valid) or immediately when `gantt.use(plugin)` is called on a live
  instance.
- **`destroy()` is called once**, on any of:
  - `gantt.remove(name)` — explicit removal of a single plugin,
  - re-registering a plugin with the same `name` (the old instance is destroyed
    first, then the new one installed),
  - `gantt.destroy()` — full chart teardown destroys every registered plugin in
    reverse registration order **before** the core tears down its own DOM.
- **Re-render / refresh is not a re-install.** The chart repaints in place on
  data, view, scroll, and size changes. The plugin is *not* re-installed; instead
  it subscribes to the relevant bus events (e.g. `'render'`, `'refresh'`,
  `'view-change'`, `'scroll'`) and updates its own surface in the handler. Use
  `ctx.getBodyHeight()` and `ctx.scale` inside those handlers so the plugin
  always reflects the current geometry.

---

## 3. Registering plugins

There are two entry points. Prefer the **constructor `plugins` option** as the
primary, declarative path; `gantt.use()` is the imperative escape hatch for
adding a plugin to an already-constructed instance.

### 3.1 Primary: the `plugins` option (declarative)

```ts
import { Gantt } from '@gts-ui/chart-gantt';
import { LabelPanelPlugin } from '@gts-ui/chart-gantt/plugins';

const gantt = new Gantt(container, {
  tasks,
  viewMode: 'Day',
  plugins: [
    new LabelPanelPlugin({ /* plugin config — see §6 */ }),
  ],
});
```

Each entry is installed in array order, after the core has finished its initial
render. Registration is idempotent by `name`: a duplicate `name` in the array is
an error.

### 3.2 Secondary: `gantt.use()` / `gantt.remove()` (imperative)

```ts
const panel = new LabelPanelPlugin({ /* ... */ });

gantt.use(panel);            // installs immediately, returns `this` (fluent)
gantt.getPlugin('label-panel');   // → the installed instance, or undefined
gantt.remove('label-panel');      // calls its destroy(), returns `this`
```

```ts
// Facade surface (excerpt; full list in API.md)
interface Gantt {
  use(plugin: GanttPlugin): this;
  remove(name: string): this;
  getPlugin(name: string): GanttPlugin | undefined;
  destroy(): void; // tears down all plugins (reverse order), then the core
}
```

Use `plugins: []` when the set of plugins is known up front (the common case in
the host). Use `use()`/`remove()` for runtime toggling — e.g. a user preference
that turns the label panel on and off without rebuilding the chart.

---

## 4. Authoring a plugin: a step-by-step tutorial

We will build a small **`TodayMarkerPlugin`** that draws a thin vertical line at
the current date and keeps it positioned as the user scrolls or changes view
mode. It uses *only* the `PluginContext` — no reach-back into private internals.

### Step 1 — Declare the class and its `name`

```ts
import type { GanttPlugin, PluginContext } from '@gts-ui/chart-gantt';

export interface TodayMarkerOptions {
  /** CSS color for the marker line. Defaults to the theme accent. */
  color?: string;
  /** Marker label text; omit for a bare line. */
  label?: string;
}

export class TodayMarkerPlugin implements GanttPlugin {
  readonly name = 'today-marker';

  private ctx!: PluginContext;
  private el?: HTMLElement;
  private disposers: Array<() => void> = [];

  constructor(private readonly options: TodayMarkerOptions = {}) {}
  // ... install / destroy below
}
```

### Step 2 — Build and attach DOM in `install`

Attach to an injected container; never query the document for core nodes.

```ts
  install(ctx: PluginContext): void {
    this.ctx = ctx;

    const el = document.createElement('div');
    el.className = 'gantt-today-marker';
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.width = '0';
    el.style.borderLeft = `1px solid ${this.options.color ?? 'var(--g-accent, #f44)'}`;
    el.style.pointerEvents = 'none';
    if (this.options.label) {
      const tag = document.createElement('span');
      tag.className = 'gantt-today-marker__label';
      tag.textContent = this.options.label;
      el.appendChild(tag);
    }
    // Attach to a host-owned container; we created `el`, so we will remove it.
    ctx.containers.body.appendChild(el);
    this.el = el;

    this.reposition();          // initial placement
    this.subscribe();           // keep it in sync
  }
```

### Step 3 — Position using `ctx.scale` and `ctx.getBodyHeight()`

```ts
  private reposition(): void {
    if (!this.el) return;
    const x = this.ctx.scale.dateToX(new Date());   // scale does the math
    this.el.style.transform = `translateX(${x}px)`;
    this.el.style.height = `${this.ctx.getBodyHeight()}px`; // injected, not read
  }
```

### Step 4 — Subscribe via the bus, tracking disposers

```ts
  private subscribe(): void {
    const onChange = () => this.reposition();
    // `bus.on` returns an unsubscribe function; collect them for destroy().
    this.disposers.push(this.ctx.bus.on('render', onChange));
    this.disposers.push(this.ctx.bus.on('view-change', onChange));
    this.disposers.push(this.ctx.bus.on('scroll', onChange));

    // Announce ourselves with a namespaced event (see §5).
    this.ctx.bus.emit('today-marker:ready', { name: this.name });
  }
```

### Step 5 — Clean up everything in `destroy`

```ts
  destroy(): void {
    for (const off of this.disposers) off();   // unsubscribe bus listeners
    this.disposers = [];
    this.el?.remove();                          // remove our DOM
    this.el = undefined;
  }
```

### Step 6 — Register it

```ts
const gantt = new Gantt(container, {
  tasks,
  plugins: [new TodayMarkerPlugin({ label: 'Today' })],
});
```

That is a complete, correct plugin: it observes the chart only through the bus,
positions itself only through the read-only scale and the injected height
calculator, owns only the DOM it created, and removes every trace in `destroy()`.

---

## 5. Rules & best practices

These rules are what keep the core a pure timeline and plugins safely
composable. The old `Label` class violated several of them; the contrast is
called out below.

1. **Communicate only through `bus` + `ctx`.**
   React to chart activity via `ctx.bus.on(...)`; announce activity via
   `ctx.bus.emit(...)`. Read state via `ctx.config`, `ctx.scale`, `ctx.tasks`,
   `ctx.getBodyHeight()`. There is no other supported channel.

2. **Never mutate private gantt state.**
   The old `Label` set a private coordination flag directly:

   ```js
   // OLD label.js — DON'T: reaching into and mutating a private instance flag
   this.gantt._isSyncingLabelScroll = true;
   this.gantt.$container.scrollTop = this.$labels_scroll.scrollTop;
   this.gantt._isSyncingLabelScroll = false;
   ```

   A plugin must never touch private fields (anything not on `PluginContext`).
   Scroll coordination that needs a "don't echo this back" guard is done by
   emitting/observing a bus event with a source tag, not by flipping a private
   boolean on the core (see §6).

3. **Never read core layout fields directly.**
   The old `Label` computed its content height from internal fields:

   ```js
   // OLD label.js — DON'T: reading core internals
   const contentHeight = this.gantt.grid_height - this.gantt.config.header_height;
   ```

   Use the injected `ctx.getBodyHeight()` instead. The host owns layout; the
   plugin asks for the number it needs.

4. **Attach only to injected containers, and own only your DOM.**
   Build your elements and append them into `ctx.containers.*`. Do not
   `document.querySelector` for core nodes, do not move or restyle host-owned
   nodes, and remove every node you created in `destroy()`.

5. **Clean up all DOM and listeners in `destroy()`.**
   Track every bus subscription (the bus returns a disposer), every native DOM
   listener, and every `window`/`document` listener you add, and undo them all.
   The old `Label` added `document` click listeners, `window` resize listeners,
   and `scroll` listeners; the plugin form must release every one. A plugin that
   leaves a listener attached after `destroy()` is a bug.

6. **Namespace your events.**
   Prefix every event you emit with your plugin name and a colon, e.g.
   `label-panel:visibility-change`, `today-marker:ready`. This prevents
   collisions with the public `GanttEventMap` and with other plugins, and makes
   it obvious in `EVENTS.md` which events are plugin-owned.

7. **Be re-render aware, not re-install dependent.**
   Do not assume `install` runs again when data/view/size change — it does not.
   Subscribe to `'render'`/`'refresh'`/`'view-change'`/`'scroll'` and update in
   place.

8. **Single-use instances.**
   Treat an instance as dead after `destroy()`. To re-add a plugin, construct a
   new instance.

---

## 6. The `LabelPanelPlugin` — the first real plugin

`LabelPanelPlugin` is the production extraction of the old `Label` class. It is
the proof that a table-ish surface can live entirely outside the core while
keeping every feature it had before.

### 6.1 Features

- **Resizable side panel.** A drag handle resizes the panel between a 200px
  floor and 40% of the main container width; the layout re-flows on window
  resize.
- **Scroll-sync with the chart body.** The panel's value list and the chart body
  scroll together in both directions.
- **Column filtering (max 3).** A settings dropdown lets the user show/hide
  columns; at most three columns may be visible at once (extra checkboxes
  disable when three are checked). Enabled via the plugin's `filtering` config.
- **State save / restore.** The panel can serialize its visibility, visible
  columns, label data, and width, and restore them later (used across
  data refreshes and remounts).
- **Visibility toggle.** Show / hide / toggle the panel, including via a header
  button when `button` config is enabled.

### 6.2 Config namespace

All label options move out of core options and under the plugin. The old
core-level options map to the plugin's own config namespace:

| Old core option | New plugin config |
|-----------------|-------------------|
| `labels`        | `data`            |
| `label_button`  | `button`          |
| `label_filter`  | `filtering`       |

```ts
export interface LabelColumn {
  /** Column header text. */
  [header: string]: string[]; // values, one per row (aligned to task order)
}

export interface LabelPanelOptions {
  /** The label data: an array of { header: values[] } column objects. */
  data?: LabelColumn[];
  /** Render the header toggle button for the panel (was `label_button`). */
  button?: boolean;
  /** Enable the show/hide-columns settings dropdown, max 3 (was `label_filter`). */
  filtering?: boolean;
  /** Initial panel width in px (default 250). */
  width?: number;
}

export class LabelPanelPlugin implements GanttPlugin {
  readonly name = 'label-panel';
  constructor(options?: LabelPanelOptions);
  install(ctx: PluginContext): void;
  destroy(): void;

  // Public surface, callable via gantt.getPlugin('label-panel'):
  show(): void;
  hide(): void;
  toggle(): void;
  setWidth(px: number): void;
  saveState(): LabelPanelState;
  restoreState(state: LabelPanelState): void;
  updateLabels(data: LabelColumn[]): void;
}
```

### 6.3 How it was decoupled from the old `Label`

The old `Label` was tightly coupled to the `Gantt` instance. Three concrete
couplings were removed during extraction (per the architecture spec, §2.4):

1. **Scroll-sync via the bus, not a private instance flag.**
   The old class set `gantt._isSyncingLabelScroll = true/false` around its
   programmatic scroll writes, and wrote directly to `gantt.$container.scrollTop`,
   to keep the core's own scroll handler from echoing the update back. The
   plugin instead coordinates through the bus: it listens for the core's
   `'scroll'` event and emits its own `label-panel:scroll` with a source tag, so
   each side ignores scroll events it originated. No private flag is touched and
   the panel never writes the core's scroll position by reaching into
   `gantt.$container`.

   ```ts
   // NEW: coordinate via bus + source tag; no private flag, no $container write
   private syncing = false;
   private onPanelScroll = () => {
     if (this.syncing) return;
     this.syncing = true;
     this.ctx.bus.emit('label-panel:scroll', { top: this.scrollEl.scrollTop });
     this.syncing = false;
   };
   // and react to the core's scroll the same guarded way:
   this.disposers.push(this.ctx.bus.on('scroll', ({ top }) => {
     if (this.syncing) return;
     this.syncing = true;
     this.scrollEl.scrollTop = top;
     this.syncing = false;
   }));
   ```

2. **Injected DOM containers, not `gantt.$main_container` prepend.**
   The old class did `this.gantt.$main_container.prepend(this.$label_field)` and
   read `this.gantt.$main_container.offsetWidth` for resize clamping. The plugin
   attaches into `ctx.containers.main` and measures that injected node — it never
   names a private field of the core.

3. **Injected height calc, not reading `grid_height` / `header_height`.**
   The old class sized its content with
   `this.gantt.grid_height - this.gantt.config.header_height`. The plugin calls
   `ctx.getBodyHeight()`, re-querying it on every `'render'`/`'refresh'`, so the
   core owns the geometry and the plugin just asks for the number.

The net effect: **the core no longer references labels at all.** The `labels`,
`label_button`, and `label_filter` options are gone from core options; the
`_isSyncingLabelScroll` private flag is gone; and the panel is a clean,
removable module.

### 6.4 Usage example

```ts
import { Gantt } from '@gts-ui/chart-gantt';
import { LabelPanelPlugin } from '@gts-ui/chart-gantt/plugins';

const labelPanel = new LabelPanelPlugin({
  data: [
    { Owner: ['Alice', 'Bob', 'Carol'] },
    { Team:  ['Core', 'Core', 'Design'] },
    { Phase: ['Spec', 'Build', 'Build'] },
  ],
  button: true,       // header toggle button (was `label_button`)
  filtering: true,    // show/hide columns, max 3 (was `label_filter`)
  width: 280,
});

const gantt = new Gantt(container, {
  tasks,
  viewMode: 'Day',
  plugins: [labelPanel],
});

// Toggle at runtime via the public surface:
document.querySelector('#toggle-labels')?.addEventListener('click', () => {
  gantt.getPlugin('label-panel')?.toggle();
});

// Persist and restore panel state across a remount:
const saved = (gantt.getPlugin('label-panel') as LabelPanelPlugin).saveState();
// ...later, on a fresh chart...
(gantt.getPlugin('label-panel') as LabelPanelPlugin).restoreState(saved);
```

---

## 7. See also

- [ARCHITECTURE.md](./ARCHITECTURE.md) — where the plugin host sits in the layer
  diagram (integration layer) and how the core stays a pure timeline.
- [API.md](./API.md) — the facade methods `use()`, `remove()`, `getPlugin()`,
  `destroy()`, and the `plugins` constructor option.
- [EVENTS.md](./EVENTS.md) — the `GanttEventMap` plugins subscribe to (`render`,
  `refresh`, `view-change`, `scroll`, …) and the namespacing convention for
  plugin-emitted events.
