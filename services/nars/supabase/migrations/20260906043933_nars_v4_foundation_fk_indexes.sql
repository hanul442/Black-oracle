create index if not exists nars_errors_source_id_idx on public.nars_errors (source_id);
create index if not exists nars_errors_job_run_id_idx on public.nars_errors (job_run_id);
create index if not exists nars_event_documents_document_id_idx on public.nars_event_documents (document_id);
create index if not exists nars_intel_outbox_event_id_idx on public.nars_intel_outbox (event_id);
