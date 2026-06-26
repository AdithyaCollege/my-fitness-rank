import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Theme, getRankDetails } from '@/theme/theme';
import { useRouter } from 'expo-router';
import { X, Plus, Trash2, Search, Flame, Award, Clock } from 'lucide-react-native';
import { Image } from 'expo-image';
import exercisesData from '@/lib/exercises.json';

const INTENSITIES = [
  { name: 'Light', mult: 1.0, desc: 'Steady pace / Low heart rate' },
  { name: 'Moderate', mult: 1.5, desc: 'Active sweat / Elevated breathing' },
  { name: 'Intense', mult: 2.0, desc: 'Maximum effort / High intensity' },
];

const POPULAR_EXERCISES = [
  { name: 'Bench Press Medium Grip', category: 'strength', primaryMuscles: ['chest'], images: ['Bench_Press_Medium_Grip/0.jpg'] },
  { name: 'Barbell Full Squat', category: 'strength', primaryMuscles: ['quads'], images: ['Barbell_Full_Squat/0.jpg'] },
  { name: 'Running', category: 'cardio', primaryMuscles: ['cardiorespiratory'], images: [] },
  { name: 'Barbell Curl', category: 'strength', primaryMuscles: ['biceps'], images: ['Barbell_Curl/0.jpg'] },
  { name: 'Plank', category: 'strength', primaryMuscles: ['abs'], images: ['Plank/0.jpg'] },
  { name: 'Cycling', category: 'cardio', primaryMuscles: ['cardiorespiratory'], images: [] },
];

const mapCategoryToType = (dbCategory: string): string => {
  const cat = dbCategory.toLowerCase();
  if (cat === 'cardio') return 'Cardio';
  if (cat === 'plyometrics') return 'HIIT';
  if (cat === 'stretching') return 'Yoga';
  if (['strength', 'powerlifting', 'olympic weightlifting', 'strongman'].includes(cat)) return 'Strength';
  return 'Other';
};

export default function LogWorkoutScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<any | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Form States
  const [intensity, setIntensity] = useState('Moderate');
  const [notes, setNotes] = useState('');
  
  // Cardio Duration States (Hours, Minutes, Seconds)
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');

  // Sets and Reps (for Strength)
  const [sets, setSets] = useState<{ id: number; weight: string; reps: string }[]>([
    { id: 1, weight: '', reps: '' }
  ]);

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('current_streak, last_workout_date')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    }
    getProfile();
  }, []);

  // Filter exercises based on query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = (exercisesData as any[])
      .filter((ex: any) => 
        ex.name.toLowerCase().includes(query) || 
        (ex.primaryMuscles && ex.primaryMuscles.some((m: string) => m.toLowerCase().includes(query))) ||
        ex.category.toLowerCase().includes(query)
      )
      .slice(0, 15);
    setSearchResults(filtered);
  }, [searchQuery]);

  const addSet = () => {
    const nextId = sets.length > 0 ? Math.max(...sets.map(s => s.id)) + 1 : 1;
    setSets([...sets, { id: nextId, weight: '', reps: '' }]);
  };

  const removeSet = (id: number) => {
    setSets(sets.filter(s => s.id !== id));
  };

  const updateSet = (id: number, field: 'weight' | 'reps', value: string) => {
    setSets(sets.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Live XP Preview logic
  const calculateLiveXp = () => {
    const base = 10;
    const selectedIntensity = INTENSITIES.find(i => i.name === intensity);
    const mult = selectedIntensity?.mult ?? 1.0;
    
    // Check streak
    let streak = profile?.current_streak ?? 0;
    const lastWorkout = profile?.last_workout_date;
    
    if (lastWorkout) {
      const lastDate = new Date(lastWorkout);
      const today = new Date();
      lastDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      const diffTime = Math.abs(today.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 1 && today.getDate() !== lastDate.getDate()) {
        streak = 0;
      }
    }
    
    const finalStreak = streak === 0 ? 1 : streak + 1;
    const streakMult = 1.0 + (Math.min(finalStreak, 10) * 0.05);
    
    let durationMin = 30; // fallback default
    let isCardio = false;
    if (selectedExercise) {
      isCardio = mapCategoryToType(selectedExercise.category) === 'Cardio';
      if (isCardio) {
        const h = parseFloat(hours) || 0;
        const m = parseFloat(minutes) || 0;
        const s = parseFloat(seconds) || 0;
        durationMin = (h * 60) + m + (s / 60);
      } else {
        // strength / other: 3 minutes per set
        durationMin = sets.length * 3;
      }
    }
    
    durationMin = Math.max(1, Math.round(durationMin));
    
    let xp = 0;
    if (selectedExercise && !isCardio) {
      // Calculate XP based on sets, weights, reps
      let strengthXp = 0;
      sets.forEach(s => {
        const weight = parseFloat(s.weight) || 0;
        const reps = parseInt(s.reps) || 0;
        strengthXp += (10.0 + (reps * 0.5) + (weight * 0.02)) * mult;
      });
      xp = Math.round(strengthXp * streakMult);
    } else {
      // Cardio / fallback duration based XP
      xp = Math.round((base + (durationMin * mult)) * streakMult);
    }
    
    return { xp, streakBonus: Math.round((streakMult - 1.0) * 100), finalStreak, durationMin };
  };

  const handleSaveWorkout = async () => {
    if (!selectedExercise) {
      Alert.alert('No Exercise Selected', 'Please search and select an exercise first.');
      return;
    }

    const xpPreview = calculateLiveXp();
    if (xpPreview.durationMin <= 0) {
      Alert.alert('Invalid Duration', 'Workout duration must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found.');

      const workoutType = mapCategoryToType(selectedExercise.category);

      // Format sets/reps as JSON payload for strength exercises
      let setsRepsData = null;
      if (workoutType !== 'Cardio' && sets.length > 0) {
        setsRepsData = sets
          .filter(s => s.reps.trim() !== '')
          .map(s => ({
            set_num: s.id,
            weight_lbs: parseFloat(s.weight) || 0,
            reps: parseInt(s.reps) || 0
          }));
      }

      const { error } = await supabase
        .from('workouts')
        .insert([{
          user_id: user.id,
          type: workoutType,
          duration_min: xpPreview.durationMin,
          intensity,
          sets_reps: setsRepsData,
          notes: notes.trim() || null,
          exercise_name: selectedExercise.name,
          primary_muscle: selectedExercise.primaryMuscles?.[0] || null
        }]);

      if (error) throw error;

      router.back();
    } catch (err: any) {
      console.error('Error logging workout:', err);
      Alert.alert('Save Failed', err.message || 'Could not log workout. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const xpPreview = calculateLiveXp();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  const isCardio = selectedExercise && mapCategoryToType(selectedExercise.category) === 'Cardio';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header bar */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>LOG WORKOUT</Text>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <X size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          
          {/* 1. Search Selection Area */}
          {!selectedExercise ? (
            <View style={styles.searchSection}>
              <Text style={styles.label}>FIND YOUR EXERCISE</Text>
              <View style={styles.searchBar}>
                <Search size={18} color={Theme.colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="e.g. Bench Press, Squat, Running..."
                  placeholderTextColor={Theme.colors.textMuted + '80'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={18} color={Theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Results List */}
              {searchQuery.trim().length > 0 ? (
                <View style={styles.resultsList}>
                  {searchResults.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.resultItem}
                      onPress={() => {
                        setSelectedExercise(item);
                        setSearchQuery('');
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.resultHeader}>
                        <Text style={styles.resultName}>{item.name}</Text>
                        <Text style={styles.resultCategory}>
                          {mapCategoryToType(item.category).toUpperCase()}
                        </Text>
                      </View>
                      {item.primaryMuscles && item.primaryMuscles.length > 0 && (
                        <Text style={styles.resultMuscle}>
                          Target: {item.primaryMuscles.join(', ')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                  {searchResults.length === 0 && (
                    <Text style={styles.emptyResultsText}>No matching exercises found.</Text>
                  )}
                </View>
              ) : (
                /* Quick Start Grid */
                <View style={styles.quickStartContainer}>
                  <Text style={[styles.label, { marginBottom: 8 }]}>QUICK START / POPULAR</Text>
                  <View style={styles.quickGrid}>
                    {POPULAR_EXERCISES.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.quickChip}
                        onPress={() => setSelectedExercise(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickChipText}>{item.name}</Text>
                        <Text style={styles.quickChipSub}>
                          {mapCategoryToType(item.category)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* Selected Exercise & Setup Form */
            <View style={styles.formSection}>
              
              {/* Change Selected Exercise Card */}
              <View style={styles.selectedExerciseCard}>
                <View style={styles.selectedHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedType}>
                      {mapCategoryToType(selectedExercise.category).toUpperCase()}
                    </Text>
                    <Text style={styles.selectedName}>{selectedExercise.name}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.changeExerciseBtn}
                    onPress={() => {
                      setSelectedExercise(null);
                      setHours('');
                      setMinutes('');
                      setSeconds('');
                      setSets([{ id: 1, weight: '', reps: '' }]);
                    }}
                  >
                    <Text style={styles.changeExerciseText}>CHANGE</Text>
                  </TouchableOpacity>
                </View>

                {selectedExercise.primaryMuscles && selectedExercise.primaryMuscles.length > 0 && (
                  <Text style={styles.selectedMuscle}>
                    Activated Muscle: <Text style={{ color: Theme.colors.primary, fontWeight: '700' }}>
                      {selectedExercise.primaryMuscles.join(', ')}
                    </Text>
                  </Text>
                )}

                {selectedExercise.images && selectedExercise.images.length > 0 ? (
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${selectedExercise.images[0]}` }}
                      style={styles.exerciseImage}
                      contentFit="contain"
                      onLoadStart={() => setImageLoading(true)}
                      onLoadEnd={() => setImageLoading(false)}
                    />
                    {imageLoading && (
                      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#070C15' }]}>
                        <ActivityIndicator color={Theme.colors.primary} />
                      </View>
                    )}
                  </View>
                ) : null}
              </View>

              {/* XP Preview Card */}
              <View style={[styles.xpPreviewCard, Theme.getGlow(Theme.colors.primary, 'low')]}>
                <Text style={styles.xpPreviewTitle}>ESTIMATED REWARD</Text>
                <View style={styles.xpRow}>
                  <Text style={styles.xpNumber}>{xpPreview.xp}</Text>
                  <Text style={styles.xpSub}>XP</Text>
                </View>
                <Text style={styles.xpStreakBonus}>
                  {xpPreview.durationMin} mins total duration • includes +{xpPreview.streakBonus}% Streak Bonus
                </Text>
              </View>

              {/* ── Duration Fields (Cardio Only) ── */}
              {isCardio ? (
                <View style={styles.card}>
                  <Text style={styles.label}>DURATION TIME</Text>
                  <View style={styles.timeInputsRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Hours</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="0"
                        placeholderTextColor={Theme.colors.textMuted + '60'}
                        value={hours}
                        onChangeText={(v) => setHours(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
                    <Text style={styles.timeDivider}>:</Text>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Mins</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="30"
                        placeholderTextColor={Theme.colors.textMuted + '60'}
                        value={minutes}
                        onChangeText={(v) => setMinutes(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
                    <Text style={styles.timeDivider}>:</Text>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>Secs</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="00"
                        placeholderTextColor={Theme.colors.textMuted + '60'}
                        value={seconds}
                        onChangeText={(v) => setSeconds(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                /* ── Sets & Reps Fields (Strength Only) ── */
                <View style={styles.card}>
                  <View style={styles.setsHeader}>
                    <Text style={styles.label}>SETS & REPS</Text>
                    <TouchableOpacity style={styles.addSetBtn} onPress={addSet}>
                      <Plus size={16} color={Theme.colors.primary} />
                      <Text style={styles.addSetBtnText}>ADD SET</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.setsList}>
                    {sets.map((set, index) => (
                      <View key={set.id} style={styles.setRow}>
                        <Text style={styles.setNumber}>SET {index + 1}</Text>
                        
                        <TextInput
                          style={styles.setInput}
                          placeholder="Weight (lbs/kg)"
                          placeholderTextColor={Theme.colors.textMuted + '80'}
                          keyboardType="numeric"
                          value={set.weight}
                          onChangeText={(val) => updateSet(set.id, 'weight', val)}
                        />
                        
                        <TextInput
                          style={styles.setInput}
                          placeholder="Reps"
                          placeholderTextColor={Theme.colors.textMuted + '80'}
                          keyboardType="numeric"
                          value={set.reps}
                          onChangeText={(val) => updateSet(set.id, 'reps', val)}
                        />

                        <TouchableOpacity
                          onPress={() => removeSet(set.id)}
                          disabled={sets.length === 1}
                          style={{ opacity: sets.length === 1 ? 0.3 : 1 }}
                        >
                          <Trash2 size={16} color={Theme.colors.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Intensity */}
              <View style={styles.card}>
                <Text style={styles.label}>INTENSITY MULTIPLIER</Text>
                <View style={styles.intensityList}>
                  {INTENSITIES.map((item) => (
                    <TouchableOpacity
                      key={item.name}
                      style={[
                        styles.intensityCell,
                        intensity === item.name && { borderColor: Theme.colors.secondary }
                      ]}
                      onPress={() => setIntensity(item.name)}
                    >
                      <View style={styles.intensityCellHeader}>
                        <Text style={[styles.intensityName, intensity === item.name && { color: Theme.colors.secondary }]}>
                          {item.name}
                        </Text>
                        <Text style={styles.intensityMult}>{item.mult}x XP</Text>
                      </View>
                      <Text style={styles.intensityDesc}>{item.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.card}>
                <Text style={styles.label}>NOTES & LOG DETAILS</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="How did you feel? Focus points..."
                  placeholderTextColor={Theme.colors.textMuted}
                  multiline
                  numberOfLines={3}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, Theme.getGlow(Theme.colors.primary, 'medium'), saving && { opacity: 0.6 }]}
                onPress={handleSaveWorkout}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveButtonText}>SAVE & SUBMIT TO SQUAD</Text>
                )}
              </TouchableOpacity>

            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 20,
  },
  searchSection: {
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
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
    fontSize: 15,
    fontWeight: '600',
  },
  resultsList: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: 'hidden',
  },
  resultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    gap: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  resultName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  resultCategory: {
    color: Theme.colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    backgroundColor: Theme.colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  resultMuscle: {
    color: Theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  emptyResultsText: {
    color: Theme.colors.textMuted,
    textAlign: 'center',
    padding: 24,
    fontWeight: '600',
  },
  quickStartContainer: {
    marginTop: 10,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickChip: {
    width: '48%',
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  quickChipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  quickChipSub: {
    color: Theme.colors.secondary,
    fontSize: 10,
    fontWeight: '800',
  },
  formSection: {
    gap: 20,
  },
  selectedExerciseCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Theme.colors.secondary,
    padding: 16,
    gap: 12,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  selectedType: {
    color: Theme.colors.secondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  selectedName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  selectedMuscle: {
    color: Theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  changeExerciseBtn: {
    backgroundColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changeExerciseText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#070C15',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  exerciseImage: {
    width: '90%',
    height: '90%',
  },
  xpPreviewCard: {
    backgroundColor: '#0F251E',
    borderColor: Theme.colors.primary,
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  xpPreviewTitle: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  xpNumber: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 48,
  },
  xpSub: {
    color: Theme.colors.primary,
    fontSize: 18,
    fontWeight: '800',
    paddingBottom: 4,
  },
  xpStreakBonus: {
    color: '#A2E8C2',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 20,
    gap: 12,
  },
  label: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  timeInputsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  timeField: {
    alignItems: 'center',
    gap: 4,
  },
  timeLabel: {
    color: Theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  timeInput: {
    backgroundColor: Theme.colors.background,
    borderColor: Theme.colors.border,
    borderWidth: 1.5,
    borderRadius: 8,
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    width: 60,
    height: 52,
    textAlign: 'center',
  },
  timeDivider: {
    color: Theme.colors.border,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 18,
  },
  setsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addSetBtnText: {
    color: Theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  setsList: {
    gap: 10,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setNumber: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    width: 50,
  },
  setInput: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: '#FFF',
    height: 40,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  intensityList: {
    gap: 8,
  },
  intensityCell: {
    backgroundColor: Theme.colors.background,
    borderColor: Theme.colors.border,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  intensityCellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  intensityName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  intensityMult: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  intensityDesc: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  notesInput: {
    backgroundColor: Theme.colors.background,
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: '#FFF',
    padding: 12,
    fontSize: 14,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
