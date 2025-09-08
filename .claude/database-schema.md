# Database Schema - CFO SaaS Platform

## Arquitectura de Base de Datos

### Tecnología Base
- **Motor:** PostgreSQL 15+ (Supabase managed)
- **Features:** Row Level Security (RLS), Real-time subscriptions, Full-text search
- **Extensiones:** pgcrypto, uuid-ossp, pg_trgm, unaccent
- **Escalabilidad:** Connection pooling, Read replicas (Supabase Pro)

### Principios de Diseño
```sql
-- Multi-tenancy con Row Level Security
-- Auditoría completa de cambios
-- Soft deletes para datos críticos
-- Índices optimizados para consultas frecuentes
-- Validaciones a nivel de base de datos
```

## 1. Core Tables - Multi-tenancy y Usuarios

### companies (Empresas/Tenants)
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  tax_id VARCHAR(50) NOT NULL UNIQUE,
  
  -- Información fiscal
  fiscal_regime VARCHAR(50), -- 'simplified', 'common', 'special'
  economic_activity_code VARCHAR(10), -- Código CIIU
  economic_activity_name VARCHAR(255),
  
  -- Clasificación
  sector VARCHAR(100), -- 'manufacturing', 'services', 'commerce', etc.
  size ENUM('micro', 'small', 'medium', 'large') DEFAULT 'small',
  
  -- Ubicación Colombia
  country VARCHAR(2) DEFAULT 'CO', -- Siempre Colombia
  department VARCHAR(100), -- Departamento Colombia
  city VARCHAR(100), -- Ciudad Colombia
  address JSONB,
  
  -- Configuraciones
  settings JSONB DEFAULT '{}',
  tax_settings JSONB DEFAULT '{}',
  integration_settings JSONB DEFAULT '{}',
  
  -- Suscripción
  subscription_plan VARCHAR(50) DEFAULT 'basic',
  subscription_status VARCHAR(20) DEFAULT 'active',
  trial_ends_at TIMESTAMP,
  
  -- Metadatos
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Índices para optimización Colombia
CREATE INDEX idx_companies_tax_id ON companies(tax_id);
CREATE INDEX idx_companies_sector ON companies(sector);
CREATE INDEX idx_companies_subscription ON companies(subscription_plan, subscription_status);
CREATE INDEX idx_companies_department_city ON companies(department, city);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at 
  BEFORE UPDATE ON companies 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### user_companies (Relación usuarios-empresas)
```sql
CREATE TABLE user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Role-based access control
  role VARCHAR(50) NOT NULL DEFAULT 'viewer', -- 'owner', 'admin', 'accountant', 'auditor', 'viewer'
  permissions JSONB DEFAULT '{}', -- Granular permissions
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'pending'
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,
  
  -- Metadatos
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, company_id)
);

-- RLS Policy para multi-tenancy
CREATE POLICY "Users can only access their companies" ON user_companies
FOR ALL USING (user_id = auth.uid());

-- Índices
CREATE INDEX idx_user_companies_user ON user_companies(user_id);
CREATE INDEX idx_user_companies_company ON user_companies(company_id);
CREATE INDEX idx_user_companies_role ON user_companies(role, status);
```

## 2. Invoice Processing Tables

### invoices (Facturas principales)
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Identificación del documento
  invoice_number VARCHAR(100) NOT NULL,
  external_id VARCHAR(100), -- ID en sistema externo
  document_type VARCHAR(50) DEFAULT 'invoice', -- 'invoice', 'credit_note', 'debit_note'
  
  -- Fechas
  issue_date DATE NOT NULL,
  due_date DATE,
  tax_date DATE, -- Para efectos tributarios
  
  -- Proveedor/Cliente
  supplier_tax_id VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_email VARCHAR(255),
  customer_tax_id VARCHAR(50),
  customer_name VARCHAR(255),
  
  -- Montos
  currency VARCHAR(3) DEFAULT 'COP',
  subtotal DECIMAL(15,2) NOT NULL,
  total_tax DECIMAL(15,2) DEFAULT 0,
  total_retention DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  
  -- Clasificación contable
  puc_code VARCHAR(10), -- Código PUC principal
  puc_name VARCHAR(255),
  account_classification_confidence DECIMAL(3,2), -- 0-1
  
  -- Procesamiento
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'validated', 'exported', 'error'
  processing_status VARCHAR(50) DEFAULT 'uploaded', -- 'uploaded', 'extracted', 'classified', 'calculated', 'validated'
  
  -- Archivos origen
  source_file_name VARCHAR(255),
  source_file_type VARCHAR(50), -- 'xml', 'pdf', 'zip_attachment'
  source_file_url TEXT, -- URL en Supabase Storage
  source_email_id VARCHAR(255), -- ID del email O365/Outlook
  source_email_sender VARCHAR(255), -- Email del remitente
  
  -- Metadatos de procesamiento
  processing_metadata JSONB DEFAULT '{}', -- Logs, errores, confianza
  validation_errors JSONB DEFAULT '[]',
  manual_review_required BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP,
  
  -- Exportación (futuro)
  exported_to VARCHAR(50), -- Para futuras integraciones contables
  external_reference VARCHAR(255), -- ID en sistema externo
  exported_at TIMESTAMP,
  export_status VARCHAR(50) DEFAULT 'stored', -- 'stored', 'pending', 'exported', 'failed'
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);

-- Índices críticos para performance
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_supplier ON invoices(supplier_tax_id);
CREATE INDEX idx_invoices_dates ON invoices(issue_date, due_date);
CREATE INDEX idx_invoices_status ON invoices(status, processing_status);
CREATE INDEX idx_invoices_amounts ON invoices(total_amount);
CREATE INDEX idx_invoices_puc ON invoices(puc_code);
CREATE INDEX idx_invoices_created ON invoices(created_at);

-- Índice compuesto para queries frecuentes
CREATE INDEX idx_invoices_company_status_date ON invoices(company_id, status, issue_date DESC);

-- Full-text search para descripción y proveedor
CREATE INDEX idx_invoices_search ON invoices USING gin(
  to_tsvector('spanish', coalesce(supplier_name, '') || ' ' || coalesce(invoice_number, ''))
);

-- RLS Policy
CREATE POLICY "Users can only access company invoices" ON invoices
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_invoices_updated_at 
  BEFORE UPDATE ON invoices 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### invoice_line_items (Líneas de factura)
```sql
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Identificación del ítem
  line_number INTEGER NOT NULL,
  product_code VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  product_description TEXT,
  
  -- Cantidades y precios
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  
  -- Clasificación contable específica
  puc_code VARCHAR(10),
  puc_name VARCHAR(255),
  cost_center VARCHAR(50),
  
  -- Metadatos
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_line_items_company 
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Índices
CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_line_items_product ON invoice_line_items(product_code);
CREATE INDEX idx_line_items_puc ON invoice_line_items(puc_code);

-- RLS Policy
CREATE POLICY "Users can only access company line items" ON invoice_line_items
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

### invoice_taxes (Impuestos por factura)
```sql
CREATE TABLE invoice_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Tipo de impuesto
  tax_type VARCHAR(50) NOT NULL, -- 'IVA', 'ICA', 'RETENCION_FUENTE', 'RETENCION_IVA', 'RETENCION_ICA'
  tax_category VARCHAR(50), -- Para subcategorías específicas
  
  -- Cálculo
  taxable_base DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,4) NOT NULL, -- 0.19 para 19%
  tax_amount DECIMAL(15,2) NOT NULL,
  
  -- Códigos oficiales
  dian_code VARCHAR(10), -- Código DIAN para el impuesto
  municipal_code VARCHAR(10), -- Para ICA municipal
  
  -- Metadatos de cálculo
  calculation_method VARCHAR(50) DEFAULT 'automatic', -- 'automatic', 'manual', 'override'
  applied_rule VARCHAR(255), -- Regla de negocio aplicada
  confidence DECIMAL(3,2), -- Confianza del cálculo automático
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_invoice_taxes_invoice ON invoice_taxes(invoice_id);
CREATE INDEX idx_invoice_taxes_type ON invoice_taxes(tax_type);
CREATE INDEX idx_invoice_taxes_amount ON invoice_taxes(tax_amount);

-- RLS Policy
CREATE POLICY "Users can only access company taxes" ON invoice_taxes
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

## 3. Tax Engine Tables

### tax_rules (Reglas tributarias Colombia)
```sql
CREATE TABLE tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ámbito de aplicación Colombia
  country VARCHAR(2) NOT NULL DEFAULT 'CO', -- Siempre Colombia
  department VARCHAR(100), -- Departamento Colombia
  municipality VARCHAR(100), -- Municipio (para ICA)
  
  -- Tipo de regla
  rule_type VARCHAR(50) NOT NULL, -- 'IVA', 'RETENCION', 'ICA'
  rule_category VARCHAR(50), -- Subcategoría específica
  
  -- Condiciones de aplicación
  conditions JSONB NOT NULL, -- Condiciones complejas en JSON
  /*
  Ejemplo conditions:
  {
    "puc_codes": ["4135", "4175"],
    "amount_range": {"min": 0, "max": 1000000},
    "supplier_type": "company",
    "fiscal_regime": ["common", "special"]
  }
  */
  
  -- Cálculo
  calculation_method VARCHAR(50) NOT NULL, -- 'percentage', 'fixed', 'table', 'formula'
  tax_rate DECIMAL(5,4), -- Para cálculos por porcentaje
  fixed_amount DECIMAL(15,2), -- Para montos fijos
  calculation_formula TEXT, -- Fórmula compleja si es necesario
  
  -- Códigos oficiales
  official_code VARCHAR(20),
  dian_code VARCHAR(10),
  
  -- Vigencia
  effective_from DATE NOT NULL,
  effective_to DATE,
  
  -- Metadatos
  description TEXT,
  legal_reference VARCHAR(255), -- Referencia legal (decreto, resolución, etc.)
  priority INTEGER DEFAULT 100, -- Para resolver conflictos entre reglas
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsqueda eficiente de reglas Colombia
CREATE INDEX idx_tax_rules_type ON tax_rules(rule_type, rule_category);
CREATE INDEX idx_tax_rules_location ON tax_rules(country, department, municipality);
CREATE INDEX idx_tax_rules_effective ON tax_rules(effective_from, effective_to);
CREATE INDEX idx_tax_rules_active ON tax_rules(is_active);

-- Índice GIN para búsquedas en conditions JSON
CREATE INDEX idx_tax_rules_conditions ON tax_rules USING gin(conditions);
```

### puc_accounts (Plan Único de Cuentas)
```sql
CREATE TABLE puc_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación de la cuenta
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Jerarquía
  level INTEGER NOT NULL, -- 1, 2, 3, 4 (niveles del PUC)
  parent_code VARCHAR(10) REFERENCES puc_accounts(code),
  
  -- Clasificación
  account_type VARCHAR(50) NOT NULL, -- 'asset', 'liability', 'equity', 'income', 'expense'
  nature VARCHAR(20) NOT NULL, -- 'debit', 'credit'
  
  -- Configuración para clasificación automática
  keywords TEXT[], -- Palabras clave para clasificación
  supplier_patterns TEXT[], -- Patrones de nombres de proveedores
  typical_amounts JSONB, -- Rangos de montos típicos
  
  -- Configuración tributaria
  tax_implications JSONB DEFAULT '{}',
  /*
  {
    "generates_retention": true,
    "iva_rate": 0.19,
    "typical_taxes": ["IVA", "RETENCION_FUENTE"]
  }
  */
  
  -- Metadatos
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_puc_accounts_code ON puc_accounts(code);
CREATE INDEX idx_puc_accounts_level ON puc_accounts(level);
CREATE INDEX idx_puc_accounts_parent ON puc_accounts(parent_code);
CREATE INDEX idx_puc_accounts_type ON puc_accounts(account_type);

-- Full-text search para keywords
CREATE INDEX idx_puc_accounts_keywords ON puc_accounts USING gin(to_tsvector('spanish', array_to_string(keywords, ' ')));
```

### classification_rules (Reglas de clasificación PUC)
```sql
CREATE TABLE classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Configuración por empresa (opcional para reglas específicas)
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Regla de clasificación
  rule_name VARCHAR(255) NOT NULL,
  puc_code VARCHAR(10) NOT NULL REFERENCES puc_accounts(code),
  
  -- Condiciones de aplicación
  conditions JSONB NOT NULL,
  /*
  Ejemplo:
  {
    "supplier_name_contains": ["banco", "financiera"],
    "amount_range": {"min": 100000},
    "description_keywords": ["intereses", "credito"],
    "exclude_keywords": ["devolucion"]
  }
  */
  
  -- Configuración
  confidence_weight DECIMAL(3,2) DEFAULT 0.5, -- Peso en el cálculo de confianza
  priority INTEGER DEFAULT 100, -- Prioridad para resolución de conflictos
  
  -- Metadatos
  usage_count INTEGER DEFAULT 0, -- Contador de usos para ML
  accuracy_rate DECIMAL(3,2) DEFAULT 0.5, -- Tasa de acierto histórica
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_classification_rules_company ON classification_rules(company_id);
CREATE INDEX idx_classification_rules_puc ON classification_rules(puc_code);
CREATE INDEX idx_classification_rules_priority ON classification_rules(priority DESC);

-- RLS Policy (opcional para reglas específicas de empresa)
CREATE POLICY "Users can only access company classification rules" ON classification_rules
FOR ALL USING (
  company_id IS NULL OR 
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

## 4. AI CFO Tables

### ai_insights (Insights generados por IA)
```sql
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Tipo de insight
  insight_type VARCHAR(50) NOT NULL, -- 'cash_flow', 'risk_analysis', 'sector_comparison', 'recommendation'
  category VARCHAR(50), -- Subcategoría específica
  
  -- Contenido del insight
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  summary VARCHAR(500), -- Resumen ejecutivo
  
  -- Datos estructurados
  data JSONB DEFAULT '{}', -- Datos subyacentes del análisis
  metrics JSONB DEFAULT '{}', -- Métricas específicas
  recommendations JSONB DEFAULT '[]', -- Recomendaciones accionables
  
  -- Metadatos de IA
  ai_model VARCHAR(50) DEFAULT 'gpt-4-turbo', -- Modelo usado
  confidence DECIMAL(3,2) NOT NULL, -- 0-1
  reasoning TEXT, -- Explicación del análisis
  
  -- Clasificación
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
  
  -- Interacción del usuario
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  user_feedback JSONB DEFAULT '{}', -- Rating, comentarios
  
  -- Vigencia
  expires_at TIMESTAMP, -- Para insights temporales
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para queries frecuentes
CREATE INDEX idx_ai_insights_company ON ai_insights(company_id);
CREATE INDEX idx_ai_insights_type ON ai_insights(insight_type, category);
CREATE INDEX idx_ai_insights_priority ON ai_insights(priority, severity);
CREATE INDEX idx_ai_insights_created ON ai_insights(created_at DESC);
CREATE INDEX idx_ai_insights_unread ON ai_insights(company_id, is_read, created_at DESC);

-- RLS Policy
CREATE POLICY "Users can only access company insights" ON ai_insights
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

### chat_conversations (Conversaciones con AI CFO)
```sql
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Metadatos de la conversación
  title VARCHAR(255), -- Generado automáticamente del primer mensaje
  summary TEXT, -- Resumen de la conversación
  
  -- Configuración
  ai_model VARCHAR(50) DEFAULT 'gpt-4-turbo',
  system_prompt TEXT, -- Prompt personalizado si es necesario
  
  -- Estado
  is_archived BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para mensajes individuales
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  
  -- Mensaje
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  
  -- Metadatos para respuestas de IA
  ai_model VARCHAR(50),
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  confidence DECIMAL(3,2),
  
  -- Referencias a datos
  referenced_invoices UUID[] DEFAULT '{}', -- Referencias a facturas específicas
  referenced_insights UUID[] DEFAULT '{}', -- Referencias a insights
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_chat_conversations_company ON chat_conversations(company_id);
CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);

-- RLS Policies
CREATE POLICY "Users can only access company conversations" ON chat_conversations
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can only access their messages" ON chat_messages
FOR ALL USING (
  conversation_id IN (
    SELECT id FROM chat_conversations 
    WHERE company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);
```

## 5. Integration Tables

### integration_configs (Configuraciones de integración)
```sql
CREATE TABLE integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Tipo de integración
  integration_type VARCHAR(50) NOT NULL, -- 'microsoft_graph', 'openai', 'supabase_storage'
  integration_name VARCHAR(100) NOT NULL,
  
  -- Configuración
  config JSONB NOT NULL DEFAULT '{}',
  credentials JSONB NOT NULL DEFAULT '{}', -- Encriptado
  
  -- Estado
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMP,
  sync_status VARCHAR(50) DEFAULT 'not_configured', -- 'not_configured', 'active', 'error', 'disabled'
  
  -- Metadatos
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_id, integration_type)
);

-- RLS Policy
CREATE POLICY "Users can only access company integrations" ON integration_configs
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);
```

### integration_logs (Logs de integraciones)
```sql
CREATE TABLE integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_type VARCHAR(50) NOT NULL,
  
  -- Operación
  operation VARCHAR(100) NOT NULL, -- 'export_invoices', 'sync_customers', 'health_check'
  status VARCHAR(50) NOT NULL, -- 'success', 'partial', 'failed'
  
  -- Detalles
  request_data JSONB DEFAULT '{}',
  response_data JSONB DEFAULT '{}',
  error_message TEXT,
  duration_ms INTEGER,
  
  -- Metadatos
  triggered_by UUID REFERENCES auth.users(id), -- Usuario que disparó la operación
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para consultas de logs
CREATE INDEX idx_integration_logs_company ON integration_logs(company_id);
CREATE INDEX idx_integration_logs_type ON integration_logs(integration_type);
CREATE INDEX idx_integration_logs_status ON integration_logs(status);
CREATE INDEX idx_integration_logs_created ON integration_logs(created_at DESC);

-- RLS Policy
CREATE POLICY "Users can only access company integration logs" ON integration_logs
FOR ALL USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

## 6. Audit and History Tables

### audit_trail (Auditoría completa)
```sql
CREATE TABLE audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Identificación del registro afectado
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  
  -- Operación
  operation VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[], -- Campos que cambiaron
  
  -- Usuario y contexto
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  
  -- Metadatos adicionales
  business_context VARCHAR(255), -- 'invoice_processing', 'manual_edit', 'batch_import'
  reason TEXT, -- Razón del cambio si es manual
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para auditoría eficiente
CREATE INDEX idx_audit_trail_company ON audit_trail(company_id);
CREATE INDEX idx_audit_trail_table_record ON audit_trail(table_name, record_id);
CREATE INDEX idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX idx_audit_trail_created ON audit_trail(created_at DESC);

-- Partitioning por fecha para performance a largo plazo
-- (Se puede implementar cuando el volumen crezca)
```

## 7. Analytics and Reporting Tables

### financial_metrics (Métricas financieras calculadas)
```sql
CREATE TABLE financial_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Período
  period_type VARCHAR(20) NOT NULL, -- 'monthly', 'quarterly', 'yearly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Métricas calculadas
  total_revenue DECIMAL(15,2) DEFAULT 0,
  total_expenses DECIMAL(15,2) DEFAULT 0,
  total_taxes_paid DECIMAL(15,2) DEFAULT 0,
  total_retentions DECIMAL(15,2) DEFAULT 0,
  
  -- KPIs
  gross_margin DECIMAL(5,4), -- Margen bruto
  operating_margin DECIMAL(5,4), -- Margen operacional
  tax_burden DECIMAL(5,4), -- Carga tributaria
  
  -- Cash flow
  operating_cash_flow DECIMAL(15,2),
  free_cash_flow DECIMAL(15,2),
  
  -- Métricas por proveedor top
  top_suppliers JSONB DEFAULT '[]',
  top_expense_categories JSONB DEFAULT '[]',
  
  -- Metadatos de cálculo
  calculation_date TIMESTAMP DEFAULT NOW(),
  data_completeness DECIMAL(3,2), -- % de completitud de datos
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(company_id, period_type, period_start, period_end)
);

-- Índices
CREATE INDEX idx_financial_metrics_company ON financial_metrics(company_id);
CREATE INDEX idx_financial_metrics_period ON financial_metrics(period_type, period_start, period_end);
```

## 8. Funciones y Triggers Auxiliares

### Función para actualizar métricas financieras
```sql
CREATE OR REPLACE FUNCTION update_financial_metrics(
  p_company_id UUID,
  p_period_start DATE,
  p_period_end DATE
) RETURNS VOID AS $$
DECLARE
  v_total_revenue DECIMAL(15,2);
  v_total_expenses DECIMAL(15,2);
  v_total_taxes DECIMAL(15,2);
BEGIN
  -- Calcular ingresos totales
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_revenue
  FROM invoices
  WHERE company_id = p_company_id
    AND issue_date BETWEEN p_period_start AND p_period_end
    AND puc_code LIKE '4%'; -- Cuentas de ingreso
  
  -- Calcular gastos totales
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_expenses
  FROM invoices
  WHERE company_id = p_company_id
    AND issue_date BETWEEN p_period_start AND p_period_end
    AND puc_code LIKE '5%' OR puc_code LIKE '6%'; -- Cuentas de gasto
  
  -- Calcular impuestos pagados
  SELECT COALESCE(SUM(tax_amount), 0)
  INTO v_total_taxes
  FROM invoice_taxes it
  JOIN invoices i ON it.invoice_id = i.id
  WHERE i.company_id = p_company_id
    AND i.issue_date BETWEEN p_period_start AND p_period_end;
  
  -- Insertar o actualizar métricas
  INSERT INTO financial_metrics (
    company_id, period_type, period_start, period_end,
    total_revenue, total_expenses, total_taxes_paid,
    gross_margin, calculation_date
  ) VALUES (
    p_company_id, 'monthly', p_period_start, p_period_end,
    v_total_revenue, v_total_expenses, v_total_taxes,
    CASE WHEN v_total_revenue > 0 THEN (v_total_revenue - v_total_expenses) / v_total_revenue ELSE 0 END,
    NOW()
  )
  ON CONFLICT (company_id, period_type, period_start, period_end)
  DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    total_expenses = EXCLUDED.total_expenses,
    total_taxes_paid = EXCLUDED.total_taxes_paid,
    gross_margin = EXCLUDED.gross_margin,
    calculation_date = NOW();
END;
$$ LANGUAGE plpgsql;
```

### Trigger para auditoría automática
```sql
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  company_id_val UUID;
BEGIN
  -- Extraer company_id del registro (asumiendo que todas las tablas lo tienen)
  IF TG_OP = 'DELETE' THEN
    company_id_val := OLD.company_id;
  ELSE
    company_id_val := NEW.company_id;
  END IF;
  
  INSERT INTO audit_trail (
    company_id, table_name, record_id, operation,
    old_values, new_values, user_id, created_at
  ) VALUES (
    company_id_val, TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    auth.uid(),
    NOW()
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar trigger a tablas críticas
CREATE TRIGGER audit_invoices_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_invoice_taxes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoice_taxes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

## 9. Views para Reportes Comunes

### Vista consolidada de facturas con impuestos
```sql
CREATE VIEW invoice_summary AS
SELECT 
  i.id,
  i.company_id,
  i.invoice_number,
  i.issue_date,
  i.supplier_name,
  i.supplier_tax_id,
  i.subtotal,
  i.total_amount,
  i.puc_code,
  pa.name as puc_name,
  i.status,
  
  -- Agregaciones de impuestos
  COALESCE(SUM(CASE WHEN it.tax_type = 'IVA' THEN it.tax_amount END), 0) as iva_amount,
  COALESCE(SUM(CASE WHEN it.tax_type = 'RETENCION_FUENTE' THEN it.tax_amount END), 0) as retencion_amount,
  COALESCE(SUM(CASE WHEN it.tax_type = 'ICA' THEN it.tax_amount END), 0) as ica_amount,
  
  -- Metadatos
  i.created_at,
  i.updated_at
FROM invoices i
LEFT JOIN puc_accounts pa ON i.puc_code = pa.code
LEFT JOIN invoice_taxes it ON i.id = it.invoice_id
GROUP BY i.id, pa.name;
```

### Vista de métricas por empresa
```sql
CREATE VIEW company_metrics AS
SELECT 
  c.id as company_id,
  c.name as company_name,
  c.sector,
  
  -- Métricas del mes actual
  COUNT(CASE WHEN i.issue_date >= date_trunc('month', CURRENT_DATE) THEN 1 END) as invoices_this_month,
  COALESCE(SUM(CASE WHEN i.issue_date >= date_trunc('month', CURRENT_DATE) THEN i.total_amount END), 0) as revenue_this_month,
  
  -- Métricas del año actual
  COUNT(CASE WHEN i.issue_date >= date_trunc('year', CURRENT_DATE) THEN 1 END) as invoices_this_year,
  COALESCE(SUM(CASE WHEN i.issue_date >= date_trunc('year', CURRENT_DATE) THEN i.total_amount END), 0) as revenue_this_year,
  
  -- Estado de procesamiento
  COUNT(CASE WHEN i.status = 'pending' THEN 1 END) as pending_invoices,
  COUNT(CASE WHEN i.manual_review_required THEN 1 END) as review_required,
  
  -- Última actividad
  MAX(i.created_at) as last_invoice_date
FROM companies c
LEFT JOIN invoices i ON c.id = i.company_id AND i.deleted_at IS NULL
GROUP BY c.id, c.name, c.sector;
```

## 10. Migrations y Seeders

### Migration inicial
```sql
-- 001_initial_schema.sql
-- Este archivo contendría toda la estructura base
-- Ejecutar en orden: companies -> user_companies -> puc_accounts -> tax_rules -> invoices -> etc.

-- Seed data para PUC accounts Colombia (Decreto 2650)
INSERT INTO puc_accounts (code, name, level, account_type, nature) VALUES
-- Activos
('1', 'ACTIVO', 1, 'asset', 'debit'),
('11', 'DISPONIBLE', 2, 'asset', 'debit'),
('1105', 'CAJA', 3, 'asset', 'debit'),
('1110', 'BANCOS', 3, 'asset', 'debit'),
('13', 'DEUDORES', 2, 'asset', 'debit'),
('1305', 'CLIENTES', 3, 'asset', 'debit'),
-- Ingresos
('4', 'INGRESOS', 1, 'income', 'credit'),
('41', 'INGRESOS OPERACIONALES', 2, 'income', 'credit'),
('4135', 'COMERCIO AL POR MAYOR Y AL POR MENOR', 3, 'income', 'credit'),
('4175', 'ACTIVIDADES INMOBILIARIAS', 3, 'income', 'credit'),
('42', 'INGRESOS NO OPERACIONALES', 2, 'income', 'credit'),
-- Gastos
('5', 'GASTOS', 1, 'expense', 'debit'),
('51', 'GASTOS OPERACIONALES DE ADMINISTRACION', 2, 'expense', 'debit'),
('5105', 'GASTOS DE PERSONAL', 3, 'expense', 'debit'),
('52', 'GASTOS OPERACIONALES DE VENTAS', 2, 'expense', 'debit'),
('53', 'GASTOS NO OPERACIONALES', 2, 'expense', 'debit');

-- Seed data para tax rules Colombia 2025
INSERT INTO tax_rules (country, rule_type, calculation_method, tax_rate, conditions, effective_from, description, legal_reference) VALUES
-- IVA Colombia
('CO', 'IVA', 'percentage', 0.1900, '{"general": true}', '2025-01-01', 'IVA General 19%', 'Ley 1819 de 2016'),
('CO', 'IVA', 'percentage', 0.0500, '{"puc_codes": ["1511", "1512"], "basic_products": true}', '2025-01-01', 'IVA Reducido 5%', 'Art. 468-1 ET'),
('CO', 'IVA', 'percentage', 0.0000, '{"exempt_products": true, "puc_codes": ["1100", "1200"]}', '2025-01-01', 'IVA Exento 0%', 'Art. 476 ET'),
-- Retención en la Fuente
('CO', 'RETENCION_FUENTE', 'percentage', 0.1100, '{"services": true, "amount_min": 4000000}', '2025-01-01', 'Retención servicios 11%', 'Art. 392 ET'),
('CO', 'RETENCION_FUENTE', 'percentage', 0.0250, '{"goods": true, "amount_min": 1000000}', '2025-01-01', 'Retención compras 2.5%', 'Art. 392 ET'),
-- ICA principales ciudades
('CO', 'ICA', 'percentage', 0.00414, '{"municipality": "Bogotá", "commerce": true}', '2025-01-01', 'ICA Bogotá Comercio 4.14x1000', 'Acuerdo 780 de 2020'),
('CO', 'ICA', 'percentage', 0.00966, '{"municipality": "Bogotá", "services": true}', '2025-01-01', 'ICA Bogotá Servicios 9.66x1000', 'Acuerdo 780 de 2020'),
('CO', 'ICA', 'percentage', 0.00700, '{"municipality": "Medellín"}', '2025-01-01', 'ICA Medellín 7x1000', 'Acuerdo Municipal');
```

Este esquema de base de datos proporciona una base sólida y escalable para la plataforma CFO SaaS, con todas las características necesarias para multi-tenancy, auditoría completa, y performance optimizado para grandes volúmenes de datos financieros.