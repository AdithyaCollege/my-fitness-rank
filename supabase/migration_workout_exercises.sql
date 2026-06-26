-- ============================================================
-- GymRank Migration: Workout Exercise Fields
-- Run this in Supabase SQL Editor (https://supabase.com)
-- ============================================================

-- Add new columns to workouts table
alter table public.workouts add column if not exists exercise_name text;
alter table public.workouts add column if not exists primary_muscle text;
