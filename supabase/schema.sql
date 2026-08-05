-- Create profiles table with custom password column (no Supabase Auth GoTrue dependency)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If table already existed with auth.users foreign key constraint, drop it
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- If table already existed, ensure password column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT '';

-- Disable RLS on profiles table for direct application access
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Insert Initial Admin User
INSERT INTO public.profiles (full_name, email, phone, password, role)
VALUES ('System Admin', 'rationapp2026@gmail.com', '', 'Admin@123456', 'admin')
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  role = 'admin';
