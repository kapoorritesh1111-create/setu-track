-- Views

create or replace view public."v_time_entries" as
SELECT te.id,
    te.org_id,
    te.user_id,
    te.entry_date,
    te.time_in,
    te.time_out,
    te.lunch_hours,
    te.project_id,
    te.notes,
    te.mileage,
    te.status,
    te.approved_by,
    te.approved_at,
    te.created_at,
    te.updated_at,
    te.hourly_rate_snapshot,
    p.full_name,
    pr.name AS project_name,
        CASE
            WHEN ((te.time_in IS NULL) OR (te.time_out IS NULL)) THEN NULL::numeric
            ELSE GREATEST(((EXTRACT(epoch FROM (te.time_out - te.time_in)) / 3600.0) - COALESCE(te.lunch_hours, (0)::numeric)), (0)::numeric)
        END AS hours_worked
   FROM ((time_entries te
     LEFT JOIN profiles p ON ((p.id = te.user_id)))
     LEFT JOIN projects pr ON ((pr.id = te.project_id)));
;