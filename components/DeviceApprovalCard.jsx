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
        hour: '2-digit',
        minute: '2-digit',
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
      {/* Top Header: User Info & Status Badge */}
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

      <View style={styles.divider} />

      {/* Device Specs Details */}
      <View style={styles.deviceDetailsContainer}>
        <View style={styles.deviceRow}>
          <Ionicons name={getPlatformIcon()} size={18} color="#007AFF" style={styles.deviceIcon} />
          <Text style={styles.deviceName} numberOfLines={1}>
            {approval.device_name || 'Unknown Device'} ({approval.device_model || 'N/A'})
          </Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>OS Version</Text>
            <Text style={styles.metaValue}>{approval.os_version || 'N/A'}</Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>App Version</Text>
            <Text style={styles.metaValue}>v{approval.app_version || '1.0.0'}</Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Requested</Text>
            <Text style={styles.metaValue}>{formattedDate}</Text>
          </View>
        </View>

        {/* Device ID preview */}
        <View style={styles.idRow}>
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
      </View>

      {/* Action Buttons Footer */}
      <View style={styles.cardFooter}>
        {isPending ? (
          <>
            <TouchableOpacity
              style={[styles.btn, styles.approveBtn]}
              onPress={() => onApprove(approval)}
            >
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.btnTextWhite}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.denyBtn]}
              onPress={() => onDeny(approval)}
            >
              <Ionicons name="close-circle" size={16} color="#FFFFFF" />
              <Text style={styles.btnTextWhite}>Deny</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.editBtn]}
              onPress={() => onEdit(approval)}
            >
              <Ionicons name="create-outline" size={16} color="#495057" />
              <Text style={styles.btnTextDark}>Edit</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.btn, styles.editBtn, { flex: 1 }]}
              onPress={() => onEdit(approval)}
            >
              <Ionicons name="create-outline" size={16} color="#007AFF" />
              <Text style={[styles.btnTextDark, { color: '#007AFF' }]}>
                Edit Approval Status & Remarks
              </Text>
            </TouchableOpacity>

            {isDenied && (
              <TouchableOpacity
                style={[styles.btn, styles.approveBtn]}
                onPress={() => onApprove(approval)}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.btnTextWhite}>Re-Approve</Text>
              </TouchableOpacity>
            )}

            {isApproved && (
              <TouchableOpacity
                style={[styles.btn, styles.denyBtn]}
                onPress={() => onDeny(approval)}
              >
                <Ionicons name="close-circle" size={16} color="#FFFFFF" />
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
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E9ECEF',
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
    marginRight: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
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
    color: '#212529',
  },
  userEmail: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
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
    fontSize: 11,
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
    backgroundColor: '#F1F3F5',
    marginVertical: 12,
  },
  deviceDetailsContainer: {
    gap: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceIcon: {
    marginRight: 4,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#343A40',
    flex: 1,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#6C757D',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#212529',
    marginTop: 2,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  idLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#868E96',
  },
  idValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#495057',
    flex: 1,
  },
  remarksBox: {
    backgroundColor: '#FFF9DB',
    borderColor: '#FFE066',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59F00',
  },
  remarksText: {
    fontSize: 12,
    color: '#5C4813',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
  },
  approveBtn: {
    backgroundColor: '#10B981',
  },
  denyBtn: {
    backgroundColor: '#EF4444',
  },
  editBtn: {
    backgroundColor: '#F1F3F5',
    borderWidth: 1,
    borderColor: '#CED4DA',
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnTextDark: {
    color: '#495057',
    fontSize: 13,
    fontWeight: '600',
  },
});
