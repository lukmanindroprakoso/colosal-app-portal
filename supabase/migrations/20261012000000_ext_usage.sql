-- Per-user usage log for the Chrome extension's LLM endpoints (daily limit).
create table if not exists public.ext_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id),
  kind       text not null check (kind in ('proposal', 'profile')),
  created_at timestamptz not null default now()
);

create index if not exists ext_usage_user_created_idx
  on public.ext_usage (user_id, created_at desc);

alter table public.ext_usage enable row level security;
drop policy if exists "ext_usage select own" on public.ext_usage;
create policy "ext_usage select own" on public.ext_usage for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "ext_usage insert own" on public.ext_usage;
create policy "ext_usage insert own" on public.ext_usage for insert to authenticated with check (user_id = (select auth.uid()));

-- New public tables get default grants for anon; this table is only ever used by signed-in users.
revoke all on public.ext_usage from anon;
