-- Run only on an isolated Supabase branch after b0_beta_authority_candidate.sql.
-- This script creates and drops test-only objects inside black_oracle_beta.

begin;

do $block$
begin
  if to_regclass('public.black_oracle_trading_runtime') is null then
    raise exception 'required protected relation is missing';
  end if;
  if to_regclass('public.black_oracle_events') is null then
    raise exception 'required protected ledger is missing';
  end if;
end
$block$;

create schema b0_beta_authority_test;
revoke all on schema b0_beta_authority_test from public;
grant usage on schema b0_beta_authority_test to black_oracle_beta_server;

create function b0_beta_authority_test.assert_denied(statement text)
returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  begin
    execute statement;
    raise exception 'statement unexpectedly succeeded: %', statement;
  exception
    when insufficient_privilege then null;
  end;
end
$function$;
grant execute on function b0_beta_authority_test.assert_denied(text) to black_oracle_beta_server;

set local role black_oracle_beta_owner;
create table black_oracle_beta.authority_probe (
  id bigint generated always as identity primary key,
  marker text not null
);
grant select, insert on black_oracle_beta.authority_probe to black_oracle_beta_server;
grant usage, select on sequence black_oracle_beta.authority_probe_id_seq to black_oracle_beta_server;
reset role;

set local role black_oracle_beta_server;
insert into black_oracle_beta.authority_probe(marker) values ('isolated-write-ok');
select b0_beta_authority_test.assert_denied(
  'insert into public.black_oracle_events default values'
);
select b0_beta_authority_test.assert_denied(
  'update public.black_oracle_trading_runtime set reason = reason'
);
select b0_beta_authority_test.assert_denied(
  'delete from public.black_oracle_trading_runtime'
);
select b0_beta_authority_test.assert_denied(
  'truncate public.black_oracle_trading_runtime'
);
select b0_beta_authority_test.assert_denied(
  'create table public.b0_forbidden_probe(id integer)'
);
select b0_beta_authority_test.assert_denied(
  'alter table public.black_oracle_trading_runtime owner to black_oracle_beta_server'
);
reset role;

do $block$
declare
  beta record;
begin
  select * into beta from pg_roles where rolname = 'black_oracle_beta_server';
  if beta.rolsuper or beta.rolinherit or beta.rolbypassrls or beta.rolcreatedb
     or beta.rolcreaterole or beta.rolreplication then
    raise exception 'beta role has forbidden role attributes';
  end if;
  if exists (
    select 1 from pg_auth_members membership
    join pg_roles child on child.oid = membership.member
    where child.rolname = 'black_oracle_beta_server'
  ) then
    raise exception 'beta role retains inherited role membership';
  end if;
  if has_schema_privilege('anon', 'black_oracle_beta', 'USAGE')
     or has_schema_privilege('authenticated', 'black_oracle_beta', 'USAGE') then
    raise exception 'browser role can access beta namespace';
  end if;
end
$block$;

rollback;
