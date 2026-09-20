-- BLACK ORACLE report-first shadow persistence.
-- Additive only. No billing, execution, Paper or AutoTrade authority is granted.

create table if not exists public.black_oracle_reports (
  report_id text not null,
  version integer not null check (version > 0),
  report_type text not null check (report_type in ('MARKET','INDUSTRY','SECTOR','COMPANY','SECURITY','EVENT','CRYPTO')),
  subject_id text not null,
  status text not null check (status in ('PUBLISHED','CORRECTED')),
  as_of timestamptz not null,
  evidence_cutoff timestamptz not null,
  created_at timestamptz not null,
  published_at timestamptz not null,
  grade text,
  confidence double precision check (confidence is null or (confidence >= 0 and confidence <= 1)),
  one_line_assessment text not null,
  payload jsonb not null,
  recorded_at timestamptz not null default now(),
  primary key (report_id, version)
);

create table if not exists public.black_oracle_analyst_reviews (
  review_id text primary key,
  report_id text not null,
  report_version integer not null,
  analyst_id text not null,
  method_version text not null,
  prompt_version text not null,
  as_of timestamptz not null,
  knowledge_cutoff timestamptz not null,
  stance text not null,
  confidence double precision check (confidence is null or (confidence >= 0 and confidence <= 1)),
  payload jsonb not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.black_oracle_debate_sessions (
  debate_id text primary key,
  report_id text not null,
  report_version integer not null,
  triggered boolean not null,
  trigger_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  payload jsonb not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.black_oracle_lead_syntheses (
  synthesis_id text primary key,
  report_id text not null,
  report_version integer not null,
  lead_analyst_id text not null,
  as_of timestamptz not null,
  grade text,
  confidence double precision check (confidence is null or (confidence >= 0 and confidence <= 1)),
  one_line_assessment text not null,
  payload jsonb not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.black_oracle_report_forecasts (
  forecast_id text primary key,
  report_id text not null,
  report_version integer not null,
  published_at timestamptz not null,
  as_of timestamptz not null,
  horizon_end_at timestamptz,
  status text not null check (status in ('ACTIVE','MATURED','INVALIDATED','UNAVAILABLE')),
  payload jsonb not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.black_oracle_forecast_evaluations (
  evaluation_id text primary key,
  forecast_id text not null,
  evaluated_at timestamptz not null,
  payload jsonb not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.black_oracle_credit_ledger_shadow (
  entry_id text primary key,
  account_id text not null,
  bucket text not null check (bucket in ('RECURRING_PLAN','PROMOTIONAL','PURCHASED')),
  kind text not null check (kind in ('GRANT','PURCHASE','RESERVE','DEBIT','RELEASE','REVERSAL','ADJUSTMENT')),
  credits integer not null check (credits >= 0 and mod(credits, 100) = 0),
  action_type text,
  quote_id text,
  job_id text,
  related_entry_id text,
  occurred_at timestamptz not null,
  reason text not null,
  recorded_at timestamptz not null default now()
);

create index if not exists black_oracle_reports_subject_time_idx
  on public.black_oracle_reports(subject_id, published_at desc);
create index if not exists black_oracle_reports_type_time_idx
  on public.black_oracle_reports(report_type, published_at desc);
create index if not exists black_oracle_analyst_reviews_report_idx
  on public.black_oracle_analyst_reviews(report_id, report_version);
create index if not exists black_oracle_debate_sessions_report_idx
  on public.black_oracle_debate_sessions(report_id, report_version);
create index if not exists black_oracle_lead_syntheses_report_idx
  on public.black_oracle_lead_syntheses(report_id, report_version);
create index if not exists black_oracle_report_forecasts_report_idx
  on public.black_oracle_report_forecasts(report_id, report_version);
create index if not exists black_oracle_forecast_eval_forecast_idx
  on public.black_oracle_forecast_evaluations(forecast_id, evaluated_at desc);
create index if not exists black_oracle_credit_shadow_account_time_idx
  on public.black_oracle_credit_ledger_shadow(account_id, occurred_at desc);

alter table public.black_oracle_reports enable row level security;
alter table public.black_oracle_analyst_reviews enable row level security;
alter table public.black_oracle_debate_sessions enable row level security;
alter table public.black_oracle_lead_syntheses enable row level security;
alter table public.black_oracle_report_forecasts enable row level security;
alter table public.black_oracle_forecast_evaluations enable row level security;
alter table public.black_oracle_credit_ledger_shadow enable row level security;

revoke all on table public.black_oracle_reports from anon, authenticated, public, service_role;
revoke all on table public.black_oracle_analyst_reviews from anon, authenticated, public, service_role;
revoke all on table public.black_oracle_debate_sessions from anon, authenticated, public, service_role;
revoke all on table public.black_oracle_lead_syntheses from anon, authenticated, public, service_role;
revoke all on table public.black_oracle_report_forecasts from anon, authenticated, public, service_role;
revoke all on table public.black_oracle_forecast_evaluations from anon, authenticated, public, service_role;
revoke all on table public.black_oracle_credit_ledger_shadow from anon, authenticated, public, service_role;

grant select, insert on table public.black_oracle_reports to service_role;
grant select, insert on table public.black_oracle_analyst_reviews to service_role;
grant select, insert on table public.black_oracle_debate_sessions to service_role;
grant select, insert on table public.black_oracle_lead_syntheses to service_role;
grant select, insert on table public.black_oracle_report_forecasts to service_role;
grant select, insert on table public.black_oracle_forecast_evaluations to service_role;
grant select, insert on table public.black_oracle_credit_ledger_shadow to service_role;

create or replace function public.black_oracle_report_first_reject_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'BLACK ORACLE report-first canonical/shadow ledgers are append-only; UPDATE/DELETE is prohibited';
end;
$$;

revoke all on function public.black_oracle_report_first_reject_mutation() from public, anon, authenticated;
grant execute on function public.black_oracle_report_first_reject_mutation() to service_role;

drop trigger if exists black_oracle_reports_append_only on public.black_oracle_reports;
create trigger black_oracle_reports_append_only
before update or delete on public.black_oracle_reports
for each row execute function public.black_oracle_report_first_reject_mutation();

drop trigger if exists black_oracle_analyst_reviews_append_only on public.black_oracle_analyst_reviews;
create trigger black_oracle_analyst_reviews_append_only
before update or delete on public.black_oracle_analyst_reviews
for each row execute function public.black_oracle_report_first_reject_mutation();

drop trigger if exists black_oracle_debate_sessions_append_only on public.black_oracle_debate_sessions;
create trigger black_oracle_debate_sessions_append_only
before update or delete on public.black_oracle_debate_sessions
for each row execute function public.black_oracle_report_first_reject_mutation();

drop trigger if exists black_oracle_lead_syntheses_append_only on public.black_oracle_lead_syntheses;
create trigger black_oracle_lead_syntheses_append_only
before update or delete on public.black_oracle_lead_syntheses
for each row execute function public.black_oracle_report_first_reject_mutation();

drop trigger if exists black_oracle_report_forecasts_append_only on public.black_oracle_report_forecasts;
create trigger black_oracle_report_forecasts_append_only
before update or delete on public.black_oracle_report_forecasts
for each row execute function public.black_oracle_report_first_reject_mutation();

drop trigger if exists black_oracle_forecast_evaluations_append_only on public.black_oracle_forecast_evaluations;
create trigger black_oracle_forecast_evaluations_append_only
before update or delete on public.black_oracle_forecast_evaluations
for each row execute function public.black_oracle_report_first_reject_mutation();

drop trigger if exists black_oracle_credit_ledger_shadow_append_only on public.black_oracle_credit_ledger_shadow;
create trigger black_oracle_credit_ledger_shadow_append_only
before update or delete on public.black_oracle_credit_ledger_shadow
for each row execute function public.black_oracle_report_first_reject_mutation();

comment on table public.black_oracle_reports is
  'Versioned Report-first publication commit records. Child research artifacts are appended first; no execution authority.';
comment on table public.black_oracle_lead_syntheses is
  'Append-only Domain Lead synthesis artifacts for Report-first research.';
comment on table public.black_oracle_credit_ledger_shadow is
  'Shadow Credit accounting ledger only. Not billing authority.';
