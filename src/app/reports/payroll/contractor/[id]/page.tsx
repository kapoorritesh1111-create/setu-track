import { Suspense } from "react";
import PrintClient from "./printClient";

export const dynamic = "force-dynamic";

export default function ContractorPayrollPrintPage() {
  return (
    <Suspense fallback={<div className="pageShell"><div className="card">Loading…</div></div>}>
      <PrintClient />
    </Suspense>
  );
}
