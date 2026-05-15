-- Estrutura base para chat 1:1 com usuários autenticados
-- Execute este script no SQL Editor do Supabase

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  telefone text,
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation_created_at
  on public.messages(conversation_id, created_at);

create index if not exists idx_participants_user
  on public.conversation_participants(user_id);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant"
  on public.conversations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists "conversations_insert_authenticated" on public.conversations;
create policy "conversations_insert_authenticated"
  on public.conversations
  for insert
  to authenticated
  with check (true);

drop policy if exists "participants_select_if_member" on public.conversation_participants;
create policy "participants_select_if_member"
  on public.conversation_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists "participants_insert_authenticated" on public.conversation_participants;
create policy "participants_insert_authenticated"
  on public.conversation_participants
  for insert
  to authenticated
  with check (true);

drop policy if exists "messages_select_if_member" on public.messages;
create policy "messages_select_if_member"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert_sender_member" on public.messages;
create policy "messages_insert_sender_member"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );
