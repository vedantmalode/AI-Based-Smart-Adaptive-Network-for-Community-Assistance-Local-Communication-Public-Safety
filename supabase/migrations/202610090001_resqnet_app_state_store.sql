-- Persistent JSON document store used by the existing Node API.
-- Access is server-only; the service-role key must never be exposed to Vite.
create table if not exists public.resqnet_app_state (
  store_key text primary key check (store_key in ('incidents', 'community_messages', 'operational_units', 'profiles', 'accounts')),
  data jsonb not null default '[]'::jsonb check (jsonb_typeof(data) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.resqnet_app_state enable row level security;
revoke all on public.resqnet_app_state from public, anon, authenticated;
grant select, insert, update, delete on public.resqnet_app_state to service_role;
