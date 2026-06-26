-- GymRank Postgres Schema Setup
-- Run this in your Supabase project's SQL Editor (https://supabase.com)

-- 1. Create Profiles Table (extends Supabase Auth users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  avatar_url text,
  total_xp integer default 0 not null,
  current_streak integer default 0 not null,
  longest_streak integer default 0 not null,
  rank_tier text default 'Bronze' not null,
  last_workout_date date,
  onboarded boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Workouts Table
create table public.workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text not null,
  duration_min integer not null,
  intensity text not null check (intensity in ('Light', 'Moderate', 'Intense')),
  sets_reps jsonb, -- Flexible list of sets/reps: e.g. [{"weight": 60, "reps": 10}, {"weight": 60, "reps": 8}]
  notes text,
  xp_earned integer default 0 not null,
  logged_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Groups (Squads) Table
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references auth.users on delete cascade not null,
  invite_code text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create Group Members Table
create table public.group_members (
  group_id uuid references public.groups on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (group_id, user_id)
);

-- 5. Create Leaderboards Views
-- Global leaderboard
create or replace view public.global_leaderboard with (security_invoker = true) as
select id, username, avatar_url, total_xp, rank_tier, current_streak
from public.profiles
where username is not null
order by total_xp desc;

-- 6. Trigger: Automatically Create Profile on Auth Signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url, total_xp, current_streak, longest_streak, rank_tier, onboarded)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'custom_username', split_part(new.email, '@', 1)), -- default username is email prefix
    new.raw_user_meta_data->>'avatar_url',
    0,
    0,
    0,
    'Bronze',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. Trigger: Automatically Calculate Workout XP, Streaks & Rank Tiers
create or replace function public.process_workout_log()
returns trigger as $$
declare
  base_xp numeric := 10.0;
  intensity_mult numeric;
  streak_mult numeric;
  calculated_xp integer;
  user_last_date date;
  user_current_streak integer;
  user_longest_streak integer;
  new_total_xp integer;
  new_rank text;
  today_date date := current_date;
begin
  -- Determine intensity multiplier
  if new.intensity = 'Light' then
    intensity_mult := 1.0;
  elsif new.intensity = 'Moderate' then
    intensity_mult := 1.5;
  elsif new.intensity = 'Intense' then
    intensity_mult := 2.0;
  else
    intensity_mult := 1.0;
  end if;

  -- Fetch current profile details
  select last_workout_date, current_streak, longest_streak, total_xp
  into user_last_date, user_current_streak, user_longest_streak, new_total_xp
  from public.profiles
  where id = new.user_id;

  -- Calculate streak
  if user_last_date is null then
    user_current_streak := 1;
  elsif today_date - user_last_date = 1 then
    user_current_streak := user_current_streak + 1;
  elsif today_date = user_last_date then
    -- Logged another workout today, streak does not change
    null;
  else
    user_current_streak := 1;
  end if;

  if user_current_streak > user_longest_streak then
    user_longest_streak := user_current_streak;
  end if;

  -- Calculate XP: XP = (Base + Duration * IntensityMultiplier) * StreakMultiplier
  -- Streak multiplier is +5% per day, capped at +50% (10 days)
  streak_mult := 1.0 + (least(user_current_streak, 10) * 0.05);
  calculated_xp := round((base_xp + (new.duration_min * intensity_mult)) * streak_mult);

  -- Set calculated XP on the new workout record
  new.xp_earned := calculated_xp;

  -- Update user profile with new stats
  new_total_xp := new_total_xp + calculated_xp;

  -- Determine new rank tier
  if new_total_xp >= 7500 then
    new_rank := 'Champion';
  elsif new_total_xp >= 3500 then
    new_rank := 'Diamond';
  elsif new_total_xp >= 1500 then
    new_rank := 'Platinum';
  elsif new_total_xp >= 500 then
    new_rank := 'Gold';
  elsif new_total_xp >= 100 then
    new_rank := 'Silver';
  else
    new_rank := 'Bronze';
  end if;

  update public.profiles
  set
    total_xp = new_total_xp,
    current_streak = user_current_streak,
    longest_streak = user_longest_streak,
    last_workout_date = today_date,
    rank_tier = new_rank
  where id = new.user_id;

  return new;
end;
$$ language plpgsql;

create trigger on_workout_logged
  before insert on public.workouts
  for each row execute procedure public.process_workout_log();

-- 8. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- 9. Create RLS Policies
-- Profiles Policies
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Workouts Policies
create policy "Workouts are viewable by workout owner" on public.workouts
  for select using (auth.uid() = user_id);

create policy "Users can log their own workouts" on public.workouts
  for insert with check (auth.uid() = user_id);

create policy "Users can update/delete their own workouts" on public.workouts
  for all using (auth.uid() = user_id);

-- Groups Policies
create policy "Groups are viewable by anyone" on public.groups
  for select using (true);

create policy "Authenticated users can create groups" on public.groups
  for insert with check (auth.role() = 'authenticated');

create policy "Group owners can update/delete groups" on public.groups
  for all using (auth.uid() = owner_id);

-- Group Members Policies
create policy "Group members are viewable by anyone" on public.group_members
  for select using (true);

create policy "Users can join groups" on public.group_members
  for insert with check (auth.uid() = user_id);

create policy "Users can leave groups" on public.group_members
  for delete using (auth.uid() = user_id);
