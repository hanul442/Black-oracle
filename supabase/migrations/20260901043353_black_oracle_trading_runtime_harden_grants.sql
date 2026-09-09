-- Recovered from production migration history during S0 source-truth convergence.
revoke all on table public.black_oracle_trading_runtime from public;
revoke all on table public.black_oracle_trading_runtime from anon, authenticated;
grant select, insert, update, delete on table public.black_oracle_trading_runtime to service_role;
