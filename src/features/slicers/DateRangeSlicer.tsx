import { format } from "date-fns";
import { PRESET_LABELS, resolveRange, type DateRangePreset, type DateRangeValue } from "../../lib/dateBuckets";

type Props = {
  field: string;
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  onRemove?: () => void;
  fieldOptions: Array<{ id: string; label: string }>;
  onFieldChange: (id: string) => void;
};

export function DateRangeSlicer(props: Props) {
  const range = resolveRange(props.value);
  return (
    <div className="card stack" style={{ minWidth: 240 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong style={{ fontSize: 13 }}>Date range</strong>
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
      <div className="field">
        <label>Preset</label>
        <select
          value={props.value.preset}
          onChange={(e) =>
            props.onChange({ ...props.value, preset: e.target.value as DateRangePreset })
          }
        >
          {(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      {props.value.preset === "custom" && (
        <div className="row">
          <input
            type="date"
            value={props.value.from?.slice(0, 10) ?? ""}
            onChange={(e) =>
              props.onChange({ ...props.value, from: e.target.value ? new Date(e.target.value).toISOString() : undefined })
            }
          />
          <input
            type="date"
            value={props.value.to?.slice(0, 10) ?? ""}
            onChange={(e) =>
              props.onChange({ ...props.value, to: e.target.value ? new Date(e.target.value).toISOString() : undefined })
            }
          />
        </div>
      )}
      {range && (
        <div className="muted" style={{ fontSize: 12 }}>
          {format(range.from, "MMM d, yyyy")} – {format(range.to, "MMM d, yyyy")}
        </div>
      )}
    </div>
  );
}
