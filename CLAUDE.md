# BoardBI

A self-hosted, Power BI-style dashboard app for JIRA. Connect a JIRA Cloud site, define reports as JQL queries, drop gadgets onto a canvas, configure aggregations, and slice the data with date / multi-select / single-select / text filters.

Local-first SQLite via Prisma; designed to swap to Postgres without code changes.

## Quick start

```
npm run dev            # web (Vite) on :5173, API (Express) on :3001
npm run db:migrate     # re-apply Prisma migrations
npm run db:studio      # Prisma Studio GUI on :5555
npx vite build         # type-check + bundle the frontend
npm --prefix server run build   # type-check the server
```

`server/.env` must define `APP_ENCRYPTION_KEY` (32 random bytes, base64). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. JIRA tokens are AES-256-GCM encrypted at rest with this key — rotating it makes existing tokens unreadable.

## Stack

- **Frontend**: React 18 + Vite + TypeScript at the repo root (`src/`). State: TanStack Query (server), Zustand (UI). Charts: Recharts. Tables: TanStack Table. Layout: react-grid-layout. Date utils: date-fns.
- **Backend**: Express + TypeScript in `server/`. Prisma + SQLite. Zod for input validation. `tsx` for dev hot-reload.
- **Vite dev proxy**: `/api/*` → `http://localhost:3001` (configured in `vite.config.ts`).

## Architectural decisions worth knowing before changing things

### One JQL dataset per report
Each `Report` has a single `jql` query. Refresh fetches all matching issues (token-paginated through JIRA Cloud's `/rest/api/3/search/jql`, capped at 5000 rows) and persists the raw issue array as a `DatasetSnapshot`. **All gadgets on the report operate over that one dataset, client-side.** Slicers narrow the dataset in memory. This mirrors Power BI's "dataset per report" model and keeps the backend dumb.

If you add a feature that needs server-side aggregation, do it as a new endpoint — don't tear out the in-memory aggregation; existing gadgets depend on it.

### Slicer semantics: page-level with per-gadget overrides
- Page slicers (`Report.pageSlicers`) apply to every gadget by default.
- Each gadget's `config.slicerOverrides` is a `Record<slicerId, { disabled?: boolean; value?: any }>`.
- `effectiveSlicers(pageSlicers, overrides)` in `src/features/report/useFilteredDataset.ts` resolves the chain. **Override replaces** the page slicer (Power BI semantics, not merge).
- Filtering happens per gadget inside `ReportCanvas` (raw rows + page slicers go in; each `GadgetFrame` filters its own view via `applySlicers(rows, effectiveSlicers(pageSlicers, overrides))`).

### JIRA `/search/jql` migration
The legacy `/rest/api/3/search` was retired in 2025. The client uses the token-paginated `/rest/api/3/search/jql`, which **does not return a total count**. The `truncated` flag is derived from `!isLast && rows.length >= rowCap`. Don't reintroduce dependence on `total`.

### Gadget extensibility
Adding a new gadget type is a one-place change:
1. Implement a file in `src/features/gadgets/` exporting a `GadgetEntry` (type, label, defaultConfig, defaultLayout, Render, Config, optional exportRows).
2. Register it in `src/features/gadgets/registry.ts` (and add the type literal to `GadgetType` in `src/features/reports/types.ts`).

The `Render` component receives `{ rows, config, fields, onDrillThrough? }` and renders. The `Config` component receives `{ config, onChange, fields, rows }` and updates the gadget's config object. The slicer-overrides editor is rendered **automatically** in the drawer alongside Config — gadgets don't need to know about overrides.

### Date-bucketed group-by (Bar/Pie)
When the chosen "Group by" field is a date type (`schema.type === "date" | "datetime"`), gadgets can specify `groupByBucket: "day" | "week" | "month" | "quarter" | "year"`. This routes through `groupAndAggregate(rows, field, spec, dateBucket)` which uses `bucketIssueDate()` instead of `groupKey()`. Bucketed groupings sort chronologically; categorical groupings sort by aggregated value desc.

### Tabs
`/reports/:id` mounts `ReportTabsHost`, which keeps every opened report's `ReportPage` mounted simultaneously and toggles `display: none` for inactive tabs. Tab list lives in `src/store/tabsStore.ts`; the URL drives `activeId`. Tabs are session-only (not persisted).

This means: changing the slicer on tab A and switching to tab B preserves A's edits. Multiple ResizeObservers + React Query caches are alive at once. Reasonable for ~10 tabs.

## File layout

```
BoardBI/
├── package.json                 # root: Vite app + scripts that delegate to server/
├── vite.config.ts               # /api proxy, alias @ → src/
├── index.html
├── server/
│   ├── package.json             # separate dependency tree
│   ├── prisma/schema.prisma     # full v0/v1 schema (no follow-up migrations needed)
│   ├── prisma/migrations/       # checked-in
│   ├── prisma/dev.db            # gitignored
│   └── src/
│       ├── index.ts             # Express bootstrap
│       ├── env.ts               # required-env helper
│       ├── db.ts                # PrismaClient singleton
│       ├── jira/
│       │   ├── crypto.ts        # AES-256-GCM
│       │   └── client.ts        # /myself, /field, /search/jql with paging
│       ├── middleware/auth.ts   # no-op seam for v2 auth
│       └── routes/
│           ├── connections.ts   # CRUD + /:id/test
│           ├── reports.ts       # CRUD + /:id/data + /:id/data/latest + /export + /import
│           └── fields.ts        # 24h FieldCache TTL
└── src/
    ├── main.tsx
    ├── styles.css               # global tokens + react-grid-layout overrides
    ├── app/
    │   ├── router.tsx
    │   └── AppShell.tsx
    ├── features/
    │   ├── connections/         # connection CRUD UI + useFields hook
    │   ├── reports/             # report list + create form + types
    │   ├── report/              # SINGLE report editor (Toolbar, Canvas, SlicerBar, DrillThroughModal, TabBar, ReportTabsHost, ReportPage)
    │   ├── gadgets/             # one file per gadget type + registry.ts + config helpers
    │   └── slicers/             # one file per slicer type
    ├── lib/
    │   ├── api.ts               # ky pre-configured for /api
    │   ├── jqlFields.ts         # field id → group key / numeric / date / display value
    │   ├── aggregate.ts         # groupAndAggregate, AggFn
    │   ├── dateBuckets.ts       # date range presets, Bucket, bucketIssueDate, rowsForDateBucket
    │   └── csv.ts               # RFC-4180-ish serializer
    └── store/
        ├── slicerStore.ts       # per-report slicer state
        └── tabsStore.ts         # open report tabs + activeId
```

## Gotchas / lessons learned

### Zustand selectors must return stable references
`useSyncExternalStore` runs the selector on every commit and re-renders if the result differs by `Object.is`. Returning fresh `[]` / `{}` from a selector causes infinite re-renders. We hit this with `s.byReport[reportId] ?? []`. Fix: hoist a constant (`const EMPTY: T[] = []`) and return that as the fallback.

### react-grid-layout requires stable string keys
Each grid child's `key` must equal its layout `i`. We generate gadget IDs with `crypto.randomUUID()` at creation. Never use array indices.

### Recharts inside react-grid-layout
- Wrap Recharts in `ResponsiveContainer` and force a remount on size change via `key={`${w}x${h}`}` driven by a `ResizeObserver` in `GadgetFrame`. Without this, Recharts caches old dimensions after a resize.
- Apply `draggableCancel=".no-drag"` on form inputs inside gadget config to keep grid drag from interfering.
- The chart's `onClick` for line charts uses `state?.activeLabel` (Recharts 3 behavior).

### JIRA field shapes are inconsistent
Custom fields can be: scalar string/number, an option object `{value, name}`, a user `{displayName, accountId}`, an array, etc. `lib/jqlFields.ts` normalizes them with `groupKey`, `numericValue`, `dateValue`, `displayValue`. Use these — never read `issue.fields[id]` directly in render.

### Custom field IDs are ugly
JIRA custom fields appear as `customfield_10010` etc. The `FieldCache` stores both the id and the human label. Field pickers show labels and store ids. Don't expose raw ids in user-facing copy.

### Token rotation breaks existing data
`APP_ENCRYPTION_KEY` is the AES-GCM key for stored JIRA tokens. Rotating it makes every existing connection unreadable; users would need to re-add connections. There's no rotation flow — this is intentional simplicity for v1.

## What's intentionally not built (roadmap)

These items appear in the original plan but are deferred. The codebase is shaped to absorb them.

- **Scheduled refresh** (node-cron): seam — `searchAll` is already idempotent and writes a snapshot.
- **Multiple datasets per report**: schema would add a `Dataset` model; gadgets/slicers would gain a `datasetId`. Today, `Report.jql` IS the dataset.
- **Server-side aggregation**: only justified when the 5000-row cap is regularly hit. The aggregation primitives in `lib/aggregate.ts` are pure functions — easy to lift to the server.
- **Drill-through to a separate filtered view-page** (current implementation is a modal — sufficient for now).
- **Multi-user auth**: `server/src/middleware/auth.ts` is the seam. Adding sessions/JWT/OAuth later is a one-file middleware swap plus an `ownerId` column on `JiraConnection` and `Report`.

## Export / import

Reports can be exported to a JSON file and re-imported on any BoardBI install.

- **Export**: `POST /api/reports/export` body `{ ids }` → `{ version: 1, exportedAt, reports[] }`. Each report entry contains `name`, `description`, `jql`, `layout`, `pageSlicers`, and `gadgets` — no `id`, `connectionId`, or snapshot rows.
- **Import**: `POST /api/reports/import` body `{ connectionId, file }`. Each imported report gets a fresh `cuid`; gadget IDs are regenerated and layout `i` keys remapped to match. Names are deduplicated with ` (imported)` / ` (imported 2)` suffixes. No field-existence validation — if the target JIRA instance is missing a referenced field, the next data refresh will surface the error.
- **UI**: `ReportsPage` has per-row checkboxes, a bulk **Export selected** button, a per-row **Export** button, and an **Import…** button that opens an inline dialog (file picker + connection dropdown).
- `connectionId` is always install-specific and is never included in the export. JIRA field IDs (`customfield_*`) inside gadget configs and slicer `field` values are JIRA-instance-specific; they round-trip fine when the same JIRA site is used on both ends.

## Conventions when extending

- TypeScript strict mode, both projects.
- No comments unless the *why* is non-obvious. Don't restate what the code does.
- Don't add error handling for cases that can't happen. Trust internal callers.
- Default to no new files: extend an existing module before creating a new one.
- Prefer editing existing files over adding helpers.
- Aggregate-shape primitives live in `lib/`. Gadget-specific logic lives in the gadget file.
- All slicer/gadget changes that affect persistence need a matching Zod schema update in `server/src/routes/reports.ts`.

## Before pushing

- `server/dev.db` is gitignored; do not commit.
- `server/.env` is gitignored; ensure your `APP_ENCRYPTION_KEY` is NOT committed.
