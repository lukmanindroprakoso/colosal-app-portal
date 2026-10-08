-- WhatsApp notifications are paid-only.
-- Paid = plan 'paid' and status <> 'cancelled'. Missing row = free.

create or replace function public.is_paid_user(uid uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_subscriptions
    where user_id = uid and plan = 'paid' and status <> 'cancelled'
  );
$$;

-- Internal helper: not callable via the Data API (would leak other users' plan).
revoke execute on function public.is_paid_user(uuid) from public, anon, authenticated;

-- Block enabling on insert/update for non-paid users.
create or replace function public.enforce_whatsapp_paid()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.notif_whatsapp and not public.is_paid_user(new.user_id) then
    raise exception 'WHATSAPP_PAID_ONLY: WhatsApp notifications require a paid plan';
  end if;
  return new;
end;
$$;

drop trigger if exists on_scan_config_whatsapp on public.user_scan_config;
create trigger on_scan_config_whatsapp
  before insert or update of notif_whatsapp on public.user_scan_config
  for each row execute procedure public.enforce_whatsapp_paid();

-- Revert: when a user stops being paid, switch WhatsApp off on all their scanners.
-- Number in user_scan_config.whatsapp is kept, so re-subscribing only needs a re-tick.
create or replace function public.revert_whatsapp_on_downgrade()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_paid_user(new.user_id) then
    update public.user_scan_config
    set notif_whatsapp = false
    where user_id = new.user_id and notif_whatsapp;
  end if;
  return new;
end;
$$;

drop trigger if exists on_subscription_downgrade on public.user_subscriptions;
create trigger on_subscription_downgrade
  after update of plan, status on public.user_subscriptions
  for each row execute procedure public.revert_whatsapp_on_downgrade();

revoke execute on function public.enforce_whatsapp_paid() from public, anon, authenticated;
revoke execute on function public.revert_whatsapp_on_downgrade() from public, anon, authenticated;

-- One-off cleanup of existing violators.
update public.user_scan_config c
set notif_whatsapp = false
where notif_whatsapp and not public.is_paid_user(c.user_id);
