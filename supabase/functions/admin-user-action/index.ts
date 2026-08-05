import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Create client with caller's auth header to check if caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing Auth Header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: userError } = await callerSupabase.auth.getUser();
    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller has admin role in profiles
    const { data: callerProfile, error: profileError } = await callerSupabase
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin Supabase client using Service Role Key
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, targetUserId, password, isDisable } = body;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Missing targetUserId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (action) {
      case 'delete_user': {
        // Sign out user globally to invalidate active sessions immediately
        await adminSupabase.auth.admin.signOut(targetUserId, 'global');
        // Delete user from auth (cascades to profile)
        const { error: delErr } = await adminSupabase.auth.admin.deleteUser(targetUserId);
        if (delErr) throw delErr;

        return new Response(JSON.stringify({ success: true, message: 'User deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'change_password': {
        if (!password || password.length < 6) {
          return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // Update user password
        const { error: passErr } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
          password,
        });
        if (passErr) throw passErr;

        // Invalidate all existing sessions for that user & force logout on all devices
        await adminSupabase.auth.admin.signOut(targetUserId, 'global');

        return new Response(JSON.stringify({ success: true, message: 'Password updated & sessions invalidated' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'toggle_disable': {
        const banDuration = isDisable ? '876000h' : 'none'; // 100 years or none
        const { error: banErr } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
          ban_duration: banDuration,
        });
        if (banErr) throw banErr;

        if (isDisable) {
          // Immediately invalidate all active sessions
          await adminSupabase.auth.admin.signOut(targetUserId, 'global');
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `User ${isDisable ? 'disabled' : 'enabled'} successfully`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
