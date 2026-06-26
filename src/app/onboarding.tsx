import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { Theme } from '@/theme/theme';
import { useRouter } from 'expo-router';
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react-native';

// ─── Constants ──────────────────────────────────────────────────────────────────

const AVATARS = [
  { name: 'Titan', emoji: '🥋', color: '#FFB300', desc: 'Strength & Power' },
  { name: 'Blaze', emoji: '☄️', color: '#FF0055', desc: 'Speed & Burn' },
  { name: 'Apex', emoji: '🦊', color: '#00FF66', desc: 'Skill & Agility' },
  { name: 'Shadow', emoji: '🌪️', color: '#B026FF', desc: 'Stealth & Focus' },
  { name: 'Frost', emoji: '❄️', color: '#00F0FF', desc: 'Cool & Consistent' },
  { name: 'Vortex', emoji: '🌀', color: '#FF5E00', desc: 'Endurance & Flow' },
];

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const FITNESS_GOALS = [
  { key: 'build_muscle', emoji: '🏋️', title: 'Build Muscle' },
  { key: 'lose_weight', emoji: '🔥', title: 'Lose Weight' },
  { key: 'stay_active', emoji: '💪', title: 'Stay Active' },
  { key: 'improve_endurance', emoji: '🏃', title: 'Improve Endurance' },
  { key: 'get_stronger', emoji: '⚡', title: 'Get Stronger' },
];

const EXPERIENCE_LEVELS = [
  { key: 'beginner', emoji: '🌱', title: 'Beginner', desc: '0-6 months of training' },
  { key: 'intermediate', emoji: '🔥', title: 'Intermediate', desc: '6 months to 2 years of training' },
  { key: 'advanced', emoji: '💎', title: 'Advanced', desc: '2+ years of consistent training' },
];

const TOTAL_STEPS = 3;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

// ─── Component ──────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  // Global state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Step 1 — Identity
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('Apex');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 — Physical Details
  const [gender, setGender] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Step 3 — Fitness Profile
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [bio, setBio] = useState('');

  // ─── Load user session ────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const fullName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          '';
        setDisplayName(fullName);
      }
      setLoading(false);
    })();
  }, []);

  // ─── Username debounced uniqueness check ──────────────────────────────────────

  const checkUsername = useCallback(async (value: string) => {
    if (value.length < 3) {
      setUsernameStatus('invalid');
      return;
    }
    if (!USERNAME_REGEX.test(value)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    try {
      const { data, error } = await supabase.rpc('check_username_available', {
        requested_username: value,
      });
      if (error) {
        setUsernameStatus('idle');
        return;
      }
      setUsernameStatus(data ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  }, []);

  const handleUsernameChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15);
    setUsername(sanitized);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (sanitized.length < 3) {
      setUsernameStatus(sanitized.length === 0 ? 'idle' : 'invalid');
      return;
    }
    if (!USERNAME_REGEX.test(sanitized)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    debounceTimer.current = setTimeout(() => {
      checkUsername(sanitized);
    }, 500);
  };

  // ─── Navigation helpers ───────────────────────────────────────────────────────

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const validateStep1 = (): boolean => {
    if (!username || username.trim().length < 3) {
      Alert.alert('Invalid Gamertag', 'Your gamertag must be at least 3 characters long.');
      return false;
    }
    if (!USERNAME_REGEX.test(username)) {
      Alert.alert('Invalid Gamertag', 'Gamertag can only contain letters, numbers, and underscores.');
      return false;
    }
    if (usernameStatus === 'taken') {
      Alert.alert('Username Taken', 'This gamertag is already in use. Please choose another.');
      return false;
    }
    if (!displayName.trim()) {
      Alert.alert('Display Name Required', 'Please enter your display name.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!gender) {
      Alert.alert('Gender Required', 'Please select your gender.');
      return false;
    }
    if (!dobDay || !dobMonth || !dobYear) {
      Alert.alert('Date of Birth Required', 'Please enter your complete date of birth.');
      return false;
    }
    const day = parseInt(dobDay, 10);
    const month = parseInt(dobMonth, 10);
    const year = parseInt(dobYear, 10);
    if (isNaN(day) || isNaN(month) || isNaN(year) || day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > new Date().getFullYear()) {
      Alert.alert('Invalid Date', 'Please enter a valid date of birth.');
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    if (!fitnessGoal) {
      Alert.alert('Goal Required', 'Please select your fitness goal.');
      return false;
    }
    if (!experienceLevel) {
      Alert.alert('Experience Required', 'Please select your experience level.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    scrollToTop();
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 1));
    scrollToTop();
  };

  // ─── Save profile ────────────────────────────────────────────────────────────

  const handleFinish = async () => {
    if (!validateStep3()) return;
    if (!userId) return;

    setSaving(true);
    try {
      const selectedAvatarData = AVATARS.find((a) => a.name === selectedAvatar);
      const dd = dobDay.padStart(2, '0');
      const mm = dobMonth.padStart(2, '0');
      const yyyy = dobYear;

      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          display_name: displayName.trim(),
          avatar_url: `${selectedAvatarData?.emoji || '🦊'} ${selectedAvatar}`,
          gender,
          date_of_birth: `${yyyy}-${mm}-${dd}`,
          height_cm: parseFloat(height) || null,
          weight_kg: parseFloat(weight) || null,
          fitness_goal: fitnessGoal,
          experience_level: experienceLevel,
          bio: bio.trim() || null,
          onboarded: true,
        })
        .eq('id', userId);

      if (error) {
        if (error.code === '23505' || error.message?.includes('unique')) {
          throw new Error('This gamertag is already taken. Go back and choose another!');
        }
        throw error;
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Setup Failed', err.message || 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────────

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={styles.progressDotRow}>
          <View
            style={[
              styles.progressDot,
              { backgroundColor: s <= step ? Theme.colors.primary : Theme.colors.border },
              s <= step && Theme.getGlow(Theme.colors.primary, 'low'),
            ]}
          />
          {s < 3 && (
            <View
              style={[
                styles.progressLine,
                { backgroundColor: s < step ? Theme.colors.primary : Theme.colors.border },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStepLabel = () => {
    const labels = ['IDENTITY', 'PHYSICAL DETAILS', 'FITNESS PROFILE'];
    return (
      <View style={styles.stepLabelContainer}>
        <Text style={styles.stepLabelStep}>STEP {step} OF {TOTAL_STEPS}</Text>
        <Text style={styles.stepLabelTitle}>{labels[step - 1]}</Text>
      </View>
    );
  };

  // ─── Step 1: Identity ─────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      {/* Gamertag */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>GAMERTAG</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFull}
            placeholder="Choose a unique username"
            placeholderTextColor={Theme.colors.textMuted}
            value={username}
            onChangeText={handleUsernameChange}
            maxLength={15}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.inputStatusIcon}>
            {usernameStatus === 'checking' && (
              <ActivityIndicator size="small" color={Theme.colors.secondary} />
            )}
            {usernameStatus === 'available' && (
              <Check size={18} color={Theme.colors.success} strokeWidth={3} />
            )}
            {usernameStatus === 'taken' && (
              <X size={18} color={Theme.colors.danger} strokeWidth={3} />
            )}
            {usernameStatus === 'invalid' && username.length > 0 && (
              <X size={18} color={Theme.colors.warning} strokeWidth={3} />
            )}
          </View>
        </View>
        {usernameStatus === 'taken' && (
          <Text style={[styles.inputTip, { color: Theme.colors.danger }]}>
            This gamertag is already taken.
          </Text>
        )}
        {usernameStatus === 'available' && (
          <Text style={[styles.inputTip, { color: Theme.colors.success }]}>
            Gamertag is available!
          </Text>
        )}
        {(usernameStatus === 'idle' || usernameStatus === 'checking' || usernameStatus === 'invalid') && (
          <Text style={styles.inputTip}>3-15 characters. Letters, numbers, and underscores only.</Text>
        )}
      </View>

      {/* Display Name */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>DISPLAY NAME</Text>
        <TextInput
          style={styles.inputFull}
          placeholder="Your real name"
          placeholderTextColor={Theme.colors.textMuted}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={50}
          autoCorrect={false}
        />
        <Text style={styles.inputTip}>This is your public display name, not unique.</Text>
      </View>

      {/* Avatar Clan Selection */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AVATAR CLAN</Text>
        <View style={styles.avatarGrid}>
          {AVATARS.map((avatar) => {
            const isSelected = selectedAvatar === avatar.name;
            return (
              <TouchableOpacity
                key={avatar.name}
                style={[
                  styles.avatarCell,
                  { borderColor: isSelected ? avatar.color : Theme.colors.border },
                  isSelected && Theme.getGlow(avatar.color, 'low'),
                ]}
                onPress={() => setSelectedAvatar(avatar.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                <Text style={[styles.avatarName, { color: isSelected ? avatar.color : '#FFF' }]}>
                  {avatar.name}
                </Text>
                <Text style={styles.avatarDesc}>{avatar.desc}</Text>
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: avatar.color }]}>
                    <Check size={10} color="#000" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );

  // ─── Step 2: Physical Details ─────────────────────────────────────────────────

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      {/* Gender */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>GENDER</Text>
        <View style={styles.pillRow}>
          {GENDERS.map((g) => {
            const isSelected = gender === g;
            return (
              <TouchableOpacity
                key={g}
                style={[
                  styles.pill,
                  isSelected && {
                    backgroundColor: Theme.colors.primary,
                    borderColor: Theme.colors.primary,
                  },
                  isSelected && Theme.getGlow(Theme.colors.primary, 'low'),
                ]}
                onPress={() => setGender(g)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pillText,
                    isSelected && { color: '#000', fontWeight: '800' },
                  ]}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Date of Birth */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>DATE OF BIRTH</Text>
        <View style={styles.dobRow}>
          <View style={styles.dobFieldContainer}>
            <Text style={styles.dobLabel}>DD</Text>
            <TextInput
              style={styles.dobInput}
              placeholder="01"
              placeholderTextColor={Theme.colors.textMuted}
              value={dobDay}
              onChangeText={(v) => setDobDay(v.replace(/[^0-9]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <Text style={styles.dobSeparator}>/</Text>
          <View style={styles.dobFieldContainer}>
            <Text style={styles.dobLabel}>MM</Text>
            <TextInput
              style={styles.dobInput}
              placeholder="06"
              placeholderTextColor={Theme.colors.textMuted}
              value={dobMonth}
              onChangeText={(v) => setDobMonth(v.replace(/[^0-9]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <Text style={styles.dobSeparator}>/</Text>
          <View style={styles.dobFieldContainer}>
            <Text style={styles.dobLabel}>YYYY</Text>
            <TextInput
              style={styles.dobInput}
              placeholder="2000"
              placeholderTextColor={Theme.colors.textMuted}
              value={dobYear}
              onChangeText={(v) => setDobYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>
      </View>

      {/* Height */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>HEIGHT (cm)</Text>
        <TextInput
          style={styles.inputFull}
          placeholder="e.g. 175"
          placeholderTextColor={Theme.colors.textMuted}
          value={height}
          onChangeText={(v) => setHeight(v.replace(/[^0-9.]/g, ''))}
          keyboardType="numeric"
          maxLength={6}
        />
      </View>

      {/* Weight */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CURRENT WEIGHT (kg)</Text>
        <TextInput
          style={styles.inputFull}
          placeholder="e.g. 72"
          placeholderTextColor={Theme.colors.textMuted}
          value={weight}
          onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, ''))}
          keyboardType="numeric"
          maxLength={6}
        />
      </View>
    </View>
  );

  // ─── Step 3: Fitness Profile ──────────────────────────────────────────────────

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      {/* Fitness Goal */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>FITNESS GOAL</Text>
        <View style={styles.goalGrid}>
          {FITNESS_GOALS.map((goal) => {
            const isSelected = fitnessGoal === goal.key;
            return (
              <TouchableOpacity
                key={goal.key}
                style={[
                  styles.goalCard,
                  isSelected && {
                    borderColor: Theme.colors.primary,
                  },
                  isSelected && Theme.getGlow(Theme.colors.primary, 'low'),
                ]}
                onPress={() => setFitnessGoal(goal.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                <Text
                  style={[
                    styles.goalTitle,
                    isSelected && { color: Theme.colors.primary },
                  ]}
                >
                  {goal.title}
                </Text>
                {isSelected && (
                  <View style={[styles.checkBadgeSmall, { backgroundColor: Theme.colors.primary }]}>
                    <Check size={8} color="#000" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Experience Level */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>EXPERIENCE LEVEL</Text>
        <View style={styles.expColumn}>
          {EXPERIENCE_LEVELS.map((level) => {
            const isSelected = experienceLevel === level.key;
            return (
              <TouchableOpacity
                key={level.key}
                style={[
                  styles.expCard,
                  isSelected && {
                    borderColor: Theme.colors.primary,
                  },
                  isSelected && Theme.getGlow(Theme.colors.primary, 'low'),
                ]}
                onPress={() => setExperienceLevel(level.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.expEmoji}>{level.emoji}</Text>
                <View style={styles.expTextContainer}>
                  <Text
                    style={[
                      styles.expTitle,
                      isSelected && { color: Theme.colors.primary },
                    ]}
                  >
                    {level.title}
                  </Text>
                  <Text style={styles.expDesc}>{level.desc}</Text>
                </View>
                {isSelected && (
                  <View style={[styles.checkBadgeSmall, { backgroundColor: Theme.colors.primary }]}>
                    <Check size={8} color="#000" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Bio */}
      <View style={styles.card}>
        <View style={styles.bioHeader}>
          <Text style={styles.sectionTitle}>BIO</Text>
          <Text style={styles.bioOptional}>OPTIONAL</Text>
        </View>
        <TextInput
          style={styles.bioInput}
          placeholder="Tell the squad about yourself..."
          placeholderTextColor={Theme.colors.textMuted}
          value={bio}
          onChangeText={(v) => setBio(v.slice(0, 150))}
          multiline
          maxLength={150}
          textAlignVertical="top"
        />
        <Text style={styles.bioCounter}>
          {bio.length}/150
        </Text>
      </View>
    </View>
  );

  // ─── Loading screen ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderProgressBar()}
        {renderStepLabel()}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Navigation Buttons */}
        <View style={styles.navRow}>
          {step > 1 ? (
            <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
              <ChevronLeft size={18} color={Theme.colors.textMuted} />
              <Text style={styles.backButtonText}>BACK</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}

          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[styles.nextButton, Theme.getGlow(Theme.colors.primary, 'low')]}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>NEXT</Text>
              <ChevronRight size={18} color="#000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, Theme.getGlow(Theme.colors.primary, 'medium')]}
              onPress={handleFinish}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.nextButtonText}>FINISH</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flexGrow: 1,
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // ─── Progress Bar ─────────────────────────────────────────────────────────
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  progressDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressLine: {
    width: 60,
    height: 2,
    marginHorizontal: 4,
  },

  // ─── Step Label ───────────────────────────────────────────────────────────
  stepLabelContainer: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 4,
  },
  stepLabelStep: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 2,
  },
  stepLabelTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1.5,
  },

  // ─── Step Content ─────────────────────────────────────────────────────────
  stepContent: {
    gap: 20,
  },

  // ─── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // ─── Inputs ───────────────────────────────────────────────────────────────
  inputFull: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 14,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 14,
  },
  inputStatusIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputTip: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },

  // ─── Avatar Grid ──────────────────────────────────────────────────────────
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  avatarCell: {
    width: '47%' as any,
    backgroundColor: Theme.colors.background,
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    position: 'relative',
    gap: 4,
  },
  avatarEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  avatarName: {
    fontSize: 14,
    fontWeight: '800',
  },
  avatarDesc: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBadgeSmall: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Gender Pills ─────────────────────────────────────────────────────────
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.background,
  },
  pillText: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── Date of Birth ────────────────────────────────────────────────────────
  dobRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  dobFieldContainer: {
    flex: 1,
    gap: 4,
  },
  dobLabel: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dobInput: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 12,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  dobSeparator: {
    color: Theme.colors.textMuted,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },

  // ─── Fitness Goal Grid ────────────────────────────────────────────────────
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalCard: {
    width: '47%' as any,
    backgroundColor: Theme.colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
    gap: 6,
  },
  goalEmoji: {
    fontSize: 28,
  },
  goalTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // ─── Experience Level ─────────────────────────────────────────────────────
  expColumn: {
    gap: 10,
  },
  expCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    position: 'relative',
    gap: 14,
  },
  expEmoji: {
    fontSize: 28,
  },
  expTextContainer: {
    flex: 1,
    gap: 2,
  },
  expTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  expDesc: {
    fontSize: 11,
    color: Theme.colors.textMuted,
  },

  // ─── Bio ──────────────────────────────────────────────────────────────────
  bioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bioOptional: {
    fontSize: 10,
    color: Theme.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bioInput: {
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 8,
    minHeight: 90,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  bioCounter: {
    fontSize: 11,
    color: Theme.colors.textMuted,
    textAlign: 'right',
  },

  // ─── Navigation Buttons ───────────────────────────────────────────────────
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    paddingBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 4,
  },
  backButtonText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backButtonPlaceholder: {
    width: 80,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.primary,
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 32,
    gap: 6,
  },
  nextButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
