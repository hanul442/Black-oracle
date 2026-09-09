-- Corrective grant hardening for environments where service_role inherited
-- default table privileges before the research tables were created.

revoke all on table public.research_feature_observations from anon, authenticated, public, service_role;
revoke all on table public.research_feature_outcomes from anon, authenticated, public, service_role;

grant select, insert on table public.research_feature_observations to service_role;
grant select, insert on table public.research_feature_outcomes to service_role;
