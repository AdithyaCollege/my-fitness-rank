import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Theme } from '@/theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  ChevronLeft,
  Target,
  Zap,
  Flame,
  Activity,
  Droplet,
  Calendar,
  Sparkles,
  Info,
} from 'lucide-react-native';
import { Button3D } from '@/components/ui/button-3d';

// Goal configuration options
const GOAL_OPTIONS = [
  { name: 'Lose Weight', icon: '🎯' },
  { name: 'Lose Fat + Build Muscle', icon: '🔥' },
  { name: 'Maintain Weight', icon: '⚖' },
  { name: 'Maintain Weight + Build Muscle', icon: '💪' },
  { name: 'Gain Weight + Build Muscle', icon: '📈' },
];

// Activity level details
const ACTIVITY_LEVELS = [
  {
    name: 'Sedentary',
    multiplier: 1.20,
    desc: 'Mostly sitting throughout the day.',
    examples: 'Office work, student, remote work, very little walking.',
    exercise: '0–1 workouts/week, less than ~6,000 steps/day',
  },
  {
    name: 'Lightly Active',
    multiplier: 1.375,
    desc: 'Some movement during the day.',
    examples: 'Walk regularly, retail work, light household work.',
    exercise: '2–3 workouts/week, ~6,000–8,000 steps/day',
  },
  {
    name: 'Moderately Active',
    multiplier: 1.55,
    desc: 'Regular exercise and active lifestyle.',
    examples: 'Gym, regular jogging, sports, standing work.',
    exercise: '3–5 workouts/week, ~8,000–12,000 steps/day',
  },
  {
    name: 'Very Active',
    multiplier: 1.725,
    desc: 'Hard exercise almost every day.',
    examples: 'Heavy lifting, intense sports, manual labor.',
    exercise: '6–7 workouts/week',
  },
  {
    name: 'Athlete',
    multiplier: 1.90,
    desc: 'Professional athlete or extreme training.',
    examples: 'Professional athlete, two intense training sessions/day.',
    exercise: 'Daily double-sessions',
  },
];

export default function HealthGoalsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // States
  const [currentWeight, setCurrentWeight] = useState('78.4');
  const [targetWeight, setTargetWeight] = useState('70.0');
  const [goal, setGoal] = useState('Lose Weight');
  const [activityLevel, setActivityLevel] = useState('Active'); // Sedentary, Lightly Active, Moderately Active, Very Active, Athlete
  const [weeklyGoal, setWeeklyGoal] = useState('0.5'); // Weight change per week (kg)
  const [waterGoal, setWaterGoal] = useState('3.2');
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);

  // Animations
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      if (data.weight_kg) {
        setCurrentWeight(data.weight_kg.toString());
      }
      if (data.metadata?.weight_unit) {
        setUnit(data.metadata.weight_unit);
      }

      // Load health goal configurations
      if (data.metadata?.health_goals) {
        const hg = data.metadata.health_goals;
        setTargetWeight(hg.targetWeight || '70.0');
        setGoal(hg.goal || 'Lose Weight');
        setActivityLevel(hg.activityLevel || 'Lightly Active');
        setWeeklyGoal(hg.weeklyGoal || '0.5');
        setWaterGoal(hg.waterGoal || '3.2');
      } else {
        // Fallback: Load from local AsyncStorage if metadata column is missing
        const localDataStr = await AsyncStorage.getItem(`health_goals_${user.id}`);
        if (localDataStr) {
          const hg = JSON.parse(localDataStr);
          setTargetWeight(hg.targetWeight || '70.0');
          setGoal(hg.goal || 'Lose Weight');
          setActivityLevel(hg.activityLevel || 'Lightly Active');
          setWeeklyGoal(hg.weeklyGoal || '0.5');
          setWaterGoal(hg.waterGoal || '3.2');
          if (hg.weight_unit) {
            setUnit(hg.weight_unit);
          }
        }
      }

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error('Error loading health goals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weightNum = parseFloat(currentWeight);
      if (isNaN(weightNum) || weightNum <= 0) {
        throw new Error('Please enter a valid current weight.');
      }

      const targetNum = parseFloat(targetWeight);
      if (isNaN(targetNum) || targetNum <= 0) {
        throw new Error('Please enter a valid target weight.');
      }

      // Validations
      if (goal.includes('Lose') || goal.includes('Gain')) {
        if (weightNum === targetNum) {
          throw new Error('Target weight cannot equal current weight for weight loss/gain goals.');
        }
      }

      // Check for realistic goals (maximum 40% target weight change)
      const diffPct = Math.abs(weightNum - targetNum) / weightNum;
      if (diffPct > 0.40) {
        Alert.alert(
          'Unrealistic Target Weight Warning',
          'Your target weight is more than 40% different from your current weight. Extremely rapid or massive shifts can be unhealthy. Are you sure you want to proceed?',
          [
            { text: 'Edit Target', style: 'cancel', onPress: () => setSaving(false) },
            { text: 'Proceed', onPress: () => saveToDatabase(user.id, weightNum, targetNum) }
          ]
        );
        return;
      }

      await saveToDatabase(user.id, weightNum, targetNum);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save health goals.');
      setSaving(false);
    }
  };

  const saveToDatabase = async (userId: string, weightNum: number, targetNum: number) => {
    try {
      const updatedMetadata = {
        ...(profile?.metadata || {}),
        health_goals: {
          targetWeight,
          goal,
          activityLevel,
          weeklyGoal,
          waterGoal,
        },
        weight_unit: unit,
      };

      // Try updating with metadata first
      const { error } = await supabase
        .from('profiles')
        .update({
          weight_kg: weightNum,
          metadata: updatedMetadata,
        })
        .eq('id', userId);

      if (error) {
        console.log('Main save failed, trying fallback details save...', error);
        // Fallback: update weight_kg & fitness_goal directly (which exist)
        const { error: fallbackError } = await supabase
          .from('profiles')
          .update({
            weight_kg: weightNum,
            fitness_goal: goal,
          })
          .eq('id', userId);
        
        if (fallbackError) throw fallbackError;

        // Save metadata fields locally in AsyncStorage
        const localData = {
          targetWeight,
          goal,
          activityLevel,
          weeklyGoal,
          waterGoal,
          weight_unit: unit,
        };
        await AsyncStorage.setItem(`health_goals_${userId}`, JSON.stringify(localData));
      }

      Alert.alert('Success', 'Health goals updated successfully!');
      setIsEditing(false);
      loadHealthData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Saving to database failed.');
    } finally {
      setSaving(false);
    }
  };

  // 1. Calculations: Mifflin-St Jeor Equation
  const weight = parseFloat(currentWeight) || 78.4;
  const target = parseFloat(targetWeight) || 70.0;
  
  // Height and Gender extraction with default fallbacks
  const height = profile?.height_cm ? parseFloat(profile.height_cm) : 175;
  const gender = profile?.gender || 'Male';

  const calculateAge = (dobString?: string) => {
    if (!dobString) return 25;
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };
  const age = calculateAge(profile?.date_of_birth);

  // Mifflin-St Jeor Equation
  // Male BMR = 10 * wt + 6.25 * ht - 5 * age + 5
  // Female BMR = 10 * wt + 6.25 * ht - 5 * age - 161
  let BMR = 0;
  const weightInKg = unit === 'lbs' ? weight / 2.20462 : weight;
  const targetInKg = unit === 'lbs' ? target / 2.20462 : target;

  if (gender.toLowerCase() === 'female') {
    BMR = 10 * weightInKg + 6.25 * height - 5 * age - 161;
  } else {
    BMR = 10 * weightInKg + 6.25 * height - 5 * age + 5;
  }

  // TDEE Multipliers
  const selectedActivity = ACTIVITY_LEVELS.find(a => a.name === activityLevel) || ACTIVITY_LEVELS[1];
  const TDEE = BMR * selectedActivity.multiplier;

  // Calorie targets based on goal
  let dailyCalories = Math.round(TDEE);
  if (goal === 'Lose Weight') {
    dailyCalories = Math.round(TDEE * 0.825); // 17.5% deficit (15-20%)
  } else if (goal === 'Lose Fat + Build Muscle') {
    dailyCalories = Math.round(TDEE * 0.875); // 12.5% deficit (10-15%)
  } else if (goal === 'Maintain Weight + Build Muscle') {
    dailyCalories = Math.round(TDEE * 1.025); // Maintenance or 5% surplus
  } else if (goal === 'Gain Weight + Build Muscle') {
    dailyCalories = Math.round(TDEE * 1.10); // 10% surplus (5-15%)
  }

  // Safe minimum threshold check
  const safeMinimum = gender.toLowerCase() === 'female' ? 1200 : 1500;
  if (dailyCalories < safeMinimum) {
    dailyCalories = safeMinimum;
  }

  // Protein targets (g/kg ranges)
  let proteinMultiplier = 1.4; // Maintain
  if (goal === 'Lose Weight') proteinMultiplier = 1.9; // 1.6-2.2
  if (goal === 'Lose Fat + Build Muscle') proteinMultiplier = 2.1; // 1.8-2.4
  if (goal === 'Maintain Weight + Build Muscle') proteinMultiplier = 1.9; // 1.6-2.2
  if (goal === 'Gain Weight + Build Muscle') proteinMultiplier = 1.9; // 1.6-2.2
  const proteinGoal = Math.round(weightInKg * proteinMultiplier);

  // Water recommendation: 35 mL * weight (kg) + multiplier
  let waterVolume = 0.035 * weightInKg;
  if (selectedActivity.multiplier >= 1.55) {
    waterVolume += 0.5; // active bonus
  }
  if (selectedActivity.multiplier >= 1.725) {
    waterVolume += 0.5; // athlete bonus
  }

  // Weekly Goal Weight rate & projection calculations
  const weightDiff = Math.abs(weight - target);
  const ratePerWeek = parseFloat(weeklyGoal) || 0.5;
  const weeksToGoal = ratePerWeek > 0 ? Math.ceil(weightDiff / ratePerWeek) : 0;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + (weeksToGoal * 7));

  // Warnings
  const isLoss = goal.includes('Lose');
  const isGain = goal.includes('Gain');
  const isAggressive = (isLoss && ratePerWeek > 0.5) || (isGain && ratePerWeek > 0.25);

  const getProjectionText = () => {
    if (weeksToGoal === 0) return 'Target weight achieved!';
    return `Estimated target completion: ${weeksToGoal} weeks (${targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(73, 0, 128, 0.45)', '#101415']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>HEALTH & GOALS</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => {
              if (isEditing) {
                handleSave();
              } else {
                setIsEditing(true);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.editBtnText}>{isEditing ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ddb7ff" />
          </View>
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              
              {/* Profile/Goal Summary Card */}
              <BlurView intensity={25} tint="dark" style={[styles.mainProgressCard, Theme.getGlow('#ddb7ff', 'low')]}>
                <View style={styles.progressRow}>
                  <View style={styles.progressInfo}>
                    <Text style={styles.progressLabel}>CURRENT WEIGHT</Text>
                    <Text style={styles.progressValue}>{weight} <Text style={styles.unitText}>{unit}</Text></Text>
                  </View>
                  <View style={styles.dividerVertical} />
                  <View style={styles.progressInfo}>
                    <Text style={styles.progressLabel}>TARGET WEIGHT</Text>
                    <Text style={styles.progressValue}>{target} <Text style={styles.unitText}>{unit}</Text></Text>
                  </View>
                </View>

                {/* Progress bar line */}
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${Math.max(10, Math.min(100, (target / weight) * 100))}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressSubtitle}>{getProjectionText()}</Text>
              </BlurView>

              {isEditing ? (
                /* Editing Layout View */
                <View style={styles.editorContainer}>
                  <BlurView intensity={20} tint="dark" style={styles.editCard}>
                    
                    {/* Weight Inputs */}
                    <View style={styles.inputRow}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.inputLabel}>Current Weight ({unit})</Text>
                        <TextInput
                          style={styles.inputField}
                          value={currentWeight}
                          onChangeText={setCurrentWeight}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.inputLabel}>Target Weight ({unit})</Text>
                        <TextInput
                          style={styles.inputField}
                          value={targetWeight}
                          onChangeText={setTargetWeight}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>

                    {/* Unit Switcher */}
                    <View style={styles.unitRow}>
                      <Text style={styles.inputLabel}>Weight Unit</Text>
                      <View style={styles.pillContainer}>
                        {['kg', 'lbs'].map(u => (
                          <TouchableOpacity
                            key={u}
                            style={[styles.pill, unit === u && styles.pillActive]}
                            onPress={() => setUnit(u as any)}
                          >
                            <Text style={[styles.pillText, unit === u && styles.pillTextActive]}>{u}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Goal Selection */}
                    <Text style={styles.inputLabel}>Primary Goal</Text>
                    <View style={styles.verticalPills}>
                      {GOAL_OPTIONS.map(g => (
                        <TouchableOpacity
                          key={g.name}
                          style={[styles.goalPill, goal === g.name && styles.goalPillActive]}
                          onPress={() => setGoal(g.name)}
                        >
                          <Text style={styles.goalEmoji}>{g.icon}</Text>
                          <Text style={[styles.goalPillText, goal === g.name && styles.goalPillTextActive]}>{g.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Weekly Goal weight rates */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Weekly Goal Rate (Weight change per week)</Text>
                      <View style={styles.pillContainer}>
                        {isLoss ? (
                          [0.25, 0.5, 0.75, 1.0].map(val => (
                            <TouchableOpacity
                              key={val}
                              style={[styles.pill, parseFloat(weeklyGoal) === val && styles.pillActive]}
                              onPress={() => setWeeklyGoal(val.toString())}
                            >
                              <Text style={[styles.pillText, parseFloat(weeklyGoal) === val && styles.pillTextActive]}>
                                {val} {unit}/wk {val === 0.5 && '⭐'}
                              </Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          [0.25, 0.5].map(val => (
                            <TouchableOpacity
                              key={val}
                              style={[styles.pill, parseFloat(weeklyGoal) === val && styles.pillActive]}
                              onPress={() => setWeeklyGoal(val.toString())}
                            >
                              <Text style={[styles.pillText, parseFloat(weeklyGoal) === val && styles.pillTextActive]}>
                                {val} {unit}/wk {val === 0.25 && '⭐'}
                              </Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>

                      {/* Aggressive target warning callout */}
                      {isAggressive && (
                        <View style={styles.warningCallout}>
                          <Info size={16} color="#FF9F0A" style={{ marginRight: 8 }} />
                          <Text style={styles.warningText}>
                            This goal is more aggressive than commonly recommended. Consider choosing a slower rate for better long-term sustainability.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Activity Level Selector */}
                    <Text style={styles.inputLabel}>Activity Level</Text>
                    <Text style={styles.metaLabelText}>Choose the option that best matches your average week over the last month.</Text>
                    <View style={styles.verticalPills}>
                      {ACTIVITY_LEVELS.map(a => (
                        <TouchableOpacity
                          key={a.name}
                          style={[styles.activityPill, activityLevel === a.name && styles.activityPillActive]}
                          onPress={() => setActivityLevel(a.name)}
                        >
                          <View style={styles.activityHeader}>
                            <Text style={[styles.activityName, activityLevel === a.name && styles.activityNameActive]}>{a.name}</Text>
                            <Text style={styles.activityMult}>{a.multiplier.toFixed(2)}x</Text>
                          </View>
                          <Text style={styles.activityDesc}>{a.desc}</Text>
                          <Text style={styles.activityExercise}>Exercise: {a.exercise}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Button3D
                      title="SAVE TARGETS"
                      onPress={handleSave}
                      loading={saving}
                      style={{ marginTop: 16 }}
                    />
                  </BlurView>
                </View>
              ) : (
                /* Static Grid Display Cards */
                <View style={styles.gridContainer}>
                  
                  {/* Calorie recommendation */}
                  <BlurView intensity={15} tint="dark" style={[styles.gridCard, { width: '100%' }]}>
                    <View style={styles.cardHeader}>
                      <Flame size={18} color="#FF453A" />
                      <Text style={styles.cardHeaderTitle}>DAILY CALORIE BUDGET</Text>
                    </View>
                    <Text style={[styles.cardMainValue, { fontSize: 28 }]}>{dailyCalories} <Text style={styles.cardUnit}>kcal/day</Text></Text>
                    <Text style={styles.cardDesc}>Calculated using the Mifflin–St Jeor Equation</Text>
                  </BlurView>

                  {/* Goal Card */}
                  <BlurView intensity={15} tint="dark" style={styles.gridCard}>
                    <View style={styles.cardHeader}>
                      <Target size={18} color="#ddb7ff" />
                      <Text style={styles.cardHeaderTitle}>FITNESS GOAL</Text>
                    </View>
                    <Text style={styles.cardMainValue}>{goal}</Text>
                    <Text style={styles.cardDesc}>Primary objective</Text>
                  </BlurView>

                  {/* Activity Level Card */}
                  <BlurView intensity={15} tint="dark" style={styles.gridCard}>
                    <View style={styles.cardHeader}>
                      <Activity size={18} color="#FF9F0A" />
                      <Text style={styles.cardHeaderTitle}>ACTIVITY PROFILE</Text>
                    </View>
                    <Text style={styles.cardMainValue}>{activityLevel}</Text>
                    <Text style={styles.cardDesc}>{selectedActivity.multiplier.toFixed(2)}x BMR multiplier</Text>
                  </BlurView>

                  {/* Protein target */}
                  <BlurView intensity={15} tint="dark" style={styles.gridCard}>
                    <View style={styles.cardHeader}>
                      <Zap size={18} color="#BF5AF2" />
                      <Text style={styles.cardHeaderTitle}>PROTEIN TARGET</Text>
                    </View>
                    <Text style={styles.cardMainValue}>{proteinGoal} <Text style={styles.cardUnit}>g/day</Text></Text>
                    <Text style={styles.cardDesc}>Macronutrient muscle quota</Text>
                  </BlurView>

                  {/* Hydration target */}
                  <BlurView intensity={15} tint="dark" style={styles.gridCard}>
                    <View style={styles.cardHeader}>
                      <Droplet size={18} color="#64D2FF" />
                      <Text style={styles.cardHeaderTitle}>DAILY WATER GOAL</Text>
                    </View>
                    <Text style={styles.cardMainValue}>{waterGoal} <Text style={styles.cardUnit}>L/day</Text></Text>
                    <Text style={styles.cardDesc}>Daily hydration quota</Text>
                  </BlurView>

                </View>
              )}

              {/* Extra Health recommendations card */}
              {!isEditing && (
                <BlurView intensity={15} tint="dark" style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <Sparkles size={18} color="#ddb7ff" />
                    <Text style={styles.insightTitle}>HEALTH METRIC INSIGHT</Text>
                  </View>
                  <Text style={styles.insightText}>
                    Your BMR is estimated at {Math.round(BMR)} calories based on personal parameters. Your TDEE (maintenance calories) is {Math.round(TDEE)} kcal. The current calorie budget is set to {dailyCalories} kcal/day to align with your {goal} goals.
                  </Text>
                </BlurView>
              )}

            </ScrollView>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101415',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1,
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(221, 183, 255, 0.15)',
  },
  editBtnText: {
    color: '#ddb7ff',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  mainProgressCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progressInfo: {
    flex: 1,
    alignItems: 'center',
  },
  progressLabel: {
    color: '#cfc2d6',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
    marginBottom: 6,
    opacity: 0.7,
  },
  progressValue: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Inter_900Black',
  },
  unitText: {
    fontSize: 14,
    color: '#ddb7ff',
    fontFamily: 'Inter_600SemiBold',
  },
  dividerVertical: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(207, 194, 214, 0.15)',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    width: '100%',
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ddb7ff',
    borderRadius: 3,
  },
  progressSubtitle: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    opacity: 0.8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    width: '48%',
    backgroundColor: 'rgba(45, 49, 51, 0.25)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.12)',
    padding: 16,
    minHeight: 120,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  cardHeaderTitle: {
    color: '#cfc2d6',
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.8,
    opacity: 0.6,
  },
  cardMainValue: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Inter_800ExtraBold',
    marginBottom: 4,
  },
  cardUnit: {
    fontSize: 12,
    color: '#ddb7ff',
    fontFamily: 'Inter_600SemiBold',
  },
  cardDesc: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    opacity: 0.8,
  },
  insightCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.1)',
    padding: 16,
    marginTop: 20,
    overflow: 'hidden',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  insightTitle: {
    color: '#ddb7ff',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  insightText: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    opacity: 0.9,
  },
  editorContainer: {
    width: '100%',
  },
  editCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    padding: 20,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_800ExtraBold',
    marginBottom: 6,
    marginTop: 8,
  },
  metaLabelText: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    opacity: 0.6,
    marginBottom: 10,
  },
  inputField: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    color: '#FFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  unitRow: {
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 6,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.1)',
  },
  pillActive: {
    backgroundColor: '#ddb7ff',
    borderColor: '#ddb7ff',
  },
  pillText: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  pillTextActive: {
    color: '#400071',
    fontFamily: 'Inter_800ExtraBold',
  },
  verticalPills: {
    gap: 8,
    marginVertical: 8,
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.1)',
  },
  goalPillActive: {
    backgroundColor: 'rgba(221, 183, 255, 0.15)',
    borderColor: '#ddb7ff',
  },
  goalEmoji: {
    fontSize: 18,
    marginRight: 10,
  },
  goalPillText: {
    color: '#cfc2d6',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  goalPillTextActive: {
    color: '#FFF',
    fontFamily: 'Inter_800ExtraBold',
  },
  activityPill: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.08)',
  },
  activityPillActive: {
    backgroundColor: 'rgba(255, 159, 10, 0.12)',
    borderColor: '#FF9F0A',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  activityName: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  activityNameActive: {
    color: '#FF9F0A',
  },
  activityMult: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
    opacity: 0.8,
  },
  activityDesc: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 15,
    opacity: 0.7,
    marginBottom: 2,
  },
  activityExercise: {
    color: '#ddb7ff',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    opacity: 0.8,
  },
  warningCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 10, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.25)',
  },
  warningText: {
    color: '#FF9F0A',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
    lineHeight: 15,
  },
});
