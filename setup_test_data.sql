-- Setup test data for invoice processing
-- This will create a test company and user relationship

-- First, insert a test user into auth.users (simulating a signed-up user)
INSERT INTO auth.users (
  id, 
  email, 
  encrypted_password, 
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'test@example.com',
  '$2a$10$K7TFjQAWAUnZLvhySGNBteZcKQZv9X9K7aZKKnVKZZk5e4L8qZXKa', -- password: 'password'
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Create a test company
INSERT INTO public.companies (
  id,
  name,
  legal_name,
  tax_id,
  fiscal_regime,
  economic_activity_code,
  economic_activity_name,
  sector,
  company_size,
  country,
  department,
  city
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'Test Company SAS',
  'Test Company Sociedad por Acciones Simplificada',
  '901234567-1',
  'common',
  '6201',
  'Actividades de programación informática',
  'services',
  'small',
  'CO',
  'Cundinamarca',
  'Bogotá'
) ON CONFLICT (id) DO NOTHING;

-- Create the user-company relationship
INSERT INTO public.user_companies (
  user_id,
  company_id,
  role,
  status,
  accepted_at
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  '123e4567-e89b-12d3-a456-426614174000',
  'owner',
  'active',
  NOW()
) ON CONFLICT (user_id, company_id) DO NOTHING;