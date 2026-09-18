-- ============================================================================
-- Complete Master Schema - Idempotent Baseline Setup
-- Contains: profiles table, user_device_approvals table, indexes & seed data
-- Safe to execute on both fresh databases and existing production databases.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE SETUP
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop legacy auth.users constraint if present
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Ensure password column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT '';

-- Disable RLS on profiles for direct application access
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Seed Initial Admin User
INSERT INTO public.profiles (full_name, email, phone, password, role)
VALUES ('System Admin', 'rationapp2026@gmail.com', '', 'Admin@123456', 'admin')
ON CONFLICT (email) DO UPDATE SET
  role = 'admin';


-- ----------------------------------------------------------------------------
-- 2. USER DEVICE APPROVALS TABLE SETUP
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_device_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT DEFAULT '',
  device_model TEXT DEFAULT '',
  platform TEXT DEFAULT '',
  os_version TEXT DEFAULT '',
  app_version TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  denied_at TIMESTAMPTZ,
  denied_by UUID,
  remarks TEXT DEFAULT ''
);

-- Ensure all columns exist (idempotent for existing tables)
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT '';
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS device_model TEXT DEFAULT '';
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT '';
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS os_version TEXT DEFAULT '';
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS app_version TEXT DEFAULT '';
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS denied_at TIMESTAMPTZ;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS denied_by UUID;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT '';

-- Add Foreign Key for user_id referencing profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_device_approvals_user'
  ) THEN
    ALTER TABLE public.user_device_approvals
      ADD CONSTRAINT fk_user_device_approvals_user
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add Foreign Key for approved_by referencing profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_device_approvals_approved_by'
  ) THEN
    ALTER TABLE public.user_device_approvals
      ADD CONSTRAINT fk_user_device_approvals_approved_by
      FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add Foreign Key for denied_by referencing profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_device_approvals_denied_by'
  ) THEN
    ALTER TABLE public.user_device_approvals
      ADD CONSTRAINT fk_user_device_approvals_denied_by
      FOREIGN KEY (denied_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add Unique Constraint on (user_id, device_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_device_unique'
  ) THEN
    ALTER TABLE public.user_device_approvals
      ADD CONSTRAINT user_device_unique UNIQUE (user_id, device_id);
  END IF;
END $$;

-- Add Status Check Constraint ('PENDING', 'APPROVED', 'DENIED')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_device_approvals_status_check'
  ) THEN
    ALTER TABLE public.user_device_approvals
      ADD CONSTRAINT user_device_approvals_status_check
      CHECK (status IN ('PENDING', 'APPROVED', 'DENIED'));
  END IF;
END $$;

-- Create Indexes IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_user_device_approvals_user_device ON public.user_device_approvals(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_user_device_approvals_status ON public.user_device_approvals(status);

-- Disable RLS on user_device_approvals table
ALTER TABLE public.user_device_approvals DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Device Activity & Online/Offline Tracking System
-- ============================================================================

-- Activity and online status columns on user_device_approvals
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS total_usage_seconds BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS current_session_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_device_approvals_online_status ON public.user_device_approvals(is_online, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_user_device_approvals_last_seen ON public.user_device_approvals(last_seen_at DESC);

-- Historical session logging table
CREATE TABLE IF NOT EXISTS public.device_activity_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  platform TEXT DEFAULT '',
  app_version TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_activity_sessions_uid_session ON public.device_activity_sessions(user_id, device_id, session_id);
CREATE INDEX IF NOT EXISTS idx_device_activity_sessions_lookup ON public.device_activity_sessions(user_id, device_id, session_start DESC);
ALTER TABLE public.device_activity_sessions DISABLE ROW LEVEL SECURITY;

-- Atomic Heartbeat Stored Procedure with automatic stale session cleanup
CREATE OR REPLACE FUNCTION public.record_device_heartbeat(
  p_user_id UUID,
  p_device_id TEXT,
  p_is_online BOOLEAN,
  p_delta_seconds INTEGER,
  p_session_id TEXT,
  p_platform TEXT DEFAULT '',
  p_app_version TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approval_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_total_usage BIGINT;
  v_stale_count INTEGER;
BEGIN
  -- 1. Clean up stale online sessions across all devices (older than 50 seconds)
  UPDATE public.user_device_approvals
  SET is_online = FALSE,
      updated_at = v_now
  WHERE is_online = TRUE
    AND last_seen_at < (v_now - INTERVAL '50 seconds');
  GET DIAGNOSTICS v_stale_count = ROW_COUNT;

  -- 2. Locate approval record for this user and device
  SELECT id INTO v_approval_id
  FROM public.user_device_approvals
  WHERE user_id = p_user_id AND device_id = p_device_id
  LIMIT 1;

  IF v_approval_id IS NOT NULL THEN
    UPDATE public.user_device_approvals
    SET
      is_online = p_is_online,
      last_seen_at = v_now,
      last_active_at = v_now,
      total_usage_seconds = total_usage_seconds + GREATEST(0, p_delta_seconds),
      current_session_started_at = CASE
        WHEN p_is_online = TRUE AND (current_session_started_at IS NULL OR is_online = FALSE) THEN v_now
        WHEN p_is_online = FALSE THEN NULL
        ELSE current_session_started_at
      END,
      updated_at = v_now
    WHERE id = v_approval_id
    RETURNING total_usage_seconds INTO v_total_usage;
  END IF;

  -- 3. Log / update the session in device_activity_sessions if session_id is provided
  IF p_session_id IS NOT NULL AND p_session_id <> '' THEN
    INSERT INTO public.device_activity_sessions (
      user_id,
      device_id,
      session_id,
      session_start,
      session_end,
      duration_seconds,
      platform,
      app_version,
      created_at,
      updated_at
    )
    VALUES (
      p_user_id,
      p_device_id,
      p_session_id,
      v_now,
      v_now,
      GREATEST(0, p_delta_seconds),
      COALESCE(p_platform, ''),
      COALESCE(p_app_version, ''),
      v_now,
      v_now
    )
    ON CONFLICT (user_id, device_id, session_id)
    DO UPDATE SET
      session_end = v_now,
      duration_seconds = public.device_activity_sessions.duration_seconds + GREATEST(0, p_delta_seconds),
      updated_at = v_now;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'device_id', p_device_id,
    'is_online', p_is_online,
    'last_seen_at', v_now,
    'total_usage_seconds', COALESCE(v_total_usage, 0),
    'stale_cleaned', v_stale_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_device_heartbeat(UUID, TEXT, BOOLEAN, INTEGER, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;

