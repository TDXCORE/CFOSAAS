/*
 * Enhanced Tax System Migration
 * Adds detailed retention tracking for Colombian tax system 2025
 */

-- Table for detailed tax entity information
CREATE TABLE IF NOT EXISTS public.tax_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_id VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255),

  -- Entity classification
  entity_type VARCHAR(50) NOT NULL, -- 'natural_person', 'company'
  regime_type VARCHAR(50) NOT NULL DEFAULT 'simplified', -- 'simplified', 'common', 'special'

  -- Tax characteristics
  is_retention_agent BOOLEAN DEFAULT FALSE,
  is_ica_subject BOOLEAN DEFAULT FALSE,
  is_declarant BOOLEAN DEFAULT FALSE,

  -- Location and activity
  municipalities TEXT[] DEFAULT '{}',
  economic_activity_code VARCHAR(10),
  economic_activity_name VARCHAR(255),

  -- Verification status
  verification_status VARCHAR(50) DEFAULT 'pending', -- 'verified', 'pending', 'manual_review'
  verification_confidence DECIMAL(3,2) DEFAULT 0.5,
  last_verified_at TIMESTAMP WITH TIME ZONE,

  -- Source of information
  data_source VARCHAR(50) DEFAULT 'automatic', -- 'automatic', 'manual', 'dian_api', 'user_input'

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced invoice_taxes table with detailed retention information
ALTER TABLE public.invoice_taxes ADD COLUMN IF NOT EXISTS concept_code VARCHAR(10);
ALTER TABLE public.invoice_taxes ADD COLUMN IF NOT EXISTS concept_description VARCHAR(255);
ALTER TABLE public.invoice_taxes ADD COLUMN IF NOT EXISTS threshold_uvt INTEGER;
ALTER TABLE public.invoice_taxes ADD COLUMN IF NOT EXISTS municipality VARCHAR(100);
ALTER TABLE public.invoice_taxes ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(50);
ALTER TABLE public.invoice_taxes ADD COLUMN IF NOT EXISTS calculation_details JSONB DEFAULT '{}';
ALTER TABLE public.invoice_taxes ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'automatic';

-- Table for retention certificates
CREATE TABLE IF NOT EXISTS public.retention_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Certificate details
  certificate_number VARCHAR(50) NOT NULL,
  certificate_year INTEGER NOT NULL,
  supplier_tax_id VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL,

  -- Period information
  period_year INTEGER NOT NULL,
  period_month INTEGER, -- NULL for annual certificates

  -- Retention totals
  total_retefuente DECIMAL(15,2) DEFAULT 0,
  total_reteica DECIMAL(15,2) DEFAULT 0,
  total_reteiva DECIMAL(15,2) DEFAULT 0,
  total_base_retefuente DECIMAL(15,2) DEFAULT 0,
  total_base_reteiva DECIMAL(15,2) DEFAULT 0,

  -- Certificate status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'issued', 'sent', 'acknowledged'
  issued_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,

  -- Related invoices
  invoice_ids UUID[] DEFAULT '{}',

  -- File references
  pdf_file_url TEXT,
  xml_file_url TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id, certificate_number, certificate_year)
);

-- Table for retention rules configuration (company-specific overrides)
CREATE TABLE IF NOT EXISTS public.retention_rules_override (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Rule identification
  rule_name VARCHAR(255) NOT NULL,
  retention_type VARCHAR(50) NOT NULL, -- 'RETENCION_FUENTE', 'RETENCION_ICA', 'RETENCION_IVA'
  concept_code VARCHAR(10),

  -- Override configuration
  override_rate DECIMAL(5,4),
  override_threshold_uvt INTEGER,
  override_conditions JSONB DEFAULT '{}',

  -- Applicability
  supplier_types TEXT[] DEFAULT '{}', -- ['natural_person', 'company']
  service_types TEXT[] DEFAULT '{}', -- ['services', 'goods', etc.]
  municipalities TEXT[] DEFAULT '{}',

  -- Validity
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Metadata
  created_by UUID, -- References auth.users(id)
  reason VARCHAR(500),
  legal_reference VARCHAR(255),

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tax_entities_tax_id ON public.tax_entities(tax_id);
CREATE INDEX IF NOT EXISTS idx_tax_entities_type ON public.tax_entities(entity_type, regime_type);
CREATE INDEX IF NOT EXISTS idx_tax_entities_verification ON public.tax_entities(verification_status, last_verified_at);

CREATE INDEX IF NOT EXISTS idx_invoice_taxes_concept ON public.invoice_taxes(concept_code, tax_type);
CREATE INDEX IF NOT EXISTS idx_invoice_taxes_municipality ON public.invoice_taxes(municipality);
CREATE INDEX IF NOT EXISTS idx_invoice_taxes_supplier_type ON public.invoice_taxes(supplier_type);

CREATE INDEX IF NOT EXISTS idx_retention_certificates_supplier ON public.retention_certificates(supplier_tax_id);
CREATE INDEX IF NOT EXISTS idx_retention_certificates_period ON public.retention_certificates(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_retention_certificates_status ON public.retention_certificates(status, company_id);

CREATE INDEX IF NOT EXISTS idx_retention_rules_company ON public.retention_rules_override(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_retention_rules_type ON public.retention_rules_override(retention_type, concept_code);

-- RLS Policies
ALTER TABLE public.tax_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_rules_override ENABLE ROW LEVEL SECURITY;

-- Tax entities: readable by all authenticated users (for validation purposes)
DROP POLICY IF EXISTS "Tax entities are readable by authenticated users" ON public.tax_entities;
CREATE POLICY "Tax entities are readable by authenticated users" ON public.tax_entities
FOR SELECT USING (auth.role() = 'authenticated');

-- Tax entities: writable by system processes
DROP POLICY IF EXISTS "Tax entities are writable by service role" ON public.tax_entities;
CREATE POLICY "Tax entities are writable by service role" ON public.tax_entities
FOR ALL USING (auth.role() = 'service_role');

-- Retention certificates: company-scoped access
DROP POLICY IF EXISTS "Users can access company retention certificates" ON public.retention_certificates;
CREATE POLICY "Users can access company retention certificates" ON public.retention_certificates
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Retention rules override: company-scoped access
DROP POLICY IF EXISTS "Users can access company retention rules" ON public.retention_rules_override;
CREATE POLICY "Users can access company retention rules" ON public.retention_rules_override
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM public.user_companies
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_tax_entities_updated_at') THEN
        CREATE TRIGGER update_tax_entities_updated_at
        BEFORE UPDATE ON public.tax_entities
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_retention_certificates_updated_at') THEN
        CREATE TRIGGER update_retention_certificates_updated_at
        BEFORE UPDATE ON public.retention_certificates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_retention_rules_updated_at') THEN
        CREATE TRIGGER update_retention_rules_updated_at
        BEFORE UPDATE ON public.retention_rules_override
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_entities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_certificates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_rules_override TO authenticated;

GRANT ALL ON public.tax_entities TO service_role;
GRANT ALL ON public.retention_certificates TO service_role;
GRANT ALL ON public.retention_rules_override TO service_role;

-- Insert sample tax entities for testing
INSERT INTO public.tax_entities (tax_id, name, entity_type, regime_type, is_retention_agent, is_ica_subject, is_declarant) VALUES
('900123456', 'Empresa de Prueba S.A.S.', 'company', 'common', true, true, true),
('12345678', 'Juan Pérez', 'natural_person', 'simplified', false, false, false),
('800234567', 'Fundación Especial', 'company', 'special', true, false, true),
('987654321', 'María González (Declarante)', 'natural_person', 'common', false, true, true),
('111222333', 'Empresa Grande S.A.', 'company', 'common', true, true, true)
ON CONFLICT (tax_id) DO NOTHING;

-- Update existing invoice taxes with sample data
UPDATE public.invoice_taxes
SET
  concept_code = CASE
    WHEN tax_type = 'IVA' THEN '01'
    WHEN tax_type = 'RETENCION_FUENTE' THEN '365'
    WHEN tax_type = 'RETENCION_ICA' THEN 'ICA'
    ELSE NULL
  END,
  concept_description = CASE
    WHEN tax_type = 'IVA' THEN 'IVA General 19%'
    WHEN tax_type = 'RETENCION_FUENTE' THEN 'Servicios en general'
    WHEN tax_type = 'RETENCION_ICA' THEN 'RETEICA Bogotá'
    ELSE tax_type
  END,
  supplier_type = 'company',
  municipality = 'Bogotá',
  verification_status = 'automatic'
WHERE concept_code IS NULL;

-- Create function to get retention summary
CREATE OR REPLACE FUNCTION get_retention_summary(p_company_id UUID, p_period_year INTEGER, p_period_month INTEGER DEFAULT NULL)
RETURNS TABLE(
  tax_type VARCHAR(50),
  concept_code VARCHAR(10),
  total_amount DECIMAL(15,2),
  total_base DECIMAL(15,2),
  invoice_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    it.tax_type,
    it.concept_code,
    SUM(it.tax_amount) as total_amount,
    SUM(it.taxable_base) as total_base,
    COUNT(DISTINCT it.invoice_id) as invoice_count
  FROM public.invoice_taxes it
  JOIN public.invoices i ON it.invoice_id = i.id
  WHERE
    it.company_id = p_company_id
    AND EXTRACT(YEAR FROM i.issue_date) = p_period_year
    AND (p_period_month IS NULL OR EXTRACT(MONTH FROM i.issue_date) = p_period_month)
    AND it.tax_type IN ('RETENCION_FUENTE', 'RETENCION_ICA', 'RETENCION_IVA')
    AND i.deleted_at IS NULL
  GROUP BY it.tax_type, it.concept_code
  ORDER BY it.tax_type, it.concept_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;