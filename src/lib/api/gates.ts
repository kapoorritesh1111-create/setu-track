// src/lib/api/gates.ts
// Server-only authz gates for API route handlers.

import { supabaseService } from "../supabaseServer";

export type GateOk<TProfile extends Record<string, any>> = {
  ok: true;
  supa: ReturnType<typeof supabaseService>;
  profile: TProfile;
};

export type GateFail = {
  ok: false;
  status: number;
  error: string;
};

function bearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

export async function requireRole<TProfile extends Record<string, any> = any>(
  req: Request,
  roles: string[],
  profileSelect = "id, org_id, role"
): Promise<GateOk<TProfile> | GateFail> {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, error: "Missing auth token" };

  const supa = supabaseService();

  const { data: caller, error: callerErr } = await supa.auth.getUser(token);
  if (callerErr || !caller?.user) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: profRaw, error: profErr } = await supa
    .from("profiles")
    .select(profileSelect)
    .eq("id", caller.user.id)
    .maybeSingle();

  if (profErr) return { ok: false, status: 400, error: profErr.message };

  // Supabase typings can vary based on generated types; treat profile row as unknown here.
  const prof = profRaw as any;
  if (!prof?.org_id) return { ok: false, status: 403, error: "No org" };
  if (!roles.includes(String(prof.role))) return { ok: false, status: 403, error: "Forbidden" };

  return { ok: true, supa, profile: prof as unknown as TProfile };
}

export async function requireAdmin(req: Request) {
  // Include full_name for audit receipts and export event snapshots.
  return requireRole(req, ["admin"], "id, org_id, role, full_name");
}

export async function requireManagerOrAdmin(req: Request) {
  return requireRole(req, ["admin", "manager"], "id, org_id, role, full_name");
}
