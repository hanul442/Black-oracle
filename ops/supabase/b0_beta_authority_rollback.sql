-- B0.3 rollback. RESTRICT deliberately fails if beta-owned objects exist.
-- It never drops, rewrites, re-keys, or reseeds legacy public objects.

revoke all on schema black_oracle_beta from black_oracle_beta_server;
drop schema if exists black_oracle_beta restrict;
drop role if exists black_oracle_beta_server;
drop role if exists black_oracle_beta_owner;
