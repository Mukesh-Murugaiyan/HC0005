import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { deviceService } from './deviceService';

const PENDING_DURATION_KEY = 'HC0005_PENDING_USAGE_DELTA';
const HEARTBEAT_INTERVAL_MS = 20 * 1000; // 20 seconds

/**
 * Generate a standard UUID v4 string for session IDs.
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (_e) {
      // Fallback
    }
  }
  return 'sess-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class DeviceActivityService {
  constructor() {
    this.userId = null;
    this.deviceId = null;
    this.sessionId = null;
    this.sessionStartTime = null;
    this.lastTickTime = null;
    this.heartbeatTimer = null;
    this.isTracking = false;
    this.isOnline = false;
    this.isNetworkConnected = true;

    this.appStateSubscription = null;
    this.netInfoSubscription = null;

    // Serial Promise Queue to prevent race conditions on rapid state toggles
    this.queue = Promise.resolve();
  }

  /**
   * Enqueue an async task to execute sequentially, preventing out-of-order writes.
   */
  enqueue(task) {
    this.queue = this.queue
      .then(() => task())
      .catch((err) => {
        console.warn('DeviceActivityService queue error:', err?.message || err);
      });
    return this.queue;
  }

  /**
   * Start device activity and heartbeat tracking for the authenticated user.
   * Called on app launch, auth initialize, or login.
   */
  async startTracking(userId) {
    if (!userId) return;

    // If already tracking same user, verify timer is running
    if (this.isTracking && this.userId === userId) {
      if (!this.heartbeatTimer && AppState.currentState === 'active') {
        this.startHeartbeatLoop();
      }
      return;
    }

    this.userId = userId;
    this.deviceId = await deviceService.getUniqueDeviceId();
    this.isTracking = true;

    // Setup network state listener
    if (!this.netInfoSubscription) {
      this.netInfoSubscription = NetInfo.addEventListener((state) => {
        const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
        this.handleNetworkChange(connected);
      });
    }

    // Setup AppState lifecycle listener
    if (!this.appStateSubscription) {
      this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        this.handleAppStateChange(nextAppState);
      });
    }

    // Initial check of network
    const netState = await NetInfo.fetch();
    this.isNetworkConnected = Boolean(netState.isConnected && netState.isInternetReachable !== false);

    // If app is currently active in foreground, immediately send ONLINE heartbeat
    if (AppState.currentState === 'active') {
      this.startNewSession();
      this.startHeartbeatLoop();
      this.enqueue(() => this.sendHeartbeat(true, 0));
    }
  }

  /**
   * Stop device activity tracking cleanly (e.g., on logout).
   */
  async stopTracking() {
    this.stopHeartbeatLoop();

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.netInfoSubscription) {
      this.netInfoSubscription();
      this.netInfoSubscription = null;
    }

    if (this.isTracking && this.userId && this.deviceId) {
      const deltaSeconds = this.calculateDeltaSeconds();
      await this.enqueue(() => this.sendHeartbeat(false, deltaSeconds));
    }

    this.userId = null;
    this.deviceId = null;
    this.sessionId = null;
    this.sessionStartTime = null;
    this.lastTickTime = null;
    this.isTracking = false;
    this.isOnline = false;
  }

  /**
   * Start a new user session upon entering foreground.
   */
  startNewSession() {
    this.sessionId = generateUUID();
    const now = Date.now();
    this.sessionStartTime = now;
    this.lastTickTime = now;
  }

  /**
   * Calculate elapsed active seconds since last heartbeat tick.
   */
  calculateDeltaSeconds() {
    if (!this.lastTickTime) return 0;
    const now = Date.now();
    const deltaMs = now - this.lastTickTime;
    this.lastTickTime = now;
    return Math.max(0, Math.round(deltaMs / 1000));
  }

  /**
   * Start the periodic 20-second heartbeat loop while app is in foreground.
   */
  startHeartbeatLoop() {
    this.stopHeartbeatLoop();
    this.heartbeatTimer = setInterval(() => {
      if (AppState.currentState === 'active' && this.isNetworkConnected) {
        const deltaSeconds = this.calculateDeltaSeconds();
        this.enqueue(() => this.sendHeartbeat(true, deltaSeconds));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop the periodic heartbeat loop.
   */
  stopHeartbeatLoop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handle AppState lifecycle transitions (WhatsApp-like behavior).
   */
  handleAppStateChange(nextAppState) {
    if (!this.isTracking || !this.userId) return;

    if (nextAppState === 'active') {
      // Transitioned to FOREGROUND -> Mark Online immediately
      this.startNewSession();
      this.startHeartbeatLoop();
      this.enqueue(() => this.sendHeartbeat(true, 0));
    } else if (nextAppState.match(/inactive|background/)) {
      // Transitioned to BACKGROUND / INACTIVE -> Mark Offline immediately
      this.stopHeartbeatLoop();
      const deltaSeconds = this.calculateDeltaSeconds();
      this.enqueue(() => this.sendHeartbeat(false, deltaSeconds));
    }
  }

  /**
   * Handle Network connectivity changes.
   */
  handleNetworkChange(connected) {
    const wasConnected = this.isNetworkConnected;
    this.isNetworkConnected = connected;

    if (!connected && wasConnected) {
      // Network lost -> Pause heartbeat
      this.stopHeartbeatLoop();
      this.isOnline = false;
    } else if (connected && !wasConnected) {
      // Network restored -> Resume heartbeat & sync state
      if (AppState.currentState === 'active' && this.isTracking) {
        this.startHeartbeatLoop();
        this.enqueue(() => this.sendHeartbeat(true, 0));
      }
    }
  }

  /**
   * Send heartbeat to database using atomic stored procedure with graceful fallback.
   *
   * @param {boolean} isOnline - Target online status
   * @param {number} deltaSeconds - Active seconds accumulated since last tick
   */
  async sendHeartbeat(isOnline, deltaSeconds = 0) {
    if (!this.userId || !this.deviceId) return;

    // Load any previously unsent pending duration from AsyncStorage
    let totalDelta = deltaSeconds;
    try {
      const storedPending = await AsyncStorage.getItem(PENDING_DURATION_KEY);
      if (storedPending) {
        const parsed = parseInt(storedPending, 10);
        if (!isNaN(parsed) && parsed > 0) {
          totalDelta += parsed;
        }
        await AsyncStorage.removeItem(PENDING_DURATION_KEY);
      }
    } catch (_e) {
      // Ignore cache read errors
    }

    if (!this.isNetworkConnected) {
      // If offline, save the delta duration to persist for next online heartbeat
      if (totalDelta > 0) {
        await AsyncStorage.setItem(PENDING_DURATION_KEY, totalDelta.toString()).catch(() => {});
      }
      return;
    }

    const appVersion =
      Constants.expoConfig?.version ||
      Constants.manifest?.version ||
      '2.0.0';

    try {
      // 1. Primary path: Call the atomic PostgreSQL RPC function
      const { data, error } = await supabase.rpc('record_device_heartbeat', {
        p_user_id: this.userId,
        p_device_id: this.deviceId,
        p_is_online: isOnline,
        p_delta_seconds: totalDelta,
        p_session_id: this.sessionId || 'sess-default',
        p_platform: Platform.OS,
        p_app_version: appVersion,
      });

      if (!error && data) {
        this.isOnline = isOnline;
        return data;
      }

      if (error) {
        // If RPC failed (e.g. not created yet), fallback to direct table updates
        await this.fallbackDirectUpdate(isOnline, totalDelta, appVersion);
      }
    } catch (err) {
      console.warn('Heartbeat RPC failed, attempting fallback direct update:', err?.message || err);
      try {
        await this.fallbackDirectUpdate(isOnline, totalDelta, appVersion);
      } catch (fallbackErr) {
        // Stash delta so usage time is never lost
        if (totalDelta > 0) {
          await AsyncStorage.setItem(PENDING_DURATION_KEY, totalDelta.toString()).catch(() => {});
        }
      }
    }
  }

  /**
   * Fallback direct table updates if stored procedure is not yet compiled on backend.
   */
  async fallbackDirectUpdate(isOnline, deltaSeconds, appVersion) {
    const now = new Date().toISOString();

    // 1. Fetch current record to get current total_usage_seconds
    const { data: record } = await supabase
      .from('user_device_approvals')
      .select('id, total_usage_seconds')
      .eq('user_id', this.userId)
      .eq('device_id', this.deviceId)
      .maybeSingle();

    if (record) {
      const currentUsage = record.total_usage_seconds || 0;
      const newUsage = currentUsage + Math.max(0, deltaSeconds);

      await supabase
        .from('user_device_approvals')
        .update({
          is_online: isOnline,
          last_seen_at: now,
          last_active_at: now,
          total_usage_seconds: newUsage,
          current_session_started_at: isOnline ? now : null,
          updated_at: now,
        })
        .eq('id', record.id);
    }

    // 2. Upsert session in device_activity_sessions
    if (this.sessionId) {
      try {
        await supabase
          .from('device_activity_sessions')
          .upsert(
            {
              user_id: this.userId,
              device_id: this.deviceId,
              session_id: this.sessionId,
              session_start: new Date(this.sessionStartTime || Date.now()).toISOString(),
              session_end: now,
              duration_seconds: Math.max(0, deltaSeconds),
              platform: Platform.OS,
              app_version: appVersion,
              updated_at: now,
            },
            { onConflict: 'user_id,device_id,session_id' }
          );
      } catch (_e) {
        // Ignore session table fallback errors
      }
    }

    this.isOnline = isOnline;
  }
}

export const deviceActivityService = new DeviceActivityService();
