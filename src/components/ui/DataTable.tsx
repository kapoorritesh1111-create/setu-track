// src/components/ui/DataTable.tsx
"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * ColumnDef is intentionally minimal and Blueprint-friendly.
 * NOTE: For backwards compatibility, DataTable also supports a legacy `render`
 * function on the column (alias of `cell`).
 */
export type ColumnDef<Row> = {
  id: string;
  header: React.ReactNode;
  /** Primary cell renderer */
  cell?: (row: Row) => React.ReactNode;
  /**
   * Legacy alias used by some pages.
   * If provided and `cell` is missing, DataTable will call this.
   */
  render?: (row: Row) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Optional sort accessor */
  sortValue?: (row: Row) => string | number | null | undefined;
};

type Props<Row> = {
  columns: ColumnDef<Row>[];
  rows: Row[];
  /**
   * Required by design, but we provide a safe fallback:
   * - if row has `id` string -> uses it
   * - else uses row index
   */
  rowKey?: (row: Row, index: number) => string;
  selectedRowId?: string;
  onRowClick?: (row: Row) => void;
  /** Optional toolbar slot */
  toolbarRight?: React.ReactNode;
  /** Blueprint: compact density */
  compact?: boolean;
  /** Empty state */
  empty?: React.ReactNode;
};

function defaultRowKey<Row>(row: Row, index: number) {
  const anyRow = row as any;
  if (typeof anyRow?.id === "string" && anyRow.id) return anyRow.id;
  return String(index);
}

export default function DataTable<Row>({
  columns,
  rows,
  rowKey = defaultRowKey,
  selectedRowId,
  onRowClick,
  toolbarRight,
  compact,
  empty,
}: Props<Row>) {
  const [sortId, setSortId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortId) return rows;
    const col = columns.find(c => c.id === sortId);
    if (!col?.sortValue) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, columns, sortId, sortDir]);

  const onSort = (id: string) => {
    if (sortId !== id) {
      setSortId(id);
      setSortDir("asc");
      return;
    }
    setSortDir(d => (d === "asc" ? "desc" : "asc"));
  };

  if (!sorted.length) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-6">
        {empty || <div className="text-sm text-[color:var(--muted-foreground)]">No records.</div>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[color:var(--border)]">
        <div className="text-sm text-[color:var(--muted-foreground)]">{rows.length} rows</div>
        <div>{toolbarRight}</div>
      </div>

      <div className="w-full overflow-auto">
        <table className={cn("w-full text-sm", compact && "text-[13px]")}>
          <thead className="bg-[color:var(--muted)]/30">
            <tr>
              {columns.map(col => {
                const sortable = !!col.sortValue;
                return (
                  <th
                    key={col.id}
                    className={cn(
                      "text-left font-semibold px-4 py-3 border-b border-[color:var(--border)] whitespace-nowrap",
                      col.headerClassName,
                      sortable && "cursor-pointer select-none"
                    )}
                    onClick={sortable ? () => onSort(col.id) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {sortable && sortId === col.id && (sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sorted.map((row, idx) => {
              const id = rowKey(row, idx);
              const selected = selectedRowId && selectedRowId === id;
              return (
                <tr
                  key={id}
                  className={cn(
                    "border-b border-[color:var(--border)] last:border-b-0",
                    onRowClick && "cursor-pointer hover:bg-[color:var(--muted)]/20",
                    selected && "bg-[color:var(--muted)]/25"
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map(col => {
                    const cellFn = col.cell || (col as any).render;
                    return (
                      <td key={col.id} className={cn("px-4 py-3 align-top", col.className)}>
                        {cellFn ? cellFn(row) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
