import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useKeepAwake } from 'expo-keep-awake';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '../context/AuthContext';
import DeviceApprovalBlockedView from '../components/DeviceApprovalBlockedView';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { user, session, deviceStatus, isLoading } = useAuth();

  // If user is authenticated but their device status is PENDING or DENIED, show blocked approval view
  const isDeviceBlocked = user && session && (deviceStatus === 'PENDING' || deviceStatus === 'DENIED');

  if (!isLoading && isDeviceBlocked) {
    return <DeviceApprovalBlockedView />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="admin/index" options={{ headerShown: false }} />
        <Stack.Screen name="admin/user-details" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} translucent />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useKeepAwake();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
