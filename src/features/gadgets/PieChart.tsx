import {
  Cell,
  Legend,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { groupAndAggregate, type AggFn } from "../../lib/aggregate";
import { BUCKET_LABELS, bucketIssueDate, isDateFieldId, type Bucket } from "../../lib/dateBuckets";
import { fieldsForPicker, groupKey } from "../../lib/jqlFields";
import { toCsv } from "../../lib/csv";
import { AggConfigFields } from "./config/AggConfigFields";
import { FieldPicker } from "./config/FieldPicker";
import type { GadgetConfigProps, GadgetEntry, GadgetRenderProps } from "./types";
import type { FieldDef, JiraIssue } from "../../lib/jqlFields";

const PALETTE = [
  "#2f6feb",
  "#34a853",
  "#fbbc04",
  "#ea4335",
  "#9b59b6",
  "#16a085",
  "#e67e22",
  "#7f8c8d",
  "#1abc9c",
  "#d35400",
];

type Cfg = {
  title?: string;
  groupBy?: string;
  groupByBucket?: Bucket;
  fn: AggFn;
  field?: string;
  topN?: number;
  donut?: boolean;
};

function asCfg(c: Record<string, unknown>): Cfg {
  return {
    title: typeof c.title === "string" ? c.title : undefined,
    groupBy: typeof c.groupBy === "string" ? c.groupBy : undefined,
    groupByBucket: typeof c.groupByBucket === "string" ? (c.groupByBucket as Bucket) : undefined,
    fn: (c.fn as AggFn) ?? "count",
    field: typeof c.field === "string" ? c.field : undefined,
    topN: typeof c.topN === "number" ? c.topN : 8,
    donut: typeof c.donut === "boolean" ? c.donut : true,
  };
}

function buildData(rows: JiraIssue[], cfg: Cfg, fields: FieldDef[]) {
  if (!cfg.groupBy) return [];
  const dateBucket =
    cfg.groupByBucket && isDateFieldId(fields, cfg.groupBy) ? cfg.groupByBucket : undefined;
  const all = groupAndAggregate(rows, cfg.groupBy, { fn: cfg.fn, field: cfg.field }, dateBucket);
  // Pies don't make sense as time-series chronology, so even when bucketed by
  // date we still trim to topN (largest slices). Categorical: same.
  return all.slice(0, cfg.topN ?? 8).map((r) => ({ name: r.key, value: r.value }));
}

function Render({ rows, config, fields, onDrillThrough }: GadgetRenderProps) {
  const cfg = asCfg(config);
  if (!cfg.groupBy) {
    return (
      <div className="muted" style={{ height: "100%", display: "grid", placeItems: "center", padding: 16 }}>
        Pick a "group by" field
      </div>
    );
  }
  const groupBy = cfg.groupBy;
  const dateBucket = cfg.groupByBucket && isDateFieldId(fields, groupBy) ? cfg.groupByBucket : undefined;
  const data = buildData(rows, cfg, fields);

  const onSliceClick = onDrillThrough
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
          <RPieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={cfg.donut ? "55%" : 0}
              outerRadius="80%"
              label={(entry) => entry.name as string}
              onClick={onSliceClick}
              style={onSliceClick ? { cursor: "pointer" } : undefined}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </RPieChart>
        </ResponsiveContainer>
      </div>
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
      <div className="field">
        <label>Top N slices</label>
        <input
          type="number"
          min={2}
          max={20}
          value={cfg.topN ?? 8}
          onChange={(e) => onChange({ ...config, topN: Math.max(2, Number(e.target.value) || 8) })}
        />
      </div>
      <label className="row" style={{ gap: 6 }}>
        <input
          type="checkbox"
          checked={cfg.donut}
          onChange={(e) => onChange({ ...config, donut: e.target.checked })}
        />
        <span style={{ fontSize: 13 }}>Donut style</span>
      </label>
    </div>
  );
}

export const pieEntry: GadgetEntry = {
  type: "pie",
  label: "Pie chart",
  defaultConfig: { fn: "count", topN: 8, donut: true },
  defaultLayout: { w: 4, h: 6, minW: 3, minH: 4 },
  Render,
  Config,
  exportRows: ({ rows, config, fields }) => {
    const cfg = asCfg(config);
    if (!cfg.groupBy) return null;
    const data = buildData(rows, cfg, fields);
    return toCsv([cfg.groupBy, cfg.fn], data.map((d) => [d.name, d.value]));
  },
};
