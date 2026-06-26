-- ============================================================
-- GymRank Migration: Enhanced Profile Fields
-- Run this in Supabase SQL Editor (https://supabase.com)
-- ============================================================

-- 1. Add new columns to profiles table
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists height_cm numeric;
alter table public.profiles add column if not exists weight_kg numeric;
alter table public.profiles add column if not exists fitness_goal text;
alter table public.profiles add column if not exists experience_level text;
alter table public.profiles add column if not exists bio text;

-- 2. Update handle_new_user() trigger to pull display_name from Google metadata
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, username, display_name, avatar_url,
    total_xp, current_streak, longest_streak, rank_tier, onboarded
  )
  values (
    new.id,
    null, -- username is set during onboarding
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    0, 0, 0, 'Bronze', false
  )
  on conflict (id) do update set
    display_name = coalesce(
      excluded.display_name,
      public.profiles.display_name
    );
  return new;
end;
$$ language plpgsql security definer;

-- 3. Username availability check function (called from the app)
create or replace function public.check_username_available(requested_username text)
returns boolean as $$
begin
  return not exists (
    select 1 from public.profiles
    where lower(username) = lower(requested_username)
  );
end;
$$ language plpgsql security definer;

-- 4. Update global leaderboard view to include display_name
drop view if exists public.global_leaderboard;
create view public.global_leaderboard with (security_invoker = true) as
select
  id,
  username,
  display_name,
  avatar_url,
  total_xp,
  rank_tier,
  current_streak
from public.profiles
where username is not null and onboarded = true
order by total_xp desc;

-- Done! Verify by checking the profiles table in Table Editor.
