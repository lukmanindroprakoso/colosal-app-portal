-- Baseline sync: captures schema that was applied directly against the
-- remote project (via dashboard / mcp) without matching local migrations.
-- Idempotent so it's safe to run against an already-current database.

-- ── enums ────────────────────────────────────────────────────────────────
do $$ begin
  create type public.user_profile_status_enum as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.upwork_jobs_apply_status_enum as enum ('New', 'Applied', 'Dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_type_enum as enum ('FIXED', 'HOURLY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.experience_level_enum as enum ('ENTRY_LEVEL', 'INTERMEDIATE', 'EXPERT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_scan_status_enum as enum ('Active', 'Inactive', 'Draft');
exception when duplicate_object then null; end $$;

-- ── user_profiles ────────────────────────────────────────────────────────
create table if not exists public.user_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users(id),
  full_name             text,
  phone                 text,
  photo                 text,
  status                public.user_profile_status_enum not null default 'active',
  upwork_user_id        text,
  user_profile          jsonb,
  access_token          text,
  refresh_token         text,
  expires_at            timestamptz,
  last_used             timestamptz,
  username              text,
  user_type             text check (user_type in ('freelancer', 'agency', 'other')),
  custom_type           text,
  onboarding_completed  boolean not null default false,
  summary               text,
  "current_role"        text,
  previous_experience   text,
  skills_text           text,
  portfolio             text,
  key_proof_points      text,
  positioning_notes     text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
drop policy if exists "User profiles - select own" on public.user_profiles;
create policy "User profiles - select own" on public.user_profiles for select using (user_id = auth.uid());
drop policy if exists "User profiles - insert own" on public.user_profiles;
create policy "User profiles - insert own" on public.user_profiles for insert with check (user_id = auth.uid());
drop policy if exists "User profiles - update own" on public.user_profiles;
create policy "User profiles - update own" on public.user_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "User profiles - delete own" on public.user_profiles;
create policy "User profiles - delete own" on public.user_profiles for delete using (user_id = auth.uid());

-- ── attachments ──────────────────────────────────────────────────────────
create table if not exists public.attachments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id),
  bucket_id        text not null default 'attachment',
  storage_key      text not null,
  description      text,
  file_name        text,
  file_size_bytes  bigint,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.attachments enable row level security;
drop policy if exists "attachments select own" on public.attachments;
create policy "attachments select own" on public.attachments for select using (user_id = auth.uid());
drop policy if exists "attachments insert own" on public.attachments;
create policy "attachments insert own" on public.attachments for insert with check (user_id = auth.uid());
drop policy if exists "attachments update own" on public.attachments;
create policy "attachments update own" on public.attachments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "attachments delete own" on public.attachments;
create policy "attachments delete own" on public.attachments for delete using (user_id = auth.uid());

-- ── proposal_templates ───────────────────────────────────────────────────
create table if not exists public.proposal_templates (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  user_id        uuid not null default gen_random_uuid() references auth.users(id),
  ai_instruction text not null,
  template       text not null,
  name           text default 'My template'
);

alter table public.proposal_templates enable row level security;
drop policy if exists "proposal_templates_select_own" on public.proposal_templates;
create policy "proposal_templates_select_own" on public.proposal_templates for select using (user_id = (select auth.uid()));
drop policy if exists "proposal_templates_insert_own" on public.proposal_templates;
create policy "proposal_templates_insert_own" on public.proposal_templates for insert with check (user_id = (select auth.uid()));
drop policy if exists "proposal_templates_update_own" on public.proposal_templates;
create policy "proposal_templates_update_own" on public.proposal_templates for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "proposal_templates_delete_own" on public.proposal_templates;
create policy "proposal_templates_delete_own" on public.proposal_templates for delete using (user_id = (select auth.uid()));

-- ── user_scan_config ─────────────────────────────────────────────────────
create table if not exists public.user_scan_config (
  id                    uuid primary key default gen_random_uuid(),
  budget_max            numeric,
  budget_min            numeric,
  contract_type         public.contract_type_enum[],
  email                 text,
  experience_level      public.experience_level_enum,
  hourly_rate_max       numeric,
  hourly_rate_min       numeric,
  is_archived           boolean not null default false,
  keyword               text,
  last_job_id           text,
  last_scan             timestamptz,
  next_scan             timestamptz,
  notif_email           boolean not null default false,
  notif_whatsapp        boolean not null default false,
  question_answer_base  text,
  question_instruction  text,
  scan_result           text,
  status                public.job_scan_status_enum not null default 'Draft',
  whatsapp              text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  user_id               uuid not null references auth.users(id),
  category              text,
  qa_example            jsonb,
  attachments           jsonb,
  skills                jsonb,
  client_hire_rate      real default 0,
  name                  text,
  proposal_template_id  uuid references public.proposal_templates(id)
);

alter table public.user_scan_config enable row level security;
drop policy if exists "User can view own scan configs" on public.user_scan_config;
create policy "User can view own scan configs" on public.user_scan_config for select using (user_id = (select auth.uid()));
drop policy if exists "User can insert own scan configs" on public.user_scan_config;
create policy "User can insert own scan configs" on public.user_scan_config for insert with check (user_id = (select auth.uid()));
drop policy if exists "User can update own scan configs" on public.user_scan_config;
create policy "User can update own scan configs" on public.user_scan_config for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "User can delete own scan configs" on public.user_scan_config;
create policy "User can delete own scan configs" on public.user_scan_config for delete using (user_id = (select auth.uid()));

-- ── upwork_jobs ──────────────────────────────────────────────────────────
create table if not exists public.upwork_jobs (
  id                            uuid primary key default gen_random_uuid(),
  inserted_at                   timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  scan_config_id                uuid not null default gen_random_uuid() references public.user_scan_config(id),
  job_id                        text not null,
  url                           text,
  title                         text,
  description                   text,
  hours_ago                     double precision,
  minutes_ago                   double precision,
  duration                      text,
  duration_label                text,
  experience_level              text,
  total_applicants              integer,
  amount_raw                    numeric,
  amount_currency               text,
  job_status                    text,
  contract_type                 text,
  category_id                   text,
  category_label                text,
  cover_letter_required         boolean,
  freelancer_milestones_allowed boolean,
  client_verification_status    text,
  client_total_hires            integer,
  client_total_posted_jobs      integer,
  client_total_spent            text,
  client_total_reviews          integer,
  client_total_feedback         numeric,
  client_has_financial_privacy  boolean,
  client_country                text,
  client_city                   text,
  client_state                  text,
  client_timezone               text,
  score_matching                bigint,
  payload                       jsonb not null,
  hours_inactive                numeric,
  publish_time                  text,
  amount_display                text,
  contract_experience_level     text,
  engagement_type               text,
  hourly_budget_min             numeric,
  hourly_budget_max             numeric,
  fixed_price_amount            numeric,
  fixed_price_currency          text,
  skills                        jsonb,
  screening_questions           jsonb,
  user_id                       uuid references auth.users(id),
  apply_status                  public.upwork_jobs_apply_status_enum default 'New',
  open                          boolean
);

alter table public.upwork_jobs enable row level security;
drop policy if exists "upwork_jobs - select own" on public.upwork_jobs;
create policy "upwork_jobs - select own" on public.upwork_jobs for select using (user_id = auth.uid());
drop policy if exists "upwork_jobs - insert own" on public.upwork_jobs;
create policy "upwork_jobs - insert own" on public.upwork_jobs for insert with check (user_id = auth.uid());
drop policy if exists "upwork_jobs - update own" on public.upwork_jobs;
create policy "upwork_jobs - update own" on public.upwork_jobs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "upwork_jobs - delete own" on public.upwork_jobs;
create policy "upwork_jobs - delete own" on public.upwork_jobs for delete using (user_id = auth.uid());

-- ── proposals ────────────────────────────────────────────────────────────
create table if not exists public.proposals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id),
  upwork_job_id         uuid references public.upwork_jobs(id),
  attachment            uuid[] not null default '{}',
  client_paint          text,
  cover_letter_generated text,
  cover_letter_template text,
  is_submitted          boolean not null default false,
  last_generated_at     timestamptz,
  question_answer       jsonb,
  question_instruction  text,
  total_token_used      bigint,
  inserted_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  connects_used         integer
);

alter table public.proposals enable row level security;
drop policy if exists "proposals_select_own" on public.proposals;
create policy "proposals_select_own" on public.proposals for select using (user_id = auth.uid());
drop policy if exists "proposals_insert_own" on public.proposals;
create policy "proposals_insert_own" on public.proposals for insert with check (user_id = auth.uid());
drop policy if exists "proposals_update_own" on public.proposals;
create policy "proposals_update_own" on public.proposals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "proposals_delete_own" on public.proposals;
create policy "proposals_delete_own" on public.proposals for delete using (user_id = auth.uid());

-- ── incident_logs (n8n workflow error tracking, no user-facing policies) ──
create table if not exists public.incident_logs (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default timezone('utc', now()),
  status             text not null default 'open',
  workflow_id        text not null,
  workflow_name      text not null,
  execution_id       text,
  execution_url      text,
  retry_of           text,
  last_node_executed text,
  execution_mode     text,
  error_message      text not null,
  error_stack        text,
  notification_sent  boolean not null default false
);

alter table public.incident_logs enable row level security;
