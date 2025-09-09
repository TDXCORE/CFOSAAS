/*
 * -------------------------------------------------------
 * CFO SaaS Platform - Sample Data Seed Script
 * Populates database with Colombian sample data for testing
 * -------------------------------------------------------
 */

-- First, check if we have any existing companies. If yes, exit gracefully
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.companies LIMIT 1) THEN
        RAISE NOTICE 'Companies already exist in database. Skipping seed data insertion.';
        RETURN;
    END IF;
END $$;

-- Insert sample Colombian company
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
    city,
    address,
    settings,
    tax_settings,
    integration_settings,
    subscription_plan,
    subscription_status,
    trial_ends_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'TechCorp Colombia',
    'Tecnologías Corporativas Colombia S.A.S',
    '900123456-7',
    'common',
    '6201',
    'Actividades de programación informática',
    'technology',
    'medium',
    'CO',
    'Cundinamarca',
    'Bogotá',
    '{"address": "Carrera 7 # 71-21, Torre B, Piso 12", "postal_code": "110231"}',
    '{"currency": "COP", "date_format": "DD/MM/YYYY", "timezone": "America/Bogota", "auto_classification": true, "require_manual_review": false, "default_retention_rate": 0.11, "email_notifications": true}',
    '{"iva_rate": 0.19, "retention_rates": {"services": 0.11, "goods": 0.025, "construction": 0.04, "transport": 0.01, "rent": 0.035}, "ica_rate": 0.00414, "municipality": "Bogotá", "retention_thresholds": {"services": 4000000, "goods": 1000000, "construction": 500000}}',
    '{"microsoft_graph": {"enabled": false}, "openai": {"enabled": true, "model": "gpt-4-turbo", "temperature": 0.1, "max_tokens": 2000}, "storage": {"bucket_name": "invoice-documents", "max_file_size": 10485760, "allowed_extensions": ["xml", "pdf", "zip", "jpg", "png"]}}',
    'professional',
    'active',
    NOW() + INTERVAL '30 days'
);

-- Insert sample invoices with Colombian data
INSERT INTO public.invoices (
    id,
    company_id,
    invoice_number,
    document_type,
    issue_date,
    due_date,
    supplier_tax_id,
    supplier_name,
    supplier_email,
    currency,
    subtotal,
    total_tax,
    total_retention,
    total_amount,
    puc_code,
    puc_name,
    account_classification_confidence,
    status,
    processing_status,
    source_file_name,
    source_file_type,
    processing_metadata,
    manual_review_required,
    created_at,
    updated_at
) VALUES 

-- Week 1 (12 invoices)
('11111111-1111-1111-1111-111111111111', '550e8400-e29b-41d4-a716-446655440000', 'FV-2024-0001', 'invoice', '2024-12-01', '2024-12-31', '800123456-1', 'Microsoft Colombia Ltda', 'billing@microsoft.co', 'COP', 8403361.34, 1596638.66, 924369.75, 10000000.00, '2805', 'Licencias de Software', 0.95, 'validated', 'classified', 'microsoft_invoice.xml', 'xml', '{"processing_time": 2.5, "confidence": 0.95, "ai_classification": true}', false, NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'),

('11111111-1111-1111-1111-111111111112', '550e8400-e29b-41d4-a716-446655440000', 'FC-2024-0387', 'invoice', '2024-12-01', '2024-12-31', '860002964-4', 'Amazon Web Services Colombia S.A.S', 'aws-billing@amazon.co', 'COP', 4201680.67, 798319.33, 462184.87, 5000000.00, '5135', 'Servicios de Cloud Computing', 0.92, 'validated', 'classified', 'aws_invoice.pdf', 'pdf', '{"processing_time": 1.8, "confidence": 0.92, "ai_classification": true}', false, NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'),

('11111111-1111-1111-1111-111111111113', '550e8400-e29b-41d4-a716-446655440000', 'FV-2024-2156', 'invoice', '2024-12-02', '2025-01-01', '900345678-2', 'Proveedor Principal S.A.S', 'facturacion@principal.co', 'COP', 3781512.61, 718487.39, 416166.39, 4500000.00, '6205', 'Desarrollo de Software', 0.88, 'validated', 'classified', 'principal_invoice.xml', 'xml', '{"processing_time": 3.2, "confidence": 0.88, "ai_classification": true}', false, NOW() - INTERVAL '27 days', NOW() - INTERVAL '27 days'),

('11111111-1111-1111-1111-111111111114', '550e8400-e29b-41d4-a716-446655440000', 'FE-2024-0892', 'invoice', '2024-12-02', '2025-01-01', '890123456-3', 'Distribuciones Norte Ltda', 'contabilidad@norte.co', 'COP', 2941176.47, 558823.53, 323529.41, 3500000.00, '1435', 'Equipos de Cómputo', 0.91, 'validated', 'classified', 'norte_invoice.xml', 'xml', '{"processing_time": 2.1, "confidence": 0.91, "ai_classification": true}', false, NOW() - INTERVAL '27 days', NOW() - INTERVAL '27 days'),

('11111111-1111-1111-1111-111111111115', '550e8400-e29b-41d4-a716-446655440000', 'INV-2024-0445', 'invoice', '2024-12-03', '2025-01-02', '800456789-4', 'Servicios Integrales', 'billing@integrales.co', 'COP', 2521008.40, 478991.60, 277310.92, 3000000.00, '5120', 'Servicios de Consultoría', 0.85, 'validated', 'classified', 'integrales_invoice.pdf', 'pdf', '{"processing_time": 2.8, "confidence": 0.85, "ai_classification": true}', false, NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days'),

('11111111-1111-1111-1111-111111111116', '550e8400-e29b-41d4-a716-446655440000', 'FV-2024-1287', 'invoice', '2024-12-03', '2025-01-02', '830567890-5', 'Tecnología Empresarial', 'ventas@techemp.co', 'COP', 2100840.34, 399159.66, 231092.37, 2500000.00, '2805', 'Software Empresarial', 0.93, 'validated', 'classified', 'techemp_invoice.xml', 'xml', '{"processing_time": 1.5, "confidence": 0.93, "ai_classification": true}', false, NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days'),

('11111111-1111-1111-1111-111111111117', '550e8400-e29b-41d4-a716-446655440000', 'FC-2024-0678', 'invoice', '2024-12-04', '2025-01-03', '860678901-6', 'Logística Express', 'facturacion@logex.co', 'COP', 1680672.27, 319327.73, 184873.89, 2000000.00, '5245', 'Servicios de Transporte', 0.87, 'validated', 'classified', 'logex_invoice.pdf', 'pdf', '{"processing_time": 2.4, "confidence": 0.87, "ai_classification": true}', false, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),

('11111111-1111-1111-1111-111111111118', '550e8400-e29b-41d4-a716-446655440000', 'FE-2024-1543', 'invoice', '2024-12-04', '2025-01-03', '890789012-7', 'Suministros Corporativos', 'cuentas@sumcorp.co', 'COP', 1512604.20, 287395.80, 166386.46, 1800000.00, '1590', 'Materiales de Oficina', 0.89, 'validated', 'classified', 'sumcorp_invoice.xml', 'xml', '{"processing_time": 1.9, "confidence": 0.89, "ai_classification": true}', false, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),

('11111111-1111-1111-1111-111111111119', '550e8400-e29b-41d4-a716-446655440000', 'INV-2024-0934', 'invoice', '2024-12-05', '2025-01-04', '800890123-8', 'Mantenimiento Digital', 'billing@mdigital.co', 'COP', 1260504.20, 239495.80, 138655.46, 1500000.00, '5195', 'Mantenimiento de Equipos', 0.86, 'validated', 'classified', 'mdigital_invoice.pdf', 'pdf', '{"processing_time": 2.7, "confidence": 0.86, "ai_classification": true}', false, NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),

('11111111-1111-1111-1111-111111111120', '550e8400-e29b-41d4-a716-446655440000', 'FV-2024-2789', 'invoice', '2024-12-05', '2025-01-04', '830901234-9', 'Capacitación Profesional', 'contabilidad@cappro.co', 'COP', 1092436.97, 207563.03, 120128.07, 1300000.00, '5140', 'Servicios de Capacitación', 0.84, 'validated', 'classified', 'cappro_invoice.xml', 'xml', '{"processing_time": 3.1, "confidence": 0.84, "ai_classification": true}', false, NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),

('11111111-1111-1111-1111-111111111121', '550e8400-e29b-41d4-a716-446655440000', 'FC-2024-1456', 'invoice', '2024-12-06', '2025-01-05', '860012345-0', 'Seguridad Informática', 'ventas@seginf.co', 'COP', 924369.75, 175630.25, 101680.67, 1100000.00, '5125', 'Servicios de Seguridad', 0.92, 'validated', 'classified', 'seginf_invoice.pdf', 'pdf', '{"processing_time": 1.6, "confidence": 0.92, "ai_classification": true}', false, NOW() - INTERVAL '23 days', NOW() - INTERVAL '23 days'),

('11111111-1111-1111-1111-111111111122', '550e8400-e29b-41d4-a716-446655440000', 'FE-2024-0789', 'invoice', '2024-12-07', '2025-01-06', '890123456-1', 'Marketing Digital Plus', 'facturacion@mdigplus.co', 'COP', 840336.13, 159663.87, 92437.71, 1000000.00, '5305', 'Servicios de Publicidad', 0.88, 'validated', 'classified', 'mdigplus_invoice.xml', 'xml', '{"processing_time": 2.3, "confidence": 0.88, "ai_classification": true}', false, NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days'),

-- Week 2 (10 invoices)
('22222222-2222-2222-2222-222222222223', '550e8400-e29b-41d4-a716-446655440000', 'INV-2024-1845', 'invoice', '2024-12-08', '2025-01-07', '800234567-2', 'Consultores Fiscales', 'billing@confis.co', 'COP', 4201680.67, 798319.33, 462184.87, 5000000.00, '5110', 'Consultoría Fiscal', 0.94, 'validated', 'classified', 'confis_invoice.pdf', 'pdf', '{"processing_time": 1.8, "confidence": 0.94, "ai_classification": true}', false, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),

('22222222-2222-2222-2222-222222222224', '550e8400-e29b-41d4-a716-446655440000', 'FV-2024-3456', 'invoice', '2024-12-09', '2025-01-08', '830345678-3', 'Implementaciones ERP', 'ventas@imperp.co', 'COP', 3361344.54, 638655.46, 369747.90, 4000000.00, '2805', 'Software ERP', 0.91, 'validated', 'classified', 'imperp_invoice.xml', 'xml', '{"processing_time": 2.6, "confidence": 0.91, "ai_classification": true}', false, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),

('22222222-2222-2222-2222-222222222225', '550e8400-e29b-41d4-a716-446655440000', 'FC-2024-2167', 'invoice', '2024-12-10', '2025-01-09', '860456789-4', 'Soporte Técnico 24/7', 'contabilidad@sop247.co', 'COP', 2941176.47, 558823.53, 323529.41, 3500000.00, '5125', 'Soporte Técnico', 0.89, 'validated', 'classified', 'sop247_invoice.pdf', 'pdf', '{"processing_time": 2.9, "confidence": 0.89, "ai_classification": true}', false, NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days'),

('22222222-2222-2222-2222-222222222226', '550e8400-e29b-41d4-a716-446655440000', 'FE-2024-0998', 'invoice', '2024-12-11', '2025-01-10', '890567890-5', 'Desarrollo Mobile', 'facturacion@devmobile.co', 'COP', 2521008.40, 478991.60, 277310.92, 3000000.00, '6205', 'Desarrollo de Apps', 0.87, 'validated', 'classified', 'devmobile_invoice.xml', 'xml', '{"processing_time": 3.4, "confidence": 0.87, "ai_classification": true}', false, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),

('22222222-2222-2222-2222-222222222227', '550e8400-e29b-41d4-a716-446655440000', 'INV-2024-1678', 'invoice', '2024-12-12', '2025-01-11', '800678901-6', 'Análisis de Datos', 'billing@andata.co', 'COP', 2100840.34, 399159.66, 231092.37, 2500000.00, '5115', 'Análisis de Información', 0.93, 'validated', 'classified', 'andata_invoice.pdf', 'pdf', '{"processing_time": 1.7, "confidence": 0.93, "ai_classification": true}', false, NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),

('22222222-2222-2222-2222-222222222228', '550e8400-e29b-41d4-a716-446655440000', 'FV-2024-4789', 'invoice', '2024-12-13', '2025-01-12', '830789012-7', 'Comunicaciones VoIP', 'ventas@voipcom.co', 'COP', 1680672.27, 319327.73, 184873.89, 2000000.00, '5175', 'Servicios de Telecomunicaciones', 0.85, 'validated', 'classified', 'voipcom_invoice.xml', 'xml', '{"processing_time": 2.5, "confidence": 0.85, "ai_classification": true}', false, NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'),

('22222222-2222-2222-2222-222222222229', '550e8400-e29b-41d4-a716-446655440000', 'FC-2024-3234', 'invoice', '2024-12-14', '2025-01-13', '860890123-8', 'Hosting Premium', 'contabilidad@hostprem.co', 'COP', 1512604.20, 287395.80, 166386.46, 1800000.00, '5135', 'Servicios de Hosting', 0.91, 'validated', 'classified', 'hostprem_invoice.pdf', 'pdf', '{"processing_time": 1.4, "confidence": 0.91, "ai_classification": true}', false, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),

('22222222-2222-2222-2222-222222222230', '550e8400-e29b-41d4-a716-446655440000', 'FE-2024-1567', 'invoice', '2024-12-15', '2025-01-14', '890901234-9', 'Diseño UX/UI', 'facturacion@designux.co', 'COP', 1260504.20, 239495.80, 138655.46, 1500000.00, '5305', 'Servicios de Diseño', 0.88, 'validated', 'classified', 'designux_invoice.xml', 'xml', '{"processing_time": 2.8, "confidence": 0.88, "ai_classification": true}', false, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),

('22222222-2222-2222-2222-222222222231', '550e8400-e29b-41d4-a716-446655440000', 'INV-2024-2890', 'invoice', '2024-12-16', '2025-01-15', '800012345-0', 'Testing Automatizado', 'billing@testauto.co', 'COP', 1092436.97, 207563.03, 120128.07, 1300000.00, '5125', 'Servicios de Testing', 0.86, 'validated', 'classified', 'testauto_invoice.pdf', 'pdf', '{"processing_time": 3.0, "confidence": 0.86, "ai_classification": true}', false, NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'),

('22222222-2222-2222-2222-222222222232', '550e8400-e29b-41d4-a716-446655440000', 'FV-2024-5678', 'invoice', '2024-12-17', '2025-01-16', '830123456-1', 'DevOps Solutions', 'ventas@devops.co', 'COP', 924369.75, 175630.25, 101680.67, 1100000.00, '5120', 'Servicios DevOps', 0.84, 'validated', 'classified', 'devops_invoice.xml', 'xml', '{"processing_time": 3.2, "confidence": 0.84, "ai_classification": true}', false, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),

-- Week 3 (13 invoices)
('33333333-3333-3333-3333-333333333333', '550e8400-e29b-41d4-a716-446655440000', 'FC-2024-4567', 'invoice', '2024-12-18', '2025-01-17', '860234567-2', 'Machine Learning Corp', 'contabilidad@mlcorp.co', 'COP', 5042016.81, 958503.19, 554621.85, 6000000.00, '5115', 'Servicios de IA', 0.96, 'validated', 'classified', 'mlcorp_invoice.pdf', 'pdf', '{"processing_time": 1.3, "confidence": 0.96, "ai_classification": true}', false, NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),

('33333333-3333-3333-3333-333333333334', '550e8400-e29b-41d4-a716-446655440000', 'FE-2024-2345', 'invoice', '2024-12-19', '2025-01-18', '890345678-3', 'Cloud Infrastructure', 'facturacion@cloudinfra.co', 'COP', 4201680.67, 798319.33, 462184.87, 5000000.00, '5135', 'Infraestructura Cloud', 0.92, 'validated', 'classified', 'cloudinfra_invoice.xml', 'xml', '{"processing_time": 1.9, "confidence": 0.92, "ai_classification": true}', false, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),

('33333333-3333-3333-3333-333333333335', '550e8400-e29b-41d4-a716-446655440000', 'INV-2024-3456', 'invoice', '2024-12-20', '2025-01-19', '800456789-4', 'Blockchain Development', 'billing@blockchain.co', 'COP', 3781512.61, 718487.39, 416166.39, 4500000.00, '6205', 'Desarrollo Blockchain', 0.88, 'validated', 'classified', 'blockchain_invoice.pdf', 'pdf', '{"processing_time": 2.7, "confidence": 0.88, "ai_classification": true}', false, NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),

('33333333-3333-3333-3333-333333333336', '550e8400-e29b-41d4-a716-446655440000', 'FV-2024-6789', 'invoice', '2024-12-21', '2025-01-20', '830567890-5', 'Cybersecurity Pro', 'ventas@cyberpro.co', 'COP', 3361344.54, 638655.46, 369747.90, 4000000.00, '5125', 'Servicios de Ciberseguridad', 0.94, 'validated', 'classified', 'cyberpro_invoice.xml', 'xml', '{"processing_time": 1.5, "confidence": 0.94, "ai_classification": true}', false, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),

('33333333-3333-3333-3333-333333333337', '550e8400-e29b-41d4-a716-446655440000', 'FC-2024-5432', 'invoice', '2024-12-22', '2025-01-21', '860678901-6', 'IoT Solutions', 'contabilidad@iotsol.co', 'COP', 2941176.47, 558823.53, 323529.41, 3500000.00, '5120', 'Soluciones IoT', 0.90, 'validated', 'classified', 'iotsol_invoice.pdf', 'pdf', '{"processing_time": 2.4, "confidence": 0.90, "ai_classification": true}', false, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),

('33333333-3333-3333-3333-333333333338', '550e8400-e29b-41d4-a716-446655440000', 'FE-2024-4321', 'invoice', '2024-12-23', '2025-01-22', '890789012-7', 'API Development', 'facturacion@apidev.co', 'COP', 2521008.40, 478991.60, 277310.92, 3000000.00, '6205', 'Desarrollo de APIs', 0.87, 'validated', 'classified', 'apidev_invoice.xml', 'xml', '{"processing_time": 2.8, "confidence": 0.87, "ai_classification": true}', false, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),

('33333333-3333-3333-3333-333333333339', '550e8400-e29b-41d4-a716-446655440000', 'INV-2024-5678', 'invoice', '2024-12-24', '2025-01-23', '800890123-8', 'Database Optimization', 'billing@dbopt.co', 'COP', 2100840.34, 399159.66, 231092.37, 2500000.00, '5115', 'Optimización de BD', 0.85, 'validated', 'classified', 'dbopt_invoice.pdf', 'pdf', '{"processing_time": 3.1, "confidence": 0.85, "ai_classification": true}', false, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),

('33333333-3333-3333-3333-333333333340', '550e8400-e29b-41d4-a716-446655440000', 'FV-2024-7890', 'invoice', '2024-12-25', '2025-01-24', '830901234-9', 'Performance Tuning', 'ventas@perftune.co', 'COP', 1680672.27, 319327.73, 184873.89, 2000000.00, '5125', 'Optimización de Rendimiento', 0.89, 'validated', 'classified', 'perftune_invoice.xml', 'xml', '{"processing_time": 2.2, "confidence": 0.89, "ai_classification": true}', false, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),

('33333333-3333-3333-3333-333333333341', '550e8400-e29b-41d4-a716-446655440000', 'FC-2024-6543', 'invoice', '2024-12-26', '2025-01-25', '860012345-0', 'Code Review Services', 'contabilidad@codereview.co', 'COP', 1512604.20, 287395.80, 166386.46, 1800000.00, '5120', 'Servicios de Code Review', 0.86, 'validated', 'classified', 'codereview_invoice.pdf', 'pdf', '{"processing_time": 2.6, "confidence": 0.86, "ai_classification": true}', false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

('33333333-3333-3333-3333-333333333342', '550e8400-e29b-41d4-a716-446655440000', 'FE-2024-7654', 'invoice', '2024-12-27', '2025-01-26', '890123456-1', 'Documentation Services', 'facturacion@docserv.co', 'COP', 1260504.20, 239495.80, 138655.46, 1500000.00, '5120', 'Servicios de Documentación', 0.83, 'validated', 'classified', 'docserv_invoice.xml', 'xml', '{"processing_time": 2.9, "confidence": 0.83, "ai_classification": true}', false, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

('33333333-3333-3333-3333-333333333343', '550e8400-e29b-41d4-a716-446655440000', 'INV-2024-8765', 'invoice', '2024-12-28', '2025-01-27', '800234567-2', 'Quality Assurance', 'billing@qa.co', 'COP', 1092436.97, 207563.03, 120128.07, 1300000.00, '5125', 'Servicios de QA', 0.91, 'validated', 'classified', 'qa_invoice.pdf', 'pdf', '{"processing_time": 1.8, "confidence": 0.91, "ai_classification": true}', false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

('33333333-3333-3333-3333-333333333344', '550e8400-e29b-41d4-a716-446655440000', 'FV-2024-9876', 'invoice', '2024-12-29', '2025-01-28', '830345678-3', 'Integration Services', 'ventas@integration.co', 'COP', 924369.75, 175630.25, 101680.67, 1100000.00, '5120', 'Servicios de Integración', 0.88, 'validated', 'classified', 'integration_invoice.xml', 'xml', '{"processing_time": 2.5, "confidence": 0.88, "ai_classification": true}', false, NOW(), NOW()),

('33333333-3333-3333-3333-333333333345', '550e8400-e29b-41d4-a716-446655440000', 'FC-2024-0987', 'invoice', '2024-12-30', '2025-01-29', '860456789-4', 'Maintenance Plus', 'contabilidad@maintplus.co', 'COP', 840336.13, 159663.87, 92437.71, 1000000.00, '5195', 'Servicios de Mantenimiento', 0.85, 'validated', 'classified', 'maintplus_invoice.pdf', 'pdf', '{"processing_time": 2.7, "confidence": 0.85, "ai_classification": true}', false, NOW(), NOW()),

-- Week 4 (13 invoices, including today's 12)
('44444444-4444-4444-4444-444444444446', '550e8400-e29b-41d4-a716-446655440000', 'FE-2025-0001', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '890567890-5', 'New Year Solutions', 'facturacion@newyear.co', 'COP', 4201680.67, 798319.33, 462184.87, 5000000.00, '5120', 'Servicios de Año Nuevo', 0.92, 'validated', 'classified', 'newyear_invoice.xml', 'xml', '{"processing_time": 1.6, "confidence": 0.92, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444447', '550e8400-e29b-41d4-a716-446655440000', 'INV-2025-0002', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '800678901-6', 'Fresh Start Tech', 'billing@freshstart.co', 'COP', 3361344.54, 638655.46, 369747.90, 4000000.00, '6205', 'Tecnologías de Inicio', 0.89, 'validated', 'classified', 'freshstart_invoice.pdf', 'pdf', '{"processing_time": 2.1, "confidence": 0.89, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444448', '550e8400-e29b-41d4-a716-446655440000', 'FV-2025-0003', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '830789012-7', 'Innovation Labs', 'ventas@innovlabs.co', 'COP', 2941176.47, 558823.53, 323529.41, 3500000.00, '5115', 'Laboratorios de Innovación', 0.94, 'validated', 'classified', 'innovlabs_invoice.xml', 'xml', '{"processing_time": 1.4, "confidence": 0.94, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444449', '550e8400-e29b-41d4-a716-446655440000', 'FC-2025-0004', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '860890123-8', 'Digital Transformation', 'contabilidad@digtrans.co', 'COP', 2521008.40, 478991.60, 277310.92, 3000000.00, '5120', 'Transformación Digital', 0.87, 'validated', 'classified', 'digtrans_invoice.pdf', 'pdf', '{"processing_time": 2.3, "confidence": 0.87, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444450', '550e8400-e29b-41d4-a716-446655440000', 'FE-2025-0005', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '890901234-9', 'Smart Solutions', 'facturacion@smartsol.co', 'COP', 2100840.34, 399159.66, 231092.37, 2500000.00, '5125', 'Soluciones Inteligentes', 0.91, 'validated', 'classified', 'smartsol_invoice.xml', 'xml', '{"processing_time": 1.8, "confidence": 0.91, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444451', '550e8400-e29b-41d4-a716-446655440000', 'INV-2025-0006', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '800012345-0', 'Future Tech', 'billing@futuretech.co', 'COP', 1680672.27, 319327.73, 184873.89, 2000000.00, '6205', 'Tecnologías del Futuro', 0.88, 'validated', 'classified', 'futuretech_invoice.pdf', 'pdf', '{"processing_time": 2.5, "confidence": 0.88, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444452', '550e8400-e29b-41d4-a716-446655440000', 'FV-2025-0007', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '830123456-1', 'Advanced Computing', 'ventas@advcomp.co', 'COP', 1512604.20, 287395.80, 166386.46, 1800000.00, '5115', 'Computación Avanzada', 0.85, 'validated', 'classified', 'advcomp_invoice.xml', 'xml', '{"processing_time": 2.8, "confidence": 0.85, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444453', '550e8400-e29b-41d4-a716-446655440000', 'FC-2025-0008', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '860234567-2', 'Next Gen Services', 'contabilidad@nextgen.co', 'COP', 1260504.20, 239495.80, 138655.46, 1500000.00, '5120', 'Servicios de Nueva Generación', 0.90, 'validated', 'classified', 'nextgen_invoice.pdf', 'pdf', '{"processing_time": 2.0, "confidence": 0.90, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444454', '550e8400-e29b-41d4-a716-446655440000', 'FE-2025-0009', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '890345678-3', 'Pro Development', 'facturacion@prodev.co', 'COP', 1092436.97, 207563.03, 120128.07, 1300000.00, '6205', 'Desarrollo Profesional', 0.86, 'validated', 'classified', 'prodev_invoice.xml', 'xml', '{"processing_time": 2.4, "confidence": 0.86, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444455', '550e8400-e29b-41d4-a716-446655440000', 'INV-2025-0010', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '800456789-4', 'Elite Consulting', 'billing@elitecons.co', 'COP', 924369.75, 175630.25, 101680.67, 1100000.00, '5110', 'Consultoría Elite', 0.93, 'validated', 'classified', 'elitecons_invoice.pdf', 'pdf', '{"processing_time": 1.7, "confidence": 0.93, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444456', '550e8400-e29b-41d4-a716-446655440000', 'FV-2025-0011', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '830567890-5', 'Premium Support', 'ventas@premsup.co', 'COP', 840336.13, 159663.87, 92437.71, 1000000.00, '5125', 'Soporte Premium', 0.89, 'validated', 'classified', 'premsup_invoice.xml', 'xml', '{"processing_time": 2.2, "confidence": 0.89, "ai_classification": true}', false, NOW(), NOW()),

('44444444-4444-4444-4444-444444444457', '550e8400-e29b-41d4-a716-446655440000', 'FC-2025-0012', 'invoice', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '860678901-6', 'Expert Services', 'contabilidad@expert.co', 'COP', 756302.52, 143697.48, 83166.28, 900000.00, '5120', 'Servicios de Expertos', 0.87, 'validated', 'classified', 'expert_invoice.pdf', 'pdf', '{"processing_time": 2.6, "confidence": 0.87, "ai_classification": true}', false, NOW(), NOW());

-- Update totals to reflect real data
UPDATE public.companies 
SET updated_at = NOW() 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Create some pending invoices for variety
UPDATE public.invoices 
SET status = 'pending', processing_status = 'uploaded'
WHERE id IN (
    '44444444-4444-4444-4444-444444444454',
    '44444444-4444-4444-4444-444444444455',
    '44444444-4444-4444-4444-444444444456'
);

-- Provide summary
SELECT 
    'Sample data inserted successfully!' as message,
    COUNT(*) as total_invoices,
    SUM(total_amount) as total_amount_cop,
    MIN(issue_date) as earliest_date,
    MAX(issue_date) as latest_date
FROM public.invoices 
WHERE company_id = '550e8400-e29b-41d4-a716-446655440000';