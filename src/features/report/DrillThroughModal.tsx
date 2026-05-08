import { useMemo } from "react";
import { displayValue, fieldsForPicker, type FieldDef, type JiraIssue } from "../../lib/jqlFields";
import { toCsv } from "../../lib/csv";
import type { DrillThrough } from "../gadgets/types";

const DEFAULT_COLS = ["key", "summary", "status", "assignee", "priority"];

type Props = {
  drill: DrillThrough;
  fields: FieldDef[];
  onClose: () => void;
};

export function DrillThroughModal({ drill, fields, onClose }: Props) {
  const cols = useMemo(() => {
    const known = new Set(fieldsForPicker(fields).map((f) => f.id));
    return DEFAULT_COLS.filter((c) => known.has(c) || c === "key");
  }, [fields]);

  const onExport = () => {
    const headers = cols.map((id) => fields.find((f) => f.id === id)?.name ?? id);
    const data = drill.rows.map((r) => cols.map((id) => displayValue(r, id)));
    downloadCsv(`drill-${slug(drill.title)}.csv`, toCsv(headers, data));
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 200,
      }}
    >
      <div
        className="card stack"
        style={{
          width: "min(960px, 92vw)",
          maxHeight: "84vh",
          padding: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>{drill.title}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {drill.rows.length.toLocaleString()} issue{drill.rows.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="row">
            <button onClick={onExport} disabled={drill.rows.length === 0}>
              Export CSV
            </button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {drill.rows.length === 0 ? (
            <div className="muted" style={{ padding: 24, textAlign: "center" }}>
              No issues match this selection.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, background: "var(--surface)" }}>
                <tr>
                  {cols.map((id) => (
                    <th
                      key={id}
                      style={{
                        textAlign: "left",
                        padding: "6px 10px",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {fields.find((f) => f.id === id)?.name ?? id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drill.rows.map((r) => (
                  <tr key={r.id}>
                    {cols.map((id) => (
                      <td
                        key={id}
                        style={{
                          padding: "6px 10px",
                          borderBottom: "1px solid var(--border)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 320,
                        }}
                      >
                        {displayValue(r, id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
