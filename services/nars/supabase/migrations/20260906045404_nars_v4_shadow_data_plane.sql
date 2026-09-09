alter table public.nars_documents
  add column if not exists ingest_origin text not null default 'collector',
  add column if not exists legacy_ref text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nars_documents_ingest_origin_check'
      and conrelid = 'public.nars_documents'::regclass
  ) then
    alter table public.nars_documents
      add constraint nars_documents_ingest_origin_check
      check (ingest_origin in ('collector','v3_shadow','manual'));
  end if;
end $$;

create index if not exists nars_documents_origin_retrieved_idx
  on public.nars_documents (ingest_origin, retrieved_at desc);
create index if not exists nars_documents_published_at_idx
  on public.nars_documents (published_at desc nulls last);
create index if not exists nars_documents_source_published_idx
  on public.nars_documents (source_id, published_at desc nulls last);

create or replace view public.nars_live_wire_v1
with (security_invoker = true) as
select
  d.id,
  d.published_at,
  d.retrieved_at,
  d.title,
  d.canonical_url,
  d.language,
  d.is_breaking,
  d.ingest_origin,
  d.legacy_ref,
  s.source_key,
  s.name as source_name,
  s.source_type,
  s.tier as source_tier,
  s.health_status as source_health,
  ev.event_id,
  ev.event_title,
  ev.event_status,
  ev.priority_score,
  ev.evidence_grade
from public.nars_documents d
join public.nars_sources s on s.id = d.source_id
left join lateral (
  select
    e.id as event_id,
    e.title as event_title,
    e.status as event_status,
    e.priority_score,
    e.evidence_grade
  from public.nars_event_documents ed
  join public.nars_events e on e.id = ed.event_id
  where ed.document_id = d.id
  order by e.last_updated_at desc
  limit 1
) ev on true;

revoke all on public.nars_live_wire_v1 from anon, authenticated;
grant select on public.nars_live_wire_v1 to service_role;

insert into public.nars_system_meta(key, value, updated_at)
values ('schema_version', '{"version":"4.0.0-shadow","sprint":"N4-02"}'::jsonb, now())
on conflict (key) do update
set value = excluded.value, updated_at = now();
