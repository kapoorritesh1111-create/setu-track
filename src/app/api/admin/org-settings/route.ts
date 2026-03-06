import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/api/gates";

export const runtime = "nodejs";

const SELECT =
  "org_id, company_name, legal_name, logo_url, accent_color, invoice_header_json, invoice_footer_text, default_currency, updated_at, updated_by";

export async function GET(req: Request) {
  const gate = await requireRole(req, ["admin"], "id, org_id, role");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { data, error } = await gate.supa
    .from("org_settings")
    .select(SELECT)
    .eq("org_id", gate.profile.org_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // If no row exists yet, return defaults (UI can POST to create)
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

export async function POST(req: Request) {
  const gate = await requireRole(req, ["admin"], "id, org_id, role");
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const input = body?.settings || body || {};

  const payload = {
    org_id: gate.profile.org_id,
    company_name: String(input.company_name ?? ""),
    legal_name: String(input.legal_name ?? ""),
    logo_url: input.logo_url ? String(input.logo_url) : null,
    accent_color: String(input.accent_color ?? "blue"),
    invoice_header_json: input.invoice_header_json ?? {},
    invoice_footer_text: String(input.invoice_footer_text ?? ""),
    default_currency: String(input.default_currency ?? "USD"),
    updated_by: gate.profile.id,
  };

  const { data, error } = await gate.supa
    .from("org_settings")
    .upsert(payload, { onConflict: "org_id" })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ settings: data });
}
