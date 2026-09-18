import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DeviceApprovalCard({ approval, onApprove, onDeny, onEdit }) {
  const profile = approval.profiles || {};
  const isPending = approval.status === 'PENDING';
  const isApproved = approval.status === 'APPROVED';
  const isDenied = approval.status === 'DENIED';

  const formattedDate = approval.created_at
    ? new Date(approval.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown Date';

  const getPlatformIcon = () => {
    const plat = (approval.platform || '').toLowerCase();
    if (plat.includes('ios') || plat.includes('apple')) return 'logo-apple';
    if (plat.includes('android')) return 'logo-android';
    return 'hardware-chip-outline';
  };

  return (
    <View style={styles.card}>
      {/* Top Header: User Info & Status Badges */}
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(profile.full_name || profile.email || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userTextContainer}>
            <Text style={styles.userName} numberOfLines={1}>
              {profile.full_name || 'Unnamed User'}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {profile.email || 'No Email'}
            </Text>
          </View>
        </View>

        <View style={styles.badgeColumn}>
          {/* Real-time Online / Offline WhatsApp-style Badge */}
          <View
            style={[
              styles.activityBadge,
              approval.computed_is_online ? styles.onlineActivityBadge : styles.offlineActivityBadge,
            ]}
          >
            <View
              style={[
                styles.activityDot,
                approval.computed_is_online ? styles.onlineDot : styles.offlineDot,
              ]}
            />
            <Text
              style={[
                styles.activityText,
                approval.computed_is_online ? styles.onlineText : styles.offlineText,
              ]}
              numberOfLines={1}
            >
              {approval.computed_is_online ? 'Online' : 'Offline'}
            </Text>
          </View>

          {/* Device Approval Status Badge */}
          <View
            style={[
              styles.statusBadge,
              isApproved && styles.approvedBadge,
              isPending && styles.pendingBadge,
              isDenied && styles.deniedBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isApproved && styles.approvedText,
                isPending && styles.pendingText,
                isDenied && styles.deniedText,
              ]}
            >
              {approval.status}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Device Specs Header */}
      <View style={styles.deviceRow}>
        <View style={styles.deviceIconWrapper}>
          <Ionicons name={getPlatformIcon()} size={16} color="#007AFF" />
        </View>
        <Text style={styles.deviceName} numberOfLines={1}>
          {approval.device_name || 'Unknown Device'}
          {approval.device_model ? ` (${approval.device_model})` : ''}
        </Text>
      </View>

      {/* Live Activity & Current Day Usage Metrics (2-Card Stacked Grid to prevent text overlap) */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Ionicons name="time-outline" size={13} color="#0284C7" />
            <Text style={styles.metricLabel}>{"Today's Usage"}</Text>
          </View>
          <Text style={styles.metricPrimaryValue} numberOfLines={1}>
            {approval.formatted_today_usage || approval.formatted_usage || '0s'}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Ionicons
              name={approval.computed_is_online ? 'radio' : 'radio-outline'}
              size={13}
              color={approval.computed_is_online ? '#16A34A' : '#64748B'}
            />
            <Text style={styles.metricLabel}>Last Seen</Text>
          </View>
          <Text
            style={[
              styles.metricPrimaryValue,
              approval.computed_is_online && styles.onlineMetricValue,
            ]}
            numberOfLines={1}
          >
            {approval.computed_is_online ? 'Active Now' : (approval.formatted_last_seen || 'Offline')}
          </Text>
        </View>
      </View>

      {/* Metadata Row: OS, App Version, and Requested Date */}
      <View style={styles.metaRow}>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>OS Version</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {approval.os_version || 'N/A'}
          </Text>
        </View>

        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>App Version</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            v{approval.app_version || '1.0.0'}
          </Text>
        </View>

        <View style={[styles.metaCol, styles.metaColDate]}>
          <Text style={styles.metaLabel}>Requested</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {formattedDate}
          </Text>
        </View>
      </View>

      {/* Device ID preview */}
      <View style={styles.idContainer}>
        <Text style={styles.idLabel}>ID:</Text>
        <Text style={styles.idValue} numberOfLines={1} ellipsizeMode="middle">
          {approval.device_id}
        </Text>
      </View>

      {/* Remarks section if exists */}
      {approval.remarks ? (
        <View style={styles.remarksBox}>
          <Text style={styles.remarksLabel}>Remarks:</Text>
          <Text style={styles.remarksText}>{approval.remarks}</Text>
        </View>
      ) : null}

      {/* Action Buttons Footer */}
      <View style={styles.cardFooter}>
        {isPending ? (
          <>
            <TouchableOpacity
              style={[styles.btn, styles.approveBtn]}
              onPress={() => onApprove(approval)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
              <Text style={styles.btnTextWhite}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.denyBtn]}
              onPress={() => onDeny(approval)}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle" size={15} color="#FFFFFF" />
              <Text style={styles.btnTextWhite}>Deny</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.editBtn]}
              onPress={() => onEdit(approval)}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={15} color="#475569" />
              <Text style={styles.btnTextDark}>Edit</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.btn, styles.editBtn, { flex: 1 }]}
              onPress={() => onEdit(approval)}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={15} color="#007AFF" />
              <Text style={[styles.btnTextDark, { color: '#007AFF' }]}>
                Edit Approval
              </Text>
            </TouchableOpacity>

            {isDenied && (
              <TouchableOpacity
                style={[styles.btn, styles.approveBtn, { flex: 1 }]}
                onPress={() => onApprove(approval)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                <Text style={styles.btnTextWhite}>Re-Approve</Text>
              </TouchableOpacity>
            )}

            {isApproved && (
              <TouchableOpacity
                style={[styles.btn, styles.denyBtn, { flex: 1 }]}
                onPress={() => onDeny(approval)}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={15} color="#FFFFFF" />
                <Text style={styles.btnTextWhite}>Revoke</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#007AFF',
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  onlineActivityBadge: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
  },
  offlineActivityBadge: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineDot: {
    backgroundColor: '#16A34A',
  },
  offlineDot: {
    backgroundColor: '#94A3B8',
  },
  activityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  onlineText: {
    color: '#15803D',
  },
  offlineText: {
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  approvedBadge: {
    backgroundColor: '#D1FAE5',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  deniedBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  approvedText: {
    color: '#065F46',
  },
  pendingText: {
    color: '#92400E',
  },
  deniedText: {
    color: '#991B1B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  deviceIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  metricPrimaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  onlineMetricValue: {
    color: '#16A34A',
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metaCol: {
    flex: 1,
  },
  metaColDate: {
    flex: 1.2,
  },
  metaLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginTop: 1,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  idLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  idValue: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#334155',
    flex: 1,
  },
  remarksBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  remarksText: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 9,
    gap: 4,
    flex: 1,
  },
  approveBtn: {
    backgroundColor: '#10B981',
  },
  denyBtn: {
    backgroundColor: '#EF4444',
  },
  editBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnTextDark: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
});
