import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BluetoothDevice } from '@/services/bluetooth';

interface DeviceCardProps {
  isConnected: boolean;
  connectedDevice?: BluetoothDevice | null;
  onDisconnect?: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  isConnected,
  connectedDevice,
  onDisconnect,
}) => {
  const deviceName = connectedDevice?.name || 'HC-05';
  const deviceAddress = connectedDevice?.address || connectedDevice?.id || 'Classic Bluetooth Module';

  return (
    <View style={styles.card}>
      <View style={styles.topSection}>
        {/* Left Bluetooth Avatar Circle */}
        <View style={styles.avatarOuterRing}>
          <View style={styles.avatarInnerCircle}>
            <IconSymbol size={26} name="paperplane.fill" color={isConnected ? '#20E065' : '#B026FF'} />
          </View>
        </View>

        {/* Right Info */}
        <View style={styles.infoSection}>
          <Text style={styles.deviceName}>{deviceName}</Text>
          <Text style={styles.deviceSubtitle}>{deviceAddress}</Text>
        </View>

        {/* Disconnect Action Button */}
        {isConnected && onDisconnect && (
          <TouchableOpacity activeOpacity={0.8} style={styles.disconnectCardBtn} onPress={onDisconnect}>
            <Text style={styles.disconnectCardBtnText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom Status Row */}
      <View style={styles.bottomRow}>
        <Text style={styles.statusLabel}>Status</Text>
        <View style={styles.statusValueContainer}>
          <Text style={[styles.statusValue, isConnected ? styles.activeText : styles.offlineText]}>
            {isConnected ? 'Connected & Active' : 'Offline'}
          </Text>
          <View style={[styles.statusDot, isConnected ? styles.activeDot : styles.offlineDot]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#28282B',
    borderRadius: 20,
    padding: 20,
    marginVertical: 12,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarOuterRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: '#3D3D42',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInnerCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#4A4A50',
    backgroundColor: '#1E1E22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    marginLeft: 16,
    flex: 1,
  },
  deviceName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  deviceSubtitle: {
    color: '#A0A0A5',
    fontSize: 14,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#3E3E42',
    marginBottom: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  statusValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  activeText: {
    color: '#20E065',
  },
  offlineText: {
    color: '#FF3B30',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: '#20E065',
  },
  offlineDot: {
    backgroundColor: '#FF3B30',
  },
  disconnectCardBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  disconnectCardBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
