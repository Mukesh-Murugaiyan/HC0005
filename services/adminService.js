import { supabase } from './supabase';

export const adminService = {
  /**
   * Fetch all registered users with pagination & search
   */
  async fetchUsers({ page = 1, limit = 10, searchQuery = '' } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (searchQuery && searchQuery.trim() !== '') {
      const q = `%${searchQuery.trim()}%`;
      query = query.or(`full_name.ilike.${q},email.ilike.${q},phone.ilike.${q}`);
    }

    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      users: data || [],
      totalCount: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  },

  /**
   * Admin create a new user in profiles table
   */
  async adminCreateUser(fullName, email, phone, password, role = 'user') {
    const cleanEmail = email.trim().toLowerCase();

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      throw new Error('User with this email already exists.');
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert([
        {
          full_name: fullName.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          password: password,
          role: role,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message || 'Failed to create user.');
    return data;
  },

  /**
   * Admin update user info in profiles (Name, Phone, Role)
   */
  async adminUpdateUser(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.full_name,
        phone: updates.phone,
        role: updates.role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Admin delete user from profiles table
   */
  async adminDeleteUser(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw new Error(error.message || 'Failed to delete user.');
    return data;
  },

  /**
   * Admin change user password in profiles table
   */
  async adminChangeUserPassword(userId, newPassword) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        password: newPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message || 'Failed to change password.');
    return data;
  },

  /**
   * Admin disable/enable user in profiles table
   */
  async adminToggleDisableUser(userId, isDisable) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        role: isDisable ? 'disabled' : 'user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message || 'Failed to update user status.');
    return data;
  },
};
