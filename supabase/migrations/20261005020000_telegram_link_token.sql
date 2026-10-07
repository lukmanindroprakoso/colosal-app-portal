-- One-time token for linking a Telegram chat: Settings writes it, the n8n bot
-- matches it on /start <token>, sets telegram_chat_id and clears the token.
alter table public.user_profiles
  add column if not exists telegram_link_token text;

-- Cursor defaults so new scanners start at creation time (applied by hand earlier).
alter table public.user_scan_config
  alter column last_email_digest_at    set default now(),
  alter column last_whatsapp_digest_at set default now(),
  alter column last_telegram_digest_at set default now();
