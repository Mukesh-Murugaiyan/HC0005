import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatusBadgeProps {
  isConnected: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ isConnected }) => {
  return (
    <View style={[styles.badge, isConnected ? styles.connectedBadge : styles.disconnectedBadge]}>
      <View style={[styles.dot, isConnected ? styles.connectedDot : styles.disconnectedDot]} />
      <Text style={[styles.badgeText, isConnected ? styles.connectedText : styles.disconnectedText]}>
        {isConnected ? 'Connected' : 'Not Connected'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  connectedBadge: {
    backgroundColor: '#053B1A',
    borderColor: '#0F612B',
  },
  disconnectedBadge: {
    backgroundColor: '#3E0D0D',
    borderColor: '#681717',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  connectedDot: {
    backgroundColor: '#20E065',
  },
  disconnectedDot: {
    backgroundColor: '#FF3B30',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  connectedText: {
    color: '#20E065',
  },
  disconnectedText: {
    color: '#FF4D4D',
  },
});
