-- ============================================================================
-- Migration: Base Schema (Profiles Table & Initial Admin)
-- Timestamp: 20260811000001
-- Description: Idempotent base migration for user profiles
-- ============================================================================

-- 1. Create profiles table with custom password column
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

-- 2. If legacy auth.users foreign key exists, safely drop it
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. Ensure password column exists on existing profiles tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT '';

-- 4. Disable RLS on profiles table for direct application access
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 5. Insert or update initial System Admin user
INSERT INTO public.profiles (full_name, email, phone, password, role)
VALUES ('System Admin', 'rationapp2026@gmail.com', '', 'Admin@123456', 'admin')
ON CONFLICT (email) DO UPDATE SET
  role = 'admin';
