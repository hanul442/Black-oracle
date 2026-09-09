update public.nars_sources
set enabled = false,
    metadata = metadata || jsonb_build_object(
      'shadow_direct_disabled', true,
      'shadow_direct_disabled_reason', 'supabase_runtime_http_403',
      'shadow_direct_disabled_at', now()
    ),
    updated_at = now()
where source_key = 'direct:hankyung:all';

insert into public.nars_system_meta(key, value, updated_at)
values (
  'shadow_poller',
  jsonb_build_object(
    'enabled', true,
    'runner', 'supabase_fallback',
    'schedule', '*/10 * * * *',
    'max_items_per_source', 8,
    'sources', jsonb_build_array('direct:khan:all','direct:mk:all','direct:donga:all'),
    'excluded_sources', jsonb_build_object('direct:hankyung:all','supabase_runtime_http_403'),
    'temporary_until', 'cloudflare_collector_deployed'
  ),
  now()
)
on conflict (key) do update
set value = excluded.value, updated_at = now();
