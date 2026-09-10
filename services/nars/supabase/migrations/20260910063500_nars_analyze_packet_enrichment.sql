-- NARS Analyze v1: source-bound claims/entities before EvidencePacket delivery.
-- This stage does not infer market direction and has no execution authority.

create or replace function public.nars_analyze_event(p_event_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_title text;
  v_claims jsonb := '[]'::jsonb;
  v_entities jsonb := '[]'::jsonb;
  v_analysis jsonb;
  v_fingerprint text;
  v_updated integer := 0;
begin
  select e.title into v_title
  from public.nars_events e
  where e.id = p_event_id;

  if v_title is null then
    raise exception 'nars_event_not_found';
  end if;

  update public.nars_event_claims
  set status = 'superseded', updated_at = now()
  where event_id = p_event_id
    and claim_type = 'headline_assertion'
    and status = 'active'
    and claim_text is distinct from v_title;

  insert into public.nars_event_claims(event_id, claim_key, claim_text, claim_type, status, metadata)
  values (
    p_event_id,
    'headline:' || encode(extensions.digest(lower(v_title), 'sha256'), 'hex'),
    v_title,
    'headline_assertion',
    'active',
    jsonb_build_object('source', 'event_title', 'claim_version', '4.13.0-analyze-v1')
  )
  on conflict(event_id, claim_key) do update
  set claim_text = excluded.claim_text,
      status = 'active',
      metadata = public.nars_event_claims.metadata || excluded.metadata,
      updated_at = now();

  select coalesce(jsonb_agg(jsonb_build_object(
      'claim_key', c.claim_key,
      'text', c.claim_text,
      'type', c.claim_type,
      'status', c.status,
      'metadata', c.metadata
    ) order by c.updated_at desc), '[]'::jsonb)
  into v_claims
  from public.nars_event_claims c
  where c.event_id = p_event_id and c.status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object(
      'name', x.issuer,
      'type', 'ISSUER',
      'source', 'verified_primary',
      'authority_key', x.authority_key,
      'artifact_id', x.artifact_id
    ) order by x.issuer), '[]'::jsonb)
  into v_entities
  from (
    select distinct on (trim(a.metadata->>'structured_issuer'))
      trim(a.metadata->>'structured_issuer') as issuer,
      a.authority_key,
      a.id as artifact_id,
      a.updated_at
    from public.nars_event_evidence_links l
    join public.nars_evidence_artifacts a on a.id = l.artifact_id
    where l.event_id = p_event_id
      and a.verification_status = 'content_verified'
      and nullif(trim(a.metadata->>'structured_issuer'), '') is not null
      and coalesce(a.metadata->>'issuer_matched', 'false') = 'true'
    order by trim(a.metadata->>'structured_issuer'), a.updated_at desc
  ) x;

  v_fingerprint := md5(jsonb_build_object(
    'version', '4.13.0-analyze-v1',
    'claims', v_claims,
    'entities', v_entities
  )::text);

  v_analysis := jsonb_build_object(
    'version', '4.13.0-analyze-v1',
    'method', 'deterministic_source_bound',
    'claim_count', jsonb_array_length(v_claims),
    'entity_count', jsonb_array_length(v_entities),
    'claims', v_claims,
    'entities', v_entities,
    'market_direction_analyzed', false,
    'execution_authority', false,
    'fingerprint', v_fingerprint
  );

  update public.nars_events e
  set metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object(
    'analysis', v_analysis || jsonb_build_object('analyzed_at', now())
  )
  where e.id = p_event_id
    and coalesce(e.metadata->'analysis'->>'fingerprint', '') is distinct from v_fingerprint;
  get diagnostics v_updated = row_count;

  return v_analysis || jsonb_build_object('changed', v_updated > 0);
end;
$$;

create or replace function public.nars_build_evidence_packet(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version','1.1','packet_type','EvidencePacket','producer','NARS','authority','evidence_only','execution_authority',false,
    'event_id',e.id,'event_key',e.event_key,'event_title',e.title,'event_summary',e.summary,'event_status',e.status,
    'first_detected_at',e.first_detected_at,'updated_at',e.last_updated_at,'priority_score',sc.priority_score,'priority_band',sc.priority_band,
    'evidence_score',sc.final_evidence_score,'evidence_grade',sc.evidence_grade,'score_version',sc.score_version,'score_evaluated_at',sc.evaluated_at,
    'score_dimensions',sc.dimensions,'hard_gates',sc.hard_gates,'verified_primary_count',p.content_verified_primary_count,
    'verified_authority_count',p.verified_authority_count,'primary_contradiction_count',p.primary_contradiction_count,
    'evidence',coalesce(p.artifacts,'[]'::jsonb),
    'citations',coalesce((select jsonb_agg(x->>'canonical_url' order by x->>'canonical_url') from jsonb_array_elements(coalesce(p.artifacts,'[]'::jsonb)) x where nullif(x->>'canonical_url','') is not null),'[]'::jsonb),
    'entities',coalesce(e.metadata->'analysis'->'entities','[]'::jsonb),
    'claims',coalesce(e.metadata->'analysis'->'claims','[]'::jsonb),
    'analysis',case when e.metadata ? 'analysis' then (e.metadata->'analysis') - 'analyzed_at' else jsonb_build_object('version','4.13.0-analyze-v1','method','not_yet_analyzed','market_direction_analyzed',false,'execution_authority',false) end,
    'market_tags',coalesce(e.metadata->'market_tags','[]'::jsonb),'risk_tags',coalesce(e.metadata->'risk_tags','[]'::jsonb)
  )
  from public.nars_events e
  join public.nars_event_provenance_v1 p on p.event_id=e.id and p.content_verified_primary_count>0
  left join public.nars_event_score_latest_v1 sc on sc.event_id=e.id
  where e.id=p_event_id;
$$;

create or replace function public.nars_enqueue_evidence_packet(p_event_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_analysis jsonb;
  v_payload jsonb;
  v_dedup text;
  v_id uuid;
  v_inserted int := 0;
begin
  v_analysis := public.nars_analyze_event(p_event_id);
  v_payload := public.nars_build_evidence_packet(p_event_id);
  if v_payload is null then raise exception 'content_verified_primary_evidence_required'; end if;
  v_dedup := 'evidence_packet:' || p_event_id::text || ':' || encode(extensions.digest(v_payload::text,'sha256'),'hex');
  insert into public.nars_intel_outbox(event_id,destination,payload,status,available_at,dedup_key)
  values(p_event_id,'black_oracle',v_payload,'pending',now(),v_dedup)
  on conflict(dedup_key) where dedup_key is not null do nothing returning id into v_id;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then select id into v_id from public.nars_intel_outbox where dedup_key=v_dedup limit 1; end if;
  return jsonb_build_object(
    'event_id',p_event_id,
    'outbox_id',v_id,
    'dedup_key',v_dedup,
    'inserted',v_inserted>0,
    'analysis',v_analysis,
    'execution_authority',false
  );
end;
$$;

create or replace function public.nars_analyze_ready_events(p_limit integer default 500)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_result jsonb;
  v_seen int := 0;
  v_changed int := 0;
  v_entities int := 0;
  v_claims int := 0;
begin
  for r in
    select e.id
    from public.nars_events e
    join public.nars_event_provenance_v1 p on p.event_id=e.id and p.content_verified_primary_count>0
    order by e.last_updated_at desc
    limit greatest(1, least(coalesce(p_limit,500),2000))
  loop
    v_result := public.nars_analyze_event(r.id);
    v_seen := v_seen + 1;
    if coalesce((v_result->>'changed')::boolean,false) then v_changed := v_changed + 1; end if;
    v_entities := v_entities + coalesce((v_result->>'entity_count')::int,0);
    v_claims := v_claims + coalesce((v_result->>'claim_count')::int,0);
  end loop;
  return jsonb_build_object(
    'version','4.13.0-analyze-v1',
    'events_analyzed',v_seen,
    'events_changed',v_changed,
    'claims_emitted',v_claims,
    'entities_emitted',v_entities,
    'market_direction_analyzed',false,
    'execution_authority',false
  );
end;
$$;

revoke all on function public.nars_analyze_event(uuid) from public, anon, authenticated;
revoke all on function public.nars_analyze_ready_events(integer) from public, anon, authenticated;
grant execute on function public.nars_analyze_event(uuid) to service_role;
grant execute on function public.nars_analyze_ready_events(integer) to service_role;

comment on function public.nars_analyze_event(uuid) is
  'Deterministic source-bound NARS Analyze stage. Emits claims and verified issuer entities only; never infers trading direction or execution authority.';
