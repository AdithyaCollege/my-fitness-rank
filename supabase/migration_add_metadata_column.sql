-- ============================================================
-- GymRank Migration: Add metadata JSONB Column to Profiles
-- Run this in Supabase SQL Editor (https://supabase.com)
-- ============================================================

-- Add metadata column to profiles table
alter table public.profiles add column if not exists metadata jsonb default '{}'::jsonb;
