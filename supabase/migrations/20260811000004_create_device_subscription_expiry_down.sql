-- ============================================================================
-- Migration: Create Device Subscription & Automated Expiry System (DOWN Migration)
-- Timestamp: 20260811000004
-- ============================================================================

DROP TRIGGER IF EXISTS trg_handle_device_approval_subscription ON public.user_device_approvals;
DROP FUNCTION IF EXISTS public.trigger_handle_device_approval_subscription();
DROP FUNCTION IF EXISTS public.expire_overdue_device_subscriptions();

DROP INDEX IF EXISTS public.idx_user_device_approvals_sub_expiry;
DROP INDEX IF EXISTS public.idx_user_device_approvals_sub_active;

ALTER TABLE public.user_device_approvals DROP COLUMN IF EXISTS subscription_start_at;
ALTER TABLE public.user_device_approvals DROP COLUMN IF EXISTS subscription_expires_at;
ALTER TABLE public.user_device_approvals DROP COLUMN IF EXISTS subscription_days;
ALTER TABLE public.user_device_approvals DROP COLUMN IF EXISTS is_subscription_active;
