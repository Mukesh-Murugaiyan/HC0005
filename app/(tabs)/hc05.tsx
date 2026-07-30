import React, { useState } from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeviceCard } from '@/components/DeviceCard';
import { PinInput } from '@/components/PinInput';
import { StatusBadge } from '@/components/StatusBadge';
import { ToastNotification } from '@/components/ToastNotification';
import { useBluetooth } from '@/hooks/useBluetooth';

export default function HC05Screen() {
  const insets = useSafeAreaInsets();
  const {
    isConnected,
    connect,
    disconnect,
    connectedDevice,
    devices,
    isPairingModeEnabled,
    togglePairingMode,
  } = useBluetooth();
  const [pin, setPin] = useState<string>('123456');
  const [showToast, setShowToast] = useState<boolean>(true);

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 28 : 12);

  const handleConnectToggle = async () => {
    if (isConnected) {
      await disconnect();
      setShowToast(false);
    } else {
      const targetDevice = connectedDevice || devices[0];
      const success = await connect(targetDevice, pin);
      if (success) {
        setShowToast(true);
      }
    }
  };

  const handleDemoPress = async () => {
    if (isConnected) {
      await disconnect();
      setPin('');
      setShowToast(false);
    } else {
      setPin('123456');
      const targetDevice = devices[0];
      await connect(targetDevice, '123456');
      setShowToast(true);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header below status bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HC-05</Text>
        <StatusBadge isConnected={isConnected} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Device Information Card */}
        <DeviceCard
          isConnected={isConnected}
          connectedDevice={connectedDevice}
          onDisconnect={disconnect}
        />

        {/* PIN Entry and Connect Card */}
        <PinInput
          pin={pin}
          onPinChange={setPin}
          onConnect={handleConnectToggle}
          isConnected={isConnected}
          expiresInSeconds={10}
        />

        {/* Action Row: Pairing Mode Toggle & Demo Mode */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.pairingBtn, isPairingModeEnabled && styles.pairingBtnActive]}
            onPress={togglePairingMode}
          >
            <Text style={styles.pairingBtnText}>
              {isPairingModeEnabled ? 'Pairing Mode: ON' : 'Enable Pairing Mode'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} style={styles.demoBtn} onPress={handleDemoPress}>
            <Text style={styles.demoBtnText}>Demo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Toast Notification */}
      <ToastNotification visible={showToast && isConnected} message="Bluetooth was connected" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0D',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  pairingBtn: {
    flex: 1,
    backgroundColor: '#2F65FF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  pairingBtnActive: {
    backgroundColor: '#20E065',
  },
  pairingBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  demoBtn: {
    backgroundColor: '#353538',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  demoBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
