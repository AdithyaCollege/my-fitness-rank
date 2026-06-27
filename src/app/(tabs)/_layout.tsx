import React from 'react';
import { Tabs } from 'expo-router';
import { Theme } from '@/theme/theme';
import { LayoutDashboard, Trophy, Users, User } from 'lucide-react-native';
import { Platform, View, Text, StyleSheet } from 'react-native';
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
          backgroundColor: 'rgba(14, 9, 30, 0.45)',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 72,
          paddingBottom: Platform.OS === 'ios' ? 20 : 0,
          paddingTop: Platform.OS === 'ios' ? 8 : 0,
          elevation: 0,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.12)',
          overflow: 'hidden',
        },
        tabBarBackground: () => (
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.01)']}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[
              styles.tabItem,
              focused && styles.tabItemActive
            ]}>
              <LayoutDashboard size={20} color={focused ? '#FFF' : Theme.colors.textMuted} />
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>Home</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[
              styles.tabItem,
              focused && styles.tabItemActive
            ]}>
              <Trophy size={20} color={focused ? '#FFF' : Theme.colors.textMuted} />
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>Rankings</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[
              styles.tabItem,
              focused && styles.tabItemActive
            ]}>
              <Users size={20} color={focused ? '#FFF' : Theme.colors.textMuted} />
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>Squads</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[
              styles.tabItem,
              focused && styles.tabItemActive
            ]}>
              <User size={20} color={focused ? '#FFF' : Theme.colors.textMuted} />
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>Profile</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  tabItemActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)', // Semi-transparent active purple pill
  },
  tabLabel: {
    color: Theme.colors.textMuted,
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: '#FFF',
    fontFamily: 'Inter_800ExtraBold',
  },
});
