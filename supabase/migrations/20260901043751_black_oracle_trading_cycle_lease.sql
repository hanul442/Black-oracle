-- Distributed lease for scheduled Black Oracle Paper cycles.
-- Prevents overlapping Vercel cron invocations from processing the same runtime twice.

create table if not exists public.black_oracle_trading_cycle_leases (
  runtime_id text primary key,
  lease_owner text not null,
  lease_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.black_oracle_trading_cycle_leases enable row level security;
revoke all on table public.black_oracle_trading_cycle_leases from public, anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_trading_cycle_leases to service_role;

create or replace function public.claim_black_oracle_trading_cycle_lease(
  p_runtime_id text,
  p_owner text,
  p_lease_seconds integer default 840
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  acquired boolean := false;
begin
  if p_runtime_id is null or length(trim(p_runtime_id)) = 0 then
    raise exception 'runtime id is required';
  end if;
  if p_owner is null or length(trim(p_owner)) = 0 then
    raise exception 'lease owner is required';
  end if;
  if p_lease_seconds < 60 or p_lease_seconds > 1800 then
    raise exception 'lease seconds must be between 60 and 1800';
  end if;

  insert into public.black_oracle_trading_cycle_leases(runtime_id, lease_owner, lease_until, updated_at)
  values (p_runtime_id, p_owner, now() + make_interval(secs => p_lease_seconds), now())
  on conflict (runtime_id) do update
    set lease_owner = excluded.lease_owner,
        lease_until = excluded.lease_until,
        updated_at = now()
    where public.black_oracle_trading_cycle_leases.lease_until <= now()
       or public.black_oracle_trading_cycle_leases.lease_owner = excluded.lease_owner
  returning true into acquired;

  return coalesce(acquired, false);
end;
$$;

create or replace function public.release_black_oracle_trading_cycle_lease(
  p_runtime_id text,
  p_owner text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  released boolean := false;
begin
  delete from public.black_oracle_trading_cycle_leases
   where runtime_id = p_runtime_id
     and lease_owner = p_owner
  returning true into released;
  return coalesce(released, false);
end;
$$;

revoke all on function public.claim_black_oracle_trading_cycle_lease(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_black_oracle_trading_cycle_lease(text, text) from public, anon, authenticated;
grant execute on function public.claim_black_oracle_trading_cycle_lease(text, text, integer) to service_role;
grant execute on function public.release_black_oracle_trading_cycle_lease(text, text) to service_role;

comment on table public.black_oracle_trading_cycle_leases is
  'Short-lived server-side leases preventing overlapping scheduled Paper Trading cycles.';
