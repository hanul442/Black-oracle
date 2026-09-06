-- NARS v4 N4-06 resolver hardening
-- URL ownership verification alone must not change Evidence Grade.

create or replace function public.nars_resolve_primary_url(
  p_event_id uuid,
  p_url text,
  p_title text,
  p_content_hash text default null,
  p_content_verified boolean default false,
  p_relation text default 'supports',
  p_confidence numeric default 1.0,
  p_detected_by text default 'resolver',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_match record;
  v_role text;
  v_artifact_key text;
  v_attach jsonb;
  v_artifact_id uuid;
  v_host text;
begin
  if p_url is null or btrim(p_url)='' then raise exception 'url_required'; end if;
  if p_url !~* '^https://' then raise exception 'https_required'; end if;
  if p_title is null or btrim(p_title)='' then raise exception 'title_required'; end if;
  if p_relation not in ('supports','context','contradicts','refutes','mentions') then raise exception 'invalid_relation'; end if;
  if p_content_verified and nullif(btrim(coalesce(p_content_hash,'')),'') is null then raise exception 'content_hash_required_for_content_verified'; end if;
  if not exists(select 1 from public.nars_events where id=p_event_id) then raise exception 'event_not_found'; end if;

  select * into v_match from public.nars_match_authority_url(p_url) limit 1;
  if v_match.authority_key is null then raise exception 'unrecognized_official_domain'; end if;

  v_host := v_match.normalized_host;
  v_role := case v_match.authority_type
    when 'regulator' then 'primary_regulatory'
    when 'exchange' then 'primary_market'
    when 'court' then 'primary_legal'
    when 'company_ir' then 'primary_corporate'
    when 'statistical_agency' then 'primary_statistical'
    else 'primary_official'
  end;

  -- Stage 1: official-domain identity only. Candidate ledger only, no scoring effect.
  if not p_content_verified then
    insert into public.nars_primary_source_candidates(
      event_id,candidate_url,normalized_host,authority_key,resolution_status,detected_by,metadata,updated_at
    ) values(
      p_event_id,btrim(p_url),v_host,v_match.authority_key,'url_verified',coalesce(nullif(btrim(p_detected_by),''),'resolver'),
      coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object(
        'matched_domain',v_match.matched_domain,'authority_type',v_match.authority_type,
        'resolver_version','4.4.1-primary-resolver-v1'
      ),now()
    )
    on conflict(event_id,candidate_url) do update set
      normalized_host=excluded.normalized_host,
      authority_key=excluded.authority_key,
      resolution_status='url_verified',
      detected_by=excluded.detected_by,
      rejection_reason=null,
      metadata=public.nars_primary_source_candidates.metadata||excluded.metadata,
      updated_at=now();

    return jsonb_build_object(
      'event_id',p_event_id,'authority_key',v_match.authority_key,'authority_name',v_match.display_name,
      'authority_type',v_match.authority_type,'matched_domain',v_match.matched_domain,'normalized_host',v_host,
      'artifact_role',v_role,'verification_status','url_verified','candidate_only',true,
      'score_eligible',false,'requires_content_verification',true
    );
  end if;

  -- Stage 2: content-verified evidence. Hash is mandatory and scoring is allowed.
  v_artifact_key := 'authority:'||v_match.authority_key||':content:'||lower(btrim(p_content_hash));

  insert into public.nars_primary_source_candidates(
    event_id,candidate_url,normalized_host,authority_key,resolution_status,detected_by,metadata,updated_at
  ) values(
    p_event_id,btrim(p_url),v_host,v_match.authority_key,'content_verified',coalesce(nullif(btrim(p_detected_by),''),'resolver'),
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object(
      'matched_domain',v_match.matched_domain,'authority_type',v_match.authority_type,
      'resolver_version','4.4.1-primary-resolver-v1'
    ),now()
  )
  on conflict(event_id,candidate_url) do update set
    normalized_host=excluded.normalized_host,
    authority_key=excluded.authority_key,
    resolution_status='content_verified',
    detected_by=excluded.detected_by,
    rejection_reason=null,
    metadata=public.nars_primary_source_candidates.metadata||excluded.metadata,
    updated_at=now();

  v_attach := public.nars_attach_event_evidence(
    p_event_id,v_artifact_key,v_role,p_title,btrim(p_url),v_match.authority_key,null,null,null,
    'content_verified',p_content_hash,p_relation,p_confidence,'authority_domain_content_resolver',
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object(
      'normalized_host',v_host,'matched_domain',v_match.matched_domain,'authority_type',v_match.authority_type,
      'resolver_version','4.4.1-primary-resolver-v1'
    )
  );

  v_artifact_id := nullif(v_attach->>'artifact_id','')::uuid;
  update public.nars_primary_source_candidates
  set artifact_id=v_artifact_id,updated_at=now()
  where event_id=p_event_id and candidate_url=btrim(p_url);

  return jsonb_build_object(
    'event_id',p_event_id,'authority_key',v_match.authority_key,'authority_name',v_match.display_name,
    'authority_type',v_match.authority_type,'matched_domain',v_match.matched_domain,'normalized_host',v_host,
    'artifact_role',v_role,'verification_status','content_verified','candidate_only',false,
    'score_eligible',true,'artifact_id',v_artifact_id,'artifact_key',v_artifact_key,'relation',p_relation
  );
end;
$$;

revoke execute on function public.nars_resolve_primary_url(uuid,text,text,text,boolean,text,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.nars_resolve_primary_url(uuid,text,text,text,boolean,text,numeric,text,jsonb) to service_role;

insert into public.nars_system_meta(key,value,updated_at)
values('primary_resolver_version',jsonb_build_object(
  'version','4.4.1-primary-resolver-v1',
  'https_required',true,
  'authority_domain_required',true,
  'url_verified_candidate_only',true,
  'content_hash_required_for_score_eligible_evidence',true,
  'updated_at',now()
),now())
on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
