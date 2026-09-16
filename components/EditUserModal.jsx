import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function EditUserModal({ visible, user, onClose, onSave }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setRole(user.role || 'user');
    }
  }, [user]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full Name cannot be empty.');
      return;
    }

    setLoading(true);
    try {
      await onSave(user.id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        role,
      });
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update user.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit User</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
          </View>

          <Text style={styles.userEmailText}>{user.email}</Text>

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
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              placeholderTextColor="#ADB5BD"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Role</Text>
            <View style={styles.rolePickerRow}>
              <TouchableOpacity
                style={[
                  styles.roleOption,
                  role === 'user' && styles.roleOptionActive,
                ]}
                onPress={() => setRole('user')}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    role === 'user' && styles.roleOptionTextActive,
                  ]}
                >
                  User
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleOption,
                  role === 'admin' && styles.roleOptionActiveAdmin,
                ]}
                onPress={() => setRole('admin')}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    role === 'admin' && styles.roleOptionTextActiveAdmin,
                  ]}
                >
                  Admin
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.saveBtn]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
  },
  userEmailText: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 16,
    marginTop: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
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
    marginTop: 10,
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
