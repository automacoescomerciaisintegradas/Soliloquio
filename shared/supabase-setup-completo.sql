-- Setup completo: CHAT + AUTOMAÇÕES (compatível com o app atual)
-- Execute no SQL Editor do Supabase

create extension if not exists pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'trigger_type') then
    create type public.trigger_type as enum ('MANUAL', 'WEBHOOK', 'SCHEDULE', 'EVENT_BASED');
  end if;

  if not exists (select 1 from pg_type where typname = 'integration_status') then
    create type public.integration_status as enum ('PENDING_CONFIGURATION', 'CONNECTED', 'DISCONNECTED', 'ERROR');
  end if;

  if not exists (select 1 from pg_type where typname = 'execution_status') then
    create type public.execution_status as enum ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SCHEDULED');
  end if;
end
$$;

-- ============================================================================
-- PERFIS (compatível com chat + automações)
-- Chat atual usa: id, nome, email, telefone
-- Automações usa também: name, company_name, phone, etc.
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text unique,
  telefone text,
  name text,
  company_name text,
  phone text,
  avatar_url text,
  subscription_plan text default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- garantir colunas caso tabela já exista antiga
alter table public.profiles add column if not exists nome text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists telefone text;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists company_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists subscription_plan text default 'free';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- ============================================================================
-- CHAT
-- ============================================================================
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

-- ============================================================================
-- AUTOMAÇÕES
-- ============================================================================
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_name text not null,
  display_name text not null,
  credentials jsonb not null default '{}'::jsonb,
  configuration jsonb default '{}'::jsonb,
  status integration_status default 'PENDING_CONFIGURATION',
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean default true,
  trigger_type trigger_type default 'MANUAL',
  trigger_config jsonb default '{}'::jsonb,
  webhook_url text,
  webhook_secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  step_order integer not null,
  step_type text not null,
  name text not null,
  description text,
  configuration jsonb not null default '{}'::jsonb,
  integration_id uuid references public.integrations(id),
  is_enabled boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_id, step_order)
);

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  status execution_status default 'PENDING',
  trigger_data jsonb default '{}'::jsonb,
  input_data jsonb default '{}'::jsonb,
  output_data jsonb default '{}'::jsonb,
  step_logs jsonb default '[]'::jsonb,
  error_message text,
  started_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_automations_user_id on public.automations(user_id);
create index if not exists idx_automations_webhook_url on public.automations(webhook_url) where webhook_url is not null;
create index if not exists idx_automation_steps_automation_id on public.automation_steps(automation_id);
create index if not exists idx_automation_executions_automation_id on public.automation_executions(automation_id);
create index if not exists idx_automation_executions_status on public.automation_executions(status);
create index if not exists idx_integrations_user_id on public.integrations(user_id);

-- ============================================================================
-- UPDATED_AT
-- ============================================================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

drop trigger if exists update_integrations_updated_at on public.integrations;
create trigger update_integrations_updated_at
before update on public.integrations
for each row execute function public.update_updated_at_column();

drop trigger if exists update_automations_updated_at on public.automations;
create trigger update_automations_updated_at
before update on public.automations
for each row execute function public.update_updated_at_column();

drop trigger if exists update_automation_steps_updated_at on public.automation_steps;
create trigger update_automation_steps_updated_at
before update on public.automation_steps
for each row execute function public.update_updated_at_column();

-- ============================================================================
-- CRIAR PERFIL AUTOMATICAMENTE AO CADASTRAR
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome, email, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.email)
  )
  on conflict (id) do update
  set email = excluded.email,
      nome = coalesce(public.profiles.nome, excluded.nome),
      name = coalesce(public.profiles.name, excluded.name),
      updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.integrations enable row level security;
alter table public.automations enable row level security;
alter table public.automation_steps enable row level security;
alter table public.automation_executions enable row level security;

-- profiles
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- chat
drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant"
  on public.conversations for select to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists "conversations_insert_authenticated" on public.conversations;
create policy "conversations_insert_authenticated"
  on public.conversations for insert to authenticated with check (true);

drop policy if exists "participants_select_if_member" on public.conversation_participants;
create policy "participants_select_if_member"
  on public.conversation_participants for select to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists "participants_insert_authenticated" on public.conversation_participants;
create policy "participants_insert_authenticated"
  on public.conversation_participants for insert to authenticated with check (true);

drop policy if exists "messages_select_if_member" on public.messages;
create policy "messages_select_if_member"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert_sender_member" on public.messages;
create policy "messages_insert_sender_member"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- automações
drop policy if exists "Users can manage their own integrations" on public.integrations;
create policy "Users can manage their own integrations"
  on public.integrations for all using (auth.uid() = user_id);

drop policy if exists "Users can manage their own automations" on public.automations;
create policy "Users can manage their own automations"
  on public.automations for all using (auth.uid() = user_id);

drop policy if exists "Users can manage steps of their own automations" on public.automation_steps;
create policy "Users can manage steps of their own automations"
  on public.automation_steps for all
  using (
    exists (
      select 1 from public.automations
      where automations.id = automation_steps.automation_id
        and automations.user_id = auth.uid()
    )
  );

drop policy if exists "Users can view executions of their own automations" on public.automation_executions;
create policy "Users can view executions of their own automations"
  on public.automation_executions for select
  using (
    exists (
      select 1 from public.automations
      where automations.id = automation_executions.automation_id
        and automations.user_id = auth.uid()
    )
  );

drop policy if exists "System can insert execution records" on public.automation_executions;
create policy "System can insert execution records"
  on public.automation_executions for insert with check (true);

drop policy if exists "System can update execution records" on public.automation_executions;
create policy "System can update execution records"
  on public.automation_executions for update using (true);

-- força recarga do schema PostgREST
notify pgrst, 'reload schema';

