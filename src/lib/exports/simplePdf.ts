// src/lib/exports/simplePdf.ts
// Minimal, dependency-free PDF generator (text + simple table layout).
// This is intentionally conservative for Vercel/Node runtimes.

type TextLine = { x: number; y: number; size: number; text: string };

function pdfEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function toFixed2(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

// Basic A4 portrait page in points
const PAGE_W = 595.28;
const PAGE_H = 841.89;

function buildPdf(lines: TextLine[]) {
  // Single-page PDF with Helvetica.
  const content: string[] = [];
  content.push("BT");
  for (const l of lines) {
    const txt = pdfEscape(l.text);
    content.push(`/F1 ${l.size} Tf`);
    // Absolute positioning (avoid cumulative/relative drift)
    content.push(`1 0 0 1 ${l.x.toFixed(2)} ${l.y.toFixed(2)} Tm`);
    content.push(`(${txt}) Tj`);
  }
  content.push("ET");
  const stream = content.join("\n") + "\n";

  // Build objects
  const objects: string[] = [];
  const offsets: number[] = [0];
  // Use Latin-1 bytes in the binary header to avoid Unicode encoding issues in Buffer.
  let out = "%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n";

  function addObject(obj: string) {
    offsets.push(out.length);
    out += obj + "\n";
  }

  // 1: Catalog
  addObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  // 2: Pages
  addObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  // 3: Page
  addObject(
    "3 0 obj\n" +
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\n` +
      "endobj"
  );
  // 4: Font
  addObject("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
  // 5: Content
  addObject(
    "5 0 obj\n" +
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream\nendobj`
  );

  // xref
  const xrefPos = out.length;
  out += "xref\n";
  out += `0 ${offsets.length}\n`;
  out += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += "trailer\n";
  out += `<< /Size ${offsets.length} /Root 1 0 R >>\n`;
  out += "startxref\n";
  out += `${xrefPos}\n`;
  out += "%%EOF\n";

  // 'latin1' keeps 1:1 byte mapping for the PDF body string.
  return Buffer.from(out, "latin1");
}

export type PayrollPdfMeta = {
  orgName?: string;
  clientName?: string;
  projectName?: string;
  periodStart: string;
  periodEnd: string;
  generatedAtIso: string;
};

export type PayrollSummaryLine = {
  contractor: string;
  hours: number;
  avgRate: number;
  pay: number;
};

export type PayrollDetailLine = {
  date: string;
  contractor: string;
  project: string;
  hours: number;
  rate: number;
  pay: number;
};

export function buildPayrollSummaryPdf(meta: PayrollPdfMeta, lines: PayrollSummaryLine[]) {
  const out: TextLine[] = [];
  let y = PAGE_H - 48;
  const x = 48;

  out.push({ x, y, size: 18, text: "Payroll Summary" });
  y -= 22;
  out.push({ x, y, size: 10, text: `Period: ${meta.periodStart} → ${meta.periodEnd}` });
  y -= 14;
  if (meta.clientName) {
    out.push({ x, y, size: 10, text: `Client: ${meta.clientName}` });
    y -= 14;
  }
  if (meta.projectName) {
    out.push({ x, y, size: 10, text: `Project: ${meta.projectName}` });
    y -= 14;
  }
  out.push({ x, y, size: 9, text: `Generated: ${new Date(meta.generatedAtIso).toLocaleString()}` });
  y -= 18;

  // Header
  out.push({ x, y, size: 10, text: "Contractor" });
  out.push({ x: 340, y, size: 10, text: "Hours" });
  out.push({ x: 410, y, size: 10, text: "Rate" });
  out.push({ x: 485, y, size: 10, text: "Pay" });
  y -= 10;
  out.push({ x, y, size: 9, text: "--------------------------------------------------------------------------------" });
  y -= 14;

  let totalH = 0;
  let totalP = 0;
  for (const r of lines) {
    totalH += r.hours;
    totalP += r.pay;
    out.push({ x, y, size: 10, text: r.contractor || "(no name)" });
    out.push({ x: 340, y, size: 10, text: toFixed2(r.hours) });
    out.push({ x: 410, y, size: 10, text: toFixed2(r.avgRate) });
    out.push({ x: 485, y, size: 10, text: toFixed2(r.pay) });
    y -= 14;
    if (y < 72) break; // keep single-page safe
  }
  y -= 8;
  out.push({ x, y, size: 9, text: "--------------------------------------------------------------------------------" });
  y -= 14;
  out.push({ x, y, size: 10, text: "TOTAL" });
  out.push({ x: 340, y, size: 10, text: toFixed2(totalH) });
  out.push({ x: 485, y, size: 10, text: toFixed2(totalP) });
  y -= 18;

  out.push({ x, y, size: 8, text: "Audit note: This export is snapshot-backed from the locked payroll run." });

  return buildPdf(out);
}

export function buildPayrollDetailPdf(meta: PayrollPdfMeta, lines: PayrollDetailLine[]) {
  const out: TextLine[] = [];
  let y = PAGE_H - 48;
  const x = 48;

  out.push({ x, y, size: 18, text: "Payroll Details" });
  y -= 22;
  out.push({ x, y, size: 10, text: `Period: ${meta.periodStart} → ${meta.periodEnd}` });
  y -= 14;
  if (meta.clientName) {
    out.push({ x, y, size: 10, text: `Client: ${meta.clientName}` });
    y -= 14;
  }
  if (meta.projectName) {
    out.push({ x, y, size: 10, text: `Project: ${meta.projectName}` });
    y -= 14;
  }
  out.push({ x, y, size: 9, text: `Generated: ${new Date(meta.generatedAtIso).toLocaleString()}` });
  y -= 18;

  out.push({ x, y, size: 10, text: "Date" });
  out.push({ x: 120, y, size: 10, text: "Contractor" });
  out.push({ x: 310, y, size: 10, text: "Project" });
  out.push({ x: 430, y, size: 10, text: "Hrs" });
  out.push({ x: 470, y, size: 10, text: "Rate" });
  out.push({ x: 520, y, size: 10, text: "Pay" });
  y -= 10;
  out.push({ x, y, size: 9, text: "--------------------------------------------------------------------------------" });
  y -= 14;

  let totalH = 0;
  let totalP = 0;
  for (const r of lines) {
    totalH += r.hours;
    totalP += r.pay;
    out.push({ x, y, size: 9, text: r.date });
    out.push({ x: 120, y, size: 9, text: (r.contractor || "").slice(0, 22) });
    out.push({ x: 310, y, size: 9, text: (r.project || "").slice(0, 18) });
    out.push({ x: 430, y, size: 9, text: toFixed2(r.hours) });
    out.push({ x: 470, y, size: 9, text: toFixed2(r.rate) });
    out.push({ x: 520, y, size: 9, text: toFixed2(r.pay) });
    y -= 12;
    if (y < 72) break;
  }
  y -= 8;
  out.push({ x, y, size: 9, text: "--------------------------------------------------------------------------------" });
  y -= 14;
  out.push({ x, y, size: 10, text: "TOTAL" });
  out.push({ x: 430, y, size: 10, text: toFixed2(totalH) });
  out.push({ x: 520, y, size: 10, text: toFixed2(totalP) });
  y -= 18;
  out.push({ x, y, size: 8, text: "Audit note: This export is snapshot-backed from the locked payroll run." });

  return buildPdf(out);
}

// Phase 2.8: simple client cover page for bundles
export function buildPayrollCoverPdf(meta: PayrollPdfMeta, totals: { totalHours: number; totalPay: number; currency?: string }) {
  const out: TextLine[] = [];
  let y = PAGE_H - 72;
  const x = 64;

  out.push({ x, y, size: 22, text: "Payroll Deliverable" });
  y -= 28;
  out.push({ x, y, size: 12, text: `Period: ${meta.periodStart} → ${meta.periodEnd}` });
  y -= 18;
  if (meta.clientName) {
    out.push({ x, y, size: 12, text: `Client: ${meta.clientName}` });
    y -= 18;
  }
  if (meta.projectName) {
    out.push({ x, y, size: 12, text: `Project: ${meta.projectName}` });
    y -= 18;
  }
  y -= 8;
  out.push({ x, y, size: 10, text: `Generated: ${new Date(meta.generatedAtIso).toLocaleString()}` });
  y -= 28;

  const cur = totals.currency || "USD";
  out.push({ x, y, size: 14, text: `Total hours: ${toFixed2(totals.totalHours)}` });
  y -= 20;
  out.push({ x, y, size: 14, text: `Total amount: ${cur} ${toFixed2(totals.totalPay)}` });
  y -= 34;

  out.push({ x, y, size: 10, text: "Included files:" });
  y -= 16;
  out.push({ x, y, size: 10, text: "• Summary (CSV + PDF)" });
  y -= 14;
  out.push({ x, y, size: 10, text: "• Detail (CSV + PDF)" });
  y -= 14;
  out.push({ x, y, size: 10, text: "• Manifest JSON" });
  y -= 28;

  out.push({ x, y, size: 8, text: "Audit note: This bundle is snapshot-backed from a locked payroll run." });

  return buildPdf(out);
}
