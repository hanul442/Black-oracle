-- BLACK ORACLE S1R2 qualification runtime activation.
-- Operational configuration only; no schema DDL.
-- Fail-closed: this script may run only against the exact pristine S1R2 checkpoint.
-- S1R1 remains frozen and must not be resumed or mutated by this script.
--
-- runtime_id: black-oracle-paper-vnext-s1r2
-- qualification_id: paper-100m-20260909-s1r2
-- qualification_armed_at: 2026-09-09T11:57:01.975Z
-- system_revision: 7c5bfd09297ad8497312b372f60386aeb7cfedcd
-- strategy_version: BO-UNIFIED-v0.2.0
-- risk_config_hash: 0f6ae8c3cb3d6d93
-- initial_equity_krw: 100000000

do $$
declare
  v_checkpoint jsonb;
  v_reason text;
begin
  select checkpoint, reason
    into v_checkpoint, v_reason
  from public.black_oracle_trading_runtime
  where runtime_id = 'black-oracle-paper-vnext-s1r2';

  if v_checkpoint is null then
    raise exception 'S1R2 qualification checkpoint is missing';
  end if;
  if v_reason <> 'qualification-runtime-initialized' then
    raise exception 'S1R2 qualification checkpoint is not pristine: reason=%', v_reason;
  end if;

  if v_checkpoint #>> '{runtime,runtimeId}' <> 'black-oracle-paper-vnext-s1r2' then
    raise exception 'S1R2 runtime identity mismatch';
  end if;
  if v_checkpoint #>> '{runtime,qualificationId}' <> 'paper-100m-20260909-s1r2' then
    raise exception 'S1R2 qualification id mismatch';
  end if;
  if v_checkpoint #>> '{runtime,qualificationArmedAt}' <> '2026-09-09T11:57:01.975Z' then
    raise exception 'S1R2 qualification armed timestamp mismatch';
  end if;
  if v_checkpoint #>> '{runtime,systemRevision}' <> '7c5bfd09297ad8497312b372f60386aeb7cfedcd' then
    raise exception 'S1R2 system revision mismatch';
  end if;
  if v_checkpoint #>> '{runtime,strategyVersion}' <> 'BO-UNIFIED-v0.2.0' then
    raise exception 'S1R2 strategy version mismatch';
  end if;
  if v_checkpoint #>> '{runtime,riskConfigHash}' <> '0f6ae8c3cb3d6d93' then
    raise exception 'S1R2 risk configuration hash mismatch';
  end if;
  if (v_checkpoint #>> '{runtime,initialEquityKrw}')::numeric <> 100000000 then
    raise exception 'S1R2 checkpoint identity initial equity is not 100m KRW';
  end if;

  if (v_checkpoint #>> '{session,portfolio,initialEquity}')::numeric <> 100000000 then
    raise exception 'S1R2 portfolio initial equity is not 100m KRW';
  end if;
  if (v_checkpoint #>> '{session,portfolio,cash}')::numeric <> 100000000 then
    raise exception 'S1R2 pristine cash is not 100m KRW';
  end if;
  if jsonb_array_length(coalesce(v_checkpoint #> '{session,portfolio,positions}', '[]'::jsonb)) <> 0 then
    raise exception 'S1R2 checkpoint already has positions';
  end if;
  if jsonb_array_length(coalesce(v_checkpoint #> '{session,closedTrades}', '[]'::jsonb)) <> 0 then
    raise exception 'S1R2 checkpoint already has closed trades';
  end if;
  if jsonb_array_length(coalesce(v_checkpoint #> '{session,ledger}', '[]'::jsonb)) <> 0 then
    raise exception 'S1R2 checkpoint already has trading ledger events';
  end if;
  if jsonb_array_length(coalesce(v_checkpoint #> '{evidence}', '[]'::jsonb)) <> 0 then
    raise exception 'S1R2 checkpoint already has runtime evidence';
  end if;
  if coalesce((v_checkpoint #>> '{loop,cycleCount}')::integer, -1) <> 0 then
    raise exception 'S1R2 checkpoint already has completed cycles';
  end if;
  if coalesce(v_checkpoint #> '{loop,lastCycle}', 'null'::jsonb) <> 'null'::jsonb then
    raise exception 'S1R2 checkpoint already has a last cycle';
  end if;
  if coalesce((v_checkpoint #>> '{loop,running}')::boolean, true) then
    raise exception 'S1R2 checkpoint loop is already running';
  end if;

  if exists (
    select 1 from cron.job
    where jobname = 'black-oracle-paper-vnext-s1r2-scheduler-15m'
  ) then
    raise exception 'S1R2 scheduler cron already exists; activation must not overwrite it';
  end if;

  if exists (
    select 1 from cron.job
    where jobname = 'black-oracle-paper-vnext-scheduler-15m'
  ) then
    raise exception 'S1R1 scheduler cron still exists; S1R2 activation refused';
  end if;

  if exists (
    select 1
    from public.black_oracle_trading_scheduler_config
    where runtime_id = 'black-oracle-paper-vnext'
      and enabled = true
  ) then
    raise exception 'S1R1 scheduler config is enabled; S1R2 activation refused';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from public.black_oracle_scheduler_auth
    where runtime_id = 'black-oracle-paper-vnext-s1r2'
      and scheduler_token is not null
      and length(scheduler_token) >= 32
  ) then
    raise exception 'S1R2 scheduler auth token is unavailable';
  end if;

  if not exists (
    select 1
    from public.black_oracle_trading_scheduler_config
    where runtime_id = 'black-oracle-paper-vnext-s1r2'
      and enabled = false
      and target_base_url = 'https://black-oracle-paper-vnext-production.up.railway.app'
  ) then
    raise exception 'S1R2 scheduler config is not staged in disabled state for the approved Railway target';
  end if;
end $$;

update public.black_oracle_trading_scheduler_config
set enabled = true,
    last_invoked_at = null,
    last_http_status = null,
    last_ok = null,
    last_error = null,
    updated_at = now()
where runtime_id = 'black-oracle-paper-vnext-s1r2'
  and enabled = false
  and target_base_url = 'https://black-oracle-paper-vnext-production.up.railway.app';

do $$
begin
  if not exists (
    select 1
    from public.black_oracle_trading_scheduler_config
    where runtime_id = 'black-oracle-paper-vnext-s1r2'
      and enabled = true
      and target_base_url = 'https://black-oracle-paper-vnext-production.up.railway.app'
  ) then
    raise exception 'S1R2 scheduler config activation failed';
  end if;
end $$;

select cron.schedule(
  'black-oracle-paper-vnext-s1r2-scheduler-15m',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'black_oracle_project_url') || '/functions/v1/black-oracle-paper-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'black_oracle_anon_key')
    ),
    body := jsonb_build_object(
      'runtimeId', 'black-oracle-paper-vnext-s1r2',
      'action', 'cycle',
      'scheduled_at', now()
    ),
    timeout_milliseconds := 55000
  ) as request_id;
  $job$
);

do $$
begin
  if (select count(*) from cron.job where jobname = 'black-oracle-paper-vnext-s1r2-scheduler-15m' and active = true) <> 1 then
    raise exception 'S1R2 scheduler activation did not create exactly one active cron';
  end if;
end $$;
