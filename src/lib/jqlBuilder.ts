import type { FieldDef } from "./jqlFields";

export type FieldKind = "text" | "number" | "date" | "option";

export type OperatorId =
  | "="
  | "!="
  | "~"
  | "!~"
  | ">"
  | ">="
  | "<"
  | "<="
  | "IN"
  | "NOT IN"
  | "IS EMPTY"
  | "IS NOT EMPTY";

export type ValueShape = "single" | "list" | "none";

export type OperatorMeta = {
  id: OperatorId;
  label: string;
  valueShape: ValueShape;
};

export type BuilderRow = {
  id: string;
  fieldId: string;
  operator: OperatorId;
  value: string;
};

export type BuilderState = {
  rows: BuilderRow[];
  orderBy?: { fieldId: string; dir: "ASC" | "DESC" };
};

const ALL_OPERATORS: Record<OperatorId, OperatorMeta> = {
  "=": { id: "=", label: "equals (=)", valueShape: "single" },
  "!=": { id: "!=", label: "not equals (!=)", valueShape: "single" },
  "~": { id: "~", label: "contains (~)", valueShape: "single" },
  "!~": { id: "!~", label: "does not contain (!~)", valueShape: "single" },
  ">": { id: ">", label: "greater than (>)", valueShape: "single" },
  ">=": { id: ">=", label: "greater or equal (>=)", valueShape: "single" },
  "<": { id: "<", label: "less than (<)", valueShape: "single" },
  "<=": { id: "<=", label: "less or equal (<=)", valueShape: "single" },
  "IN": { id: "IN", label: "in (any of)", valueShape: "list" },
  "NOT IN": { id: "NOT IN", label: "not in", valueShape: "list" },
  "IS EMPTY": { id: "IS EMPTY", label: "is empty", valueShape: "none" },
  "IS NOT EMPTY": { id: "IS NOT EMPTY", label: "is not empty", valueShape: "none" },
};

const OPS_TEXT: OperatorId[] = ["=", "!=", "~", "!~", "IN", "NOT IN", "IS EMPTY", "IS NOT EMPTY"];
const OPS_NUMBER: OperatorId[] = ["=", "!=", ">", ">=", "<", "<=", "IS EMPTY", "IS NOT EMPTY"];
const OPS_DATE: OperatorId[] = ["=", "!=", ">", ">=", "<", "<=", "IS EMPTY", "IS NOT EMPTY"];
const OPS_OPTION: OperatorId[] = ["=", "!=", "IN", "NOT IN", "IS EMPTY", "IS NOT EMPTY"];

const OPTION_TYPES = new Set([
  "option",
  "priority",
  "status",
  "resolution",
  "issuetype",
  "user",
  "project",
  "version",
  "component",
]);

export function fieldKind(f: FieldDef): FieldKind {
  const t = f.schema?.type;
  if (t === "date" || t === "datetime") return "date";
  if (t === "number") return "number";
  if (t === "array" || (t && OPTION_TYPES.has(t))) return "option";
  return "text";
}

export function operatorsFor(kind: FieldKind): OperatorMeta[] {
  const ids =
    kind === "text" ? OPS_TEXT
    : kind === "number" ? OPS_NUMBER
    : kind === "date" ? OPS_DATE
    : OPS_OPTION;
  return ids.map((id) => ALL_OPERATORS[id]);
}

export function operatorMeta(id: OperatorId): OperatorMeta {
  return ALL_OPERATORS[id];
}

const BARE_NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const CUSTOM_FIELD = /^customfield_(\d+)$/;

export function jqlFieldRef(f: FieldDef): string {
  const m = CUSTOM_FIELD.exec(f.id);
  if (m) return `cf[${m[1]}]`;
  if (f.custom) return jqlEscape(f.name);
  if (BARE_NAME.test(f.id)) return f.id;
  return jqlEscape(f.id);
}

const SAFE_UNQUOTED = /^[a-zA-Z0-9][a-zA-Z0-9_\-.@]*$/;

export function jqlEscape(value: string): string {
  if (SAFE_UNQUOTED.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function rowToJql(row: BuilderRow, fields: FieldDef[]): string {
  const field = fields.find((f) => f.id === row.fieldId);
  if (!field) return "";
  const meta = ALL_OPERATORS[row.operator];
  if (!meta) return "";
  const ref = jqlFieldRef(field);
  if (meta.valueShape === "none") return `${ref} ${row.operator}`;
  if (meta.valueShape === "list") {
    const parts = row.value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(jqlEscape);
    if (parts.length === 0) return "";
    return `${ref} ${row.operator} (${parts.join(", ")})`;
  }
  if (row.value.trim().length === 0) return "";
  return `${ref} ${row.operator} ${jqlEscape(row.value)}`;
}

export function buildJql(state: BuilderState, fields: FieldDef[]): string {
  const conditions = state.rows
    .map((r) => rowToJql(r, fields))
    .filter((s) => s.length > 0);
  let jql = conditions.join(" AND ");
  if (state.orderBy) {
    const f = fields.find((x) => x.id === state.orderBy?.fieldId);
    if (f) {
      const ref = jqlFieldRef(f);
      jql = jql ? `${jql} ORDER BY ${ref} ${state.orderBy.dir}` : `ORDER BY ${ref} ${state.orderBy.dir}`;
    }
  }
  return jql;
}
