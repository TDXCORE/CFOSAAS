-- Migration: Seed PUC Accounts Data
-- Inserts all Colombian PUC accounts for invoice classification

-- Delete existing records to avoid conflicts
TRUNCATE TABLE public.puc_accounts CASCADE;

-- Insert PUC accounts from hardcoded classifier
INSERT INTO public.puc_accounts (code, name, description, level, parent_code, account_type, nature, keywords, supplier_patterns) VALUES

-- Gastos Administrativos (51)
('5105', 'Gastos de Personal', 'Sueldos, salarios, prestaciones sociales y demás gastos relacionados con el personal', 4, '51', 'expense', 'debit', ARRAY['sueldo', 'salario', 'nomina', 'personal', 'empleado'], ARRAY['servicios.*profesionales']),

('5110', 'Honorarios', 'Pagos por servicios profesionales independientes', 4, '51', 'expense', 'debit', ARRAY['honorarios', 'abogado', 'consultor', 'asesor', 'profesional'], ARRAY['servicios.*profesionales']),

('5115', 'Impuestos', 'Impuestos y gravámenes no relacionados con la renta', 4, '51', 'expense', 'debit', ARRAY['impuesto', 'gravamen', 'contribucion', 'ica', 'predial'], ARRAY['impuesto.*vehicular', 'impuesto.*predial']),

('5120', 'Arrendamientos', 'Pagos por arrendamiento de bienes inmuebles y muebles', 4, '51', 'expense', 'debit', ARRAY['arriendo', 'alquiler', 'canon', 'renta', 'arrendamiento'], ARRAY['canon.*arrendamiento']),

('5135', 'Servicios', 'Servicios públicos y otros servicios operacionales', 4, '51', 'expense', 'debit', ARRAY['servicio', 'mantenimiento', 'limpieza', 'seguridad', 'vigilancia'], ARRAY['servicios.*publicos']),

('5140', 'Gastos Legales', 'Gastos por trámites legales, notariales y registros', 4, '51', 'expense', 'debit', ARRAY['legal', 'notarial', 'registro', 'camara', 'comercio'], ARRAY['tramites.*legales']),

('5145', 'Mantenimiento y Reparaciones', 'Gastos de mantenimiento y reparación de activos', 4, '51', 'expense', 'debit', ARRAY['mantenimiento', 'reparacion', 'repuesto', 'lubricante'], ARRAY['mantenimiento.*vehiculo']),

('5150', 'Adecuación e Instalación', 'Gastos por adecuaciones e instalaciones', 4, '51', 'expense', 'debit', ARRAY['adecuacion', 'instalacion', 'decoracion', 'remodelacion'], ARRAY['adecuacion.*oficina']),

('5155', 'Gastos de Viaje', 'Gastos de viaje, hospedaje y alimentación', 4, '51', 'expense', 'debit', ARRAY['viaje', 'hotel', 'hospedaje', 'alimentacion', 'transporte'], ARRAY['gastos.*viaje']),

('5160', 'Depreciaciones', 'Depreciación de activos fijos', 4, '51', 'expense', 'debit', ARRAY['depreciacion', 'desgaste', 'amortizacion'], ARRAY['depreciacion.*lineal']),

('5165', 'Amortizaciones', 'Amortización de activos intangibles', 4, '51', 'expense', 'debit', ARRAY['amortizacion', 'intangible', 'diferido'], ARRAY['amortizacion.*diferida']),

-- Gastos de Ventas (52)
('5205', 'Gastos de Personal de Ventas', 'Personal dedicado exclusivamente a ventas', 4, '52', 'expense', 'debit', ARRAY['vendedor', 'comercial', 'ventas', 'mercadeo'], ARRAY['personal.*ventas']),

('5210', 'Comisiones', 'Comisiones pagadas por ventas realizadas', 4, '52', 'expense', 'debit', ARRAY['comision', 'incentivo', 'bonus', 'premio'], ARRAY['comis.*ventas']),

('5215', 'Publicidad y Propaganda', 'Gastos de publicidad y promoción', 4, '52', 'expense', 'debit', ARRAY['publicidad', 'propaganda', 'marketing', 'promocion', 'anuncio'], ARRAY['marketing.*digital', 'redes.*sociales']),

-- Ingresos (41)
('4110', 'Agricultura, ganadería, caza y silvicultura', 'Ingresos por actividades del sector primario', 4, '41', 'income', 'credit', ARRAY['agricultura', 'ganaderia', 'cultivo', 'cosecha'], ARRAY['agro.*']),

('4135', 'Comercio al por mayor y al por menor', 'Ingresos por ventas de mercancías', 4, '41', 'income', 'credit', ARRAY['venta', 'comercio', 'retail', 'mayorista'], ARRAY['venta.*productos']),

('4175', 'Actividades de servicios empresariales', 'Ingresos por servicios prestados a empresas', 4, '41', 'income', 'credit', ARRAY['servicio', 'consultoria', 'asesoria', 'outsourcing'], ARRAY['servicios.*empresariales']),

-- Activos Fijos (15)
('1504', 'Equipo de oficina', 'Muebles y enseres de oficina', 4, '15', 'asset', 'debit', ARRAY['mueble', 'escritorio', 'silla', 'oficina'], ARRAY['mobiliario.*oficina']),

('1528', 'Equipo de computación y comunicación', 'Equipos informáticos y de comunicaciones', 4, '15', 'asset', 'debit', ARRAY['computador', 'laptop', 'servidor', 'telefono', 'router'], ARRAY['equipo.*computo']),

('2805', 'Software y Licencias', 'Software, licencias y sistemas informáticos', 4, '28', 'asset', 'debit', ARRAY['software', 'licencia', 'office', 'microsoft', 'programa', 'aplicacion', 'sistema'], ARRAY['office.*365', 'microsoft.*office', 'licencia.*software']),

('1540', 'Flota y equipo de transporte', 'Vehículos y equipo de transporte', 4, '15', 'asset', 'debit', ARRAY['vehiculo', 'carro', 'camion', 'moto', 'transporte'], ARRAY['flota.*vehicular']);

-- Create parent codes if they don't exist
INSERT INTO public.puc_accounts (code, name, description, level, parent_code, account_type, nature) VALUES
('51', 'Gastos Administrativos', 'Gastos generales de administración', 2, '5', 'expense', 'debit'),
('52', 'Gastos de Ventas', 'Gastos relacionados con ventas', 2, '5', 'expense', 'debit'),
('41', 'Ingresos Operacionales', 'Ingresos por actividad principal', 2, '4', 'income', 'credit'),
('15', 'Propiedades, Planta y Equipo', 'Activos fijos tangibles', 2, '1', 'asset', 'debit'),
('28', 'Otros Activos', 'Otros activos intangibles', 2, '2', 'asset', 'debit'),
('5', 'Gastos', 'Gastos operacionales y no operacionales', 1, NULL, 'expense', 'debit'),
('4', 'Ingresos', 'Ingresos operacionales y no operacionales', 1, NULL, 'income', 'credit'),
('1', 'Activos', 'Recursos controlados por la entidad', 1, NULL, 'asset', 'debit'),
('2', 'Activos', 'Otros activos', 1, NULL, 'asset', 'debit')
ON CONFLICT (code) DO NOTHING;

-- Update timestamps
UPDATE public.puc_accounts SET 
  created_at = NOW(),
  updated_at = NOW();

-- Verify the insert
SELECT 
  code, 
  name, 
  account_type, 
  array_length(keywords, 1) as keyword_count,
  is_active
FROM public.puc_accounts 
WHERE level = 4 
ORDER BY code;