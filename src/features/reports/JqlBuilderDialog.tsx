import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useFields } from "../connections/useFields";
import { fieldsForPicker, type FieldDef } from "../../lib/jqlFields";
import { FieldPicker } from "../gadgets/config/FieldPicker";
import {
  buildJql,
  fieldKind,
  operatorMeta,
  operatorsFor,
  type BuilderRow,
  type OperatorId,
} from "../../lib/jqlBuilder";

type Props = {
  connectionId: string;
  onApply: (jql: string) => void;
  onClose: () => void;
};

type TestResult = { ok: true } | { ok: false; error: string } | null;

function newRow(): BuilderRow {
  return { id: crypto.randomUUID(), fieldId: "", operator: "=", value: "" };
}

export function JqlBuilderDialog({ connectionId, onApply, onClose }: Props) {
  const fieldsQuery = useFields(connectionId);
  const fields: FieldDef[] = useMemo(
    () => fieldsForPicker(fieldsQuery.data?.fields ?? []),
    [fieldsQuery.data],
  );

  const [rows, setRows] = useState<BuilderRow[]>([newRow()]);
  const [orderField, setOrderField] = useState<string | undefined>(undefined);
  const [orderDir, setOrderDir] = useState<"ASC" | "DESC">("DESC");
  const [testResult, setTestResult] = useState<TestResult>(null);

  const orderBy = orderField ? { fieldId: orderField, dir: orderDir } : undefined;
  const generatedJql = useMemo(
    () => buildJql({ rows, orderBy }, fields),
    [rows, orderBy, fields],
  );

  const test = useMutation({
    mutationFn: (jql: string) =>
      api
        .post(`connections/${connectionId}/validate-jql`, { json: { jql } })
        .json<{ ok: boolean; error?: string }>(),
    onSuccess: (r) => setTestResult(r.ok ? { ok: true } : { ok: false, error: r.error ?? "Unknown error" }),
    onError: (err) => setTestResult({ ok: false, error: err instanceof Error ? err.message : String(err) }),
  });

  function patchRow(id: string, patch: Partial<BuilderRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.fieldId !== undefined && patch.fieldId !== r.fieldId) {
          const f = fields.find((x) => x.id === patch.fieldId);
          if (f) {
            const ops = operatorsFor(fieldKind(f));
            if (!ops.some((o) => o.id === next.operator)) {
              next.operator = ops[0].id;
            }
          }
        }
        return next;
      }),
    );
    setTestResult(null);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
    setTestResult(null);
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  const canApply = generatedJql.trim().length > 0;

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
          width: "min(760px, 94vw)",
          maxHeight: "86vh",
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
            <div style={{ fontWeight: 600 }}>Build JQL query</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Pick fields, operators, and values. The generated JQL appears below.
            </div>
          </div>
          <button onClick={onClose}>Close</button>
        </div>

        <div className="stack" style={{ overflow: "auto", padding: 14, gap: 10 }}>
          {fieldsQuery.isLoading && <div className="muted">Loading fields…</div>}
          {fieldsQuery.error && (
            <div style={{ color: "var(--danger)" }}>
              Failed to load fields: {String(fieldsQuery.error)}
            </div>
          )}

          {rows.map((row, idx) => (
            <RowEditor
              key={row.id}
              row={row}
              fields={fields}
              canRemove={rows.length > 1}
              showAndLabel={idx > 0}
              onChange={(patch) => patchRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
            />
          ))}

          <div className="row">
            <button type="button" onClick={addRow} disabled={fields.length === 0}>
              + Add condition
            </button>
          </div>

          <div
            className="stack"
            style={{ borderTop: "1px solid var(--border)", paddingTop: 10, gap: 6 }}
          >
            <div className="muted" style={{ fontSize: 12 }}>Order by (optional)</div>
            <div className="row" style={{ gap: 8 }}>
              <div style={{ flex: 1 }}>
                <FieldPicker
                  value={orderField}
                  onChange={(id) => setOrderField(id)}
                  fields={fields}
                  placeholder="No order"
                  allowClear
                />
              </div>
              <select
                value={orderDir}
                onChange={(e) => setOrderDir(e.target.value as "ASC" | "DESC")}
                disabled={!orderField}
              >
                <option value="ASC">ASC</option>
                <option value="DESC">DESC</option>
              </select>
            </div>
          </div>

          <div
            className="stack"
            style={{ borderTop: "1px solid var(--border)", paddingTop: 10, gap: 6 }}
          >
            <div className="muted" style={{ fontSize: 12 }}>Generated JQL</div>
            <code
              style={{
                display: "block",
                padding: 10,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                fontSize: 13,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                minHeight: 38,
              }}
            >
              {generatedJql || <span className="muted">(empty)</span>}
            </code>
            {testResult?.ok === true && (
              <div style={{ color: "var(--success, #2a7a2a)", fontSize: 13 }}>
                JQL is valid.
              </div>
            )}
            {testResult?.ok === false && (
              <div style={{ color: "var(--danger)", fontSize: 13 }}>{testResult.error}</div>
            )}
          </div>
        </div>

        <div
          className="row"
          style={{
            justifyContent: "space-between",
            padding: "10px 14px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            disabled={!canApply || test.isPending}
            onClick={() => test.mutate(generatedJql)}
          >
            {test.isPending ? "Testing…" : "Test query"}
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              disabled={!canApply}
              onClick={() => {
                onApply(generatedJql);
                onClose();
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RowEditor({
  row,
  fields,
  canRemove,
  showAndLabel,
  onChange,
  onRemove,
}: {
  row: BuilderRow;
  fields: FieldDef[];
  canRemove: boolean;
  showAndLabel: boolean;
  onChange: (patch: Partial<BuilderRow>) => void;
  onRemove: () => void;
}) {
  const field = fields.find((f) => f.id === row.fieldId);
  const ops = field ? operatorsFor(fieldKind(field)) : operatorsFor("text");
  const meta = operatorMeta(row.operator);

  return (
    <div className="stack" style={{ gap: 4 }}>
      {showAndLabel && (
        <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
          AND
        </div>
      )}
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <div style={{ flex: "1 1 220px" }}>
          <FieldPicker
            value={row.fieldId || undefined}
            onChange={(id) => onChange({ fieldId: id ?? "" })}
            fields={fields}
            placeholder="Field…"
          />
        </div>
        <select
          value={row.operator}
          onChange={(e) => onChange({ operator: e.target.value as OperatorId })}
          disabled={!field}
          style={{ flex: "0 0 auto" }}
        >
          {ops.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {meta.valueShape !== "none" && (
          <input
            value={row.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder={meta.valueShape === "list" ? "value1, value2" : "value"}
            style={{ flex: "1 1 180px" }}
          />
        )}
        <button type="button" onClick={onRemove} disabled={!canRemove} title="Remove condition">
          ✕
        </button>
      </div>
    </div>
  );
}
