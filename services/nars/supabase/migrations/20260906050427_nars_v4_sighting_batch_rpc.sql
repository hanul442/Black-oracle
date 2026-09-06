create or replace function public.nars_record_sightings_by_dedup(p_items jsonb)
returns integer
language sql
security definer
set search_path = public
as $$
  with parsed as (
    select distinct on (dedup_key, origin)
      dedup_key,
      origin,
      seen_at,
      legacy_ref,
      metadata
    from (
      select
        nullif(item->>'dedup_key','') as dedup_key,
        nullif(item->>'origin','') as origin,
        coalesce(nullif(item->>'seen_at','')::timestamptz, now()) as seen_at,
        nullif(item->>'legacy_ref','') as legacy_ref,
        coalesce(item->'metadata', '{}'::jsonb) as metadata
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
    ) p
    where dedup_key is not null and origin is not null
    order by dedup_key, origin, seen_at desc
  ),
  resolved as (
    select d.id as document_id, p.origin, p.seen_at, p.legacy_ref, p.metadata
    from parsed p
    join public.nars_documents d on d.dedup_key = p.dedup_key
  ),
  upserted as (
    insert into public.nars_document_sightings(
      document_id, origin, first_seen_at, last_seen_at, seen_count, legacy_ref, metadata
    )
    select document_id, origin, seen_at, seen_at, 1, legacy_ref, metadata
    from resolved
    on conflict (document_id, origin) do update
    set last_seen_at = greatest(public.nars_document_sightings.last_seen_at, excluded.last_seen_at),
        seen_count = public.nars_document_sightings.seen_count + 1,
        legacy_ref = coalesce(public.nars_document_sightings.legacy_ref, excluded.legacy_ref),
        metadata = public.nars_document_sightings.metadata || excluded.metadata
    returning 1
  )
  select count(*)::integer from upserted;
$$;

revoke all on function public.nars_record_sightings_by_dedup(jsonb) from public, anon, authenticated;
grant execute on function public.nars_record_sightings_by_dedup(jsonb) to service_role;
