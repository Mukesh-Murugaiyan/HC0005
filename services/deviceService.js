import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'HC0005_PERSISTENT_DEVICE_ID';

/**
 * Generate a random UUID string compliant with RFC 4122 v4
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if crypto.randomUUID fails
    }
  }
  return 'dev-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const deviceService = {
  /**
   * Retrieve or generate a persistent unique device ID.
   * Priority: SecureStore (Keychain/Keystore) -> AsyncStorage -> Generate new & persist in both.
   */
  async getUniqueDeviceId() {
    try {
      // 1. Try reading from SecureStore (KeyChain on iOS, KeyStore on Android)
      let deviceId = null;
      try {
        deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      } catch (err) {
        console.warn('SecureStore.getItemAsync error:', err?.message);
      }

      if (deviceId) {
        // Synchronize with AsyncStorage just in case
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId).catch(() => { });
        return deviceId;
      }

      // 2. Fallback to AsyncStorage if SecureStore was empty
      const asyncStoredId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (asyncStoredId) {
        deviceId = asyncStoredId;
        // Restore into SecureStore
        try {
          await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
        } catch (e) {
          console.warn('SecureStore restoration error:', e?.message);
        }
        return deviceId;
      }

      // 3. Generate a new persistent unique device ID if none exists
      deviceId = generateUUID();

      // Persist to SecureStore
      try {
        await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      } catch (e) {
        console.warn('SecureStore.setItemAsync error:', e?.message);
      }

      // Backup persist to AsyncStorage
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId).catch(() => { });

      return deviceId;
    } catch (err) {
      console.error('Error getting unique device ID:', err);
      // Emergency fallback random ID
      return 'dev-fallback-' + Date.now().toString(36);
    }
  },

  /**
   * Gather physical device specifications and application metadata.
   */
  async getDeviceMetadata() {
    const deviceId = await this.getUniqueDeviceId();

    const deviceName =
      Device.deviceName ||
      (Device.modelName ? `${Device.brand || ''} ${Device.modelName}`.trim() : null) ||
      `${Platform.OS.toUpperCase()} Device`;

    const deviceModel =
      Device.modelName ||
      Device.designName ||
      Device.productName ||
      `${Platform.OS} ${Platform.Version}`;

    const osVersion = `${Platform.OS.toUpperCase()} ${Device.osVersion || Platform.Version || ''}`.trim();

    const appVersion =
      Constants.expoConfig?.version ||
      Constants.manifest?.version ||
      '2.0.0';

    return {
      deviceId,
      deviceName,
      deviceModel,
      platform: Platform.OS,
      osVersion,
      appVersion,
    };
  },

  /**
   * Check or create device approval record in the database for the given user.
   * If role is 'admin', automatically approve the device so admin is never locked out.
   */
  async checkOrRegisterDevice(userId, userRole = 'user') {
    if (!userId) {
      throw new Error('User ID is required to check device approval.');
    }

    const metadata = await this.getDeviceMetadata();

    // Query database for existing (user_id, device_id) record
    const { data: existingRecord, error: selectError } = await supabase
      .from('user_device_approvals')
      .select('*')
      .eq('user_id', userId)
      .eq('device_id', metadata.deviceId)
      .maybeSingle();

    if (selectError) {
      console.error('Error fetching device approval record:', selectError);
      throw selectError;
    }

    const now = new Date().toISOString();

    if (existingRecord) {
      // If user is admin and current status is PENDING, auto-approve admin device
      if (userRole === 'admin' && existingRecord.status === 'PENDING') {
        const { data: updatedRecord, error: updateError } = await supabase
          .from('user_device_approvals')
          .update({
            status: 'APPROVED',
            approved_at: now,
            approved_by: userId,
            device_name: metadata.deviceName,
            device_model: metadata.deviceModel,
            os_version: metadata.osVersion,
            app_version: metadata.appVersion,
            updated_at: now,
          })
          .eq('id', existingRecord.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return updatedRecord;
      }

      // Update metadata on existing record if needed
      try {
        await supabase
          .from('user_device_approvals')
          .update({
            device_name: metadata.deviceName,
            device_model: metadata.deviceModel,
            os_version: metadata.osVersion,
            app_version: metadata.appVersion,
            updated_at: now,
          })
          .eq('id', existingRecord.id);
      } catch (err) {
        // Silently ignore background metadata update errors
      }

      return existingRecord;
    }

    // No record exists -> Create a new record
    const initialStatus = userRole === 'admin' ? 'APPROVED' : 'PENDING';

    const newRecordPayload = {
      user_id: userId,
      device_id: metadata.deviceId,
      device_name: metadata.deviceName,
      device_model: metadata.deviceModel,
      platform: metadata.platform,
      os_version: metadata.osVersion,
      app_version: metadata.appVersion,
      status: initialStatus,
      created_at: now,
      updated_at: now,
      approved_at: initialStatus === 'APPROVED' ? now : null,
      approved_by: initialStatus === 'APPROVED' ? userId : null,
      remarks: userRole === 'admin' ? 'Auto-approved admin device' : '',
    };

    const { data: createdRecord, error: insertError } = await supabase
      .from('user_device_approvals')
      .insert([newRecordPayload])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting new device approval record:', insertError);
      throw insertError;
    }

    return createdRecord;
  },

  /**
   * Fetch current approval status for a user + device pair.
   */
  async getDeviceApprovalStatus(userId, deviceId) {
    if (!userId || !deviceId) return null;

    const { data, error } = await supabase
      .from('user_device_approvals')
      .select('*')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      console.warn('getDeviceApprovalStatus error:', error.message);
      return null;
    }

    return data;
  },

  /**
   * Admin API: Fetch list of device approval requests with pagination, search, and status filter.
   */
  async fetchDeviceApprovals({ page = 1, limit = 10, searchQuery = '', statusFilter = 'ALL' } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('user_device_approvals')
      .select('*, profiles:user_id(full_name, email, phone, role)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter);
    }

    if (searchQuery && searchQuery.trim() !== '') {
      const q = `%${searchQuery.trim()}%`;
      query = query.or(`device_name.ilike.${q},device_model.ilike.${q},device_id.ilike.${q},remarks.ilike.${q}`);
    }

    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) {
      console.error('fetchDeviceApprovals error:', error);
      throw error;
    }

    // Filter by user profile details if search query matches user name/email/phone
    let finalItems = data || [];
    let total = count || 0;

    // If searchQuery provided and profile matching needed
    if (searchQuery && searchQuery.trim() !== '') {
      const cleanQ = searchQuery.trim().toLowerCase();
      // Also query profiles directly to find matching user IDs
      const { data: matchedProfiles } = await supabase
        .from('profiles')
        .select('id')
        .or(`full_name.ilike.%${cleanQ}%,email.ilike.%${cleanQ}%,phone.ilike.%${cleanQ}%`);

      if (matchedProfiles && matchedProfiles.length > 0) {
        const matchedUserIds = matchedProfiles.map((p) => p.id);
        // Query approvals for these user IDs as well
        let userApprovalsQuery = supabase
          .from('user_device_approvals')
          .select('*, profiles:user_id(full_name, email, phone, role)', { count: 'exact' })
          .in('user_id', matchedUserIds)
          .order('created_at', { ascending: false });

        if (statusFilter && statusFilter !== 'ALL') {
          userApprovalsQuery = userApprovalsQuery.eq('status', statusFilter);
        }

        const { data: userApprovalData } = await userApprovalsQuery;

        if (userApprovalData && userApprovalData.length > 0) {
          const existingIds = new Set(finalItems.map((item) => item.id));
          userApprovalData.forEach((item) => {
            if (!existingIds.has(item.id)) {
              finalItems.push(item);
            }
          });
          total = finalItems.length;
        }
      }
    }

    return {
      approvals: finalItems,
      totalCount: total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  /**
   * Admin API: Approve a pending or denied device.
   */
  async approveDevice(approvalId, adminUserId, remarks = '') {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_device_approvals')
      .update({
        status: 'APPROVED',
        approved_at: now,
        approved_by: adminUserId,
        denied_at: null,
        denied_by: null,
        remarks: remarks || 'Approved by admin',
        updated_at: now,
      })
      .eq('id', approvalId)
      .select('*, profiles:user_id(full_name, email, phone, role)')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Admin API: Deny a device approval request.
   */
  async denyDevice(approvalId, adminUserId, remarks = '') {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_device_approvals')
      .update({
        status: 'DENIED',
        denied_at: now,
        denied_by: adminUserId,
        remarks: remarks || 'Access denied by admin',
        updated_at: now,
      })
      .eq('id', approvalId)
      .select('*, profiles:user_id(full_name, email, phone, role)')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Admin API: Update device approval status & remarks.
   */
  async updateDeviceApprovalStatus(approvalId, status, remarks, adminUserId) {
    const now = new Date().toISOString();
    const updates = {
      status,
      remarks,
      updated_at: now,
    };

    if (status === 'APPROVED') {
      updates.approved_at = now;
      updates.approved_by = adminUserId;
      updates.denied_at = null;
      updates.denied_by = null;
    } else if (status === 'DENIED') {
      updates.denied_at = now;
      updates.denied_by = adminUserId;
    }

    const { data, error } = await supabase
      .from('user_device_approvals')
      .update(updates)
      .eq('id', approvalId)
      .select('*, profiles:user_id(full_name, email, phone, role)')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Admin API: Delete device approval record.
   */
  async deleteDeviceApproval(approvalId) {
    const { data, error } = await supabase
      .from('user_device_approvals')
      .delete()
      .eq('id', approvalId);

    if (error) throw error;
    return data;
  },
};
