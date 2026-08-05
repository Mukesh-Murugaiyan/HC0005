import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

export default function AdminVerifyModal({ visible, onClose }) {
  const { user, profile, role } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerifyAdmin = async () => {
    if (!password) {
      Alert.alert('Validation Error', 'Please enter your password.');
      return;
    }

    setLoading(true);
    let authRes = null;

    try {
      // Re-authenticate password against profiles table
      authRes = await authService.login(user?.email, password);
    } catch (_err) {
      setLoading(false);
      Alert.alert('Access Denied', 'Wrong password');
      return;
    }

    const currentRole = authRes?.user?.role || profile?.role || role;
    if (currentRole !== 'admin') {
      setLoading(false);
      Alert.alert('Access Denied', 'You are not admin');
      return;
    }

    // Success: Reset password field, close modal, and navigate to Admin Screen
    setPassword('');
    onClose();
    setLoading(false);
    router.push('/admin');
  };

  if (!user) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.titleRow}>
              <Ionicons name="shield-checkmark" size={22} color="#007AFF" />
              <Text style={styles.modalTitle}>Admin Security Check</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setPassword('');
                onClose();
              }}
              disabled={loading}
            >
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
          </View>

          <Text style={styles.descriptionText}>
            Please enter your password to confirm admin access.
          </Text>

          <View style={styles.emailBox}>
            <Text style={styles.emailLabel}>Logged in as:</Text>
            <Text style={styles.emailValue}>{user.email}</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWithIcon}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                secureTextEntry={!showPassword}
                placeholderTextColor="#ADB5BD"
                autoCapitalize="none"
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

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={() => {
                setPassword('');
                onClose();
              }}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.submitBtn, loading && styles.disabledBtn]}
              onPress={handleVerifyAdmin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Verify & Access</Text>
              )}
            </TouchableOpacity>
          </View>
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
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
  },
  descriptionText: {
    fontSize: 13,
    color: '#6C757D',
    marginBottom: 14,
  },
  emailBox: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  emailLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 2,
  },
  emailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212529',
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 6,
  },
  inputWithIcon: {
    position: 'relative',
    justifyContent: 'center',
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
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
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
  submitBtn: {
    backgroundColor: '#007AFF',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
