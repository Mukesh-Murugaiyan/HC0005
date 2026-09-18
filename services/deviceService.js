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
      // If user is admin and current status is not APPROVED, auto-approve admin device
      if (userRole === 'admin' && existingRecord.status !== 'APPROVED') {
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
            last_seen_at: now,
            last_active_at: now,
            is_online: true,
            updated_at: now,
          })
          .eq('id', existingRecord.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return updatedRecord;
      }

      // Update metadata and last seen on existing record (vital for old builds connecting)
      try {
        await supabase
          .from('user_device_approvals')
          .update({
            device_name: metadata.deviceName,
            device_model: metadata.deviceModel,
            os_version: metadata.osVersion,
            app_version: metadata.appVersion,
            last_seen_at: now,
            last_active_at: now,
            is_online: true,
            updated_at: now,
          })
          .eq('id', existingRecord.id);
      } catch (err) {
        // Silently ignore background metadata update errors
      }

      return {
        ...existingRecord,
        last_seen_at: now,
        is_online: true,
      };
    }

    // No record exists -> Create a new record
    const initialStatus = userRole === 'admin' ? 'APPROVED' : 'PENDING';
    const todayStr = now.split('T')[0];

    const newRecordPayload = {
      user_id: userId,
      device_id: metadata.deviceId,
      device_name: metadata.deviceName,
      device_model: metadata.deviceModel,
      platform: metadata.platform,
      os_version: metadata.osVersion,
      app_version: metadata.appVersion,
      status: initialStatus,
      is_online: true,
      last_seen_at: now,
      last_active_at: now,
      total_usage_seconds: 0,
      today_usage_seconds: 0,
      today_date: todayStr,
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

    const todayStr = new Date().toISOString().split('T')[0];

    // Calculate real-time online status and format metrics for all records
    const enrichApprovalRecord = (item) => {
      const isOnlineFlag = Boolean(item.is_online);
      const diffMs = item.last_seen_at ? Date.now() - new Date(item.last_seen_at).getTime() : Infinity;
      // Stale cutoff is 50 seconds (2.5x heartbeat interval)
      const computedIsOnline = isOnlineFlag && diffMs < 50000;

      const isToday = item.today_date === todayStr;
      const todaySeconds = isToday ? (item.today_usage_seconds || 0) : 0;

      return {
        ...item,
        computed_is_online: computedIsOnline,
        today_usage_seconds: todaySeconds,
        formatted_usage: this.formatUsageDuration(todaySeconds),
        formatted_today_usage: this.formatUsageDuration(todaySeconds),
        formatted_total_usage: this.formatUsageDuration(item.total_usage_seconds || 0),
        formatted_last_seen: this.formatLastSeen(item.last_seen_at, computedIsOnline),
      };
    };

    let enrichedItems = finalItems.map(enrichApprovalRecord);

    // Apply Online/Offline status filter if requested
    if (statusFilter === 'ONLINE') {
      enrichedItems = enrichedItems.filter((item) => item.computed_is_online);
      total = enrichedItems.length;
    } else if (statusFilter === 'OFFLINE') {
      enrichedItems = enrichedItems.filter((item) => !item.computed_is_online);
      total = enrichedItems.length;
    }

    const counts = await this.fetchDeviceCounts();

    return {
      approvals: enrichedItems,
      totalCount: total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      counts,
    };
  },

  /**
   * Admin API: Fetch exact overall device counts (independent of current page/filter).
   */
  async fetchDeviceCounts() {
    try {
      const { data, error } = await supabase
        .from('user_device_approvals')
        .select('status, is_online, last_seen_at');

      if (error || !data) {
        return { total: 0, online: 0, approved: 0, pending: 0, denied: 0 };
      }

      const now = Date.now();
      let total = data.length;
      let approved = 0;
      let pending = 0;
      let denied = 0;
      let online = 0;

      for (const item of data) {
        if (item.status === 'APPROVED') approved++;
        else if (item.status === 'PENDING') pending++;
        else if (item.status === 'DENIED') denied++;

        const isOnlineFlag = Boolean(item.is_online);
        const diffMs = item.last_seen_at ? now - new Date(item.last_seen_at).getTime() : Infinity;
        if (isOnlineFlag && diffMs < 50000) {
          online++;
        }
      }

      return { total, online, approved, pending, denied };
    } catch (err) {
      console.warn('fetchDeviceCounts error:', err?.message);
      return { total: 0, online: 0, approved: 0, pending: 0, denied: 0 };
    }
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
   * Format seconds into human-readable duration (e.g., '2h 15m', '45s').
   */
  formatUsageDuration(totalSeconds = 0) {
    const s = Math.max(0, Math.floor(totalSeconds));
    if (s < 60) {
      return `${s}s`;
    }
    const minutes = Math.floor(s / 60);
    if (minutes < 60) {
      const remainingSecs = s % 60;
      return remainingSecs > 0 ? `${minutes}m ${remainingSecs}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (hours < 24) {
      return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  },

  /**
   * Format last seen timestamp into WhatsApp-style human readable string.
   */
  formatLastSeen(lastSeenAt, isOnline) {
    if (isOnline) {
      return 'Online';
    }
    if (!lastSeenAt) {
      return 'Offline (Never seen)';
    }

    const seenDate = new Date(lastSeenAt);
    const now = new Date();
    const diffMs = now.getTime() - seenDate.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) {
      return 'Last seen just now';
    }
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) {
      return `Last seen ${diffMins}m ago`;
    }

    // Check if seen today
    const isToday =
      seenDate.getDate() === now.getDate() &&
      seenDate.getMonth() === now.getMonth() &&
      seenDate.getFullYear() === now.getFullYear();

    const timeStr = seenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `Last seen today at ${timeStr}`;
    }

    // Check if seen yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      seenDate.getDate() === yesterday.getDate() &&
      seenDate.getMonth() === yesterday.getMonth() &&
      seenDate.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Last seen yesterday at ${timeStr}`;
    }

    const dateStr = seenDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `Last seen ${dateStr} at ${timeStr}`;
  },

  /**
   * Fetch all devices used by a specific user with online status and usage duration.
   */
  async fetchUserDevices(userId) {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('user_device_approvals')
      .select('*')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false });

    if (error) {
      console.warn('fetchUserDevices error:', error?.message);
      return [];
    }

    const todayStr = new Date().toISOString().split('T')[0];

    return (data || []).map((item) => {
      const isOnlineFlag = Boolean(item.is_online);
      const diffMs = item.last_seen_at ? Date.now() - new Date(item.last_seen_at).getTime() : Infinity;
      const computedIsOnline = isOnlineFlag && diffMs < 50000;

      const isToday = item.today_date === todayStr;
      const todaySeconds = isToday ? (item.today_usage_seconds || 0) : 0;

      return {
        ...item,
        computed_is_online: computedIsOnline,
        today_usage_seconds: todaySeconds,
        formatted_usage: this.formatUsageDuration(todaySeconds),
        formatted_today_usage: this.formatUsageDuration(todaySeconds),
        formatted_total_usage: this.formatUsageDuration(item.total_usage_seconds || 0),
        formatted_last_seen: this.formatLastSeen(item.last_seen_at, computedIsOnline),
      };
    });
  },

  /**
   * Fetch historical activity sessions for a user and device.
   */
  async fetchDeviceSessions(userId, deviceId, limit = 20) {
    if (!userId || !deviceId) return [];

    const { data, error } = await supabase
      .from('device_activity_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .order('session_start', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('fetchDeviceSessions error:', error?.message);
      return [];
    }

    return (data || []).map((sess) => ({
      ...sess,
      formatted_duration: this.formatUsageDuration(sess.duration_seconds || 0),
    }));
  },
};

