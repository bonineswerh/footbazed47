revoke all on table public.admin_audit_logs from service_role;
grant select, insert on table public.admin_audit_logs to service_role;

revoke all on sequence public.admin_audit_logs_id_seq from service_role;
grant usage, select on sequence public.admin_audit_logs_id_seq to service_role;
