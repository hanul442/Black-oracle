-- BLACK ORACLE vNext qualification runtime activation.
-- Operational configuration only; no schema DDL.
-- This script is intentionally fail-closed and may run only after the pristine
-- qualification checkpoint has been verified.

do $$
declare
  v_checkpoint jsonb;
  v_reason text;
begin
  select checkpoint, reason
    into v_checkpoint, v_reason
  from public.black_oracle_trading_runtime
  where runtime_id = 'black-oracle-paper-vnext';

  if v_checkpoint is null then
    raise exception 'vNext qualification checkpoint is missing';
  end if;
  if v_reason <> 'qualification-runtime-initialized' then
    raise exception 'vNext qualification checkpoint is not pristine: reason=%', v_reason;
  end if;
  if v_checkpoint #>> '{runtime,runtimeId}' <> 'black-oracle-paper-vnext' then
    raise exception 'vNext runtime identity mismatch';
  end if;
  if v_checkpoint #>> '{runtime,qualificationId}' <> 'paper-100m-20260909-s1' then
    raise exception 'vNext qualification id mismatch';
  end if;
  if (v_checkpoint #>> '{session,portfolio,initialEquity}')::numeric <> 100000000 then
    raise exception 'vNext initial equity is not 100m KRW';
  end if;
  if (v_checkpoint #>> '{session,portfolio,cash}')::numeric <> 100000000 then
    raise exception 'vNext pristine cash is not 100m KRW';
  end if;
  if jsonb_array_length(coalesce(v_checkpoint #> '{session,portfolio,positions}', '[]'::jsonb)) <> 0 then
    raise exception 'vNext checkpoint already has positions';
  end if;
  if jsonb_array_length(coalesce(v_checkpoint #> '{session,closedTrades}', '[]'::jsonb)) <> 0 then
    raise exception 'vNext checkpoint already has closed trades';
  end if;
  if coalesce((v_checkpoint #>> '{loop,cycleCount}')::integer, -1) <> 0 then
    raise exception 'vNext checkpoint already has completed cycles';
  end if;
  if v_checkpoint #> '{loop,lastCycle}' is not null then
    raise exception 'vNext checkpoint already has a last cycle';
  end if;
end $$;

insert into public.black_oracle_scheduler_auth (runtime_id, scheduler_token, created_at, updated_at)
select 'black-oracle-paper-vnext', scheduler_token, now(), now()
from public.black_oracle_scheduler_auth
where runtime_id = 'black-oracle-paper'
on conflict (runtime_id) do update
set scheduler_token = excluded.scheduler_token,
    updated_at = now();

insert into public.black_oracle_trading_scheduler_config (
  runtime_id,
  enabled,
  target_base_url,
  last_invoked_at,
  last_http_status,
  last_ok,
  last_error,
  updated_at
)
values (
  'black-oracle-paper-vnext',
  true,
  'https://black-oracle-paper-vnext-production.up.railway.app',
  null,
  null,
  null,
  null,
  now()
)
on conflict (runtime_id) do update
set enabled = true,
    target_base_url = excluded.target_base_url,
    updated_at = now();

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'black-oracle-paper-vnext-scheduler-15m'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'black-oracle-paper-vnext-scheduler-15m',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'black_oracle_project_url') || '/functions/v1/black-oracle-paper-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'black_oracle_anon_key')
    ),
    body := jsonb_build_object(
      'runtimeId', 'black-oracle-paper-vnext',
      'action', 'cycle',
      'scheduled_at', now()
    ),
    timeout_milliseconds := 55000
  ) as request_id;
  $job$
);
