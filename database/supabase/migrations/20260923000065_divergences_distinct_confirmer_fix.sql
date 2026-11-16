-- TASK-0161: a real, genuine pre-existing bug found by actual execution
-- -- `20260923000035`'s own `divergences_distinct_confirmer` check
-- (`confirmed_by is distinct from proposed_by`) rejects the NORMAL
-- case of a brand-new OPEN divergence, where BOTH columns are
-- legitimately NULL. Postgres's `IS DISTINCT FROM` treats two NULLs
-- as NOT distinct (`NULL IS DISTINCT FROM NULL` = `false`), which
-- FAILS a CHECK constraint (a CHECK must evaluate TRUE or NULL, never
-- FALSE) -- confirmed directly via the real edge-runtime log, not
-- guessed: `new row for relation "divergences" violates check
-- constraint "divergences_distinct_confirmer"` on a plain OPEN-status
-- insert with no propose/confirm fields set at all.
--
-- This went uncaught since TASK-0038 because nothing had ever actually
-- executed a real INSERT against this table before TASK-0161 wired
-- `detectAndRecordDivergences` into the real `sync-events` pipeline for
-- the first time ever -- the identical "written but never run" gap
-- every migration in this backlog shares until something finally
-- exercises it for real.
--
-- The constraint's own real intent, read from `confirmDivergenceResolution`'s
-- own doc comment (`divergenceResolution.ts`, TASK-0125): "a scorer
-- distinct from whoever proposed it." That only applies once BOTH
-- fields are actually set (PROPOSED -> RESOLVED transition) -- never
-- when either is still NULL. Replaced with a version that only fires
-- once both are non-null.

alter table public.divergences
  drop constraint divergences_distinct_confirmer;

alter table public.divergences
  add constraint divergences_distinct_confirmer check (
    proposed_by is null or confirmed_by is null or confirmed_by is distinct from proposed_by
  );
