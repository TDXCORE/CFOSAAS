/**
 * Invoice File Storage Setup
 * Creates storage bucket and policies for invoice attachments
 */

-- Create storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-files',
  'invoice-files',
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY['application/xml', 'text/xml', 'application/pdf', 'application/zip', 'application/x-zip-compressed']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Enable Row Level Security on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view files from their company
CREATE POLICY "Users can view company files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'invoice-files' 
  AND (storage.foldername(name))[1] IN (
    SELECT c.id 
    FROM companies c
    JOIN company_memberships cm ON cm.company_id = c.id
    WHERE cm.user_id = auth.uid()
  )
);

-- Policy: Users can upload files to their company folder
CREATE POLICY "Users can upload company files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'invoice-files'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id 
    FROM companies c
    JOIN company_memberships cm ON cm.company_id = c.id
    WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin', 'member')
  )
);

-- Policy: Users can update files from their company
CREATE POLICY "Users can update company files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'invoice-files'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id 
    FROM companies c
    JOIN company_memberships cm ON cm.company_id = c.id
    WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin', 'member')
  )
);

-- Policy: Admins and owners can delete files from their company
CREATE POLICY "Admins can delete company files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'invoice-files'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id 
    FROM companies c
    JOIN company_memberships cm ON cm.company_id = c.id
    WHERE cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
  )
);

-- Create index for faster file lookups by company
CREATE INDEX IF NOT EXISTS idx_storage_objects_company_folder 
ON storage.objects (bucket_id, (storage.foldername(name))[1])
WHERE bucket_id = 'invoice-files';

-- Add file processing status tracking to invoices table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'file_processing_status'
  ) THEN
    ALTER TABLE invoices ADD COLUMN file_processing_status TEXT DEFAULT 'pending';
    ALTER TABLE invoices ADD CONSTRAINT check_file_processing_status 
    CHECK (file_processing_status IN ('pending', 'processing', 'completed', 'failed'));
  END IF;
END
$$;

-- Add storage path column to invoices (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE invoices ADD COLUMN storage_path TEXT;
  END IF;
END
$$;

-- Create function to validate file upload permissions
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
  -- Check if user has permission to upload to this company
  SELECT EXISTS (
    SELECT 1 FROM company_memberships
    WHERE user_id = auth.uid()
      AND company_id = company_id_param
      AND role IN ('owner', 'admin', 'member')
  ) INTO user_has_permission;

  -- Check if file path starts with company ID
  IF user_has_permission AND file_path LIKE company_id_param::TEXT || '/%' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Grant execute permission on the validation function
GRANT EXECUTE ON FUNCTION validate_file_upload(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION validate_file_upload IS 'Validates if a user can upload files for a specific company';