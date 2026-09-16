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
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deviceService } from '../services/deviceService';
import { useAuth } from '../context/AuthContext';

export default function EditDeviceApprovalModal({ visible, approval, onClose, onSaved }) {
  const { user: currentUser } = useAuth();
  const [status, setStatus] = useState('APPROVED');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (approval) {
      setStatus(approval.status || 'PENDING');
      setRemarks(approval.remarks || '');
    }
  }, [approval]);

  if (!approval) return null;

  const profile = approval.profiles || {};

  const handleSave = async () => {
    setSaving(true);
    try {
      await deviceService.updateDeviceApprovalStatus(
        approval.id,
        status,
        remarks.trim(),
        currentUser?.id
      );
      Alert.alert('Success', `Device status updated to ${status}.`);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update device status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Edit Device Approval</Text>
              <Text style={styles.headerSubtitle}>
                Manage access permission for this physical device
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* User & Device Overview Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>User Name:</Text>
                <Text style={styles.infoValue}>{profile.full_name || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{profile.email || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Device Name:</Text>
                <Text style={styles.infoValue}>{approval.device_name || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Model / OS:</Text>
                <Text style={styles.infoValue}>
                  {approval.device_model} ({approval.os_version})
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Device ID:</Text>
                <Text style={styles.idText} numberOfLines={1} ellipsizeMode="middle">
                  {approval.device_id}
                </Text>
              </View>
            </View>

            {/* Status Selection Buttons */}
            <Text style={styles.sectionLabel}>Approval Status</Text>
            <View style={styles.statusOptionsContainer}>
              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === 'APPROVED' && styles.statusOptionApproved,
                ]}
                onPress={() => setStatus('APPROVED')}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={status === 'APPROVED' ? '#FFFFFF' : '#10B981'}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    status === 'APPROVED' && styles.statusOptionTextSelected,
                  ]}
                >
                  APPROVED
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === 'PENDING' && styles.statusOptionPending,
                ]}
                onPress={() => setStatus('PENDING')}
              >
                <Ionicons
                  name="time"
                  size={20}
                  color={status === 'PENDING' ? '#FFFFFF' : '#F59E0B'}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    status === 'PENDING' && styles.statusOptionTextSelected,
                  ]}
                >
                  PENDING
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusOption,
                  status === 'DENIED' && styles.statusOptionDenied,
                ]}
                onPress={() => setStatus('DENIED')}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={status === 'DENIED' ? '#FFFFFF' : '#EF4444'}
                />
                <Text
                  style={[
                    styles.statusOptionText,
                    status === 'DENIED' && styles.statusOptionTextSelected,
                  ]}
                >
                  DENIED
                </Text>
              </TouchableOpacity>
            </View>

            {/* Remarks / Reasons Input */}
            <Text style={styles.sectionLabel}>Remarks / Denial Reason</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Add optional approval remarks or denial reason..."
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={3}
              placeholderTextColor="#ADB5BD"
              textAlignVertical="top"
            />
          </ScrollView>

          {/* Modal Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#212529',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#6C757D',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#212529',
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  idText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#495057',
    maxWidth: '55%',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#343A40',
    marginBottom: 10,
  },
  statusOptionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F3F5',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  statusOptionApproved: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  statusOptionPending: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  statusOptionDenied: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#495057',
  },
  statusOptionTextSelected: {
    color: '#FFFFFF',
  },
  textArea: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#212529',
    minHeight: 80,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F3F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#495057',
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
