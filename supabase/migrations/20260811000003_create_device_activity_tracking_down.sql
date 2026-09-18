-- ============================================================================
-- Migration: Create Device Activity & Online/Offline Tracking (DOWN Migration)
-- Timestamp: 20260811000003
-- ============================================================================

DROP FUNCTION IF EXISTS public.record_device_heartbeat(UUID, TEXT, BOOLEAN, INTEGER, TEXT, TEXT, TEXT);
DROP TABLE IF EXISTS public.device_activity_sessions CASCADE;

ALTER TABLE public.user_device_approvals DROP COLUMN IF EXISTS is_online;
ALTER TABLE public.user_device_approvals DROP COLUMN IF EXISTS last_seen_at;
ALTER TABLE public.user_device_approvals DROP COLUMN IF EXISTS last_active_at;
ALTER TABLE public.user_device_approvals DROP COLUMN IF EXISTS total_usage_seconds;
ALTER TABLE public.user_device_approvals DROP COLUMN IF EXISTS current_session_started_at;

DROP INDEX IF EXISTS public.idx_user_device_approvals_online_status;
DROP INDEX IF EXISTS public.idx_user_device_approvals_last_seen;
