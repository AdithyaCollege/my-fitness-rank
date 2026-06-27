import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { Theme } from '@/theme/theme';
import { Dumbbell, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      WebBrowser.warmUpAsync();
    }
    return () => {
      if (Platform.OS === 'android') {
        WebBrowser.coolDownAsync();
      }
    };
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // Use Linking.createURL to get the Expo Go redirect URI
      const redirectTo = Linking.createURL('auth-callback');
      console.log('Redirect URI:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No auth URL returned from Supabase.');

      // Open the browser session
      await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      setErrorMsg(err.message || 'Failed to complete Google Sign In.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#06060C', '#120A2B', '#1C123E']}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        {/* Background neon ambient glows */}
        <LinearGradient
          colors={['rgba(124, 58, 237, 0.78)', 'rgba(124, 58, 237, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0.6 }}
          style={styles.ambientGlowTop}
        />
        <View style={styles.ambientGlowBottom} />

        <View style={styles.content}>
          {/* Esports Logo Header */}
          <View style={styles.logoContainer}>
            <View style={[styles.logoIconCircle, Theme.getGlow(Theme.colors.primary, 'high')]}>
              <Dumbbell size={40} color={Theme.colors.primary} strokeWidth={2.5} />
            </View>
            <Text style={styles.logoText}>
              GYM<Text style={{ color: Theme.colors.primary }}>RANK</Text>
            </Text>
            <Text style={styles.subtitle}>GAMIFY YOUR GRIND</Text>
          </View>

          {/* Info Card */}
          <View style={styles.card}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.cardHeader}>RANK UP YOUR FITNESS</Text>
            <Text style={styles.cardText}>
              Log workouts, maintain your daily consistency streak, and rise through the competitive tiers from Bronze to Champion.
            </Text>
            
            <View style={styles.divider} />

            <View style={styles.featureRow}>
              <ShieldCheck size={20} color={Theme.colors.primary} />
              <Text style={styles.featureText}>Compete in Global Leaderboards</Text>
            </View>

            <View style={styles.featureRow}>
              <ShieldCheck size={20} color={Theme.colors.primary} />
              <Text style={styles.featureText}>Create and Join Fitness Squads</Text>
            </View>
          </View>

          {/* Login Actions */}
          <View style={styles.actionContainer}>
            {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

            <TouchableOpacity
              style={[
                styles.loginButton,
                loading && styles.buttonDisabled,
                Theme.getGlow(Theme.colors.primary, 'medium'),
              ]}
              onPress={handleGoogleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.googleIconText}>G</Text>
                  <Text style={styles.loginButtonText}>SIGN IN WITH GOOGLE</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <Text style={styles.termsText}>
              By signing in, you agree to our Terms and Conditions.
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
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
    opacity: 0.08,
  },
  content: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 40,
  },
  logoContainer: {
    alignItems: 'center',
    gap: 12,
  },
  logoIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.card,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 38,
    color: '#FFF',
    letterSpacing: 2,
    fontFamily: 'Inter_900Black',
  },
  subtitle: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    letterSpacing: 4,
    fontFamily: 'Inter_700Bold',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(22, 15, 43, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    gap: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1.5,
  },
  cardText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.border,
    marginVertical: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  loginButton: {
    width: '100%',
    height: 56,
    backgroundColor: Theme.colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleIconText: {
    color: '#FFF',
    fontSize: 22,
    fontFamily: 'Inter_900Black',
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  errorText: {
    color: Theme.colors.danger,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  termsText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 4,
  },
});
