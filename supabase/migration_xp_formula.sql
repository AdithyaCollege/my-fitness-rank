-- ============================================================
-- GymRank Migration: Revamped XP Formula (Sets/Reps/Weights)
-- Run this in Supabase SQL Editor (https://supabase.com)
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_workout_log()
RETURNS trigger AS $$
DECLARE
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
  set_record jsonb;
  set_weight numeric;
  set_reps integer;
  strength_xp numeric := 0;
BEGIN
  -- 1. Determine intensity multiplier
  IF new.intensity = 'Light' THEN
    intensity_mult := 1.0;
  ELSIF new.intensity = 'Moderate' THEN
    intensity_mult := 1.5;
  ELSIF new.intensity = 'Intense' THEN
    intensity_mult := 2.0;
  ELSE
    intensity_mult := 1.0;
  END IF;

  -- 2. Fetch current profile details
  SELECT last_workout_date, current_streak, longest_streak, total_xp
  INTO user_last_date, user_current_streak, user_longest_streak, new_total_xp
  FROM public.profiles
  WHERE id = new.user_id;

  -- Calculate streak
  IF user_last_date IS NULL THEN
    user_current_streak := 1;
  ELSIF today_date - user_last_date = 1 THEN
    user_current_streak := user_current_streak + 1;
  ELSIF today_date = user_last_date THEN
    -- Logged another workout today, streak does not change
    NULL;
  ELSE
    user_current_streak := 1;
  END IF;

  IF user_current_streak > user_longest_streak THEN
    user_longest_streak := user_current_streak;
  END IF;

  -- Streak multiplier (+5% per day, capped at +50% / 10 days)
  streak_mult := 1.0 + (LEAST(user_current_streak, 10) * 0.05);

  -- 3. Calculate Base XP
  -- If sets_reps is provided (Strength workout), calculate based on sets, weights, reps
  IF new.sets_reps IS NOT NULL AND jsonb_array_length(new.sets_reps) > 0 THEN
    FOR set_record IN SELECT * FROM jsonb_array_elements(new.sets_reps) LOOP
      set_weight := COALESCE((set_record->>'weight_lbs')::numeric, 0.0);
      set_reps := COALESCE((set_record->>'reps')::integer, 0);
      -- Formula per set: (10 + reps * 0.5 + weight * 0.02) * intensity_mult
      strength_xp := strength_xp + (10.0 + (set_reps * 0.5) + (set_weight * 0.02)) * intensity_mult;
    END loop;
    calculated_xp := ROUND(strength_xp * streak_mult);
  ELSE
    -- Fallback to duration-based XP for Cardio / HIIT / Yoga / etc.
    calculated_xp := ROUND((base_xp + (new.duration_min * intensity_mult)) * streak_mult);
  END IF;

  -- Set calculated XP on the new workout record
  new.xp_earned := calculated_xp;

  -- Update user profile with new stats
  new_total_xp := new_total_xp + calculated_xp;

  -- Determine new rank tier
  IF new_total_xp >= 7500 THEN
    new_rank := 'Champion';
  ELSIF new_total_xp >= 3500 THEN
    new_rank := 'Diamond';
  ELSIF new_total_xp >= 1500 THEN
    new_rank := 'Platinum';
  ELSIF new_total_xp >= 500 THEN
    new_rank := 'Gold';
  ELSIF new_total_xp >= 100 THEN
    new_rank := 'Silver';
  ELSE
    new_rank := 'Bronze';
  END IF;

  UPDATE public.profiles
  SET
    total_xp = new_total_xp,
    current_streak = user_current_streak,
    longest_streak = user_longest_streak,
    last_workout_date = today_date,
    rank_tier = new_rank
  WHERE id = new.user_id;

  RETURN new;
END;
$$ LANGUAGE plpgsql;
