import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function DeviceApprovalBlockedView() {
  const { user, profile, deviceStatus, deviceApprovalRecord, checkDeviceStatus, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const insets = useSafeAreaInsets();

  const isPending = deviceStatus === 'PENDING';
  const isDenied = deviceStatus === 'DENIED';

  const handleRefreshStatus = async () => {
    setChecking(true);
    try {
      await checkDeviceStatus();
    } catch (e) {
      console.warn('Failed to re-check device status:', e);
    } finally {
      setChecking(false);
    }
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 16);
  const bottomPadding = Math.max(insets.bottom, 16);

  const displayUser = profile || user || {};

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 8 },
      ]}
    >
      {/* 1. Header Section */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconCircle,
            isPending ? styles.pendingIconBg : styles.deniedIconBg,
          ]}
        >
          <Ionicons
            name={isPending ? 'time-outline' : 'ban-outline'}
            size={42}
            color={isPending ? '#D97706' : '#DC2626'}
          />
        </View>

        <Text style={styles.title}>
          {isPending ? 'Device Approval Pending' : 'Access Denied for Device'}
        </Text>

        <Text style={styles.subtitle} numberOfLines={2}>
          {isPending
            ? 'Your device approval is pending. Contact the administrator for access.'
            : 'Access has been denied for this device. Please contact the administrator.'}
        </Text>
      </View>

      {/* 2. Denial Reason (if denied & remarks exist) */}
      {isDenied && deviceApprovalRecord?.remarks ? (
        <View style={styles.reasonCard}>
          <View style={styles.reasonHeader}>
            <Ionicons name="information-circle-outline" size={18} color="#991B1B" />
            <Text style={styles.reasonTitle}>Denial Reason</Text>
          </View>
          <Text style={styles.reasonText} numberOfLines={2}>
            {deviceApprovalRecord.remarks}
          </Text>
        </View>
      ) : null}

      {/* 3. Request Details Card */}
      <View style={styles.detailsCard}>
        <Text style={styles.cardHeader}>Request Details</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>User</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {displayUser.full_name || displayUser.email || 'N/A'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {displayUser.email || 'N/A'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Device</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {deviceApprovalRecord?.device_name || 'Current Device'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Model & OS</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {deviceApprovalRecord?.device_model || 'Unknown'} (
            {(deviceApprovalRecord?.platform || Platform.OS).toUpperCase()})
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Device ID</Text>
          <Text style={styles.deviceIdValue} numberOfLines={1} ellipsizeMode="middle">
            {deviceApprovalRecord?.device_id || 'Unknown ID'}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <View
            style={[
              styles.badge,
              isPending ? styles.pendingBadge : styles.deniedBadge,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isPending ? styles.pendingBadgeText : styles.deniedBadgeText,
              ]}
            >
              {deviceStatus || 'PENDING'}
            </Text>
          </View>
        </View>
      </View>

      {/* 4. Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.primaryBtn, checking && styles.btnDisabled]}
          onPress={handleRefreshStatus}
          disabled={checking}
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Check Status</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color="#374151" />
          <Text style={styles.secondaryBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  pendingIconBg: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
  },
  deniedIconBg: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  reasonCard: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 4,
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  reasonText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
  deviceIdValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#4B5563',
    maxWidth: '60%',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  deniedBadge: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  pendingBadgeText: {
    color: '#92400E',
  },
  deniedBadgeText: {
    color: '#991B1B',
  },
  actionContainer: {
    width: '100%',
    gap: 10,
    marginBottom: 4,
  },
  primaryBtn: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryBtnText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
});
