-- security-specification.md SR-B10 -- rewrites TASK-0158's own
-- `matches_select`/`matches_update` policies to call the new
-- `my_orgs()`/`has_match_role()` helpers (`20260923000052`) instead of
-- their own inline subqueries -- the first real consumer of either
-- helper anywhere in this schema. `20260923000051`
-- (TASK-0158's own migration) is never retroactively edited, per this
-- backlog's own forward-only convention -- this is a DROP/CREATE on
-- top, the identical shape TASK-0141 already used to tighten
-- `disputes_select`/`invitations_select` after the fact.
--
-- Behaviourally IDENTICAL to TASK-0158's own policies -- this is a
-- pure refactor (inline subquery -> helper call), not a tightening or
-- loosening of who can read/write. `matches_insert` is untouched: it
-- is a plain `created_by = auth.uid()` check with no org/role lookup
-- to simplify, so there is nothing for either helper to replace there.

drop policy matches_select on public.matches;

create policy matches_select on public.matches
  for select
  using (
    (
      organization_id is not null
      and claim_status = 'CLAIMED'
      and organization_id = any (public.my_orgs())
    )
    or (
      organization_id is null
      and (created_by = auth.uid() or updated_by = auth.uid())
    )
  );

drop policy matches_update on public.matches;

create policy matches_update on public.matches
  for update
  using (
    (
      organization_id is not null
      and (
        organization_id = any (public.my_orgs('ORGANIZATION_ADMIN'))
        or public.has_match_role(matches.id, array['HEAD_SCORER', 'ASSISTANT_SCORER'])
      )
    )
    or (
      organization_id is null
      and (created_by = auth.uid() or updated_by = auth.uid())
    )
  );
