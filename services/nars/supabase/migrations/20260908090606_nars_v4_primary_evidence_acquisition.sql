create table if not exists public.nars_evidence_acquisition_attempts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.nars_documents(id) on delete cascade,
  event_id uuid not null references public.nars_events(id) on delete cascade,
  authority_key text not null references public.nars_authority_registry(authority_key),
  requested_url text not null,
  final_url text,
  status text not null check(status in ('queued','fetched_unverified','verified','failed','blocked')),
  http_status integer,
  content_type text,
  content_bytes integer check(content_bytes is null or content_bytes>=0),
  text_chars integer check(text_chars is null or text_chars>=0),
  content_hash text,
  title_match numeric check(title_match is null or (title_match>=0 and title_match<=1)),
  redirect_count integer not null default 0 check(redirect_count>=0),
  verification_signals jsonb not null default '{}'::jsonb,
  error_code text,
  error_detail text,
  attempt_no integer not null default 1 check(attempt_no>=1),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists nars_evidence_acquisition_document_idx on public.nars_evidence_acquisition_attempts(document_id,created_at desc);
create index if not exists nars_evidence_acquisition_event_idx on public.nars_evidence_acquisition_attempts(event_id,created_at desc);
create index if not exists nars_evidence_acquisition_status_idx on public.nars_evidence_acquisition_attempts(status,created_at desc);
alter table public.nars_evidence_acquisition_attempts enable row level security;
revoke all on public.nars_evidence_acquisition_attempts from anon,authenticated;
grant all on public.nars_evidence_acquisition_attempts to service_role;

alter table public.nars_intel_outbox add column if not exists dedup_key text;
create unique index if not exists nars_intel_outbox_dedup_key_uidx on public.nars_intel_outbox(dedup_key) where dedup_key is not null;

create or replace view public.nars_evidence_acquisition_queue_v1 as
with latest as (
  select distinct on(a.document_id) a.document_id,a.status,a.attempt_no,a.finished_at,a.error_code
  from public.nars_evidence_acquisition_attempts a
  order by a.document_id,a.created_at desc
)
select q.document_id,q.event_id,q.title,q.canonical_url,q.published_at,q.retrieved_at,q.authority_key,q.publisher_key,
  q.priority_score,q.priority_band,q.evidence_grade,coalesce(l.attempt_no,0)+1 as next_attempt_no,
  l.status as last_status,l.finished_at as last_attempt_at,l.error_code as last_error
from public.nars_evidence_promotion_queue_v1 q
left join latest l on l.document_id=q.document_id
where q.event_id is not null
  and q.promotion_state='NEEDS_CANONICAL_CONTENT'
  and q.canonical_url is not null
  and (l.document_id is null or (l.status<>'verified' and l.attempt_no<5 and coalesce(l.finished_at,now()-interval '1 day')<now()-interval '30 minutes'));
alter view public.nars_evidence_acquisition_queue_v1 set (security_invoker=true);
revoke all on public.nars_evidence_acquisition_queue_v1 from anon,authenticated;
grant select on public.nars_evidence_acquisition_queue_v1 to service_role;

create or replace function public.nars_promote_document_evidence(
  p_document_id uuid,p_event_id uuid,p_final_url text,p_content_hash text,p_content_type text default null,
  p_content_bytes integer default null,p_text_chars integer default null,p_title_match numeric default null,
  p_redirect_count integer default 0,p_signals jsonb default '{}'::jsonb
) returns jsonb language plpgsql set search_path to '' as $$
declare v_doc record; v_match record; v_authority_type text; v_role text; v_artifact_key text; v_attach jsonb; v_artifact_id uuid;
begin
  if p_content_hash is null or lower(btrim(p_content_hash)) !~ '^[0-9a-f]{64}$' then raise exception 'invalid_sha256'; end if;
  if p_final_url is null or p_final_url !~* '^https://' then raise exception 'https_final_url_required'; end if;
  if p_title_match is not null and (p_title_match<0 or p_title_match>1) then raise exception 'invalid_title_match'; end if;
  select d.*,coalesce(d.raw_metadata->>'authority_key',s.metadata->>'authority_key') authority_key,
    coalesce(d.raw_metadata->>'publisher_key',s.metadata->>'publisher_key') publisher_key into v_doc
  from public.nars_documents d join public.nars_sources s on s.id=d.source_id where d.id=p_document_id;
  if not found then raise exception 'document_not_found'; end if;
  if not exists(select 1 from public.nars_event_documents ed where ed.event_id=p_event_id and ed.document_id=p_document_id) then raise exception 'document_event_not_linked'; end if;
  if v_doc.authority_key is null then raise exception 'document_authority_missing'; end if;
  select * into v_match from public.nars_match_authority_url(p_final_url) limit 1;
  if v_match.authority_key is null or v_match.authority_key<>v_doc.authority_key then raise exception 'final_url_authority_mismatch'; end if;
  if v_doc.content_hash is not null and lower(v_doc.content_hash)<>lower(btrim(p_content_hash)) then raise exception 'document_content_hash_conflict'; end if;
  select authority_type into v_authority_type from public.nars_authority_registry where authority_key=v_doc.authority_key;
  v_role:=case v_authority_type when 'regulator' then 'primary_regulatory' when 'exchange' then 'primary_market'
    when 'court' then 'primary_legal' when 'company_ir' then 'primary_corporate' when 'statistical_agency' then 'primary_statistical' else 'primary_official' end;
  update public.nars_documents set content_hash=lower(btrim(p_content_hash)),
    raw_metadata=coalesce(raw_metadata,'{}'::jsonb)||jsonb_build_object(
      'content_verified',true,'content_verified_at',now(),'content_final_url',p_final_url,'content_type',p_content_type,
      'content_bytes',p_content_bytes,'content_text_chars',p_text_chars,'content_title_match',p_title_match,
      'content_redirect_count',greatest(0,coalesce(p_redirect_count,0)),'content_acquisition_version','4.9.1-evidence-acquisition-v2')||coalesce(p_signals,'{}'::jsonb)
  where id=p_document_id;
  v_artifact_key:='document:'||p_document_id::text||':sha256:'||lower(btrim(p_content_hash));
  v_attach:=public.nars_attach_event_evidence(p_event_id,v_artifact_key,v_role,v_doc.title,p_final_url,v_doc.authority_key,v_doc.publisher_key,
    p_document_id,v_doc.published_at,'content_verified',lower(btrim(p_content_hash)),'supports',1.0,'canonical_content_acquisition',
    jsonb_build_object('acquisition_version','4.9.1-evidence-acquisition-v2','content_type',p_content_type,'content_bytes',p_content_bytes,
      'text_chars',p_text_chars,'title_match',p_title_match,'redirect_count',greatest(0,coalesce(p_redirect_count,0)),
      'requested_url',v_doc.canonical_url,'final_url',p_final_url)||coalesce(p_signals,'{}'::jsonb));
  v_artifact_id:=nullif(v_attach->>'artifact_id','')::uuid;
  insert into public.nars_primary_source_candidates(event_id,candidate_url,normalized_host,authority_key,artifact_id,resolution_status,detected_by,metadata,updated_at)
  values(p_event_id,v_doc.canonical_url,v_match.normalized_host,v_doc.authority_key,v_artifact_id,'content_verified','canonical_content_acquisition',
    jsonb_build_object('final_url',p_final_url,'content_hash',lower(btrim(p_content_hash)),'acquisition_version','4.9.1-evidence-acquisition-v2')||coalesce(p_signals,'{}'::jsonb),now())
  on conflict(event_id,candidate_url) do update set artifact_id=excluded.artifact_id,resolution_status='content_verified',detected_by=excluded.detected_by,
    rejection_reason=null,metadata=public.nars_primary_source_candidates.metadata||excluded.metadata,updated_at=now();
  return jsonb_build_object('document_id',p_document_id,'event_id',p_event_id,'artifact_id',v_artifact_id,'artifact_key',v_artifact_key,
    'authority_key',v_doc.authority_key,'publisher_key',v_doc.publisher_key,'content_hash',lower(btrim(p_content_hash)),'score_eligible',true);
end;$$;
revoke all on function public.nars_promote_document_evidence(uuid,uuid,text,text,text,integer,integer,numeric,integer,jsonb) from public,anon,authenticated;
grant execute on function public.nars_promote_document_evidence(uuid,uuid,text,text,text,integer,integer,numeric,integer,jsonb) to service_role;

create or replace function public.nars_build_evidence_packet(p_event_id uuid) returns jsonb language sql stable set search_path to '' as $$
  select jsonb_build_object(
    'schema_version','1.0','packet_type','EvidencePacket','producer','NARS','authority','evidence_only','execution_authority',false,
    'event_id',e.id,'event_key',e.event_key,'event_title',e.title,'event_summary',e.summary,'event_status',e.status,
    'first_detected_at',e.first_detected_at,'updated_at',e.last_updated_at,'priority_score',sc.priority_score,'priority_band',sc.priority_band,
    'evidence_score',sc.final_evidence_score,'evidence_grade',sc.evidence_grade,'score_version',sc.score_version,'score_evaluated_at',sc.evaluated_at,
    'score_dimensions',sc.dimensions,'hard_gates',sc.hard_gates,'verified_primary_count',p.content_verified_primary_count,
    'verified_authority_count',p.verified_authority_count,'primary_contradiction_count',p.primary_contradiction_count,
    'evidence',coalesce(p.artifacts,'[]'::jsonb),
    'citations',coalesce((select jsonb_agg(x->>'canonical_url' order by x->>'canonical_url') from jsonb_array_elements(coalesce(p.artifacts,'[]'::jsonb)) x where nullif(x->>'canonical_url','') is not null),'[]'::jsonb),
    'entities','[]'::jsonb,'claims','[]'::jsonb,'market_tags',coalesce(e.metadata->'market_tags','[]'::jsonb),'risk_tags',coalesce(e.metadata->'risk_tags','[]'::jsonb)
  )
  from public.nars_events e
  join public.nars_event_provenance_v1 p on p.event_id=e.id and p.content_verified_primary_count>0
  left join public.nars_event_score_latest_v1 sc on sc.event_id=e.id
  where e.id=p_event_id;
$$;
revoke all on function public.nars_build_evidence_packet(uuid) from public,anon,authenticated;
grant execute on function public.nars_build_evidence_packet(uuid) to service_role;

create or replace function public.nars_enqueue_evidence_packet(p_event_id uuid) returns jsonb language plpgsql set search_path to '' as $$
declare v_payload jsonb; v_dedup text; v_id uuid; v_inserted int:=0;
begin
  v_payload:=public.nars_build_evidence_packet(p_event_id);
  if v_payload is null then raise exception 'content_verified_primary_evidence_required'; end if;
  v_dedup:='evidence_packet:'||p_event_id::text||':'||encode(extensions.digest(v_payload::text,'sha256'),'hex');
  insert into public.nars_intel_outbox(event_id,destination,payload,status,available_at,dedup_key)
  values(p_event_id,'black_oracle',v_payload,'pending',now(),v_dedup)
  on conflict(dedup_key) where dedup_key is not null do nothing returning id into v_id;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then select id into v_id from public.nars_intel_outbox where dedup_key=v_dedup limit 1; end if;
  return jsonb_build_object('event_id',p_event_id,'outbox_id',v_id,'dedup_key',v_dedup,'inserted',v_inserted>0,'execution_authority',false);
end;$$;
revoke all on function public.nars_enqueue_evidence_packet(uuid) from public,anon,authenticated;
grant execute on function public.nars_enqueue_evidence_packet(uuid) to service_role;

create or replace view public.nars_evidence_acquisition_metrics_v1 as
with a24 as (
  select count(*)::int attempts,count(*) filter(where status='verified')::int verified_attempts,
    count(*) filter(where status='fetched_unverified')::int fetched_unverified,count(*) filter(where status='failed')::int failed,
    count(*) filter(where status='blocked')::int blocked,count(distinct document_id) filter(where status='verified')::int verified_documents,
    avg(title_match) filter(where status='verified') avg_verified_title_match,
    percentile_cont(0.5) within group(order by content_bytes::double precision) filter(where status='verified') median_verified_bytes
  from public.nars_evidence_acquisition_attempts where created_at>=now()-interval '24 hours'
), totals as (select count(*)::int verified_artifacts from public.nars_evidence_artifacts where verification_status='content_verified'),
q as (select count(*)::int queue_depth from public.nars_evidence_acquisition_queue_v1),
o as (select count(*)::int pending_packets from public.nars_intel_outbox where destination='black_oracle' and status='pending')
select a24.*,totals.verified_artifacts,q.queue_depth,o.pending_packets,now() generated_at from a24 cross join totals cross join q cross join o;
alter view public.nars_evidence_acquisition_metrics_v1 set (security_invoker=true);
revoke all on public.nars_evidence_acquisition_metrics_v1 from anon,authenticated;
grant select on public.nars_evidence_acquisition_metrics_v1 to service_role;

DO $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='nars_evidence_acquisition_token' order by created_at desc limit 1;
  if v_secret is null then
    v_secret:=encode(gen_random_bytes(32),'hex');
    perform vault.create_secret(v_secret,'nars_evidence_acquisition_token','NARS v4 N4-11 primary evidence acquisition cron token',null);
  end if;
  insert into public.nars_system_meta(key,value,updated_at)
  values('evidence_acquisition_token_hash',jsonb_build_object('sha256',encode(extensions.digest(v_secret,'sha256'),'hex')),now())
  on conflict(key) do update set value=excluded.value,updated_at=now();
end$$;

DO $$ begin if exists(select 1 from cron.job where jobname='nars-evidence-acquire-10m') then perform cron.unschedule('nars-evidence-acquire-10m'); end if; end $$;
select cron.schedule('nars-evidence-acquire-10m','4-59/10 * * * *',$cron$
  select net.http_post(
    'https://dzbsxxoumlylyfhtmjnk.supabase.co/functions/v1/nars-evidence-acquire',
    jsonb_build_object('limit',6),
    '{}'::jsonb,
    jsonb_build_object('Content-Type','application/json','x-nars-evidence-token',(
      select decrypted_secret from vault.decrypted_secrets where name='nars_evidence_acquisition_token' order by created_at desc limit 1
    )),60000
  );
$cron$);

insert into public.nars_system_meta(key,value,updated_at) values(
  'evidence_acquisition',jsonb_build_object('enabled',true,'version','4.9.1-evidence-acquisition-v2','schedule','4-59/10 * * * *','batch_limit',6,
    'max_attempts',5,'retry_cooldown_minutes',30,'max_content_bytes',2000000,'execution_authority',false,'dart_resolver','viewer_v1'),now())
on conflict(key) do update set value=excluded.value,updated_at=now();
