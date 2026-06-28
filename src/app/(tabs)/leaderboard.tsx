import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Theme, getRankDetails } from '@/theme/theme';
import { Trophy, Medal, Flame } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeaderboard = async () => {
    try {
      // Get current user id
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      // Fetch global leaderboard from the view
      const { data, error } = await supabase
        .from('global_leaderboard')
        .select('*');

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboard();
  };

  // Render a single rank row
  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isCurrentUser = item.id === currentUserId;
    const rankNum = index + 1;
    const rankDetails = getRankDetails(item.total_xp);

    // Style for podium finishes
    let rankBadge = null;
    if (rankNum === 1) {
      rankBadge = <Medal size={22} color="#FFD700" fill="#FFD700" />; // Gold
    } else if (rankNum === 2) {
      rankBadge = <Medal size={22} color="#C0C0C0" fill="#C0C0C0" />; // Silver
    } else if (rankNum === 3) {
      rankBadge = <Medal size={22} color="#CD7F32" fill="#CD7F32" />; // Bronze
    }

    return (
      <View
        style={[
          styles.row,
          isCurrentUser && styles.currentUserRow,
          isCurrentUser && Theme.getGlow('#ddb7ff', 'low'),
        ]}
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
          style={StyleSheet.absoluteFill}
        />
        {/* Rank Number / Badge */}
        <View style={styles.rankCol}>
          {rankBadge ? (
            rankBadge
          ) : (
            <Text style={styles.rankNumText}>{rankNum}</Text>
          )}
        </View>

        {/* User Info */}
        <View style={styles.userCol}>
          <Text style={styles.avatarEmoji}>{item.avatar_url?.split(' ')[0] || '🦊'}</Text>
          <View>
            <Text style={[styles.username, isCurrentUser && { color: '#ddb7ff' }]}>
              {item.username}
            </Text>
            <Text style={[styles.rankTier, { color: rankDetails.color }]}>
              {rankDetails.name}
            </Text>
          </View>
        </View>

        {/* Stats (Streak & XP) */}
        <View style={styles.statsCol}>
          <View style={styles.streakBadge}>
            <Flame size={12} color={Theme.colors.primary} fill={Theme.colors.primary} />
            <Text style={styles.streakText}>{item.current_streak}</Text>
          </View>
          <Text style={[styles.xpText, { color: rankDetails.color }]}>
            {item.total_xp} <Text style={styles.xpSubText}>XP</Text>
          </Text>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#101415' }}>
      <LinearGradient
        colors={['rgba(73, 0, 128, 0.45)', '#101415']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      <SafeAreaView style={styles.safeArea}>

        <View style={styles.header}>
          <Trophy size={20} color="#ddb7ff" />
          <Text style={styles.headerTitle}>GLOBAL RANKINGS</Text>
        </View>

        <FlatList
          data={leaderboard}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
          ListEmptyComponent={
            <BlurView intensity={25} tint="dark" style={styles.emptyContainer}>
              <Trophy size={36} color={Theme.colors.textMuted} style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>No users on the leaderboard.</Text>
              <Text style={styles.emptySubtext}>Be the first to log a workout and claim #1!</Text>
            </BlurView>
          }
        />
      </SafeAreaView>
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1.5,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  currentUserRow: {
    borderColor: '#ddb7ff',
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
  },
  rankCol: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumText: {
    color: Theme.colors.textMuted,
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
  },
  userCol: {
    flex: 1,
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
  username: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  rankTier: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 1,
  },
  statsCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
    borderWidth: 0.5,
    borderColor: '#ddb7ff',
  },
  streakText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  xpText: {
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
  },
  xpSubText: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyContainer: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    padding: 40,
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
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
  },
});
