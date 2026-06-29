import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Theme, getRankDetails, RankTier } from '@/theme/theme';
import { useRouter, useFocusEffect } from 'expo-router';
import { Flame, Dumbbell, Trophy, ChevronRight, Zap, Award, Bell, Rocket, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';

export default function DashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [workedOutDays, setWorkedOutDays] = useState<number[]>([]);
  const [showAnimation, setShowAnimation] = useState(false);
  const [lastWorkoutCount, setLastWorkoutCount] = useState<number | null>(null);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      setProfile(profileData);

      // Get recent workouts
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(3);
      
      if (workoutError) throw workoutError;
      setRecentWorkouts(workoutData || []);

      // Get week workouts to populate the streak calendar circles
      const today = new Date();
      const currentDayOfWeek = today.getDay();
      
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - currentDayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() - currentDayOfWeek + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const { data: weekWorkoutsData, error: weekWorkoutsError } = await supabase
        .from('workouts')
        .select('logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', startOfWeek.toISOString())
        .lte('logged_at', endOfWeek.toISOString());

      if (weekWorkoutsError) throw weekWorkoutsError;

      if (weekWorkoutsData) {
        const days = weekWorkoutsData.map((w: any) => new Date(w.logged_at).getDate());
        setWorkedOutDays([...new Set(days)]);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    // Subscribe to realtime profile changes for current user
    let channel: any;
    async function subscribe() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`dashboard-profile-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            setProfile(payload.new);
          }
        )
        .subscribe();
    }
    subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  useEffect(() => {
    if (recentWorkouts.length === 0) return;

    // Check if there is a workout logged today
    const hasToday = recentWorkouts.some(workout => 
      new Date(workout.logged_at).toDateString() === new Date().toDateString()
    );

    if (hasToday) {
      if (lastWorkoutCount === null || recentWorkouts.length > lastWorkoutCount) {
        setShowAnimation(true);
        const timer = setTimeout(() => {
          setShowAnimation(false);
        }, 1000);
        setLastWorkoutCount(recentWorkouts.length);
        return () => clearTimeout(timer);
      }
    }
    setLastWorkoutCount(recentWorkouts.length);
  }, [recentWorkouts]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ddb7ff" />
      </View>
    );
  }

  // Calculate Rank Progress
  const rank = getRankDetails(profile?.total_xp ?? 0);
  const nextRanks: { [key in RankTier]: RankTier | 'Max' } = {
    Bronze: 'Silver',
    Silver: 'Gold',
    Gold: 'Platinum',
    Platinum: 'Diamond',
    Diamond: 'Champion',
    Champion: 'Max',
  };
  const nextRankName = nextRanks[rank.name as RankTier];
  const nextRank = nextRankName !== 'Max' ? Theme.ranks[nextRankName] : null;

  let progressPercent = 1;
  let xpRemaining = 0;
  if (nextRank) {
    const range = nextRank.minXp - rank.minXp;
    const earned = (profile?.total_xp ?? 0) - rank.minXp;
    progressPercent = Math.max(0, Math.min(100, (earned / range) * 100));
    xpRemaining = nextRank.minXp - (profile?.total_xp ?? 0);
  } else {
    progressPercent = 100; // max rank
  }

  // Helper to generate calendar days for current week
  const getWeekDays = () => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const week = [];
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(today);
      day.setDate(today.getDate() - currentDayOfWeek + i);
      week.push({
        dayName: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.getDay()],
        dayNum: day.getDate(),
        isToday: day.toDateString() === today.toDateString(),
      });
    }
    return week;
  };

  const getMonthYearString = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  const renderAvatar = () => {
    const avatarUrl = profile?.avatar_url;
    const isUrl = avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('https'));
    if (isUrl) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatarImage}
        />
      );
    }
    return (
      <Text style={styles.avatarEmojiText}>
        {avatarUrl?.split(' ')[0] || '🦊'}
      </Text>
    );
  };

  return (
    <View style={styles.rootContainer}>
      {/* Background radial gradient color simulation */}
      <LinearGradient
        colors={['rgba(73, 0, 128, 0.45)', '#101415']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Top AppBar */}
        <View style={styles.topAppBar}>
          <View style={styles.userInfo}>
            <View style={styles.avatarWrapper}>
              {renderAvatar()}
            </View>
            <Text style={styles.gamertagText}>{profile?.username || 'Gemini place Gamer Tag'}</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationBtn}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Notifications', 'You have no new notifications.')}
          >
            <Bell size={20} color="#e0e3e5" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ddb7ff"
            />
          }
        >
          {/* Calendar Strip Section */}
          <View style={styles.calendarContainer}>
            <Text style={styles.calendarMonthText}>{getMonthYearString()}</Text>
            <View style={styles.calendarDaysRow}>
              {getWeekDays().map((day, idx) => {
                const dayWorkedOut = workedOutDays.includes(day.dayNum);
                const isToday = day.isToday;

                return (
                  <View key={idx} style={styles.calendarDayCol}>
                    {isToday && <View style={styles.activeDayIndicatorBg} />}
                    <Text style={[styles.dayNameText, isToday && styles.activeDayNameText]}>
                      {day.dayName}
                    </Text>
                    
                    {dayWorkedOut ? (
                      isToday && showAnimation ? (
                        <View style={[
                          styles.dayCircle,
                          styles.greenTickCircle,
                          Theme.getGlow('#10B981', 'medium')
                        ]}>
                          <Check size={18} color="#10B981" strokeWidth={3} />
                        </View>
                      ) : (
                        <View style={[
                          styles.dayCircle,
                          styles.activeDayCircle,
                          Theme.getGlow('#ddb7ff', 'medium')
                        ]}>
                          <Text style={[styles.dayNumText, styles.activeDayNumText]}>
                            {day.dayNum}
                          </Text>
                        </View>
                      )
                    ) : (
                      <View style={styles.dayCircle}>
                        <Text style={styles.dayNumText}>
                          {day.dayNum}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Hero Card */}
          <BlurView intensity={25} tint="dark" style={styles.heroCard}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
              style={StyleSheet.absoluteFill}
            />
            
            <View style={styles.heroTopRow}>
              <View style={styles.xpCol}>
                <Text style={styles.xpLabel}>TOTAL XP</Text>
                <Text style={styles.xpValueText}>{profile?.total_xp ?? 165}</Text>
              </View>
              
              <View style={styles.streakBadge}>
                <Flame size={24} color="#ddb7ff" fill="#ddb7ff" />
                <View style={styles.streakTextCol}>
                  <Text style={styles.streakCountText}>{profile?.current_streak ?? 2}</Text>
                  <Text style={styles.streakLabelText}>STREAK</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroMiddleRow}>
              <View style={styles.tierInfoBox}>
                <Trophy size={16} color={rank.color} />
                <Text style={[styles.tierNameText, { color: rank.color }]}>{rank.name}</Text>
              </View>
              {nextRank ? (
                <Text style={styles.xpRemainingText}>{xpRemaining} XP to {nextRankName}</Text>
              ) : (
                <Text style={styles.xpRemainingText}>MAX RANK REACHED</Text>
              )}
            </View>

            <View style={styles.progressBarBg}>
              <LinearGradient
                colors={['#ddb7ff', '#842bd2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%` }
                ]}
              />
            </View>
          </BlurView>

          {/* Daily Challenge Card */}
          <BlurView intensity={25} tint="dark" style={styles.challengeCard}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.challengeRow}>
              <View style={styles.challengeLeft}>
                <Text style={styles.challengeTitle}>Daily Challenge</Text>
                <Text style={styles.challengeDesc}>
                  Note: This is where there who be daily challenges to gain extra XP
                </Text>
                
                <TouchableOpacity
                  style={[styles.beginChallengeBtn, Theme.getGlow('#ddb7ff', 'medium')]}
                  activeOpacity={0.8}
                  onPress={() => Alert.alert('Daily Challenge', 'Challenge started! Log your next workout to unlock the bonus.')}
                >
                  <Rocket size={16} color="#400071" />
                  <Text style={styles.beginChallengeBtnText}>Begin Challenge</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.mascotWrapper}>
                <View style={styles.mascotGlowBg} />
                <Image
                  source={{ uri: 'https://lh3.googleusercontent.com/aida/AP1WRLvxCaUKl4C_TiomXV5bl991a2C30UejUj1wjaBfrjSLS8CYeVdDQCnkBwqDw4knrTFTA54RKcnugzDty0_4vKSaT_RJBCtWvA0mzIkXyoJZTZMlrMUyyNXXpzceRXhSqeoURyI4IPuY1Uplwiv0l8Iwxo0laX0W9EHpip27-pq5kwwhCaYErClaeST9-4zOB5JxH67-vBZMwhVqV_hOFZ-YIg7fogeovUSxQ80OgJ9EXEZr_Zhd7onaUg' }}
                  style={styles.mascotImage}
                />
              </View>
            </View>
          </BlurView>

          {/* Log New Workout Button */}
          <TouchableOpacity
            style={[styles.logWorkoutBtn, Theme.getGlow('#ddb7ff', 'medium')]}
            activeOpacity={0.7}
            onPress={() => router.push('/log-workout')}
          >
            <View style={styles.logWorkoutLeft}>
              <Dumbbell size={18} color="#400071" strokeWidth={2.5} />
              <Text style={styles.logWorkoutText}>LOG NEW WORKOUT</Text>
            </View>
            <ChevronRight size={18} color="#400071" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Daily Summary Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Summary</Text>
            <TouchableOpacity onPress={() => router.push('/profile')}>
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          </View>

          {/* Summary List / Empty State */}
          {recentWorkouts.length === 0 ? (
            <View style={styles.fullEmptyContainer}>
              <LinearGradient
                colors={['rgba(221, 183, 255, 0.08)', 'rgba(221, 183, 255, 0.02)']}
                style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
              />
              <View style={styles.emptyIllustrationBox}>
                <Dumbbell size={40} color="#ddb7ff" />
              </View>
              <Text style={styles.fullEmptyTitle}>Ready to Level Up?</Text>
              <Text style={styles.fullEmptySubtext}>
                You haven't logged any workouts yet. Tap below to record your first workout, earn 50 XP, and unlock your rank!
              </Text>
              <TouchableOpacity
                style={[styles.fullEmptyLogButton, Theme.getGlow('#ddb7ff', 'medium')]}
                onPress={() => router.push('/log-workout')}
              >
                <Dumbbell size={18} color="#400071" strokeWidth={2.5} />
                <Text style={styles.fullEmptyLogButtonText}>LOG YOUR FIRST WORKOUT</Text>
                <ChevronRight size={16} color="#400071" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.workoutListContainer}>
              {recentWorkouts.map((workout, index) => {
                // Map workout intensity/type to custom theme colors from the Stitch mockup
                let iconBg = '#1d1238';
                let iconColor = '#c084fc';
                let badgeBg = '#2a1b4e';
                let badgeText = '#c084fc';
                let tag = 'Strength';
                let IconComponent = Dumbbell;

                if (workout.type.toLowerCase().includes('run') || workout.type.toLowerCase().includes('cardio') || workout.type.toLowerCase().includes('cycl')) {
                  iconBg = '#361e12';
                  iconColor = '#fb923c';
                  badgeBg = '#4a2817';
                  badgeText = '#fb923c';
                  tag = 'Calories';
                  IconComponent = Flame;
                } else if (workout.intensity === 'Light') {
                  iconBg = '#11261d';
                  iconColor = '#4ade80';
                  badgeBg = '#193628';
                  badgeText = '#4ade80';
                  tag = 'Recovery';
                  IconComponent = Zap;
                }

                return (
                  <BlurView key={workout.id || index} intensity={25} tint="dark" style={styles.summaryCard}>
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
                      style={StyleSheet.absoluteFill}
                    />
                    
                    <View style={[styles.summaryIconBox, { backgroundColor: iconBg }]}>
                      <IconComponent size={22} color={iconColor} />
                    </View>

                    <View style={styles.summaryContent}>
                      <Text style={styles.summaryTitle} numberOfLines={1}>
                        {workout.exercise_name || workout.type}
                      </Text>
                      <Text style={styles.summarySubtitle} numberOfLines={1}>
                        {workout.notes || 'Workout recorded successfully.'}
                      </Text>
                    </View>

                    <View style={styles.summaryRight}>
                      <View style={[styles.summaryBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.summaryBadgeText, { color: badgeText }]}>{tag}</Text>
                      </View>
                      <Text style={styles.summaryTime}>
                        {new Date(workout.logged_at).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </BlurView>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#101415',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#101415',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
  },
  topAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.3)',
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEmojiText: {
    fontSize: 22,
    textAlign: 'center',
  },
  gamertagText: {
    color: '#e0e3e5',
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
    gap: 20,
  },
  calendarContainer: {
    paddingHorizontal: 4,
    gap: 12,
  },
  calendarMonthText: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  calendarDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarDayCol: {
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  activeDayIndicatorBg: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: -4,
    right: -4,
    backgroundColor: 'rgba(39, 42, 44, 0.45)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
  },
  dayNameText: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
  },
  activeDayNameText: {
    color: '#e0e3e5',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  activeDayCircle: {
    borderColor: '#ddb7ff',
    borderWidth: 2,
    backgroundColor: 'rgba(16, 20, 21, 0.5)',
  },
  dayNumText: {
    color: '#e0e3e5',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  activeDayNumText: {
    fontFamily: 'Inter_800ExtraBold',
  },
  heroCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    padding: 20,
    gap: 16,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  xpCol: {
    gap: 2,
  },
  xpLabel: {
    color: 'rgba(224, 227, 229, 0.7)',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  xpValueText: {
    color: '#e0e3e5',
    fontSize: 36,
    fontFamily: 'Inter_900Black',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(221, 183, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(221, 183, 255, 0.3)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  streakTextCol: {
    gap: 2,
  },
  streakCountText: {
    color: '#e0e3e5',
    fontSize: 20,
    fontFamily: 'Inter_900Black',
    lineHeight: 20,
  },
  streakLabelText: {
    color: 'rgba(224, 227, 229, 0.7)',
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  heroMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierNameText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  xpRemainingText: {
    color: 'rgba(224, 227, 229, 0.7)',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  challengeCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    padding: 20,
    overflow: 'hidden',
  },
  challengeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  challengeLeft: {
    flex: 1,
    gap: 10,
  },
  challengeTitle: {
    color: '#ddb7ff',
    fontSize: 18,
    fontFamily: 'Inter_800ExtraBold',
  },
  challengeDesc: {
    color: '#cfc2d6',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  beginChallengeBtn: {
    height: 40,
    backgroundColor: '#ddb7ff',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  beginChallengeBtnText: {
    color: '#400071',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  mascotWrapper: {
    width: 100,
    height: 100,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mascotGlowBg: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(221, 183, 255, 0.25)',
  },
  mascotImage: {
    width: '100%',
    height: '100%',
  },
  logWorkoutBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ddb7ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  logWorkoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logWorkoutText: {
    color: '#400071',
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#e0e3e5',
    fontSize: 18,
    fontFamily: 'Inter_800ExtraBold',
  },
  viewAllText: {
    color: '#ddb7ff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  workoutListContainer: {
    gap: 12,
  },
  summaryCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  summaryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  summaryContent: {
    flex: 1,
    gap: 4,
  },
  summaryTitle: {
    color: '#e0e3e5',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  summarySubtitle: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  summaryRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  summaryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  summaryBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    textTransform: 'uppercase',
  },
  summaryTime: {
    color: '#cfc2d6',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  fullEmptyContainer: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(221, 183, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 10,
  },
  emptyIllustrationBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(221, 183, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(221, 183, 255, 0.3)',
  },
  fullEmptyTitle: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'Inter_800ExtraBold',
    textAlign: 'center',
  },
  fullEmptySubtext: {
    color: '#cfc2d6',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  fullEmptyLogButton: {
    height: 50,
    backgroundColor: '#ddb7ff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  fullEmptyLogButtonText: {
    color: '#400071',
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.5,
  },
  greenTickCircle: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
});
