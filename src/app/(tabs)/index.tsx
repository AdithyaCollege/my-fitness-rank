import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Theme, getRankDetails, RankTier } from '@/theme/theme';
import { useRouter, useFocusEffect } from 'expo-router';
import { Flame, Dumbbell, Trophy, ChevronRight, Zap, Award } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function DashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);

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

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning ☀️';
    if (hour < 17) return 'Good Afternoon 🌤';
    return 'Good Evening 🌙';
  };

  return (
    <LinearGradient
      colors={['#06060C', '#120A2B', '#1C123E']}
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={['rgba(124, 58, 237, 0.78)', 'rgba(124, 58, 237, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.6 }}
        style={styles.ambientGlowTop}
      />
      <View style={styles.ambientGlowBottom} />

      <SafeAreaView style={styles.safeArea}>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.avatarEmoji}>{profile?.avatar_url?.split(' ')[0] || '🦊'}</Text>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
        >
          {/* Hey, User Header */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Hey, {profile?.username || 'Gamer'}</Text>
            <Text style={styles.welcomeSubtext}>Your AI is ready to optimize today</Text>
          </View>

          <BlurView intensity={25} tint="dark" style={styles.heroCard}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.01)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroRow}>
              {/* XP and Rank Display */}
              <View style={styles.xpCol}>
                <Text style={styles.xpLabel}>TOTAL XP</Text>
                <Text style={[
                  styles.xpText,
                  { color: '#FFF' },
                  Theme.getGlow(rank.color, 'high'),
                ]}>
                  {profile?.total_xp ?? 0}
                </Text>
              </View>

              {/* Streak Counter */}
              <View style={styles.streakBox}>
                <Flame size={26} color="#D8B4FE" fill="#D8B4FE" />
                <View>
                  <Text style={styles.streakCount}>{profile?.current_streak ?? 0}</Text>
                  <Text style={styles.streakLabel}>STREAK</Text>
                </View>
              </View>
            </View>

            {/* Progress Bar to next rank */}
            <View style={styles.progressContainer}>
              <View style={styles.progressLabels}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Award size={14} color={rank.color} />
                  <Text style={[styles.progressTier, { color: rank.color }]}>{rank.name}</Text>
                </View>
                {nextRank ? (
                  <Text style={styles.progressRemaining}>{xpRemaining} XP to {nextRankName}</Text>
                ) : (
                  <Text style={styles.progressRemaining}>MAX RANK REACHED</Text>
                )}
              </View>
              <View style={styles.progressBarBg}>
                <LinearGradient
                  colors={[rank.color, '#FFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent}%` },
                    Theme.getGlow(rank.color, 'medium'),
                  ]}
                />
              </View>
            </View>
          </BlurView>

          {/* Quick actions */}
          <TouchableOpacity
            style={[styles.logButton, Theme.getGlow(Theme.colors.primary, 'medium')]}
            onPress={() => router.push('/log-workout')}
          >
            <Dumbbell size={20} color="#FFF" strokeWidth={2.5} />
            <Text style={styles.logButtonText}>LOG NEW WORKOUT</Text>
            <ChevronRight size={18} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <BlurView intensity={25} tint="dark" style={styles.statCard}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.01)']}
                style={StyleSheet.absoluteFill}
              />
              <Trophy size={18} color={Theme.colors.warning} />
              <Text style={styles.statValue}>{profile?.longest_streak ?? 0} Days</Text>
              <Text style={styles.statLabel}>Best Streak</Text>
            </BlurView>
            <BlurView intensity={25} tint="dark" style={styles.statCard}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.01)']}
                style={StyleSheet.absoluteFill}
              />
              <Zap size={18} color={Theme.colors.secondary} />
              <Text style={styles.statValue}>+{Math.round((Math.min(profile?.current_streak ?? 0, 10) * 5))}%</Text>
              <Text style={styles.statLabel}>Streak Bonus</Text>
            </BlurView>
          </View>

          {/* Recent Activity */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>DAILY SUMMARY</Text>
          </View>

          {recentWorkouts.length === 0 ? (
            <BlurView intensity={25} tint="dark" style={styles.emptyCard}>
              <Dumbbell size={32} color={Theme.colors.textMuted} style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>No workouts logged yet.</Text>
              <Text style={styles.emptySubtext}>Log a workout to start earning XP and ranking up!</Text>
            </BlurView>
          ) : (
            <View style={styles.workoutList}>
              {recentWorkouts.map((workout) => (
                <BlurView key={workout.id} intensity={25} tint="dark" style={styles.workoutCard}>
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.01)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[
                    styles.workoutIconBox, 
                    {
                      borderColor: workout.intensity === 'Intense' ? 'rgba(255, 42, 95, 0.3)' :
                                   workout.intensity === 'Moderate' ? 'rgba(245, 158, 11, 0.3)' :
                                   'rgba(16, 185, 129, 0.3)',
                      backgroundColor: workout.intensity === 'Intense' ? 'rgba(255, 42, 95, 0.12)' :
                                       workout.intensity === 'Moderate' ? 'rgba(245, 158, 11, 0.12)' :
                                       'rgba(16, 185, 129, 0.12)',
                    }
                  ]}>
                    <Dumbbell size={20} color={workout.intensity === 'Intense' ? Theme.colors.danger :
                                              workout.intensity === 'Moderate' ? Theme.colors.warning :
                                              Theme.colors.success} />
                  </View>
                  <View style={styles.workoutContent}>
                    <Text style={styles.workoutName}>{workout.exercise_name || workout.type}</Text>
                    <Text style={styles.workoutDesc} numberOfLines={1}>{workout.notes || 'Workout recorded successfully.'}</Text>
                  </View>
                  <View style={styles.workoutRight}>
                    <View style={[
                      styles.tagBadge, 
                      { backgroundColor: workout.intensity === 'Intense' ? 'rgba(255, 42, 95, 0.15)' :
                                         workout.intensity === 'Moderate' ? 'rgba(245, 158, 11, 0.15)' :
                                         'rgba(16, 185, 129, 0.15)' }
                    ]}>
                      <Text style={[
                        styles.tagBadgeText,
                        { color: workout.intensity === 'Intense' ? Theme.colors.danger :
                                 workout.intensity === 'Moderate' ? Theme.colors.warning :
                                 Theme.colors.success }
                      ]}>
                        {workout.intensity === 'Intense' ? 'Hard' : workout.intensity === 'Moderate' ? 'Medium' : 'Light'}
                      </Text>
                    </View>
                    <Text style={styles.workoutTime}>
                      {new Date(workout.logged_at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </BlurView>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 400,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Theme.colors.accent,
    opacity: 0.05,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarEmoji: {
    fontSize: 24,
    backgroundColor: 'transparent',
    width: 40,
    height: 40,
    borderRadius: 20,
    textAlign: 'center',
    lineHeight: 40,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  greetingText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  welcomeContainer: {
    gap: 4,
    marginBottom: 4,
  },
  welcomeText: {
    color: '#FFF',
    fontSize: 28,
    fontFamily: 'Inter_900Black',
    letterSpacing: -0.5,
  },
  welcomeSubtext: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  heroCard: {
    backgroundColor: 'rgba(22, 15, 43, 0.45)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.28)',
    padding: 20,
    gap: 20,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpCol: {
    gap: 4,
  },
  xpLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  xpText: {
    fontSize: 34,
    fontFamily: 'Inter_900Black',
  },
  streakBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.5)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  streakCount: {
    color: '#FFF',
    fontSize: 22,
    fontFamily: 'Inter_900Black',
    lineHeight: 22,
  },
  streakLabel: {
    color: Theme.colors.textMuted,
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  progressContainer: {
    gap: 8,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTier: {
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.5,
  },
  progressRemaining: {
    color: Theme.colors.textMuted,
    fontSize: 11,
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
  logButton: {
    height: 56,
    backgroundColor: Theme.colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  logButtonText: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(22, 15, 43, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.22)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 2,
  },
  statLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionHeader: {
    marginTop: 10,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  emptyCard: {
    backgroundColor: 'rgba(22, 15, 43, 0.45)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.22)',
    padding: 30,
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  emptyText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  emptySubtext: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  workoutList: {
    gap: 12,
  },
  workoutCard: {
    backgroundColor: 'rgba(22, 15, 43, 0.45)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.22)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  workoutIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  workoutContent: {
    flex: 1,
    gap: 4,
  },
  workoutName: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  workoutDesc: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  workoutRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    textTransform: 'uppercase',
  },
  workoutTime: {
    color: Theme.colors.textMuted,
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
});
