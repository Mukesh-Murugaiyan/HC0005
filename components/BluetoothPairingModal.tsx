import { IconSymbol } from '@/components/ui/icon-symbol';
import { BluetoothDevice, bluetoothService } from '@/services/bluetooth';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface BluetoothPairingModalProps {
  visible: boolean;
  onClose: () => void;
  devices: BluetoothDevice[];
  connectedDevice?: BluetoothDevice | null;
  isConnected?: boolean;
  myDeviceName?: string;
  onPairDevice: (device: BluetoothDevice) => Promise<boolean>;
  onDisconnect?: () => Promise<void>;
  onEnablePairingMode?: () => Promise<boolean>;
  onRefreshScan?: () => void;
  isScanning?: boolean;
}

export const BluetoothPairingModal: React.FC<BluetoothPairingModalProps> = ({
  visible,
  onClose,
  devices,
  connectedDevice,
  isConnected = false,
  myDeviceName = 'My Device (HC-0.5)',
  onPairDevice,
  onDisconnect,
  onEnablePairingMode,
  onRefreshScan,
  isScanning = false,
}) => {
  const [step, setStep] = useState<'permission' | 'deviceList' | 'connecting'>('permission');
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [isEnablingPairing, setIsEnablingPairing] = useState<boolean>(false);

  React.useEffect(() => {
    if (visible && isConnected) {
      setStep('deviceList');
    }
  }, [visible, isConnected]);

  const handleAllowPermission = async () => {
    if (isEnablingPairing) return;
    setIsEnablingPairing(true);
    try {
      if (onEnablePairingMode) {
        await onEnablePairingMode();
      } else {
        await bluetoothService.enablePairingMode();
      }
      setStep('deviceList');
    } catch (e) {
      console.warn('Pairing mode error:', e);
      setStep('deviceList');
    } finally {
      setIsEnablingPairing(false);
    }
  };

  const handleDenyPermission = () => {
    setStep('permission');
    onClose();
  };

  const handlePairClick = async (device: BluetoothDevice) => {
    setSelectedDevice(device);
    setStep('connecting');
    const success = await onPairDevice(device);
    if (success) {
      setStep('permission');
      onClose();
    } else {
      setStep('deviceList');
    }
  };

  const handleModalClose = () => {
    setStep('permission');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleModalClose}>
      <View style={styles.overlay}>
        {/* Step 1: Permission Dialog */}
        {step === 'permission' && (
          <View style={styles.dialogCard}>
            <Text style={styles.dialogText}>
              “HC-0.5” wants to turn on Bluetooth so that your phone can be discovered by other Bluetooth
              devices in 300 seconds.
            </Text>

            <View style={styles.dividerHorizontal} />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleDenyPermission}
                activeOpacity={0.7}
                disabled={isEnablingPairing}
              >
                <Text style={styles.denyText}>Deny</Text>
              </TouchableOpacity>

              <View style={styles.dividerVertical} />

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleAllowPermission}
                activeOpacity={0.7}
                disabled={isEnablingPairing}
              >
                {isEnablingPairing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#FF3B30" style={{ marginRight: 6 }} />
                    <Text style={styles.allowText}>Processing...</Text>
                  </View>
                ) : (
                  <Text style={styles.allowText}>Allow</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 2: Device Scanner & Discovery List */}
        {step === 'deviceList' && (
          <View style={styles.listCard}>
            {/* Header */}
            <View style={styles.listHeader}>
              <View style={styles.titleRow}>
                <IconSymbol size={16} name="paperplane.fill" color="#2F65FF" style={{ marginRight: 6 }} />
                <Text style={styles.listTitle}>Select Bluetooth Device</Text>
              </View>
              <TouchableOpacity onPress={handleModalClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* My Device Card (Discoverable for other devices to pair) */}
            <View style={styles.myDeviceCard}>
              <View style={styles.myDeviceHeader}>
                <View style={styles.myDeviceBadgeDot} />
                <Text style={styles.myDeviceSectionTitle}>MY DEVICE (READY FOR PAIRING)</Text>
              </View>
              <View style={styles.myDeviceRow}>
                <View style={styles.myDeviceIconCircle}>
                  <IconSymbol size={14} name="paperplane.fill" color="#B026FF" />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.myDeviceNameText}>{myDeviceName}</Text>
                  <Text style={styles.myDeviceSubText}>Other mobile devices can discover & pair with this phone</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.discoverableBtn}
                  onPress={async () => {
                    if (onEnablePairingMode) {
                      await onEnablePairingMode();
                    } else {
                      await bluetoothService.enablePairingMode();
                    }
                  }}
                >
                  <Text style={styles.discoverableBtnText}>Pairing Mode</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Connected Device Banner */}
            {isConnected && connectedDevice && (
              <View style={styles.connectedCard}>
                <View style={styles.connectedHeader}>
                  <View style={styles.connectedBadgeDot} />
                  <Text style={styles.connectedSectionTitle}>CONNECTED DEVICE</Text>
                </View>

                <View style={styles.connectedDeviceRow}>
                  <View style={styles.deviceIconCircleActive}>
                    <IconSymbol size={14} name="paperplane.fill" color="#20E065" />
                  </View>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{connectedDevice.name}</Text>
                    <Text style={styles.deviceSub}>{connectedDevice.address || connectedDevice.id}</Text>
                  </View>

                  {onDisconnect && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.disconnectBtn}
                      onPress={async () => {
                        await onDisconnect();
                      }}
                    >
                      <Text style={styles.disconnectBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Available Devices Subheader */}
            <View style={styles.subRow}>
              <Text style={styles.subtext}>
                {isScanning ? 'Scanning for nearby devices...' : 'AVAILABLE DEVICES'}
              </Text>
              {onRefreshScan && (
                <TouchableOpacity onPress={onRefreshScan} activeOpacity={0.7} style={styles.refreshBtn}>
                  {isScanning ? (
                    <ActivityIndicator size="small" color="#2F65FF" />
                  ) : (
                    <Text style={styles.refreshText}>Rescan</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Scanned Devices List */}
            <ScrollView style={styles.deviceScrollView} showsVerticalScrollIndicator={false}>
              {devices.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No Devices Found</Text>
                  <Text style={styles.emptySub}>
                    Make sure target device (e.g. HC-05 module) is turned ON and in pairing mode, then tap Rescan.
                  </Text>
                </View>
              ) : (
                devices.map((item) => {
                  const isItemConnected =
                    isConnected && (item.id === connectedDevice?.id || item.address === connectedDevice?.address || item.connected);

                  return (
                    <View key={item.id} style={styles.deviceItem}>
                      <View style={isItemConnected ? styles.deviceIconCircleActive : styles.deviceIconCircle}>
                        <IconSymbol size={14} name="paperplane.fill" color={isItemConnected ? '#20E065' : '#A0A0A5'} />
                      </View>
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceName}>{item.name}</Text>
                        <Text style={styles.deviceSub}>
                          {isItemConnected
                            ? 'Connected'
                            : item.paired
                              ? 'Paired'
                              : item.type || 'Discovered'}{' '}
                          • {item.address || item.id}
                        </Text>
                      </View>

                      {isItemConnected && onDisconnect ? (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={styles.disconnectBtn}
                          onPress={async () => {
                            await onDisconnect();
                          }}
                        >
                          <Text style={styles.disconnectBtnText}>Disconnect</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={styles.pairBtn}
                          onPress={() => handlePairClick(item)}
                        >
                          <Text style={styles.pairBtnText}>{item.paired ? 'Connect' : 'Pair'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        {/* Step 3: Connecting Handshake State */}
        {step === 'connecting' && (
          <View style={styles.connectingCard}>
            <ActivityIndicator size="small" color="#2F65FF" style={{ marginBottom: 10 }} />
            <Text style={styles.connectingTitle}>Pairing & Connecting...</Text>
            <Text style={styles.connectingSub}>{selectedDevice?.name || 'Bluetooth Device'}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dialogCard: {
    width: '90%',
    backgroundColor: '#E3E3E5',
    borderRadius: 18,
    paddingTop: 18,
    overflow: 'hidden',
    alignItems: 'center',
  },
  dialogText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  dividerHorizontal: {
    height: 1,
    width: '100%',
    backgroundColor: '#C5C5C7',
  },
  buttonRow: {
    flexDirection: 'row',
    height: 44,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  denyText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
  },
  allowText: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '600',
  },
  dividerVertical: {
    width: 1,
    height: '100%',
    backgroundColor: '#C5C5C7',
  },
  listCard: {
    width: '100%',
    maxHeight: 460,
    backgroundColor: '#1C1C1E',
    borderRadius: 18,
    padding: 14,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtnText: {
    fontSize: 15,
    color: '#8E8E93',
    padding: 2,
  },
  myDeviceCard: {
    backgroundColor: '#252030',
    borderColor: '#B026FF',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  myDeviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  myDeviceBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B026FF',
    marginRight: 6,
  },
  myDeviceSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C665FF',
    letterSpacing: 0.6,
  },
  myDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myDeviceIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#352545',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  myDeviceNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  myDeviceSubText: {
    fontSize: 10,
    color: '#B8B8C0',
  },
  discoverableBtn: {
    backgroundColor: '#B026FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 6,
  },
  discoverableBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  visibleChip: {
    backgroundColor: '#3A1E4D',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 6,
  },
  visibleChipText: {
    color: '#E099FF',
    fontSize: 10,
    fontWeight: '600',
  },
  connectedCard: {
    backgroundColor: '#19251E',
    borderColor: '#20E065',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  connectedBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#20E065',
    marginRight: 6,
  },
  connectedSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#20E065',
    letterSpacing: 0.6,
  },
  connectedDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 2,
  },
  subtext: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    flex: 1,
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#2A2A2E',
    borderRadius: 6,
  },
  refreshText: {
    color: '#2F65FF',
    fontSize: 11,
    fontWeight: '600',
  },
  deviceScrollView: {
    maxHeight: 280,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252528',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  deviceIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E1E22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  deviceIconCircleActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#19251E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 1,
  },
  deviceSub: {
    fontSize: 10,
    color: '#8E8E93',
  },
  pairBtn: {
    backgroundColor: '#2F65FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pairBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  disconnectBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  disconnectBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  connectingCard: {
    width: '80%',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  connectingTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  connectingSub: {
    color: '#8E8E93',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySub: {
    color: '#8E8E93',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
