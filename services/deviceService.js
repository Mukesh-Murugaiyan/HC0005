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
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId).catch(() => {});
        return deviceId;
      }

      // 2. Fallback to AsyncStorage if SecureStore was empty
      const asyncStoredId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (asyncStoredId) {
        deviceId = asyncStoredId;
        try {
          await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
        } catch (e) {
          console.warn('SecureStore restoration error:', e?.message);
        }
        return deviceId;
      }

      // 3. Generate a new persistent unique device ID if none exists
      deviceId = generateUUID();

      try {
        await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      } catch (e) {
        console.warn('SecureStore.setItemAsync error:', e?.message);
      }

      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId).catch(() => {});
      return deviceId;
    } catch (err) {
      console.error('Error getting unique device ID:', err);
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
   * Sweep and automatically expire any overdue 30-day device subscriptions at the database level.
   * Updates expired approved devices back to 'PENDING' without manual action.
   */
  async expireOverdueSubscriptions() {
    try {
      const { data, error } = await supabase.rpc('expire_overdue_device_subscriptions');
      if (error) {
        // Direct SQL fallback if RPC is not accessible
        const now = new Date().toISOString();
        await supabase
          .from('user_device_approvals')
          .update({
            status: 'PENDING',
            is_subscription_active: false,
            remarks: 'Subscription period (30 days) completed. Device status automatically reverted to Pending.',
            updated_at: now,
          })
          .eq('status', 'APPROVED')
          .not('subscription_expires_at', 'is', null)
          .lte('subscription_expires_at', now);
      }
      return data;
    } catch (err) {
      console.warn('expireOverdueSubscriptions error:', err?.message);
    }
  },

  /**
   * Check or create device approval record in the database for the given user.
   * Automatically validates subscription expiry and reverts to PENDING if 30-day period ended.
   */
  async checkOrRegisterDevice(userId, userRole = 'user') {
    if (!userId) {
      throw new Error('User ID is required to check device approval.');
    }

    // 1. Run automated expiration sweep before verifying status
    await this.expireOverdueSubscriptions().catch(() => {});

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
      // Check if subscription has expired (e.g. offline device reconnecting)
      if (existingRecord.status === 'APPROVED' && existingRecord.subscription_expires_at) {
        const isPast = new Date(existingRecord.subscription_expires_at).getTime() <= Date.now();
        if (isPast) {
          existingRecord.status = 'PENDING';
          existingRecord.is_subscription_active = false;
          try {
            await supabase
              .from('user_device_approvals')
              .update({
                status: 'PENDING',
                is_subscription_active: false,
                remarks: 'Subscription period (30 days) completed. Device status automatically reverted to Pending.',
                updated_at: now,
              })
              .eq('id', existingRecord.id);
          } catch (_e) {}
        }
      }

      // If user is admin and current status is not APPROVED, auto-approve admin device
      if (userRole === 'admin' && existingRecord.status !== 'APPROVED') {
        const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        const { data: updatedRecord, error: updateError } = await supabase
          .from('user_device_approvals')
          .update({
            status: 'APPROVED',
            approved_at: now,
            approved_by: userId,
            subscription_start_at: now,
            subscription_expires_at: expiry,
            subscription_days: 365,
            is_subscription_active: true,
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

      // Update metadata and last seen on existing record
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
    const subExpiry = initialStatus === 'APPROVED' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;

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
      subscription_start_at: initialStatus === 'APPROVED' ? now : null,
      subscription_expires_at: subExpiry,
      subscription_days: 30,
      is_subscription_active: initialStatus === 'APPROVED',
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

    await this.expireOverdueSubscriptions().catch(() => {});

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
   * Enrich raw approval record with computed online status, usage, and subscription details.
   */
  enrichApprovalRecord(item, todayStr = new Date().toISOString().split('T')[0]) {
    const isOnlineFlag = Boolean(item.is_online);
    const diffMs = item.last_seen_at ? Date.now() - new Date(item.last_seen_at).getTime() : Infinity;
    const computedIsOnline = isOnlineFlag && diffMs < 50000;

    const isToday = item.today_date === todayStr;
    const todaySeconds = isToday ? (item.today_usage_seconds || 0) : 0;

    // Subscription & Expiry calculations
    // Set the subscription start date to the exact date and time when the device was last updated to the Approved status.
    const subStartDate = item.approved_at || item.subscription_start_at;
    const subDays = item.subscription_days || 30;

    let expiresAtMs = null;
    let effectiveExpiresAt = item.subscription_expires_at;

    if (subStartDate) {
      const startTime = new Date(subStartDate).getTime();
      const calculatedExpiryMs = startTime + subDays * 24 * 60 * 60 * 1000;
      expiresAtMs = calculatedExpiryMs;
      effectiveExpiresAt = new Date(calculatedExpiryMs).toISOString();
    } else if (item.subscription_expires_at) {
      expiresAtMs = new Date(item.subscription_expires_at).getTime();
    }

    const nowMs = Date.now();
    const isExpired = expiresAtMs ? expiresAtMs <= nowMs : false;
    const msRemaining = expiresAtMs ? Math.max(0, expiresAtMs - nowMs) : null;
    const daysRemaining = msRemaining !== null ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) : null;

    let subscriptionStatus = 'NONE';
    let subscriptionBadgeText = 'No Subscription';
    if (item.status === 'APPROVED' && !isExpired) {
      subscriptionStatus = 'ACTIVE';
      if (daysRemaining === 0) {
        subscriptionBadgeText = 'Expires Today';
      } else if (daysRemaining === 1) {
        subscriptionBadgeText = '1 day left';
      } else if (daysRemaining > 1) {
        subscriptionBadgeText = `${daysRemaining} days left`;
      }
    } else if (isExpired || (effectiveExpiresAt && item.status === 'PENDING')) {
      subscriptionStatus = 'EXPIRED';
      subscriptionBadgeText = 'Expired';
    }

    const formattedSubscriptionPeriod = subStartDate && effectiveExpiresAt
      ? `${new Date(subStartDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} - ${new Date(effectiveExpiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
      : null;

    return {
      ...item,
      subscription_start_at: subStartDate || item.subscription_start_at,
      subscription_expires_at: effectiveExpiresAt || item.subscription_expires_at,
      computed_is_online: computedIsOnline,
      today_usage_seconds: todaySeconds,
      formatted_usage: this.formatUsageDuration(todaySeconds),
      formatted_today_usage: this.formatUsageDuration(todaySeconds),
      formatted_total_usage: this.formatUsageDuration(item.total_usage_seconds || 0),
      formatted_last_seen: this.formatLastSeen(item.last_seen_at, computedIsOnline),
      subscription_status: subscriptionStatus,
      subscription_badge_text: subscriptionBadgeText,
      subscription_days_remaining: daysRemaining,
      formatted_subscription_period: formattedSubscriptionPeriod,
      is_subscription_expired: isExpired,
    };
  },

  /**
   * Admin API: Fetch list of device approval requests with robust SQL filtering, pagination, and search.
   * Supports: ALL, ONLINE, OFFLINE, APPROVED, PENDING, EXPIRED, DENIED.
   */
  async fetchDeviceApprovals({ page = 1, limit = 10, searchQuery = '', statusFilter = 'ALL' } = {}) {
    // 1. Run automatic expiration sweep first so expired items reflect PENDING at database level
    await this.expireOverdueSubscriptions().catch(() => {});

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const nowIso = new Date().toISOString();
    const staleCutoffIso = new Date(Date.now() - 50000).toISOString();

    let query = supabase
      .from('user_device_approvals')
      .select('*, profiles:user_id(full_name, email, phone, role)', { count: 'exact' });

    // 2. Apply status filter at SQL level
    if (statusFilter === 'APPROVED') {
      // APPROVED and subscription is either not expired or unconstrained
      query = query
        .eq('status', 'APPROVED')
        .or(`subscription_expires_at.is.null,subscription_expires_at.gt.${nowIso}`);
    } else if (statusFilter === 'PENDING') {
      query = query.eq('status', 'PENDING');
    } else if (statusFilter === 'DENIED') {
      query = query.eq('status', 'DENIED');
    } else if (statusFilter === 'EXPIRED') {
      // Devices where subscription has ended
      query = query.not('subscription_expires_at', 'is', null).lte('subscription_expires_at', nowIso);
    } else if (statusFilter === 'ONLINE') {
      // Real-time online devices
      query = query
        .eq('is_online', true)
        .gte('last_seen_at', staleCutoffIso);
    } else if (statusFilter === 'OFFLINE') {
      // Real-time offline devices
      query = query.or(`is_online.eq.false,last_seen_at.lt.${staleCutoffIso},last_seen_at.is.null`);
    }

    // 3. Apply search query across device specs and user profile names
    if (searchQuery && searchQuery.trim() !== '') {
      const q = `%${searchQuery.trim()}%`;
      const cleanQ = searchQuery.trim().toLowerCase();

      // Find user IDs matching name/email/phone
      const { data: matchedProfiles } = await supabase
        .from('profiles')
        .select('id')
        .or(`full_name.ilike.%${cleanQ}%,email.ilike.%${cleanQ}%,phone.ilike.%${cleanQ}%`);

      const matchedUserIds = (matchedProfiles || []).map((p) => p.id);

      if (matchedUserIds.length > 0) {
        query = query.or(
          `device_name.ilike.${q},device_model.ilike.${q},device_id.ilike.${q},remarks.ilike.${q},user_id.in.(${matchedUserIds.join(',')})`
        );
      } else {
        query = query.or(`device_name.ilike.${q},device_model.ilike.${q},device_id.ilike.${q},remarks.ilike.${q}`);
      }
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) {
      console.error('fetchDeviceApprovals error:', error);
      throw error;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const enrichedItems = (data || []).map((item) => this.enrichApprovalRecord(item, todayStr));
    const total = count || 0;

    // Also fetch live global counts for the admin stats grid
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
   * Computes Total, Online, Offline, Approved, Pending, Expired, and Denied accurately.
   */
  async fetchDeviceCounts() {
    try {
      await this.expireOverdueSubscriptions().catch(() => {});

      const { data, error } = await supabase
        .from('user_device_approvals')
        .select('status, is_online, last_seen_at, subscription_expires_at');

      if (error || !data) {
        return { total: 0, online: 0, offline: 0, approved: 0, pending: 0, expired: 0, denied: 0 };
      }

      const now = Date.now();
      let total = data.length;
      let approved = 0;
      let pending = 0;
      let denied = 0;
      let online = 0;
      let offline = 0;
      let expired = 0;

      for (const item of data) {
        const isOnlineFlag = Boolean(item.is_online);
        const diffMs = item.last_seen_at ? now - new Date(item.last_seen_at).getTime() : Infinity;
        const isActuallyOnline = isOnlineFlag && diffMs < 50000;

        if (isActuallyOnline) online++;
        else offline++;

        const isSubExpired = item.subscription_expires_at && new Date(item.subscription_expires_at).getTime() <= now;
        if (isSubExpired) {
          expired++;
        }

        if (item.status === 'APPROVED') {
          if (!isSubExpired) approved++;
        } else if (item.status === 'PENDING') {
          pending++;
        } else if (item.status === 'DENIED') {
          denied++;
        }
      }

      return { total, online, offline, approved, pending, expired, denied };
    } catch (err) {
      console.warn('fetchDeviceCounts error:', err?.message);
      return { total: 0, online: 0, offline: 0, approved: 0, pending: 0, expired: 0, denied: 0 };
    }
  },

  /**
   * Admin API: Approve a pending, expired, or denied device.
   * Automatically starts a fresh 30-day subscription from the exact approval time.
   */
  async approveDevice(approvalId, adminUserId, remarks = '', subscriptionDays = 30) {
    const now = new Date();
    const nowIso = now.toISOString();
    const expiry = new Date(now.getTime() + subscriptionDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('user_device_approvals')
      .update({
        status: 'APPROVED',
        approved_at: nowIso,
        approved_by: adminUserId,
        denied_at: null,
        denied_by: null,
        subscription_start_at: nowIso,
        subscription_expires_at: expiry,
        subscription_days: subscriptionDays,
        is_subscription_active: true,
        remarks: remarks || `Approved by admin (${subscriptionDays}-day access)`,
        updated_at: nowIso,
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
        is_subscription_active: false,
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
   * Admin API: Update device approval status, remarks, and optional subscription duration.
   */
  async updateDeviceApprovalStatus(approvalId, status, remarks, adminUserId, subscriptionDays = 30) {
    const now = new Date();
    const nowIso = now.toISOString();
    const updates = {
      status,
      remarks,
      updated_at: nowIso,
    };

    if (status === 'APPROVED') {
      const expiry = new Date(now.getTime() + subscriptionDays * 24 * 60 * 60 * 1000).toISOString();
      updates.approved_at = nowIso;
      updates.approved_by = adminUserId;
      updates.denied_at = null;
      updates.denied_by = null;
      updates.subscription_start_at = nowIso;
      updates.subscription_expires_at = expiry;
      updates.subscription_days = subscriptionDays;
      updates.is_subscription_active = true;
    } else if (status === 'DENIED') {
      updates.denied_at = nowIso;
      updates.denied_by = adminUserId;
      updates.is_subscription_active = false;
    } else if (status === 'PENDING') {
      updates.is_subscription_active = false;
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
   * Admin API: Permanently delete a device approval record and its activity sessions.
   */
  async deleteDevice(approvalId) {
    if (!approvalId) {
      throw new Error('Approval ID is required to delete device.');
    }

    // Fetch the record first to clean up related activity sessions
    const { data: record } = await supabase
      .from('user_device_approvals')
      .select('user_id, device_id')
      .eq('id', approvalId)
      .maybeSingle();

    if (record?.user_id && record?.device_id) {
      try {
        await supabase
          .from('device_activity_sessions')
          .delete()
          .eq('user_id', record.user_id)
          .eq('device_id', record.device_id);
      } catch (_e) {
        // Silently ignore session cleanup failures
      }
    }

    const { error } = await supabase
      .from('user_device_approvals')
      .delete()
      .eq('id', approvalId);

    if (error) {
      console.error('deleteDevice error:', error);
      throw error;
    }

    return { success: true, id: approvalId };
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

    const isToday =
      seenDate.getDate() === now.getDate() &&
      seenDate.getMonth() === now.getMonth() &&
      seenDate.getFullYear() === now.getFullYear();

    const timeStr = seenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `Last seen today at ${timeStr}`;
    }

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
   * Fetch all devices used by a specific user with online status, usage duration, and subscription info.
   */
  async fetchUserDevices(userId) {
    if (!userId) return [];

    await this.expireOverdueSubscriptions().catch(() => {});

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
    return (data || []).map((item) => this.enrichApprovalRecord(item, todayStr));
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
