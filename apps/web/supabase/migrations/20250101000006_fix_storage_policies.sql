/**
 * Fix Storage Policies - Correct Table Name References
 * Updates storage policies to use the correct 'user_companies' table instead of 'company_memberships'
 */

-- Drop existing storage policies that reference incorrect table name
DROP POLICY IF EXISTS "Users can view company files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload company files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update company files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete company files" ON storage.objects;

-- Recreate policies with correct table name (user_companies instead of company_memberships)

-- Policy: Users can view files from their company
CREATE POLICY "Users can view company files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'invoice-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM companies c
    JOIN user_companies uc ON uc.company_id = c.id
    WHERE uc.user_id = auth.uid() AND uc.status = 'active'
  )
);

-- Policy: Users can upload files to their company folder
CREATE POLICY "Users can upload company files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'invoice-files'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM companies c
    JOIN user_companies uc ON uc.company_id = c.id
    WHERE uc.user_id = auth.uid() 
      AND uc.status = 'active'
      AND uc.role IN ('owner', 'admin', 'accountant', 'viewer')
  )
);

-- Policy: Users can update files from their company
CREATE POLICY "Users can update company files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'invoice-files'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM companies c
    JOIN user_companies uc ON uc.company_id = c.id
    WHERE uc.user_id = auth.uid() 
      AND uc.status = 'active'
      AND uc.role IN ('owner', 'admin', 'accountant')
  )
);

-- Policy: Admins and owners can delete files from their company
CREATE POLICY "Admins can delete company files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'invoice-files'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM companies c
    JOIN user_companies uc ON uc.company_id = c.id
    WHERE uc.user_id = auth.uid() 
      AND uc.status = 'active'
      AND uc.role IN ('owner', 'admin')
  )
);

-- Update the validation function to use correct table name
CREATE OR REPLACE FUNCTION validate_file_upload(
  company_id_param UUID,
  file_path TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_has_permission BOOLEAN := FALSE;
BEGIN
  -- Check if user has permission to upload to this company (using correct table name)
  SELECT EXISTS (
    SELECT 1 FROM user_companies
    WHERE user_id = auth.uid()
      AND company_id = company_id_param
      AND status = 'active'
      AND role IN ('owner', 'admin', 'accountant', 'viewer')
  ) INTO user_has_permission;

  -- Check if file path starts with company ID
  IF user_has_permission AND file_path LIKE company_id_param::TEXT || '/%' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION validate_file_upload IS 'Validates if a user can upload files for a specific company (fixed table reference)';