export function formatMoney(value: number | null | undefined, currency = 'USD') {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

export function formatCompactNumber(value: number | null | undefined, digits = 1) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: digits }).format(Number(value || 0));
}

export function formatHours(value: number | null | undefined, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

export function formatDate(value?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return '—';
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, opts);
}

export function formatDateRange(start?: string | null, end?: string | null) {
  if (!start || !end) return '—';
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} → ${e.toLocaleDateString(undefined, { day: 'numeric', year: 'numeric' })}`;
  }
  return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} → ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function formatDeltaPercent(current: number, previous: number) {
  if (!previous && !current) return '0.0%';
  if (!previous) return '+100.0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}
