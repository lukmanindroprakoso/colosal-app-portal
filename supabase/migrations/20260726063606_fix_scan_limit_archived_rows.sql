-- enforce_scan_limit counted archived (soft-deleted) rows toward the
-- 2-active-scanner cap, permanently blocking reactivation for accounts
-- with legacy archived rows still stuck at status = 'Active'.

update public.user_scan_config
set status = 'Inactive'
where is_archived = true and status = 'Active';

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
      and is_archived = false
      and id <> new.id;

    if active_count >= 2 then
      raise exception 'SCAN_LIMIT_REACHED: free plan allows up to 2 active scanners';
    end if;
  end if;

  return new;
end;
$$;
