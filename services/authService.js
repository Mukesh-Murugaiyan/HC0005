import { supabase } from './supabase';
import { deviceService } from './deviceService';

export const authService = {
  /**
   * Log in user with email and password via profiles table & verify device approval
   */
  async login(email, password) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !data) {
      throw new Error('Invalid email or password.');
    }

    if (data.password !== password) {
      throw new Error('Invalid email or password.');
    }

    // Check or create device approval record in database
    const deviceApproval = await deviceService.checkOrRegisterDevice(data.id, data.role);

    const sessionData = {
      user: data,
      session: {
        access_token: data.id,
        user: data,
      },
      deviceApproval,
      deviceStatus: deviceApproval?.status || 'PENDING',
    };

    return sessionData;
  },

  /**
   * Register a new user in profiles table & check/register device
   */
  async register(fullName, email, phone, password, role = 'user') {
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
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

    if (error) throw new Error(error.message || 'Registration failed.');

    const deviceApproval = await deviceService.checkOrRegisterDevice(data.id, data.role);

    return {
      user: data,
      session: {
        access_token: data.id,
        user: data,
      },
      deviceApproval,
      deviceStatus: deviceApproval?.status || 'PENDING',
    };
  },

  /**
   * Fetch profile by user ID
   */
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update profile information
   */
  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.full_name,
        phone: updates.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Change current user's own password in profiles table
   */
  async changeOwnPassword(userId, newPassword) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        password: newPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
