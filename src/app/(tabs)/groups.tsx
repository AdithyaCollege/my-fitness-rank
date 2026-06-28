import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Theme, getRankDetails } from '@/theme/theme';
import { Users, Plus, UserPlus, Copy, ArrowLeft, Shield, Trophy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function GroupsScreen() {
  const [squads, setSquads] = useState<any[]>([]);
  const [selectedSquad, setSelectedSquad] = useState<any | null>(null);
  const [squadMembers, setSquadMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form inputs
  const [newSquadName, setNewSquadName] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadSquads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      // If we are currently viewing a squad, refresh its member list
      if (selectedSquad) {
        const currentSquad = formattedSquads.find((s: any) => s.id === selectedSquad.id);
        if (currentSquad) {
          setSelectedSquad(currentSquad);
          await loadSquadMembers(currentSquad.id);
        } else {
          setSelectedSquad(null);
        }
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
            rank_tier,
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

  const handleSelectSquad = async (squad: any) => {
    setSelectedSquad(squad);
    setLoading(true);
    await loadSquadMembers(squad.id);
    setLoading(false);
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
      loadSquads();
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

      // Find squad by invite code
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', code)
        .single();

      if (groupError) {
        throw new Error('Squad not found. Double check the invite code!');
      }

      // Check if already in squad
      const { data: existingMember, error: checkError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupData.id)
        .eq('user_id', user.id);

      if (existingMember && existingMember.length > 0) {
        throw new Error('You are already a member of this squad!');
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
      loadSquads();
    } catch (err: any) {
      console.error('Error joining squad:', err);
      Alert.alert('Join Failed', err.message || 'Could not join squad.');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Invite code copied to clipboard!');
  };

  if (loading && squads.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  if (selectedSquad) {
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
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedSquad(null)}>
              <ArrowLeft size={20} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{selectedSquad.name}</Text>
              <Text style={styles.headerSubtitle}>SQUAD DASHBOARD</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.container}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
            }
          >
            {/* Invite Code display */}
            <View style={styles.codeCard}>
              <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
              <View>
                <Text style={styles.codeLabel}>INVITE CODE</Text>
                <Text style={styles.codeText}>{selectedSquad.invite_code}</Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyToClipboard(selectedSquad.invite_code)}
              >
                <Copy size={16} color={Theme.colors.primary} />
                <Text style={styles.copyBtnText}>COPY</Text>
              </TouchableOpacity>
            </View>

            {/* Squad Leaderboard */}
            <View style={styles.sectionHeader}>
              <Trophy size={16} color={Theme.colors.primary} />
              <Text style={styles.sectionTitle}>SQUAD STANDINGS</Text>
            </View>

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
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // SQUADS LIST (Viewing all squads + create/join options)
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
          <Text style={styles.headerTitle}>YOUR SQUADS</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />
          }
        >
          {/* Squad list */}
          {squads.length === 0 ? (
            <View style={styles.emptyCard}>
              <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
              <Users size={36} color={Theme.colors.textMuted} style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>Not in any squads.</Text>
              <Text style={styles.emptySubtext}>
                Join a friend's squad to compete or create your own and invite others!
              </Text>
            </View>
          ) : (
            <View style={styles.squadList}>
              {squads.map((squad) => (
                <TouchableOpacity
                  key={squad.id}
                  style={styles.squadCard}
                  onPress={() => handleSelectSquad(squad)}
                >
                  <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={styles.squadCardInfo}>
                    <Text style={styles.squadCardName}>{squad.name}</Text>
                    <Text style={styles.squadCardCode}>Invite: {squad.invite_code}</Text>
                  </View>
                  <ArrowLeft size={16} color={Theme.colors.primary} style={{ transform: [{ rotate: '180deg' }] }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Action Panel: Create Squad */}
          <View style={styles.card}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.cardHeader}>
              <Plus size={18} color={Theme.colors.primary} />
              <Text style={styles.cardTitle}>CREATE NEW SQUAD</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Squad Name (e.g. Iron Giants)"
              placeholderTextColor={Theme.colors.textMuted}
              value={newSquadName}
              onChangeText={setNewSquadName}
            />
            <TouchableOpacity
              style={[styles.actionBtn, Theme.getGlow(Theme.colors.primary, 'low')]}
              onPress={handleCreateSquad}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.actionBtnText}>CREATE SQUAD</Text>}
            </TouchableOpacity>
          </View>

          {/* Action Panel: Join Squad */}
          <View style={styles.card}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.cardHeader}>
              <UserPlus size={18} color={Theme.colors.secondary} />
              <Text style={styles.cardTitle}>JOIN SQUAD VIA CODE</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Invite Code (e.g. 7X3F8A)"
              placeholderTextColor={Theme.colors.textMuted}
              value={joinInviteCode}
              onChangeText={setJoinInviteCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.actionBtnSecondary, Theme.getGlow(Theme.colors.secondary, 'low')]}
              onPress={handleJoinSquad}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.actionBtnText}>JOIN SQUAD</Text>}
            </TouchableOpacity>
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
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: Theme.colors.textMuted,
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
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  squadList: {
    gap: 12,
  },
  squadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  squadCardInfo: {
    gap: 4,
  },
  squadCardName: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
  },
  squadCardCode: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
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
    borderColor: Theme.colors.border,
    paddingBottom: 8,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  input: {
    height: 46,
    backgroundColor: '#06060C',
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    borderRadius: 8,
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    paddingHorizontal: 12,
  },
  actionBtn: {
    height: 46,
    backgroundColor: Theme.colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnSecondary: {
    height: 46,
    backgroundColor: Theme.colors.primary, // Consistently purple primary action
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_900Black',
    letterSpacing: 0.5,
  },
  codeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 15, 43, 0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden',
  },
  codeLabel: {
    color: Theme.colors.textMuted,
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
    backgroundColor: '#06060C',
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  copyBtnText: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
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
    color: Theme.colors.textMuted,
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
    borderColor: Theme.colors.border,
  },
  memberName: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  memberRankText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
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
    color: Theme.colors.textMuted,
    fontFamily: 'Inter_600SemiBold',
  },
  memberStreakText: {
    color: Theme.colors.textMuted,
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 1,
  },
});
