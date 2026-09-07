-- NARS v4 N4-10 calibration view / RPC security hardening
-- Production migration version: 20260907111631

alter view public.nars_legacy_comparator_metrics_v1 set (security_invoker=true);
alter view public.nars_evidence_promotion_queue_v1 set (security_invoker=true);
alter view public.nars_calibration_metrics_v1 set (security_invoker=true);
alter view public.nars_cutover_readiness_v1 set (security_invoker=true);

revoke all on
  public.nars_legacy_comparator_metrics_v1,
  public.nars_evidence_promotion_queue_v1,
  public.nars_calibration_metrics_v1,
  public.nars_cutover_readiness_v1
from public, anon, authenticated;

grant select on
  public.nars_legacy_comparator_metrics_v1,
  public.nars_evidence_promotion_queue_v1,
  public.nars_calibration_metrics_v1,
  public.nars_cutover_readiness_v1
to service_role;

revoke execute on function public.nars_refresh_calibration_samples(integer) from public, anon, authenticated;
revoke execute on function public.nars_label_calibration_sample(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.nars_run_calibration() from public, anon, authenticated;

grant execute on function public.nars_refresh_calibration_samples(integer) to service_role;
grant execute on function public.nars_label_calibration_sample(uuid,text,text,text) to service_role;
grant execute on function public.nars_run_calibration() to service_role;
