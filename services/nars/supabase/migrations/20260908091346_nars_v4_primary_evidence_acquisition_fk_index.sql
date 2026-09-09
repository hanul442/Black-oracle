create index if not exists nars_evidence_acquisition_authority_idx
  on public.nars_evidence_acquisition_attempts(authority_key,created_at desc);
