-- Patchwise: Supabase schema. Run once in Dashboard -> SQL Editor (the app's publishable key cannot run DDL).
-- Safe to re-run: every statement is idempotent.
-- Model: the FastAPI backend stays the public store of report media + analysis (the public map reads it, no login).
-- Postgres holds who owns which report, plus the summary each user sees in "My reports". RLS: a user only sees their own rows.

create table if not exists public.reports (
  id            text primary key,                         -- backend report id (data/<id>/result.json)
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  claimed_from_device boolean not null default false,     -- true when claimed from the logged-out "from this phone" list
  ward          text,
  city          text,
  lat           double precision,
  lng           double precision,
  hazards       integer not null default 0 check (hazards >= 0),
  worst         text check (worst in ('CRITICAL','HIGH','MEDIUM','LOW')),
  repair_inr    integer check (repair_inr >= 0),
  status        text not null default 'reported' check (status in ('reported','filed','promised','fixed')),
  authority_id  text,                                      -- id from backend/app/authorities/authorities.json
  sent_at       timestamptz                                -- when the user opened "Send to authorities"
);

create index if not exists reports_user_created_idx on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;
alter table public.reports force row level security;

drop policy if exists "own reports: select" on public.reports;
create policy "own reports: select" on public.reports for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own reports: insert" on public.reports;
create policy "own reports: insert" on public.reports for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "own reports: update" on public.reports;
create policy "own reports: update" on public.reports for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own reports: delete" on public.reports;
create policy "own reports: delete" on public.reports for delete to authenticated using ((select auth.uid()) = user_id);

-- Anonymous visitors get nothing from this table (the public map is served by the backend, not Postgres).
revoke all on public.reports from anon;
grant select, insert, update, delete on public.reports to authenticated;

-- A report id can be claimed by one account only. Claiming someone else's id fails the primary key, and RLS
-- hides the other row, so nobody learns who owns it.
