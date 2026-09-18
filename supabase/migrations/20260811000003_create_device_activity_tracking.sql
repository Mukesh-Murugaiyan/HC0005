-- ============================================================================
-- Migration: Create Device Activity & Online/Offline Tracking (UP Migration)
-- Timestamp: 20260811000003
-- Description: Adds online/offline status, last seen, usage duration columns
--              to user_device_approvals, creates device_activity_sessions table,
--              and creates atomic stored procedures for heartbeats and stale cleanup.
--              Idempotent and safe to run on existing databases.
-- ============================================================================

-- 1. Extend user_device_approvals with activity and online status columns
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS total_usage_seconds BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS today_usage_seconds BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS today_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS current_session_started_at TIMESTAMPTZ;

-- 2. Create index on (is_online, last_seen_at) for high-performance stale queries & admin filters
CREATE INDEX IF NOT EXISTS idx_user_device_approvals_online_status ON public.user_device_approvals(is_online, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_user_device_approvals_last_seen ON public.user_device_approvals(last_seen_at DESC);

-- 3. Create device_activity_sessions table for historical usage logging
CREATE TABLE IF NOT EXISTS public.device_activity_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
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

-- Ensure foreign key for user_id referencing profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_device_activity_sessions_user'
  ) THEN
    ALTER TABLE public.device_activity_sessions
      ADD CONSTRAINT fk_device_activity_sessions_user
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create unique index on (user_id, device_id, session_id) so sessions can be upserted cleanly
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_activity_sessions_uid_session ON public.device_activity_sessions(user_id, device_id, session_id);
CREATE INDEX IF NOT EXISTS idx_device_activity_sessions_lookup ON public.device_activity_sessions(user_id, device_id, session_start DESC);

-- Disable RLS on device_activity_sessions to match app pattern
ALTER TABLE public.device_activity_sessions DISABLE ROW LEVEL SECURITY;

-- 4. Create Atomic Stored Procedure: record_device_heartbeat
-- This function:
--   a) Updates user_device_approvals (online status, last_seen_at, increments total_usage_seconds)
--   b) Upserts device_activity_sessions for the current session
--   c) Cleans up any stale online sessions older than 50 seconds (anti-ghost mechanism)
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

  -- 2. Locate or verify approval record for this user and device
  SELECT id INTO v_approval_id
  FROM public.user_device_approvals
  WHERE user_id = p_user_id AND device_id = p_device_id
  LIMIT 1;

  IF v_approval_id IS NOT NULL THEN
    -- Atomically update status and increment duration
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

-- Grant execution permission on stored procedure
GRANT EXECUTE ON FUNCTION public.record_device_heartbeat(UUID, TEXT, BOOLEAN, INTEGER, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
