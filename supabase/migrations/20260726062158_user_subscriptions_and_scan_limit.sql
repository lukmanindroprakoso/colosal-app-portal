-- Subscription tier + free-plan active-scanner cap.
-- See docs/specs/2026-07-24-subscription-limit-design.md

create table if not exists public.user_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id),
  plan       text not null default 'free' check (plan in ('free', 'paid')),
  status     text not null default 'active' check (status in ('active', 'requested', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;
drop policy if exists "user_subscriptions select own" on public.user_subscriptions;
create policy "user_subscriptions select own" on public.user_subscriptions for select using (user_id = auth.uid());

-- Mirrors public.handle_new_user(): create a subscriptions row on signup.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_subscriptions (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute procedure public.handle_new_user_subscription();

-- Backfill rows for accounts that existed before this migration.
insert into public.user_subscriptions (user_id)
select u.id from auth.users u
where not exists (select 1 from public.user_subscriptions s where s.user_id = u.id);

-- Free plan: max 2 Active scan configs. Missing subscription row = free.
create or replace function public.enforce_scan_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_plan text;
  active_count int;
begin
  if new.status <> 'Active' then
    return new;
  end if;

  select plan into user_plan from public.user_subscriptions where user_id = new.user_id;
  if user_plan is null or user_plan = 'free' then
    select count(*) into active_count
    from public.user_scan_config
    where user_id = new.user_id
      and status = 'Active'
      and id <> new.id;

    if active_count >= 2 then
      raise exception 'SCAN_LIMIT_REACHED: free plan allows up to 2 active scanners';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_scan_config_limit on public.user_scan_config;
create trigger on_scan_config_limit
  before insert or update on public.user_scan_config
  for each row execute procedure public.enforce_scan_limit();
