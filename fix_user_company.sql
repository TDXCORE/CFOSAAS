-- Fix user-company relationship for email integration
-- This should be run in your Supabase SQL editor

-- Check current user-company relationships
SELECT uc.*, u.email, c.name as company_name 
FROM user_companies uc
JOIN auth.users u ON uc.user_id = u.id
JOIN companies c ON uc.company_id = c.id
WHERE uc.user_id = '9f4c99c5-8b42-41e5-95fa-5d8844687e4b';

-- If no relationship exists, insert one
INSERT INTO user_companies (
  id,
  user_id,
  company_id,
  role,
  status,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  '9f4c99c5-8b42-41e5-95fa-5d8844687e4b',
  '550e8400-e29b-41d4-a716-446655440000',
  'owner',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (user_id, company_id) DO UPDATE SET
  status = 'active',
  updated_at = NOW();

-- Verify the relationship was created
SELECT uc.*, u.email, c.name as company_name 
FROM user_companies uc
JOIN auth.users u ON uc.user_id = u.id
JOIN companies c ON uc.company_id = c.id
WHERE uc.user_id = '9f4c99c5-8b42-41e5-95fa-5d8844687e4b'
AND uc.company_id = '550e8400-e29b-41d4-a716-446655440000';