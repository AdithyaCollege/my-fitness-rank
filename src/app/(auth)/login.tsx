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
    <View style={styles.container}>
      {/* Background neon ambient glows */}
      <View style={styles.ambientGlowTop} />
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
          <Text style={styles.cardHeader}>RANK UP YOUR FITNESS</Text>
          <Text style={styles.cardText}>
            Log workouts, maintain your daily consistency streak, and rise through the competitive tiers from Bronze to Champion.
          </Text>
          
          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <ShieldCheck size={20} color={Theme.colors.secondary} />
            <Text style={styles.featureText}>Secure, unified cloud profiles</Text>
          </View>
        </View>

        {/* Login Action */}
        <View style={styles.actionContainer}>
          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          <TouchableOpacity
            style={[
              styles.loginButton,
              Theme.getGlow(Theme.colors.primary, 'medium'),
              loading && styles.buttonDisabled,
            ]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View style={styles.buttonInner}>
                <Text style={styles.googleIconText}>G</Text>
                <Text style={styles.loginButtonText}>SIGN IN WITH GOOGLE</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <Text style={styles.termsText}>
            By signing in, you agree to join the global leaderboard.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -150,
    right: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Theme.colors.primary,
    opacity: 0.15,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Theme.colors.accent,
    opacity: 0.1,
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
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-CondensedBold' : 'sans-serif-condensed',
  },
  subtitle: {
    fontSize: 14,
    color: Theme.colors.textMuted,
    letterSpacing: 4,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 24,
    gap: 16,
  },
  cardHeader: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cardText: {
    color: Theme.colors.textMuted,
    fontSize: 14,
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
    color: Theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
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
    color: '#000',
    fontSize: 22,
    fontWeight: '900',
  },
  loginButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  errorText: {
    color: Theme.colors.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  termsText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
