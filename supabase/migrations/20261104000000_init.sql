-- BeSeen schema. Platform-neutral: a laptop later is just another row in `devices`.
-- Every table has RLS on and no policies, so only the Edge Function (service role) can touch data.

create table accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  created_at timestamptz not null default now()
);

create table devices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  secret_hash text not null,
  platform text not null check (platform in ('ios', 'android', 'macos', 'windows', 'linux')),
  name text,
  app_version text,
  timezone text,
  push_token text,
  status jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  ping_sent_at timestamptz,
  silent_alerted_at timestamptz,
  created_at timestamptz not null default now()
);
create index devices_account_idx on devices(account_id);
create index devices_last_seen_idx on devices(last_seen_at);

create table rules (
  id uuid primary key, -- generated on the device so iOS can store the app selection under it first
  account_id uuid not null references accounts(id) on delete cascade,
  device_id uuid not null references devices(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  -- selection: iOS picker tokens (stay on the phone) | app: Android package | site: domain | adult_sites: preset
  target_type text not null check (target_type in ('selection', 'app', 'site', 'adult_sites')),
  target text,
  mode text not null check (mode in ('block', 'limit')),
  limit_minutes int check (limit_minutes between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  check ((mode = 'limit') = (limit_minutes is not null))
);
create index rules_account_idx on rules(account_id) where removed_at is null;

-- Looser changes wait here until the cooldown passes. Stricter changes are applied directly.
create table rule_changes (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references rules(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  kind text not null check (kind in ('change', 'remove')),
  before jsonb not null,
  after jsonb,
  requested_at timestamptz not null default now(),
  effective_at timestamptz not null,
  applied_at timestamptz,
  cancelled_at timestamptz
);
create unique index rule_changes_one_pending on rule_changes(rule_id)
  where applied_at is null and cancelled_at is null;

create table partners (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  status text not null check (status in ('invited', 'active', 'ended')),
  end_reason text check (end_reason in ('removed', 'replaced', 'left', 'unsubscribed', 'bounced', 'complained')),
  channel text check (channel in ('email', 'push')),
  email text,
  email_pending text,
  email_confirm_hash text,
  email_confirm_expires_at timestamptz,
  partner_account_id uuid references accounts(id) on delete set null,
  invite_hash text,
  invite_expires_at timestamptz,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz
);
create unique index partners_one_live on partners(account_id) where status in ('invited', 'active');
create index partners_partner_account_idx on partners(partner_account_id) where status = 'active';
create index partners_invite_idx on partners(invite_hash);
create index partners_email_confirm_idx on partners(email_confirm_hash);

create table events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  device_id uuid references devices(id) on delete set null,
  client_event_id text,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  -- pending | sent | no_partner | suppressed (throttled, waiting for a summary) | summarized | skipped (duplicate) | failed
  notify_status text not null default 'pending'
);
-- Server-made events have a null client_event_id; nulls never collide, so a plain unique index works
-- and lets upserts target it.
create unique index events_client_dedupe on events(device_id, client_event_id);
create index events_account_type_idx on events(account_id, type, received_at desc);

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  title text not null,
  body text not null,
  status text not null check (status in ('sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);
create index deliveries_partner_idx on deliveries(partner_id, created_at desc);

alter table accounts enable row level security;
alter table devices enable row level security;
alter table rules enable row level security;
alter table rule_changes enable row level security;
alter table partners enable row level security;
alter table events enable row level security;
alter table deliveries enable row level security;

-- Applies every looser change whose cooldown has passed, in one transaction.
create or replace function apply_due_rule_changes(p_account uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  n int := 0;
begin
  for c in
    select * from rule_changes
    where account_id = p_account and applied_at is null and cancelled_at is null and effective_at <= now()
    for update
  loop
    if c.kind = 'remove' then
      update rules set removed_at = now(), updated_at = now() where id = c.rule_id;
    else
      update rules
        set mode = c.after->>'mode',
            limit_minutes = nullif(c.after->>'limit_minutes', '')::int,
            updated_at = now()
        where id = c.rule_id;
    end if;
    update rule_changes set applied_at = now() where id = c.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function apply_due_rule_changes(uuid) from public, anon, authenticated;

create extension if not exists pg_cron;
create extension if not exists pg_net;
