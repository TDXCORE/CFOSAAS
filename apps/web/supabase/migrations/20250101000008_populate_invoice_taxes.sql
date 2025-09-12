-- Populate invoice_taxes table from existing invoices
-- This creates tax records based on the total_tax and total_retention amounts in invoices

INSERT INTO public.invoice_taxes (
  id,
  invoice_id,
  company_id,
  tax_type,
  tax_category,
  taxable_base,
  tax_rate,
  tax_amount,
  dian_code,
  calculation_method,
  applied_rule,
  confidence,
  created_at
)
-- Insert IVA records for all invoices that have total_tax > 0
SELECT 
  gen_random_uuid() as id,
  i.id as invoice_id,
  i.company_id,
  'IVA' as tax_type,
  'general' as tax_category,
  i.subtotal as taxable_base,
  0.19 as tax_rate,
  i.total_tax as tax_amount,
  '01' as dian_code,
  'automatic' as calculation_method,
  'IVA General 19%' as applied_rule,
  0.95 as confidence,
  NOW() as created_at
FROM public.invoices i 
WHERE i.total_tax > 0
AND NOT EXISTS (
  SELECT 1 FROM public.invoice_taxes it 
  WHERE it.invoice_id = i.id AND it.tax_type = 'IVA'
);

-- Insert retention records for all invoices that have total_retention > 0
INSERT INTO public.invoice_taxes (
  id,
  invoice_id,
  company_id,
  tax_type,
  tax_category,
  taxable_base,
  tax_rate,
  tax_amount,
  dian_code,
  calculation_method,
  applied_rule,
  confidence,
  created_at
)
SELECT 
  gen_random_uuid() as id,
  i.id as invoice_id,
  i.company_id,
  'RETENCION_FUENTE' as tax_type,
  'services' as tax_category,
  i.subtotal as taxable_base,
  CASE 
    WHEN i.total_retention > 0 AND i.subtotal > 0 
    THEN ROUND((i.total_retention / i.subtotal)::decimal, 4)
    ELSE 0.025 
  END as tax_rate,
  i.total_retention as tax_amount,
  '02' as dian_code,
  'automatic' as calculation_method,
  'Retención en la fuente' as applied_rule,
  0.90 as confidence,
  NOW() as created_at
FROM public.invoices i 
WHERE i.total_retention > 0
AND NOT EXISTS (
  SELECT 1 FROM public.invoice_taxes it 
  WHERE it.invoice_id = i.id AND it.tax_type = 'RETENCION_FUENTE'
);

-- Verify the results
SELECT 
  'Summary' as type,
  COUNT(*) as total_tax_records,
  COUNT(DISTINCT invoice_id) as invoices_with_taxes,
  SUM(CASE WHEN tax_type = 'IVA' THEN tax_amount ELSE 0 END) as total_iva,
  SUM(CASE WHEN tax_type = 'RETENCION_FUENTE' THEN tax_amount ELSE 0 END) as total_retentions
FROM public.invoice_taxes;

-- Show breakdown by tax type
SELECT 
  tax_type,
  COUNT(*) as record_count,
  AVG(tax_rate) as avg_rate,
  SUM(tax_amount) as total_amount
FROM public.invoice_taxes
GROUP BY tax_type
ORDER BY tax_type;