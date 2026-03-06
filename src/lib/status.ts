export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

function norm(v: string) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function normalizeStatusKey(input: string): string {
  const v = norm(input);

  // Payroll / pay period
  if (v === "closed" || v === "locked") return "locked";
  if (v === "open" || v === "unlocked") return "open";
  if (v === "paid" || v === "mark_paid") return "paid";
  if (v === "exported" || v === "export") return "exported";
  if (v === "void" || v === "voided") return "voided";
  if (v === "reopen" || v === "reopened") return "open";

  // Time entry workflow
  if (v === "submitted" || v === "pending") return "pending";
  if (v === "approved") return "approved";
  if (v === "rejected" || v === "declined") return "rejected";
  if (v === "draft") return "draft";

  // People / projects
  if (v === "active" || v === "enabled") return "active";
  if (v === "inactive" || v === "disabled") return "inactive";

  return v || "neutral";
}

export function statusTone(input: string): StatusTone {
  const k = normalizeStatusKey(input);
  if (k === "approved" || k === "paid" || k === "exported" || k === "active" || k === "locked") return "success";
  if (k === "pending") return "warning";
  if (k === "rejected" || k === "voided" || k === "inactive") return "danger";
  if (k === "open") return "info";
  // locked / draft / default
  return "neutral";
}

export function statusLabel(input: string): string {
  const k = normalizeStatusKey(input);
  const map: Record<string, string> = {
    open: "Open",
    locked: "Locked",
    approved: "Approved",
    pending: "Pending",
    rejected: "Rejected",
    draft: "Draft",
    paid: "Paid",
    exported: "Exported",
    voided: "Voided",
    active: "Active",
    inactive: "Inactive",
    neutral: "—",
  };
  if (map[k]) return map[k];

  // title-case fallback
  return k
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
