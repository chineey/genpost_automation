-- ══════════════════════════════════════════════════════════════════
-- Genpost — Neon Postgres Schema
-- Run this in: Neon Console → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── Users Table (NextAuth + SaaS Profile combined) ────────────────
create table if not exists public.users (
  id                        uuid primary key default gen_random_uuid(),
  email                     text not null unique,
  password_hash             text not null, -- bcrypt hashed
  email_verified            timestamptz,
  image                     text,

  -- X / Twitter connection
  x_username                text,
  x_oauth_token             text,          -- AES-256-GCM encrypted
  x_refresh_token           text,          -- AES-256-GCM encrypted
  token_expires_at          timestamptz,

  -- Billing — Stripe
  stripe_customer_id        text unique,
  stripe_subscription_id    text,

  -- Billing — Paystack
  paystack_customer_code    text,
  paystack_subscription_code text,

  -- Plan & quota
  plan                      text not null default 'free'
                              check (plan in ('free', 'starter', 'growth', 'agency')),
  monthly_post_quota        int not null default 10,
  posts_used_this_cycle     int not null default 0,
  cycle_reset_at            timestamptz default (now() + interval '30 days'),

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ── Posts Table ──────────────────────────────────────────────────
create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.users(id) on delete cascade not null,

  content         text not null,
  contains_link   boolean not null default false,
  status          text not null default 'draft'
                    check (status in ('draft', 'approved', 'posted', 'failed')),
  scheduled_time  timestamptz,
  x_post_id       text,           -- populated after successful publish
  error_message   text,

  -- AI metadata
  metadata        jsonb default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────
create index if not exists idx_posts_user_status
  on public.posts(user_id, status);

create index if not exists idx_posts_scheduled
  on public.posts(status, scheduled_time)
  where status = 'approved';

create index if not exists idx_users_stripe
  on public.users(stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists idx_users_paystack
  on public.users(paystack_subscription_code)
  where paystack_subscription_code is not null;

-- ── Auto-update updated_at Trigger / Function ─────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at
  before update on public.posts
  for each row execute procedure public.set_updated_at();

-- ── Monthly Quota Reset Function ──────────────────────────────────
create or replace function public.reset_monthly_quotas()
returns void
language plpgsql
as $$
begin
  update public.users
  set
    posts_used_this_cycle = 0,
    cycle_reset_at = now() + interval '30 days'
  where cycle_reset_at <= now();
end;
$$;
