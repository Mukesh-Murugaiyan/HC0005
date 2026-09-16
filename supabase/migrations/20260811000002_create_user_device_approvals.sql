-- ============================================================================
-- Migration: Create User Device Approvals System (UP Migration)
-- Timestamp: 20260811000002
-- Description: Idempotent migration creating user_device_approvals table,
--              foreign keys, indexes, and status constraints safely.
--              Safe to execute on BOTH Fresh DBs and Production DBs with existing data.
-- ============================================================================

-- 1. Create user_device_approvals table if it does not already exist
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

-- 2. Ensure all columns exist (idempotent for existing/partially updated tables)
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

-- 3. Add Foreign Key for user_id referencing profiles(id) if not already present
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

-- 4. Add Foreign Key for approved_by referencing profiles(id) if not already present
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

-- 5. Add Foreign Key for denied_by referencing profiles(id) if not already present
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

-- 6. Add Unique Constraint on (user_id, device_id) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_device_unique'
  ) THEN
    ALTER TABLE public.user_device_approvals
      ADD CONSTRAINT user_device_unique UNIQUE (user_id, device_id);
  END IF;
END $$;

-- 7. Add Status Check Constraint ('PENDING', 'APPROVED', 'DENIED') if not already present
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

-- 8. Create Indexes IF NOT EXISTS for lookup performance
CREATE INDEX IF NOT EXISTS idx_user_device_approvals_user_device ON public.user_device_approvals(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_user_device_approvals_status ON public.user_device_approvals(status);

-- 9. Disable RLS on user_device_approvals table for direct application access matching profiles table pattern
ALTER TABLE public.user_device_approvals DISABLE ROW LEVEL SECURITY;
