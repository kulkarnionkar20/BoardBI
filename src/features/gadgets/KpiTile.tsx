import { aggregate, formatNumber, type AggFn } from "../../lib/aggregate";
import { toCsv } from "../../lib/csv";
import { AggConfigFields } from "./config/AggConfigFields";
import type { GadgetConfigProps, GadgetEntry, GadgetRenderProps } from "./types";

type Cfg = { title?: string; fn: AggFn; field?: string };

function asCfg(c: Record<string, unknown>): Cfg {
  return {
    title: typeof c.title === "string" ? c.title : undefined,
    fn: (c.fn as AggFn) ?? "count",
    field: typeof c.field === "string" ? c.field : undefined,
  };
}

function Render({ rows, config, onDrillThrough }: GadgetRenderProps) {
  const cfg = asCfg(config);
  const value = aggregate(rows, { fn: cfg.fn, field: cfg.field });
  const label = cfg.title ?? `${cfg.fn.toUpperCase()}${cfg.field ? ` of ${cfg.field}` : ""}`;
  const drillable = rows.length > 0 && !!onDrillThrough;
  return (
    <div
      onClick={() => {
        if (!drillable) return;
        onDrillThrough!({ title: label, rows });
      }}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        cursor: drillable ? "pointer" : "default",
      }}
      title={drillable ? "Click to view underlying issues" : undefined}
    >
      <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, marginTop: 4 }}>{formatNumber(value)}</div>
      <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
        {rows.length.toLocaleString()} issue{rows.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function Config({ config, onChange, fields }: GadgetConfigProps) {
  const cfg = asCfg(config);
  return (
    <div className="stack">
      <div className="field">
        <label>Title (optional)</label>
        <input
          value={cfg.title ?? ""}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="e.g. Open issues"
        />
      </div>
      <AggConfigFields
        fn={cfg.fn}
        field={cfg.field}
        fields={fields}
        onChange={(next) => onChange({ ...config, fn: next.fn, field: next.field })}
      />
    </div>
  );
}

export const kpiEntry: GadgetEntry = {
  type: "kpi",
  label: "KPI tile",
  defaultConfig: { fn: "count" },
  defaultLayout: { w: 3, h: 3, minW: 2, minH: 2 },
  Render,
  Config,
  exportRows: ({ rows, config }) => {
    const cfg = asCfg(config);
    const value = aggregate(rows, { fn: cfg.fn, field: cfg.field });
    const label = cfg.title ?? `${cfg.fn}${cfg.field ? `(${cfg.field})` : ""}`;
    return toCsv(["metric", "value", "issues"], [[label, value, rows.length]]);
  },
};
