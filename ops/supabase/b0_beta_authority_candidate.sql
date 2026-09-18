-- B0.3 CANDIDATE ONLY. Do not apply to production without the full gate in
-- docs/audit/B0_BETA_AUTHORITY_DESIGN.md and an isolated database proof.

do $block$
begin
  if not exists (select 1 from pg_roles where rolname = 'black_oracle_beta_owner') then
    create role black_oracle_beta_owner
      nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole noreplication;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'black_oracle_beta_server') then
    create role black_oracle_beta_server
      login noinherit nobypassrls nosuperuser nocreatedb nocreaterole noreplication;
  end if;
end
$block$;

alter role black_oracle_beta_owner
  nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole noreplication;
alter role black_oracle_beta_server
  login noinherit nobypassrls nosuperuser nocreatedb nocreaterole noreplication;

do $block$
declare
  membership record;
begin
  for membership in
    select parent.rolname as parent_role
    from pg_auth_members membership
    join pg_roles child on child.oid = membership.member
    join pg_roles parent on parent.oid = membership.roleid
    where child.rolname = 'black_oracle_beta_server'
  loop
    execute format('revoke %I from black_oracle_beta_server', membership.parent_role);
  end loop;
end
$block$;

do $block$
begin
  execute format(
    'revoke create, temporary on database %I from black_oracle_beta_server',
    current_database()
  );
end
$block$;

revoke all on schema public from black_oracle_beta_server;
revoke all privileges on all tables in schema public from black_oracle_beta_server;
revoke all privileges on all sequences in schema public from black_oracle_beta_server;
revoke all privileges on all functions in schema public from black_oracle_beta_server;

create schema if not exists black_oracle_beta authorization black_oracle_beta_owner;
alter schema black_oracle_beta owner to black_oracle_beta_owner;
revoke all on schema black_oracle_beta from public, anon, authenticated, service_role;
grant usage on schema black_oracle_beta to black_oracle_beta_server;

alter default privileges for role black_oracle_beta_owner in schema black_oracle_beta
  revoke all on tables from public, anon, authenticated, service_role, black_oracle_beta_server;
alter default privileges for role black_oracle_beta_owner in schema black_oracle_beta
  revoke all on sequences from public, anon, authenticated, service_role, black_oracle_beta_server;
alter default privileges for role black_oracle_beta_owner in schema black_oracle_beta
  revoke all on functions from public, anon, authenticated, service_role, black_oracle_beta_server;

comment on role black_oracle_beta_server is
  'B0.3 least-privilege beta server identity. Credential is provisioned out of band; service_role use is forbidden.';
comment on schema black_oracle_beta is
  'Beta-owned write namespace. Legacy public state remains direct-grant denied.';
