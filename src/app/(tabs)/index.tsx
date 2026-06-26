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
import { Flame, Dumbbell, Trophy, LogOut, ChevronRight, Zap } from 'lucide-react-native';

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerUser}>
          <Text style={styles.avatarEmoji}>{profile?.avatar_url?.split(' ')[0] || '🦊'}</Text>
          <View>
            <Text style={styles.usernameText}>{profile?.username || 'Gamer'}</Text>
            <Text style={styles.rankBadgeText}>{rank.name} Tier</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={Theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
        }
      >
        {/* Streak & XP Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            {/* XP and Rank Display */}
            <View style={styles.xpCol}>
              <Text style={styles.xpLabel}>TOTAL XP</Text>
              <Text style={[styles.xpText, { color: rank.color }]}>{profile?.total_xp ?? 0}</Text>
            </View>

            {/* Streak Counter */}
            <View style={[styles.streakBox, Theme.getGlow(Theme.colors.primary, 'low')]}>
              <Flame size={24} color={Theme.colors.primary} fill={Theme.colors.primary} />
              <View>
                <Text style={styles.streakCount}>{profile?.current_streak ?? 0}</Text>
                <Text style={styles.streakLabel}>STREAK</Text>
              </View>
            </View>
          </View>

          {/* Progress Bar to next rank */}
          <View style={styles.progressContainer}>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressTier, { color: rank.color }]}>{rank.name}</Text>
              {nextRank ? (
                <Text style={styles.progressRemaining}>{xpRemaining} XP to {nextRankName}</Text>
              ) : (
                <Text style={styles.progressRemaining}>MAX RANK REACHED</Text>
              )}
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%`, backgroundColor: rank.color },
                  Theme.getGlow(rank.color, 'low'),
                ]}
              />
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <TouchableOpacity
          style={[styles.logButton, Theme.getGlow(Theme.colors.primary, 'medium')]}
          onPress={() => router.push('/log-workout')}
        >
          <Dumbbell size={22} color="#000" strokeWidth={2.5} />
          <Text style={styles.logButtonText}>LOG NEW WORKOUT</Text>
          <ChevronRight size={20} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Trophy size={20} color={Theme.colors.warning} />
            <Text style={styles.statValue}>{profile?.longest_streak ?? 0} Days</Text>
            <Text style={styles.statLabel}>Best Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Zap size={20} color={Theme.colors.secondary} />
            <Text style={styles.statValue}>+{Math.round((Math.min(profile?.current_streak ?? 0, 10) * 5))}%</Text>
            <Text style={styles.statLabel}>Streak Bonus</Text>
          </View>
        </View>

        {/* Recent Workouts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
        </View>

        {recentWorkouts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Dumbbell size={32} color={Theme.colors.textMuted} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>No workouts logged yet.</Text>
            <Text style={styles.emptySubtext}>Log a workout to start earning XP and ranking up!</Text>
          </View>
        ) : (
          <View style={styles.workoutList}>
            {recentWorkouts.map((workout) => (
              <View key={workout.id} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <View style={[styles.workoutTypeContainer, { alignItems: 'flex-start', flex: 1 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workoutType}>{workout.exercise_name || workout.type}</Text>
                      {workout.exercise_name && (
                        <Text style={{ color: Theme.colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 }}>
                          {workout.type.toUpperCase()}{workout.primary_muscle ? ` • ${workout.primary_muscle.toUpperCase()}` : ''}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.workoutIntensity, {
                      marginTop: 2,
                      color: workout.intensity === 'Intense' ? Theme.colors.danger :
                             workout.intensity === 'Moderate' ? Theme.colors.warning :
                             Theme.colors.success
                    }]}>
                      {workout.intensity}
                    </Text>
                  </View>
                  <Text style={styles.workoutXp}>+{workout.xp_earned} XP</Text>
                </View>
                
                <Text style={styles.workoutSub}>
                  {workout.duration_min} mins • {new Date(workout.logged_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
                
                {workout.notes ? (
                  <Text style={styles.workoutNotes} numberOfLines={1}>{workout.notes}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    backgroundColor: Theme.colors.background,
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
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarEmoji: {
    fontSize: 34,
    backgroundColor: Theme.colors.card,
    width: 48,
    height: 48,
    borderRadius: 24,
    textAlign: 'center',
    lineHeight: 48,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  usernameText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  rankBadgeText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
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
  heroCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 20,
    gap: 20,
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
    fontWeight: '800',
    letterSpacing: 1,
  },
  xpText: {
    fontSize: 34,
    fontWeight: '900',
  },
  streakBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderWidth: 1.5,
    borderColor: Theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  streakCount: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  streakLabel: {
    color: Theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
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
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressRemaining: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Theme.colors.background,
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
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  statLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    marginTop: 10,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emptyCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtext: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  workoutList: {
    gap: 12,
  },
  workoutCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    gap: 6,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workoutTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutType: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  workoutIntensity: {
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  workoutXp: {
    color: Theme.colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  workoutSub: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  workoutNotes: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
