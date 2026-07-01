import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Theme, getRankDetails } from '@/theme/theme';
import { Button3D } from '@/components/ui/button-3d';
import { Users, Plus, UserPlus, Copy, Trophy, LogOut, Search } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function GroupsScreen() {
  const [squads, setSquads] = useState<any[]>([]);
  const [squadMembers, setSquadMembers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form inputs
  const [newSquadName, setNewSquadName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Player search states
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadSquads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Get user squads
      const { data: membershipData, error: membershipError } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups:group_id (
            id,
            name,
            invite_code,
            owner_id,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (membershipError) throw membershipError;
      
      const formattedSquads = membershipData
        ?.map((item: any) => item.groups)
        .filter(Boolean) || [];

      setSquads(formattedSquads);

      // If they are in a squad, load its members
      if (formattedSquads.length > 0) {
        await loadSquadMembers(formattedSquads[0].id);
      }
    } catch (err) {
      console.error('Error loading squads:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSquadMembers = async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          user_id,
          joined_at,
          profiles:user_id (
            id,
            username,
            avatar_url,
            total_xp,
            current_streak
          )
        `)
        .eq('group_id', groupId);

      if (error) throw error;
      
      const members = data
        ?.map((item: any) => ({
          ...item.profiles,
          joined_at: item.joined_at
        }))
        .filter(Boolean)
        .sort((a, b) => b.total_xp - a.total_xp) || [];

      setSquadMembers(members);
    } catch (err) {
      console.error('Error loading members:', err);
    }
  };

  useEffect(() => {
    loadSquads();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadSquads();
  };

  const handleCreateSquad = async () => {
    if (!newSquadName || newSquadName.trim().length < 3) {
      Alert.alert('Invalid Name', 'Squad name must be at least 3 characters long.');
      return;
    }

    setActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user session.');

      // Check if already in a squad
      if (squads.length > 0) {
        throw new Error('You can only join one squad. Leave your current squad first!');
      }

      // Generate random invite code
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Insert group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert([{
          name: newSquadName.trim(),
          owner_id: user.id,
          invite_code: inviteCode
        }])
        .select()
        .single();

      if (groupError) throw groupError;

      // Join owner to group_members
      const { error: joinError } = await supabase
        .from('group_members')
        .insert([{
          group_id: groupData.id,
          user_id: user.id
        }]);

      if (joinError) throw joinError;

      setNewSquadName('');
      Alert.alert('Squad Created', `Your squad "${groupData.name}" has been created! Share code: ${inviteCode}`);
      setLoading(true);
      await loadSquads();
    } catch (err: any) {
      console.error('Error creating squad:', err);
      Alert.alert('Creation Failed', err.message || 'Could not create squad.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinSquad = async () => {
    const code = joinInviteCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Invalid Code', 'Please enter a squad invite code.');
      return;
    }

    setActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user session.');

      // Check if already in a squad
      if (squads.length > 0) {
        throw new Error('You can only join one squad. Leave your current squad first!');
      }

      // Find squad by invite code
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', code)
        .single();

      if (groupError) {
        throw new Error('Squad not found. Double check the invite code!');
      }

      // Join squad
      const { error: joinError } = await supabase
        .from('group_members')
        .insert([{
          group_id: groupData.id,
          user_id: user.id
        }]);

      if (joinError) throw joinError;

      setJoinInviteCode('');
      Alert.alert('Joined Squad', `You have joined the squad "${groupData.name}"!`);
      setLoading(true);
      await loadSquads();
    } catch (err: any) {
      console.error('Error joining squad:', err);
      Alert.alert('Join Failed', err.message || 'Could not join squad.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExitSquad = async () => {
    const activeSquad = squads[0];
    if (!activeSquad) return;

    Alert.alert(
      'Leave Squad',
      'Are you sure you want to leave this squad? You will lose access to the squad dashboard and standings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('No user session.');

              // Delete membership
              const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', activeSquad.id)
                .eq('user_id', user.id);

              if (error) throw error;

              // If owner, delete squad to clean up
              if (activeSquad.owner_id === user.id) {
                await supabase
                  .from('groups')
                  .delete()
                  .eq('id', activeSquad.id);
              }

              Alert.alert('Squad Exited', 'You have successfully left the squad.');
              setSquads([]);
              setSquadMembers([]);
              setLoading(true);
              await loadSquads();
            } catch (err: any) {
              console.error('Error leaving squad:', err);
              Alert.alert('Error', err.message || 'Could not leave squad.');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    const query = playerSearchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, total_xp, current_streak')
          .like('username', `%${query}%`) // Case-sensitive search
          .limit(5);

        if (error) throw error;

        // Filter out current user and players already in the squad
        const filtered = (data || []).filter(
          (p: any) => p.id !== currentUserId && !squadMembers.some((m) => m.id === p.id)
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error('Auto-search error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [playerSearchQuery, currentUserId, squadMembers]);

  const handleSendInvite = async (player: any) => {
    Alert.alert(
      'Send Invitation',
      `Would you like to invite @${player.username} to join ${squads[0]?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Invite',
          onPress: () => {
            Alert.alert(
              'Invitation Sent!',
              `A request to join has been sent to @${player.username} with your invite code: ${squads[0]?.invite_code}.`
            );
            setSearchResults(searchResults.filter((p) => p.id !== player.id));
          }
        }
      ]
    );
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Invite code copied to clipboard!');
  };

  if (loading && squads.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ddb7ff" />
      </View>
    );
  }

  // ── BRANCH A: User is in a Squad (Show Dashboard Only) ──────────────
  if (squads.length > 0) {
    const activeSquad = squads[0];
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
            <Users size={24} color="#ddb7ff" />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{activeSquad.name}</Text>
              <Text style={styles.headerSubtitle}>SQUAD DASHBOARD</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.container}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ddb7ff" />
            }
          >
            {/* Invite Code display */}
            <View style={styles.codeCard}>
              <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={{ flex: 1 }}>
                <Text style={styles.codeLabel}>INVITE CODE</Text>
                <Text style={styles.codeText}>{activeSquad.invite_code}</Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyToClipboard(activeSquad.invite_code)}
              >
                <Copy size={16} color="#ddb7ff" />
                <Text style={styles.copyBtnText}>COPY</Text>
              </TouchableOpacity>
            </View>

            {/* Squad Leaderboard Header */}
            <View style={styles.sectionHeader}>
              <Trophy size={16} color="#ddb7ff" />
              <Text style={styles.sectionTitle}>SQUAD STANDINGS</Text>
            </View>

            {/* Members List */}
            <View style={styles.memberList}>
              {squadMembers.map((member, index) => {
                const rankNum = index + 1;
                const rankDetails = getRankDetails(member.total_xp);
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.01)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.memberRankNum}>#{rankNum}</Text>
                    <Text style={styles.memberEmoji}>{member.avatar_url?.split(' ')[0] || '🦊'}</Text>
                    
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.username}</Text>
                      <Text style={[styles.memberRankText, { color: rankDetails.color }]}>
                        {rankDetails.name}
                      </Text>
                    </View>

                    <View style={styles.memberXpBox}>
                      <Text style={[styles.memberXpText, { color: rankDetails.color }]}>
                        {member.total_xp} <Text style={styles.xpSub}>XP</Text>
                      </Text>
                      <Text style={styles.memberStreakText}>{member.current_streak}d streak</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Search & Invite Players (Owner Only) */}
            {activeSquad.owner_id === currentUserId && (
              <View style={styles.inviteSection}>
                <View style={styles.sectionHeader}>
                  <UserPlus size={16} color="#ddb7ff" />
                  <Text style={styles.sectionTitle}>INVITE PLAYERS BY GAMERTAG</Text>
                </View>
                
                <View style={styles.searchBar}>
                  <Search size={18} color="#cfc2d6" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Enter player gamertag (case-sensitive)..."
                    placeholderTextColor="rgba(207, 194, 214, 0.5)"
                    value={playerSearchQuery}
                    onChangeText={setPlayerSearchQuery}
                    autoCorrect={false}
                  />
                  {searchLoading && (
                    <ActivityIndicator size="small" color="#ddb7ff" />
                  )}
                </View>

                {/* Player Results */}
                {searchResults.length > 0 && (
                  <View style={styles.resultsList}>
                    {searchResults.map((player) => {
                      const playerRank = getRankDetails(player.total_xp);
                      return (
                        <View key={player.id} style={styles.playerItem}>
                          <Text style={styles.playerEmoji}>{player.avatar_url?.split(' ')[0] || '🦊'}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.memberName}>{player.username}</Text>
                            <Text style={[styles.playerRankTextLabel, { color: playerRank.color }]}>
                              {playerRank.name} • {player.total_xp} XP
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.inviteBtn}
                            onPress={() => handleSendInvite(player)}
                          >
                            <Text style={styles.inviteBtnText}>INVITE</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Leave Squad Option */}
            <Button3D
              title="LEAVE SQUAD"
              onPress={handleExitSquad}
              loading={actionLoading}
              backgroundColor="#FF2A5F"
              shadowColor="#93000a"
              textColor="#FFF"
              leftIcon={<LogOut size={16} color="#FFF" />}
              style={[Theme.getGlow('#FF2A5F', 'low'), { marginTop: 12 }]}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ── BRANCH B: User is NOT in a Squad (Show Join/Create Screen) ───────
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
          <Users size={24} color="#ddb7ff" />
          <Text style={styles.headerTitle}>YOUR SQUAD</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ddb7ff" />
          }
        >
          {/* Empty State */}
          <View style={styles.emptyCard}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <Users size={36} color="#cfc2d6" style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>Not in any squads.</Text>
            <Text style={styles.emptySubtext}>
              Join a friend's squad to compete or create your own and invite others!
            </Text>
          </View>

          {/* Action Panel: Create Squad */}
          <View style={styles.card}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.cardHeader}>
              <Plus size={18} color="#ddb7ff" />
              <Text style={styles.cardTitle}>CREATE NEW SQUAD</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Squad Name (e.g. Iron Giants)"
              placeholderTextColor="#8A82A0"
              value={newSquadName}
              onChangeText={setNewSquadName}
            />
            <Button3D
              title="CREATE SQUAD"
              onPress={handleCreateSquad}
              loading={actionLoading}
              style={Theme.getGlow('#ddb7ff', 'low')}
            />
          </View>

          {/* Action Panel: Join Squad */}
          <View style={styles.card}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.cardHeader}>
              <UserPlus size={18} color="#cac1ed" />
              <Text style={styles.cardTitle}>JOIN SQUAD VIA CODE</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Invite Code (e.g. 7X3F8A)"
              placeholderTextColor="#8A82A0"
              value={joinInviteCode}
              onChangeText={setJoinInviteCode}
              autoCapitalize="characters"
            />
            <Button3D
              title="JOIN SQUAD"
              onPress={handleJoinSquad}
              loading={actionLoading}
              backgroundColor="#cac1ed"
              shadowColor="#9c82d9"
              textColor="#322b4f"
              style={Theme.getGlow('#cac1ed', 'low')}
            />
          </View>
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    color: '#cfc2d6',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 110,
    gap: 20,
  },
  emptyCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
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
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    padding: 20,
    gap: 14,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.1)',
    paddingBottom: 8,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  input: {
    height: 48,
    backgroundColor: 'rgba(45, 49, 51, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    borderRadius: 12,
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 12,
  },
  actionBtn: {
    height: 48,
    backgroundColor: '#ddb7ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnSecondary: {
    height: 48,
    backgroundColor: '#cac1ed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#400071',
    fontSize: 13,
    fontFamily: 'Inter_900Black',
    letterSpacing: 0.5,
  },
  actionBtnTextSecondary: {
    color: '#322b4f',
    fontSize: 13,
    fontFamily: 'Inter_900Black',
    letterSpacing: 0.5,
  },
  codeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
  },
  codeLabel: {
    color: '#cfc2d6',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  codeText: {
    color: '#FFF',
    fontSize: 22,
    fontFamily: 'Inter_900Black',
    letterSpacing: 2,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 49, 51, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  copyBtnText: {
    color: '#ddb7ff',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.1)',
    paddingBottom: 8,
    marginTop: 10,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  memberList: {
    gap: 10,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  memberRankNum: {
    color: '#cfc2d6',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
    width: 28,
  },
  memberEmoji: {
    fontSize: 24,
    backgroundColor: 'transparent',
    width: 38,
    height: 38,
    borderRadius: 19,
    textAlign: 'center',
    lineHeight: 38,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  memberName: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  memberRankText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 1,
  },
  memberXpBox: {
    alignItems: 'flex-end',
  },
  memberXpText: {
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
  },
  xpSub: {
    fontSize: 9,
    color: '#cfc2d6',
    fontFamily: 'Inter_600SemiBold',
  },
  memberStreakText: {
    color: '#cfc2d6',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 1,
  },
  exitBtn: {
    flexDirection: 'row',
    height: 50,
    backgroundColor: 'rgba(255, 42, 95, 0.1)',
    borderColor: '#FF2A5F',
    borderWidth: 1.5,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  exitBtnText: {
    color: '#FF2A5F',
    fontSize: 14,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.5,
  },
  
  // Search and invite layout additions
  inviteSection: {
    marginTop: 10,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    paddingHorizontal: 16,
    height: 52,
    gap: 12,
  },
  searchIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  searchBtn: {
    backgroundColor: '#ddb7ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    color: '#400071',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
  },
  resultsList: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    overflow: 'hidden',
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(207, 194, 214, 0.1)',
    gap: 10,
  },
  playerEmoji: {
    fontSize: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: 'center',
    lineHeight: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  playerRankTextLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 1,
  },
  inviteBtn: {
    backgroundColor: 'rgba(221, 183, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#ddb7ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inviteBtnText: {
    color: '#ddb7ff',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
  },
});
