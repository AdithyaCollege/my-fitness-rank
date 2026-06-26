-- ============================================================
-- GymRank Migration: Fix Group Members Foreign Key Relation
-- Run this in Supabase SQL Editor (https://supabase.com)
-- ============================================================

-- Drop the foreign key referencing auth.users
alter table public.group_members drop constraint if exists group_members_user_id_fkey;

-- Re-create it referencing public.profiles(id) so that PostgREST can perform join queries
alter table public.group_members add constraint group_members_user_id_fkey 
  foreign key (user_id) references public.profiles(id) on delete cascade;
