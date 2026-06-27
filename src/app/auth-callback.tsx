import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Theme } from '@/theme/theme';
import { Dumbbell } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// Call at the top level of the redirect handling route to properly terminate browser auth sessions
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const url = Linking.useURL();
  const [statusText, setStatusText] = useState('Initializing verification...');
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      if (isProcessingRef.current) return;

      try {
        // 0. Check if session already exists to prevent double-processing/redeeming code
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          console.log('[AuthCallback] Session already exists, dismissing browser.');
          setStatusText('Authentication complete!');
          await WebBrowser.dismissBrowser();
          return;
        }

        // Extract tokens from a given URL string
        const getParam = (name: string, urlStr: string): string => {
          const hashRegex = new RegExp('[#&]' + name + '=([^&#]*)');
          const hashResult = hashRegex.exec(urlStr);
          if (hashResult) return decodeURIComponent(hashResult[1].replace(/\+/g, ' '));

          const queryRegex = new RegExp('[?&]' + name + '=([^&#]*)');
          const queryResult = queryRegex.exec(urlStr);
          if (queryResult) return decodeURIComponent(queryResult[1].replace(/\+/g, ' '));

          return '';
        };

        // 1. First, check if parameters are directly in local search params (from Expo Router)
        const codeParam = params.code as string;
        const accessTokenParam = params.access_token as string;
        const refreshTokenParam = params.refresh_token as string;

        let code = codeParam || '';
        let accessToken = accessTokenParam || '';
        let refreshToken = refreshTokenParam || '';

        // 2. If not found in router params, parse the full linking URL
        if (!code && !accessToken && url) {
          console.log('[AuthCallback] Parsing linking URL:', url);
          code = getParam('code', url);
          accessToken = getParam('access_token', url);
          refreshToken = getParam('refresh_token', url);
        }

        if (accessToken && refreshToken) {
          isProcessingRef.current = true;
          setStatusText('Verifying credentials...');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          console.log('[AuthCallback] Session set successfully!');
          setStatusText('Authentication successful!');
          await WebBrowser.dismissBrowser();
          return;
        }

        if (code) {
          isProcessingRef.current = true;
          setStatusText('Synchronizing profile...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          console.log('[AuthCallback] Code exchanged successfully!');
          setStatusText('Sync complete!');
          await WebBrowser.dismissBrowser();
          return;
        }

        // Check for errors in redirect URL
        const errorParam = params.error as string || (url ? getParam('error', url) : '');
        const errorDesc = params.error_description as string || (url ? getParam('error_description', url) : '');
        if (errorParam) {
          isProcessingRef.current = true;
          Alert.alert('Authentication Error', errorDesc || errorParam);
          await WebBrowser.dismissBrowser();
          router.replace('/(auth)/login');
          return;
        }
      } catch (err: any) {
        console.error('[AuthCallback] Verification error:', err);
        Alert.alert('Verification Failed', err.message || 'Failed to complete authentication.');
        await WebBrowser.dismissBrowser();
        router.replace('/(auth)/login');
      }
    };

    handleCallback();
  }, [params, url]);

  // Fail-safe timeout: If after 5 seconds we haven't redirected or authenticated, take them back to login
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !isProcessingRef.current) {
        console.log('[AuthCallback] Timeout reached without session. Redirecting to login.');
        await WebBrowser.dismissBrowser();
        router.replace('/(auth)/login');
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Dumbbell size={48} color={Theme.colors.primary} />
        </View>
        <Text style={styles.title}>GYMRANK</Text>
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.spinner} />
        <Text style={styles.status}>{statusText}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Theme.colors.card,
    borderWidth: 2,
    borderColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...Theme.getGlow(Theme.colors.primary, 'medium'),
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Inter_900Black',
    letterSpacing: 2,
  },
  spinner: {
    marginTop: 24,
  },
  status: {
    color: Theme.colors.textMuted,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 8,
  },
});
