import { PermissionsAndroid, Platform } from 'react-native';
import * as Device from 'expo-device';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  paired?: boolean;
  connected?: boolean;
  type?: string;
  rssi?: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Role tracks whether this device established the connection as a SERVER
 * (via accept()) or as a CLIENT (via connectToDevice()). This is critical
 * for correct reconnect behaviour after a drop.
 */
export type ConnectionRole = 'server' | 'client' | 'none';

// Standard Bluetooth Serial Port Profile UUID
export const SPP_UUID = '00001101-0000-1000-8000-00805F9B34FB';

// Service name registered in the SDP record — the client searches for this UUID
const SPP_SERVICE_NAME = 'HC05';

// ─────────────────────────────────────────────────────────────────────────────
// Native module loader (graceful fallback for Expo Go / web)
// ─────────────────────────────────────────────────────────────────────────────

let RNBluetoothClassic: any = null;
try {
  RNBluetoothClassic = require('react-native-bluetooth-classic').default;
} catch (e) {
  console.log('[BT] react-native-bluetooth-classic not available (Expo Go / web fallback)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe AsyncStorage wrapper
// ─────────────────────────────────────────────────────────────────────────────

let SafeNativeAsyncStorage: any = null;
try {
  SafeNativeAsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.log('[BT] AsyncStorage not available, using memory store');
}

const memoryStore = new Map<string, string>();
const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (SafeNativeAsyncStorage?.getItem) {
      try { return await SafeNativeAsyncStorage.getItem(key); } catch (_) {}
    }
    return memoryStore.get(key) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (SafeNativeAsyncStorage?.setItem) {
      try { await SafeNativeAsyncStorage.setItem(key, value); return; } catch (_) {}
    }
    memoryStore.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (SafeNativeAsyncStorage?.removeItem) {
      try { await SafeNativeAsyncStorage.removeItem(key); return; } catch (_) {}
    }
    memoryStore.delete(key);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BluetoothService
// ─────────────────────────────────────────────────────────────────────────────

class BluetoothService {
  // ── Connection state ──────────────────────────────────────────────────────
  private connectedDevice: BluetoothDevice | null = null;
  private status: ConnectionStatus = 'disconnected';
  /**
   * role — tracks HOW this connection was established:
   *   'server': this phone called accept() and the other device connected in
   *   'client': this phone called connectToDevice() to reach the other device
   *   'none':   not connected
   *
   * BUG 6 FIX: reconnect must use the same role as the original connection.
   */
  private role: ConnectionRole = 'none';
  private activeSocket: any = null;
  private isPairingModeEnabled: boolean = false;

  // ── Reconnect / backoff ───────────────────────────────────────────────────
  private autoReconnectTimer: any = null;
  private isManualDisconnect: boolean = false;
  private reconnectAttempts: number = 0;
  private static readonly MAX_RECONNECT_ATTEMPTS = 5;

  // ── Connection monitor ────────────────────────────────────────────────────
  private monitorTimer: any = null;
  /**
   * consecutiveMonitorFails — BUG 5 FIX:
   * Only trigger disconnect after isConnected() returns false TWICE in a row
   * (2 × 6 s = 12 s window). Prevents false-positive disconnects on transient
   * Android Bluetooth stack hiccups.
   */
  private consecutiveMonitorFails: number = 0;

  // ── Accept loop (server mode) ─────────────────────────────────────────────
  private acceptLoopActive: boolean = false;

  // ── Scan guard (prevents concurrent discovery calls) ─────────────────────
  private isScanning: boolean = false;

  // ── Data listeners ────────────────────────────────────────────────────────
  private lastStreamPayload: string = '';
  private dataListeners: Array<(data: string) => void> = [];

  // ── Status listeners ──────────────────────────────────────────────────────
  private listeners: Array<
    (status: ConnectionStatus, device: BluetoothDevice | null, isPairingMode: boolean) => void
  > = [];

  // ── Storage keys ──────────────────────────────────────────────────────────
  private static readonly LAST_DEVICE_KEY = '@hc05_last_bt_device';
  private static readonly LAST_ROLE_KEY   = '@hc05_last_bt_role';

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor — attach native disconnect listener
  // ─────────────────────────────────────────────────────────────────────────

  constructor() {
    if (RNBluetoothClassic && typeof RNBluetoothClassic.onDeviceDisconnected === 'function') {
      try {
        RNBluetoothClassic.onDeviceDisconnected((event: any) => {
          const eventAddress =
            event?.device?.address || event?.device?.id || event?.address || event?.id;
          const activeAddress =
            this.connectedDevice?.address || this.connectedDevice?.id;

          console.log(`[BT Native] DEVICE_DISCONNECTED event for: ${eventAddress}`);

          if (
            activeAddress &&
            eventAddress &&
            eventAddress.toLowerCase() === activeAddress.toLowerCase()
          ) {
            console.log('[BT Native] Our connected device fired disconnect — handling drop');
            this.handleUnexpectedDisconnect('native-event');
          } else {
            console.log('[BT Native] Disconnect event for unrelated bonded device — ignoring');
          }
        });
      } catch (e) {
        console.warn('[BT] Failed to attach onDeviceDisconnected listener:', e);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Permissions
  // ─────────────────────────────────────────────────────────────────────────

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const apiLevel = Platform.Version;
      if (typeof apiLevel === 'number' && apiLevel >= 31) {
        const timeoutPromise = new Promise<Record<string, string>>((resolve) =>
          setTimeout(() => resolve({}), 3000)
        );
        const granted = (await Promise.race([
          PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]),
          timeoutPromise,
        ])) as Record<string, string>;
        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const r = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return r === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn('[BT] Permission request error:', err);
      return true;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Device scan
  // ─────────────────────────────────────────────────────────────────────────

  async scanForDevices(): Promise<BluetoothDevice[]> {
    // Guard: prevent concurrent scans (causes 'already in discovery mode' error)
    if (this.isScanning) {
      console.warn('[BT Scan] Already scanning — ignoring duplicate call');
      return [];
    }
    this.isScanning = true;
    console.log('[BT Scan] ── Starting device scan ──────────────────────────');
    console.log(`[BT Scan] Current status: ${this.status} | Role: ${this.role}`);

    try {
      await this.requestPermissions();

    if (RNBluetoothClassic && typeof RNBluetoothClassic.isBluetoothEnabled === 'function') {
      try {
        const enabled = await RNBluetoothClassic.isBluetoothEnabled();
        if (!enabled && typeof RNBluetoothClassic.requestBluetoothEnabled === 'function') {
          await RNBluetoothClassic.requestBluetoothEnabled();
        }
      } catch (e) {
        console.warn('[BT] Bluetooth enable check error:', e);
      }
    }

    const deviceMap = new Map<string, BluetoothDevice>();

    // 1. Bonded (paired) devices — show all, including Android phones
    if (RNBluetoothClassic && typeof RNBluetoothClassic.getBondedDevices === 'function') {
      try {
        const bonded = await RNBluetoothClassic.getBondedDevices();
        if (Array.isArray(bonded)) {
          bonded.forEach((dev: any) => {
            const devId = dev.address || dev.id;
            if (!devId) return;
            const mapped: BluetoothDevice = {
              id: devId,
              name: dev.name || devId,
              address: devId,
              paired: true,
              connected: dev.connected || false,
              type: dev.type || 'CLASSIC',
            };
            console.log(`[BT Scan] Bonded: ${mapped.name} (${mapped.address}) type=${mapped.type}`);
            deviceMap.set(mapped.id, mapped);
          });
        }
      } catch (e) {
        console.warn('[BT Scan] getBondedDevices error:', e);
      }
    }

    // 2. Discovery — only when not connected (active discovery drops RFCOMM links)
    if (
      this.status !== 'connected' &&
      !this.connectedDevice &&
      RNBluetoothClassic &&
      typeof RNBluetoothClassic.startDiscovery === 'function'
    ) {
      try {
        // Cancel any running discovery before starting a fresh one
        if (typeof RNBluetoothClassic.cancelDiscovery === 'function') {
          try { await RNBluetoothClassic.cancelDiscovery(); } catch (_) {}
        }
        console.log('[BT Scan] Starting active discovery...');
        const discovered = await RNBluetoothClassic.startDiscovery();
        if (Array.isArray(discovered)) {
          console.log(`[BT Scan] Discovery found ${discovered.length} device(s)`);
          discovered.forEach((dev: any) => {
            const devId = dev.address || dev.id;
            if (!devId) return;
            const existing = deviceMap.get(devId);
            deviceMap.set(devId, {
              id: devId,
              name: dev.name || existing?.name || devId,
              address: devId,
              paired: existing?.paired || dev.bonded || false,
              connected: dev.connected || false,
              type: dev.type || existing?.type || 'CLASSIC',
            });
          });
        }
      } catch (e) {
        console.warn('[BT Scan] startDiscovery error:', e);
      }
    } else if (this.status === 'connected') {
      console.log('[BT Scan] Skipping discovery — already connected (prevents RFCOMM drop)');
    }

    const result = Array.from(deviceMap.values());
    console.log(
      `[BT Scan] Done. ${result.length} device(s):`,
      result.map((d) => `${d.name} (${d.address})`).join(', ')
    );

    // If currently in server mode, remind what action is needed
    if (this.role === 'server' || this.acceptLoopActive) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📡 [SERVER MODE ACTIVE] This phone is the RFCOMM server.');
      console.log('   ➜ Do NOT tap Connect from this device.');
      console.log('   ➜ On the OTHER phone: open HC-0.5 app → tap Connect on THIS phone.');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    return result;

    } catch (scanErr) {
      console.warn('[BT Scan] Unexpected scan error:', scanErr);
      return [];
    } finally {
      this.isScanning = false;
      console.log('[BT Scan] ── Scan complete ─────────────────────────────────');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Storage helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async saveLastSession(device: BluetoothDevice, role: ConnectionRole) {
    try {
      await safeStorage.setItem(BluetoothService.LAST_DEVICE_KEY, JSON.stringify(device));
      await safeStorage.setItem(BluetoothService.LAST_ROLE_KEY, role);
    } catch (e) {
      console.warn('[BT] Failed to save last session:', e);
    }
  }

  private async clearLastSession() {
    try {
      await safeStorage.removeItem(BluetoothService.LAST_DEVICE_KEY);
      await safeStorage.removeItem(BluetoothService.LAST_ROLE_KEY);
    } catch (e) {
      console.warn('[BT] Failed to clear last session:', e);
    }
  }

  async getSavedLastDevice(): Promise<BluetoothDevice | null> {
    try {
      const json = await safeStorage.getItem(BluetoothService.LAST_DEVICE_KEY);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      return null;
    }
  }

  private async getSavedLastRole(): Promise<ConnectionRole> {
    try {
      const r = await safeStorage.getItem(BluetoothService.LAST_ROLE_KEY);
      if (r === 'server' || r === 'client') return r;
    } catch (_) {}
    return 'client';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-connect on app start
  // BUG 7 FIX: restore the correct role (server vs client)
  // ─────────────────────────────────────────────────────────────────────────

  async autoConnectLastDevice(): Promise<boolean> {
    if (this.status === 'connected' || this.connectedDevice) return true;

    const saved = await this.getSavedLastDevice();
    const savedRole = await this.getSavedLastRole();

    if (!saved) {
      console.log('[BT Auto] App launched — auto-enabling server listening mode for OASYS system...');
      return this.enablePairingMode();
    }

    console.log(`[BT Auto] Restoring last session as ${savedRole}: ${saved.name} (${saved.address})`);

    if (savedRole === 'server') {
      // Restart server mode so the other device can reconnect to us
      return this.enablePairingMode();
    } else {
      const success = await this.connect(saved);
      if (!success) {
        console.log('[BT Auto] Client connect failed — falling back to server listening mode');
        return this.enablePairingMode();
      }
      return success;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLIENT MODE — connect to another device's RFCOMM server
  //
  // BUG 1 FIX: cancelAccept() is NOT called here. It is only called when
  //            explicitly switching away from server mode.
  // BUG 4 FIX: adapter wait increased to 800ms.
  // ─────────────────────────────────────────────────────────────────────────

  async connect(device: BluetoothDevice): Promise<boolean> {
    this.isManualDisconnect = false;
    this.reconnectAttempts = 0;

    // If currently in server mode, cleanly stop it before switching to client
    if (this.acceptLoopActive) {
      console.log('[BT Client] Stopping server mode before switching to client role');
      this.stopAcceptLoop();
      if (typeof RNBluetoothClassic?.cancelAccept === 'function') {
        try { await RNBluetoothClassic.cancelAccept(); } catch (_) {}
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    this.role = 'client';
    this.setStatus('connecting');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔵 [CLIENT] Connecting to device...');
    console.log(`   Name    : ${device.name}`);
    console.log(`   Address : ${device.address}`);
    console.log(`   Paired  : ${device.paired}`);
    console.log(`   Native  : ${RNBluetoothClassic ? 'YES ✅' : 'NO ❌ (Expo Go fallback)'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!RNBluetoothClassic || typeof RNBluetoothClassic.connectToDevice !== 'function') {
      // Expo Go simulation fallback
      return this._simulateConnect(device);
    }

    try {
      // Cancel any active discovery — discovery interferes with RFCOMM connection
      // NOTE: do NOT cancel accept here (Bug 1 fix — that's only done above if we were in server mode)
      if (typeof RNBluetoothClassic.cancelDiscovery === 'function') {
        try { await RNBluetoothClassic.cancelDiscovery(); } catch (_) {}
      }

      // BUG 4 FIX: 800ms wait for adapter to become idle (was 500ms)
      await new Promise((r) => setTimeout(r, 800));

      // Pair if needed
      if (typeof RNBluetoothClassic.pairDevice === 'function' && !device.paired) {
        try {
          console.log(`[CLIENT] Pairing with ${device.name}...`);
          await RNBluetoothClassic.pairDevice(device.address);
          await new Promise((r) => setTimeout(r, 500));
        } catch (pairErr) {
          console.warn('[CLIENT] Pairing attempt notice:', pairErr);
        }
      }

      // ── Connection attempts ──────────────────────────────────────────────
      // The server must be running accept({ uuid: SPP_UUID }) on the other device.
      // We try insecure first (faster, no PIN prompt), then fall back to secure.

      let socket: any = null;

      // Attempt 1: Insecure RFCOMM with SPP UUID
      // This works when the server registered with the same SPP UUID in its SDP record.
      console.log(`[CLIENT] Attempt 1: Insecure RFCOMM + SPP UUID → ${device.address}`);
      try {
        socket = await RNBluetoothClassic.connectToDevice(device.address, {
          secure: false,
          uuid: SPP_UUID,
        });
        if (socket) console.log('[CLIENT] Connected via insecure RFCOMM + SPP UUID ✅');
      } catch (e1) {
        console.warn('[CLIENT] Attempt 1 failed:', (e1 as any)?.message || e1);
        await new Promise((r) => setTimeout(r, 500));
      }

      // Attempt 2: Secure RFCOMM with SPP UUID (some Android versions require secure channel)
      if (!socket) {
        console.log(`[CLIENT] Attempt 2: Secure RFCOMM + SPP UUID → ${device.address}`);
        try {
          socket = await RNBluetoothClassic.connectToDevice(device.address, {
            secure: true,
            uuid: SPP_UUID,
          });
          if (socket) console.log('[CLIENT] Connected via secure RFCOMM + SPP UUID ✅');
        } catch (e2) {
          console.warn('[CLIENT] Attempt 2 failed:', (e2 as any)?.message || e2);
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      // Attempt 3: Plain connectToDevice (no UUID — last resort for legacy devices)
      if (!socket) {
        console.log(`[CLIENT] Attempt 3: Plain connectToDevice → ${device.address}`);
        try {
          socket = await RNBluetoothClassic.connectToDevice(device.address);
          if (socket) console.log('[CLIENT] Connected via plain connectToDevice ✅');
        } catch (e3) {
          console.warn('[CLIENT] Attempt 3 failed:', (e3 as any)?.message || e3);
        }
      }

      if (socket) {
        return this._onSocketOpened(socket, { ...device, paired: true, connected: true }, 'client');
      }

      console.warn('[CLIENT] All connection attempts failed — no socket returned');
      this.setStatus('disconnected');
      return false;

    } catch (err) {
      console.warn('[CLIENT] Unexpected connection error:', err);
      this.setStatus('disconnected');
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SERVER MODE — listen for incoming RFCOMM connection
  //
  // BUG 2 FIX: accept() now specifies both uuid and serviceName so Android
  //            registers a proper SDP record. The client searches SDP for
  //            SPP_UUID and finds our server.
  // ─────────────────────────────────────────────────────────────────────────

  async enablePairingMode(): Promise<boolean> {
    await this.requestPermissions();

    if (RNBluetoothClassic && typeof RNBluetoothClassic.requestBluetoothEnabled === 'function') {
      try { await RNBluetoothClassic.requestBluetoothEnabled(); } catch (_) {}
    }

    // Stop any current session cleanly before entering server mode
    if (this.status === 'connected') {
      console.log('[SERVER] Already connected — not re-entering pairing mode');
      this.isPairingModeEnabled = true;
      this.notifyListeners();
      return true;
    }

    // Cancel any running discovery (discovery and accept() don't coexist well)
    if (RNBluetoothClassic) {
      if (typeof RNBluetoothClassic.cancelDiscovery === 'function') {
        try { await RNBluetoothClassic.cancelDiscovery(); } catch (_) {}
      }
      // Cancel existing server socket before creating a new one
      if (typeof RNBluetoothClassic.cancelAccept === 'function') {
        try { await RNBluetoothClassic.cancelAccept(); } catch (_) {}
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    this.role = 'server';
    this.isPairingModeEnabled = true;
    this.notifyListeners();

    if (RNBluetoothClassic && typeof RNBluetoothClassic.accept === 'function') {
      this.startAcceptLoop();
    }

    return true;
  }

  // ── Accept loop implementation ─────────────────────────────────────────────

  private startAcceptLoop() {
    this.stopAcceptLoop();
    this.acceptLoopActive = true;
    this._runAcceptIteration();
  }

  private stopAcceptLoop() {
    this.acceptLoopActive = false;
  }

  private async _runAcceptIteration() {
    if (!this.acceptLoopActive) return;
    if (this.status === 'connected') {
      // Already connected — monitor will handle drops; resume loop when disconnected
      setTimeout(() => this._runAcceptIteration(), 3000);
      return;
    }
    if (!RNBluetoothClassic || typeof RNBluetoothClassic.accept !== 'function') return;

    console.log('📡 [SERVER] Listening for incoming RFCOMM connection...');
    console.log(`   UUID: ${SPP_UUID}`);
    console.log(`   Service: ${SPP_SERVICE_NAME}`);

    try {
      // BUG 2 FIX: Specify uuid + serviceName so SDP record is registered.
      // The client device does SDP lookup and connects to our specific service.
      const socket = await RNBluetoothClassic.accept({
        serviceName: SPP_SERVICE_NAME,
        uuid: SPP_UUID,
        delimiter: '\n',
        timeout: 30000, // 30-second accept window — auto-retries if no one connects
      });

      if (socket && this.acceptLoopActive) {
        const devName = socket.device?.name || socket.device?.address || 'Connected Device';
        const devAddr = socket.device?.address || 'RFCOMM Socket';
        const connectedDevice: BluetoothDevice = {
          id: devAddr,
          name: devName,
          address: devAddr,
          paired: true,
          connected: true,
          type: socket.device?.type || 'CLASSIC',
        };
        await this._onSocketOpened(socket, connectedDevice, 'server');
      } else if (this.acceptLoopActive && (this.status === 'disconnected' || this.status === 'connecting')) {
        // Timed out — retry immediately
        console.log('📡 [SERVER] Accept window timed out — re-listening...');
        setTimeout(() => this._runAcceptIteration(), 200);
      }
    } catch (e: any) {
      if (this.acceptLoopActive && (this.status === 'disconnected' || this.status === 'connecting')) {
        console.log('[SERVER] Accept closed — re-listening:', e?.message || e);
        setTimeout(() => this._runAcceptIteration(), 1000);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shared post-connect handler
  // Called identically for both SERVER (accept) and CLIENT (connectToDevice)
  // ─────────────────────────────────────────────────────────────────────────

  private async _onSocketOpened(
    socket: any,
    device: BluetoothDevice,
    role: ConnectionRole
  ): Promise<boolean> {
    this.activeSocket = socket;
    this.connectedDevice = device;
    this.role = role;
    this.consecutiveMonitorFails = 0;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ [CONNECTED] Role: ${role.toUpperCase()}`);
    console.log(`   Name    : ${device.name}`);
    console.log(`   Address : ${device.address}`);
    console.log(`   UUID    : ${SPP_UUID}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Subscribe to incoming data — this also keeps the RFCOMM stream alive
    // by draining the native Java InputStream buffer continuously.
    if (typeof socket.onDataReceived === 'function') {
      try {
        socket.onDataReceived((rawData: any) => {
          const text =
            typeof rawData === 'string' ? rawData : rawData?.data ?? String(rawData);
          this.lastStreamPayload = text;
          this.notifyDataListeners(text);
          console.log(`📨 [DATA RX ← ${device.name}]: ${text.trim()}`);
        });
        console.log('[SOCKET] onDataReceived listener attached ✅');
      } catch (rxErr) {
        console.warn('[SOCKET] onDataReceived attach error:', rxErr);
      }
    }

    this.startConnectionMonitor();
    await this.saveLastSession(device, role);
    this.setStatus('connected');
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Connection monitor
  //
  // BUG 5 FIX: Only call handleUnexpectedDisconnect() after isConnected()
  //            returns false on TWO consecutive checks (spaced 6s apart).
  //            This prevents false positives from transient Android BT hiccups.
  // ─────────────────────────────────────────────────────────────────────────

  private startConnectionMonitor() {
    this.stopConnectionMonitor();
    this.consecutiveMonitorFails = 0;

    this.monitorTimer = setInterval(async () => {
      if (this.status !== 'connected' || !this.activeSocket) return;
      try {
        if (typeof this.activeSocket.isConnected === 'function') {
          const alive = await this.activeSocket.isConnected();
          if (alive) {
            this.consecutiveMonitorFails = 0; // reset on healthy check
          } else {
            this.consecutiveMonitorFails++;
            console.warn(
              `[MONITOR] isConnected()=false (fail ${this.consecutiveMonitorFails}/2)`
            );
            if (this.consecutiveMonitorFails >= 2) {
              console.warn('[MONITOR] Two consecutive failures — treating as disconnect');
              this.handleUnexpectedDisconnect('monitor-double-fail');
            }
          }
        }
      } catch (e) {
        // isConnected() can throw transiently — do NOT treat as disconnect
        console.warn('[MONITOR] isConnected() threw (not counted as failure):', e);
      }
    }, 6000); // check every 6s; 2 consecutive = 12s before disconnect
  }

  private stopConnectionMonitor() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.consecutiveMonitorFails = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Unexpected disconnect handler
  //
  // BUG 6 FIX: reconnect strategy depends on the original role:
  //   - server: restart accept loop (other device will reconnect in)
  //   - client: retry connectToDevice() with exponential backoff
  // ─────────────────────────────────────────────────────────────────────────

  private handleUnexpectedDisconnect(reason: string = 'unknown') {
    if (this.status !== 'connected' && this.status !== 'connecting') return; // already handling

    this.stopConnectionMonitor();
    const lostDevice = this.connectedDevice;
    const lostRole = this.role;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔴 [DISCONNECTED] Reason: ${reason} | Role: ${lostRole}`);
    if (lostDevice) {
      console.log(`   Name    : ${lostDevice.name}`);
      console.log(`   Address : ${lostDevice.address}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.activeSocket = null;
    this.connectedDevice = null;
    this.role = 'none';
    this.setStatus('disconnected');

    if (this.isManualDisconnect || !lostDevice) return;

    if (lostRole === 'server') {
      // Restart accept loop — the client will reconnect to us
      if (this.acceptLoopActive || this.isPairingModeEnabled) {
        console.log('[SERVER] Restarting accept loop after disconnect...');
        setTimeout(() => {
          if (!this.isManualDisconnect && this.status !== 'connected') {
            this.role = 'server';
            this._runAcceptIteration();
          }
        }, 1500);
      }
    } else {
      // Client mode: exponential backoff reconnect
      if (this.reconnectAttempts >= BluetoothService.MAX_RECONNECT_ATTEMPTS) {
        console.warn(
          `[CLIENT] Gave up after ${BluetoothService.MAX_RECONNECT_ATTEMPTS} reconnect attempts`
        );
        this.reconnectAttempts = 0;
        return;
      }
      this.reconnectAttempts++;
      const backoffMs = Math.min(3000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
      console.log(
        `[CLIENT] Auto-reconnect attempt #${this.reconnectAttempts} in ${backoffMs}ms → ${lostDevice.name}`
      );
      if (this.autoReconnectTimer) clearTimeout(this.autoReconnectTimer);
      this.autoReconnectTimer = setTimeout(async () => {
        if (!this.isManualDisconnect && this.status !== 'connected') {
          await this.connect(lostDevice);
        }
      }, backoffMs);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Disconnect (manual)
  // ─────────────────────────────────────────────────────────────────────────

  async disconnect(): Promise<void> {
    this.isManualDisconnect = true;
    this.stopConnectionMonitor();
    this.stopAcceptLoop();

    if (this.autoReconnectTimer) {
      clearTimeout(this.autoReconnectTimer);
      this.autoReconnectTimer = null;
    }

    await this.clearLastSession();

    if (typeof RNBluetoothClassic?.cancelAccept === 'function') {
      try { await RNBluetoothClassic.cancelAccept(); } catch (_) {}
    }

    if (this.activeSocket && typeof this.activeSocket.disconnect === 'function') {
      try {
        await this.activeSocket.disconnect();
        console.log('[BT] Socket disconnected cleanly');
      } catch (e) {
        console.warn('[BT] Error closing socket:', e);
      }
    }

    const name = this.connectedDevice?.name ?? 'unknown';
    this.activeSocket = null;
    this.connectedDevice = null;
    this.role = 'none';
    this.isPairingModeEnabled = false;
    this.setStatus('disconnected');
    console.log(`[BT] Manual disconnect from ${name} complete`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Send data
  // ─────────────────────────────────────────────────────────────────────────

  async sendData(data: string): Promise<boolean> {
    if (this.status !== 'connected' || !this.connectedDevice) {
      console.warn(`[DATA TX] Not sent — not connected. Value: "${data}"`);
      return false;
    }

    if (this.activeSocket && typeof this.activeSocket.write === 'function') {
      try {
        // OASYS TNEPDS weighing scale protocol: data + \r\n terminator
        // e.g. "5.000\r\n" = bytes: 35 2E 30 30 30 0D 0A
        const payload = data + '\r\n';
        await this.activeSocket.write(payload);
        const hexBytes = [...payload]
          .map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))
          .join(' ');
        console.log(`[DATA TX → ${this.connectedDevice.name}]: "${data}" | Bytes: ${hexBytes}`);
        return true;
      } catch (e) {
        console.warn('[DATA TX] Write failed:', e);
        return false;
      }
    }

    // Simulation fallback
    console.log(`[DATA TX SIM → ${this.connectedDevice.name}]: "${data}"`);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Local device name
  // ─────────────────────────────────────────────────────────────────────────

  async getLocalDeviceName(): Promise<string> {
    if (RNBluetoothClassic && typeof RNBluetoothClassic.getAdapterProfile === 'function') {
      try {
        const profile = await RNBluetoothClassic.getAdapterProfile();
        if (profile?.name) return profile.name;
      } catch (_) {}
    }
    try {
      if (Device.deviceName) return Device.deviceName;
      if (Device.modelName) return Device.modelName;
    } catch (_) {}
    return Platform.OS === 'android' ? 'Android Device' : 'My Phone';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pairing mode helpers (called from UI)
  // ─────────────────────────────────────────────────────────────────────────

  disablePairingMode(): void {
    this.isPairingModeEnabled = false;
    this.stopAcceptLoop();
    this.notifyListeners();
  }

  getIsPairingModeEnabled(): boolean {
    return this.isPairingModeEnabled;
  }

  getRole(): ConnectionRole {
    return this.role;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Device pairing (OS-level bond)
  // ─────────────────────────────────────────────────────────────────────────

  async pairDevice(device: BluetoothDevice): Promise<boolean> {
    await this.requestPermissions();
    if (!RNBluetoothClassic) { device.paired = true; return true; }

    if (typeof RNBluetoothClassic.pairDevice === 'function') {
      try {
        const paired = await RNBluetoothClassic.pairDevice(device.address);
        if (paired) { device.paired = true; return true; }
      } catch (err) {
        console.warn('[BT] pairDevice error:', err);
      }
    }

    // Fallback: connect attempt triggers OS pairing dialog
    try {
      if (typeof RNBluetoothClassic.connectToDevice === 'function') {
        const socket = await RNBluetoothClassic.connectToDevice(device.address);
        if (socket) {
          await this._onSocketOpened(socket, { ...device, paired: true, connected: true }, 'client');
          return true;
        }
      }
    } catch (e) {
      console.warn('[BT] Pairing via connect failed:', e);
    }

    device.paired = true;
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Expo Go / Web simulation fallback
  // ─────────────────────────────────────────────────────────────────────────

  private _simulateConnect(device: BluetoothDevice): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const simDevice = { ...device, paired: true, connected: true };
        this.connectedDevice = simDevice;
        this.role = 'client';
        await this.saveLastSession(simDevice, 'client');
        this.startConnectionMonitor();
        this.setStatus('connected');
        console.log(`[SIM] Connected to ${device.name} (simulation)`);
        resolve(true);
      }, 800);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Listeners / pub-sub
  // ─────────────────────────────────────────────────────────────────────────

  onData(listener: (data: string) => void) {
    this.dataListeners.push(listener);
    return () => {
      this.dataListeners = this.dataListeners.filter((l) => l !== listener);
    };
  }

  private notifyDataListeners(data: string) {
    this.dataListeners.forEach((l) => l(data));
  }

  getStatus(): ConnectionStatus { return this.status; }
  getConnectedDevice(): BluetoothDevice | null { return this.connectedDevice; }

  subscribe(
    listener: (
      status: ConnectionStatus,
      device: BluetoothDevice | null,
      isPairingMode: boolean
    ) => void
  ) {
    this.listeners.push(listener);
    listener(this.status, this.connectedDevice, this.isPairingModeEnabled);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private setStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((l) =>
      l(this.status, this.connectedDevice, this.isPairingModeEnabled)
    );
  }
}

export const bluetoothService = new BluetoothService();
