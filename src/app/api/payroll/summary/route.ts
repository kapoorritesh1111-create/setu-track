// src/app/api/payroll/summary/route.ts
import { NextResponse } from "next/server";
import { requireManagerOrAdmin } from "../../../../lib/api/gates";

type ProjectExportRow = {
  id: string;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  total_amount: number | null;
  paid_at: string | null;
  paid_by: string | null;
  paid_note: string | null;
};

type ProjectRow = {
  id: string;
  name: string | null;
  updated_at: string | null;
  project_exports?: ProjectExportRow[] | null;
};

export async function GET(req: Request) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
    }

    const { supa, profile } = gate;

    const { data, error } = await supa
      .from("projects")
      .select(
        "id,name,updated_at, project_exports:project_exports(id,created_at,period_start,period_end,total_amount,paid_at,paid_by,paid_note)"
      )
      .eq("org_id", profile.org_id)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const rows = ((data || []) as ProjectRow[]).map((project) => {
      const exports = Array.isArray(project.project_exports) ? project.project_exports : [];
      const latest = exports
        .slice()
        .sort((a, b) => {
          const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bd - ad;
        })[0];

      return {
        id: project.id,
        project_id: project.id,
        project_name: project.name || "Untitled Project",
        period_start: latest?.period_start || "",
        period_end: latest?.period_end || "",
        total_hours: 0,
        total_amount: Number(latest?.total_amount || 0),
        receipts: exports.map((ex) => ({
          id: ex.id,
          org_id: profile.org_id,
          created_at: ex.created_at,
          created_by: ex.paid_by,
          actor_name: null,
          type: "project_export",
          label:
            ex.period_start && ex.period_end
              ? `Project Export • ${ex.period_start} → ${ex.period_end}`
              : "Project Export",
          project_id: project.id,
          payroll_run_id: null,
          project_export_id: ex.id,
          payload_hash: null,
          diff_status: "unknown" as const,
          meta: {
            paid_at: ex.paid_at,
            paid_by: ex.paid_by,
            paid_note: ex.paid_note,
          },
        })),
      };
    });

    return NextResponse.json({ ok: true, rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
