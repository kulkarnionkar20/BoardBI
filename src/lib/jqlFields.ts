// Helpers for reading values out of JIRA issue payloads and presenting fields
// to the user. JIRA returns issues as { id, key, fields: { ...fieldId: value } }
// where the value shape varies wildly by field type. We normalize to:
//   - groupable: a string key (or null/"(none)") for grouping
//   - numeric:   a finite number (or null) for sum/avg/min/max
//   - date:      an ISO date string (or null) for date filters/buckets

export type JiraIssue = {
  id: string;
  key: string;
  fields: Record<string, unknown>;
};

export type FieldDef = {
  id: string;
  name: string;
  custom: boolean;
  schema?: { type?: string; items?: string };
};

export const NONE_KEY = "(none)";

// Built-in fields that aren't returned by /rest/api/3/field but are always
// present on issues. We add these to the picker manually.
export const BUILTIN_FIELDS: FieldDef[] = [
  { id: "key", name: "Issue key", custom: false, schema: { type: "string" } },
];

export function fieldsForPicker(fields: FieldDef[]): FieldDef[] {
  const seen = new Set<string>();
  const out: FieldDef[] = [];
  for (const f of [...BUILTIN_FIELDS, ...fields]) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function get(issue: JiraIssue, fieldId: string): unknown {
  if (fieldId === "key") return issue.key;
  if (fieldId === "id") return issue.id;
  return issue.fields?.[fieldId];
}

// Returns a stable string key suitable for group-by. Handles common JIRA
// shapes: user objects ({displayName}), option objects ({value, name}),
// status/priority/issuetype objects ({name}), and arrays.
export function groupKey(issue: JiraIssue, fieldId: string): string {
  const v = get(issue, fieldId);
  return toGroupKey(v);
}

function toGroupKey(v: unknown): string {
  if (v == null) return NONE_KEY;
  if (typeof v === "string") return v.length === 0 ? NONE_KEY : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return NONE_KEY;
    return v.map(toGroupKey).join(", ");
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.displayName === "string") return o.displayName;
    if (typeof o.name === "string") return o.name;
    if (typeof o.value === "string") return o.value;
    if (typeof o.key === "string") return o.key;
  }
  return NONE_KEY;
}

export function numericValue(issue: JiraIssue, fieldId: string): number | null {
  const v = get(issue, fieldId);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function dateValue(issue: JiraIssue, fieldId: string): Date | null {
  const v = get(issue, fieldId);
  if (v instanceof Date) return v;
  if (typeof v === "string" && v.length > 0) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t) : null;
  }
  return null;
}

// For tables: a display string for any cell value.
export function displayValue(issue: JiraIssue, fieldId: string): string {
  const v = get(issue, fieldId);
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map((x) => toGroupKey(x)).join(", ");
  if (typeof v === "object") return toGroupKey(v);
  return "";
}

// Heuristics for what a field can be used for in gadget config.
export function isDateField(f: FieldDef): boolean {
  const t = f.schema?.type;
  return t === "date" || t === "datetime";
}

export function isNumericField(f: FieldDef): boolean {
  const t = f.schema?.type;
  return t === "number";
}
