import React from 'react';
import { Tabs } from 'expo-router';
import { Theme } from '@/theme/theme';
import { Home, BarChart2, Users, User } from 'lucide-react-native';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarIconStyle: {
          width: 'auto',
          height: 'auto',
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 24 : 16,
          left: 16,
          right: 16,
          borderRadius: 24,
          backgroundColor: 'rgba(16, 20, 21, 0.85)',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 72,
          paddingBottom: Platform.OS === 'ios' ? 20 : 0,
          paddingTop: Platform.OS === 'ios' ? 8 : 0,
          elevation: 0,
          borderWidth: 1,
          borderColor: 'rgba(207, 194, 214, 0.15)',
          overflow: 'hidden',
        },
        tabBarBackground: () => (
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.01)']}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarButton: (props) => {
            const selected = props.accessibilityState?.selected;
            return (
              <TouchableOpacity
                onPress={props.onPress}
                activeOpacity={0.7}
                style={styles.tabButtonContainer}
              >
                <View style={[
                  styles.tabItem,
                  selected && styles.tabItemActive
                ]}>
                  <Home
                    size={20}
                    color={selected ? '#400071' : Theme.colors.textMuted}
                    fill={selected ? '#400071' : 'none'}
                  />
                  <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>Home</Text>
                </View>
              </TouchableOpacity>
            );
          }
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          tabBarButton: (props) => {
            const selected = props.accessibilityState?.selected;
            return (
              <TouchableOpacity
                onPress={props.onPress}
                activeOpacity={0.7}
                style={styles.tabButtonContainer}
              >
                <View style={[
                  styles.tabItem,
                  selected && styles.tabItemActive
                ]}>
                  <BarChart2 size={20} color={selected ? '#400071' : Theme.colors.textMuted} />
                  <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>Ranking</Text>
                </View>
              </TouchableOpacity>
            );
          }
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          tabBarButton: (props) => {
            const selected = props.accessibilityState?.selected;
            return (
              <TouchableOpacity
                onPress={props.onPress}
                activeOpacity={0.7}
                style={styles.tabButtonContainer}
              >
                <View style={[
                  styles.tabItem,
                  selected && styles.tabItemActive
                ]}>
                  <Users size={20} color={selected ? '#400071' : Theme.colors.textMuted} />
                  <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>Squad</Text>
                </View>
              </TouchableOpacity>
            );
          }
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarButton: (props) => {
            const selected = props.accessibilityState?.selected;
            return (
              <TouchableOpacity
                onPress={props.onPress}
                activeOpacity={0.7}
                style={styles.tabButtonContainer}
              >
                <View style={[
                  styles.tabItem,
                  selected && styles.tabItemActive
                ]}>
                  <User size={20} color={selected ? '#400071' : Theme.colors.textMuted} />
                  <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>Profile</Text>
                </View>
              </TouchableOpacity>
            );
          }
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  tabItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 60,
    width: 60,
    borderRadius: 30,
  },
  tabItemActive: {
    backgroundColor: '#ddb7ff',
    shadowColor: '#ddb7ff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 15,
    shadowOpacity: 0.45,
  },
  tabLabel: {
    color: Theme.colors.textMuted,
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: '#400071',
    fontFamily: 'Inter_800ExtraBold',
  },
});
