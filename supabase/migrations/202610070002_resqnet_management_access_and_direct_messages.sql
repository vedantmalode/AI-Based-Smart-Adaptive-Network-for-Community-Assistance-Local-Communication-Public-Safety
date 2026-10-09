-- Management accounts are trusted, provisioned accounts. Never grant this role
-- from public registration metadata.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('CITIZEN', 'VOLUNTEER', 'AUTHORITY', 'ADMIN', 'MANAGEMENT'));

alter table public.community_messages
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
create index if not exists community_messages_recipient_created_idx
  on public.community_messages (recipient_id, created_at desc);

-- Public SOS intake is separate from authenticated incident records. Citizens
-- can submit without email sign-in; only trusted management roles can read or
-- update the queue.
create table if not exists public.incident_requests (
  id text primary key,
  client_uuid text not null unique,
  category text not null,
  status text not null default 'REPORTED' check (status in ('REPORTED', 'VERIFIED', 'ASSIGNED', 'RESPONDING', 'RESOLVED', 'REJECTED')),
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  report jsonb not null,
  check (report ->> 'status' = status),
  check (report ->> 'category' = category),
  check (report ->> 'severity' = severity)
);
create index if not exists incident_requests_reported_at_idx on public.incident_requests (reported_at desc);
alter table public.incident_requests enable row level security;
revoke all on public.incident_requests from anon, authenticated;
grant insert on public.incident_requests to anon, authenticated;
grant select, update on public.incident_requests to authenticated;
drop policy if exists "Public submit direct incident requests" on public.incident_requests;
create policy "Public submit direct incident requests"
  on public.incident_requests for insert to anon, authenticated
  with check (status = 'REPORTED' and report ->> 'status' = 'REPORTED');
drop policy if exists "Management read direct incident requests" on public.incident_requests;
create policy "Management read direct incident requests"
  on public.incident_requests for select to authenticated
  using ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'));
drop policy if exists "Management update direct incident requests" on public.incident_requests;
create policy "Management update direct incident requests"
  on public.incident_requests for update to authenticated
  using ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'))
  with check ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'));

drop policy if exists "Signed in community members read messages" on public.community_messages;
drop policy if exists "Members publish their own community messages" on public.community_messages;
drop policy if exists "Members read group and direct messages" on public.community_messages;
drop policy if exists "Members send group and direct messages" on public.community_messages;
create policy "Members read group and direct messages"
  on public.community_messages for select to authenticated
  using (
    recipient_id is null
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );
create policy "Members send group and direct messages"
  on public.community_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (recipient_id is null or recipient_id <> (select auth.uid())));

drop policy if exists "Management read all profiles" on public.profiles;
create policy "Management read all profiles"
  on public.profiles for select to authenticated
  using ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'));

drop policy if exists "Management update user roles" on public.profiles;
create policy "Management update user roles"
  on public.profiles for update to authenticated
  using ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN') and id <> (select auth.uid()))
  with check (role in ('CITIZEN', 'VOLUNTEER', 'AUTHORITY') and (requested_role is null or requested_role in ('CITIZEN', 'VOLUNTEER')));

drop policy if exists "Management read incidents" on public.incidents;
create policy "Management read incidents"
  on public.incidents for select to authenticated
  using ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'));
drop policy if exists "Management create incident records" on public.incidents;
create policy "Management create incident records"
  on public.incidents for insert to authenticated
  with check ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'));
drop policy if exists "Management update incident records" on public.incidents;
create policy "Management update incident records"
  on public.incidents for update to authenticated
  using ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'))
  with check ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'));

drop policy if exists "Management read operational units" on public.operational_units;
create policy "Management read operational units"
  on public.operational_units for select to authenticated
  using ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'));
drop policy if exists "Management add operational units" on public.operational_units;
create policy "Management add operational units"
  on public.operational_units for insert to authenticated
  with check ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'));
drop policy if exists "Management update operational units" on public.operational_units;
create policy "Management update operational units"
  on public.operational_units for update to authenticated
  using ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'))
  with check ((select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'));

drop policy if exists "Management read incident evidence" on storage.objects;
create policy "Management read incident evidence"
  on storage.objects for select to authenticated
  using (bucket_id = 'incident-evidence' and (select public.resqnet_current_role()) in ('MANAGEMENT', 'ADMIN'));

-- Public signup always receives CITIZEN, regardless of user-supplied metadata.
create or replace function public.handle_new_resqnet_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name, requested_role)
  values (
    new.id,
    'CITIZEN',
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), new.phone),
    case when new.raw_user_meta_data ->> 'requested_role' = 'VOLUNTEER' then 'VOLUNTEER' else 'CITIZEN' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'incident_requests'
  ) then
    alter publication supabase_realtime add table public.incident_requests;
  end if;
end;
$$;
