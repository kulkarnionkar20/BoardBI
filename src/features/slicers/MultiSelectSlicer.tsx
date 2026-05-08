import { useMemo, useState } from "react";
import { groupKey, type JiraIssue } from "../../lib/jqlFields";

type Props = {
  field: string;
  value: string[];
  rows: JiraIssue[];
  onChange: (v: string[]) => void;
  onRemove?: () => void;
  fieldOptions: Array<{ id: string; label: string }>;
  onFieldChange: (id: string) => void;
};

export function MultiSelectSlicer(props: Props) {
  const [filter, setFilter] = useState("");
  const options = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of props.rows) {
      const k = groupKey(r, props.field);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }));
  }, [props.rows, props.field]);

  const filtered = filter
    ? options.filter((o) => o.key.toLowerCase().includes(filter.toLowerCase()))
    : options;

  const toggle = (k: string) => {
    const set = new Set(props.value);
    if (set.has(k)) set.delete(k);
    else set.add(k);
    props.onChange([...set]);
  };

  return (
    <div className="card stack" style={{ minWidth: 220 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong style={{ fontSize: 13 }}>Filter</strong>
        {props.onRemove && (
          <button onClick={props.onRemove} title="Remove slicer" style={{ padding: "2px 6px" }}>
            ×
          </button>
        )}
      </div>
      <div className="field">
        <label>Field</label>
        <select value={props.field} onChange={(e) => props.onFieldChange(e.target.value)}>
          {props.fieldOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <input
        placeholder="Search…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div style={{ maxHeight: 180, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.length === 0 && <div className="muted" style={{ fontSize: 12 }}>No values</div>}
        {filtered.map((o) => (
          <label key={o.key} className="row" style={{ fontSize: 13, gap: 6 }}>
            <input
              type="checkbox"
              checked={props.value.includes(o.key)}
              onChange={() => toggle(o.key)}
            />
            <span style={{ flex: 1 }}>{o.key}</span>
            <span className="muted">{o.count}</span>
          </label>
        ))}
      </div>
      {props.value.length > 0 && (
        <button onClick={() => props.onChange([])} style={{ alignSelf: "flex-start" }}>
          Clear ({props.value.length})
        </button>
      )}
    </div>
  );
}
