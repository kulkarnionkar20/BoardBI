import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { groupAndAggregate, type AggFn } from "../../lib/aggregate";
import { BUCKET_LABELS, bucketIssueDate, isDateFieldId, type Bucket } from "../../lib/dateBuckets";
import { fieldsForPicker, groupKey } from "../../lib/jqlFields";
import { toCsv } from "../../lib/csv";
import { AggConfigFields } from "./config/AggConfigFields";
import { FieldPicker } from "./config/FieldPicker";
import type { GadgetConfigProps, GadgetEntry, GadgetRenderProps } from "./types";

type Cfg = {
  title?: string;
  groupBy?: string;
  groupByBucket?: Bucket;
  fn: AggFn;
  field?: string;
  topN?: number;
};

function asCfg(c: Record<string, unknown>): Cfg {
  return {
    title: typeof c.title === "string" ? c.title : undefined,
    groupBy: typeof c.groupBy === "string" ? c.groupBy : undefined,
    groupByBucket: typeof c.groupByBucket === "string" ? (c.groupByBucket as Bucket) : undefined,
    fn: (c.fn as AggFn) ?? "count",
    field: typeof c.field === "string" ? c.field : undefined,
    topN: typeof c.topN === "number" ? c.topN : 10,
  };
}

function Render({ rows, config, fields, onDrillThrough }: GadgetRenderProps) {
  const cfg = asCfg(config);
  if (!cfg.groupBy) {
    return <ConfigPlaceholder>Pick a "group by" field</ConfigPlaceholder>;
  }
  const groupBy = cfg.groupBy;
  const dateBucket = cfg.groupByBucket && isDateFieldId(fields, groupBy) ? cfg.groupByBucket : undefined;

  const all = groupAndAggregate(rows, groupBy, { fn: cfg.fn, field: cfg.field }, dateBucket);
  // For bucketed dates, keep chronological order and show all. For categorical
  // groupings, take the top N by aggregated value.
  const data = (dateBucket ? all : all.slice(0, cfg.topN ?? 10)).map((r) => ({
    name: r.key,
    value: r.value,
  }));

  const onBarClick = onDrillThrough
    ? (entry: { name: string }) => {
        const matching = dateBucket
          ? rows.filter((r) => bucketIssueDate(r, groupBy, dateBucket)?.label === entry.name)
          : rows.filter((r) => groupKey(r, groupBy) === entry.name);
        onDrillThrough({ title: `${groupBy}: ${entry.name}`, rows: matching });
      }
    : undefined;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {cfg.title && <div style={{ padding: "6px 8px", fontWeight: 600 }}>{cfg.title}</div>}
      <div style={{ flex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={50} />
            <YAxis />
            <Tooltip />
            <Bar
              dataKey="value"
              fill="#2f6feb"
              onClick={onBarClick}
              style={onBarClick ? { cursor: "pointer" } : undefined}
            />
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ConfigPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="muted" style={{ height: "100%", display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>
      {children}
    </div>
  );
}

function Config({ config, onChange, fields }: GadgetConfigProps) {
  const cfg = asCfg(config);
  const opts = fieldsForPicker(fields);
  const isDate = isDateFieldId(fields, cfg.groupBy);
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
        <label>Group by</label>
        <FieldPicker
          value={cfg.groupBy}
          fields={opts}
          placeholder="Choose a field"
          onChange={(id) => {
            // When the selected field is a date, default to monthly bucketing.
            const willBeDate = isDateFieldId(fields, id);
            onChange({
              ...config,
              groupBy: id,
              groupByBucket: willBeDate ? cfg.groupByBucket ?? "month" : undefined,
            });
          }}
        />
      </div>
      {isDate && (
        <div className="field">
          <label>Granularity</label>
          <select
            value={cfg.groupByBucket ?? "month"}
            onChange={(e) => onChange({ ...config, groupByBucket: e.target.value as Bucket })}
          >
            {(Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => (
              <option key={b} value={b}>
                {BUCKET_LABELS[b]}
              </option>
            ))}
          </select>
        </div>
      )}
      <AggConfigFields
        fn={cfg.fn}
        field={cfg.field}
        fields={fields}
        onChange={(next) => onChange({ ...config, fn: next.fn, field: next.field })}
      />
      {!isDate && (
        <div className="field">
          <label>Top N</label>
          <input
            type="number"
            min={1}
            max={50}
            value={cfg.topN ?? 10}
            onChange={(e) => onChange({ ...config, topN: Math.max(1, Number(e.target.value) || 10) })}
          />
        </div>
      )}
    </div>
  );
}

export const barEntry: GadgetEntry = {
  type: "bar",
  label: "Bar chart",
  defaultConfig: { fn: "count", topN: 10 },
  defaultLayout: { w: 6, h: 6, minW: 3, minH: 4 },
  Render,
  Config,
  exportRows: ({ rows, config, fields }) => {
    const cfg = asCfg(config);
    if (!cfg.groupBy) return null;
    const dateBucket =
      cfg.groupByBucket && isDateFieldId(fields, cfg.groupBy) ? cfg.groupByBucket : undefined;
    const all = groupAndAggregate(rows, cfg.groupBy, { fn: cfg.fn, field: cfg.field }, dateBucket);
    const data = dateBucket ? all : all.slice(0, cfg.topN ?? 10);
    return toCsv([cfg.groupBy, cfg.fn, "count"], data.map((d) => [d.key, d.value, d.count]));
  },
};
