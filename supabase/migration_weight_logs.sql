-- ============================================================
-- GymRank Migration: Weight History & Logs Table
-- Run this in Supabase SQL Editor (https://supabase.com)
-- ============================================================

-- Create weight_logs table
create table if not exists public.weight_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  weight numeric not null,
  unit text not null check (unit in ('kg', 'lbs')),
  logged_date date default current_date not null,
  logged_time text not null check (logged_time in ('Morning', 'Afternoon', 'Evening')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.weight_logs enable row level security;

-- Create RLS Policies
create policy "Users can view their own weight logs" on public.weight_logs
  for select using (auth.uid() = user_id);

create policy "Users can insert their own weight logs" on public.weight_logs
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own weight logs" on public.weight_logs
  for update using (auth.uid() = user_id);

create policy "Users can delete their own weight logs" on public.weight_logs
  for delete using (auth.uid() = user_id);
