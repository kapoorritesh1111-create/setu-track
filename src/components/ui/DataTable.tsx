"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function Tag({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warn" | "warning" | "danger" | "info" | "muted";
}) {
  const cls =
    tone === "success"
      ? "pill ok"
      : tone === "warn" || tone === "warning"
      ? "pill warn"
      : tone === "danger"
      ? "pill danger"
      : tone === "info"
      ? "pill info"
      : tone === "muted"
      ? "pill"
      : "pill";

  return <span className={cls}>{children}</span>;
}

/**
 * Backward-compatible ActionItem type used by older pages:
 * actions={(row): ActionItem<Row>[] => [{ label, onClick, disabled }]}
 */
export type ActionItem<Row = any> = {
  label: React.ReactNode;
  onClick?: (row: Row) => void;
  href?: string | ((row: Row) => string);
  disabled?: boolean;
  danger?: boolean;
};

/**
 * Also export a value/component named ActionItem for compatibility
 * with non-type imports.
 */
export function ActionItem({
  children,
  onClick,
  href,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  const className = cn("pill", danger && "danger", disabled && "disabled");

  if (href) {
    return (
      <a
        href={href}
        className={className}
        style={{
          textDecoration: "none",
          pointerEvents: disabled ? "none" : undefined,
          opacity: disabled ? 0.6 : undefined,
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      style={{ cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {children}
    </button>
  );
}

export type ColumnDef<Row> = {
  id?: string;
  key?: string;
  header: React.ReactNode;
  cell?: (row: Row) => React.ReactNode;
  render?: (row: Row) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortValue?: (row: Row) => string | number | null | undefined;
  width?: number | string;
};

type Props<Row> = {
  columns: ColumnDef<Row>[];
  rows: Row[];
  rowKey?: (row: Row, index: number) => string;
  selectedRowId?: string;
  onRowClick?: (row: Row) => void;
  toolbarRight?: React.ReactNode;
  compact?: boolean;
  loading?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
  actions?: (row: Row) => Array<ActionItem<Row> | React.ReactNode> | React.ReactNode;
};

export default function DataTable<Row>({
  columns,
  rows,
  rowKey,
  selectedRowId,
  onRowClick,
  toolbarRight,
  compact,
  loading = false,
  emptyTitle = "No records",
  emptySubtitle = "Nothing to show yet.",
  actions,
}: Props<Row>) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const normalizedColumns = useMemo(
    () =>
      columns.map((c, i) => ({
        ...c,
        _id: c.id || c.key || `col_${i}`,
      })),
    [columns]
  );

  const hasActions = !!actions;

  const sortedRows = useMemo(() => {
    if (!sortBy) return rows;

    const col = normalizedColumns.find((c) => c._id === sortBy);
    if (!col?.sortValue) return rows;

    const dir = sortDir === "asc" ? 1 : -1;
    const copy = [...rows];

    copy.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);

      if (va == null && vb == null) return 0;
      if (va == null) return -1 * dir;
      if (vb == null) return 1 * dir;

      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;

      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();

      if (sa < sb) return -1 * dir;
      if (sa > sb) return 1 * dir;
      return 0;
    });

    return copy;
  }, [rows, normalizedColumns, sortBy, sortDir]);

  function keyFor(row: Row, index: number) {
    if (rowKey) return rowKey(row, index);
    const anyRow = row as any;
    if (anyRow && typeof anyRow.id === "string") return anyRow.id;
    return String(index);
  }

  function toggleSort(colId: string) {
    if (sortBy !== colId) {
      setSortBy(colId);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function widthStyle(width?: number | string): React.CSSProperties | undefined {
    if (width == null) return undefined;
    const value = typeof width === "number" ? `${width}px` : width;
    return { width: value };
  }

  function isActionItemObject<RowT>(
    value: ActionItem<RowT> | React.ReactNode
  ): value is ActionItem<RowT> {
    return !!value && typeof value === "object" && "label" in (value as any);
  }

  if (loading) {
    return (
      <div className={cn("card", compact && "tableCompact")}>
        {toolbarRight ? (
          <div className="tableToolbar">
            <div />
            <div>{toolbarRight}</div>
          </div>
        ) : null}
        <div className="cardPad">
          <div className="muted">Loading…</div>
        </div>
      </div>
    );
  }

  if (!sortedRows.length) {
    return (
      <div className={cn("card", compact && "tableCompact")}>
        {toolbarRight ? (
          <div className="tableToolbar">
            <div />
            <div>{toolbarRight}</div>
          </div>
        ) : null}
        <div className="cardPad">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{emptyTitle}</div>
          <div className="muted">{emptySubtitle}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("card", compact && "tableCompact")}>
      {toolbarRight ? (
        <div className="tableToolbar">
          <div />
          <div>{toolbarRight}</div>
        </div>
      ) : null}

      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              {normalizedColumns.map((c) => {
                const sortable = !!c.sortValue;
                const active = sortBy === c._id;

                return (
                  <th
                    key={c._id}
                    className={cn(c.headerClassName, sortable && "sortable", active && "active")}
                    onClick={sortable ? () => toggleSort(c._id) : undefined}
                    role={sortable ? "button" : undefined}
                    tabIndex={sortable ? 0 : undefined}
                    style={widthStyle(c.width)}
                  >
                    <div className="thInner">
                      <span>{c.header}</span>
                      {sortable ? (
                        <span className="sortIcon">
                          {active ? (
                            sortDir === "asc" ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )
                          ) : (
                            <ChevronDown size={14} className="muted" />
                          )}
                        </span>
                      ) : null}
                    </div>
                  </th>
                );
              })}
              {hasActions ? <th style={{ width: 1 }} /> : null}
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row, idx) => {
              const id = keyFor(row, idx);
              const selected = !!selectedRowId && selectedRowId === id;
              const rawActions = actions ? actions(row) : null;
              const rowActionsArray = Array.isArray(rawActions)
                ? rawActions
                : rawActions
                ? [rawActions]
                : [];

              return (
                <tr
                  key={id}
                  className={cn(selected && "selected", onRowClick && "clickable")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {normalizedColumns.map((c) => {
                    const renderer = c.cell || c.render;
                    return (
                      <td key={c._id} className={cn(c.className)} style={widthStyle(c.width)}>
                        {renderer ? renderer(row) : null}
                      </td>
                    );
                  })}

                  {hasActions ? (
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                        {rowActionsArray.map((node, i) => {
                          if (isActionItemObject<Row>(node)) {
                            const href =
                              typeof node.href === "function" ? node.href(row) : node.href;

                            return (
                              <ActionItem
                                key={i}
                                href={href}
                                disabled={node.disabled}
                                danger={node.danger}
                                onClick={node.onClick ? () => node.onClick?.(row) : undefined}
                              >
                                {node.label}
                              </ActionItem>
                            );
                          }

                          return <React.Fragment key={i}>{node}</React.Fragment>;
                        })}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
