import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BluetoothModalProps {
  visible: boolean;
  appName?: string;
  onDeny: () => void;
  onAllow: () => void;
}

export const BluetoothModal: React.FC<BluetoothModalProps> = ({
  visible,
  appName = '“HC-0.5”',
  onDeny,
  onAllow,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialogCard}>
          <Text style={styles.dialogText}>
            {appName === '“HC-0.5”'
              ? '“HC-0.5” wants to turn on Bluetooth so that your phone can be discovered by other Bluetooth devices in 300 seconds.'
              : 'Some app wants your phone to be discovered by other Bluetooth devices in 300 seconds.'}
          </Text>

          <View style={styles.dividerHorizontal} />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={onDeny} activeOpacity={0.7}>
              <Text style={styles.denyText}>Deny</Text>
            </TouchableOpacity>

            <View style={styles.dividerVertical} />

            <TouchableOpacity style={styles.actionBtn} onPress={onAllow} activeOpacity={0.7}>
              <Text style={styles.allowText}>Allow</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  dialogCard: {
    width: '100%',
    backgroundColor: '#E3E3E5',
    borderRadius: 24,
    paddingTop: 24,
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  dialogText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  dividerHorizontal: {
    height: 1,
    width: '100%',
    backgroundColor: '#C5C5C7',
  },
  buttonRow: {
    flexDirection: 'row',
    height: 52,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  denyText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
  },
  allowText: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '600',
  },
  dividerVertical: {
    width: 1,
    height: '100%',
    backgroundColor: '#C5C5C7',
  },
});
