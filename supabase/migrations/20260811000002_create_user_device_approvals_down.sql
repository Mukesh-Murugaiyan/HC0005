-- ============================================================================
-- Migration: Rollback User Device Approvals System (DOWN Migration)
-- Timestamp: 20260811000002
-- Description: Safely removes ONLY the user_device_approvals table and its
--              associated indexes/constraints.
-- SAFETY GUARANTEE: Does NOT drop or alter public.profiles or any other table.
--                   Does NOT delete any existing user account data.
-- ============================================================================

-- 1. Safely drop user_device_approvals table and dependent constraints/indexes if table exists
DROP TABLE IF EXISTS public.user_device_approvals CASCADE;
