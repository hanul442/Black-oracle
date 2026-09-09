begin;

revoke references, trigger on table public.black_oracle_events from service_role;
revoke all privileges on table public.black_oracle_events from authenticated;
revoke all privileges on table public.black_oracle_events from anon;
grant select, insert on table public.black_oracle_events to service_role;

commit;
