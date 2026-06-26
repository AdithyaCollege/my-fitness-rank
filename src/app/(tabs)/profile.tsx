import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Theme, getRankDetails } from '@/theme/theme';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Flame,
  Dumbbell,
  Trophy,
  Calendar,
  Award,
  LogOut,
  Pencil,
  X,
  Ruler,
  Weight,
  User,
} from 'lucide-react-native';

// ── Emoji Maps ──────────────────────────────────────────────────────────
const GOAL_EMOJIS: Record<string, string> = {
  'Build Muscle': '🏋️',
  'Lose Weight': '🔥',
  'Stay Active': '💪',
  'Improve Endurance': '🏃',
  'Get Stronger': '⚡',
};

const LEVEL_EMOJIS: Record<string, string> = {
  Beginner: '🌱',
  Intermediate: '🔥',
  Advanced: '💎',
};

const GENDER_EMOJIS: Record<string, string> = {
  Male: '♂️',
  Female: '♀️',
  Other: '⚧️',
};

const FITNESS_GOALS = ['Build Muscle', 'Lose Weight', 'Stay Active', 'Improve Endurance', 'Get Stronger'];
const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const GENDERS = ['Male', 'Female', 'Other'];

// ── Helpers ─────────────────────────────────────────────────────────────
function calculateAge(dob: string | null | undefined): string {
  if (!dob) return 'N/A';
  const age = Math.floor(
    (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  return age > 0 && age < 150 ? `${age}` : 'N/A';
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

// ═════════════════════════════════════════════════════════════════════════
export default function ProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    display_name: '',
    gender: '',
    date_of_birth: '',
    height_cm: '',
    weight_kg: '',
    fitness_goal: '',
    experience_level: '',
    bio: '',
  });

  // Single-metric edit state
  const [activeSingleEdit, setActiveSingleEdit] = useState<'height' | 'weight' | 'age' | 'gender' | null>(null);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft_in'>('cm');
  const [inputCm, setInputCm] = useState('');
  const [inputFt, setInputFt] = useState('');
  const [inputIn, setInputIn] = useState('');

  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [inputKg, setInputKg] = useState('');
  const [inputLbs, setInputLbs] = useState('');

  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  const [selectedGender, setSelectedGender] = useState('');

  // ── Data Loading ────────────────────────────────────────────────────
  const loadProfileData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false });

      if (workoutError) throw workoutError;
      setWorkouts(workoutData || []);
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfileData();
  }, [loadProfileData]);

  // ── Edit Modal Handlers ─────────────────────────────────────────────
  const openEditModal = () => {
    if (profile) {
      setEditForm({
        username: profile.username || '',
        display_name: profile.display_name || '',
        gender: profile.gender || '',
        date_of_birth: profile.date_of_birth || '',
        height_cm: profile.height_cm?.toString() || '',
        weight_kg: profile.weight_kg?.toString() || '',
        fitness_goal: profile.fitness_goal || '',
        experience_level: profile.experience_level || '',
        bio: profile.bio || '',
      });
    }
    setEditVisible(true);
  };

  const getUsernameChangesRemaining = () => {
    if (!profile) return 2;
    const changes = profile.username_changes_this_month || 0;
    const lastChangeStr = profile.last_username_change_at;
    if (!lastChangeStr) return 2;
    
    const lastChange = new Date(lastChangeStr);
    const now = new Date();
    const isDifferentMonth =
      lastChange.getUTCFullYear() !== now.getUTCFullYear() ||
      lastChange.getUTCMonth() !== now.getUTCMonth();
      
    if (isDifferentMonth) {
      return 2;
    }
    return Math.max(0, 2 - changes);
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const usernameTrimmed = editForm.username.trim();
      const isUsernameChanging = usernameTrimmed !== (profile.username || '');

      if (isUsernameChanging) {
        if (usernameTrimmed.length < 3 || usernameTrimmed.length > 15) {
          throw new Error('Gamertag must be between 3 and 15 characters.');
        }
        if (!USERNAME_REGEX.test(usernameTrimmed)) {
          throw new Error('Gamertag can only contain letters, numbers, and underscores.');
        }
        
        // Check availability
        const { data: isAvailable, error: checkError } = await supabase.rpc('check_username_available', {
          requested_username: usernameTrimmed,
        });
        if (checkError) {
          console.error('Error checking username availability:', checkError);
        } else if (!isAvailable) {
          throw new Error('This gamertag is already taken.');
        }
      }

      const updates: Record<string, any> = {
        username: usernameTrimmed || null,
        display_name: editForm.display_name.trim() || null,
        gender: editForm.gender || null,
        date_of_birth: editForm.date_of_birth.trim() || null,
        height_cm: editForm.height_cm ? parseFloat(editForm.height_cm) : null,
        weight_kg: editForm.weight_kg ? parseFloat(editForm.weight_kg) : null,
        fitness_goal: editForm.fitness_goal || null,
        experience_level: editForm.experience_level || null,
        bio: editForm.bio.trim() || null,
      };

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(updatedProfile);
      setEditVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const openSingleEdit = (type: 'height' | 'weight' | 'age' | 'gender') => {
    if (!profile) return;
    
    if (type === 'height') {
      const h = profile.height_cm;
      if (h) {
        setInputCm(h.toString());
        const totalInches = h / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = Math.round(totalInches % 12);
        setInputFt(feet.toString());
        setInputIn(inches.toString());
      } else {
        setInputCm('');
        setInputFt('');
        setInputIn('');
      }
      setHeightUnit('cm');
    } else if (type === 'weight') {
      const w = profile.weight_kg;
      if (w) {
        setInputKg(w.toString());
        const lbs = Math.round(w * 2.20462 * 10) / 10;
        setInputLbs(lbs.toString());
      } else {
        setInputKg('');
        setInputLbs('');
      }
      setWeightUnit('kg');
    } else if (type === 'age') {
      const dob = profile.date_of_birth;
      if (dob) {
        const parts = dob.split('-');
        if (parts.length === 3) {
          setDobYear(parts[0]);
          setDobMonth(parts[1]);
          setDobDay(parts[2]);
        } else {
          setDobYear('');
          setDobMonth('');
          setDobDay('');
        }
      } else {
        setDobYear('');
        setDobMonth('');
        setDobDay('');
      }
    } else if (type === 'gender') {
      setSelectedGender(profile.gender || '');
    }

    setActiveSingleEdit(type);
  };

  const saveSingleEdit = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      let updates: Record<string, any> = {};

      if (activeSingleEdit === 'height') {
        let heightCm: number | null = null;
        if (heightUnit === 'cm') {
          if (inputCm.trim() !== '') {
            const val = parseFloat(inputCm);
            if (isNaN(val) || val <= 0 || val > 300) {
              throw new Error('Please enter a valid height in cm (1-300).');
            }
            heightCm = val;
          }
        } else {
          if (inputFt.trim() !== '') {
            const ft = parseFloat(inputFt);
            const inch = parseFloat(inputIn) || 0;
            if (isNaN(ft) || ft <= 0 || ft > 10 || isNaN(inch) || inch < 0 || inch >= 12) {
              throw new Error('Please enter a valid height (feet: 1-10, inches: 0-11).');
            }
            const totalCm = (ft * 30.48) + (inch * 2.54);
            heightCm = Math.round(totalCm * 10) / 10;
          }
        }
        updates = { height_cm: heightCm };
      } else if (activeSingleEdit === 'weight') {
        let weightKg: number | null = null;
        if (weightUnit === 'kg') {
          if (inputKg.trim() !== '') {
            const val = parseFloat(inputKg);
            if (isNaN(val) || val <= 0 || val > 1000) {
              throw new Error('Please enter a valid weight in kg (1-1000).');
            }
            weightKg = val;
          }
        } else {
          if (inputLbs.trim() !== '') {
            const lbs = parseFloat(inputLbs);
            if (isNaN(lbs) || lbs <= 0 || lbs > 2200) {
              throw new Error('Please enter a valid weight in lbs (1-2200).');
            }
            const totalKg = lbs / 2.20462;
            weightKg = Math.round(totalKg * 10) / 10;
          }
        }
        updates = { weight_kg: weightKg };
      } else if (activeSingleEdit === 'age') {
        let dobStr: string | null = null;
        if (dobDay.trim() !== '' || dobMonth.trim() !== '' || dobYear.trim() !== '') {
          const day = parseInt(dobDay, 10);
          const month = parseInt(dobMonth, 10);
          const year = parseInt(dobYear, 10);

          if (isNaN(day) || day < 1 || day > 31) {
            throw new Error('Please enter a valid day (1-31).');
          }
          if (isNaN(month) || month < 1 || month > 12) {
            throw new Error('Please enter a valid month (1-12).');
          }
          const currentYear = new Date().getFullYear();
          if (isNaN(year) || year < currentYear - 120 || year > currentYear) {
            throw new Error(`Please enter a valid year (${currentYear - 120}-${currentYear}).`);
          }

          const tempDate = new Date(year, month - 1, day);
          if (
            tempDate.getFullYear() !== year ||
            tempDate.getMonth() !== month - 1 ||
            tempDate.getDate() !== day
          ) {
            throw new Error('Please enter a valid calendar date.');
          }

          if (tempDate > new Date()) {
            throw new Error('Date of birth cannot be in the future.');
          }

          const formatNum = (n: number) => n.toString().padStart(2, '0');
          dobStr = `${year}-${formatNum(month)}-${formatNum(day)}`;
        }
        updates = { date_of_birth: dobStr };
      } else if (activeSingleEdit === 'gender') {
        updates = { gender: selectedGender || null };
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, ...updates });
      setActiveSingleEdit(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save updates.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // ── Derived Data ────────────────────────────────────────────────────
  const rank = getRankDetails(profile?.total_xp ?? 0);
  const avatarEmoji = profile?.avatar_url?.split(' ')[0] || '🦊';

  // ── Section Renderers ───────────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* ─── Section 1: Profile Hero Card ─── */}
      <View style={styles.profileCard}>
        <View style={[styles.avatarCircle, Theme.getGlow(rank.color, 'low')]}>
          <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
        </View>

        <Text style={styles.username}>{profile?.username ?? '—'}</Text>

        {profile?.display_name ? (
          <Text style={styles.displayName}>{profile.display_name}</Text>
        ) : null}

        <View
          style={[
            styles.rankBadge,
            { borderColor: rank.color },
            Theme.getGlow(rank.color, 'medium'),
          ]}
        >
          <Award size={14} color={rank.color} />
          <Text style={[styles.rankText, { color: rank.color }]}>
            {rank.name} Tier
          </Text>
        </View>

        {profile?.bio ? (
          <Text style={styles.bioText}>"{profile.bio}"</Text>
        ) : null}

        <Text style={styles.joinDate}>
          Joined{' '}
          {profile?.created_at
            ? new Date(profile.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
              })
            : '—'}
        </Text>
      </View>

      {/* ─── Section 2: Physical Stats Row ─── */}
      <View style={styles.physicalRow}>
        <TouchableOpacity
          style={styles.physicalPill}
          activeOpacity={0.7}
          onPress={() => openSingleEdit('height')}
        >
          <Ruler size={14} color={Theme.colors.secondary} />
          <Text style={styles.physicalValue}>
            {profile?.height_cm ? `${profile.height_cm} cm` : 'N/A'}
          </Text>
          <Text style={styles.physicalLabel}>Height</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.physicalPill}
          activeOpacity={0.7}
          onPress={() => openSingleEdit('weight')}
        >
          <Weight size={14} color={Theme.colors.warning} />
          <Text style={styles.physicalValue}>
            {profile?.weight_kg ? `${profile.weight_kg} kg` : 'N/A'}
          </Text>
          <Text style={styles.physicalLabel}>Weight</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.physicalPill}
          activeOpacity={0.7}
          onPress={() => openSingleEdit('age')}
        >
          <User size={14} color={Theme.colors.accent} />
          <Text style={styles.physicalValue}>
            {calculateAge(profile?.date_of_birth)}
          </Text>
          <Text style={styles.physicalLabel}>Age</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.physicalPill}
          activeOpacity={0.7}
          onPress={() => openSingleEdit('gender')}
        >
          <Text style={styles.genderEmoji}>
            {GENDER_EMOJIS[profile?.gender] || '—'}
          </Text>
          <Text style={styles.physicalValue}>
            {profile?.gender || 'N/A'}
          </Text>
          <Text style={styles.physicalLabel}>Gender</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Section 3: Fitness Info ─── */}
      <View style={styles.fitnessInfoRow}>
        {profile?.fitness_goal ? (
          <View style={styles.fitnessPill}>
            <Text style={styles.fitnessPillText}>
              {GOAL_EMOJIS[profile.fitness_goal] || '🎯'} {profile.fitness_goal}
            </Text>
          </View>
        ) : null}

        {profile?.experience_level ? (
          <View style={styles.fitnessPill}>
            <Text style={styles.fitnessPillText}>
              {LEVEL_EMOJIS[profile.experience_level] || '🏅'}{' '}
              {profile.experience_level}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ─── Section 4: Game Stats Grid ─── */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Trophy size={20} color={Theme.colors.warning} />
          <Text style={styles.statValue}>{profile?.total_xp ?? 0}</Text>
          <Text style={styles.statLabel}>Lifetime XP</Text>
        </View>

        <View style={styles.statBox}>
          <Flame size={20} color={Theme.colors.primary} />
          <Text style={styles.statValue}>
            {profile?.current_streak ?? 0}d
          </Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>

        <View style={styles.statBox}>
          <Calendar size={20} color={Theme.colors.secondary} />
          <Text style={styles.statValue}>
            {profile?.longest_streak ?? 0}d
          </Text>
          <Text style={styles.statLabel}>Longest Streak</Text>
        </View>

        <View style={styles.statBox}>
          <Dumbbell size={20} color={Theme.colors.accent} />
          <Text style={styles.statValue}>{workouts.length}</Text>
          <Text style={styles.statLabel}>Total Workouts</Text>
        </View>
      </View>

      {/* ─── Section 6: Action Buttons ─── */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: Theme.colors.primary }]}
          onPress={openEditModal}
          activeOpacity={0.7}
        >
          <Pencil size={16} color={Theme.colors.primary} />
          <Text style={[styles.actionBtnText, { color: Theme.colors.primary }]}>
            Edit Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: Theme.colors.danger }]}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <LogOut size={16} color={Theme.colors.danger} />
          <Text style={[styles.actionBtnText, { color: Theme.colors.danger }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      {/* Section 5 header */}
      <Text style={styles.historyTitle}>WORKOUT LOG HISTORY</Text>
    </View>
  );

  // ── Workout Item ────────────────────────────────────────────────────
  const renderWorkoutItem = ({ item }: { item: any }) => (
    <View style={styles.workoutCard}>
      <View style={styles.workoutRow}>
        <View style={[styles.workoutMeta, { alignItems: 'flex-start', flex: 1 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.workoutType}>{item.exercise_name || item.type}</Text>
            {item.exercise_name && (
              <Text style={{ color: Theme.colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 }}>
                {item.type.toUpperCase()}{item.primary_muscle ? ` • ${item.primary_muscle.toUpperCase()}` : ''}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.intensityTag,
              {
                marginTop: 2,
                color:
                  item.intensity === 'Intense'
                    ? Theme.colors.danger
                    : item.intensity === 'Moderate'
                    ? Theme.colors.warning
                    : Theme.colors.success,
              },
            ]}
          >
            {item.intensity}
          </Text>
        </View>
        <Text style={styles.xpText}>+{item.xp_earned} XP</Text>
      </View>

      <Text style={styles.workoutSub}>
        {item.duration_min} minutes •{' '}
        {new Date(item.logged_at).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </Text>

      {item.sets_reps && item.sets_reps.length > 0 ? (
        <View style={styles.setsContainer}>
          {item.sets_reps.map((set: any, index: number) => (
            <View key={index} style={styles.setRow}>
              <Text style={styles.setLabel}>Set {index + 1}:</Text>
              <Text style={styles.setValue}>
                {set.weight_lbs > 0 ? `${set.weight_lbs} lbs` : ''} {set.reps}{' '}
                reps
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {item.notes ? (
        <Text style={styles.notesText}>"{item.notes}"</Text>
      ) : null}
    </View>
  );

  // ── Option Picker (inline) ──────────────────────────────────────────
  const OptionPicker = ({
    label,
    options,
    value,
    onChange,
  }: {
    label: string;
    options: string[];
    value: string;
    onChange: (v: string) => void;
  }) => (
    <View style={styles.editFieldContainer}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <View style={styles.optionsRow}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.optionChip,
                selected && {
                  borderColor: Theme.colors.primary,
                  backgroundColor: Theme.colors.primary + '22',
                },
              ]}
              onPress={() => onChange(opt)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.optionChipText,
                  selected && { color: Theme.colors.primary },
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── Edit Modal ──────────────────────────────────────────────────────
  const renderEditModal = () => (
    <Modal
      visible={editVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setEditVisible(false)}
    >
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={() => setEditVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={24} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Username (Gamertag) */}
            <View style={styles.editFieldContainer}>
              <Text style={styles.editFieldLabel}>Gamertag</Text>
              {(() => {
                const changesRemaining = getUsernameChangesRemaining();
                const isLocked = changesRemaining <= 0;
                return (
                  <>
                    <TextInput
                      style={[
                        styles.editInput,
                        isLocked && { backgroundColor: Theme.colors.cardSecondary, color: Theme.colors.textMuted }
                      ]}
                      value={editForm.username}
                      onChangeText={(t) => {
                        setEditForm((f) => ({ ...f, username: t.toLowerCase().replace(/[^a-z0-9_]/g, '') }));
                      }}
                      placeholder="Choose a unique username"
                      placeholderTextColor={Theme.colors.textMuted + '80'}
                      maxLength={15}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLocked}
                    />
                    {isLocked ? (
                      <Text style={[styles.readOnlyHint, { color: Theme.colors.danger }]}>
                        You have changed your gamertag 2 times this month. Changes are locked until next month.
                      </Text>
                    ) : (
                      <Text style={styles.readOnlyHint}>
                        Changes remaining this month: {changesRemaining}. Gamertag must be 3-15 chars, unique.
                      </Text>
                    )}
                  </>
                );
              })()}
            </View>

            {/* Display Name */}
            <View style={styles.editFieldContainer}>
              <Text style={styles.editFieldLabel}>Display Name</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.display_name}
                onChangeText={(t) =>
                  setEditForm((f) => ({ ...f, display_name: t }))
                }
                placeholder="Your display name"
                placeholderTextColor={Theme.colors.textMuted + '80'}
                maxLength={40}
              />
            </View>

            {/* Bio */}
            <View style={styles.editFieldContainer}>
              <Text style={styles.editFieldLabel}>Bio</Text>
              <TextInput
                style={[styles.editInput, { height: 80, textAlignVertical: 'top' }]}
                value={editForm.bio}
                onChangeText={(t) => setEditForm((f) => ({ ...f, bio: t }))}
                placeholder="Write something about yourself…"
                placeholderTextColor={Theme.colors.textMuted + '80'}
                maxLength={160}
                multiline
              />
            </View>

            {/* Gender */}
            <OptionPicker
              label="Gender"
              options={GENDERS}
              value={editForm.gender}
              onChange={(v) => setEditForm((f) => ({ ...f, gender: v }))}
            />

            {/* Date of Birth */}
            <View style={styles.editFieldContainer}>
              <Text style={styles.editFieldLabel}>Date of Birth (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.date_of_birth}
                onChangeText={(t) =>
                  setEditForm((f) => ({ ...f, date_of_birth: t }))
                }
                placeholder="2000-01-15"
                placeholderTextColor={Theme.colors.textMuted + '80'}
                maxLength={10}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            {/* Height */}
            <View style={styles.editFieldContainer}>
              <Text style={styles.editFieldLabel}>Height (cm)</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.height_cm}
                onChangeText={(t) =>
                  setEditForm((f) => ({ ...f, height_cm: t }))
                }
                placeholder="175"
                placeholderTextColor={Theme.colors.textMuted + '80'}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>

            {/* Weight */}
            <View style={styles.editFieldContainer}>
              <Text style={styles.editFieldLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.editInput}
                value={editForm.weight_kg}
                onChangeText={(t) =>
                  setEditForm((f) => ({ ...f, weight_kg: t }))
                }
                placeholder="70"
                placeholderTextColor={Theme.colors.textMuted + '80'}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>

            {/* Fitness Goal */}
            <OptionPicker
              label="Fitness Goal"
              options={FITNESS_GOALS}
              value={editForm.fitness_goal}
              onChange={(v) => setEditForm((f) => ({ ...f, fitness_goal: v }))}
            />

            {/* Experience Level */}
            <OptionPicker
              label="Experience Level"
              options={EXPERIENCE_LEVELS}
              value={editForm.experience_level}
              onChange={(v) =>
                setEditForm((f) => ({ ...f, experience_level: v }))
              }
            />

            {/* Save */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                saving && { opacity: 0.5 },
              ]}
              onPress={saveProfile}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  // ── Single Edit Modal ──────────────────────────────────────────────────
  const renderSingleEditModal = () => {
    if (!activeSingleEdit) return null;

    const getTitle = () => {
      switch (activeSingleEdit) {
        case 'height':
          return 'EDIT HEIGHT';
        case 'weight':
          return 'EDIT WEIGHT';
        case 'age':
          return 'EDIT DATE OF BIRTH';
        case 'gender':
          return 'EDIT GENDER';
        default:
          return 'EDIT STAT';
      }
    };

    return (
      <Modal
        visible={activeSingleEdit !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActiveSingleEdit(null)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalCenteringContainer}
          >
            <View style={[styles.singleEditCard, Theme.getGlow(Theme.colors.border, 'low')]}>
              {/* Header */}
              <View style={styles.singleEditHeader}>
                <Text style={styles.singleEditTitle}>{getTitle()}</Text>
                <TouchableOpacity
                  onPress={() => setActiveSingleEdit(null)}
                  style={styles.singleEditCloseButton}
                  activeOpacity={0.7}
                >
                  <X size={18} color={Theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.singleEditContent}>
                {/* 1. Height Modal Content */}
                {activeSingleEdit === 'height' && (
                  <View style={styles.singleEditFieldContainer}>
                    {/* Unit Switcher */}
                    <View style={styles.unitSelectorRow}>
                      <TouchableOpacity
                        style={[
                          styles.unitSelectorTab,
                          heightUnit === 'cm' && styles.unitSelectorTabActive,
                        ]}
                        onPress={() => setHeightUnit('cm')}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.unitSelectorTabText,
                            heightUnit === 'cm' && styles.unitSelectorTabTextActive,
                          ]}
                        >
                          METRIC (cm)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.unitSelectorTab,
                          heightUnit === 'ft_in' && styles.unitSelectorTabActive,
                        ]}
                        onPress={() => setHeightUnit('ft_in')}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.unitSelectorTabText,
                            heightUnit === 'ft_in' && styles.unitSelectorTabTextActive,
                          ]}
                        >
                          IMPERIAL (ft/in)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {heightUnit === 'cm' ? (
                      <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>Height (cm)</Text>
                        <TextInput
                          style={styles.singleInput}
                          placeholder="e.g. 180"
                          placeholderTextColor={Theme.colors.textMuted + '60'}
                          value={inputCm}
                          onChangeText={(t) => setInputCm(t.replace(/[^0-9.]/g, ''))}
                          keyboardType="numeric"
                          maxLength={5}
                          autoFocus={true}
                        />
                      </View>
                    ) : (
                      <View style={styles.rowInputsContainer}>
                        <View style={[styles.inputWrapper, { flex: 1 }]}>
                          <Text style={styles.inputLabel}>Feet (ft)</Text>
                          <TextInput
                            style={styles.singleInput}
                            placeholder="5"
                            placeholderTextColor={Theme.colors.textMuted + '60'}
                            value={inputFt}
                            onChangeText={(t) => setInputFt(t.replace(/[^0-9]/g, ''))}
                            keyboardType="numeric"
                            maxLength={2}
                            autoFocus={true}
                          />
                        </View>
                        <View style={[styles.inputWrapper, { flex: 1 }]}>
                          <Text style={styles.inputLabel}>Inches (in)</Text>
                          <TextInput
                            style={styles.singleInput}
                            placeholder="9"
                            placeholderTextColor={Theme.colors.textMuted + '60'}
                            value={inputIn}
                            onChangeText={(t) => setInputIn(t.replace(/[^0-9]/g, ''))}
                            keyboardType="numeric"
                            maxLength={2}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* 2. Weight Modal Content */}
                {activeSingleEdit === 'weight' && (
                  <View style={styles.singleEditFieldContainer}>
                    {/* Unit Switcher */}
                    <View style={styles.unitSelectorRow}>
                      <TouchableOpacity
                        style={[
                          styles.unitSelectorTab,
                          weightUnit === 'kg' && styles.unitSelectorTabActive,
                        ]}
                        onPress={() => setWeightUnit('kg')}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.unitSelectorTabText,
                            weightUnit === 'kg' && styles.unitSelectorTabTextActive,
                          ]}
                        >
                          METRIC (kg)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.unitSelectorTab,
                          weightUnit === 'lbs' && styles.unitSelectorTabActive,
                        ]}
                        onPress={() => setWeightUnit('lbs')}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.unitSelectorTabText,
                            weightUnit === 'lbs' && styles.unitSelectorTabTextActive,
                          ]}
                        >
                          IMPERIAL (lbs)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {weightUnit === 'kg' ? (
                      <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>Weight (kg)</Text>
                        <TextInput
                          style={styles.singleInput}
                          placeholder="e.g. 75"
                          placeholderTextColor={Theme.colors.textMuted + '60'}
                          value={inputKg}
                          onChangeText={(t) => setInputKg(t.replace(/[^0-9.]/g, ''))}
                          keyboardType="numeric"
                          maxLength={5}
                          autoFocus={true}
                        />
                      </View>
                    ) : (
                      <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>Weight (lbs)</Text>
                        <TextInput
                          style={styles.singleInput}
                          placeholder="e.g. 165"
                          placeholderTextColor={Theme.colors.textMuted + '60'}
                          value={inputLbs}
                          onChangeText={(t) => setInputLbs(t.replace(/[^0-9.]/g, ''))}
                          keyboardType="numeric"
                          maxLength={5}
                          autoFocus={true}
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* 3. Age Modal Content */}
                {activeSingleEdit === 'age' && (
                  <View style={styles.singleEditFieldContainer}>
                    <Text style={styles.inputLabel}>Enter Date of Birth</Text>
                    <View style={styles.dobContainerRow}>
                      <View style={[styles.inputWrapper, { flex: 1 }]}>
                        <Text style={styles.dobSubLabel}>DD</Text>
                        <TextInput
                          style={styles.dobInputText}
                          placeholder="01"
                          placeholderTextColor={Theme.colors.textMuted + '60'}
                          value={dobDay}
                          onChangeText={(t) => setDobDay(t.replace(/[^0-9]/g, '').slice(0, 2))}
                          keyboardType="numeric"
                          maxLength={2}
                          autoFocus={true}
                        />
                      </View>
                      <Text style={styles.dobSeparatorText}>/</Text>
                      <View style={[styles.inputWrapper, { flex: 1 }]}>
                        <Text style={styles.dobSubLabel}>MM</Text>
                        <TextInput
                          style={styles.dobInputText}
                          placeholder="06"
                          placeholderTextColor={Theme.colors.textMuted + '60'}
                          value={dobMonth}
                          onChangeText={(t) => setDobMonth(t.replace(/[^0-9]/g, '').slice(0, 2))}
                          keyboardType="numeric"
                          maxLength={2}
                        />
                      </View>
                      <Text style={styles.dobSeparatorText}>/</Text>
                      <View style={[styles.inputWrapper, { flex: 2 }]}>
                        <Text style={styles.dobSubLabel}>YYYY</Text>
                        <TextInput
                          style={styles.dobInputText}
                          placeholder="2000"
                          placeholderTextColor={Theme.colors.textMuted + '60'}
                          value={dobYear}
                          onChangeText={(t) => setDobYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
                          keyboardType="numeric"
                          maxLength={4}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* 4. Gender Modal Content */}
                {activeSingleEdit === 'gender' && (
                  <View style={styles.singleEditFieldContainer}>
                    <Text style={styles.inputLabel}>Select Gender</Text>
                    <View style={styles.genderChipsContainer}>
                      {GENDERS.map((g) => {
                        const selected = selectedGender === g;
                        const emoji = GENDER_EMOJIS[g] || '';
                        return (
                          <TouchableOpacity
                            key={g}
                            style={[
                              styles.genderChipItem,
                              selected && {
                                borderColor: Theme.colors.primary,
                                backgroundColor: Theme.colors.primary + '18',
                              },
                            ]}
                            onPress={() => setSelectedGender(g)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.genderChipEmoji}>{emoji}</Text>
                            <Text
                              style={[
                                styles.genderChipItemText,
                                selected && { color: Theme.colors.primary, fontWeight: '700' },
                              ]}
                            >
                              {g}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              {/* Actions Footer */}
              <View style={styles.singleEditActions}>
                <TouchableOpacity
                  style={styles.singleEditCancelBtn}
                  onPress={() => setActiveSingleEdit(null)}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  <Text style={styles.singleEditCancelText}>CANCEL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.singleEditSaveBtn,
                    Theme.getGlow(Theme.colors.primary, 'low'),
                  ]}
                  onPress={saveSingleEdit}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.singleEditSaveText}>SAVE</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  };

  // ── Loading State ───────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  // ── Main Render ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={workouts}
        renderItem={renderWorkoutItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Dumbbell
              size={28}
              color={Theme.colors.textMuted}
              style={{ opacity: 0.5 }}
            />
            <Text style={styles.emptyText}>No workout logs.</Text>
            <Text style={styles.emptySubtext}>
              Your fitness journey starts when you log your first activity!
            </Text>
          </View>
        }
      />

      {renderEditModal()}
      {renderSingleEditModal()}
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // ── Layout ────────────────────────────────────────────────────
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
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    gap: 16,
    marginBottom: 16,
  },

  // ── Section 1: Profile Card ───────────────────────────────────
  profileCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    backgroundColor: Theme.colors.background,
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Theme.colors.border,
  },
  avatarEmoji: {
    fontSize: 42,
    lineHeight: 50,
    textAlign: 'center',
  },
  username: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  displayName: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
    backgroundColor: Theme.colors.background,
    marginTop: 4,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bioText: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  joinDate: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  // ── Section 2: Physical Stats Row ─────────────────────────────
  physicalRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  physicalPill: {
    flex: 1,
    backgroundColor: Theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  physicalValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  physicalLabel: {
    color: Theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  genderEmoji: {
    fontSize: 16,
    lineHeight: 18,
  },

  // ── Section 3: Fitness Info ───────────────────────────────────
  fitnessInfoRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  fitnessPill: {
    backgroundColor: Theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  fitnessPillText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Section 4: Stats Grid ────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%' as any,
    backgroundColor: Theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Section 6: Actions ────────────────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Section 5: Workout History ────────────────────────────────
  historyTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
    paddingBottom: 8,
  },
  workoutCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    gap: 6,
    marginBottom: 12,
  },
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutType: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  intensityTag: {
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpText: {
    color: Theme.colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  workoutSub: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  setsContainer: {
    backgroundColor: Theme.colors.background,
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  setRow: {
    flexDirection: 'row',
    gap: 8,
  },
  setLabel: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    width: 44,
  },
  setValue: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  notesText: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // ── Empty State ───────────────────────────────────────────────
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

  // ── Edit Modal ────────────────────────────────────────────────
  modalSafeArea: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    gap: 20,
  },
  editFieldContainer: {
    gap: 8,
  },
  editFieldLabel: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  editInput: {
    backgroundColor: Theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readOnlyField: {
    backgroundColor: Theme.colors.cardSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readOnlyText: {
    color: Theme.colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  readOnlyHint: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: Theme.colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  optionChipText: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  // ── Single Edit Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCenteringContainer: {
    width: '90%',
    maxWidth: 380,
    justifyContent: 'center',
  },
  singleEditCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 20,
    gap: 16,
  },
  singleEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    paddingBottom: 12,
  },
  singleEditTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  singleEditCloseButton: {
    padding: 4,
  },
  singleEditContent: {
    paddingVertical: 12,
  },
  singleEditFieldContainer: {
    gap: 16,
  },
  unitSelectorRow: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background,
    borderRadius: 8,
    padding: 4,
    gap: 4,
    marginBottom: 8,
  },
  unitSelectorTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  unitSelectorTabActive: {
    backgroundColor: Theme.colors.cardSecondary,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  unitSelectorTabText: {
    color: Theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  unitSelectorTabTextActive: {
    color: Theme.colors.primary,
  },
  inputWrapper: {
    gap: 6,
  },
  inputLabel: {
    color: Theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  singleInput: {
    backgroundColor: Theme.colors.background,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: '#FFF',
    height: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  rowInputsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dobContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dobInputText: {
    backgroundColor: Theme.colors.background,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: '#FFF',
    height: 48,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  dobSeparatorText: {
    color: Theme.colors.border,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 18,
  },
  dobSubLabel: {
    color: Theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  genderChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  genderChipItem: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Theme.colors.background,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  genderChipEmoji: {
    fontSize: 14,
  },
  genderChipItemText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  singleEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: 16,
  },
  singleEditCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleEditCancelText: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  singleEditSaveBtn: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleEditSaveText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
