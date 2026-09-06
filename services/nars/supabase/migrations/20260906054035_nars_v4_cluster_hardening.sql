create index if not exists nars_stories_anchor_document_id_idx on public.nars_stories(anchor_document_id);

create or replace function public.nars_source_identity(p_name text, p_metadata jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(lower(btrim(p_metadata->>'publisher_key')),''), lower(btrim(p_name)));
$$;

create or replace function public.nars_title_tokens(p_text text)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(token order by token), array[]::text[])
  from (
    select distinct x as token
    from unnest(regexp_split_to_array(lower(regexp_replace(coalesce(p_text,''), '[^[:alnum:]가-힣]+', ' ', 'g')), '\s+')) as x
    where length(x) >= 2
      and x not in ('속보','단독','종합','오늘','이번','관련','대한','통해','위해','등','및','기자','뉴스','발표','예정')
  ) q;
$$;

create or replace function public.nars_token_jaccard(p_a text, p_b text)
returns real
language sql
immutable
set search_path = public, pg_temp
as $$
  with a as (select unnest(public.nars_title_tokens(p_a)) token),
       b as (select unnest(public.nars_title_tokens(p_b)) token),
       i as (select count(*)::real n from (select token from a intersect select token from b) x),
       u as (select count(*)::real n from (select token from a union select token from b) x)
  select case when u.n = 0 then 0::real else (i.n/u.n)::real end from i,u;
$$;

create or replace function public.nars_shared_token_count(p_a text, p_b text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  with a as (select unnest(public.nars_title_tokens(p_a)) token),
       b as (select unnest(public.nars_title_tokens(p_b)) token)
  select count(*)::integer from (select token from a intersect select token from b) x;
$$;

revoke all on function public.nars_source_identity(text,jsonb) from public, anon, authenticated;
revoke all on function public.nars_title_tokens(text) from public, anon, authenticated;
revoke all on function public.nars_token_jaccard(text,text) from public, anon, authenticated;
revoke all on function public.nars_shared_token_count(text,text) from public, anon, authenticated;
grant execute on function public.nars_source_identity(text,jsonb) to service_role;
grant execute on function public.nars_title_tokens(text) to service_role;
grant execute on function public.nars_token_jaccard(text,text) to service_role;
grant execute on function public.nars_shared_token_count(text,text) to service_role;
