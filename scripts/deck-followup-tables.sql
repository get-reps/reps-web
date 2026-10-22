-- Angel deck 30-minute follow-up: the two small tables behind it.
-- Apply once to the internal Cockpit Supabase project (ref ewddegddqbuyvlohhfun), the project that
-- DECK_SUPABASE_URL points at. NOT the app's production database, and not the project behind
-- SUPABASE_URL (support form). NOT applied by the code; apply BEFORE deploying.
-- The deck's own service-role key (DECK_SUPABASE_SERVICE_ROLE_KEY) is the only reader/writer:
-- RLS is on with no policies, so the public anon key can touch nothing.

create table if not exists public.deck_visits (
  id           text primary key,          -- hash of the session (or of the code request); no raw cookie
  kind         text not null check (kind in ('reading_code','reading_link','reading_forwarded','code_requested')),
  scope        text not null check (scope in ('session','email')),
  email        text not null,
  alerted_at   timestamptz not null,
  window_start timestamptz not null,
  channel      text not null,             -- Slack channel id of the alert
  thread_ts    text not null,             -- Slack ts of the alert: the reply goes under it
  replied_at   timestamptz,               -- set when the single reply slot is claimed
  dropped_at   timestamptz,
  attempts     int not null default 0
);

create index if not exists deck_visits_due_idx
  on public.deck_visits (alerted_at)
  where replied_at is null and dropped_at is null;

create table if not exists public.deck_events (
  id          bigint generated always as identity primary key,
  visit_id    text not null,
  email       text not null,
  kind        text not null check (kind in ('slide','video')),
  slide       text not null,
  slide_index int  not null,
  ms          int  not null,
  duration_ms int,
  created_at  timestamptz not null default now()
);

create index if not exists deck_events_visit_idx on public.deck_events (visit_id, created_at);
create index if not exists deck_events_email_idx on public.deck_events (email, created_at);
create index if not exists deck_events_age_idx   on public.deck_events (created_at);

alter table public.deck_visits enable row level security;
alter table public.deck_events enable row level security;
