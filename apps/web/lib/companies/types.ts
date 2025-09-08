/**
 * Company and Multi-tenant Types for Colombian CFO SaaS Platform
 */

export interface Company {
  id: string;
  name: string;
  legal_name: string;
  tax_id: string; // NIT Colombia
  
  // Colombian tax information
  fiscal_regime?: 'simplified' | 'common' | 'special';
  economic_activity_code?: string; // CIIU Code
  economic_activity_name?: string;
  
  // Company classification
  sector?: 'manufacturing' | 'services' | 'commerce' | 'technology' | 'other';
  company_size?: 'micro' | 'small' | 'medium' | 'large';
  
  // Colombian location
  country: string;
  department?: string;
  city?: string;
  address?: any;
  
  // Settings
  settings?: CompanySettings;
  tax_settings?: TaxSettings;
  integration_settings?: IntegrationSettings;
  
  // Subscription
  subscription_plan?: string;
  subscription_status?: 'active' | 'inactive' | 'trial' | 'cancelled';
  trial_ends_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CompanySettings {
  // UI preferences
  currency?: string;
  date_format?: string;
  timezone?: string;
  
  // Business rules
  auto_classification?: boolean;
  require_manual_review?: boolean;
  default_retention_rate?: number;
  
  // Notifications
  email_notifications?: boolean;
  slack_webhook?: string;
}

export interface TaxSettings {
  // Colombian tax configuration
  iva_rate?: number; // Default 0.19 for 19%
  retention_rates?: {
    services?: number; // Default 0.11 for 11%
    goods?: number; // Default 0.025 for 2.5%
    construction?: number; // Default 0.04 for 4%
    transport?: number; // Default 0.01 for 1%
    rent?: number; // Default 0.035 for 3.5%
  };
  
  // Municipal tax (ICA)
  ica_rate?: number;
  municipality?: string;
  
  // Thresholds
  retention_thresholds?: {
    services?: number; // Default 4,000,000 COP
    goods?: number; // Default 1,000,000 COP
    construction?: number; // Default 500,000 COP
  };
}

export interface IntegrationSettings {
  // Microsoft Graph (O365/Outlook)
  microsoft_graph?: {
    enabled: boolean;
    tenant_id?: string;
    client_id?: string;
    mailbox_id?: string;
    folder_id?: string; // Specific folder to monitor
    last_sync?: string;
  };
  
  // OpenAI Configuration
  openai?: {
    enabled: boolean;
    model?: string; // Default: gpt-4-turbo
    temperature?: number; // Default: 0.1 for consistency
    max_tokens?: number;
  };
  
  // Supabase Storage
  storage?: {
    bucket_name?: string;
    max_file_size?: number;
    allowed_extensions?: string[];
  };
}

export interface UserCompany {
  id: string;
  user_id: string;
  company_id: string;
  
  // Role and permissions
  role: 'owner' | 'admin' | 'accountant' | 'auditor' | 'viewer';
  permissions?: UserPermissions;
  
  // Status
  status: 'active' | 'inactive' | 'pending';
  invited_by?: string;
  invited_at?: string;
  accepted_at?: string;
  
  created_at: string;
  updated_at: string;
}

export interface UserPermissions {
  // Invoice management
  can_view_invoices?: boolean;
  can_upload_invoices?: boolean;
  can_edit_invoices?: boolean;
  can_delete_invoices?: boolean;
  can_approve_invoices?: boolean;
  
  // AI CFO access
  can_chat_with_cfo?: boolean;
  can_view_insights?: boolean;
  can_export_data?: boolean;
  
  // Company management
  can_manage_users?: boolean;
  can_edit_company?: boolean;
  can_view_billing?: boolean;
  can_manage_integrations?: boolean;
  
  // Reporting and analytics
  can_view_reports?: boolean;
  can_export_reports?: boolean;
  can_view_audit_trail?: boolean;
}

// Colombian specific types
export interface ColombianTaxInfo {
  nit: string; // Número de Identificación Tributaria
  verification_digit: string;
  fiscal_regime: 'simplified' | 'common' | 'special';
  ciiu_code: string; // Código de actividad económica
  ciiu_description: string;
  
  // Location for tax purposes
  department: string;
  municipality: string;
  
  // Tax responsibilities
  iva_responsible: boolean;
  retention_agent: boolean;
  ica_subject: boolean;
  
  // Rates applicable to this company
  applicable_rates: {
    iva: number;
    ica: number;
    retention_services: number;
    retention_goods: number;
  };
}

// API Response types
export interface CompaniesResponse {
  data: Company[];
  count?: number;
  error?: string;
}

export interface CompanyResponse {
  data: Company | null;
  error?: string;
}

// Form types for creation/editing
export interface CreateCompanyInput {
  name: string;
  legal_name: string;
  tax_id: string;
  fiscal_regime?: string;
  economic_activity_code?: string;
  economic_activity_name?: string;
  sector?: string;
  company_size?: string;
  department?: string;
  city?: string;
  address?: any;
}

export interface UpdateCompanyInput extends Partial<CreateCompanyInput> {
  settings?: Partial<CompanySettings>;
  tax_settings?: Partial<TaxSettings>;
  integration_settings?: Partial<IntegrationSettings>;
}

// Multi-tenant context
export interface TenantContext {
  currentCompany: Company | null;
  userCompanies: UserCompany[];
  userRole: string | null;
  userPermissions: UserPermissions | null;
  isLoading: boolean;
  switchCompany: (companyId: string) => Promise<void>;
  refreshCompanies: () => Promise<void>;
}

// Colombian departments for forms
export const COLOMBIAN_DEPARTMENTS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá',
  'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba',
  'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena',
  'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca',
  'Vaupés', 'Vichada'
] as const;

// Major Colombian cities
export const COLOMBIAN_CITIES = {
  'Bogotá': 'Cundinamarca',
  'Medellín': 'Antioquia',
  'Cali': 'Valle del Cauca',
  'Barranquilla': 'Atlántico',
  'Cartagena': 'Bolívar',
  'Cúcuta': 'Norte de Santander',
  'Soledad': 'Atlántico',
  'Ibagué': 'Tolima',
  'Bucaramanga': 'Santander',
  'Soacha': 'Cundinamarca'
} as const;

// Company sectors for Colombian market
export const COMPANY_SECTORS = [
  'manufacturing',
  'services',
  'commerce',
  'technology',
  'construction',
  'transportation',
  'agriculture',
  'mining',
  'education',
  'healthcare',
  'finance',
  'real_estate',
  'hospitality',
  'other'
] as const;