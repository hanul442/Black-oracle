-- Keep Strategy Factory research on the isolated S2 runtime instead of the web/legacy runtime.
-- This job is research-only: the Strategy Factory persists experiments and canonical events but
-- has no execution or automatic promotion/deployment authority.
--
-- Re-scheduling the same pg_cron job name replaces its schedule/command without creating a duplicate.
-- Paper trading schedulers are intentionally not modified by this migration.

do $$
begin
  if not exists (
    select 1
    from public.black_oracle_trading_scheduler_config
    where runtime_id = 'black-oracle-paper-s2-shadow'
      and target_base_url is not null
  ) then
    raise exception 'S2 Strategy Factory scheduler target is not configured.';
  end if;

  if not exists (
    select 1
    from public.black_oracle_scheduler_auth
    where runtime_id = 'black-oracle-paper-s2-shadow'
      and scheduler_token is not null
  ) then
    raise exception 'S2 Strategy Factory scheduler token is not configured.';
  end if;

  perform cron.schedule(
    'black-oracle-strategy-factory-daily',
    '10 4 * * *',
    $cron$
      select net.http_post(
        url := (
          select target_base_url
          from public.black_oracle_trading_scheduler_config
          where runtime_id = 'black-oracle-paper-s2-shadow'
        ) || '/api/strategy-factory-cycle',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (
            select scheduler_token
            from public.black_oracle_scheduler_auth
            where runtime_id = 'black-oracle-paper-s2-shadow'
          ),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'market', case extract(isodow from now())::int
            when 1 then 'KRW-BTC'
            when 2 then 'KRW-ETH'
            when 3 then 'KRW-XRP'
            when 4 then 'KRW-SOL'
            when 5 then 'KRW-DOGE'
            when 6 then 'KRW-ADA'
            else 'KRW-WLD'
          end,
          'unit', 60,
          'bars', 1800,
          'candidatesPerGeneration', 24,
          'generations', 3,
          'parentPoolSize', 12,
          'walkForwardFolds', 4,
          'topN', 20
        ),
        timeout_milliseconds := 55000
      );
    $cron$
  );
end
$$;
