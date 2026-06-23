# AGENTS.md — `@gts-ui/chart-gantt`

Operating manual for humans **and** LLM tools (Claude Code, Codex, Copilot,
Gemini, etc.) working in this repository. Read this before making changes.

> Instruction priority: explicit user instructions > this file > tool defaults.
> If a skill or default conflicts with a rule here, this file wins.

---

## 1. What this project is

`@gts-ui/chart-gantt` is a **lightweight, timeline-only SVG Gantt chart** library
(TypeScript, framework-agnostic). It is published as `@gts-ui/chart-gantt` and
consumed by `susp-frontend` (Vue 3 + Pinia).

**Core principle — no integrated table.** Unlike dhtmlx-gantt, this library
ships **no grid/table component**. The consumer provides their own table; the
chart renders only the timeline (bars, dependency arrows, header, scale) and
**embeds into a single full-height cell** that spans the host table's data rows.
The host owns columns and rows; the chart aligns its bars to the host's row
heights. This separation is the product's reason to exist — **do not add a
built-in table, grid, or column system to the core.** Table-ish UI (like the
label side-panel) belongs in optional plugins.

The three integration seams that make this work are first-class and documented:

1. **Header mount** — the timeline header renders into a separate sticky node.
2. **External scroll** — scrolling is owned by the host's scroll container.
3. **Row-height sync** — gantt rows align to host table row heights.

See [`docs/INTEGRATION.md`](docs/INTEGRATION.md).

---

## 2. Current state vs. target

The library is **mid-re-architecture**. Two realities coexist:

- **Today:** a monolithic `Gantt` class in `src/index.js` (~2,240 lines) plus
  helper modules (`bar.js`, `arrow.js`, `dummy_arrow.js`, `label.js`, `popup.js`,
  `date_utils.js`, `svg_utils.js`, `defaults.js`). JavaScript with `.d.ts` emitted
  from JSDoc. Tests run in the vitest `node` environment (pure logic only).
- **Target:** a layered OOP architecture, a breaking strongly-typed TypeScript
  public API, a plugin system, and BDD-backed features. Defined in the design
  spec and the `docs/` tree.

**The canonical design spec is**
`.claude/superpowers/specs/2026-06-22-gantt-re-architecture-design.md`.
Read it before doing architecture work. The `docs/` tree describes the **target**
API; treat described-but-unimplemented API as the contract to build toward, and
keep docs and code converging (update docs in the same change as the code).

Target architecture in one line: **Model → Scale → Render → Interaction →
Integration**, with `EventBus` and `Config` as cross-cutting concerns, dependencies
pointing downward only and upward communication via the bus. Full detail in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 3. Where things live (file & directory rules)

| Path | Purpose | Tracked in git? |
|------|---------|-----------------|
| `src/` | Library source | yes |
| `tests/` | Vitest unit/DOM/BDD tests | yes |
| `docs/` | Product documentation (architecture, API, features, …) | **yes** |
| `builder/` | Local demo harness | yes |
| `index.html` | Dev demo page | yes |
| `.claude/` | **Local agent/LLM tooling** | **no (gitignored)** |
| `.claude/superpowers/specs/` | Design specs (brainstorming output) | no |
| `.claude/superpowers/plans/` | Implementation plans (writing-plans output) | no |

**Rules:**

- **Superpowers plans and specs go in `.claude/superpowers/`** — `specs/` for
  design specs, `plans/` for implementation plans. Never put them in `docs/`.
- **`docs/` is for product documentation** and **is tracked** (it was removed
  from `.gitignore`). Keep it in sync with the code.
- **`.claude/` is gitignored** (local tooling, including the specs/plans above).
  Do not commit anything under `.claude/`.
- When you add a `docs/` page, link it from [`docs/README.md`](docs/README.md).

---

## 4. Engineering conventions

### Language & types
- **TypeScript, strict.** New code is written in TS. The migration from JS is
  staged (see [`docs/MIGRATION.md`](docs/MIGRATION.md) Part B); converted files
  must compile under `strict` and not import un-migrated files that would break
  types downstream.
- **Rendering is SVG.** Do not introduce canvas/WebGL/HTML-table rendering.
- **Naming:** public methods/options/events are **camelCase / kebab-case**
  (`setViewMode`, `barHeight`, `on('date-change', …)`). **Task-data fields stay
  `snake_case`** (`start`, `end`, `expected_start`, `row_height`, …) — they are
  the consumer's data shape. Don't "fix" task field casing.

### Testing — TDD + BDD (required for non-trivial work)
- **TDD for pure-logic units** (Model/Scale/Config/EventBus/date utils): write the
  failing test first, then the implementation. These run in the vitest **`node`**
  environment and must stay fast.
- **DOM tests run in the vitest `jsdom` environment.** jsdom is *not* a
  replacement for vitest — it's the DOM environment vitest executes a test in.
  The `node` environment has no `document`, so renderer/interaction code can't be
  tested there. Opt DOM suites into jsdom **per file** (`// @vitest-environment
  jsdom`) or via `environmentMatchGlobs`; keep logic suites in `node`.
- **BDD for user-facing features.** Feature behaviour is specified as Gherkin
  scenarios in [`docs/FEATURES.md`](docs/FEATURES.md) and mirrored 1:1 by test
  cases (`describe('Feature: …') / it('Scenario: …')`). When you change a
  feature, update its scenarios and tests together.
- Run the suite with `npm test` before claiming work is done. **Verify with real
  command output — never assert success without running it.**

### Design discipline
- Keep units small and single-purpose with well-defined interfaces. If a file is
  growing toward god-object territory (the very problem being fixed here), split
  it.
- **Communicate via the `EventBus`, not reach-backs.** Do not have a child unit
  read or mutate private state on the `Gantt` instance (the old `Bar`→`gantt.*`
  and `Label`→`gantt._isSyncingLabelScroll` coupling is exactly what we're
  removing). Plugins talk only through `PluginContext` + the bus
  ([`docs/PLUGINS.md`](docs/PLUGINS.md)).
- Follow existing patterns in neighbouring files; match comment density and idiom.

---

## 5. Commands

```bash
npm install            # install deps
npm run dev            # vite dev server (uses index.html demo)
npm run build          # build library (vite) + emit types (tsc)
npm run build-dev      # build and watch
npm test               # vitest run (CI mode)
npm run lint           # eslint over src
npm run prettier       # format
npm run prettier-check # check formatting
```

Node/build: Vite library build (ES/UMD/CJS) with `vite-plugin-dts`; entry is
`src/index.js` (→ `src/index.ts` after migration). The package version is injected
as `__GANTT_VERSION__`.

---

## 6. Git & change hygiene

- **Conventional Commits**, matching this repo's history — `type(scope): summary`
  (e.g. `feat(scale): add xToDate`, `fix(row-heights): reject non-finite height`,
  `docs(integration): …`, `refactor(bar): inject BarContext`,
  `test(timescale): …`). Scopes track the architecture units where practical.
- Branch off `master`; do not commit directly to it. The current working branch is
  `feature/row-height-sync`.
- **Only commit/push when the user asks.** Don't commit `.claude/` contents.
- Keep `docs/` changes in the same commit as the code they describe.

---

## 7. Workflow for LLM tools

1. **Read the spec and the relevant `docs/` page first** for any non-trivial
   change. The spec defines names and boundaries; the docs define the target API.
2. For new features/designs, brainstorm → spec (`.claude/superpowers/specs/`) →
   plan (`.claude/superpowers/plans/`) → implement with TDD/BDD. Do not skip to
   code for substantial work.
3. Respect the architecture layering and the "no integrated table" principle.
4. Update docs and tests alongside code; keep the old→new mapping in
   `docs/MIGRATION.md` accurate when the public API changes.
5. Verify (`npm test`, `npm run build`) and report real results before declaring
   done.

---

## 8. Pointers

- Design spec: `.claude/superpowers/specs/2026-06-22-gantt-re-architecture-design.md`
- Docs index: [`docs/README.md`](docs/README.md)
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Integration (primary use case): [`docs/INTEGRATION.md`](docs/INTEGRATION.md)
- API: [`docs/API.md`](docs/API.md) · Types: [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md)
- Events: [`docs/EVENTS.md`](docs/EVENTS.md) · Features (BDD): [`docs/FEATURES.md`](docs/FEATURES.md)
- Plugins: [`docs/PLUGINS.md`](docs/PLUGINS.md) · Migration: [`docs/MIGRATION.md`](docs/MIGRATION.md)
- Real consumer reference:
  `susp-frontend/src/components/tables/budget/cells/chart-gantt-cell.vue`
