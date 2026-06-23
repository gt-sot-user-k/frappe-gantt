# `@gts-ui/chart-gantt` — Documentation

A lightweight, modern, **timeline-only** SVG Gantt chart. Unlike dhtmlx-gantt, it
ships **no integrated grid/table** — you bring your own table and embed the chart
into a single full-height cell. The chart owns the timeline (bars, arrows, header,
scale); your table owns the columns and rows.

> **Status.** The documents below describe the **target re-architecture** (full
> OOP decomposition, breaking TypeScript API, plugin system). They are the design
> contract being implemented; some described API is aspirational until the staged
> migration lands. The canonical design spec lives in
> `.claude/superpowers/specs/2026-06-22-gantt-re-architecture-design.md`
> (not tracked in git). See [MIGRATION.md](./MIGRATION.md) for old→new mapping and
> the implementation stages.

## Start here

| If you want to… | Read |
|-----------------|------|
| Understand the system design & class structure | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Embed the chart in a host table (the main use case) | [INTEGRATION.md](./INTEGRATION.md) |
| Look up the public API (constructor, methods, options) | [API.md](./API.md) |
| Know the TypeScript types/schemas | [DATA-MODEL.md](./DATA-MODEL.md) |
| Subscribe to events | [EVENTS.md](./EVENTS.md) |
| See every UX/UI feature (BDD scenarios) | [FEATURES.md](./FEATURES.md) |
| Write or use a plugin (e.g. the label panel) | [PLUGINS.md](./PLUGINS.md) |
| Migrate from the old API / understand the TS migration | [MIGRATION.md](./MIGRATION.md) |

## Document map

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — The 5-layer architecture (Model →
  Scale → Render → Interaction → Integration) plus the `EventBus` and `Config`
  cross-cutting concerns, every unit's responsibility/surface, composition and
  data-flow diagrams, the plugin architecture, and the proposed `src/` layout.
- **[API.md](./API.md)** — Installation, quick start, the `new Gantt(container,
  options)` constructor, the full options reference, every instance method, the
  `rows` row-height sub-API, and TypeScript usage.
- **[DATA-MODEL.md](./DATA-MODEL.md)** — Canonical TypeScript interfaces: `Task`,
  `DateInput`, `Duration`, `ViewMode` (and the 7 built-in modes), `GanttOptions`,
  `TableIntegrationOptions`, `Arrow`, `GanttEventMap`, holidays/ignore config.
- **[EVENTS.md](./EVENTS.md)** — The typed `on/off/once` event system, the full
  event catalogue with payloads and firing order, and public-vs-internal events.
- **[INTEGRATION.md](./INTEGRATION.md)** — The table-integration guide: the three
  seams (header mount, external scroll, row-height sync), a copy-paste HTML recipe,
  a Vue 3 walkthrough modelled on the real consumer, the id-mapping contract, and
  troubleshooting.
- **[FEATURES.md](./FEATURES.md)** — All 19 user-facing features in BDD
  (Given/When/Then) form; the source of the behavioural test suite.
- **[PLUGINS.md](./PLUGINS.md)** — The `GanttPlugin`/`PluginContext` contract, a
  plugin-authoring tutorial, best practices, and the `LabelPanelPlugin`.
- **[MIGRATION.md](./MIGRATION.md)** — Exhaustive old→new API mapping for
  consumers, plus the 6-stage internal TypeScript migration plan.

## Conventions used in these docs

- **Task-data fields stay `snake_case`** (`id`, `name`, `start`, `end`,
  `progress`, `dependencies`, `expected_start`, `expected_end`, `custom_class`,
  `row_height`, …) — these are the shapes consumers already produce.
- **The public method/option/event API is `camelCase` / kebab-case** — e.g.
  `setViewMode`, `barHeight`, `table.headerMount`, `on('date-change', …)`.
- Code blocks are TypeScript unless marked otherwise.

See the repository root [`AGENTS.md`](../AGENTS.md) for contributor and
LLM-tooling rules.
