import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function InternetConnectionRequiredView({ onRetry }) {
  const { retryConnectionAndCheckApproval, logout, user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const insets = useSafeAreaInsets();

  const handleRetry = async () => {
    setChecking(true);
    setErrorMsg('');
    try {
      if (onRetry) {
        await onRetry();
      } else if (retryConnectionAndCheckApproval) {
        await retryConnectionAndCheckApproval();
      }
    } catch (err) {
      console.warn('Retry connection failed:', err?.message);
      setErrorMsg('Still unable to connect to the internet. Please check your network settings.');
    } finally {
      setChecking(false);
    }
  };

  const handleOpenSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('App-Prefs:root=WIFI');
      } else {
        await Linking.openSettings();
      }
    } catch {
      // Fallback
      await Linking.openSettings().catch(() => {});
    }
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 16);
  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topPadding + 16, paddingBottom: bottomPadding + 12 },
      ]}
    >
      {/* 1. Header Section */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-offline-outline" size={44} color="#DC2626" />
        </View>

        <Text style={styles.title}>Internet Connection Required</Text>

        <Text style={styles.subtitle}>
          An active internet connection is required to verify device approval and security status. Please connect to Wi-Fi or Mobile Data to continue.
        </Text>
      </View>

      {/* 2. Error message if retry fails */}
      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* 3. Diagnostic / Guide Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Network Status</Text>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.statusDot, styles.dotOffline]} />
            <Text style={styles.rowLabel}>Device Network</Text>
          </View>
          <Text style={styles.rowValueOffline}>Disconnected</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#4B5563" />
            <Text style={styles.rowLabel}>Security Verification</Text>
          </View>
          <Text style={styles.rowValue}>Required</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="sync-outline" size={16} color="#4B5563" />
            <Text style={styles.rowLabel}>Auto-Reconnect</Text>
          </View>
          <Text style={styles.rowValueSuccess}>Enabled</Text>
        </View>
      </View>

      {/* 4. Tips Card */}
      <View style={styles.tipsCard}>
        <View style={styles.tipsHeader}>
          <Ionicons name="information-circle-outline" size={18} color="#1E40AF" />
          <Text style={styles.tipsTitle}>What should I do?</Text>
        </View>
        <Text style={styles.tipsText}>
          1. Turn on Wi-Fi or Cellular Data from your device control center.{'\n'}
          2. The app will automatically resume once connection is detected.{'\n'}
          3. Or tap <Text style={styles.bold}>&quot;Check Connection&quot;</Text> below to retry immediately.
        </Text>
      </View>

      {/* 5. Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.primaryBtn, checking && styles.btnDisabled]}
          onPress={handleRetry}
          disabled={checking}
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={19} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Check Connection</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleOpenSettings}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-outline" size={18} color="#374151" />
          <Text style={styles.secondaryBtnText}>Open Network Settings</Text>
        </TouchableOpacity>

        {user ? (
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={logout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={16} color="#6B7280" />
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  iconCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '500',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  rowLabel: {
    fontSize: 13.5,
    color: '#4B5563',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
  },
  rowValueOffline: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '700',
  },
  rowValueSuccess: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  tipsCard: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  tipsText: {
    fontSize: 12.5,
    color: '#1E3A8A',
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
  },
  actionContainer: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  secondaryBtnText: {
    color: '#374151',
    fontSize: 14.5,
    fontWeight: '600',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  signOutBtnText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.65,
  },
});
