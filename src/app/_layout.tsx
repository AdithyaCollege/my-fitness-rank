import { DarkTheme, DefaultTheme, ThemeProvider, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  
  const segments = useSegments();
  const router = useRouter();

  // Listen to Auth State
  useEffect(() => {
    console.log('[RootLayout] Mounting and initializing auth state check...');
    
    // Check current session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log('[RootLayout] getSession completed. Session found:', !!session);
        setSession(session);
        if (session) {
          console.log('[RootLayout] User ID:', session.user.id);
          checkOnboarding(session.user.id);
        } else {
          console.log('[RootLayout] No session found, setting onboarded=false, loading=false');
          setOnboarded(false);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('[RootLayout] Error in getSession:', err);
        setOnboarded(false);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[RootLayout] onAuthStateChange event:', event, 'Session found:', !!session);
      setSession(session);
      if (session) {
        await checkOnboarding(session.user.id);
      } else {
        setOnboarded(false);
        setLoading(false);
      }
    });

    return () => {
      console.log('[RootLayout] Unsubscribing from auth state listener');
      subscription.unsubscribe();
    };
  }, []);

  // Listen for realtime profile changes (e.g. onboarding status)
  useEffect(() => {
    if (!session) return;

    console.log('[RootLayout] Subscribing to realtime profile updates for:', session.user.id);
    const channel = supabase
      .channel(`public-profiles-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          console.log('[RootLayout] Realtime profile change detected:', payload);
          if (payload.new && 'onboarded' in payload.new) {
            setOnboarded((payload.new as any).onboarded);
          }
        }
      )
      .subscribe((status) => {
        console.log('[RootLayout] Realtime subscription status:', status);
      });

    return () => {
      console.log('[RootLayout] Removing realtime profile channel');
      supabase.removeChannel(channel);
    };
  }, [session]);

  const checkOnboarding = async (userId: string) => {
    console.log('[RootLayout] Checking onboarding for user:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('[RootLayout] Profile query error:', error);
        // If profile doesn't exist yet, insert a default one
        if (error.code === 'PGRST116') {
          console.log('[RootLayout] Profile not found, inserting default profile...');
          const { data: newData, error: insertError } = await supabase
            .from('profiles')
            .insert([{ id: userId, onboarded: false }])
            .select('onboarded')
            .single();
          
          if (insertError) {
            console.error('[RootLayout] Profile insertion failed:', insertError);
            throw insertError;
          }
          console.log('[RootLayout] Inserted default profile. onboarded:', newData?.onboarded);
          setOnboarded(newData?.onboarded ?? false);
        } else {
          throw error;
        }
      } else {
        console.log('[RootLayout] Profile found, onboarded:', data.onboarded);
        setOnboarded(data.onboarded);
      }
    } catch (err) {
      console.error('[RootLayout] Error in checkOnboarding:', err);
      setOnboarded(false);
    } finally {
      console.log('[RootLayout] checkOnboarding completed. Setting loading to false');
      setLoading(false);
    }
  };

  // Handle Redirection Flow
  useEffect(() => {
    if (loading || onboarded === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      // Not logged in -> Redirect to login if not already there
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Logged in
      if (!onboarded) {
        // Not onboarded -> Redirect to onboarding if not already there
        if (!inOnboarding) {
          router.replace('/onboarding');
        }
      } else {
        // Logged in & Onboarded -> Redirect to main app if in auth or onboarding
        if (inAuthGroup || inOnboarding || (segments as string[]).length === 0) {
          router.replace('/(tabs)');
        }
      }
    }
  }, [session, loading, onboarded, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E17' }}>
        <ActivityIndicator size="large" color="#00FF66" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
