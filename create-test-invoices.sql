-- Insert test invoices for pagination testing
-- First get a company ID (replace with actual ID)

WITH test_company AS (
  SELECT id FROM companies LIMIT 1
),
test_invoices AS (
  SELECT
    gen_random_uuid() as id,
    tc.id as company_id,
    'FAC-' || lpad(generate_series(1, 50)::text, 4, '0') as invoice_number,
    (current_date - (random() * 365)::int)::date as issue_date,
    CASE
      WHEN generate_series % 10 = 0 THEN 'Proveedor ABC S.A.S.'
      WHEN generate_series % 10 = 1 THEN 'Servicios XYZ Ltda.'
      WHEN generate_series % 10 = 2 THEN 'Comercial DEF S.A.'
      WHEN generate_series % 10 = 3 THEN 'Tecnología GHI S.A.S.'
      WHEN generate_series % 10 = 4 THEN 'Distribuidora JKL Ltda.'
      WHEN generate_series % 10 = 5 THEN 'Construcciones MNO S.A.'
      WHEN generate_series % 10 = 6 THEN 'Consultores PQR S.A.S.'
      WHEN generate_series % 10 = 7 THEN 'Logística STU Ltda.'
      WHEN generate_series % 10 = 8 THEN 'Manufacturas VWX S.A.'
      ELSE 'Alimentos YZ S.A.S.'
    END as supplier_name,
    CASE
      WHEN generate_series % 10 = 0 THEN '900123456-1'
      WHEN generate_series % 10 = 1 THEN '800234567-2'
      WHEN generate_series % 10 = 2 THEN '900345678-3'
      WHEN generate_series % 10 = 3 THEN '800456789-4'
      WHEN generate_series % 10 = 4 THEN '900567890-5'
      WHEN generate_series % 10 = 5 THEN '800678901-6'
      WHEN generate_series % 10 = 6 THEN '900789012-7'
      WHEN generate_series % 10 = 7 THEN '800890123-8'
      WHEN generate_series % 10 = 8 THEN '900901234-9'
      ELSE '800012345-0'
    END as supplier_tax_id,
    (100000 + (random() * 4900000)::int) as subtotal,
    ((100000 + (random() * 4900000)::int) * 0.19)::int as total_tax,
    CASE WHEN random() > 0.5 THEN ((100000 + (random() * 4900000)::int) * 0.025)::int ELSE 0 END as total_retention,
    ((100000 + (random() * 4900000)::int) * 1.19)::int as total_amount,
    CASE
      WHEN random() < 0.25 THEN 'pending'
      WHEN random() < 0.5 THEN 'validated'
      WHEN random() < 0.75 THEN 'error'
      ELSE 'review'
    END as status,
    'completed' as processing_status,
    CASE WHEN random() > 0.3 THEN (1000 + (random() * 8999)::int)::text ELSE NULL END as puc_code,
    CASE WHEN random() > 0.3 THEN 'Cuenta PUC ' || (1000 + (random() * 8999)::int)::text ELSE NULL END as puc_name,
    random() > 0.8 as manual_review_required,
    CASE WHEN random() > 0.5 THEN 'xml' ELSE 'pdf' END as source_file_type,
    '{"test": true}'::jsonb as raw_data,
    now() as created_at,
    now() as updated_at,
    generate_series
  FROM test_company tc, generate_series(1, 50)
)
INSERT INTO invoices (
  id, company_id, invoice_number, issue_date, supplier_name, supplier_tax_id,
  subtotal, total_tax, total_retention, total_amount, status, processing_status,
  puc_code, puc_name, manual_review_required, source_file_type, raw_data,
  created_at, updated_at
)
SELECT
  id, company_id, invoice_number, issue_date, supplier_name, supplier_tax_id,
  subtotal, total_tax, total_retention, total_amount, status, processing_status,
  puc_code, puc_name, manual_review_required, source_file_type, raw_data,
  created_at, updated_at
FROM test_invoices;