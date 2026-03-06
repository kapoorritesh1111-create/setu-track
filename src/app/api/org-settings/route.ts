import { NextResponse } from "next/server";
import { requireRole } from "../../../lib/api/gates";

export const runtime = "nodejs";

const SELECT =
  "org_id, company_name, legal_name, logo_url, accent_color, invoice_header_json, invoice_footer_text, default_currency, updated_at, updated_by";

export async function GET(req: Request) {
  const gate = await requireRole(req, ["admin", "manager", "contractor"], "id, org_id, role");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { data, error } = await gate.supa
    .from("org_settings")
    .select(SELECT)
    .eq("org_id", gate.profile.org_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    settings: data ?? {
      org_id: gate.profile.org_id,
      company_name: "",
      legal_name: "",
      logo_url: null,
      accent_color: "blue",
      invoice_header_json: {},
      invoice_footer_text: "",
      default_currency: "USD",
      updated_at: null,
      updated_by: null,
    },
  });
}
