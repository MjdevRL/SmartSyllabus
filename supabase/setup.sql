-- Smart Syllabus: run this ONCE in Supabase (SQL Editor -> New query -> paste -> Run).
-- Visitors' accounts live in Supabase's built-in auth system (Authentication -> Users).
-- This file only adds the list of admin emails and a safe way for the website to ask "am I an admin?".

create table if not exists public.admins (
  email text primary key check (email = lower(email))   -- always stored in lower case
);

-- Nobody can read or change this table from the website. Only you, in the Supabase dashboard.
alter table public.admins enable row level security;

-- The website can only ask a yes/no question about the person who is signed in.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ADD YOURSELF: change the address below to the email you will sign in with, then run it.
insert into public.admins (email) values ('you@example.com') on conflict do nothing;
