-- Run this in Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.supermarkets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sections text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  supermarkets text[] not null default '{}',
  section_by_supermarket jsonb not null default '{}'::jsonb,
  is_bought boolean not null default false,
  bought_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  supermarkets text[] not null default '{}',
  section_by_supermarket jsonb not null default '{}'::jsonb,
  purchase_log text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.supermarkets
  add column if not exists sections text[] not null default '{}';

alter table public.products
  add column if not exists section_by_supermarket jsonb not null default '{}'::jsonb;

alter table public.templates
  add column if not exists section_by_supermarket jsonb not null default '{}'::jsonb;

update public.supermarkets
set sections = '{}'
where sections is null;

update public.products
set section_by_supermarket = '{}'::jsonb
where section_by_supermarket is null;

update public.templates
set section_by_supermarket = '{}'::jsonb
where section_by_supermarket is null;

create index if not exists products_created_at_idx on public.products (created_at desc);
create index if not exists templates_name_idx on public.templates (name);

alter table public.supermarkets enable row level security;
alter table public.products enable row level security;
alter table public.templates enable row level security;

drop policy if exists supermarkets_all on public.supermarkets;
create policy supermarkets_all on public.supermarkets
  for all using (true) with check (true);

drop policy if exists products_all on public.products;
create policy products_all on public.products
  for all using (true) with check (true);

drop policy if exists templates_all on public.templates;
create policy templates_all on public.templates
  for all using (true) with check (true);

insert into public.supermarkets (name, sections)
values
  ('Continente', '{}'),
  ('Pingo Doce', '{}'),
  ('Lidl', '{}'),
  ('Mercadona', '{}')
on conflict (name) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'supermarkets'
  ) then
    alter publication supabase_realtime add table public.supermarkets;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'templates'
  ) then
    alter publication supabase_realtime add table public.templates;
  end if;
end
$$;
