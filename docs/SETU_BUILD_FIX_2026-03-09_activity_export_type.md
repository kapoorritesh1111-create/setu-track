Fixed /admin/activity export event query to match real export_events schema.
- replaced export_events.kind with export_events.export_type
- removed invalid label column assumption
- kept label fallback from metadata.label or export_type
