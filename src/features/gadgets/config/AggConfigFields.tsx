import type { AggFn } from "../../../lib/aggregate";
import { fieldsForPicker, isNumericField, type FieldDef } from "../../../lib/jqlFields";
import { FieldPicker } from "./FieldPicker";

const AGG_FNS: AggFn[] = ["count", "sum", "avg", "min", "max"];

type Props = {
  fn: AggFn;
  field?: string;
  fields: FieldDef[];
  onChange: (next: { fn: AggFn; field?: string }) => void;
};

export function AggConfigFields(props: Props) {
  const numericFields = fieldsForPicker(props.fields).filter(isNumericField);
  const needsField = props.fn !== "count";
  return (
    <>
      <div className="field">
        <label>Aggregation</label>
        <select
          value={props.fn}
          onChange={(e) => {
            const fn = e.target.value as AggFn;
            props.onChange({ fn, field: fn === "count" ? undefined : props.field });
          }}
        >
          {AGG_FNS.map((f) => (
            <option key={f} value={f}>
              {f.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      {needsField && (
        <div className="field">
          <label>Numeric field</label>
          <FieldPicker
            value={props.field}
            fields={numericFields}
            placeholder="Choose a numeric field"
            onChange={(id) => props.onChange({ fn: props.fn, field: id })}
          />
        </div>
      )}
    </>
  );
}
