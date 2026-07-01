import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Home as HomeIcon,
  Heart,
  BarChart2,
  Apple,
  Dumbbell,
  Calendar,
  Smartphone,
  Trophy,
  Award,
  Bell,
  Settings,
  HelpCircle,
  FileText,
  LogOut,
  Flame,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  activeItem?: string;
  profile: any;
  userEmail?: string;
  onLogout?: () => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  visible,
  onClose,
  activeItem = 'Home',
  profile,
  userEmail = 'john.doe@gymrank.app',
  onLogout,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Animation values for avatar press scale
  const avatarScale = useRef(new Animated.Value(1)).current;

  // Track visibility state internally to allow reverse animations to finish before unmounting
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.35,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible]);

  // Swipe gesture close responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Capture horizontal movements swiping left
        return Math.abs(gestureState.dx) > 10 && gestureState.dx < 0;
      },
      onPanResponderMove: (_, gestureState) => {
        const newX = Math.max(-DRAWER_WIDTH, Math.min(0, gestureState.dx));
        translateX.setValue(newX);
        const opacityVal = 0.35 * (1 + newX / DRAWER_WIDTH);
        backdropOpacity.setValue(opacityVal);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -80 || gestureState.vx < -0.3) {
          // Close drawer smoothly
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: -DRAWER_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setShouldRender(false);
            onClose();
          });
        } else {
          // Restore open
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0.35,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const handleAvatarPress = () => {
    Animated.sequence([
      Animated.timing(avatarScale, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(avatarScale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNavigation = (item: string, route?: string) => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShouldRender(false);
      onClose();
      if (item === 'Logout' && onLogout) {
        onLogout();
      } else if (route) {
        router.push(route as any);
      } else if (item !== 'Home') {
        Alert.alert(`${item}`, `${item} feature is coming soon!`);
      }
    });
  };

  if (!shouldRender) return null;

  const avatarUrl = profile?.avatar_url;
  const isUrl = avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('https'));
  const xpLevel = Math.floor((profile?.total_xp ?? 0) / 1000) + 1;

  const renderItem = (name: string, Icon: any, route?: string) => {
    const isActive = activeItem === name;
    return (
      <TouchableOpacity
        key={name}
        activeOpacity={0.7}
        style={[
          styles.menuItem,
          isActive && styles.menuItemActive,
        ]}
        onPress={() => handleNavigation(name, route)}
      >
        <Icon size={20} color={isActive ? '#400071' : '#cfc2d6'} />
        <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
          {name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.absoluteOverlay}>
      {/* Dimmed Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => {
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: -DRAWER_WIDTH,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 0,
              duration: 250,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setShouldRender(false);
            onClose();
          });
        }} />
      </Animated.View>

      {/* Slide-in Menu container */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX }] },
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={['rgba(73, 0, 128, 0.45)', '#101415']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.6 }}
        />

        {/* Profile Header */}
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.9} onPress={handleAvatarPress}>
            <Animated.View style={[styles.avatarGlow, { transform: [{ scale: avatarScale }] }]}>
              {isUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <Text style={styles.avatarEmoji}>{avatarUrl?.split(' ')[0] || '🦊'}</Text>
              )}
            </Animated.View>
          </TouchableOpacity>

          <Text style={styles.username}>{profile?.username || 'Gamer Tag'}</Text>
          <Text style={styles.email}>{userEmail}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.badgeLevel}>
              <Award size={14} color="#ddb7ff" />
              <Text style={styles.badgeText}>Level {xpLevel}</Text>
            </View>
            <View style={styles.badgeStreak}>
              <Flame size={14} color="#FF9F0A" />
              <Text style={styles.badgeText}>{profile?.current_streak ?? 0} Day Streak</Text>
            </View>
          </View>
        </View>

        {/* Navigation Items grouped */}
        <ScrollView style={styles.menuItemsContainer} showsVerticalScrollIndicator={false}>
          
          {/* Section 1: Health & Activity */}
          <Text style={styles.sectionHeader}>HEALTH & ACTIVITY</Text>
          <View style={styles.sectionGroup}>
            {renderItem('Home', HomeIcon, '/')}
            {renderItem('Health & Goals', Heart, '/health-goals')}
            {renderItem('Weight History', BarChart2, '/weight-history')}
            {renderItem('Nutrition', Apple)}
            {renderItem('Workout Plans', Dumbbell)}
            {renderItem('Activity History', Calendar)}
          </View>

          <View style={styles.divider} />

          {/* Section 2: Connectivity & Rewards */}
          <Text style={styles.sectionHeader}>CONNECTIVITY & REWARDS</Text>
          <View style={styles.sectionGroup}>
            {renderItem('Connected Devices', Smartphone)}
            {renderItem('Achievements', Trophy)}
            {renderItem('Premium', Award)}
            {renderItem('Notifications', Bell)}
          </View>

          <View style={styles.divider} />

          {/* Section 3: System & Support */}
          <Text style={styles.sectionHeader}>SYSTEM & SUPPORT</Text>
          <View style={styles.sectionGroup}>
            {renderItem('Settings', Settings)}
            {renderItem('Help & Support', HelpCircle)}
            {renderItem('Privacy Policy', FileText)}
            {renderItem('Logout', LogOut)}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  absoluteOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#101415',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    borderRightWidth: 1.5,
    borderRightColor: 'rgba(207, 194, 214, 0.15)',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(207, 194, 214, 0.1)',
  },
  avatarGlow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#ddb7ff',
    backgroundColor: 'rgba(221, 183, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#ddb7ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarEmoji: {
    fontSize: 32,
    textAlign: 'center',
  },
  username: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.5,
  },
  email: {
    color: '#cfc2d6',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  badgeLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(221, 183, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#ddb7ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  badgeStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
    borderWidth: 1,
    borderColor: '#FF9F0A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  menuItemsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    color: '#cfc2d6',
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingHorizontal: 8,
    opacity: 0.6,
  },
  sectionGroup: {
    gap: 4,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  menuItemActive: {
    backgroundColor: '#ddb7ff',
  },
  menuItemText: {
    color: '#e0e3e5',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  menuItemTextActive: {
    color: '#400071',
    fontFamily: 'Inter_800ExtraBold',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(207, 194, 214, 0.1)',
    marginVertical: 8,
  },
});
