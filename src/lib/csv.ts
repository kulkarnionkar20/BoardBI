// Minimal RFC-4180-ish CSV serializer. Quotes when a cell contains comma,
// quote, newline, or starts/ends with whitespace; doubles internal quotes.

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers.map(escape).join(",")];
  for (const r of rows) {
    lines.push(r.map((c) => escape(c == null ? "" : String(c))).join(","));
  }
  return lines.join("\r\n");
}

function escape(v: string): string {
  if (v === "") return "";
  if (/[",\r\n]/.test(v) || /^\s|\s$/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
