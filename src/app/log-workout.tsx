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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Theme, getRankDetails } from '@/theme/theme';
import { useRouter } from 'expo-router';
import { X, Plus, Trash2, Search, Flame, Award, Clock } from 'lucide-react-native';
import { Image } from 'expo-image';
import exercisesData from '@/lib/exercises.json';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);

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

  const loadRecentWorkouts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data, error } = await supabase
          .from('workouts')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', today.toISOString())
          .order('created_at', { ascending: false });
        if (!error && data) {
          setRecentWorkouts(data);
        }
      }
    } catch (err) {
      console.error('Error fetching recent workouts:', err);
    }
  };

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('current_streak, last_workout_date')
          .eq('id', user.id)
          .single();
        setProfile(data);
        
        // Load recent workouts logged today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: wrks } = await supabase
          .from('workouts')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', today.toISOString())
          .order('created_at', { ascending: false });
        if (wrks) {
          setRecentWorkouts(wrks);
        }
      }
      setLoading(false);
    }
    init();
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

  const resetForm = () => {
    setSelectedExercise(null);
    setHours('');
    setMinutes('');
    setSeconds('');
    setSets([{ id: 1, weight: '', reps: '' }]);
    setIntensity('Moderate');
    setNotes('');
  };

  // Live XP Preview logic
  const calculateLiveXp = () => {
    const base = 10;
    const selectedIntensity = INTENSITIES.find(i => i.name === intensity);
    const mult = selectedIntensity?.mult ?? 1.0;
    
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
        durationMin = sets.length * 3;
      }
    }
    
    durationMin = Math.max(1, Math.round(durationMin));
    
    let xp = 0;
    if (selectedExercise && !isCardio) {
      let strengthXp = 0;
      sets.forEach(s => {
        const weight = parseFloat(s.weight) || 0;
        const reps = parseInt(s.reps) || 0;
        strengthXp += (10.0 + (reps * 0.5) + (weight * 0.02)) * mult;
      });
      xp = Math.round(strengthXp * streakMult);
    } else {
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

      Alert.alert('Workout Registered!', 'You gained +' + xpPreview.xp + ' XP! Log another one or close to go home.');
      await loadRecentWorkouts();
      resetForm();
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
        <ActivityIndicator size="large" color="#ddb7ff" />
      </View>
    );
  }

  const isCardio = selectedExercise && mapCategoryToType(selectedExercise.category) === 'Cardio';

  return (
    <View style={{ flex: 1, backgroundColor: '#101415' }}>
      <LinearGradient
        colors={['rgba(73, 0, 128, 0.45)', '#101415']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

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
            <View style={styles.searchSection}>
              <Text style={styles.label}>FIND YOUR EXERCISE</Text>
              <View style={styles.searchBar}>
                <Search size={18} color="#cfc2d6" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="e.g. Bench Press, Squat, Running..."
                  placeholderTextColor="rgba(207, 194, 214, 0.5)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={18} color="#cfc2d6" />
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

            {/* 2. Recent Workouts Logged Today Section */}
            <View style={styles.recentSection}>
              <Text style={styles.label}>RECENT WORKOUTS LOGGED TODAY</Text>
              {recentWorkouts.length > 0 ? (
                <View style={styles.recentList}>
                  {recentWorkouts.map((workout) => (
                    <View key={workout.id} style={styles.recentCard}>
                      <View style={styles.recentHeader}>
                        <Text style={styles.recentName}>{workout.exercise_name}</Text>
                        <Text style={styles.recentType}>{workout.type.toUpperCase()}</Text>
                      </View>
                      <View style={styles.recentMeta}>
                        <Text style={styles.recentMetaText}>⏱️ {workout.duration_min} mins</Text>
                        {workout.sets_reps && workout.sets_reps.length > 0 && (
                          <Text style={styles.recentMetaText}>• {workout.sets_reps.length} sets</Text>
                        )}
                        {workout.intensity && (
                          <Text style={styles.recentMetaText}>• {workout.intensity}</Text>
                        )}
                      </View>
                      {workout.notes && (
                        <Text style={styles.recentNotes} numberOfLines={2}>
                          "{workout.notes}"
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.recentEmptyCard}>
                  <Text style={styles.recentEmptyText}>No workouts logged yet today.</Text>
                  <Text style={styles.recentEmptySub}>Your activity log will appear here in real-time as you complete them!</Text>
                </View>
              )}
            </View>

          </ScrollView>

          {/* 3. Smooth Overlay Modal for Selected Exercise Logging */}
          <Modal
            visible={selectedExercise !== null}
            animationType="slide"
            transparent={true}
            onRequestClose={resetForm}
          >
            <View style={styles.modalOverlay}>
              <TouchableOpacity 
                style={styles.backdrop} 
                activeOpacity={1} 
                onPress={resetForm} 
              />
              
              <View style={styles.modalContent}>
                <View style={styles.modalGrabber} />
                
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedType}>
                      {selectedExercise ? mapCategoryToType(selectedExercise.category).toUpperCase() : ''}
                    </Text>
                    <Text style={styles.modalTitle} numberOfLines={2}>
                      {selectedExercise ? selectedExercise.name : ''}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.modalCloseBtn} onPress={resetForm}>
                    <X size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {selectedExercise && (
                  <ScrollView 
                    contentContainerStyle={styles.modalFormScroll} 
                    keyboardShouldPersistTaps="handled"
                  >
                    {/* Active muscle indicators & dynamic images */}
                    {selectedExercise.primaryMuscles && selectedExercise.primaryMuscles.length > 0 && (
                      <Text style={styles.selectedMuscle}>
                        Activated Muscle: <Text style={{ color: '#ddb7ff', fontWeight: '700' }}>
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
                          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#16191a' }]}>
                            <ActivityIndicator color="#ddb7ff" />
                          </View>
                        )}
                      </View>
                    ) : null}

                    {/* XP Preview Card */}
                    <View style={[styles.xpPreviewCard, Theme.getGlow('#ddb7ff', 'low')]}>
                      <Text style={styles.xpPreviewTitle}>ESTIMATED REWARD</Text>
                      <View style={styles.xpRow}>
                        <Text style={styles.xpNumber}>{xpPreview.xp}</Text>
                        <Text style={styles.xpSub}>XP</Text>
                      </View>
                      <Text style={styles.xpStreakBonus}>
                        {xpPreview.durationMin} mins total duration • includes +{xpPreview.streakBonus}% Streak Bonus
                      </Text>
                    </View>

                    {/* Duration Input (Cardio Only) */}
                    {isCardio ? (
                      <View style={styles.card}>
                        <Text style={styles.label}>DURATION TIME</Text>
                        <View style={styles.timeInputsRow}>
                          <View style={styles.timeField}>
                            <Text style={styles.timeLabel}>Hours</Text>
                            <TextInput
                              style={styles.timeInput}
                              placeholder="0"
                              placeholderTextColor="rgba(207, 194, 214, 0.4)"
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
                              placeholderTextColor="rgba(207, 194, 214, 0.4)"
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
                              placeholderTextColor="rgba(207, 194, 214, 0.4)"
                              value={seconds}
                              onChangeText={(v) => setSeconds(v.replace(/[^0-9]/g, ''))}
                              keyboardType="numeric"
                              maxLength={2}
                            />
                          </View>
                        </View>
                      </View>
                    ) : (
                      /* Sets & Reps Input (Strength Only) */
                      <View style={styles.card}>
                        <View style={styles.setsHeader}>
                          <Text style={styles.label}>SETS & REPS</Text>
                          <TouchableOpacity style={styles.addSetBtn} onPress={addSet}>
                            <Plus size={16} color="#ddb7ff" />
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
                                placeholderTextColor="rgba(207, 194, 214, 0.5)"
                                keyboardType="numeric"
                                value={set.weight}
                                onChangeText={(val) => updateSet(set.id, 'weight', val)}
                              />
                              
                              <TextInput
                                style={styles.setInput}
                                placeholder="Reps"
                                placeholderTextColor="rgba(207, 194, 214, 0.5)"
                                keyboardType="numeric"
                                value={set.reps}
                                onChangeText={(val) => updateSet(set.id, 'reps', val)}
                              />

                              <TouchableOpacity
                                onPress={() => removeSet(set.id)}
                                disabled={sets.length === 1}
                                style={{ opacity: sets.length === 1 ? 0.3 : 1 }}
                              >
                                <Trash2 size={16} color="#FF2A5F" />
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
                              intensity === item.name && { borderColor: '#ddb7ff' }
                            ]}
                            onPress={() => setIntensity(item.name)}
                          >
                            <View style={styles.intensityCellHeader}>
                              <Text style={[styles.intensityName, intensity === item.name && { color: '#ddb7ff' }]}>
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
                        placeholderTextColor="#8A82A0"
                        multiline
                        numberOfLines={3}
                        value={notes}
                        onChangeText={setNotes}
                      />
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity
                      style={[styles.saveButton, Theme.getGlow('#ddb7ff', 'medium'), saving && { opacity: 0.6 }]}
                      onPress={handleSaveWorkout}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#400071" />
                      ) : (
                        <Text style={styles.saveButtonText}>SAVE & SUBMIT TO SQUAD</Text>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 24,
  },
  searchSection: {
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
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  resultsList: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    overflow: 'hidden',
  },
  resultItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(207, 194, 214, 0.1)',
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
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  resultCategory: {
    color: '#ddb7ff',
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
    backgroundColor: 'rgba(221, 183, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  resultMuscle: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  emptyResultsText: {
    color: '#cfc2d6',
    textAlign: 'center',
    padding: 24,
    fontFamily: 'Inter_600SemiBold',
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
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  quickChipText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  quickChipSub: {
    color: '#ddb7ff',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
  },
  recentSection: {
    gap: 12,
    marginBottom: 20,
  },
  recentList: {
    gap: 10,
  },
  recentCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentName: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  recentType: {
    color: '#ddb7ff',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  recentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentMetaText: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  recentNotes: {
    color: '#cfc2d6',
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  recentEmptyCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.08)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  recentEmptyText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  recentEmptySub: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 16,
  },
  
  // Modal Sheet styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#16191a',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    maxHeight: '88%',
    overflow: 'hidden',
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'center',
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(207, 194, 214, 0.1)',
  },
  selectedType: {
    color: '#ddb7ff',
    fontSize: 9,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1,
    marginBottom: 2,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  modalFormScroll: {
    padding: 24,
    paddingBottom: 50,
    gap: 20,
  },
  selectedMuscle: {
    color: '#cfc2d6',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  imageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(45, 49, 51, 0.2)',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.1)',
  },
  exerciseImage: {
    width: '90%',
    height: '90%',
  },
  xpPreviewCard: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderColor: 'rgba(221, 183, 255, 0.3)',
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  xpPreviewTitle: {
    color: '#ddb7ff',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
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
    fontFamily: 'Inter_900Black',
    lineHeight: 48,
  },
  xpSub: {
    color: '#ddb7ff',
    fontSize: 18,
    fontFamily: 'Inter_800ExtraBold',
    paddingBottom: 4,
  },
  xpStreakBonus: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    padding: 20,
    gap: 12,
  },
  label: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
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
    color: '#cfc2d6',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
  },
  timeInput: {
    backgroundColor: 'rgba(45, 49, 51, 0.5)',
    borderColor: 'rgba(207, 194, 214, 0.15)',
    borderWidth: 1.5,
    borderRadius: 12,
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'Inter_800ExtraBold',
    width: 60,
    height: 52,
    textAlign: 'center',
  },
  timeDivider: {
    color: 'rgba(207, 194, 214, 0.15)',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
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
    color: '#ddb7ff',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
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
    fontFamily: 'Inter_800ExtraBold',
    width: 50,
  },
  setInput: {
    flex: 1,
    backgroundColor: 'rgba(45, 49, 51, 0.5)',
    borderColor: 'rgba(207, 194, 214, 0.15)',
    borderWidth: 1,
    borderRadius: 12,
    color: '#FFF',
    height: 40,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  intensityList: {
    gap: 8,
  },
  intensityCell: {
    backgroundColor: 'rgba(45, 49, 51, 0.2)',
    borderColor: 'rgba(207, 194, 214, 0.12)',
    borderWidth: 1.5,
    borderRadius: 16,
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
    fontFamily: 'Inter_800ExtraBold',
  },
  intensityMult: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  intensityDesc: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  notesInput: {
    backgroundColor: 'rgba(45, 49, 51, 0.5)',
    borderColor: 'rgba(207, 194, 214, 0.15)',
    borderWidth: 1,
    borderRadius: 12,
    color: '#FFF',
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#ddb7ff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#400071',
    fontSize: 15,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1,
  },
});
