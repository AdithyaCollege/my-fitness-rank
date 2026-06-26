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
          isCurrentUser && [styles.currentUserRow, Theme.getGlow(Theme.colors.primary, 'low')],
        ]}
      >
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
            <Text style={[styles.username, isCurrentUser && { color: Theme.colors.primary }]}>
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Trophy size={24} color={Theme.colors.primary} />
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
          <View style={styles.emptyContainer}>
            <Trophy size={36} color={Theme.colors.textMuted} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>No users on the leaderboard.</Text>
            <Text style={styles.emptySubtext}>Be the first to log a workout and claim #1!</Text>
          </View>
        }
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
    gap: 10,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  currentUserRow: {
    borderColor: Theme.colors.primary,
    backgroundColor: '#0F251E', // Very dark green tint
  },
  rankCol: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumText: {
    color: Theme.colors.textMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  userCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarEmoji: {
    fontSize: 26,
    backgroundColor: Theme.colors.background,
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
    fontWeight: '700',
  },
  rankTier: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  statsCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
    borderWidth: 0.5,
    borderColor: Theme.colors.primary,
  },
  streakText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  xpText: {
    fontSize: 15,
    fontWeight: '800',
  },
  xpSubText: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 40,
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
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
  },
});
