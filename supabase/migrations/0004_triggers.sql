-- Triggers
-- Apply after 0003_functions.sql
begin;

drop trigger if exists "trg_profiles_guard_update" on public."profiles";
CREATE TRIGGER trg_profiles_guard_update BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION guard_profiles_update();
drop trigger if exists "trg_profiles_set_updated_at" on public."profiles";
CREATE TRIGGER trg_profiles_set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "set_updated_at_time_entries" on public."time_entries";
CREATE TRIGGER set_updated_at_time_entries BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists "trg_enforce_time_entry_workflow" on public."time_entries";
CREATE TRIGGER trg_enforce_time_entry_workflow BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION enforce_time_entry_workflow();
drop trigger if exists "trg_ensure_snapshot_on_approve" on public."time_entries";
CREATE TRIGGER trg_ensure_snapshot_on_approve BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION ensure_snapshot_on_approve();
drop trigger if exists "trg_prevent_snapshot_change" on public."time_entries";
CREATE TRIGGER trg_prevent_snapshot_change BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION prevent_snapshot_change();
commit;
