-- Script para poblar invoice_taxes desde las facturas existentes
-- Ejecutar en Supabase Dashboard > SQL Editor

-- Verificar facturas existentes primero
SELECT 
  'Existing invoices:' as info,
  COUNT(*) as invoice_count,
  SUM(total_tax) as total_iva,
  SUM(total_retention) as total_retentions,
  COUNT(DISTINCT company_id) as companies
FROM public.invoices;

-- Poblar IVA records
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
  gen_random_uuid(),
  i.id,
  i.company_id,
  'IVA',
  'general',
  i.subtotal,
  0.19,
  i.total_tax,
  '01',
  'automatic',
  'IVA General 19%',
  0.95,
  NOW()
FROM public.invoices i 
WHERE i.total_tax > 0
ON CONFLICT DO NOTHING;

-- Poblar retenciones
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
  gen_random_uuid(),
  i.id,
  i.company_id,
  'RETENCION_FUENTE',
  'services',
  i.subtotal,
  CASE 
    WHEN i.subtotal > 0 THEN ROUND((i.total_retention::decimal / i.subtotal::decimal), 4)
    ELSE 0.025
  END,
  i.total_retention,
  '02',
  'automatic',
  'Retención en la fuente',
  0.90,
  NOW()
FROM public.invoices i 
WHERE i.total_retention > 0
ON CONFLICT DO NOTHING;

-- Verificar resultados
SELECT 
  'Tax records created:' as info,
  tax_type,
  COUNT(*) as count,
  SUM(tax_amount) as total_amount
FROM public.invoice_taxes
GROUP BY tax_type
ORDER BY tax_type;

-- Verificar que todos los reportes ahora tengan datos
SELECT 
  'Invoice summary:' as info,
  COUNT(*) as total_invoices,
  COUNT(CASE WHEN status = 'validated' THEN 1 END) as validated_invoices,
  COUNT(DISTINCT puc_code) as unique_puc_codes
FROM public.invoices;

SELECT 
  'Sample invoice data:' as info,
  invoice_number,
  supplier_name,
  total_amount,
  puc_code,
  status,
  created_at
FROM public.invoices
ORDER BY created_at DESC
LIMIT 5;