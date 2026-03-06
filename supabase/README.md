# Supabase (Hosted Cloud) Migration Notes

This repo includes SQL migration files under `supabase/migrations/`.

Because you are using **Supabase Hosted Cloud** (no local CLI), apply migrations via:

**Supabase Dashboard → SQL Editor**

## Apply order (fresh project)
Run these files in order:

1. `0000_extensions.sql`
2. `0001_schema.sql`
3. `0002_constraints.sql`
4. `0003_functions.sql`
5. `0004_triggers.sql`
6. `0005_rls_policies.sql`
7. `0006_views.sql`
8. `0007_indexes.sql`

## Notes
- These scripts assume a **new database**. If you run them against an existing database, you may see errors due to objects already existing.
- The app relies on **RLS** being enabled on core tables. Verify RLS is enabled after running `0005_rls_policies.sql`.

## Verification checks
After applying migrations, verify:

```sql
select schemaname, tablename, policyname, cmd from pg_policies where schemaname='public' order by tablename, policyname;
```

```sql
select viewname from pg_views where schemaname='public';
```
