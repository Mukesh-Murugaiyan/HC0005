import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { adminService } from '../services/adminService';

export default function CreateUserModal({ visible, onClose, onUserCreated }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setRole('user');
    setShowPassword(false);
  };

  const handleCreateUser = async () => {
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!fullName.trim() || !trimmedEmail || !password) {
      Alert.alert('Validation Error', 'Full Name, Email, and Password are required.');
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await adminService.adminCreateUser(
        fullName.trim(),
        email.trim(),
        phone.trim(),
        password,
        role
      );
      resetForm();
      onClose();
      if (onUserCreated) onUserCreated();
      Alert.alert('Success', 'New user account created successfully.');
    } catch (err) {
      console.log("err.message-------", err.message);

      Alert.alert('Error', err.message || 'Failed to create user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Register New User</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                onClose();
              }}
              disabled={loading}
            >
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                placeholderTextColor="#ADB5BD"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="user@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#ADB5BD"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 234 567 890"
                keyboardType="phone-pad"
                placeholderTextColor="#ADB5BD"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Assign Role</Text>
              <View style={styles.rolePickerRow}>
                <TouchableOpacity
                  style={[styles.roleOption, role === 'user' && styles.roleOptionActive]}
                  onPress={() => setRole('user')}
                >
                  <Text style={[styles.roleOptionText, role === 'user' && styles.roleOptionTextActive]}>
                    User
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleOption, role === 'admin' && styles.roleOptionActiveAdmin]}
                  onPress={() => setRole('admin')}
                >
                  <Text style={[styles.roleOptionText, role === 'admin' && styles.roleOptionTextActiveAdmin]}>
                    Admin
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Initial Password *</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min 6 characters"
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#ADB5BD"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#6C757D"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                secureTextEntry={!showPassword}
                placeholderTextColor="#ADB5BD"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={() => {
                  resetForm();
                  onClose();
                }}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.saveBtn]}
                onPress={handleCreateUser}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Register User</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
  },
  formScroll: {
    paddingBottom: 10,
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 6,
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
  inputWithIcon: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  roleOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF15',
  },
  roleOptionActiveAdmin: {
    borderColor: '#FF3B30',
    backgroundColor: '#FF3B3015',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C757D',
  },
  roleOptionTextActive: {
    color: '#007AFF',
  },
  roleOptionTextActiveAdmin: {
    color: '#FF3B30',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#E9ECEF',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#495057',
  },
  saveBtn: {
    backgroundColor: '#007AFF',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
