-- Runtime-scoped NARS delivery fan-out.
-- Existing rows are marked legacy-shared because historical ownership cannot be reconstructed reliably.

alter table public.black_oracle_nars_inbox
  add column if not exists runtime_id text;

update public.black_oracle_nars_inbox
set runtime_id = 'legacy-shared'
where runtime_id is null;

alter table public.black_oracle_nars_inbox
  alter column runtime_id set not null;

alter table public.black_oracle_nars_inbox
  drop constraint if exists black_oracle_nars_inbox_outbox_id_key;

alter table public.black_oracle_nars_inbox
  drop constraint if exists black_oracle_nars_inbox_runtime_outbox_key;

alter table public.black_oracle_nars_inbox
  add constraint black_oracle_nars_inbox_runtime_outbox_key unique(runtime_id, outbox_id);

create index if not exists black_oracle_nars_inbox_runtime_status_idx
  on public.black_oracle_nars_inbox(runtime_id, status, received_at desc);

alter table public.black_oracle_external_evidence
  add column if not exists runtime_id text;

update public.black_oracle_external_evidence
set runtime_id = 'legacy-shared'
where runtime_id is null;

alter table public.black_oracle_external_evidence
  alter column runtime_id set not null;

create index if not exists black_oracle_external_evidence_runtime_market_expiry_idx
  on public.black_oracle_external_evidence(runtime_id, market, expires_at desc);

create or replace function public.black_oracle_nars_delivery_candidates(
  p_runtime_id text,
  p_limit integer default 12
)
returns table(id uuid, event_id uuid, payload jsonb, attempts integer)
language sql
stable
set search_path = ''
as $$
  with runtime_start as (
    select coalesce(
      (select r.created_at from public.black_oracle_trading_runtime r where r.runtime_id = p_runtime_id limit 1),
      now() - interval '15 minutes'
    ) as started_at
  )
  select o.id, o.event_id, o.payload, o.attempts
  from public.nars_intel_outbox o
  cross join runtime_start rs
  where o.destination = 'black_oracle'
    and o.status in ('pending','sent')
    and o.available_at <= now()
    and o.created_at >= rs.started_at
    and not exists (
      select 1
      from public.black_oracle_nars_inbox i
      where i.runtime_id = p_runtime_id
        and i.outbox_id = o.id
    )
  order by o.created_at asc
  limit greatest(1, least(coalesce(p_limit,12),50));
$$;

revoke all on function public.black_oracle_nars_delivery_candidates(text,integer) from public, anon, authenticated;
grant execute on function public.black_oracle_nars_delivery_candidates(text,integer) to service_role;

comment on function public.black_oracle_nars_delivery_candidates(text,integer) is
  'Per-runtime NARS delivery fan-out. A packet may be independently observed by qualification and shadow runtimes without one runtime consuming it for the others.';
