import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Theme, getRankDetails } from '@/theme/theme';
import { Trophy, Flame, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'squad'>('global');

  const loadLeaderboard = async (tab: 'global' | 'squad') => {
    try {
      setRefreshing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (profile) {
          setCurrentUserProfile(profile);
        }
      }

      if (tab === 'global') {
        const { data, error } = await supabase
          .from('global_leaderboard')
          .select('*');
        if (error) throw error;
        setLeaderboard(data || []);
      } else {
        if (user) {
          // Find user's first squad
          const { data: membershipData, error: memError } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', user.id)
            .limit(1);

          if (memError) throw memError;

          if (membershipData && membershipData.length > 0) {
            const groupId = membershipData[0].group_id;
            const { data: membersData, error: membersError } = await supabase
              .from('group_members')
              .select(`
                user_id,
                profiles:user_id (
                  id,
                  username,
                  avatar_url,
                  total_xp,
                  current_streak
                )
              `)
              .eq('group_id', groupId);

            if (membersError) throw membersError;

            if (membersData) {
              const squadUsers = membersData
                .map((m: any) => m.profiles)
                .filter(Boolean)
                .sort((a: any, b: any) => b.total_xp - a.total_xp);
              setLeaderboard(squadUsers);
            }
          } else {
            setLeaderboard([]);
          }
        } else {
          setLeaderboard([]);
        }
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeaderboard(activeTab);
  }, [activeTab]);

  const onRefresh = () => {
    loadLeaderboard(activeTab);
  };

  const getPodiumUser = (index: number) => {
    if (leaderboard[index]) {
      return leaderboard[index];
    }
    // Fallbacks
    const fallbacks = [
      { username: 'No Active User', total_xp: 0, avatar_url: '🦊' },
      { username: 'No Active User', total_xp: 0, avatar_url: '🦊' },
      { username: 'No Active User', total_xp: 0, avatar_url: '🦊' }
    ];
    return fallbacks[index];
  };

  const rankDetails = getRankDetails(currentUserProfile?.total_xp || 0);
  let nextRankName = 'Max';
  let xpToNext = 0;
  let progress = 1;

  if (rankDetails.name === 'Bronze') {
    nextRankName = 'Silver';
    xpToNext = 100 - (currentUserProfile?.total_xp || 0);
    progress = Math.max(0, Math.min(1, (currentUserProfile?.total_xp || 0) / 100));
  } else if (rankDetails.name === 'Silver') {
    nextRankName = 'Gold';
    xpToNext = 500 - (currentUserProfile?.total_xp || 0);
    progress = Math.max(0, Math.min(1, ((currentUserProfile?.total_xp || 0) - 100) / 400));
  } else if (rankDetails.name === 'Gold') {
    nextRankName = 'Platinum';
    xpToNext = 1500 - (currentUserProfile?.total_xp || 0);
    progress = Math.max(0, Math.min(1, ((currentUserProfile?.total_xp || 0) - 500) / 1000));
  } else if (rankDetails.name === 'Platinum') {
    nextRankName = 'Diamond';
    xpToNext = 3500 - (currentUserProfile?.total_xp || 0);
    progress = Math.max(0, Math.min(1, ((currentUserProfile?.total_xp || 0) - 1500) / 2000));
  } else if (rankDetails.name === 'Diamond') {
    nextRankName = 'Champion';
    xpToNext = 7500 - (currentUserProfile?.total_xp || 0);
    progress = Math.max(0, Math.min(1, ((currentUserProfile?.total_xp || 0) - 3500) / 4000));
  } else {
    nextRankName = 'Legend';
    xpToNext = 0;
    progress = 1;
  }

  const getTrendIndicator = (index: number) => {
    const rankNum = index + 4;
    if (rankNum % 3 === 1) {
      return (
        <View style={styles.trendContainer}>
          <Text style={styles.trendUpArrow}>▲</Text>
          <Text style={styles.trendUpText}>{(rankNum % 2) + 1}</Text>
        </View>
      );
    } else if (rankNum % 3 === 2) {
      return (
        <View style={styles.trendContainer}>
          <Text style={styles.trendMuted}>—</Text>
        </View>
      );
    } else {
      return (
        <View style={styles.trendContainer}>
          <Text style={styles.trendUpArrow}>▲</Text>
          <Text style={styles.trendUpText}>{(rankNum % 2) + 2}</Text>
        </View>
      );
    }
  };

  const renderWorkoutItem = ({ item, index }: { item: any; index: number }) => {
    const isCurrentUser = item.id === currentUserId;
    const rankNum = index + 4;
    const itemRankDetails = getRankDetails(item.total_xp);

    return (
      <View style={[
        styles.row,
        isCurrentUser && styles.currentUserRow,
        isCurrentUser && Theme.getGlow('#ddb7ff', 'low')
      ]}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.rankCol}>
          <Text style={styles.rankNumText}>{rankNum}</Text>
        </View>

        <View style={styles.userCol}>
          <Text style={styles.avatarEmoji}>{item.avatar_url?.split(' ')[0] || '🦊'}</Text>
          <View style={styles.usernameBox}>
            <Text style={[styles.username, isCurrentUser && { color: '#ddb7ff' }]}>
              {item.username}
            </Text>
            <Text style={[styles.rankTier, { color: itemRankDetails.color }]}>
              {itemRankDetails.name}
            </Text>
          </View>
        </View>

        <View style={styles.statsCol}>
          <Text style={[styles.xpText, { color: itemRankDetails.color }]}>
            {item.total_xp.toLocaleString()} <Text style={styles.xpSubText}>XP</Text>
          </Text>
          {getTrendIndicator(index)}
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    const p1 = getPodiumUser(0);
    const p2 = getPodiumUser(1);
    const p3 = getPodiumUser(2);

    return (
      <View style={styles.headerContentContainer}>
        {/* Title Block */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.seasonText}>SEASON 1</Text>
            <Text style={styles.seasonRankTitle}>Season Rank</Text>
          </View>
          <TouchableOpacity
            style={styles.infoBtn}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Leaderboard Info', 'XP accumulates from all logged workouts. Complete daily challenges to rank up faster!')}
          >
            <Info size={18} color="#e0e3e5" />
          </TouchableOpacity>
        </View>

        {/* Tab Toggle Segment */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'global' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('global')}
          >
            <Text style={[styles.segmentText, activeTab === 'global' && styles.segmentTextActive]}>Global</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'squad' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('squad')}
          >
            <Text style={[styles.segmentText, activeTab === 'squad' && styles.segmentTextActive]}>Squad</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar Tier Status */}
        <View style={styles.progressCard}>
          <View style={styles.tierStatusRow}>
            <Text style={styles.tierNameText}>🏆 {rankDetails.name}</Text>
            <Text style={styles.xpToNextText}>
              {xpToNext > 0 ? `${xpToNext.toLocaleString()} XP to ${nextRankName}` : 'Max Tier Reached'}
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Podium Graphics Image with Floating Avatars */}
        <View style={styles.podiumWrapper}>
          <Image
            source={require('../../../assets/images/podium.png')}
            style={styles.podiumImage}
            contentFit="cover"
          />

          {/* Rank 2 (Silver) - Left Column */}
          <View style={[styles.avatarFloating, styles.avatarRank2]}>
            <View style={[styles.podiumAvatarWrapper, { borderColor: '#A8A9AD' }, Theme.getGlow('#A8A9AD', 'low')]}>
              <Text style={styles.podiumAvatarEmoji}>{p2.avatar_url?.split(' ')[0] || '🦊'}</Text>
            </View>
            <View style={styles.podiumTextContainer}>
              <Text style={styles.podiumNameText} numberOfLines={1}>{p2.username}</Text>
              <Text style={styles.podiumXpText} numberOfLines={1}>{p2.total_xp.toLocaleString()} XP</Text>
            </View>
          </View>

          {/* Rank 1 (Gold) - Center Column */}
          <View style={[styles.avatarFloating, styles.avatarRank1]}>
            <View style={[styles.podiumAvatarWrapper, styles.podiumAvatarWrapperGold, Theme.getGlow('#FFD700', 'medium')]}>
              <Text style={styles.podiumAvatarEmoji}>{p1.avatar_url?.split(' ')[0] || '🦊'}</Text>
            </View>
            <View style={styles.podiumTextContainer}>
              <Text style={styles.podiumNameText} numberOfLines={1}>{p1.username}</Text>
              <Text style={styles.podiumXpText} numberOfLines={1}>{p1.total_xp.toLocaleString()} XP</Text>
            </View>
          </View>

          {/* Rank 3 (Bronze) - Right Column */}
          <View style={[styles.avatarFloating, styles.avatarRank3]}>
            <View style={[styles.podiumAvatarWrapper, { borderColor: '#CD7F32' }, Theme.getGlow('#CD7F32', 'low')]}>
              <Text style={styles.podiumAvatarEmoji}>{p3.avatar_url?.split(' ')[0] || '🦊'}</Text>
            </View>
            <View style={styles.podiumTextContainer}>
              <Text style={styles.podiumNameText} numberOfLines={1}>{p3.username}</Text>
              <Text style={styles.podiumXpText} numberOfLines={1}>{p3.total_xp.toLocaleString()} XP</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ddb7ff" />
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
        <FlatList
          data={leaderboard.slice(3)}
          renderItem={renderWorkoutItem}
          keyExtractor={(item, idx) => item.id || idx.toString()}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ddb7ff" />
          }
          ListEmptyComponent={
            <BlurView intensity={25} tint="dark" style={styles.emptyContainer}>
              <Trophy size={36} color="#ddb7ff" style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>No users on the leaderboard.</Text>
              <Text style={styles.emptySubtext}>
                {activeTab === 'squad' 
                  ? 'Join a squad or log a workout to see squad members here!' 
                  : 'Be the first to log a workout and claim #1!'}
              </Text>
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
    backgroundColor: '#101415',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    gap: 10,
  },
  headerContentContainer: {
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 16,
  },
  seasonText: {
    color: '#8A82A0',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  seasonRankTitle: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    marginTop: 2,
  },
  infoBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(12, 7, 20, 0.6)',
    borderRadius: 24,
    padding: 4,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#ddb7ff',
  },
  segmentText: {
    color: '#cfc2d6',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  segmentTextActive: {
    color: '#400071',
    fontFamily: 'Inter_800ExtraBold',
  },
  progressCard: {
    marginTop: 20,
    gap: 8,
    paddingHorizontal: 4,
  },
  tierStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierNameText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
  },
  xpToNextText: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ddb7ff',
    borderRadius: 3,
  },
  podiumWrapper: {
    width: '100%',
    aspectRatio: 1.55,
    marginTop: 24,
    marginBottom: 8,
    position: 'relative',
  },
  podiumImage: {
    position: 'absolute',
    top: 36,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 16,
  },
  avatarFloating: {
    position: 'absolute',
    alignItems: 'center',
  },
  avatarRank1: {
    top: '3%',
    left: '50%',
    marginLeft: -38,
    width: 76,
  },
  avatarRank2: {
    top: '23%',
    left: '11%',
    width: 68,
  },
  avatarRank3: {
    top: '31%',
    right: '11%',
    width: 68,
  },
  podiumAvatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c0714',
  },
  podiumAvatarWrapperGold: {
    borderColor: '#FFD700',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  podiumAvatarEmoji: {
    fontSize: 24,
    textAlign: 'center',
  },
  podiumTextContainer: {
    backgroundColor: 'rgba(12, 7, 20, 0.85)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: 64,
  },
  podiumNameText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  podiumXpText: {
    color: '#ddb7ff',
    fontSize: 8,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
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
    color: '#e0e3e5',
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  usernameBox: {
    gap: 2,
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
  xpText: {
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
  },
  xpSubText: {
    fontSize: 10,
    color: '#cfc2d6',
    fontFamily: 'Inter_600SemiBold',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  trendUpArrow: {
    color: '#10B981',
    fontSize: 8,
  },
  trendUpText: {
    color: '#10B981',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
  },
  trendMuted: {
    color: '#8A82A0',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
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
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
