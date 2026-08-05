import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';

export default function ProfileScreen() {
  const { user, profile, logout, refreshProfile, isOffline } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saveLoading, setSaveLoading] = useState(false);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full name cannot be empty.');
      return;
    }

    setSaveLoading(true);
    try {
      await authService.updateProfile(user.id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      await refreshProfile();
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    setPassLoading(true);
    try {
      await authService.changeOwnPassword(user.id, newPassword);
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Your password has been changed successfully.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to change password.');
    } finally {
      setPassLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="wifi-outline" size={16} color="#856404" />
          <Text style={styles.offlineText}>
            You are offline. Profile changes will sync when online.
          </Text>
        </View>
      )}

      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{profile?.full_name || 'User Profile'}</Text>
        <Text style={styles.userEmail}>{profile?.email || user?.email}</Text>

        <View style={styles.roleTag}>
          <Text style={styles.roleTagText}>
            {(profile?.role || 'user').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          {!isEditing ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                setFullName(profile?.full_name || '');
                setPhone(profile?.phone || '');
                setIsEditing(true);
              }}
            >
              <Ionicons name="create-outline" size={18} color="#007AFF" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isEditing ? (
          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color="#6C757D" />
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{profile?.full_name || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color="#6C757D" />
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{profile?.email || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#6C757D" />
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{profile?.phone || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color="#6C757D" />
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.editForm}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter full name"
                placeholderTextColor="#ADB5BD"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                placeholderTextColor="#ADB5BD"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saveLoading && styles.disabledBtn]}
              onPress={handleSaveProfile}
              disabled={saveLoading}
            >
              {saveLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {(profile?.role === 'admin' || user?.role === 'admin') && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Security</Text>

          <TouchableOpacity
            style={styles.securityOption}
            onPress={() => setShowPasswordModal(!showPasswordModal)}
          >
            <View style={styles.securityLeft}>
              <Ionicons name="key-outline" size={20} color="#FF9500" />
              <Text style={styles.securityText}>Change Password</Text>
            </View>
            <Ionicons
              name={showPasswordModal ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#6C757D"
            />
          </TouchableOpacity>

          {showPasswordModal && (
            <View style={styles.passwordForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password (min 6 chars)"
                  secureTextEntry
                  placeholderTextColor="#ADB5BD"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry
                  placeholderTextColor="#ADB5BD"
                />
              </View>

              <TouchableOpacity
                style={[styles.updatePassBtn, passLoading && styles.disabledBtn]}
                onPress={handleChangePassword}
                disabled={passLoading}
              >
                {passLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.updatePassBtnText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#DC3545" />
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  offlineText: {
    fontSize: 13,
    color: '#856404',
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
    backgroundColor: '#E9ECEF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#212529',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  cancelText: {
    fontSize: 14,
    color: '#6C757D',
  },
  infoList: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoTextGroup: {
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
  editForm: {
    gap: 14,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#212529',
    backgroundColor: '#F8F9FA',
  },
  saveBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  securityOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  securityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  securityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
  },
  passwordForm: {
    marginTop: 14,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingTop: 14,
  },
  updatePassBtn: {
    backgroundColor: '#FF9500',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  updatePassBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC354515',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  logoutBtnText: {
    color: '#DC3545',
    fontSize: 16,
    fontWeight: '700',
  },
});
