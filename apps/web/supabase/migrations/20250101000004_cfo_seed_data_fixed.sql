/*
 * -------------------------------------------------------
 * CFO SaaS Platform - Colombian Seed Data (Fixed)
 * Initial data for PUC accounts and tax rules for Colombia 2025
 * -------------------------------------------------------
 */

/*
 * -------------------------------------------------------
 * Section: Plan Único de Cuentas (PUC) - Colombian Chart of Accounts
 * Based on Decreto 2650 de 1993 - Updated for 2025
 * -------------------------------------------------------
 */

-- Level 1: Main Account Classes
INSERT INTO public.puc_accounts (code, name, description, level, account_type, nature, is_active) VALUES
('1', 'ACTIVO', 'Bienes y derechos apreciables en dinero de propiedad de la empresa', 1, 'asset', 'debit', true),
('2', 'PASIVO', 'Obligaciones contraídas por la empresa para su cancelación en el futuro', 1, 'liability', 'credit', true),
('3', 'PATRIMONIO', 'Valor residual de los activos después de deducir los pasivos', 1, 'equity', 'credit', true),
('4', 'INGRESOS', 'Valores que recibe la empresa cuando realiza una venta o presta un servicio', 1, 'income', 'credit', true),
('5', 'GASTOS', 'Erogaciones causadas en administración, comercialización, investigación y financiación', 1, 'expense', 'debit', true),
('6', 'COSTOS DE VENTAS', 'Erogaciones directamente relacionadas con la elaboración o compra de los productos vendidos', 1, 'expense', 'debit', true),
('7', 'COSTOS DE PRODUCCIÓN O DE OPERACIÓN', 'Erogaciones asociadas con el proceso productivo o de prestación de servicios', 1, 'expense', 'debit', true),
('8', 'CUENTAS DE ORDEN DEUDORAS', 'Cuentas de registro y control sobre hechos o circunstancias', 1, 'asset', 'debit', true),
('9', 'CUENTAS DE ORDEN ACREEDORAS', 'Contrapartida de las cuentas de orden deudoras', 1, 'liability', 'credit', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Level 2: Asset Groups
INSERT INTO public.puc_accounts (code, name, description, level, parent_code, account_type, nature, is_active) VALUES
('11', 'DISPONIBLE', 'Comprende el efectivo y los equivalentes al efectivo', 2, '1', 'asset', 'debit', true),
('12', 'INVERSIONES', 'Recursos colocados en títulos valores y demás documentos', 2, '1', 'asset', 'debit', true),
('13', 'DEUDORES', 'Comprende el valor de las deudas a cargo de terceros y a favor del ente económico', 2, '1', 'asset', 'debit', true),
('14', 'INVENTARIOS', 'Comprende todos aquellos artículos, materiales, suministros, productos y recursos renovables', 2, '1', 'asset', 'debit', true),
('15', 'PROPIEDADES, PLANTA Y EQUIPO', 'Comprende los activos tangibles empleados por el ente económico', 2, '1', 'asset', 'debit', true),
('16', 'INTANGIBLES', 'Comprende el conjunto de bienes inmateriales', 2, '1', 'asset', 'debit', true),
('17', 'DIFERIDOS', 'Comprende los gastos pagados por anticipado y los cargos diferidos', 2, '1', 'asset', 'debit', true),
('18', 'OTROS ACTIVOS', 'Comprende los bienes diversos utilizados en el objeto social', 2, '1', 'asset', 'debit', true),
('19', 'VALORIZACIONES', 'Comprende la diferencia entre el valor intrínseco o el avalúo técnico y el costo neto', 2, '1', 'asset', 'debit', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Level 3: Detailed Asset Accounts
INSERT INTO public.puc_accounts (code, name, description, level, parent_code, account_type, nature, keywords, typical_amounts, tax_implications) VALUES
('1105', 'CAJA', 'Registra la existencia de dinero en efectivo', 3, '11', 'asset', 'debit', ARRAY['efectivo', 'dinero', 'caja menor'], '{"min": 0, "max": 5000000}', '{"generates_retention": false}'),
('1110', 'BANCOS', 'Registra el valor de los depósitos constituidos por el ente económico en moneda nacional', 3, '11', 'asset', 'debit', ARRAY['banco', 'cuenta corriente', 'ahorros'], '{"min": 0, "max": null}', '{"generates_retention": false}'),
('1305', 'CLIENTES', 'Registra los aumentos y disminuciones derivadas de las ventas de bienes o servicios', 3, '13', 'asset', 'debit', ARRAY['cliente', 'deudor', 'cuenta por cobrar'], '{"min": 0, "max": null}', '{"generates_retention": false}'),
('1365', 'CUENTAS POR COBRAR A TRABAJADORES', 'Registra los valores a cargo de los trabajadores y funcionarios', 3, '13', 'asset', 'debit', ARRAY['empleado', 'trabajador', 'anticipo'], '{"min": 0, "max": 10000000}', '{"generates_retention": false}'),
('1380', 'DEUDORES VARIOS', 'Registra los valores a favor del ente económico y a cargo de terceros', 3, '13', 'asset', 'debit', ARRAY['deudor vario', 'tercero'], '{"min": 0, "max": null}', '{"generates_retention": false}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  keywords = EXCLUDED.keywords,
  typical_amounts = EXCLUDED.typical_amounts,
  tax_implications = EXCLUDED.tax_implications,
  updated_at = NOW();

-- Level 2: Liability Groups
INSERT INTO public.puc_accounts (code, name, description, level, parent_code, account_type, nature, is_active) VALUES
('21', 'OBLIGACIONES FINANCIERAS', 'Comprende el valor de las obligaciones contraídas por el ente económico mediante la obtención de recursos', 2, '2', 'liability', 'credit', true),
('22', 'PROVEEDORES', 'Comprende el valor de las obligaciones a cargo del ente económico por concepto de la adquisición de bienes y/o servicios', 2, '2', 'liability', 'credit', true),
('23', 'CUENTAS POR PAGAR', 'Comprende las obligaciones contraídas por el ente económico a favor de terceros', 2, '2', 'liability', 'credit', true),
('24', 'IMPUESTOS, GRAVÁMENES Y TASAS', 'Comprende el valor de los gravámenes de carácter general y obligatorio', 2, '2', 'liability', 'credit', true),
('25', 'OBLIGACIONES LABORALES', 'Comprende el valor de los pasivos a favor de los trabajadores', 2, '2', 'liability', 'credit', true),
('26', 'PASIVOS ESTIMADOS Y PROVISIONES', 'Agrupa las cuentas que representan los valores provisionados por el ente económico', 2, '2', 'liability', 'credit', true),
('27', 'DIFERIDOS', 'Comprende los ingresos recibidos por anticipado y los ingresos diferidos', 2, '2', 'liability', 'credit', true),
('28', 'OTROS PASIVOS', 'Comprende las cuentas que representan las obligaciones del ente económico', 2, '2', 'liability', 'credit', true),
('29', 'BONOS Y PAPELES COMERCIALES', 'Registra el valor de los bonos emitidos por el ente económico', 2, '2', 'liability', 'credit', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Level 3: Detailed Liability Accounts
INSERT INTO public.puc_accounts (code, name, description, level, parent_code, account_type, nature, keywords, tax_implications) VALUES
('2205', 'NACIONALES', 'Registra el valor de las obligaciones contraídas con proveedores del país', 3, '22', 'liability', 'credit', ARRAY['proveedor', 'nacional', 'compra'], '{"generates_retention": true}'),
('2404', 'DE RENTA Y COMPLEMENTARIOS', 'Comprende el valor del impuesto sobre la renta y complementarios', 3, '24', 'liability', 'credit', ARRAY['impuesto renta', 'declaración'], '{"tax_type": "income_tax"}'),
('2408', 'IMPUESTO A LAS VENTAS POR PAGAR', 'Registra el valor del IVA generado por las ventas', 3, '24', 'liability', 'credit', ARRAY['iva', 'impuesto ventas'], '{"tax_type": "iva", "rate": 0.19}'),
('2412', 'DE INDUSTRIA Y COMERCIO', 'Comprende el valor del impuesto de industria y comercio', 3, '24', 'liability', 'credit', ARRAY['ica', 'industria comercio'], '{"tax_type": "ica", "municipal": true}'),
('2365', 'RETENCIÓN EN LA FUENTE', 'Registra los valores retenidos por concepto de impuesto sobre la renta', 3, '23', 'liability', 'credit', ARRAY['retencion fuente', 'retefuente'], '{"tax_type": "retencion_fuente"}'),
('2367', 'RETENCIÓN DE IVA', 'Registra los valores retenidos por concepto del IVA', 3, '23', 'liability', 'credit', ARRAY['retencion iva', 'reteiva'], '{"tax_type": "retencion_iva"}'),
('2368', 'RETENCIÓN DE ICA', 'Registra los valores retenidos por concepto del impuesto de industria y comercio', 3, '23', 'liability', 'credit', ARRAY['retencion ica', 'reteica'], '{"tax_type": "retencion_ica"}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  keywords = EXCLUDED.keywords,
  tax_implications = EXCLUDED.tax_implications,
  updated_at = NOW();

-- Level 2: Income Groups
INSERT INTO public.puc_accounts (code, name, description, level, parent_code, account_type, nature, is_active) VALUES
('41', 'INGRESOS OPERACIONALES', 'Comprende los valores recibidos y/o causados como resultado de las actividades desarrolladas en cumplimiento de su objeto social', 2, '4', 'income', 'credit', true),
('42', 'INGRESOS NO OPERACIONALES', 'Comprende los ingresos provenientes de transacciones diferentes al objeto social del ente económico', 2, '4', 'income', 'credit', true),
('47', 'AJUSTES POR INFLACIÓN', 'Comprende el mayor valor causado por la pérdida del poder adquisitivo de la moneda', 2, '4', 'income', 'credit', true),
('48', 'INGRESOS POR VALORIZACIÓN', 'Comprende los ingresos originados por la valorización de activos', 2, '4', 'income', 'credit', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Level 3: Detailed Income Accounts (Colombian Economic Activities)
INSERT INTO public.puc_accounts (code, name, description, level, parent_code, account_type, nature, keywords, tax_implications) VALUES
('4135', 'COMERCIO AL POR MAYOR Y AL POR MENOR', 'Actividades de venta de mercancías al por mayor y al por menor', 3, '41', 'income', 'credit', ARRAY['venta', 'comercio', 'mercancia', 'retail'], '{"iva_rate": 0.19, "generates_ica": true}'),
('4175', 'ACTIVIDADES INMOBILIARIAS', 'Comprende las actividades inmobiliarias realizadas con bienes propios o arrendados', 3, '41', 'income', 'credit', ARRAY['inmobiliario', 'arriendo', 'alquiler'], '{"iva_rate": 0.19, "ica_rate": 0.005}'),
('4210', 'FINANCIEROS', 'Comprende los ingresos obtenidos por el ente económico por concepto de rendimientos financieros', 3, '42', 'income', 'credit', ARRAY['interes', 'financiero', 'rendimiento'], '{"retencion_fuente_rate": 0.07}'),
('4220', 'ARRENDAMIENTOS', 'Registra los ingresos obtenidos en desarrollo de contratos de arrendamiento', 3, '42', 'income', 'credit', ARRAY['arrendamiento', 'alquiler'], '{"retencion_fuente_rate": 0.035}'),
('4245', 'UTILIDAD EN VENTA DE INVERSIONES', 'Registra las utilidades obtenidas por la enajenación de inversiones', 3, '42', 'income', 'credit', ARRAY['utilidad', 'venta', 'inversion'], '{"capital_gains": true}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  keywords = EXCLUDED.keywords,
  tax_implications = EXCLUDED.tax_implications,
  updated_at = NOW();

-- Level 2: Expense Groups
INSERT INTO public.puc_accounts (code, name, description, level, parent_code, account_type, nature, is_active) VALUES
('51', 'GASTOS OPERACIONALES DE ADMINISTRACIÓN', 'Comprende los gastos ocasionados en el desarrollo del objeto social principal del ente económico', 2, '5', 'expense', 'debit', true),
('52', 'GASTOS OPERACIONALES DE VENTAS', 'Comprende los gastos directamente relacionados con la gestión de ventas', 2, '5', 'expense', 'debit', true),
('53', 'GASTOS NO OPERACIONALES', 'Comprende los gastos ocasionados por operaciones que no constituyen el objeto social principal', 2, '5', 'expense', 'debit', true),
('54', 'IMPUESTOS, GRAVÁMENES Y TASAS', 'Comprende los impuestos, contribuciones, tasas y gravámenes', 2, '5', 'expense', 'debit', true),
('58', 'GASTOS POR VALORIZACIÓN', 'Comprende la disminución de las valorizaciones registradas en períodos anteriores', 2, '5', 'expense', 'debit', true),
('59', 'GANANCIAS Y PÉRDIDAS', 'Comprende los ingresos, costos y gastos de ejercicios anteriores', 2, '5', 'expense', 'debit', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Level 3: Detailed Expense Accounts
INSERT INTO public.puc_accounts (code, name, description, level, parent_code, account_type, nature, keywords, supplier_patterns, tax_implications) VALUES
('5105', 'GASTOS DE PERSONAL', 'Comprende todos los gastos relacionados con el personal de la empresa', 3, '51', 'expense', 'debit', ARRAY['salario', 'nomina', 'personal', 'empleado'], ARRAY['%nomina%', '%recursos humanos%'], '{"deductible": true}'),
('5110', 'HONORARIOS', 'Gastos por servicios técnicos y profesionales', 3, '51', 'expense', 'debit', ARRAY['honorario', 'profesional', 'consultor'], ARRAY['%abogado%', '%contador%', '%consultor%'], '{"retencion_fuente_rate": 0.11, "deductible": true}'),
('5115', 'IMPUESTOS', 'Gastos por concepto de impuestos diferentes al de renta', 3, '51', 'expense', 'debit', ARRAY['impuesto', 'predial', 'vehiculo'], ARRAY['%dian%', '%alcaldia%'], '{"deductible": true}'),
('5120', 'ARRENDAMIENTOS', 'Gastos por concepto de alquileres de bienes muebles e inmuebles', 3, '51', 'expense', 'debit', ARRAY['arriendo', 'alquiler', 'canon'], ARRAY['%inmobiliaria%', '%arrendamiento%'], '{"retencion_fuente_rate": 0.035, "deductible": true}'),
('5130', 'SEGUROS', 'Comprende el valor de las primas de seguros', 3, '51', 'expense', 'debit', ARRAY['seguro', 'poliza', 'prima'], ARRAY['%seguros%', '%aseguradora%'], '{"deductible": true}'),
('5135', 'SERVICIOS', 'Comprende el valor de los servicios públicos y privados', 3, '51', 'expense', 'debit', ARRAY['servicio', 'publico', 'energia', 'agua', 'gas', 'telefono'], ARRAY['%epm%', '%telefonica%', '%claro%'], '{"deductible": true}'),
('5140', 'GASTOS LEGALES', 'Gastos originados en gestiones legales', 3, '51', 'expense', 'debit', ARRAY['legal', 'notaria', 'registro'], ARRAY['%notaria%', '%registro%'], '{"deductible": true}'),
('5145', 'MANTENIMIENTO Y REPARACIONES', 'Gastos por concepto de mantenimiento y reparaciones', 3, '51', 'expense', 'debit', ARRAY['mantenimiento', 'reparacion'], ARRAY['%mantenimiento%', '%taller%'], '{"retencion_fuente_rate": 0.04, "deductible": true}'),
('5150', 'ADECUACIÓN E INSTALACIÓN', 'Gastos por adecuaciones e instalaciones', 3, '51', 'expense', 'debit', ARRAY['adecuacion', 'instalacion'], ARRAY['%construccion%', '%obra%'], '{"retencion_fuente_rate": 0.04, "deductible": true}'),
('5195', 'GASTOS DIVERSOS', 'Otros gastos de administración no clasificados anteriormente', 3, '51', 'expense', 'debit', ARRAY['diversos', 'varios', 'otros'], ARRAY[]::text[], '{"deductible": true}'),
('5305', 'GASTOS DE TRANSPORTE', 'Gastos relacionados con el transporte de mercancías o servicios de transporte', 3, '53', 'expense', 'debit', ARRAY['transporte', 'flete', 'logistica'], ARRAY['%transporte%', '%logistica%'], '{"retencion_fuente_rate": 0.01, "deductible": true}'),
('5310', 'GASTOS BANCARIOS', 'Comprende los gastos ocasionados por los servicios bancarios', 3, '53', 'expense', 'debit', ARRAY['banco', 'comision', 'financiero'], ARRAY['%banco%', '%bancolombia%', '%davivienda%'], '{"deductible": true}'),
('5365', 'GASTOS EXTRAORDINARIOS', 'Comprende los gastos de carácter excepcional', 3, '53', 'expense', 'debit', ARRAY['extraordinario', 'excepcional'], ARRAY[]::text[], '{"deductible": false}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  keywords = EXCLUDED.keywords,
  supplier_patterns = EXCLUDED.supplier_patterns,
  tax_implications = EXCLUDED.tax_implications,
  updated_at = NOW();

/*
 * -------------------------------------------------------
 * Section: Colombian Tax Rules for 2025
 * Based on current Colombian tax legislation
 * -------------------------------------------------------
 */

-- IVA (Value Added Tax) Rules Colombia 2025
INSERT INTO public.tax_rules (
  country, rule_type, rule_category, calculation_method, tax_rate, 
  conditions, effective_from, description, legal_reference, priority
) VALUES
-- General IVA 19%
('CO', 'IVA', 'general', 'percentage', 0.1900, 
 '{"general": true, "exclude_exempt": true}', 
 '2025-01-01', 'IVA General 19% - Tarifa general', 'Ley 1819 de 2016, Art. 468 ET', 100),

-- IVA Reduced 5%
('CO', 'IVA', 'reduced', 'percentage', 0.0500, 
 '{"puc_codes": ["1511", "1512"], "basic_products": true, "description_contains": ["medicina", "alimento básico", "educación"]}', 
 '2025-01-01', 'IVA Reducido 5% - Productos básicos', 'Art. 468-1 ET', 90),

-- IVA Exempt 0%
('CO', 'IVA', 'exempt', 'percentage', 0.0000, 
 '{"exempt_products": true, "puc_codes": ["1100", "1200"], "description_contains": ["salud", "educación pública", "servicios públicos"]}', 
 '2025-01-01', 'IVA Exento 0% - Productos y servicios exentos', 'Art. 476 ET', 80),

-- Retención en la Fuente Rules
-- Services
('CO', 'RETENCION_FUENTE', 'services', 'percentage', 0.1100, 
 '{"services": true, "amount_min": 4000000, "puc_codes": ["5110", "5120"], "supplier_type": "company"}', 
 '2025-01-01', 'Retención servicios 11% - Servicios profesionales y técnicos', 'Art. 392 ET', 100),

-- Goods purchase
('CO', 'RETENCION_FUENTE', 'goods', 'percentage', 0.0250, 
 '{"goods": true, "amount_min": 1000000, "puc_codes": ["1435", "6205"], "supplier_type": "company"}', 
 '2025-01-01', 'Retención compras 2.5% - Compra de bienes', 'Art. 392 ET', 90),

-- Construction and consulting
('CO', 'RETENCION_FUENTE', 'construction', 'percentage', 0.0400, 
 '{"construction": true, "amount_min": 500000, "description_contains": ["construcción", "obra", "mantenimiento"], "puc_codes": ["5145", "5150"]}', 
 '2025-01-01', 'Retención construcción 4% - Servicios de construcción', 'Art. 392 ET', 95),

-- Transportation
('CO', 'RETENCION_FUENTE', 'transport', 'percentage', 0.0100, 
 '{"transport": true, "amount_min": 230000, "description_contains": ["transporte", "flete", "logística"], "puc_codes": ["5305"]}', 
 '2025-01-01', 'Retención transporte 1% - Servicios de transporte', 'Art. 392 ET', 85),

-- Rent
('CO', 'RETENCION_FUENTE', 'rent', 'percentage', 0.0350, 
 '{"rent": true, "amount_min": 1000000, "description_contains": ["arriendo", "alquiler", "canon"], "puc_codes": ["5120"]}', 
 '2025-01-01', 'Retención arrendamiento 3.5% - Arrendamientos', 'Art. 392 ET', 90),

-- Financial income
('CO', 'RETENCION_FUENTE', 'financial', 'percentage', 0.0700, 
 '{"financial": true, "amount_min": 100000, "description_contains": ["interés", "rendimiento", "financiero"], "puc_codes": ["4210"]}', 
 '2025-01-01', 'Retención financiera 7% - Rendimientos financieros', 'Art. 392 ET', 100),

-- ICA (Industry and Commerce Tax) Rules - Major Colombian Cities
-- Bogotá
('CO', 'ICA', 'bogota_commerce', 'percentage', 0.00414, 
 '{"municipality": "Bogotá", "activity": "commerce", "puc_codes": ["4135"], "economic_activity_code": ["4711", "4719", "4721"]}', 
 '2025-01-01', 'ICA Bogotá Comercio 4.14x1000', 'Acuerdo 780 de 2020 - Concejo de Bogotá', 100),

('CO', 'ICA', 'bogota_services', 'percentage', 0.00966, 
 '{"municipality": "Bogotá", "activity": "services", "puc_codes": ["4175", "4210"], "economic_activity_code": ["6201", "6202"]}', 
 '2025-01-01', 'ICA Bogotá Servicios 9.66x1000', 'Acuerdo 780 de 2020 - Concejo de Bogotá', 100),

('CO', 'ICA', 'bogota_financial', 'percentage', 0.00500, 
 '{"municipality": "Bogotá", "activity": "financial", "puc_codes": ["4210"], "economic_activity_code": ["6419", "6499"]}', 
 '2025-01-01', 'ICA Bogotá Financiero 5x1000', 'Acuerdo 780 de 2020 - Concejo de Bogotá', 90),

-- Medellín
('CO', 'ICA', 'medellin_general', 'percentage', 0.00700, 
 '{"municipality": "Medellín", "general": true}', 
 '2025-01-01', 'ICA Medellín 7x1000 - Tarifa general', 'Acuerdo Municipal Medellín', 100),

-- Cali
('CO', 'ICA', 'cali_commerce', 'percentage', 0.00414, 
 '{"municipality": "Cali", "activity": "commerce", "puc_codes": ["4135"]}', 
 '2025-01-01', 'ICA Cali Comercio 4.14x1000', 'Acuerdo Municipal Cali', 100),

('CO', 'ICA', 'cali_services', 'percentage', 0.00700, 
 '{"municipality": "Cali", "activity": "services", "puc_codes": ["4175", "4210"]}', 
 '2025-01-01', 'ICA Cali Servicios 7x1000', 'Acuerdo Municipal Cali', 100),

-- Barranquilla
('CO', 'ICA', 'barranquilla_general', 'percentage', 0.00700, 
 '{"municipality": "Barranquilla", "general": true}', 
 '2025-01-01', 'ICA Barranquilla 7x1000', 'Acuerdo Municipal Barranquilla', 100),

-- Cartagena
('CO', 'ICA', 'cartagena_general', 'percentage', 0.00800, 
 '{"municipality": "Cartagena", "general": true}', 
 '2025-01-01', 'ICA Cartagena 8x1000', 'Acuerdo Municipal Cartagena', 100)

ON CONFLICT DO NOTHING;

/*
 * -------------------------------------------------------
 * Section: Classification Rules for Automatic PUC Assignment
 * Business rules for intelligent invoice classification
 * -------------------------------------------------------
 */

INSERT INTO public.classification_rules (
  rule_name, puc_code, conditions, confidence_weight, priority, accuracy_rate
) VALUES

-- Services and Professional Fees
('Honorarios Profesionales', '5110', 
 '{"supplier_name_contains": ["abogado", "contador", "consultor", "auditor"], "description_keywords": ["honorario", "profesional", "consultoria"], "amount_range": {"min": 500000}}', 
 0.9, 100, 0.95),

-- Legal Services
('Servicios Legales', '5140', 
 '{"supplier_name_contains": ["notaria", "registro", "juridico"], "description_keywords": ["notarial", "registro", "legal"]}', 
 0.85, 90, 0.90),

-- Rent and Leases
('Arrendamientos', '5120', 
 '{"description_keywords": ["arriendo", "alquiler", "canon", "renta"], "supplier_name_contains": ["inmobiliaria"], "amount_range": {"min": 200000}}', 
 0.85, 95, 0.88),

-- Banking and Financial Services
('Gastos Bancarios', '5310', 
 '{"supplier_name_contains": ["banco", "bancolombia", "davivienda", "bbva", "scotiabank"], "description_keywords": ["comision", "manejo", "transferencia"]}', 
 0.9, 100, 0.95),

-- Public Utilities
('Servicios Públicos', '5135', 
 '{"supplier_name_contains": ["epm", "codensa", "gas natural", "telefonica", "claro", "movistar"], "description_keywords": ["energia", "agua", "gas", "telefono", "internet"]}', 
 0.9, 100, 0.92),

-- Transportation and Logistics
('Gastos de Transporte', '5305', 
 '{"supplier_name_contains": ["transporte", "logistica", "courier"], "description_keywords": ["flete", "envio", "transporte", "logistico"]}', 
 0.8, 85, 0.87),

-- Maintenance and Repairs
('Mantenimiento y Reparaciones', '5145', 
 '{"description_keywords": ["mantenimiento", "reparacion", "mantenimiento"], "supplier_name_contains": ["taller", "mantenimiento"], "exclude_keywords": ["construccion"]}', 
 0.8, 80, 0.85),

-- Construction Services
('Adecuación e Instalación', '5150', 
 '{"description_keywords": ["construccion", "obra", "instalacion", "adecuacion"], "supplier_name_contains": ["construccion", "obras"], "amount_range": {"min": 500000}}', 
 0.85, 90, 0.88),

-- Insurance
('Seguros', '5130', 
 '{"supplier_name_contains": ["seguros", "aseguradora", "axa", "mapfre", "liberty"], "description_keywords": ["seguro", "poliza", "prima"]}', 
 0.9, 95, 0.93),

-- Office Supplies and General Expenses
('Gastos Diversos', '5195', 
 '{"description_keywords": ["papeleria", "oficina", "suministro"], "amount_range": {"max": 1000000}, "default_fallback": true}', 
 0.6, 50, 0.70),

-- Commercial Sales
('Comercio al por Mayor y Menor', '4135', 
 '{"document_type": "income", "description_keywords": ["venta", "comercio", "mercancia"], "customer_tax_id": "not_null"}', 
 0.8, 90, 0.85),

-- Real Estate Activities
('Actividades Inmobiliarias', '4175', 
 '{"document_type": "income", "description_keywords": ["inmobiliario", "arriendo", "alquiler"], "supplier_name_contains": ["inmobiliaria"]}', 
 0.85, 95, 0.90),

-- Financial Income
('Ingresos Financieros', '4210', 
 '{"document_type": "income", "description_keywords": ["interes", "rendimiento", "financiero"], "supplier_name_contains": ["banco", "financiera"]}', 
 0.9, 100, 0.95)

ON CONFLICT DO NOTHING;

/*
 * -------------------------------------------------------
 * Section: Comments and Documentation
 * -------------------------------------------------------
 */

COMMENT ON TABLE public.companies IS 'Colombian companies with tax and business information';
COMMENT ON TABLE public.puc_accounts IS 'Plan Único de Cuentas - Colombian Chart of Accounts based on Decreto 2650';
COMMENT ON TABLE public.tax_rules IS 'Colombian tax rules for IVA, Retención, and ICA calculations';
COMMENT ON TABLE public.classification_rules IS 'Business rules for automatic PUC account classification';

COMMENT ON COLUMN public.companies.tax_id IS 'Colombian NIT (Número de Identificación Tributaria)';
COMMENT ON COLUMN public.companies.fiscal_regime IS 'Colombian fiscal regime: simplified, common, or special';
COMMENT ON COLUMN public.companies.economic_activity_code IS 'Colombian CIIU economic activity code';
COMMENT ON COLUMN public.puc_accounts.code IS 'PUC account code according to Decreto 2650';
COMMENT ON COLUMN public.tax_rules.conditions IS 'JSON conditions for tax rule application';
COMMENT ON COLUMN public.classification_rules.conditions IS 'JSON conditions for automatic PUC classification';