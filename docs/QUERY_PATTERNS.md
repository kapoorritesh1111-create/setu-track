# Query Patterns

## Goal
Keep page queries predictable, schema-safe, and easy to debug.

## Rules
1. Prefer dedicated query modules in `src/lib/data/*` for high-risk or multi-source pages.
2. Always select explicit columns. Avoid `select('*')` on production surfaces.
3. Normalize nullable values before rendering.
4. Map schema-specific names once in the data layer and keep page components focused on display logic.
5. When a page combines multiple queries, resolve them in one shared loader function instead of scattering `Promise.all` logic inside JSX-heavy files.

## Example pattern
```ts
export async function getActivityData(client, orgId) {
  const auditQuery = client
    .from("audit_log")
    .select("id,action,entity_type,entity_id,created_at,actor_id,metadata")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(40)

  const exportQuery = client
    .from("export_events")
    .select("id,export_type,file_format,scope,created_at,period_start,period_end,metadata")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20)

  const runQuery = client
    .from("payroll_runs")
    .select("id,created_at,period_start,period_end,status,total_amount")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20)

  const [auditRes, exportRes, runRes] = await Promise.all([auditQuery, exportQuery, runQuery])
  if (auditRes.error || exportRes.error || runRes.error) {
    throw new Error(auditRes.error?.message || exportRes.error?.message || runRes.error?.message || "Failed to load activity")
  }

  return {
    auditRows: auditRes.data || [],
    exportRows: exportRes.data || [],
    runRows: runRes.data || [],
  }
}
```
