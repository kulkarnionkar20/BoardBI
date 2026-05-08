type Props = {
  field: string;
  value: string;
  onChange: (v: string) => void;
  onRemove?: () => void;
  fieldOptions: Array<{ id: string; label: string }>;
  onFieldChange: (id: string) => void;
};

export function TextSearchSlicer(props: Props) {
  return (
    <div className="card stack" style={{ minWidth: 220 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong style={{ fontSize: 13 }}>Text search</strong>
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
      <input
        placeholder="Contains…"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
