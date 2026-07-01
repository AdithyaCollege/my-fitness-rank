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
  Dimensions,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Theme } from '@/theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import {
  ChevronLeft,
  Scale,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Edit3,
  Award,
  TrendingDown,
  Info,
} from 'lucide-react-native';
import { Button3D } from '@/components/ui/button-3d';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 40;
const CHART_HEIGHT = 160;

interface WeightLog {
  id: string;
  weight: number;
  unit: 'kg' | 'lbs';
  logged_date: string;
  logged_time: 'Morning' | 'Afternoon' | 'Evening';
  notes?: string;
}

export default function WeightHistoryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');

  // Modal / Form state
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Form Fields
  const [formWeight, setFormWeight] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState<'Morning' | 'Afternoon' | 'Evening'>('Morning');
  const [formNotes, setFormNotes] = useState('');

  // Chart Zoom state: 1M, 3M, 6M, 1Y, ALL
  const [zoomLevel, setZoomLevel] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1M');

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      
      // Determine unit
      if (profileData.metadata?.weight_unit) {
        setUnit(profileData.metadata.weight_unit);
      } else {
        const localUnit = await AsyncStorage.getItem(`weight_unit_${user.id}`);
        if (localUnit) {
          setUnit(localUnit as any);
        }
      }

      // Load weight logs (database check with metadata fallback)
      await fetchLogs(user.id, profileData);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (userId: string, currentProfile: any) => {
    try {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_date', { ascending: false });

      if (error) {
        // Fallback to metadata
        if (currentProfile?.metadata?.weight_logs) {
          setWeightLogs(currentProfile.metadata.weight_logs);
        } else {
          // Fallback to AsyncStorage
          const localLogsStr = await AsyncStorage.getItem(`weight_logs_${userId}`);
          if (localLogsStr) {
            setWeightLogs(JSON.parse(localLogsStr));
          } else {
            setWeightLogs([]);
          }
        }
      } else {
        setWeightLogs(data || []);
      }
    } catch (err) {
      console.error('Fetch weight logs failed, using profile metadata/local storage:', err);
      if (currentProfile?.metadata?.weight_logs) {
        setWeightLogs(currentProfile.metadata.weight_logs);
      } else {
        const localLogsStr = await AsyncStorage.getItem(`weight_logs_${userId}`);
        if (localLogsStr) {
          setWeightLogs(JSON.parse(localLogsStr));
        }
      }
    }
  };

  const handleSaveLog = async () => {
    const weightNum = parseFloat(formWeight);
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert('Error', 'Please enter a valid weight.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let updatedLogs = [...weightLogs];

      if (isEditMode && editingLogId) {
        // Edit flow
        try {
          const { error } = await supabase
            .from('weight_logs')
            .update({
              weight: weightNum,
              logged_date: formDate,
              logged_time: formTime,
              notes: formNotes,
            })
            .eq('id', editingLogId);

          if (error) throw error;
        } catch {
          // Metadata Fallback
          updatedLogs = updatedLogs.map(l => l.id === editingLogId ? {
            ...l,
            weight: weightNum,
            logged_date: formDate,
            logged_time: formTime,
            notes: formNotes,
          } : l);
        }
      } else {
        // Create flow
        const newLog: WeightLog = {
          id: Math.random().toString(36).substring(7),
          weight: weightNum,
          unit,
          logged_date: formDate,
          logged_time: formTime,
          notes: formNotes,
        };

        try {
          const { error } = await supabase
            .from('weight_logs')
            .insert({
              user_id: user.id,
              weight: weightNum,
              unit,
              logged_date: formDate,
              logged_time: formTime,
              notes: formNotes,
            });

          if (error) throw error;
        } catch {
          // Metadata Fallback
          updatedLogs = [newLog, ...updatedLogs];
        }
      }

      // Sort logs descending
      updatedLogs.sort((a, b) => new Date(b.logged_date).getTime() - new Date(a.logged_date).getTime());

      // Save metadata fallback just in case database trigger hasn't run
      const latestWeight = updatedLogs[0]?.weight || weightNum;
      
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          weight_kg: latestWeight,
          metadata: {
            ...(profile?.metadata || {}),
            weight_logs: updatedLogs,
            weight_unit: unit,
          }
        })
        .eq('id', user.id);

      if (profileUpdateError) {
        console.log('Weight profile update failed, using fallback standard columns and AsyncStorage...', profileUpdateError);
        // Fallback update on weight_kg directly
        const { error: fallbackError } = await supabase
          .from('profiles')
          .update({
            weight_kg: latestWeight,
          })
          .eq('id', user.id);
        
        if (fallbackError) throw fallbackError;

        // Save logs to local storage
        await AsyncStorage.setItem(`weight_logs_${user.id}`, JSON.stringify(updatedLogs));
        await AsyncStorage.setItem(`weight_unit_${user.id}`, unit);
      }

      Alert.alert('Success', 'Weight entry saved successfully!');
      setLogModalVisible(false);
      resetForm();
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save weight.');
    }
  };

  const handleDeleteLog = async (logId: string) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this weight log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              let updatedLogs = weightLogs.filter(l => l.id !== logId);

              try {
                await supabase
                  .from('weight_logs')
                  .delete()
                  .eq('id', logId);
              } catch {
                // Ignore DB error, metadata handles it
              }

              const latestWeight = updatedLogs[0]?.weight || profile.weight_kg;

              await supabase
                .from('profiles')
                .update({
                  weight_kg: latestWeight,
                  metadata: {
                    ...(profile.metadata || {}),
                    weight_logs: updatedLogs,
                  }
                })
                .eq('id', user.id);

              Alert.alert('Deleted', 'Entry deleted successfully.');
              loadData();
            } catch (err) {
              console.error('Delete failed:', err);
            }
          }
        }
      ]
    );
  };

  const openEdit = (log: WeightLog) => {
    setIsEditMode(true);
    setEditingLogId(log.id);
    setFormWeight(log.weight.toString());
    setFormDate(log.logged_date);
    setFormTime(log.logged_time);
    setFormNotes(log.notes || '');
    setLogModalVisible(true);
  };

  const resetForm = () => {
    setIsEditMode(false);
    setEditingLogId(null);
    setFormWeight('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormTime('Morning');
    setFormNotes('');
  };

  // Calculations
  const weightLogsSorted = [...weightLogs].sort((a, b) => new Date(a.logged_date).getTime() - new Date(b.logged_date).getTime());
  
  // 7-day average
  const last7DaysLogs = weightLogs.filter(l => {
    const diff = new Date().getTime() - new Date(l.logged_date).getTime();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  });
  const avgWeight = last7DaysLogs.length > 0
    ? (last7DaysLogs.reduce((sum, l) => sum + l.weight, 0) / last7DaysLogs.length).toFixed(1)
    : (profile?.weight_kg || 70).toFixed(1);

  // Goal config
  const goalWeight = parseFloat(profile?.metadata?.health_goals?.targetWeight) || 70;
  const startWeight = weightLogsSorted[0]?.weight || profile?.weight_kg || 70;
  const currentWeightNum = parseFloat(avgWeight);
  
  const totalDifference = Math.abs(startWeight - goalWeight);
  const remainingDifference = Math.abs(currentWeightNum - goalWeight);
  const lostWeight = Math.max(0, startWeight - currentWeightNum);

  const progressPercent = totalDifference > 0
    ? Math.round((lostWeight / totalDifference) * 100)
    : 0;

  // Filter logs by zoom level
  const filteredLogs = weightLogsSorted.filter(l => {
    if (zoomLevel === 'ALL') return true;
    const diff = new Date().getTime() - new Date(l.logged_date).getTime();
    const daysLimit = zoomLevel === '1M' ? 30 : zoomLevel === '3M' ? 90 : zoomLevel === '6M' ? 180 : 365;
    return diff <= daysLimit * 24 * 60 * 60 * 1000;
  });

  // Render Line Graph
  const renderChart = () => {
    if (filteredLogs.length < 2) {
      return (
        <View style={styles.emptyChart}>
          <Info size={24} color="#cfc2d6" style={{ opacity: 0.5 }} />
          <Text style={styles.emptyChartText}>Log at least 2 entries to display weight graph.</Text>
        </View>
      );
    }

    const weights = filteredLogs.map(l => l.weight);
    const minW = Math.min(...weights, goalWeight) - 2;
    const maxW = Math.max(...weights, goalWeight) + 2;
    const rangeW = maxW - minW;

    const points = filteredLogs.map((l, index) => {
      const x = (index / (filteredLogs.length - 1)) * (CHART_WIDTH - 40) + 20;
      const y = CHART_HEIGHT - ((l.weight - minW) / rangeW) * (CHART_HEIGHT - 40) - 20;
      return { x, y, weight: l.weight };
    });

    let pathString = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathString += ` L ${points[i].x} ${points[i].y}`;
    }

    // Projected target line
    const lastPoint = points[points.length - 1];
    const targetY = CHART_HEIGHT - ((goalWeight - minW) / rangeW) * (CHART_HEIGHT - 40) - 20;
    
    return (
      <View style={styles.chartWrapper}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Target Weight dashed baseline */}
          <Line
            x1="20"
            y1={targetY}
            x2={CHART_WIDTH - 20}
            y2={targetY}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1.5"
            strokeDasharray="4, 4"
          />

          {/* Actual weight trend line */}
          <Path
            d={pathString}
            fill="none"
            stroke="#ddb7ff"
            strokeWidth="3"
          />

          {/* Trend dots */}
          {points.map((p, idx) => (
            <Circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#400071"
              stroke="#ddb7ff"
              strokeWidth="2"
            />
          ))}
        </Svg>
        <View style={styles.chartLegend}>
          <Text style={styles.legendText}>Start: {startWeight} {unit}</Text>
          <Text style={[styles.legendText, { color: '#ddb7ff' }]}>Goal: {goalWeight} {unit}</Text>
        </View>
      </View>
    );
  };

  // Dynamic Milestones
  const renderMilestones = () => {
    const milestones = [];
    const step = 2; // Every 2kg is a milestone
    
    let currentStep = Math.ceil(startWeight);
    const direction = goalWeight < startWeight ? -1 : 1;

    while ((direction === -1 && currentStep >= goalWeight) || (direction === 1 && currentStep <= goalWeight)) {
      milestones.push(currentStep);
      currentStep += step * direction;
    }

    if (milestones[milestones.length - 1] !== goalWeight) {
      milestones.push(goalWeight);
    }

    return (
      <View style={styles.milestoneBox}>
        {milestones.map((m, idx) => {
          const reached = direction === -1 ? currentWeightNum <= m : currentWeightNum >= m;
          const isGoal = m === goalWeight;

          return (
            <View key={idx} style={styles.milestoneRow}>
              <View style={[styles.milestoneBadge, reached ? styles.badgeActive : styles.badgeInactive]}>
                <Award size={16} color={reached ? '#400071' : '#cfc2d6'} />
              </View>
              <Text style={[styles.milestoneLabel, reached && styles.milestoneLabelActive]}>
                {m} {unit} {isGoal ? '🎯' : reached ? '✅' : ''}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // Smart advice messages
  const getSmartAdvice = () => {
    if (weightLogs.length < 3) return 'Log more weight weigh-ins to see personalized trend updates.';
    const recentWeight = weightLogs[0].weight;
    const oldWeight = weightLogs[weightLogs.length - 1].weight;
    const diff = recentWeight - oldWeight;

    if (Math.abs(diff) < 0.2) {
      return 'Your weight has remained stable. This is completely normal daily fluctuation. Keep staying consistent!';
    }
    if (goalWeight < startWeight) {
      // Weight loss goal
      return diff < 0 
        ? "You're ahead of schedule! Your body is responding beautifully to your calorie deficit."
        : 'Weight is trending up slightly. Check your calorie and water intake records to break the plateau.';
    } else {
      // Weight gain goal
      return diff > 0 
        ? "Fantastic! You are gaining muscle mass exactly according to target specs."
        : 'Gain rate is a little slow. Try increasing your macronutrient/protein goals slightly.';
    }
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>WEIGHT TRACKING</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setLogModalVisible(true)} activeOpacity={0.7}>
            <Plus size={24} color="#ddb7ff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ddb7ff" />
          </View>
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              
              {/* Progress Summary Card */}
              <BlurView intensity={25} tint="dark" style={styles.summaryCard}>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>CURRENT AVERAGE</Text>
                    <Text style={styles.summaryValue}>{avgWeight} <Text style={styles.unitText}>{unit}</Text></Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>TARGET GOAL</Text>
                    <Text style={styles.summaryValue}>{goalWeight} <Text style={styles.unitText}>{unit}</Text></Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>{progressPercent}% Completed</Text>
                  <Text style={styles.progressText}>{remainingDifference.toFixed(1)} {unit} remaining</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.max(5, Math.min(100, progressPercent))}%` }]} />
                </View>
              </BlurView>

              {/* Line Chart Header and zoom selector */}
              <View style={styles.chartHeader}>
                <Text style={styles.sectionTitle}>WEIGHT TRENDS</Text>
                <View style={styles.zoomRow}>
                  {['1M', '3M', '6M', '1Y', 'ALL'].map(z => (
                    <TouchableOpacity
                      key={z}
                      style={[styles.zoomBtn, zoomLevel === z && styles.zoomBtnActive]}
                      onPress={() => setZoomLevel(z as any)}
                    >
                      <Text style={[styles.zoomText, zoomLevel === z && styles.zoomTextActive]}>{z}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {renderChart()}

              {/* Smart trend message */}
              <BlurView intensity={15} tint="dark" style={styles.adviceCard}>
                <TrendingDown size={20} color="#ddb7ff" />
                <Text style={styles.adviceText}>{getSmartAdvice()}</Text>
              </BlurView>

              {/* Milestones */}
              <Text style={styles.sectionTitle}>MILESTONES & TARGETS</Text>
              {renderMilestones()}

              {/* Weight Log List */}
              <Text style={styles.sectionTitle}>WEIGH-IN LOGS</Text>
              <View style={styles.logsList}>
                {weightLogs.map((log) => (
                  <BlurView key={log.id} intensity={15} tint="dark" style={styles.logCard}>
                    <View style={styles.logLeft}>
                      <Calendar size={16} color="#cfc2d6" style={{ marginRight: 6 }} />
                      <Text style={styles.logDate}>{log.logged_date}</Text>
                      <Clock size={14} color="#cfc2d6" style={{ marginHorizontal: 6 }} />
                      <Text style={styles.logTime}>{log.logged_time}</Text>
                    </View>
                    <View style={styles.logRight}>
                      <Text style={styles.logWeight}>{log.weight} {log.unit}</Text>
                      <TouchableOpacity onPress={() => openEdit(log)} style={styles.actionIconBtn}>
                        <Edit3 size={16} color="#ddb7ff" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteLog(log.id)} style={styles.actionIconBtn}>
                        <Trash2 size={16} color="#FF2A5F" />
                      </TouchableOpacity>
                    </View>
                  </BlurView>
                ))}
              </View>

            </ScrollView>
          </Animated.View>
        )}

        {/* Create/Edit Weight Log Modal overlay */}
        <Modal visible={logModalVisible} animationType="slide" transparent={true} onRequestClose={() => setLogModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setLogModalVisible(false)} />
            <View style={styles.modalContent}>
              <View style={styles.modalGrabber} />
              <Text style={styles.modalTitle}>{isEditMode ? 'EDIT WEIGHT LOG' : 'LOG TODAY\'S WEIGHT'}</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight ({unit})</Text>
                <TextInput
                  style={styles.modalInputField}
                  value={formWeight}
                  onChangeText={setFormWeight}
                  keyboardType="decimal-pad"
                  placeholder="79.4"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.modalInputField}
                  value={formDate}
                  onChangeText={setFormDate}
                  placeholder="2026-07-01"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Time of Day</Text>
                <View style={styles.pillContainer}>
                  {['Morning', 'Afternoon', 'Evening'].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.pill, formTime === t && styles.pillActive]}
                      onPress={() => setFormTime(t as any)}
                    >
                      <Text style={[styles.pillText, formTime === t && styles.pillTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.modalInputField, { height: 72 }]}
                  value={formNotes}
                  onChangeText={setFormNotes}
                  multiline
                  placeholder="Optional log notes..."
                  placeholderTextColor="rgba(255,255,255,0.2)"
                />
              </View>

              <Button3D
                title={isEditMode ? 'SAVE CHANGES' : 'LOG WEIGHT'}
                onPress={handleSaveLog}
              />
            </View>
          </View>
        </Modal>

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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(221, 183, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
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
  summaryCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.3)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.15)',
    padding: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: '#cfc2d6',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
    marginBottom: 6,
    opacity: 0.7,
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Inter_900Black',
  },
  unitText: {
    fontSize: 14,
    color: '#ddb7ff',
    fontFamily: 'Inter_600SemiBold',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    opacity: 0.8,
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
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.2,
    marginVertical: 14,
    opacity: 0.6,
  },
  zoomRow: {
    flexDirection: 'row',
    gap: 4,
  },
  zoomBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  zoomBtnActive: {
    backgroundColor: '#ddb7ff',
  },
  zoomText: {
    color: '#cfc2d6',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  zoomTextActive: {
    color: '#400071',
  },
  emptyChart: {
    height: CHART_HEIGHT,
    backgroundColor: 'rgba(45, 49, 51, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  emptyChartText: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    opacity: 0.7,
  },
  chartWrapper: {
    backgroundColor: 'rgba(45, 49, 51, 0.25)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.12)',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  legendText: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    opacity: 0.8,
  },
  adviceCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.1)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  adviceText: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    flex: 1,
  },
  milestoneBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 49, 51, 0.2)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  milestoneBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: '#ddb7ff',
  },
  badgeInactive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  milestoneLabel: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  milestoneLabelActive: {
    color: '#FFF',
    fontFamily: 'Inter_800ExtraBold',
  },
  logsList: {
    gap: 10,
  },
  logCard: {
    backgroundColor: 'rgba(45, 49, 51, 0.25)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(207, 194, 214, 0.12)',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logDate: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  logTime: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    opacity: 0.8,
  },
  logRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logWeight: {
    color: '#ddb7ff',
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
    marginRight: 6,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#101415',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  modalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_900Black',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#cfc2d6',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
    opacity: 0.8,
  },
  modalInputField: {
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
  pillContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
});
