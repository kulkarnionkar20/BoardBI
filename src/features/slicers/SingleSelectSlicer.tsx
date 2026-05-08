import { useMemo } from "react";
import { groupKey, type JiraIssue } from "../../lib/jqlFields";

type Props = {
  field: string;
  value: string | null;
  rows: JiraIssue[];
  onChange: (v: string | null) => void;
  onRemove?: () => void;
  fieldOptions: Array<{ id: string; label: string }>;
  onFieldChange: (id: string) => void;
};

export function SingleSelectSlicer(props: Props) {
  const options = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of props.rows) {
      const k = groupKey(r, props.field);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [props.rows, props.field]);

  return (
    <div className="card stack" style={{ minWidth: 220 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong style={{ fontSize: 13 }}>Single select</strong>
        {props.onRemove && (
          <button onClick={props.onRemove} style={{ padding: "2px 6px" }}>
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
      <div className="field">
        <label>Value</label>
        <select
          value={props.value ?? ""}
          onChange={(e) => props.onChange(e.target.value || null)}
        >
          <option value="">(any)</option>
          {options.map(([key, count]) => (
            <option key={key} value={key}>
              {key} ({count})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
