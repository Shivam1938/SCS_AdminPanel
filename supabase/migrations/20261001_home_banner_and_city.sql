-- SCS Admin: home banner storage and default service area.
-- Run this once in the Supabase SQL Editor before using Home banner settings.

create table if not exists public.app_settings (
  id text primary key,
  home_banner_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_admin_manage" on public.app_settings;
drop policy if exists "app_settings_authenticated_read" on public.app_settings;

create policy "app_settings_admin_manage"
on public.app_settings
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy "app_settings_authenticated_read"
on public.app_settings
for select
to authenticated
using (true);

-- The SCS service area discussed for the app is Greater Noida, Uttar Pradesh.
-- These defaults affect only newly inserted rows; existing user/address cities are untouched.
alter table public.profiles alter column city set default 'Greater Noida';
alter table public.addresses alter column city set default 'Greater Noida';
