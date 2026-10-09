create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'CITIZEN' check (role in ('CITIZEN', 'VOLUNTEER', 'AUTHORITY')),
  display_name text,
  volunteer_type text check (volunteer_type is null or volunteer_type in ('MEDICAL_RESPONDER', 'RESCUE_SQUAD', 'MEDIC_RESOURCE_VEHICLE')),
  volunteer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_resqnet_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (new.id, 'CITIZEN', coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_resqnet on auth.users;
create trigger on_auth_user_created_resqnet
  after insert on auth.users
  for each row execute procedure public.handle_new_resqnet_user();

insert into public.profiles (id, role, display_name)
select id, 'CITIZEN', coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

create or replace function public.resqnet_current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

revoke all on function public.resqnet_current_role() from public, anon;
grant execute on function public.resqnet_current_role() to authenticated;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Authorities read profiles" on public.profiles;
create policy "Authorities read profiles"
  on public.profiles for select to authenticated
  using ((select public.resqnet_current_role()) = 'AUTHORITY');

create table if not exists public.incidents (
  id text primary key,
  client_uuid text not null unique,
  reporter_id uuid not null references auth.users(id),
  category text not null,
  status text not null default 'REPORTED' check (status in ('REPORTED', 'PENDING_SYNC', 'VERIFIED', 'ASSIGNED', 'RESPONDING', 'RESOLVED', 'REJECTED')),
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  report jsonb not null,
  check (report ->> 'status' = status),
  check (report ->> 'category' = category),
  check (report ->> 'severity' = severity)
);

create index if not exists incidents_reported_at_idx on public.incidents (reported_at desc);
create index if not exists incidents_status_idx on public.incidents (status);
alter table public.incidents enable row level security;
revoke all on public.incidents from anon, authenticated;
grant select, insert, update on public.incidents to authenticated;

drop policy if exists "Responders and authorities read incidents" on public.incidents;
create policy "Responders and authorities read incidents"
  on public.incidents for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select public.resqnet_current_role()) in ('VOLUNTEER', 'AUTHORITY')
  );

drop policy if exists "Citizens submit their own incidents" on public.incidents;
create policy "Citizens submit their own incidents"
  on public.incidents for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'REPORTED');

drop policy if exists "Authorities create incident records" on public.incidents;
create policy "Authorities create incident records"
  on public.incidents for insert to authenticated
  with check ((select public.resqnet_current_role()) = 'AUTHORITY');

drop policy if exists "Authorities update incident records" on public.incidents;
create policy "Authorities update incident records"
  on public.incidents for update to authenticated
  using ((select public.resqnet_current_role()) = 'AUTHORITY')
  with check ((select public.resqnet_current_role()) = 'AUTHORITY');

create table if not exists public.operational_units (
  id text primary key,
  unit_type text not null check (unit_type in ('VOLUNTEER', 'RESOURCE')),
  owner_id uuid references auth.users(id) on delete set null,
  status text not null,
  updated_at timestamptz not null default now(),
  unit jsonb not null
);

alter table public.operational_units enable row level security;
revoke all on public.operational_units from anon, authenticated;
grant select, insert, update on public.operational_units to authenticated;

drop policy if exists "Responders read operational units" on public.operational_units;
create policy "Responders read operational units"
  on public.operational_units for select to authenticated
  using ((select public.resqnet_current_role()) in ('VOLUNTEER', 'AUTHORITY'));

drop policy if exists "Authorities add operational units" on public.operational_units;
create policy "Authorities add operational units"
  on public.operational_units for insert to authenticated
  with check ((select public.resqnet_current_role()) = 'AUTHORITY');

drop policy if exists "Authorities or owners update operational units" on public.operational_units;
create policy "Authorities or owners update operational units"
  on public.operational_units for update to authenticated
  using (
    (select public.resqnet_current_role()) = 'AUTHORITY'
    or (select id from public.profiles where id = (select auth.uid()) and role = 'VOLUNTEER' and volunteer_id = operational_units.id) is not null
  )
  with check (
    (select public.resqnet_current_role()) = 'AUTHORITY'
    or (select id from public.profiles where id = (select auth.uid()) and role = 'VOLUNTEER' and volunteer_id = operational_units.id) is not null
  );

create or replace function public.accept_resqnet_assignment(p_incident_id text, p_resource_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  volunteer_profile public.profiles%rowtype;
  incident_row public.incidents%rowtype;
  volunteer_unit public.operational_units%rowtype;
  resource_unit public.operational_units%rowtype;
  now_at timestamptz := now();
  next_report jsonb;
begin
  select * into volunteer_profile from public.profiles where id = auth.uid() and role = 'VOLUNTEER';
  if volunteer_profile.id is null or volunteer_profile.volunteer_id is null then
    raise exception 'A linked volunteer profile is required to accept an assignment.' using errcode = '42501';
  end if;
  select * into incident_row from public.incidents where id = p_incident_id for update;
  if incident_row.id is null or incident_row.status in ('RESOLVED', 'REJECTED') then
    raise exception 'This incident is not available for assignment.' using errcode = 'P0002';
  end if;
  select * into volunteer_unit from public.operational_units where id = volunteer_profile.volunteer_id and unit_type = 'VOLUNTEER' for update;
  if volunteer_unit.id is null then
    raise exception 'The linked volunteer unit does not exist.' using errcode = 'P0002';
  end if;
  if p_resource_id is not null then
    select * into resource_unit from public.operational_units where id = p_resource_id and unit_type = 'RESOURCE' and status = 'AVAILABLE' for update;
    if resource_unit.id is null then
      raise exception 'The requested response asset is no longer available.' using errcode = 'P0002';
    end if;
  end if;

  next_report := incident_row.report || jsonb_build_object(
    'status', 'RESPONDING',
    'assignedVolunteers', case when coalesce(incident_row.report -> 'assignedVolunteers', '[]'::jsonb) @> jsonb_build_array(volunteer_profile.volunteer_id)
      then coalesce(incident_row.report -> 'assignedVolunteers', '[]'::jsonb)
      else coalesce(incident_row.report -> 'assignedVolunteers', '[]'::jsonb) || jsonb_build_array(volunteer_profile.volunteer_id) end,
    'assignedResources', case when p_resource_id is null then coalesce(incident_row.report -> 'assignedResources', '[]'::jsonb)
      when coalesce(incident_row.report -> 'assignedResources', '[]'::jsonb) @> jsonb_build_array(p_resource_id) then coalesce(incident_row.report -> 'assignedResources', '[]'::jsonb)
      else coalesce(incident_row.report -> 'assignedResources', '[]'::jsonb) || jsonb_build_array(p_resource_id) end,
    'updatedAt', now_at
  );
  next_report := jsonb_set(next_report, '{lifecycle}', coalesce(next_report -> 'lifecycle', '{}'::jsonb) || jsonb_build_object(
    'assignedAt', coalesce(next_report #> '{lifecycle,assignedAt}', to_jsonb(now_at)),
    'respondingAt', coalesce(next_report #> '{lifecycle,respondingAt}', to_jsonb(now_at))
  ), true);
  next_report := jsonb_set(next_report, '{auditTimeline}', coalesce(next_report -> 'auditTimeline', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'at', now_at,
    'time', to_char(now_at, 'HH12:MI:SS AM'),
    'event', 'Volunteer accepted dispatch assignment',
    'by', volunteer_profile.display_name
  )), true);

  update public.incidents set status = 'RESPONDING', report = next_report, updated_at = now_at where id = p_incident_id;
  update public.operational_units set status = 'DISPATCHED', unit = unit || jsonb_build_object('status', 'DISPATCHED', 'availability', 'On Mission (' || p_incident_id || ')'), updated_at = now_at where id = volunteer_unit.id;
  if p_resource_id is not null then
    update public.operational_units set status = 'DISPATCHED', unit = unit || jsonb_build_object('status', 'DISPATCHED', 'isLiveTracking', true), updated_at = now_at where id = p_resource_id;
  end if;
  return next_report;
end;
$$;

revoke all on function public.accept_resqnet_assignment(text, text) from public, anon;
grant execute on function public.accept_resqnet_assignment(text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('incident-evidence', 'incident-evidence', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload evidence to their own folder" on storage.objects;
create policy "Users upload evidence to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'incident-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Responders can read incident evidence" on storage.objects;
create policy "Responders can read incident evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'incident-evidence'
    and (
      owner_id = (select auth.uid())::text
      or (select public.resqnet_current_role()) in ('VOLUNTEER', 'AUTHORITY')
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'incidents'
  ) then
    alter publication supabase_realtime add table public.incidents;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'operational_units'
  ) then
    alter publication supabase_realtime add table public.operational_units;
  end if;
end;
$$;
