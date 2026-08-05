import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import UserCard from '../../components/UserCard';
import EditUserModal from '../../components/EditUserModal';
import AdminChangePasswordModal from '../../components/AdminChangePasswordModal';
import CreateUserModal from '../../components/CreateUserModal';
import AuthGuard from '../../components/AuthGuard';

export default function AdminDashboardScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modals state
  const [selectedUser, setSelectedUser] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const loadUsers = useCallback(async (pageNum = 1, query = searchQuery, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await adminService.fetchUsers({
        page: pageNum,
        limit: 10,
        searchQuery: query,
      });

      if (append) {
        setUsers((prev) => [...prev, ...res.users]);
      } else {
        setUsers(res.users);
      }

      setTotalCount(res.totalCount);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadUsers(1, searchQuery);
  }, [loadUsers, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers(1, searchQuery);
  };

  const handleSearchSubmit = () => {
    loadUsers(1, searchQuery);
  };

  const handleLoadMore = () => {
    if (!loadingMore && page < totalPages) {
      loadUsers(page + 1, searchQuery, true);
    }
  };

  const handleViewDetails = (user) => {
    router.push({
      pathname: '/admin/user-details',
      params: { userData: JSON.stringify(user) },
    });
  };

  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (userId, updates) => {
    await adminService.adminUpdateUser(userId, updates);
    loadUsers(1, searchQuery);
    Alert.alert('Success', 'User profile updated successfully.');
  };

  const handleOpenPassword = (user) => {
    setSelectedUser(user);
    setPasswordModalVisible(true);
  };

  const handleSavePassword = async (userId, newPassword) => {
    await adminService.adminChangeUserPassword(userId, newPassword);
  };

  const handleToggleDisable = (user) => {
    const isCurrentlyDisabled = user.banned_until || false;
    const actionName = isCurrentlyDisabled ? 'Enable' : 'Disable';

    Alert.alert(
      `${actionName} User`,
      `Are you sure you want to ${actionName.toLowerCase()} ${user.full_name || user.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionName,
          style: isCurrentlyDisabled ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await adminService.adminToggleDisableUser(user.id, !isCurrentlyDisabled);
              loadUsers(1, searchQuery);
              Alert.alert(
                'Success',
                `User has been ${isCurrentlyDisabled ? 'enabled' : 'disabled'}.`
              );
            } catch (err) {
              Alert.alert('Error', err.message || `Failed to ${actionName.toLowerCase()} user.`);
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = (user) => {
    if (user.id === currentUser?.id) {
      Alert.alert('Action Denied', 'You cannot delete your own admin account.');
      return;
    }

    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${user.full_name || user.email}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminService.adminDeleteUser(user.id);
              loadUsers(1, searchQuery);
              Alert.alert('Success', 'User deleted successfully.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete user.');
            }
          },
        },
      ]
    );
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 12);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <AuthGuard requiredRole="admin">
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#212529" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>User Management</Text>
            <Text style={styles.headerSubtitle}>
              Total Registered Users: {totalCount}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addUserBtn}
            onPress={() => setCreateModalVisible(true)}
          >
            <Ionicons name="person-add" size={18} color="#FFFFFF" />
            <Text style={styles.addUserBtnText}>Add User</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#6C757D" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            placeholderTextColor="#ADB5BD"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                loadUsers(1, '');
              }}
            >
              <Ionicons name="close-circle" size={18} color="#6C757D" />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <UserCard
                user={item}
                onViewDetails={handleViewDetails}
                onEdit={handleOpenEdit}
                onChangePassword={handleOpenPassword}
                onToggleDisable={handleToggleDisable}
                onDelete={handleDeleteUser}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#007AFF']} />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="small" color="#007AFF" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#CED4DA" />
                <Text style={styles.emptyTitle}>No Users Found</Text>
                <Text style={styles.emptyText}>
                  No user profiles match your search criteria.
                </Text>
              </View>
            }
          />
        )}

        <CreateUserModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onUserCreated={() => loadUsers(1, searchQuery)}
        />

        <EditUserModal
          visible={editModalVisible}
          user={selectedUser}
          onClose={() => setEditModalVisible(false)}
          onSave={handleSaveEdit}
        />

        <AdminChangePasswordModal
          visible={passwordModalVisible}
          user={selectedUser}
          onClose={() => setPasswordModalVisible(false)}
          onSave={handleSavePassword}
        />
      </View>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#212529',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6C757D',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  addUserBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  headerTitleContainer: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212529',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6C757D',
  },
  footerLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#495057',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
    textAlign: 'center',
  },
});
