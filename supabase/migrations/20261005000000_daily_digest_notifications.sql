-- Daily digest notifications (one digest per scanner).
-- Scan workflow keeps inserting jobs every 5 min; a separate n8n digest workflow
-- emails jobs where notified_at is null, then stamps notified_at / last_digest_at.

alter table public.upwork_jobs
  add column if not exists notified_at timestamptz;

alter table public.user_scan_config
  add column if not exists last_digest_at timestamptz;

-- Tier hook: free = 24h. Paid plans can lower it later (data change, no code change).
alter table public.user_subscriptions
  add column if not exists notif_interval_hours integer not null default 24
    check (notif_interval_hours >= 0);

-- Existing jobs were already notified under the old per-scan flow; don't re-send history.
update public.upwork_jobs
set notified_at = now()
where notified_at is null;

-- Digest query: unsent jobs per scanner.
create index if not exists upwork_jobs_unsent_idx
  on public.upwork_jobs (scan_config_id)
  where notified_at is null;
