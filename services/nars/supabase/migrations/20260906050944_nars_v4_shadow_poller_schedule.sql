do $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'nars_shadow_poller_token'
  order by created_at desc
  limit 1;

  if v_secret is null then
    v_secret := encode(gen_random_bytes(32), 'hex');
    perform vault.create_secret(
      v_secret,
      'nars_shadow_poller_token',
      'NARS v4 N4-02 temporary Supabase shadow poller cron token',
      null
    );
  end if;

  insert into public.nars_system_meta(key, value, updated_at)
  values (
    'shadow_poller_token_hash',
    jsonb_build_object('sha256', encode(digest(v_secret, 'sha256'), 'hex')),
    now()
  )
  on conflict (key) do update
  set value = excluded.value, updated_at = now();
end $$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'nars-shadow-poll-10m') then
    perform cron.unschedule('nars-shadow-poll-10m');
  end if;
end $$;

select cron.schedule(
  'nars-shadow-poll-10m',
  '*/10 * * * *',
  $cron$
    select net.http_post(
      'https://dzbsxxoumlylyfhtmjnk.supabase.co/functions/v1/nars-shadow-poll',
      '{}'::jsonb,
      '{}'::jsonb,
      jsonb_build_object(
        'Content-Type', 'application/json',
        'x-nars-cron-token', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'nars_shadow_poller_token'
          order by created_at desc
          limit 1
        )
      ),
      60000
    );
  $cron$
);

insert into public.nars_system_meta(key, value, updated_at)
values (
  'shadow_poller',
  jsonb_build_object(
    'enabled', true,
    'runner', 'supabase_fallback',
    'schedule', '*/10 * * * *',
    'max_items_per_source', 8,
    'sources', jsonb_build_array('direct:khan:all','direct:mk:all','direct:donga:all','direct:hankyung:all'),
    'temporary_until', 'cloudflare_collector_deployed'
  ),
  now()
)
on conflict (key) do update
set value = excluded.value, updated_at = now();
