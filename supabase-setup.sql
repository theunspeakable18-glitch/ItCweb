-- GitGud database setup for Supabase.
-- Open your project -> SQL Editor -> New query, paste this whole file, press Run.
-- It is safe to run more than once.

-- =====================================================================
-- 1. Profiles: one row per account, holds the username
-- =====================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  created_at  timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

-- Usernames must be unique, ignoring upper/lower case
create unique index if not exists profiles_username_unique
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles: read your own" on public.profiles;
create policy "profiles: read your own"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- Create the profile automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 2. Bookings
-- =====================================================================
create table if not exists public.bookings (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game        text not null check (game in ('Valorant', 'CS2', 'LoL')),
  skill       text not null check (skill ~ '^[A-Za-z]{2,20}$'),
  trainer_id  text not null check (trainer_id ~ '^[a-z0-9]{2,6}$'),
  date        date not null,
  hour        smallint not null check (hour between 0 and 23),
  created_at  timestamptz not null default now(),
  unique (trainer_id, date, hour)          -- the database blocks double bookings
);

alter table public.bookings enable row level security;

-- Any logged-in user can see which slots are taken (the site never shows who took them)
drop policy if exists "bookings: see taken slots" on public.bookings;
create policy "bookings: see taken slots"
  on public.bookings for select to authenticated
  using (true);

-- You can only create bookings for yourself
drop policy if exists "bookings: book as yourself" on public.bookings;
create policy "bookings: book as yourself"
  on public.bookings for insert to authenticated
  with check (user_id = (select auth.uid()));

-- You can only cancel your own bookings
drop policy if exists "bookings: cancel your own" on public.bookings;
create policy "bookings: cancel your own"
  on public.bookings for delete to authenticated
  using (user_id = (select auth.uid()));

-- No update policy on purpose: to change a booking, cancel it and book again.

-- Rules the database enforces itself, so nobody can skip them by calling the API directly
create or replace function public.check_booking()
returns trigger
language plpgsql
as $$
begin
  -- Not in the past (times are Philippine time)
  if ((new.date + make_interval(hours => new.hour::int)) at time zone 'Asia/Manila') <= now() then
    raise exception 'That time has already passed.';
  end if;

  -- At most 10 upcoming sessions per account
  if (select count(*) from public.bookings
        where user_id = new.user_id
          and date >= (now() at time zone 'Asia/Manila')::date) >= 10 then
    raise exception 'You can have up to 10 upcoming sessions.';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_check on public.bookings;
create trigger bookings_check
  before insert on public.bookings
  for each row execute function public.check_booking();

-- =====================================================================
-- 3. Permissions (RLS above decides which rows; this decides which actions)
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.bookings to authenticated;
