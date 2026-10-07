-- Per-channel digest cursors (email, whatsapp, telegram).
-- Replaces the per-job notified_at flag from 20261005000000: unsent jobs for a channel
-- are jobs with inserted_at > that channel's last_*_digest_at on the scanner.
-- n8n stamps the cursor with the query cutoff time, not now(), so jobs inserted
-- mid-run are not skipped.

drop index if exists public.upwork_jobs_unsent_idx;
alter table public.upwork_jobs drop column if exists notified_at;

create index if not exists upwork_jobs_scan_inserted_idx
  on public.upwork_jobs (scan_config_id, inserted_at);

alter table public.user_scan_config
  rename column last_digest_at to last_email_digest_at;

alter table public.user_scan_config
  add column if not exists last_whatsapp_digest_at timestamptz,
  add column if not exists last_telegram_digest_at  timestamptz,
  add column if not exists notif_telegram           boolean not null default false;

-- Don't send history: start every cursor at migration time.
update public.user_scan_config
set last_email_digest_at    = now(),
    last_whatsapp_digest_at = now(),
    last_telegram_digest_at = now();

-- Telegram chat id is per user (connect once via bot /start).
alter table public.user_profiles
  add column if not exists telegram_chat_id text;

-- Tier hook: one interval per channel. Paid plans can lower them later.
alter table public.user_subscriptions
  rename column notif_interval_hours to email_interval_hours;

alter table public.user_subscriptions
  add column if not exists whatsapp_interval_hours integer not null default 24
    check (whatsapp_interval_hours >= 0),
  add column if not exists telegram_interval_hours integer not null default 1
    check (telegram_interval_hours >= 0);
