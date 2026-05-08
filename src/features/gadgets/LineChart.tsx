import {
  CartesianGrid,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AggFn } from "../../lib/aggregate";
import { BUCKET_LABELS, bucketByDate, rowsForDateBucket, type Bucket } from "../../lib/dateBuckets";
import { fieldsForPicker, isDateField } from "../../lib/jqlFields";
import { toCsv } from "../../lib/csv";
import { AggConfigFields } from "./config/AggConfigFields";
import { FieldPicker } from "./config/FieldPicker";
import type { GadgetConfigProps, GadgetEntry, GadgetRenderProps } from "./types";

type Cfg = {
  title?: string;
  dateField?: string;
  bucket: Bucket;
  fn: AggFn;
  field?: string;
};

function asCfg(c: Record<string, unknown>): Cfg {
  return {
    title: typeof c.title === "string" ? c.title : undefined,
    dateField: typeof c.dateField === "string" ? c.dateField : undefined,
    bucket: (c.bucket as Bucket) ?? "month",
    fn: (c.fn as AggFn) ?? "count",
    field: typeof c.field === "string" ? c.field : undefined,
  };
}

function Render({ rows, config, onDrillThrough }: GadgetRenderProps) {
  const cfg = asCfg(config);
  if (!cfg.dateField) {
    return (
      <div className="muted" style={{ height: "100%", display: "grid", placeItems: "center", padding: 16 }}>
        Pick a date field
      </div>
    );
  }
  const dateField = cfg.dateField;
  const bucket = cfg.bucket;
  const data = bucketByDate(rows, dateField, bucket, { fn: cfg.fn, field: cfg.field });

  const onChartClick = onDrillThrough
    ? (state: { activeLabel?: string } | null) => {
        const label = state?.activeLabel;
        if (!label) return;
        const matching = rowsForDateBucket(rows, dateField, bucket, label);
        onDrillThrough({ title: `${dateField} · ${label}`, rows: matching });
      }
    : undefined;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {cfg.title && <div style={{ padding: "6px 8px", fontWeight: 600 }}>{cfg.title}</div>}
      <div style={{ flex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RLineChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
            onClick={onChartClick}
            style={onChartClick ? { cursor: "pointer" } : undefined}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" interval="preserveStartEnd" angle={-25} textAnchor="end" height={50} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#2f6feb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
          </RLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Config({ config, onChange, fields }: GadgetConfigProps) {
  const cfg = asCfg(config);
  const dateOpts = fieldsForPicker(fields).filter(isDateField);
  return (
    <div className="stack">
      <div className="field">
        <label>Title (optional)</label>
        <input
          value={cfg.title ?? ""}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Date field</label>
        <FieldPicker
          value={cfg.dateField}
          fields={dateOpts}
          placeholder="Choose a date field"
          onChange={(id) => onChange({ ...config, dateField: id })}
        />
      </div>
      <div className="field">
        <label>Bucket</label>
        <select
          value={cfg.bucket}
          onChange={(e) => onChange({ ...config, bucket: e.target.value as Bucket })}
        >
          {(Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => (
            <option key={b} value={b}>
              {BUCKET_LABELS[b]}
            </option>
          ))}
        </select>
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

export const lineEntry: GadgetEntry = {
  type: "line",
  label: "Line chart",
  defaultConfig: { fn: "count", bucket: "month" },
  defaultLayout: { w: 6, h: 6, minW: 3, minH: 4 },
  Render,
  Config,
  exportRows: ({ rows, config }) => {
    const cfg = asCfg(config);
    if (!cfg.dateField) return null;
    const data = bucketByDate(rows, cfg.dateField, cfg.bucket, { fn: cfg.fn, field: cfg.field });
    return toCsv(["bucket", cfg.fn], data.map((d) => [d.bucket, d.value]));
  },
};
