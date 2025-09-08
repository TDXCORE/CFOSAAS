/*
 * -------------------------------------------------------
 * CFO SaaS Platform - Colombian Database Schema (Standalone)
 * Independent schema that works without dependencies
 * -------------------------------------------------------
 */

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

/*
 * -------------------------------------------------------
 * Section: Colombian Tax System Tables (Independent)
 * -------------------------------------------------------
 */

-- Plan Único de Cuentas (PUC) - Colombian Chart of Accounts
CREATE TABLE IF NOT EXISTS public.puc_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Account identification
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Hierarchy
  level INTEGER NOT NULL, -- 1, 2, 3, 4 (PUC levels)
  parent_code VARCHAR(10),
  
  -- Classification
  account_type VARCHAR(50) NOT NULL, -- 'asset', 'liability', 'equity', 'income', 'expense'
  nature VARCHAR(20) NOT NULL, -- 'debit', 'credit'
  
  -- Auto-classification settings
  keywords TEXT[] DEFAULT '{}',
  supplier_patterns TEXT[] DEFAULT '{}',
  typical_amounts JSONB DEFAULT '{}',
  
  -- Tax implications
  tax_implications JSONB DEFAULT '{}',
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add FK constraint for parent_code
ALTER TABLE public.puc_accounts 
ADD CONSTRAINT puc_accounts_parent_code_fkey 
FOREIGN KEY (parent_code) REFERENCES public.puc_accounts(code);

-- Indexes for PUC accounts
CREATE INDEX IF NOT EXISTS idx_puc_accounts_code ON public.puc_accounts(code);
CREATE INDEX IF NOT EXISTS idx_puc_accounts_level ON public.puc_accounts(level);
CREATE INDEX IF NOT EXISTS idx_puc_accounts_parent ON public.puc_accounts(parent_code);
CREATE INDEX IF NOT EXISTS idx_puc_accounts_type ON public.puc_accounts(account_type);
-- Remove problematic GIN index with function, will add simpler index
-- CREATE INDEX IF NOT EXISTS idx_puc_accounts_keywords ON public.puc_accounts USING gin(to_tsvector('spanish', array_to_string(keywords, ' ')));
CREATE INDEX IF NOT EXISTS idx_puc_accounts_keywords ON public.puc_accounts USING gin(keywords);

-- Colombian tax rules
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Colombian scope
  country VARCHAR(2) NOT NULL DEFAULT 'CO',
  department VARCHAR(100),
  municipality VARCHAR(100),
  
  -- Rule type
  rule_type VARCHAR(50) NOT NULL, -- 'IVA', 'RETENCION', 'ICA'
  rule_category VARCHAR(50),
  
  -- Application conditions
  conditions JSONB NOT NULL,
  
  -- Calculation
  calculation_method VARCHAR(50) NOT NULL, -- 'percentage', 'fixed', 'table', 'formula'
  tax_rate DECIMAL(5,4),
  fixed_amount DECIMAL(15,2),
  calculation_formula TEXT,
  
  -- Official codes
  official_code VARCHAR(20),
  dian_code VARCHAR(10),
  
  -- Validity period
  effective_from DATE NOT NULL,
  effective_to DATE,
  
  -- Metadata
  description TEXT,
  legal_reference VARCHAR(255),
  priority INTEGER DEFAULT 100,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for tax rules
CREATE INDEX IF NOT EXISTS idx_tax_rules_type ON public.tax_rules(rule_type, rule_category);
CREATE INDEX IF NOT EXISTS idx_tax_rules_location ON public.tax_rules(country, department, municipality);
CREATE INDEX IF NOT EXISTS idx_tax_rules_effective ON public.tax_rules(effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_tax_rules_active ON public.tax_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_tax_rules_conditions ON public.tax_rules USING gin(conditions);

-- Companies table (Colombian businesses)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  tax_id VARCHAR(50) NOT NULL UNIQUE,
  
  -- Colombian tax information
  fiscal_regime VARCHAR(50), -- 'simplified', 'common', 'special'
  economic_activity_code VARCHAR(10), -- Código CIIU Colombia
  economic_activity_name VARCHAR(255),
  
  -- Company classification
  sector VARCHAR(100), -- 'manufacturing', 'services', 'commerce', etc.
  company_size VARCHAR(20) DEFAULT 'small', -- 'micro', 'small', 'medium', 'large'
  
  -- Colombian location
  country VARCHAR(2) DEFAULT 'CO',
  department VARCHAR(100), -- Colombian department
  city VARCHAR(100), -- Colombian city
  address JSONB DEFAULT '{}',
  
  -- Settings and configuration
  settings JSONB DEFAULT '{}',
  tax_settings JSONB DEFAULT '{}',
  integration_settings JSONB DEFAULT '{}',
  
  -- Subscription info
  subscription_plan VARCHAR(50) DEFAULT 'basic',
  subscription_status VARCHAR(20) DEFAULT 'active',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Indexes for Colombian companies
CREATE INDEX IF NOT EXISTS idx_companies_tax_id ON public.companies(tax_id);
CREATE INDEX IF NOT EXISTS idx_companies_sector ON public.companies(sector);
CREATE INDEX IF NOT EXISTS idx_companies_subscription ON public.companies(subscription_plan, subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_department_city ON public.companies(department, city);

-- User-Company relationships (multi-tenant access control)
CREATE TABLE IF NOT EXISTS public.user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References auth.users(id) but no FK constraint to avoid dependency
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Role-based access control
  role VARCHAR(50) NOT NULL DEFAULT 'viewer', -- 'owner', 'admin', 'accountant', 'auditor', 'viewer'
  permissions JSONB DEFAULT '{}',
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'pending'
  invited_by UUID, -- References auth.users(id)
  invited_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, company_id)
);

-- Enable RLS
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_companies_user ON public.user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON public.user_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_role ON public.user_companies(role, status);

-- Classification rules for automatic PUC assignment
CREATE TABLE IF NOT EXISTS public.classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Optional company-specific rules
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Classification rule
  rule_name VARCHAR(255) NOT NULL,
  puc_code VARCHAR(10) NOT NULL REFERENCES public.puc_accounts(code),
  
  -- Application conditions
  conditions JSONB NOT NULL,
  
  -- Configuration
  confidence_weight DECIMAL(3,2) DEFAULT 0.5,
  priority INTEGER DEFAULT 100,
  
  -- ML metrics
  usage_count INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(3,2) DEFAULT 0.5,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_classification_rules_company ON public.classification_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_classification_rules_puc ON public.classification_rules(puc_code);
CREATE INDEX IF NOT EXISTS idx_classification_rules_priority ON public.classification_rules(priority DESC);

/*
 * -------------------------------------------------------
 * Section: Invoice Processing Tables
 * -------------------------------------------------------
 */

-- Main invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Document identification
  invoice_number VARCHAR(100) NOT NULL,
  external_id VARCHAR(100),
  document_type VARCHAR(50) DEFAULT 'invoice', -- 'invoice', 'credit_note', 'debit_note'
  
  -- Dates
  issue_date DATE NOT NULL,
  due_date DATE,
  tax_date DATE,
  
  -- Supplier/Customer info
  supplier_tax_id VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_email VARCHAR(255),
  customer_tax_id VARCHAR(50),
  customer_name VARCHAR(255),
  
  -- Amounts
  currency VARCHAR(3) DEFAULT 'COP',
  subtotal DECIMAL(15,2) NOT NULL,
  total_tax DECIMAL(15,2) DEFAULT 0,
  total_retention DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  
  -- PUC classification
  puc_code VARCHAR(10) REFERENCES public.puc_accounts(code),
  puc_name VARCHAR(255),
  account_classification_confidence DECIMAL(3,2),
  
  -- Processing status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'validated', 'exported', 'error'
  processing_status VARCHAR(50) DEFAULT 'uploaded', -- 'uploaded', 'extracted', 'classified', 'calculated', 'validated'
  
  -- Source files
  source_file_name VARCHAR(255),
  source_file_type VARCHAR(50), -- 'xml', 'pdf', 'zip_attachment'
  source_file_url TEXT,
  source_email_id VARCHAR(255),
  source_email_sender VARCHAR(255),
  
  -- Processing metadata
  processing_metadata JSONB DEFAULT '{}',
  validation_errors JSONB DEFAULT '[]',
  manual_review_required BOOLEAN DEFAULT FALSE,
  reviewed_by UUID, -- References auth.users(id)
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Export info
  exported_to VARCHAR(50),
  external_reference VARCHAR(255),
  exported_at TIMESTAMP WITH TIME ZONE,
  export_status VARCHAR(50) DEFAULT 'stored',
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Critical indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON public.invoices(supplier_tax_id);
CREATE INDEX IF NOT EXISTS idx_invoices_dates ON public.invoices(issue_date, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status, processing_status);
CREATE INDEX IF NOT EXISTS idx_invoices_amounts ON public.invoices(total_amount);
CREATE INDEX IF NOT EXISTS idx_invoices_puc ON public.invoices(puc_code);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON public.invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_company_status_date ON public.invoices(company_id, status, issue_date DESC);

-- Full-text search - simplified to avoid IMMUTABLE function issue
-- CREATE INDEX IF NOT EXISTS idx_invoices_search ON public.invoices USING gin(to_tsvector('spanish', coalesce(supplier_name, '') || ' ' || coalesce(invoice_number, '')));
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_name ON public.invoices(supplier_name);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);

-- Invoice line items
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Item identification
  line_number INTEGER NOT NULL,
  product_code VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  product_description TEXT,
  
  -- Quantities and prices
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  
  -- Account classification
  puc_code VARCHAR(10) REFERENCES public.puc_accounts(code),
  puc_name VARCHAR(255),
  cost_center VARCHAR(50),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_line_items_product ON public.invoice_line_items(product_code);
CREATE INDEX IF NOT EXISTS idx_line_items_puc ON public.invoice_line_items(puc_code);

-- Invoice taxes (Colombian tax calculations)
CREATE TABLE IF NOT EXISTS public.invoice_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Tax type
  tax_type VARCHAR(50) NOT NULL, -- 'IVA', 'ICA', 'RETENCION_FUENTE', 'RETENCION_IVA', 'RETENCION_ICA'
  tax_category VARCHAR(50),
  
  -- Calculation
  taxable_base DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,4) NOT NULL,
  tax_amount DECIMAL(15,2) NOT NULL,
  
  -- Official codes
  dian_code VARCHAR(10),
  municipal_code VARCHAR(10),
  
  -- Calculation metadata
  calculation_method VARCHAR(50) DEFAULT 'automatic',
  applied_rule VARCHAR(255),
  confidence DECIMAL(3,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.invoice_taxes ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoice_taxes_invoice ON public.invoice_taxes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_taxes_type ON public.invoice_taxes(tax_type);
CREATE INDEX IF NOT EXISTS idx_invoice_taxes_amount ON public.invoice_taxes(tax_amount);

/*
 * -------------------------------------------------------
 * Section: AI CFO Tables
 * -------------------------------------------------------
 */

-- AI insights table
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Insight type
  insight_type VARCHAR(50) NOT NULL, -- 'cash_flow', 'risk_analysis', 'sector_comparison', 'recommendation'
  category VARCHAR(50),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  summary VARCHAR(500),
  
  -- Structured data
  data JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  
  -- AI metadata
  ai_model VARCHAR(50) DEFAULT 'gpt-4-turbo',
  confidence DECIMAL(3,2) NOT NULL,
  reasoning TEXT,
  
  -- Classification
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
  
  -- User interaction
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  user_feedback JSONB DEFAULT '{}',
  
  -- Validity
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_insights_company ON public.ai_insights(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON public.ai_insights(insight_type, category);
CREATE INDEX IF NOT EXISTS idx_ai_insights_priority ON public.ai_insights(priority, severity);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created ON public.ai_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_unread ON public.ai_insights(company_id, is_read, created_at DESC);

-- Chat conversations with AI CFO
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- References auth.users(id)
  
  -- Conversation metadata
  title VARCHAR(255),
  summary TEXT,
  
  -- Configuration
  ai_model VARCHAR(50) DEFAULT 'gpt-4-turbo',
  system_prompt TEXT,
  
  -- Status
  is_archived BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  
  -- Message content
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  
  -- AI metadata
  ai_model VARCHAR(50),
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  confidence DECIMAL(3,2),
  
  -- References
  referenced_invoices UUID[] DEFAULT '{}',
  referenced_insights UUID[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_company ON public.chat_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id, created_at);

/*
 * -------------------------------------------------------
 * Section: Utility Functions and Triggers
 * -------------------------------------------------------
 */

-- Function to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_companies_updated_at 
  BEFORE UPDATE ON public.companies 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_companies_updated_at 
  BEFORE UPDATE ON public.user_companies 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at 
  BEFORE UPDATE ON public.invoices 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_insights_updated_at 
  BEFORE UPDATE ON public.ai_insights 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at 
  BEFORE UPDATE ON public.chat_conversations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

/*
 * -------------------------------------------------------
 * Section: Row Level Security (RLS) Policies
 * -------------------------------------------------------
 */

-- Companies: Users can only access companies they belong to
CREATE POLICY "Users can only access their companies" ON public.companies
FOR ALL USING (
  id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- User companies: Users can only access their own relationships
CREATE POLICY "Users can only access their company relationships" ON public.user_companies
FOR ALL USING (user_id = auth.uid());

-- Invoices: Users can only access company invoices
CREATE POLICY "Users can only access company invoices" ON public.invoices
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Invoice line items: Users can only access company invoice items
CREATE POLICY "Users can only access company line items" ON public.invoice_line_items
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Invoice taxes: Users can only access company taxes
CREATE POLICY "Users can only access company taxes" ON public.invoice_taxes
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Classification rules: Users can access global and company-specific rules
CREATE POLICY "Users can access classification rules" ON public.classification_rules
FOR ALL USING (
  company_id IS NULL OR 
  company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- AI insights: Users can only access company insights
CREATE POLICY "Users can only access company insights" ON public.ai_insights
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Chat conversations: Users can only access their conversations
CREATE POLICY "Users can only access company conversations" ON public.chat_conversations
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Chat messages: Users can only access messages from their conversations
CREATE POLICY "Users can only access their messages" ON public.chat_messages
FOR ALL USING (
  conversation_id IN (
    SELECT id FROM public.chat_conversations 
    WHERE company_id IN (
      SELECT company_id FROM public.user_companies 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant service_role full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;