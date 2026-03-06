// src/lib/csv.ts
// Shared CSV helpers (server + client safe)

export function csvEscape(v: any) {
  const s = (v ?? "").toString();
  if (/[\",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(rows: Record<string, any>[], headers: string[]) {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")).join("\n");
  return head + "\n" + body + "\n";
}
