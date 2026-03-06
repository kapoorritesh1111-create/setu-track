// src/lib/exports/logExportEvent.ts
// Best-effort export receipt logging. Do not block downloads if logging fails.

import { supabaseService } from "../supabaseServer";

export type ExportEventInput = {
  org_id: string;
  run_id?: string | null;
  project_export_id?: string | null;
  actor_id: string;
  actor_name_snapshot?: string | null;
  export_type: string;
  file_format: "csv" | "pdf" | "zip";
  scope: "org" | "run" | "project";
  project_id?: string | null;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  metadata?: Record<string, any>;
};

export async function logExportEvent(input: ExportEventInput) {
  try {
    const supa = supabaseService();
    await supa.from("export_events").insert({
      org_id: input.org_id,
      run_id: input.run_id ?? null,
      project_export_id: input.project_export_id ?? null,
      actor_id: input.actor_id,
      actor_name_snapshot: input.actor_name_snapshot ?? null,
      export_type: input.export_type,
      file_format: input.file_format,
      scope: input.scope,
      project_id: input.project_id ?? null,
      period_start: input.period_start,
      period_end: input.period_end,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Intentionally swallow errors.
  }
}
