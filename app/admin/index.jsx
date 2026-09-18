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
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminService } from '../../services/adminService';
import { deviceService } from '../../services/deviceService';
import { useAuth } from '../../context/AuthContext';

import UserCard from '../../components/UserCard';
import EditUserModal from '../../components/EditUserModal';
import AdminChangePasswordModal from '../../components/AdminChangePasswordModal';
import CreateUserModal from '../../components/CreateUserModal';
import DeviceApprovalCard from '../../components/DeviceApprovalCard';
import EditDeviceApprovalModal from '../../components/EditDeviceApprovalModal';
import AuthGuard from '../../components/AuthGuard';

export default function AdminDashboardScreen() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'devices'

  // Users state
  const [users, setUsers] = useState([]);
  const [userTotalCount, setUserTotalCount] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);

  // Devices state
  const [approvals, setApprovals] = useState([]);
  const [deviceTotalCount, setDeviceTotalCount] = useState(0);
  const [deviceCounts, setDeviceCounts] = useState({ total: 0, online: 0, approved: 0, pending: 0, denied: 0 });
  const [devicePage, setDevicePage] = useState(1);
  const [deviceTotalPages, setDeviceTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ONLINE' | 'OFFLINE' | 'APPROVED' | 'PENDING' | 'DENIED'

  // Shared state
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modals state
  const [selectedUser, setSelectedUser] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const [selectedApproval, setSelectedApproval] = useState(null);
  const [editDeviceModalVisible, setEditDeviceModalVisible] = useState(false);

  // Load Users from Backend
  const loadUsers = useCallback(async (pageNum = 1, query = searchQuery, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await adminService.fetchUsers({
        page: pageNum,
        limit: 10,
        searchQuery: query,
      });

      if (append) setUsers((prev) => [...prev, ...res.users]);
      else setUsers(res.users);

      setUserTotalCount(res.totalCount);
      setUserPage(res.page);
      setUserTotalPages(res.totalPages);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [searchQuery]);

  // Load Devices from Backend
  const loadDevices = useCallback(async (pageNum = 1, query = searchQuery, filter = statusFilter, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await deviceService.fetchDeviceApprovals({
        page: pageNum,
        limit: 10,
        searchQuery: query,
        statusFilter: filter,
      });

      if (append) setApprovals((prev) => [...prev, ...res.approvals]);
      else setApprovals(res.approvals);

      setDeviceTotalCount(res.totalCount);
      setDevicePage(res.page);
      setDeviceTotalPages(res.totalPages);

      if (res.counts) {
        setDeviceCounts(res.counts);
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch device approvals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [searchQuery, statusFilter]);

  // Reload when tab or status filter changes
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers(1, searchQuery);
    } else {
      loadDevices(1, searchQuery, statusFilter);
    }
  }, [activeTab, statusFilter, searchQuery, loadUsers, loadDevices]);

  // Silent in-place refresh for background polling without resetting scroll position or page count
  const silentRefreshDevices = useCallback(async () => {
    if (activeTab !== 'devices') return;
    try {
      const counts = await deviceService.fetchDeviceCounts();
      setDeviceCounts(counts);

      const currentCount = approvals.length || 10;
      const res = await deviceService.fetchDeviceApprovals({
        page: 1,
        limit: Math.max(10, currentCount),
        searchQuery,
        statusFilter,
      });

      if (res?.approvals) {
        setApprovals(res.approvals);
        setDeviceTotalCount(res.totalCount);
      }
    } catch (_e) {
      // Ignore background polling errors silently
    }
  }, [activeTab, approvals.length, searchQuery, statusFilter]);

  // Real-time live polling without jump / scroll reset
  useEffect(() => {
    if (activeTab !== 'devices') return;

    const livePollingTimer = setInterval(() => {
      silentRefreshDevices();
    }, 15000);

    return () => clearInterval(livePollingTimer);
  }, [activeTab, silentRefreshDevices]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'users') loadUsers(1, searchQuery);
    else loadDevices(1, searchQuery, statusFilter);
  };

  const handleSearchSubmit = () => {
    if (activeTab === 'users') loadUsers(1, searchQuery);
    else loadDevices(1, searchQuery, statusFilter);
  };

  const handleLoadMore = () => {
    if (loadingMore) return;

    if (activeTab === 'users' && userPage < userTotalPages) {
      loadUsers(userPage + 1, searchQuery, true);
    } else if (activeTab === 'devices' && devicePage < deviceTotalPages) {
      loadDevices(devicePage + 1, searchQuery, statusFilter, true);
    }
  };

  // User Actions
  const handleViewDetails = (userItem) => {
    router.push({
      pathname: '/admin/user-details',
      params: { userData: JSON.stringify(userItem) },
    });
  };

  const handleOpenEdit = (userItem) => {
    setSelectedUser(userItem);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (userId, updates) => {
    await adminService.adminUpdateUser(userId, updates);
    loadUsers(1, searchQuery);
    Alert.alert('Success', 'User profile updated successfully.');
  };

  const handleOpenPassword = (userItem) => {
    setSelectedUser(userItem);
    setPasswordModalVisible(true);
  };

  const handleSavePassword = async (userId, newPassword) => {
    await adminService.adminChangeUserPassword(userId, newPassword);
  };

  const handleToggleDisable = (userItem) => {
    const isCurrentlyDisabled = userItem.banned_until || userItem.role === 'disabled';
    const actionName = isCurrentlyDisabled ? 'Enable' : 'Disable';

    Alert.alert(
      `${actionName} User`,
      `Are you sure you want to ${actionName.toLowerCase()} ${userItem.full_name || userItem.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionName,
          style: isCurrentlyDisabled ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await adminService.adminToggleDisableUser(userItem.id, !isCurrentlyDisabled);
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

  const handleDeleteUser = (userItem) => {
    if (userItem.id === currentUser?.id) {
      Alert.alert('Action Denied', 'You cannot delete your own admin account.');
      return;
    }

    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${userItem.full_name || userItem.email}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminService.adminDeleteUser(userItem.id);
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

  // Device Approval Actions
  const handleApproveDevice = (approval) => {
    const userName = approval.profiles?.full_name || approval.profiles?.email || 'User';
    Alert.alert(
      'Approve Device',
      `Approve ${approval.device_name || 'this device'} for ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              await deviceService.approveDevice(approval.id, currentUser?.id, 'Approved by admin');
              loadDevices(1, searchQuery, statusFilter);
              Alert.alert('Success', 'Device has been approved successfully.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to approve device.');
            }
          },
        },
      ]
    );
  };

  const handleDenyDevice = (approval) => {
    const userName = approval.profiles?.full_name || approval.profiles?.email || 'User';
    Alert.alert(
      'Deny Device',
      `Are you sure you want to deny access to ${approval.device_name || 'this device'} for ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deny Access',
          style: 'destructive',
          onPress: async () => {
            try {
              await deviceService.denyDevice(approval.id, currentUser?.id, 'Access denied by admin');
              loadDevices(1, searchQuery, statusFilter);
              Alert.alert('Success', 'Device access has been denied.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to deny device.');
            }
          },
        },
      ]
    );
  };

  const handleOpenEditDevice = (approval) => {
    setSelectedApproval(approval);
    setEditDeviceModalVisible(true);
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
        {/* Top Screen Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#212529" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Admin Panel</Text>
            <Text style={styles.headerSubtitle}>
              {activeTab === 'users'
                ? `Total Registered Users: ${userTotalCount}`
                : `Total Device Requests: ${deviceTotalCount}`}
            </Text>
          </View>

          {activeTab === 'users' && (
            <TouchableOpacity
              style={styles.addUserBtn}
              onPress={() => setCreateModalVisible(true)}
            >
              <Ionicons name="person-add" size={18} color="#FFFFFF" />
              <Text style={styles.addUserBtnText}>Add User</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Switcher Bar: Users | Device Approvals */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'users' && styles.activeTabBtn]}
            onPress={() => {
              setActiveTab('users');
              setSearchQuery('');
            }}
          >
            <Ionicons
              name="people"
              size={18}
              color={activeTab === 'users' ? '#007AFF' : '#6C757D'}
            />
            <Text style={[styles.tabBtnText, activeTab === 'users' && styles.activeTabBtnText]}>
              Users Management
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'devices' && styles.activeTabBtn]}
            onPress={() => {
              setActiveTab('devices');
              setSearchQuery('');
            }}
          >
            <Ionicons
              name="phone-portrait"
              size={18}
              color={activeTab === 'devices' ? '#007AFF' : '#6C757D'}
            />
            <Text style={[styles.tabBtnText, activeTab === 'devices' && styles.activeTabBtnText]}>
              Device Approvals
            </Text>
          </TouchableOpacity>
        </View>

        {/* Device Summary Stats Grid (2x2) */}
        {activeTab === 'devices' && (
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <TouchableOpacity
                style={[styles.statCard, statusFilter === 'ALL' && styles.activeStatCard]}
                onPress={() => setStatusFilter('ALL')}
                activeOpacity={0.7}
              >
                <View style={styles.statCardHeader}>
                  <Ionicons
                    name="hardware-chip-outline"
                    size={16}
                    color={statusFilter === 'ALL' ? '#007AFF' : '#64748B'}
                  />
                  <Text style={[styles.statCardNum, statusFilter === 'ALL' && styles.activeStatCardNum]}>
                    {deviceCounts.total}
                  </Text>
                </View>
                <Text style={[styles.statCardLabel, statusFilter === 'ALL' && styles.activeStatCardLabel]}>
                  Total Devices
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statCard,
                  styles.onlineCardBg,
                  statusFilter === 'ONLINE' && styles.activeOnlineCard,
                ]}
                onPress={() => setStatusFilter('ONLINE')}
                activeOpacity={0.7}
              >
                <View style={styles.statCardHeader}>
                  <View style={styles.onlinePillDot} />
                  <Text style={[styles.statCardNum, { color: '#1B5E20' }]}>
                    {deviceCounts.online}
                  </Text>
                </View>
                <Text style={[styles.statCardLabel, { color: '#2E7D32' }]}>
                  Online Now
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <TouchableOpacity
                style={[styles.statCard, statusFilter === 'APPROVED' && styles.activeStatCard]}
                onPress={() => setStatusFilter('APPROVED')}
                activeOpacity={0.7}
              >
                <View style={styles.statCardHeader}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
                  <Text style={[styles.statCardNum, { color: '#065F46' }]}>
                    {deviceCounts.approved}
                  </Text>
                </View>
                <Text style={[styles.statCardLabel, statusFilter === 'APPROVED' && styles.activeStatCardLabel]}>
                  Approved
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statCard, statusFilter === 'PENDING' && styles.activeStatCard]}
                onPress={() => setStatusFilter('PENDING')}
                activeOpacity={0.7}
              >
                <View style={styles.statCardHeader}>
                  <Ionicons name="time-outline" size={16} color="#D97706" />
                  <Text style={[styles.statCardNum, { color: '#92400E' }]}>
                    {deviceCounts.pending}
                  </Text>
                </View>
                <Text style={[styles.statCardLabel, statusFilter === 'PENDING' && styles.activeStatCardLabel]}>
                  Pending Approval
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Device Status Filter Pills (Only on Devices Tab) */}
        {activeTab === 'devices' && (
          <View style={{ marginBottom: 12 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsContainer}
            >
              {['ALL', 'ONLINE', 'OFFLINE', 'APPROVED', 'PENDING', 'DENIED'].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterPill,
                    statusFilter === f && styles.activeFilterPill,
                    f === 'ONLINE' && statusFilter !== f && styles.onlineFilterPill,
                  ]}
                  onPress={() => setStatusFilter(f)}
                >
                  {f === 'ONLINE' && (
                    <View
                      style={[
                        styles.filterDot,
                        { backgroundColor: statusFilter === 'ONLINE' ? '#FFFFFF' : '#28A745' },
                      ]}
                    />
                  )}
                  {f === 'OFFLINE' && (
                    <View
                      style={[
                        styles.filterDot,
                        { backgroundColor: statusFilter === 'OFFLINE' ? '#FFFFFF' : '#868E96' },
                      ]}
                    />
                  )}
                  <Text
                    style={[
                      styles.filterPillText,
                      statusFilter === f && styles.activeFilterPillText,
                      f === 'ONLINE' && statusFilter !== f && { color: '#1B5E20' },
                    ]}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Search Input Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeTab === 'users'
                ? 'Search users by name, email, phone...'
                : 'Search device, model, user, or ID...'
            }
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => {
                setSearchQuery('');
                if (activeTab === 'users') loadUsers(1, '');
                else loadDevices(1, '', statusFilter);
              }}
            >
              <Ionicons name="close-circle" size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Main Content List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>
              {activeTab === 'users' ? 'Loading users...' : 'Loading device approvals...'}
            </Text>
          </View>
        ) : activeTab === 'users' ? (
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
        ) : (
          <FlatList
            data={approvals}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <DeviceApprovalCard
                approval={item}
                onApprove={handleApproveDevice}
                onDeny={handleDenyDevice}
                onEdit={handleOpenEditDevice}
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
                <Ionicons name="hardware-chip-outline" size={48} color="#CED4DA" />
                <Text style={styles.emptyTitle}>No Device Approvals Found</Text>
                <Text style={styles.emptyText}>
                  No device approval requests match the current search or status filter.
                </Text>
              </View>
            }
          />
        )}

        {/* User Management Modals */}
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

        {/* Device Approval Modal */}
        <EditDeviceApprovalModal
          visible={editDeviceModalVisible}
          approval={selectedApproval}
          onClose={() => setEditDeviceModalVisible(false)}
          onSaved={() => loadDevices(1, searchQuery, statusFilter)}
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
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  headerTitleContainer: {
    flex: 1,
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
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#E9ECEF',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  activeTabBtn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C757D',
  },
  activeTabBtnText: {
    color: '#007AFF',
    fontWeight: '700',
  },
  statsGrid: {
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  activeStatCard: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F7FF',
  },
  onlineCardBg: {
    backgroundColor: '#F7FCF8',
    borderColor: '#D1E7DD',
  },
  activeOnlineCard: {
    borderColor: '#28A745',
    backgroundColor: '#E8F5E9',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  onlinePillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#28A745',
  },
  statCardNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeStatCardNum: {
    color: '#007AFF',
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  activeStatCardLabel: {
    color: '#007AFF',
    fontWeight: '700',
  },
  filterPillsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#E9ECEF',
    gap: 5,
  },
  onlineFilterPill: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderWidth: 1,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeFilterPill: {
    backgroundColor: '#007AFF',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
  },
  activeFilterPillText: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 14,
    color: '#0F172A',
  },
  clearBtn: {
    padding: 4,
    marginLeft: 6,
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
