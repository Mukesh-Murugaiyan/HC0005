import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function AuthGuard({ children, requiredRole = null }) {
  const { user, isLoading, role } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Verifying session...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Access Denied. Please login.</Text>
      </View>
    );
  }

  if (requiredRole && role !== requiredRole) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          Unauthorized. Admin access required.
        </Text>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6C757D',
  },
  errorText: {
    fontSize: 16,
    color: '#DC3545',
    fontWeight: '600',
    textAlign: 'center',
  },
});
