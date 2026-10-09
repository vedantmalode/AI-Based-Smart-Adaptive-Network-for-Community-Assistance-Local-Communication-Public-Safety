-- Admin accounts are provisioned by an existing administrator or through a
-- trusted Supabase console. Public registration metadata never grants ADMIN.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('CITIZEN', 'VOLUNTEER', 'AUTHORITY', 'ADMIN'));

alter table public.profiles
  add column if not exists requested_role text check (requested_role is null or requested_role in ('CITIZEN', 'VOLUNTEER'));

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

grant update on public.profiles to authenticated;

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
  on public.profiles for select to authenticated
  using ((select public.resqnet_current_role()) = 'ADMIN');

drop policy if exists "Admins update user roles" on public.profiles;
create policy "Admins update user roles"
  on public.profiles for update to authenticated
  using ((select public.resqnet_current_role()) = 'ADMIN' and id <> (select auth.uid()))
  with check (role in ('CITIZEN', 'VOLUNTEER', 'AUTHORITY') and (requested_role is null or requested_role in ('CITIZEN', 'VOLUNTEER')));

drop policy if exists "Admins read resources" on public.operational_units;
create policy "Admins read resources"
  on public.operational_units for select to authenticated
  using ((select public.resqnet_current_role()) = 'ADMIN' and unit_type = 'RESOURCE');

drop policy if exists "Admins add resources" on public.operational_units;
create policy "Admins add resources"
  on public.operational_units for insert to authenticated
  with check ((select public.resqnet_current_role()) = 'ADMIN' and unit_type = 'RESOURCE');

drop policy if exists "Admins update resources" on public.operational_units;
create policy "Admins update resources"
  on public.operational_units for update to authenticated
  using ((select public.resqnet_current_role()) = 'ADMIN' and unit_type = 'RESOURCE')
  with check ((select public.resqnet_current_role()) = 'ADMIN' and unit_type = 'RESOURCE');
