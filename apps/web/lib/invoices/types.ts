/**
 * Invoice Processing Types for Colombian CFO SaaS Platform
 * Types for invoice processing, XML parsing, and tax calculations
 */

export interface Invoice {
  id: string;
  company_id: string;
  
  // Document identification
  invoice_number: string;
  external_id?: string;
  document_type: 'invoice' | 'credit_note' | 'debit_note';
  
  // Dates
  issue_date: string; // ISO date
  due_date?: string;
  tax_date?: string;
  
  // Parties
  supplier_tax_id: string;
  supplier_name: string;
  supplier_email?: string;
  customer_tax_id?: string;
  customer_name?: string;
  
  // Amounts
  currency: string; // Default 'COP'
  subtotal: number;
  total_tax: number;
  total_retention: number;
  total_amount: number;
  
  // PUC classification
  puc_code?: string;
  puc_name?: string;
  account_classification_confidence?: number; // 0-1
  
  // Processing status
  status: InvoiceStatus;
  processing_status: ProcessingStatus;
  
  // Source files
  source_file_name?: string;
  source_file_type?: 'xml' | 'pdf' | 'zip_attachment';
  source_file_url?: string;
  source_email_id?: string;
  source_email_sender?: string;
  
  // Processing metadata
  processing_metadata?: ProcessingMetadata;
  validation_errors?: ValidationError[];
  manual_review_required: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  
  // Export info
  exported_to?: string;
  external_reference?: string;
  exported_at?: string;
  export_status: ExportStatus;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  
  // Related data (loaded separately)
  line_items?: InvoiceLineItem[];
  taxes?: InvoiceTax[];
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  company_id: string;
  
  // Item identification
  line_number: number;
  product_code?: string;
  product_name: string;
  product_description?: string;
  
  // Quantities and prices
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  line_total: number;
  
  // Account classification
  puc_code?: string;
  puc_name?: string;
  cost_center?: string;
  
  created_at: string;
}

export interface InvoiceTax {
  id: string;
  invoice_id: string;
  company_id: string;
  
  // Tax type
  tax_type: TaxType;
  tax_category?: string;
  
  // Calculation
  taxable_base: number;
  tax_rate: number; // As decimal (0.19 for 19%)
  tax_amount: number;
  
  // Official codes
  dian_code?: string;
  municipal_code?: string;
  
  // Calculation metadata
  calculation_method: 'automatic' | 'manual' | 'override';
  applied_rule?: string;
  confidence?: number; // 0-1
  
  created_at: string;
}

// Enums and Union Types
export type InvoiceStatus = 
  | 'pending' 
  | 'processing' 
  | 'validated' 
  | 'exported' 
  | 'error';

export type ProcessingStatus = 
  | 'uploaded' 
  | 'extracted' 
  | 'classified' 
  | 'calculated' 
  | 'validated';

export type ExportStatus = 
  | 'stored' 
  | 'pending' 
  | 'exported' 
  | 'failed';

export type TaxType = 
  | 'IVA' 
  | 'ICA' 
  | 'RETENCION_FUENTE' 
  | 'RETENCION_IVA'
  | 'RETENCION_ICA';

// File Upload Types
export interface FileUploadProgress {
  file_name: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  invoice_id?: string;
  metadata?: ProcessingMetadata;
  aiInsights?: string;
}

export interface InvoiceFileUpload {
  file: File;
  uploadProgress: FileUploadProgress;
}

// Processing and validation types
export interface ProcessingMetadata {
  // File processing
  file_size?: number;
  file_hash?: string;
  extraction_method?: 'xml_parse' | 'ocr' | 'manual';
  extraction_confidence?: number;
  
  // Classification
  classification_attempts?: number;
  classification_suggestions?: Array<{
    puc_code: string;
    confidence: number;
    reasoning: string;
  }>;
  
  // Tax calculations
  tax_calculation_logs?: Array<{
    rule_applied: string;
    calculation: any;
    result: number;
  }>;
  
  // AI processing
  ai_analysis?: {
    model_used: string;
    processing_time_ms: number;
    insights: string[];
  };
  
  // Performance metrics
  processing_time_ms?: number;
  processing_steps?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

// XML Processing Types (Colombian UBL)
export interface ColombianXMLInvoice {
  // UBL Invoice structure
  Invoice: {
    UBLVersionID: string;
    ID: string; // Invoice number
    IssueDate: string;
    DueDate?: string;
    
    // Parties
    AccountingSupplierParty: XMLParty;
    AccountingCustomerParty: XMLParty;
    
    // Monetary totals
    LegalMonetaryTotal: {
      LineExtensionAmount: XMLAmount;
      TaxExclusiveAmount: XMLAmount;
      TaxInclusiveAmount: XMLAmount;
      PayableAmount: XMLAmount;
    };
    
    // Tax totals
    TaxTotal: XMLTaxTotal[];
    
    // Invoice lines
    InvoiceLine: XMLInvoiceLine[];
  };
}

export interface XMLParty {
  Party: {
    PartyIdentification: {
      ID: {
        _text: string;
        schemeID?: string;
      };
    }[];
    PartyName?: {
      Name: string;
    };
    PartyTaxScheme?: {
      RegistrationName: string;
      CompanyID: string;
      TaxScheme: {
        ID: string;
        Name: string;
      };
    };
  };
}

export interface XMLAmount {
  _text: string;
  currencyID: string;
}

export interface XMLTaxTotal {
  TaxAmount: XMLAmount;
  TaxSubtotal: XMLTaxSubtotal[];
}

export interface XMLTaxSubtotal {
  TaxableAmount: XMLAmount;
  TaxAmount: XMLAmount;
  TaxCategory: {
    ID: string;
    Percent?: string;
    TaxScheme: {
      ID: string;
      Name: string;
    };
  };
}

export interface XMLInvoiceLine {
  ID: string;
  InvoicedQuantity: {
    _text: string;
    unitCode: string;
  };
  LineExtensionAmount: XMLAmount;
  Item: {
    Description: string[];
    SellersItemIdentification?: {
      ID: string;
    };
  };
  Price: {
    PriceAmount: XMLAmount;
  };
  TaxTotal?: XMLTaxTotal[];
}

// Form types for invoice management
export interface CreateInvoiceInput {
  invoice_number: string;
  document_type?: 'invoice' | 'credit_note' | 'debit_note';
  issue_date: string;
  due_date?: string;
  supplier_tax_id: string;
  supplier_name: string;
  supplier_email?: string;
  customer_tax_id?: string;
  customer_name?: string;
  currency?: string;
  subtotal: number;
  total_tax?: number;
  total_retention?: number;
  total_amount: number;
  puc_code?: string;
  source_file_name?: string;
  source_file_type?: 'xml' | 'pdf' | 'zip_attachment';
  line_items?: CreateInvoiceLineItemInput[];
  taxes?: CreateInvoiceTaxInput[];
}

export interface CreateInvoiceLineItemInput {
  line_number: number;
  product_code?: string;
  product_name: string;
  product_description?: string;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  discount_amount?: number;
  line_total: number;
  puc_code?: string;
  cost_center?: string;
}

export interface CreateInvoiceTaxInput {
  tax_type: TaxType;
  tax_category?: string;
  taxable_base: number;
  tax_rate: number;
  tax_amount: number;
  dian_code?: string;
  municipal_code?: string;
  calculation_method?: 'automatic' | 'manual' | 'override';
  applied_rule?: string;
  confidence?: number;
}

export interface UpdateInvoiceInput extends Partial<CreateInvoiceInput> {
  status?: InvoiceStatus;
  processing_status?: ProcessingStatus;
  manual_review_required?: boolean;
  puc_code?: string;
  account_classification_confidence?: number;
}

// API Response types
export interface InvoicesResponse {
  data: Invoice[];
  count?: number;
  error?: string;
}

export interface InvoiceResponse {
  data: Invoice | null;
  error?: string;
}

// File upload types
export interface InvoiceFileUpload {
  file: File;
  type: 'xml' | 'pdf' | 'zip';
  source?: 'manual' | 'email' | 'api';
}

export interface FileUploadProgress {
  file_name: string;
  progress: number; // 0-100
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  invoice_id?: string;
}

// Dashboard and analytics types
export interface InvoiceMetrics {
  total_invoices: number;
  pending_review: number;
  processed_today: number;
  total_amount_month: number;
  
  // Processing stats
  avg_processing_time_ms: number;
  classification_accuracy: number;
  manual_review_rate: number;
  
  // Tax breakdown
  total_iva: number;
  total_retentions: number;
  total_ica: number;
  
  // By status
  status_breakdown: Record<InvoiceStatus, number>;
  
  // Recent activity
  recent_invoices: Invoice[];
}

// Filter and search types
export interface InvoiceFilters {
  status?: InvoiceStatus[];
  processing_status?: ProcessingStatus[];
  document_type?: ('invoice' | 'credit_note' | 'debit_note')[];
  supplier_tax_id?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  puc_code?: string;
  requires_review?: boolean;
  search?: string; // Full-text search
}

export interface InvoiceSortOptions {
  field: keyof Invoice;
  direction: 'asc' | 'desc';
}

// Colombian tax calculation helpers
export interface ColombianTaxCalculationInput {
  invoice_amount: number;
  supplier_tax_id: string;
  supplier_type: 'person' | 'company';
  service_type: 'services' | 'goods' | 'construction' | 'transport' | 'rent' | 'financial';
  puc_code?: string;
  company_location?: string; // For ICA calculations
}

export interface ColombianTaxCalculationResult {
  iva: {
    applicable: boolean;
    rate: number;
    amount: number;
    rule_applied: string;
  };
  
  retencion_fuente: {
    applicable: boolean;
    rate: number;
    amount: number;
    rule_applied: string;
  };
  
  ica: {
    applicable: boolean;
    rate: number;
    amount: number;
    municipality: string;
    rule_applied: string;
  };
  
  total_taxes: number;
  total_retentions: number;
  net_amount: number;
}

// Export types
export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf' | 'json';
  filters?: InvoiceFilters;
  include_line_items?: boolean;
  include_taxes?: boolean;
  date_range?: {
    from: string;
    to: string;
  };
}

export interface ExportResult {
  success: boolean;
  file_url?: string;
  file_name?: string;
  error?: string;
}