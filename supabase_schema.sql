-- NocTeam — Supabase schema. Paste into Supabase → SQL Editor → Run.
create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  session_id      text unique not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- contact (captured in the conversation, even partially)
  name            text,
  email           text,
  phone           text,
  company         text,
  mc              text,
  carrier         jsonb,        -- FMCSA snapshot (legalName, city, state, power units, authority)

  -- qualification
  role            text,
  fleet           text,
  freight         text,
  focus           text,         -- which value card they entered from (make/save/run)
  pains           text[],       -- everything they said hurts
  top1            text,         -- the one to fix first
  openness        text,         -- skeptical / curious / ready to try
  words           text,         -- biggest pain in their own words

  -- attribution / analytics
  referrer        text,
  utm             jsonb,
  path            text,
  user_agent      text,
  duration_seconds int,

  completed       boolean default false,  -- finished the conversation
  booked          boolean default false   -- scheduled on Calendly
);

create index if not exists leads_updated_idx on public.leads (updated_at desc);
create index if not exists leads_created_idx on public.leads (created_at desc);

-- Security: only the server (service-role key) reads/writes. No public/anon access.
alter table public.leads enable row level security;
-- Intentionally NO policies: anon & authenticated roles get nothing.
-- The /api/lead and /api/stats functions use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
