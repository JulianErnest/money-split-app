import { useFonts } from "expo-font";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { colors } from "@/theme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { NetworkProvider } from "@/lib/network-context";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { ToastProvider } from "@/components/ui/Toast";
import { useSyncOnReconnect } from "@/lib/sync-manager";

// Prevent the splash screen from auto-hiding before fonts load
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading, isNewUser } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    const inProfileSetup = segments[1] === "profile-setup";

    if (!session && !inAuthGroup) {
      // Not signed in — redirect to auth
      router.replace("/(auth)/sign-in");
    } else if (session && isNewUser && !inProfileSetup) {
      // Signed in but needs profile setup — redirect to profile setup
      router.replace("/(auth)/profile-setup");
    } else if (session && !isNewUser && inAuthGroup) {
      // Signed in with profile — redirect to app
      router.replace("/(tabs)");
    }
  }, [session, isLoading, isNewUser, segments]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="join/[code]" />
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="activity" />
    </Stack>
  );
}

function SyncWatcher() {
  useSyncOnReconnect();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NetworkProvider>
          <ToastProvider>
            <BottomSheetModalProvider>
              <SyncWatcher />
              <RootNavigator />
              <OfflineBanner />
              <StatusBar style="light" />
            </BottomSheetModalProvider>
          </ToastProvider>
        </NetworkProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
