import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface ToastNotificationProps {
  visible: boolean;
  message?: string;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  visible,
  message = 'Bluetooth was connected',
}) => {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.toastPill}>
        <IconSymbol size={18} name="paperplane.fill" color="#FFFFFF" style={styles.icon} />
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  toastPill: {
    backgroundColor: '#077D3D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  icon: {
    marginRight: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
