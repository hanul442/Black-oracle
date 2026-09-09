begin;

revoke update, delete, truncate on table public.black_oracle_events from service_role;
revoke update, delete, truncate on table public.black_oracle_events from authenticated;
revoke update, delete, truncate on table public.black_oracle_events from anon;

grant select, insert on table public.black_oracle_events to service_role;

commit;
