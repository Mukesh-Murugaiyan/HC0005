-- ============================================================================
-- Migration: Create Device Subscription & Automated Expiry System (UP Migration)
-- Timestamp: 20260811000004
-- Description: Adds subscription start, expiry, duration, and active status columns
--              to user_device_approvals. Adds automated PostgreSQL trigger for
--              30-day subscription calculation on approval, and stored procedure
--              for atomic automatic expiration and reversion back to PENDING.
--              Idempotent and safe to run on existing databases.
-- ============================================================================

-- 1. Add subscription columns to user_device_approvals table
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS subscription_start_at TIMESTAMPTZ;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS subscription_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE public.user_device_approvals ADD COLUMN IF NOT EXISTS is_subscription_active BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Populate existing APPROVED records with 30-day subscription if missing
UPDATE public.user_device_approvals
SET
  subscription_start_at = COALESCE(approved_at, created_at, NOW()),
  subscription_days = 30,
  subscription_expires_at = COALESCE(approved_at, created_at, NOW()) + INTERVAL '30 days',
  is_subscription_active = CASE
    WHEN (COALESCE(approved_at, created_at, NOW()) + INTERVAL '30 days') > NOW() THEN TRUE
    ELSE FALSE
  END
WHERE status = 'APPROVED' AND subscription_expires_at IS NULL;

-- 3. Create high-performance indexes for subscription and expiry queries
CREATE INDEX IF NOT EXISTS idx_user_device_approvals_sub_expiry 
  ON public.user_device_approvals(subscription_expires_at);

CREATE INDEX IF NOT EXISTS idx_user_device_approvals_sub_active 
  ON public.user_device_approvals(is_subscription_active, subscription_expires_at);

-- 4. Create Database Trigger: Automatically handle 30-day subscription window on approval
CREATE OR REPLACE FUNCTION public.trigger_handle_device_approval_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_days INTEGER;
BEGIN
  IF NEW.status = 'APPROVED' THEN
    -- If status is changing to APPROVED or approved_at timestamp is being updated/initialized
    IF (TG_OP = 'INSERT') 
       OR (OLD.status IS DISTINCT FROM 'APPROVED') 
       OR (NEW.approved_at IS DISTINCT FROM OLD.approved_at)
       OR (NEW.subscription_start_at IS NULL)
       OR (NEW.subscription_expires_at IS NULL) THEN
      
      -- Ensure approved_at is set to the exact time it was updated to Approved
      IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM 'APPROVED') OR (NEW.approved_at IS NULL) THEN
        NEW.approved_at := COALESCE(NEW.approved_at, v_now);
      END IF;

      -- Set the subscription start date to the exact date and time when the device was updated to Approved
      NEW.subscription_start_at := NEW.approved_at;
      v_days := GREATEST(1, COALESCE(NEW.subscription_days, 30));
      NEW.subscription_days := v_days;
      -- Calculate 30-day subscription period from that timestamp
      NEW.subscription_expires_at := NEW.subscription_start_at + (v_days || ' days')::INTERVAL;
      NEW.is_subscription_active := (NEW.subscription_expires_at > v_now);
    END IF;
  ELSIF NEW.status IN ('PENDING', 'DENIED') THEN
    -- Inactivate subscription if pending or denied
    NEW.is_subscription_active := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_device_approval_subscription ON public.user_device_approvals;
CREATE TRIGGER trg_handle_device_approval_subscription
BEFORE INSERT OR UPDATE OF status, approved_at, subscription_days
ON public.user_device_approvals
FOR EACH ROW
EXECUTE FUNCTION public.trigger_handle_device_approval_subscription();

-- 5. Stored Procedure: expire_overdue_device_subscriptions
-- Automatically updates any APPROVED device whose 30-day subscription has ended (subscription_expires_at <= NOW())
-- Transitions status back to 'PENDING' and marks is_subscription_active = FALSE
CREATE OR REPLACE FUNCTION public.expire_overdue_device_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  UPDATE public.user_device_approvals
  SET
    status = 'PENDING',
    is_subscription_active = FALSE,
    remarks = CASE
      WHEN remarks IS NULL OR remarks = '' 
        THEN 'Subscription period (30 days) completed. Device status automatically reverted to Pending.'
      WHEN remarks NOT LIKE '%Subscription period (30 days) completed%' 
        THEN remarks || ' | Subscription period (30 days) completed. Device status automatically reverted to Pending.'
      ELSE remarks
    END,
    updated_at = v_now
  WHERE status = 'APPROVED'
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at <= v_now;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_overdue_device_subscriptions() TO authenticated, anon, service_role;

-- 6. Update record_device_heartbeat stored procedure to sweep expired subscriptions on every heartbeat
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
  v_today_date DATE := CURRENT_DATE;
  v_total_usage BIGINT;
  v_today_usage BIGINT;
  v_stale_count INTEGER;
  v_expired_count INTEGER;
BEGIN
  -- 1. Clean up stale online sessions across all devices (older than 50 seconds)
  UPDATE public.user_device_approvals
  SET is_online = FALSE,
      updated_at = v_now
  WHERE is_online = TRUE
    AND last_seen_at < (v_now - INTERVAL '50 seconds');
  GET DIAGNOSTICS v_stale_count = ROW_COUNT;

  -- 2. Sweep and auto-expire overdue subscriptions (automatically reverts status to PENDING)
  SELECT public.expire_overdue_device_subscriptions() INTO v_expired_count;

  -- 3. Locate approval record for this user and device
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
      today_usage_seconds = CASE
        WHEN today_date = v_today_date THEN today_usage_seconds + GREATEST(0, p_delta_seconds)
        ELSE GREATEST(0, p_delta_seconds)
      END,
      today_date = v_today_date,
      current_session_started_at = CASE
        WHEN p_is_online = TRUE AND (current_session_started_at IS NULL OR is_online = FALSE) THEN v_now
        WHEN p_is_online = FALSE THEN NULL
        ELSE current_session_started_at
      END,
      updated_at = v_now
    WHERE id = v_approval_id
    RETURNING total_usage_seconds, today_usage_seconds INTO v_total_usage, v_today_usage;
  END IF;

  -- 4. Log / update the session in device_activity_sessions if session_id is provided
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
    'today_usage_seconds', COALESCE(v_today_usage, 0),
    'stale_cleaned', v_stale_count,
    'subscriptions_expired', v_expired_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_device_heartbeat(UUID, TEXT, BOOLEAN, INTEGER, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
