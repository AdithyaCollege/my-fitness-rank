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
  const isProcessingRef = useRef(false);

  const extractAndSetSession = async (url: string) => {
    // Prevent double-processing
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      // Extract tokens from URL hash fragments or query params
      const getParam = (name: string, urlStr: string): string => {
        // Check hash fragments first (#access_token=...)
        const hashRegex = new RegExp('[#&]' + name + '=([^&#]*)');
        const hashResult = hashRegex.exec(urlStr);
        if (hashResult) return decodeURIComponent(hashResult[1].replace(/\+/g, ' '));

        // Check query params (?access_token=...)
        const queryRegex = new RegExp('[?&]' + name + '=([^&#]*)');
        const queryResult = queryRegex.exec(urlStr);
        if (queryResult) return decodeURIComponent(queryResult[1].replace(/\+/g, ' '));

        return '';
      };

      const accessToken = getParam('access_token', url);
      const refreshToken = getParam('refresh_token', url);

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
        console.log('Session set successfully!');
        return;
      }

      // Try authorization code exchange (PKCE flow)
      const code = getParam('code', url);
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        console.log('Code exchanged for session successfully!');
        return;
      }

      // Check for errors from OAuth
      const errorParam = getParam('error', url);
      const errorDesc = getParam('error_description', url);
      if (errorParam) {
        throw new Error(errorDesc || errorParam);
      }

      console.warn('No tokens or code found in callback URL:', url);
    } catch (err: any) {
      console.error('Session extraction error:', err);
      setErrorMsg(err.message || 'Failed to complete sign-in.');
    } finally {
      isProcessingRef.current = false;
      setLoading(false);
    }
  };

  // Listen for deep links at all times (this catches the redirect on Android)
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('Deep link received:', event.url);
      if (
        event.url.includes('access_token') ||
        event.url.includes('code=') ||
        event.url.includes('error=')
      ) {
        extractAndSetSession(event.url);
      }
    });

    // Also check if the app was opened from a deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url && (url.includes('access_token') || url.includes('code='))) {
        console.log('Initial deep link:', url);
        extractAndSetSession(url);
      }
    });

    return () => subscription.remove();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    isProcessingRef.current = false;

    try {
      // Use Linking.createURL to get the Expo Go redirect URI
      const redirectTo = Linking.createURL('auth-callback');
      console.log('Redirect URI:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No auth URL returned from Supabase.');

      // Try openAuthSessionAsync first (works on iOS, may work on some Android)
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      console.log('Auth session result:', result.type);

      if (result.type === 'success' && result.url) {
        // Chrome Custom Tab successfully caught the redirect
        await extractAndSetSession(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // On Android, the browser may have dismissed but the deep link
        // was caught by the Linking.addEventListener above.
        // Give it a moment to process.
        setTimeout(() => {
          if (!isProcessingRef.current) {
            // If no deep link was received either, user probably cancelled
            setLoading(false);
          }
        }, 3000);
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      setErrorMsg(err.message || 'Failed to complete Google Sign In.');
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
