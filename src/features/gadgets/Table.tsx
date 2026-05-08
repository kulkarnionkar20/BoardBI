import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { displayValue, fieldsForPicker, type JiraIssue } from "../../lib/jqlFields";
import { toCsv } from "../../lib/csv";
import type { GadgetConfigProps, GadgetEntry, GadgetRenderProps } from "./types";

type Cfg = { columns: string[]; pageSize?: number };

const DEFAULT_COLUMNS = ["key", "summary", "status", "assignee", "priority"];

function asCfg(c: Record<string, unknown>): Cfg {
  const cols =
    Array.isArray(c.columns) && c.columns.every((x): x is string => typeof x === "string")
      ? c.columns
      : DEFAULT_COLUMNS;
  return {
    columns: cols,
    pageSize: typeof c.pageSize === "number" ? c.pageSize : 50,
  };
}

function Render({ rows, config, fields }: GadgetRenderProps) {
  const cfg = asCfg(config);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<JiraIssue>[]>(
    () =>
      cfg.columns.map((id) => {
        const def = fields.find((f) => f.id === id);
        return {
          id,
          header: def?.name ?? id,
          accessorFn: (row) => displayValue(row, id),
          cell: (info) => info.getValue<string>(),
        };
      }),
    [cfg.columns, fields],
  );

  const sliced = useMemo(() => rows.slice(0, cfg.pageSize ?? 50), [rows, cfg.pageSize]);

  const table = useReactTable({
    data: sliced,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ position: "sticky", top: 0, background: "var(--surface)" }}>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: " ▲", desc: " ▼" }[h.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getVisibleCells().map((c) => (
                <td
                  key={c.id}
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 280,
                  }}
                >
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > sliced.length && (
        <div className="muted" style={{ padding: 8, fontSize: 12 }}>
          Showing first {sliced.length.toLocaleString()} of {rows.length.toLocaleString()} rows.
        </div>
      )}
    </div>
  );
}

function Config({ config, onChange, fields }: GadgetConfigProps) {
  const cfg = asCfg(config);
  const opts = fieldsForPicker(fields);
  const toggle = (id: string) => {
    const has = cfg.columns.includes(id);
    const next = has ? cfg.columns.filter((c) => c !== id) : [...cfg.columns, id];
    onChange({ ...config, columns: next });
  };
  return (
    <div className="stack">
      <div className="field">
        <label>Page size</label>
        <input
          type="number"
          min={10}
          max={1000}
          value={cfg.pageSize ?? 50}
          onChange={(e) => onChange({ ...config, pageSize: Math.max(10, Number(e.target.value) || 50) })}
        />
      </div>
      <div className="field">
        <label>Columns</label>
        <div
          className="no-drag"
          style={{ maxHeight: 220, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}
        >
          {opts.map((f) => (
            <label key={f.id} className="row" style={{ fontSize: 13, gap: 6 }}>
              <input
                type="checkbox"
                checked={cfg.columns.includes(f.id)}
                onChange={() => toggle(f.id)}
              />
              <span>{f.name}</span>
              <span className="muted" style={{ fontSize: 11 }}>
                {f.id}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export const tableEntry: GadgetEntry = {
  type: "table",
  label: "Table",
  defaultConfig: { columns: DEFAULT_COLUMNS, pageSize: 50 },
  defaultLayout: { w: 8, h: 8, minW: 4, minH: 4 },
  Render,
  Config,
  exportRows: ({ rows, config, fields }) => {
    const cfg = asCfg(config);
    const headers = cfg.columns.map((id) => fields.find((f) => f.id === id)?.name ?? id);
    const data: Array<Array<string>> = rows.map((row) =>
      cfg.columns.map((id) => displayValue(row, id)),
    );
    return toCsv(headers, data);
  },
};
