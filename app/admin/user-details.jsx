import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import EditUserModal from '../../components/EditUserModal';
import AdminChangePasswordModal from '../../components/AdminChangePasswordModal';
import AuthGuard from '../../components/AuthGuard';

export default function UserDetailsScreen() {
  const params = useLocalSearchParams();
  const { user: currentUser } = useAuth();

  const [user, setUser] = useState(() => {
    try {
      return params.userData ? JSON.parse(params.userData) : null;
    } catch (_e) {
      return null;
    }
  });

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 12);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No user details found.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isAdmin = user.role === 'admin';

  const handleSaveEdit = async (userId, updates) => {
    const updated = await adminService.adminUpdateUser(userId, updates);
    setUser(updated);
    Alert.alert('Success', 'User profile updated successfully.');
  };

  const handleSavePassword = async (userId, newPassword) => {
    await adminService.adminChangeUserPassword(userId, newPassword);
  };

  const handleDeleteUser = () => {
    if (user.id === currentUser?.id) {
      Alert.alert('Action Denied', 'You cannot delete your own admin account.');
      return;
    }

    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${user.full_name || user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminService.adminDeleteUser(user.id);
              Alert.alert('Success', 'User deleted successfully.');
              router.back();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete user.');
            }
          },
        },
      ]
    );
  };

  return (
    <AuthGuard requiredRole="admin">
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backIconBtn}>
            <Ionicons name="arrow-back" size={24} color="#212529" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>User Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(user.full_name || user.email || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <Text style={styles.userName}>{user.full_name || 'No Name'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>

            <View style={[styles.roleTag, isAdmin ? styles.adminTag : styles.userTag]}>
              <Text style={[styles.roleTagText, isAdmin ? styles.adminTagText : styles.userTagText]}>
                {user.role ? user.role.toUpperCase() : 'USER'}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Metadata</Text>

            <View style={styles.infoList}>
              <View style={styles.infoRow}>
                <Ionicons name="id-card-outline" size={20} color="#6C757D" />
                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>User ID (UUID)</Text>
                  <Text style={styles.infoValueSmall}>{user.id}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={20} color="#6C757D" />
                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>{user.full_name || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={20} color="#6C757D" />
                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{user.email}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={20} color="#6C757D" />
                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{user.phone || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={20} color="#6C757D" />
                <View style={styles.infoGroup}>
                  <Text style={styles.infoLabel}>Registered On</Text>
                  <Text style={styles.infoValue}>
                    {user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>Administrative Actions</Text>

            <TouchableOpacity style={styles.actionRow} onPress={() => setEditModalVisible(true)}>
              <Ionicons name="create-outline" size={20} color="#28A745" />
              <Text style={styles.actionText}>Edit Information & Role</Text>
              <Ionicons name="chevron-forward" size={18} color="#CED4DA" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={() => setPasswordModalVisible(true)}>
              <Ionicons name="key-outline" size={20} color="#FF9500" />
              <Text style={styles.actionText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={18} color="#CED4DA" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={handleDeleteUser}>
              <Ionicons name="trash-outline" size={20} color="#DC3545" />
              <Text style={[styles.actionText, styles.deleteText]}>Delete User Account</Text>
              <Ionicons name="chevron-forward" size={18} color="#CED4DA" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <EditUserModal
          visible={editModalVisible}
          user={user}
          onClose={() => setEditModalVisible(false)}
          onSave={handleSaveEdit}
        />

        <AdminChangePasswordModal
          visible={passwordModalVisible}
          user={user}
          onClose={() => setPasswordModalVisible(false)}
          onSave={handleSavePassword}
        />
      </View>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    backgroundColor: '#FFFFFF',
  },
  backIconBtn: {
    padding: 4,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
  },
  scrollContent: {
    padding: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF1D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#007AFF',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#212529',
  },
  userEmail: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 2,
  },
  roleTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  adminTag: {
    backgroundColor: '#FF3B301A',
  },
  userTag: {
    backgroundColor: '#34C7591A',
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  adminTagText: {
    color: '#FF3B30',
  },
  userTagText: {
    color: '#34C759',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 16,
  },
  infoList: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoGroup: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6C757D',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
    marginTop: 1,
  },
  infoValueSmall: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#495057',
    marginTop: 1,
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
  },
  deleteText: {
    color: '#DC3545',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#DC3545',
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
