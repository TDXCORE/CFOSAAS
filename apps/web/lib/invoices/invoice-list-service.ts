/**
 * Invoice List Service
 * Service for fetching, filtering, and managing invoices
 */

import { getSupabaseClient } from '../supabase/client-singleton';
import type { Invoice } from './types';

export interface InvoiceFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  supplier?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class InvoiceListService {
  private supabase = getSupabaseClient();

  /**
   * Get paginated list of invoices with filters
   */
  async getInvoicesList(
    companyId: string,
    page: number = 1,
    limit: number = 20,
    filters: InvoiceFilters = {}
  ): Promise<InvoiceListResponse> {
    try {
      let query = this.supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          issue_date,
          supplier_name,
          supplier_tax_id,
          subtotal,
          total_tax,
          total_retention,
          total_amount,
          status,
          processing_status,
          puc_code,
          puc_name,
          manual_review_required,
          source_file_type,
          created_at,
          updated_at
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null);

      // Apply filters
      if (filters.search) {
        query = query.or(`invoice_number.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%`);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.dateFrom) {
        query = query.gte('issue_date', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('issue_date', filters.dateTo);
      }

      if (filters.supplier) {
        query = query.ilike('supplier_name', `%${filters.supplier}%`);
      }

      if (filters.minAmount !== undefined) {
        query = query.gte('total_amount', filters.minAmount);
      }

      if (filters.maxAmount !== undefined) {
        query = query.lte('total_amount', filters.maxAmount);
      }

      // Get total count for pagination
      const { count } = await query.select('*', { count: 'exact', head: true });
      const total = count || 0;

      // Get paginated results
      const offset = (page - 1) * limit;
      console.log('📄 Pagination query:', {
        page,
        limit,
        offset,
        total,
        rangeStart: offset,
        rangeEnd: offset + limit - 1
      });

      const { data: invoices, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching invoices:', error);
        throw new Error('Failed to fetch invoices');
      }

      const totalPages = Math.ceil(total / limit);

      return {
        invoices: invoices || [],
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      console.error('Error in getInvoicesList:', error);
      throw error;
    }
  }

  /**
   * Get single invoice with full details including line items and taxes
   */
  async getInvoiceDetails(invoiceId: string, companyId: string): Promise<Invoice | null> {
    try {
      const { data: invoice, error } = await this.supabase
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
        console.error('Error fetching invoice details:', error);
        return null;
      }

      return invoice;
    } catch (error) {
      console.error('Error in getInvoiceDetails:', error);
      return null;
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(
    invoiceId: string,
    companyId: string,
    status: string,
    processingStatus?: string
  ): Promise<boolean> {
    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (processingStatus) {
        updates.processing_status = processingStatus;
      }

      const { error } = await this.supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId)
        .eq('company_id', companyId);

      if (error) {
        console.error('Error updating invoice status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateInvoiceStatus:', error);
      return false;
    }
  }

  /**
   * Delete invoice (soft delete)
   */
  async deleteInvoice(invoiceId: string, companyId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('invoices')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('company_id', companyId);

      if (error) {
        console.error('Error deleting invoice:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteInvoice:', error);
      return false;
    }
  }

  /**
   * Get invoice statistics for the current company
   */
  async getInvoiceStats(companyId: string): Promise<{
    total: number;
    pending: number;
    validated: number;
    errors: number;
    totalAmount: number;
  }> {
    try {
      const { data: stats, error } = await this.supabase
        .from('invoices')
        .select('status, total_amount')
        .eq('company_id', companyId)
        .is('deleted_at', null);

      if (error) {
        console.error('Error fetching invoice stats:', error);
        return {
          total: 0,
          pending: 0,
          validated: 0,
          errors: 0,
          totalAmount: 0,
        };
      }

      const total = stats?.length || 0;
      const pending = stats?.filter(s => s.status === 'pending').length || 0;
      const validated = stats?.filter(s => s.status === 'validated').length || 0;
      const errors = stats?.filter(s => s.status === 'error').length || 0;
      const totalAmount = stats?.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0) || 0;

      return {
        total,
        pending,
        validated,
        errors,
        totalAmount,
      };
    } catch (error) {
      console.error('Error in getInvoiceStats:', error);
      return {
        total: 0,
        pending: 0,
        validated: 0,
        errors: 0,
        totalAmount: 0,
      };
    }
  }

  /**
   * Update invoice PUC code
   */
  async updateInvoicePUC(
    invoiceId: string,
    companyId: string,
    pucCode: string,
    pucName: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('invoices')
        .update({
          puc_code: pucCode,
          puc_name: pucName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('company_id', companyId);

      if (error) {
        console.error('Error updating invoice PUC:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateInvoicePUC:', error);
      return false;
    }
  }

  /**
   * Get retention details for an invoice
   */
  async getInvoiceRetentionDetails(invoiceId: string, companyId: string): Promise<{
    retefuente: number;
    reteica: number;
    reteiva: number;
    details: Array<{
      tax_type: string;
      concept_code: string;
      concept_description: string;
      tax_amount: number;
      tax_rate: number;
      municipality?: string;
    }>;
  }> {
    try {
      const { data: retentions, error } = await this.supabase
        .from('invoice_taxes')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('company_id', companyId)
        .in('tax_type', ['RETENCION_FUENTE', 'RETENCION_ICA', 'RETENCION_IVA']);

      if (error) {
        console.error('Error fetching retention details:', error);
        return { retefuente: 0, reteica: 0, reteiva: 0, details: [] };
      }

      let retefuente = 0;
      let reteica = 0;
      let reteiva = 0;

      const details = (retentions || []).map(retention => {
        const amount = parseFloat(retention.tax_amount) || 0;

        switch (retention.tax_type) {
          case 'RETENCION_FUENTE':
            retefuente += amount;
            break;
          case 'RETENCION_ICA':
            reteica += amount;
            break;
          case 'RETENCION_IVA':
            reteiva += amount;
            break;
        }

        return {
          tax_type: retention.tax_type,
          concept_code: retention.concept_code || '',
          concept_description: retention.concept_description || retention.tax_category || '',
          tax_amount: amount,
          tax_rate: parseFloat(retention.tax_rate) || 0,
          municipality: retention.municipality
        };
      });

      return { retefuente, reteica, reteiva, details };
    } catch (error) {
      console.error('Error in getInvoiceRetentionDetails:', error);
      return { retefuente: 0, reteica: 0, reteiva: 0, details: [] };
    }
  }

  /**
   * Get suppliers list from invoices
   */
  async getSuppliersList(companyId: string): Promise<Array<{
    name: string;
    taxId: string;
    invoiceCount: number;
    totalAmount: number;
  }>> {
    try {
      const { data: invoices, error } = await this.supabase
        .from('invoices')
        .select('supplier_name, supplier_tax_id, total_amount')
        .eq('company_id', companyId)
        .is('deleted_at', null);

      if (error) {
        console.error('Error fetching suppliers:', error);
        return [];
      }

      // Group by supplier
      const suppliersMap = new Map();
      invoices?.forEach(invoice => {
        const key = invoice.supplier_tax_id || invoice.supplier_name;
        if (!suppliersMap.has(key)) {
          suppliersMap.set(key, {
            name: invoice.supplier_name,
            taxId: invoice.supplier_tax_id,
            invoiceCount: 0,
            totalAmount: 0,
          });
        }
        const supplier = suppliersMap.get(key);
        supplier.invoiceCount++;
        supplier.totalAmount += parseFloat(invoice.total_amount) || 0;
      });

      return Array.from(suppliersMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount);
    } catch (error) {
      console.error('Error in getSuppliersList:', error);
      return [];
    }
  }
}

export const invoiceListService = new InvoiceListService();