create table if not exists public.community_messages (
  id text primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null default 'Responder',
  origin_node_id text,
  body text not null check (char_length(body) between 1 and 500),
  hop_count integer not null default 0 check (hop_count between 0 and 10),
  created_at timestamptz not null default now()
);

create index if not exists community_messages_created_at_idx on public.community_messages (created_at desc);
alter table public.community_messages enable row level security;
revoke all on public.community_messages from anon, authenticated;
grant select, insert on public.community_messages to authenticated;

drop policy if exists "Signed in community members read messages" on public.community_messages;
create policy "Signed in community members read messages"
  on public.community_messages for select to authenticated using (true);

drop policy if exists "Members publish their own community messages" on public.community_messages;
create policy "Members publish their own community messages"
  on public.community_messages for insert to authenticated
  with check (sender_id = (select auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_messages'
  ) then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end;
$$;
