import { BluetoothPairingModal } from '@/components/BluetoothPairingModal';
import AdminVerifyModal from '@/components/AdminVerifyModal';
import { NumberGrid } from '@/components/NumberGrid';
import { StatusBadge } from '@/components/StatusBadge';
import { ToastNotification } from '@/components/ToastNotification';
import { useBluetooth } from '@/hooks/useBluetooth';
import { BluetoothDevice } from '@/services/bluetooth';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

/**
 * Format a weight grid value into OASYS TNEPDS format: X.XXX (3 decimal places, kg)
 * Examples:
 *   '5'       → '5.000'   bytes: 35 2E 30 30 30
 *   '2.5'     → '2.500'   bytes: 32 2E 35 30 30
 *   '0.50\n0' → '0.500'   bytes: 30 2E 35 30 30
 *   '20'      → '20.000'  bytes: 32 30 2E 30 30 30
 */
function formatWeightForOASYS(val: string): string {
  // Clean up multi-line grid values like '0.50\n0'
  const clean = val.split('\n')[0].trim();
  const kg = parseFloat(clean);
  if (isNaN(kg)) return '0.000';
  return kg.toFixed(3); // Always 3 decimal places
}

/** Convert a string to its hex byte representation for debug logging */
function toBytesHex(str: string): string {
  return [...str]
    .map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [selectedValue, setSelectedValue] = useState<string>('20');
  const [pairingModalVisible, setPairingModalVisible] = useState<boolean>(false);
  const [adminModalVisible, setAdminModalVisible] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('Bluetooth was connected');

  const {
    isConnected,
    connect,
    disconnect,
    sendData,
    devices,
    isScanning,
    scan,
    connectedDevice,
    myDeviceName,
    receivedData,
    enablePairingMode,
  } = useBluetooth();

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 28 : 12);

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up reset timer on unmount
  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleSelectValue = async (val: string) => {
    // Clear any active 5-second timer from previous click
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    setSelectedValue(val);
    const formatted = formatWeightForOASYS(val);
    const hexBytes = toBytesHex(formatted);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⚖️  [WEIGHT SENT — ONETIME] Raw: "${val}" → Formatted: "${formatted}"`);
    console.log(`   Bytes: ${hexBytes}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await sendData(formatted);

    // After 3 seconds, automatically reset weight to 0.000
    if (val !== '0' && val !== '0.50\n0') {
      resetTimerRef.current = setTimeout(async () => {
        const zeroVal = '0';
        const zeroFormatted = formatWeightForOASYS(zeroVal); // '0.000'
        const zeroHexBytes = toBytesHex(zeroFormatted);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`⏰ [AUTO-RESET 3s] Resetting weight to 0 → Formatted: "${zeroFormatted}"`);
        console.log(`   Bytes: ${zeroHexBytes}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        setSelectedValue(zeroVal);
        await sendData(zeroFormatted);
        resetTimerRef.current = null;
      }, 3000);
    }
  };

  const handlePlayPress = () => {
    setPairingModalVisible(true);
  };

  const handleDisconnectHeader = async () => {
    await disconnect();
    setToastMessage('Bluetooth disconnected');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handlePairDevice = async (device: BluetoothDevice): Promise<boolean> => {
    const success = await connect(device);
    if (success) {
      setToastMessage(`Bluetooth connected to ${device.name}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    }
    return success;
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>High Delite</Text>

        <View style={styles.headerRightRow}>
          {isAdmin && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.adminCircleBtn}
              onPress={() => setAdminModalVisible(true)}
            >
              <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {isConnected ? (
            <StatusBadge isConnected={true} />
          ) : (
            <TouchableOpacity activeOpacity={0.8} style={styles.playCircleBtn} onPress={handlePlayPress}>
              <Text style={styles.playIconText}>▶</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Response from connected Bluetooth device */}
      {isConnected && !!receivedData && (
        <View style={styles.rxBanner}>
          <Text style={styles.rxLabel}>Response from device:</Text>
          <Text style={styles.rxText}>{receivedData.trim()}</Text>
        </View>
      )}

      {/* Main Grid Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <NumberGrid selectedValue={selectedValue} onSelectValue={handleSelectValue} />
      </ScrollView>

      {/* Admin Security Check Modal */}
      <AdminVerifyModal
        visible={adminModalVisible}
        onClose={() => setAdminModalVisible(false)}
      />

      {/* Bluetooth Pairing & Connection Modal */}
      <BluetoothPairingModal
        visible={pairingModalVisible}
        onClose={() => setPairingModalVisible(false)}
        devices={devices}
        connectedDevice={connectedDevice}
        isConnected={isConnected}
        myDeviceName={myDeviceName}
        onPairDevice={handlePairDevice}
        onEnablePairingMode={async () => {
          const res = await enablePairingMode();
          setToastMessage('Pairing Mode Enabled: My Device is Discoverable');
          setShowToast(true);
          setTimeout(() => setShowToast(false), 4000);
          return res;
        }}
        onDisconnect={async () => {
          await disconnect();
          setToastMessage('Bluetooth disconnected');
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        }}
        onRefreshScan={scan}
        isScanning={isScanning}
      />

      {/* Bottom Toast Banner */}
      <ToastNotification visible={showToast} message={toastMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7A7A7A', // Dark neutral background matching screenshots
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adminCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 2,
  },
  disconnectBtn: {
    backgroundColor: '#D9383A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disconnectText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rxBanner: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rxLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  rxText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 40,
  },
});
