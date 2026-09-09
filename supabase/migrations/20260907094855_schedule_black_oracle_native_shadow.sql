-- Recovered from production migration history during S0 source-truth convergence.
-- LEGACY_SHADOW only: this scheduler does not define the canonical Railway Paper runtime.

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'black-oracle-native-shadow-15m' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'black-oracle-native-shadow-15m',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'black_oracle_project_url') || '/functions/v1/black-oracle-native-paper-shadow',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'black_oracle_anon_key')
    ),
    body := jsonb_build_object('action', 'scheduled-native-shadow', 'scheduled_at', now()),
    timeout_milliseconds := 120000
  ) as request_id;
  $job$
);
