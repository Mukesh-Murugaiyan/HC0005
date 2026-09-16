import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { router, useSegments } from 'expo-router';
import { authService } from '../services/authService';
import { deviceService } from '../services/deviceService';

/**
 * @type {React.Context<{
 *   user: any;
 *   profile: any;
 *   session: any;
 *   isLoading: boolean;
 *   isOffline: boolean;
 *   role: string | null;
 *   deviceStatus: 'APPROVED' | 'PENDING' | 'DENIED' | null;
 *   deviceApprovalRecord: any;
 *   login: (email: string, password: string) => Promise<any>;
 *   register: (...args: any[]) => Promise<any>;
 *   logout: () => Promise<void>;
 *   refreshProfile: () => Promise<void>;
 *   checkDeviceStatus: () => Promise<any>;
 * }>}
 */
const AuthContext = createContext({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  isOffline: false,
  role: null,
  deviceStatus: null,
  deviceApprovalRecord: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
  checkDeviceStatus: async () => {},
});

const PROFILE_CACHE_KEY = 'HC0005_CACHED_PROFILE';
const SESSION_CACHE_KEY = 'HC0005_CACHED_SESSION';
const DEVICE_APPROVAL_CACHE_KEY = 'HC0005_CACHED_DEVICE_APPROVAL';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [deviceApprovalRecord, setDeviceApprovalRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const segments = useSegments();

  // Clear local session & redirect to login
  const forceLogout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SESSION_CACHE_KEY);
      await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
      await AsyncStorage.removeItem(DEVICE_APPROVAL_CACHE_KEY);
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setDeviceStatus(null);
      setDeviceApprovalRecord(null);
    }
  }, []);

  // Check current device approval status with backend
  const checkDeviceStatus = useCallback(async (targetUserId, targetRole) => {
    const uid = targetUserId || user?.id || profile?.id;
    const roleToUse = targetRole || profile?.role || user?.role || 'user';
    if (!uid) return null;

    try {
      const record = await deviceService.checkOrRegisterDevice(uid, roleToUse);
      if (record) {
        setDeviceApprovalRecord(record);
        setDeviceStatus(record.status);
        await AsyncStorage.setItem(DEVICE_APPROVAL_CACHE_KEY, JSON.stringify(record)).catch(() => {});
        return record;
      }
    } catch (err) {
      console.warn('Failed to check device status:', err.message);
    }

    // Cached fallback
    const cached = await AsyncStorage.getItem(DEVICE_APPROVAL_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      setDeviceApprovalRecord(parsed);
      setDeviceStatus(parsed.status || 'PENDING');
      return parsed;
    }

    return null;
  }, [user, profile]);

  // Fetch and cache user profile
  const fetchProfile = useCallback(async (userId) => {
    try {
      const data = await authService.getProfile(userId);
      if (data) {
        setProfile(data);
        setUser(data);
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
        return data;
      }
    } catch (err) {
      console.warn('Failed to fetch remote profile:', err.message);
    }

    const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      setProfile(parsed);
      setUser(parsed);
      return parsed;
    }

    return null;
  }, []);

  // Initialize Auth state on App Launch
  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const netState = await NetInfo.fetch();
      const online = netState.isConnected && netState.isInternetReachable !== false;
      setIsOffline(!online);

      const savedSessionStr = await AsyncStorage.getItem(SESSION_CACHE_KEY);
      if (!savedSessionStr) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setDeviceStatus(null);
        setDeviceApprovalRecord(null);
        setIsLoading(false);
        return;
      }

      const savedSession = JSON.parse(savedSessionStr);

      if (online) {
        try {
          const freshProfile = await authService.getProfile(savedSession.user.id);
          if (freshProfile && freshProfile.role !== 'disabled') {
            setProfile(freshProfile);
            setUser(freshProfile);
            setSession({ user: freshProfile, access_token: freshProfile.id });
            await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(freshProfile));
            await AsyncStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ user: freshProfile, access_token: freshProfile.id }));

            // Check device approval for this user & device
            const deviceRec = await deviceService.checkOrRegisterDevice(freshProfile.id, freshProfile.role);
            if (deviceRec) {
              setDeviceApprovalRecord(deviceRec);
              setDeviceStatus(deviceRec.status);
              await AsyncStorage.setItem(DEVICE_APPROVAL_CACHE_KEY, JSON.stringify(deviceRec)).catch(() => {});
            }
          } else {
            await forceLogout();
          }
        } catch (e) {
          await forceLogout();
        }
      } else {
        // Offline: use stored session, cached profile & cached device status
        setSession(savedSession);
        setUser(savedSession.user);
        const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
          setProfile(JSON.parse(cached));
        } else {
          setProfile(savedSession.user);
        }

        const cachedApproval = await AsyncStorage.getItem(DEVICE_APPROVAL_CACHE_KEY);
        if (cachedApproval) {
          const parsed = JSON.parse(cachedApproval);
          setDeviceApprovalRecord(parsed);
          setDeviceStatus(parsed.status || 'PENDING');
        } else {
          // If no cached approval offline, default to PENDING to prevent bypass
          setDeviceStatus('PENDING');
        }
      }
    } catch (err) {
      console.error('Initialization error:', err);
      await forceLogout();
    } finally {
      setIsLoading(false);
    }
  }, [forceLogout]);

  useEffect(() => {
    initializeAuth();

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOffline(!online);
    });

    return () => {
      unsubscribeNetInfo();
    };
  }, [initializeAuth]);

  // Route protection & redirection based on Auth State, Role, and Device Status
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === 'admin';

    if (!user || !session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      const userRole = profile?.role || user?.role || 'user';

      if (inAuthGroup) {
        router.replace('/(tabs)');
      } else if (inAdminGroup && userRole !== 'admin') {
        router.replace('/(tabs)');
      }
    }
  }, [user, session, profile, segments, isLoading, deviceStatus]);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      setProfile(data.user);
      setDeviceStatus(data.deviceStatus);
      setDeviceApprovalRecord(data.deviceApproval);

      await AsyncStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data.session));
      await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data.user));
      if (data.deviceApproval) {
        await AsyncStorage.setItem(DEVICE_APPROVAL_CACHE_KEY, JSON.stringify(data.deviceApproval));
      }

      if (data.deviceStatus === 'APPROVED') {
        router.replace('/(tabs)');
      }
    }
    return data;
  };

  const register = async (fullName, email, phone, password, role) => {
    const data = await authService.register(fullName, email, phone, password, role);
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      setProfile(data.user);
      setDeviceStatus(data.deviceStatus);
      setDeviceApprovalRecord(data.deviceApproval);

      await AsyncStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data.session));
      await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data.user));
      if (data.deviceApproval) {
        await AsyncStorage.setItem(DEVICE_APPROVAL_CACHE_KEY, JSON.stringify(data.deviceApproval));
      }
    }
    return data;
  };

  const logout = async () => {
    await forceLogout();
    router.replace('/(auth)/login');
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
      await checkDeviceStatus(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        isOffline,
        role: profile?.role || user?.role || 'user',
        deviceStatus,
        deviceApprovalRecord,
        login,
        register,
        logout,
        refreshProfile,
        checkDeviceStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
