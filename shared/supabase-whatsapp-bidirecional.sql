-- Estrutura para webhook bidirecional WhatsApp (Meta/Evolution)
-- Execute no SQL Editor do Supabase

create extension if not exists pgcrypto;

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,
  nome text,
  telefone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null unique references public.whatsapp_contacts(id) on delete cascade,
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  provider text not null check (provider in ('meta', 'evolution')),
  body text not null,
  provider_message_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_contacts_wa_id on public.whatsapp_contacts(wa_id);
create index if not exists idx_whatsapp_contacts_telefone on public.whatsapp_contacts(telefone);
create index if not exists idx_whatsapp_messages_conversation on public.whatsapp_messages(conversation_id, created_at desc);
create index if not exists idx_whatsapp_messages_provider_id on public.whatsapp_messages(provider_message_id);

create or replace function public.update_updated_at_column_whatsapp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_whatsapp_contacts_updated_at on public.whatsapp_contacts;
create trigger update_whatsapp_contacts_updated_at
before update on public.whatsapp_contacts
for each row execute function public.update_updated_at_column_whatsapp();

drop trigger if exists update_whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger update_whatsapp_conversations_updated_at
before update on public.whatsapp_conversations
for each row execute function public.update_updated_at_column_whatsapp();

notify pgrst, 'reload schema';
