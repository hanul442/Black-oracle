-- BLACK ORACLE S1R2 scheduler transport hardening.
-- Operational control-plane change only. This script does NOT modify the S1R2
-- checkpoint, strategy, risk configuration, qualification identity, or sample data.
--
-- Purpose:
--   Align pg_net's outer timeout with the scheduler Edge Function's 120s
--   downstream budget so a committed Paper cycle is not reported as failed solely
--   because the old 55s transport timeout expires during post-checkpoint work.

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.black_oracle_trading_scheduler_config
    WHERE runtime_id = 'black-oracle-paper-vnext-s1r2'
      AND enabled = true
      AND target_base_url = 'https://black-oracle-paper-vnext-production.up.railway.app'
  ) THEN
    RAISE EXCEPTION 'S1R2 scheduler config is not enabled on the approved Railway target';
  END IF;

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'black-oracle-paper-vnext-s1r2-scheduler-15m'
    AND active = true;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Active S1R2 scheduler cron job is missing';
  END IF;

  PERFORM cron.alter_job(
    job_id := v_job_id,
    command := $job$
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
        timeout_milliseconds := 120000
      ) as request_id;
    $job$
  );
END $$;

DO $$
DECLARE
  v_command text;
BEGIN
  SELECT command INTO v_command
  FROM cron.job
  WHERE jobname = 'black-oracle-paper-vnext-s1r2-scheduler-15m'
    AND active = true;

  IF v_command IS NULL OR position('timeout_milliseconds := 120000' in v_command) = 0 THEN
    RAISE EXCEPTION 'S1R2 scheduler timeout hardening verification failed';
  END IF;
END $$;
