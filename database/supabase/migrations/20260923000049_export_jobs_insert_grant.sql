-- data-specification.md §10.4 `export_jobs` -- a real bug fix, found
-- while building TASK-0151 and checking its own disputes table's grant
-- pattern against export_jobs' (TASK-0150). `20260923000048_
-- create_export_jobs.sql` enabled RLS and added a SELECT policy but
-- never granted INSERT to `authenticated` at all -- `createExportJob`'s
-- own real Edge Function composition (`exportJobsPersistence.ts`)
-- would have failed every real insert attempt under RLS's default-deny.
-- Forward-only fix, per this backlog's own RCR convention -- the
-- original migration is never retroactively edited.

grant insert on public.export_jobs to authenticated;

-- A requester may only ever create a job attributed to themselves --
-- the same `requested_by = auth.uid()` self-service shape
-- `export_jobs_select_own` already uses for reads.
create policy export_jobs_insert_own on public.export_jobs
  for insert
  with check (requested_by = auth.uid());
