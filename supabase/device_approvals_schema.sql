-- Create user_device_approvals table for device-based authentication and approval system
CREATE TABLE IF NOT EXISTS public.user_device_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT DEFAULT '',
  device_model TEXT DEFAULT '',
  platform TEXT DEFAULT '',
  os_version TEXT DEFAULT '',
  app_version TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DENIED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  denied_at TIMESTAMPTZ,
  denied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  remarks TEXT DEFAULT '',
  CONSTRAINT user_device_unique UNIQUE (user_id, device_id)
);

-- Performance indices for querying approvals
CREATE INDEX IF NOT EXISTS idx_user_device_approvals_user_device ON public.user_device_approvals(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_user_device_approvals_status ON public.user_device_approvals(status);

-- Disable Row Level Security (RLS) for direct application access matching profiles table pattern
ALTER TABLE public.user_device_approvals DISABLE ROW LEVEL SECURITY;
