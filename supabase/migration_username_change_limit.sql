-- ============================================================
-- GymRank Migration: Gamertag Change Limits (2x a Month)
-- Run this in Supabase SQL Editor (https://supabase.com)
-- ============================================================

-- 1. Add columns to profiles table to track username changes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changes_this_month integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_username_change_at timestamp with time zone;

-- 2. Create the trigger function to enforce the 2x a month limit
CREATE OR REPLACE FUNCTION public.enforce_username_change_limit()
RETURNS trigger AS $$
DECLARE
  current_month_start timestamp;
BEGIN
  -- If username is not changing, or if the old username was null (initial onboarding setting), allow it!
  IF NEW.username IS DISTINCT FROM OLD.username AND OLD.username IS NOT NULL THEN
    current_month_start := date_trunc('month', current_date);
    
    -- If last change was in a previous month, reset the counter to 1
    IF OLD.last_username_change_at IS NULL OR OLD.last_username_change_at < current_month_start THEN
      NEW.username_changes_this_month := 1;
      NEW.last_username_change_at := now();
    ELSE
      -- Last change was this month. Check limit
      IF COALESCE(OLD.username_changes_this_month, 0) >= 2 THEN
        RAISE EXCEPTION 'You have already changed your gamertag 2 times this month. Changes are locked until next month.';
      END IF;
      
      NEW.username_changes_this_month := COALESCE(OLD.username_changes_this_month, 0) + 1;
      NEW.last_username_change_at := now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Bind the trigger function BEFORE UPDATE on public.profiles
DROP TRIGGER IF EXISTS on_profile_username_update ON public.profiles;
CREATE TRIGGER on_profile_username_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_username_change_limit();
