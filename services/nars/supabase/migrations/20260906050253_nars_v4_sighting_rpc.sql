create or replace function public.nars_record_sighting(
  p_document_id uuid,
  p_origin text,
  p_seen_at timestamptz default now(),
  p_legacy_ref text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.nars_document_sightings(
    document_id, origin, first_seen_at, last_seen_at, seen_count, legacy_ref, metadata
  )
  values (
    p_document_id, p_origin, p_seen_at, p_seen_at, 1, p_legacy_ref, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (document_id, origin) do update
  set last_seen_at = greatest(public.nars_document_sightings.last_seen_at, excluded.last_seen_at),
      seen_count = public.nars_document_sightings.seen_count + 1,
      legacy_ref = coalesce(public.nars_document_sightings.legacy_ref, excluded.legacy_ref),
      metadata = public.nars_document_sightings.metadata || excluded.metadata;
$$;

revoke all on function public.nars_record_sighting(uuid,text,timestamptz,text,jsonb) from public, anon, authenticated;
grant execute on function public.nars_record_sighting(uuid,text,timestamptz,text,jsonb) to service_role;
