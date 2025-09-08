/**
 * Invoices Service - Colombian Invoice Processing and Management
 * Handles invoice CRUD operations, file processing, and tax calculations
 */

import { getSupabaseClient } from '../supabase/client-singleton';
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceTax,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoicesResponse,
  InvoiceResponse,
  InvoiceFilters,
  InvoiceSortOptions,
  InvoiceMetrics,
  ColombianTaxCalculationInput,
  ColombianTaxCalculationResult,
} from './types';

class InvoicesService {
  private supabase = getSupabaseClient();

  /**
   * Get invoices for a company with filters and pagination
   */
  async getInvoices(
    companyId: string,
    filters?: InvoiceFilters,
    sort?: InvoiceSortOptions,
    page = 1,
    pageSize = 50
  ): Promise<InvoicesResponse> {
    try {
      let query = this.supabase
        .from('invoices')
        .select(`
          *,
          line_items:invoice_line_items(*),
          taxes:invoice_taxes(*)
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null);

      // Apply filters
      if (filters) {
        if (filters.status?.length) {
          query = query.in('status', filters.status);
        }
        if (filters.processing_status?.length) {
          query = query.in('processing_status', filters.processing_status);
        }
        if (filters.document_type?.length) {
          query = query.in('document_type', filters.document_type);
        }
        if (filters.supplier_tax_id) {
          query = query.eq('supplier_tax_id', filters.supplier_tax_id);
        }
        if (filters.date_from) {
          query = query.gte('issue_date', filters.date_from);
        }
        if (filters.date_to) {
          query = query.lte('issue_date', filters.date_to);
        }
        if (filters.amount_min !== undefined) {
          query = query.gte('total_amount', filters.amount_min);
        }
        if (filters.amount_max !== undefined) {
          query = query.lte('total_amount', filters.amount_max);
        }
        if (filters.puc_code) {
          query = query.eq('puc_code', filters.puc_code);
        }
        if (filters.requires_review !== undefined) {
          query = query.eq('manual_review_required', filters.requires_review);
        }
        if (filters.search) {
          query = query.or(`supplier_name.ilike.%${filters.search}%,invoice_number.ilike.%${filters.search}%`);
        }
      }

      // Apply sorting
      if (sort) {
        query = query.order(sort.field, { ascending: sort.direction === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        return { data: [], error: error.message };
      }

      return { 
        data: (data || []) as Invoice[], 
        count: count || 0 
      };
    } catch (error) {
      console.error('Error in getInvoices:', error);
      return { data: [], error: 'Failed to fetch invoices' };
    }
  }

  /**
   * Get a specific invoice by ID
   */
  async getInvoiceById(invoiceId: string, companyId: string): Promise<InvoiceResponse> {
    try {
      const { data, error } = await this.supabase
        .from('invoices')
        .select(`
          *,
          line_items:invoice_line_items(*),
          taxes:invoice_taxes(*)
        `)
        .eq('id', invoiceId)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Invoice };
    } catch (error) {
      console.error('Error in getInvoiceById:', error);
      return { data: null, error: 'Failed to fetch invoice' };
    }
  }

  /**
   * Create a new invoice
   */
  async createInvoice(input: CreateInvoiceInput, companyId: string): Promise<InvoiceResponse> {
    try {
      // Validate invoice number uniqueness within company
      const { data: existing } = await this.supabase
        .from('invoices')
        .select('id')
        .eq('company_id', companyId)
        .eq('invoice_number', input.invoice_number)
        .is('deleted_at', null)
        .single();

      if (existing) {
        return { 
          data: null, 
          error: 'Invoice number already exists in this company' 
        };
      }

      // Prepare invoice data
      const invoiceData = {
        company_id: companyId,
        invoice_number: input.invoice_number,
        document_type: input.document_type || 'invoice',
        issue_date: input.issue_date,
        due_date: input.due_date,
        supplier_tax_id: input.supplier_tax_id,
        supplier_name: input.supplier_name,
        supplier_email: input.supplier_email,
        customer_tax_id: input.customer_tax_id,
        customer_name: input.customer_name,
        currency: input.currency || 'COP',
        subtotal: input.subtotal,
        total_tax: input.total_tax || 0,
        total_retention: input.total_retention || 0,
        total_amount: input.total_amount,
        puc_code: input.puc_code,
        source_file_name: input.source_file_name,
        source_file_type: input.source_file_type,
        status: 'pending',
        processing_status: 'uploaded',
        export_status: 'stored',
        manual_review_required: false,
      };

      // Create invoice
      const { data: invoice, error: invoiceError } = await this.supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) {
        return { data: null, error: invoiceError.message };
      }

      // Create line items if provided
      if (input.line_items?.length) {
        const lineItemsData = input.line_items.map(item => ({
          ...item,
          invoice_id: invoice.id,
          company_id: companyId,
        }));

        const { error: lineItemsError } = await this.supabase
          .from('invoice_line_items')
          .insert(lineItemsData);

        if (lineItemsError) {
          console.error('Error creating line items:', lineItemsError);
          // Continue without failing the entire operation
        }
      }

      // Create taxes if provided
      if (input.taxes?.length) {
        const taxesData = input.taxes.map(tax => ({
          ...tax,
          invoice_id: invoice.id,
          company_id: companyId,
        }));

        const { error: taxesError } = await this.supabase
          .from('invoice_taxes')
          .insert(taxesData);

        if (taxesError) {
          console.error('Error creating taxes:', taxesError);
          // Continue without failing the entire operation
        }
      }

      // Fetch the complete invoice with relations
      return this.getInvoiceById(invoice.id, companyId);
    } catch (error) {
      console.error('Error in createInvoice:', error);
      return { data: null, error: 'Failed to create invoice' };
    }
  }

  /**
   * Update an existing invoice
   */
  async updateInvoice(
    invoiceId: string, 
    input: UpdateInvoiceInput, 
    companyId: string
  ): Promise<InvoiceResponse> {
    try {
      const { data, error } = await this.supabase
        .from('invoices')
        .update(input)
        .eq('id', invoiceId)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Invoice };
    } catch (error) {
      console.error('Error in updateInvoice:', error);
      return { data: null, error: 'Failed to update invoice' };
    }
  }

  /**
   * Soft delete an invoice
   */
  async deleteInvoice(invoiceId: string, companyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('invoices')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .eq('company_id', companyId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in deleteInvoice:', error);
      return { success: false, error: 'Failed to delete invoice' };
    }
  }

  /**
   * Get invoice metrics and analytics for a company
   */
  async getInvoiceMetrics(companyId: string, dateFrom?: string, dateTo?: string): Promise<{
    data: InvoiceMetrics | null;
    error?: string;
  }> {
    try {
      // Build date filters
      let dateFilter = '';
      if (dateFrom && dateTo) {
        dateFilter = `AND issue_date BETWEEN '${dateFrom}' AND '${dateTo}'`;
      } else if (dateFrom) {
        dateFilter = `AND issue_date >= '${dateFrom}'`;
      } else if (dateTo) {
        dateFilter = `AND issue_date <= '${dateTo}'`;
      }

      // Get basic metrics
      const { data: basicMetrics } = await this.supabase
        .rpc('get_invoice_metrics', {
          p_company_id: companyId,
          p_date_from: dateFrom || null,
          p_date_to: dateTo || null,
        });

      // Get recent invoices
      const { data: recentInvoices } = await this.supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      const metrics: InvoiceMetrics = {
        total_invoices: basicMetrics?.total_invoices || 0,
        pending_review: basicMetrics?.pending_review || 0,
        processed_today: basicMetrics?.processed_today || 0,
        total_amount_month: basicMetrics?.total_amount_month || 0,
        avg_processing_time_ms: basicMetrics?.avg_processing_time || 0,
        classification_accuracy: basicMetrics?.classification_accuracy || 0,
        manual_review_rate: basicMetrics?.manual_review_rate || 0,
        total_iva: basicMetrics?.total_iva || 0,
        total_retentions: basicMetrics?.total_retentions || 0,
        total_ica: basicMetrics?.total_ica || 0,
        status_breakdown: basicMetrics?.status_breakdown || {},
        recent_invoices: (recentInvoices || []) as Invoice[],
      };

      return { data: metrics };
    } catch (error) {
      console.error('Error in getInvoiceMetrics:', error);
      return { data: null, error: 'Failed to get invoice metrics' };
    }
  }

  /**
   * Calculate Colombian taxes for an invoice
   */
  async calculateColombianTaxes(input: ColombianTaxCalculationInput): Promise<{
    data: ColombianTaxCalculationResult | null;
    error?: string;
  }> {
    try {
      // This would integrate with the Colombian tax rules from the database
      // For now, implementing basic calculations
      
      const result: ColombianTaxCalculationResult = {
        iva: {
          applicable: true,
          rate: 0.19, // 19% default
          amount: input.invoice_amount * 0.19,
          rule_applied: 'general_iva_19',
        },
        retencion_fuente: {
          applicable: false,
          rate: 0,
          amount: 0,
          rule_applied: 'none',
        },
        ica: {
          applicable: false,
          rate: 0,
          amount: 0,
          municipality: '',
          rule_applied: 'none',
        },
        total_taxes: input.invoice_amount * 0.19,
        total_retentions: 0,
        net_amount: input.invoice_amount + (input.invoice_amount * 0.19),
      };

      // Apply retention rules based on service type and amount
      if (input.supplier_type === 'company') {
        switch (input.service_type) {
          case 'services':
            if (input.invoice_amount >= 4000000) { // 4M COP threshold
              result.retencion_fuente = {
                applicable: true,
                rate: 0.11,
                amount: input.invoice_amount * 0.11,
                rule_applied: 'services_11_percent',
              };
            }
            break;
          
          case 'goods':
            if (input.invoice_amount >= 1000000) { // 1M COP threshold
              result.retencion_fuente = {
                applicable: true,
                rate: 0.025,
                amount: input.invoice_amount * 0.025,
                rule_applied: 'goods_2_5_percent',
              };
            }
            break;
          
          case 'construction':
            if (input.invoice_amount >= 500000) { // 500K COP threshold
              result.retencion_fuente = {
                applicable: true,
                rate: 0.04,
                amount: input.invoice_amount * 0.04,
                rule_applied: 'construction_4_percent',
              };
            }
            break;
          
          case 'rent':
            if (input.invoice_amount >= 1000000) { // 1M COP threshold
              result.retencion_fuente = {
                applicable: true,
                rate: 0.035,
                amount: input.invoice_amount * 0.035,
                rule_applied: 'rent_3_5_percent',
              };
            }
            break;
        }
      }

      // Apply ICA based on location
      if (input.company_location) {
        const icaRates: Record<string, number> = {
          'Bogotá': 0.00414,
          'Medellín': 0.007,
          'Cali': 0.00414,
          'Barranquilla': 0.007,
          'Cartagena': 0.008,
        };

        const rate = icaRates[input.company_location];
        if (rate) {
          result.ica = {
            applicable: true,
            rate,
            amount: input.invoice_amount * rate,
            municipality: input.company_location,
            rule_applied: `ica_${input.company_location.toLowerCase()}`,
          };
        }
      }

      // Recalculate totals
      result.total_taxes = result.iva.amount + result.ica.amount;
      result.total_retentions = result.retencion_fuente.amount;
      result.net_amount = input.invoice_amount + result.total_taxes - result.total_retentions;

      return { data: result };
    } catch (error) {
      console.error('Error in calculateColombianTaxes:', error);
      return { data: null, error: 'Failed to calculate taxes' };
    }
  }

  /**
   * Process invoice for automatic PUC classification
   */
  async classifyInvoicePUC(
    invoiceId: string, 
    companyId: string
  ): Promise<{ success: boolean; puc_code?: string; confidence?: number; error?: string }> {
    try {
      // Get invoice details
      const { data: invoice, error: fetchError } = await this.getInvoiceById(invoiceId, companyId);
      
      if (fetchError || !invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      // Get classification rules from database
      const { data: rules } = await this.supabase
        .from('classification_rules')
        .select('*')
        .or(`company_id.is.null,company_id.eq.${companyId}`)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (!rules?.length) {
        return { 
          success: false, 
          error: 'No classification rules available' 
        };
      }

      // Find best matching rule
      let bestMatch = null;
      let bestScore = 0;

      for (const rule of rules) {
        const score = this.calculateClassificationScore(invoice, rule.conditions);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = rule;
        }
      }

      if (!bestMatch || bestScore < 0.5) {
        return { 
          success: false, 
          error: 'No suitable classification found' 
        };
      }

      // Update invoice with classification
      const { error: updateError } = await this.updateInvoice(
        invoiceId,
        {
          puc_code: bestMatch.puc_code,
          account_classification_confidence: bestScore,
          processing_status: 'classified',
        },
        companyId
      );

      if (updateError) {
        return { success: false, error: updateError };
      }

      return {
        success: true,
        puc_code: bestMatch.puc_code,
        confidence: bestScore,
      };
    } catch (error) {
      console.error('Error in classifyInvoicePUC:', error);
      return { success: false, error: 'Failed to classify invoice' };
    }
  }

  /**
   * Mark invoice for manual review
   */
  async markForReview(
    invoiceId: string,
    companyId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.updateInvoice(
        invoiceId,
        {
          manual_review_required: true,
          status: 'pending',
          processing_metadata: {
            review_reason: reason,
            marked_for_review_at: new Date().toISOString(),
          },
        },
        companyId
      );

      if (error) {
        return { success: false, error };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in markForReview:', error);
      return { success: false, error: 'Failed to mark for review' };
    }
  }

  // Helper methods
  private calculateClassificationScore(invoice: Invoice, conditions: any): number {
    let score = 0;
    let totalChecks = 0;

    try {
      // Check supplier name patterns
      if (conditions.supplier_name_contains?.length) {
        totalChecks++;
        const supplierName = invoice.supplier_name.toLowerCase();
        const matches = conditions.supplier_name_contains.some((pattern: string) =>
          supplierName.includes(pattern.toLowerCase())
        );
        if (matches) score += 0.3;
      }

      // Check description keywords
      if (conditions.description_keywords?.length) {
        totalChecks++;
        // This would check against line items or invoice description
        // For now, simplified implementation
        score += 0.2;
      }

      // Check amount range
      if (conditions.amount_range) {
        totalChecks++;
        const amount = invoice.total_amount;
        const { min, max } = conditions.amount_range;
        
        if ((!min || amount >= min) && (!max || amount <= max)) {
          score += 0.3;
        }
      }

      // Check PUC codes (if already partially classified)
      if (conditions.puc_codes?.length && invoice.puc_code) {
        totalChecks++;
        if (conditions.puc_codes.includes(invoice.puc_code)) {
          score += 0.2;
        }
      }

      return totalChecks > 0 ? score / totalChecks : 0;
    } catch (error) {
      console.error('Error calculating classification score:', error);
      return 0;
    }
  }
}

export const invoicesService = new InvoicesService();