-- data-specification.md §10.3 `status_banners` -- added by RCR,
-- 2026-10-04 (TASK-0138), the most speculative RCR of the entire
-- session: no textual anchor exists anywhere in this corpus beyond
-- FR-160's own single phrase "status/maintenance banners." See §10.3's
-- own note for the full reasoning.

create table public.status_banners (
  id          uuid primary key,
  message     text not null,
  severity    text null,
  active      boolean not null default true,
  starts_at   timestamptz null,
  ends_at     timestamptz null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid null
);

alter table public.status_banners enable row level security;

-- Platform-wide, visible to every authenticated user -- the same
-- shape 20260923000038's own feature_flags policy already uses.
create policy status_banners_select on public.status_banners
  for select
  using (true);
