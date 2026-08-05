import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function UserCard({
  user,
  onViewDetails,
  onEdit,
  onChangePassword,
  onToggleDisable,
  onDelete,
}) {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isAdmin = user.role === 'admin';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {(user.full_name || user.email || 'U')[0].toUpperCase()}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {user.full_name || 'No Name'}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {user.email}
          </Text>
        </View>

        <View
          style={[
            styles.roleBadge,
            isAdmin ? styles.adminBadge : styles.userBadge,
          ]}
        >
          <Text
            style={[
              styles.roleBadgeText,
              isAdmin ? styles.adminBadgeText : styles.userBadgeText,
            ]}
          >
            {user.role ? user.role.toUpperCase() : 'USER'}
          </Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="call-outline" size={14} color="#6C757D" />
          <Text style={styles.detailText}>{user.phone || 'N/A'}</Text>
        </View>

        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color="#6C757D" />
          <Text style={styles.detailText}>{formatDate(user.created_at)}</Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.viewBtn]}
          onPress={() => onViewDetails(user)}
        >
          <Ionicons name="eye-outline" size={16} color="#007AFF" />
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => onEdit(user)}
        >
          <Ionicons name="create-outline" size={16} color="#28A745" />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.keyBtn]}
          onPress={() => onChangePassword(user)}
        >
          <Ionicons name="key-outline" size={16} color="#FF9500" />
          <Text style={styles.keyBtnText}>Pass</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={() => onDelete(user)}
        >
          <Ionicons name="trash-outline" size={16} color="#DC3545" />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
  },
  userEmail: {
    fontSize: 13,
    color: '#6C757D',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadge: {
    backgroundColor: '#FF3B301A',
  },
  userBadge: {
    backgroundColor: '#34C7591A',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adminBadgeText: {
    color: '#FF3B30',
  },
  userBadgeText: {
    color: '#34C759',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6C757D',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 4,
  },
  viewBtn: {
    backgroundColor: '#007AFF10',
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  editBtn: {
    backgroundColor: '#28A74510',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#28A745',
  },
  keyBtn: {
    backgroundColor: '#FF950010',
  },
  keyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9500',
  },
  deleteBtn: {
    backgroundColor: '#DC354510',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC3545',
  },
});
