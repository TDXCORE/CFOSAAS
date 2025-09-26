/**
 * Retention Service
 * Main service for managing Colombian tax retentions
 */

import { getSupabaseClient } from '../supabase/client-singleton';
import { retentionProcessor, type RetentionBreakdown, type RetentionDetail } from './retention-processor';
import { entityValidator, type TaxEntity } from './entity-validator';
import type { Invoice } from '../invoices/types';

export interface RetentionFilters {
  year?: number;
  month?: number;
  supplier_tax_id?: string;
  retention_type?: 'RETENCION_FUENTE' | 'RETENCION_ICA' | 'RETENCION_IVA';
  concept_code?: string;
  municipality?: string;
}

export interface RetentionSummary {
  total_retefuente: number;
  total_reteica: number;
  total_reteiva: number;
  total_retentions: number;
  by_concept: Record<string, {
    amount: number;
    base: number;
    count: number;
  }>;
  by_supplier: Array<{
    tax_id: string;
    name: string;
    total_amount: number;
    total_base: number;
    invoice_count: number;
  }>;
}

export interface DetailedInvoice extends Invoice {
  retention_breakdown?: RetentionBreakdown;
}

export class RetentionService {
  private supabase = getSupabaseClient();

  /**
   * Process retentions for a new invoice
   */
  async processInvoiceRetentions(
    invoice: Invoice,
    companyId: string,
    customerTaxId?: string
  ): Promise<DetailedInvoice> {
    try {
      // Get or create customer entity (default to company entity if not provided)
      const customer = customerTaxId
        ? await this.getOrCreateEntity(customerTaxId, 'Customer Entity')
        : await this.getCompanyEntity(companyId, '800123456-7', 'Default Customer Company');

      // Process retentions
      const retentionBreakdown = await retentionProcessor.processInvoiceRetentions(
        invoice,
        invoice.supplier_tax_id,
        customer.tax_id,
        'Bogotá' // Default municipality - should be configurable
      );

      // Save detailed retention records
      await this.saveRetentionDetails(invoice.id, companyId, retentionBreakdown);

      // Update invoice totals
      await this.updateInvoiceRetentionTotals(invoice.id, retentionBreakdown);

      return {
        ...invoice,
        retention_breakdown: retentionBreakdown,
        total_retention: retentionBreakdown.total_retentions
      };
    } catch (error) {
      console.error('Error processing invoice retentions:', error);
      throw error;
    }
  }

  /**
   * Get or create tax entity
   */
  async getOrCreateEntity(taxId: string, name?: string): Promise<TaxEntity> {
    try {
      // Check if entity exists
      const { data: existingEntity, error: selectError } = await this.supabase
        .from('tax_entities')
        .select('*')
        .eq('tax_id', taxId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors

      if (existingEntity) {
        return existingEntity;
      }

      // Validate and create new entity
      const validation = await entityValidator.validateEntity(taxId, name);

      // Use upsert to handle duplicates
      const { data: newEntity, error } = await this.supabase
        .from('tax_entities')
        .upsert({
          ...validation.entity,
          verification_confidence: validation.confidence,
          verification_status: validation.requires_manual_review ? 'manual_review' : 'verified'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return newEntity;
    } catch (error) {
      console.error('Error getting/creating entity:', error);
      throw error;
    }
  }

  /**
   * Get company entity (customer for retentions)
   */
  private async getCompanyEntity(companyId: string, fallbackTaxId?: string, fallbackName?: string): Promise<TaxEntity> {
    const { data: company } = await this.supabase
      .from('companies')
      .select('tax_id, legal_name')
      .eq('id', companyId)
      .single();

    if (!company) {
      // Use fallback data if company not found in companies table
      if (fallbackTaxId) {
        console.log(`Company ${companyId} not found, using fallback tax_id: ${fallbackTaxId}`);
        return this.getOrCreateEntity(fallbackTaxId, fallbackName || 'Unknown Company');
      }
      throw new Error('Company not found');
    }

    return this.getOrCreateEntity(company.tax_id, company.legal_name);
  }

  /**
   * Save detailed retention records to database
   */
  async saveRetentionDetails(
    invoiceId: string,
    companyId: string,
    breakdown: RetentionBreakdown
  ): Promise<boolean> {
    try {
      // Prepare all retention records
      const allRetentions = [
        ...breakdown.retefuente,
        ...breakdown.reteica,
        ...breakdown.reteiva
      ];

      // Delete existing detailed records for this invoice
      await this.supabase
        .from('invoice_taxes')
        .delete()
        .eq('invoice_id', invoiceId)
        .in('tax_type', ['RETENCION_FUENTE', 'RETENCION_ICA', 'RETENCION_IVA']);

      // Insert new detailed records
      if (allRetentions.length > 0) {
        const records = allRetentions.map(retention => ({
          invoice_id: invoiceId,
          company_id: companyId,
          tax_type: retention.tax_type,
          tax_category: retention.concept_description,
          taxable_base: retention.taxable_base,
          tax_rate: retention.tax_rate,
          tax_amount: retention.tax_amount,
          dian_code: retention.dian_code,
          municipal_code: retention.municipal_code,
          calculation_method: retention.calculation_method,
          applied_rule: retention.applied_rule,
          confidence: retention.confidence,
          concept_code: retention.concept_code,
          concept_description: retention.concept_description,
          threshold_uvt: retention.threshold_uvt,
          municipality: retention.municipality,
          supplier_type: retention.supplier_type,
          verification_status: 'automatic'
        }));

        const { error } = await this.supabase
          .from('invoice_taxes')
          .insert(records);

        if (error) {
          throw error;
        }
      }

      return true;
    } catch (error) {
      console.error('Error saving retention details:', error);
      return false;
    }
  }

  /**
   * Update invoice retention totals
   */
  private async updateInvoiceRetentionTotals(
    invoiceId: string,
    breakdown: RetentionBreakdown
  ): Promise<void> {
    await this.supabase
      .from('invoices')
      .update({
        total_retention: breakdown.total_retentions,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId);
  }

  /**
   * Get retention summary for reporting
   */
  async getRetentionSummary(
    companyId: string,
    filters: RetentionFilters = {}
  ): Promise<RetentionSummary> {
    try {
      // Use database function for efficient querying
      const { data: summaryData, error } = await this.supabase
        .rpc('get_retention_summary', {
          p_company_id: companyId,
          p_period_year: filters.year || new Date().getFullYear(),
          p_period_month: filters.month || null
        });

      if (error) {
        throw error;
      }

      // Process the data
      let totalRetefuente = 0;
      let totalReteica = 0;
      let totalReteiva = 0;
      const byConcept: Record<string, any> = {};

      summaryData?.forEach((row: any) => {
        const amount = parseFloat(row.total_amount) || 0;
        const base = parseFloat(row.total_base) || 0;
        const count = parseInt(row.invoice_count) || 0;

        // Accumulate by type
        switch (row.tax_type) {
          case 'RETENCION_FUENTE':
            totalRetefuente += amount;
            break;
          case 'RETENCION_ICA':
            totalReteica += amount;
            break;
          case 'RETENCION_IVA':
            totalReteiva += amount;
            break;
        }

        // Group by concept
        const conceptKey = `${row.tax_type}_${row.concept_code}`;
        byConcept[conceptKey] = {
          amount,
          base,
          count
        };
      });

      // Get by supplier data
      const bySupplier = await this.getRetentionsBySupplier(companyId, filters);

      return {
        total_retefuente: totalRetefuente,
        total_reteica: totalReteica,
        total_reteiva: totalReteiva,
        total_retentions: totalRetefuente + totalReteica + totalReteiva,
        by_concept: byConcept,
        by_supplier: bySupplier
      };
    } catch (error) {
      console.error('Error getting retention summary:', error);
      throw error;
    }
  }

  /**
   * Get retentions grouped by supplier
   */
  private async getRetentionsBySupplier(
    companyId: string,
    filters: RetentionFilters
  ): Promise<Array<{
    tax_id: string;
    name: string;
    total_amount: number;
    total_base: number;
    invoice_count: number;
  }>> {
    try {
      let query = this.supabase
        .from('invoices')
        .select(`
          supplier_tax_id,
          supplier_name,
          invoice_taxes!inner(tax_amount, taxable_base)
        `)
        .eq('company_id', companyId)
        .eq('invoice_taxes.tax_type', 'RETENCION_FUENTE') // Start with retefuente
        .is('deleted_at', null);

      // Apply filters
      if (filters.year) {
        query = query.gte('issue_date', `${filters.year}-01-01`)
                    .lt('issue_date', `${filters.year + 1}-01-01`);
      }

      if (filters.month && filters.year) {
        const startDate = `${filters.year}-${filters.month.toString().padStart(2, '0')}-01`;
        const endMonth = filters.month === 12 ? 1 : filters.month + 1;
        const endYear = filters.month === 12 ? filters.year + 1 : filters.year;
        const endDate = `${endYear}-${endMonth.toString().padStart(2, '0')}-01`;

        query = query.gte('issue_date', startDate).lt('issue_date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Group by supplier
      const supplierMap = new Map();
      data?.forEach((invoice: any) => {
        const key = invoice.supplier_tax_id;
        if (!supplierMap.has(key)) {
          supplierMap.set(key, {
            tax_id: invoice.supplier_tax_id,
            name: invoice.supplier_name,
            total_amount: 0,
            total_base: 0,
            invoice_count: 0
          });
        }

        const supplier = supplierMap.get(key);
        invoice.invoice_taxes.forEach((tax: any) => {
          supplier.total_amount += parseFloat(tax.tax_amount) || 0;
          supplier.total_base += parseFloat(tax.taxable_base) || 0;
        });
        supplier.invoice_count++;
      });

      return Array.from(supplierMap.values())
        .sort((a, b) => b.total_amount - a.total_amount);
    } catch (error) {
      console.error('Error getting retentions by supplier:', error);
      return [];
    }
  }

  /**
   * Validate and update entity information
   */
  async validateEntity(taxId: string): Promise<TaxEntity> {
    const validation = await entityValidator.validateEntity(taxId);

    const { data: entity, error } = await this.supabase
      .from('tax_entities')
      .upsert({
        ...validation.entity,
        verification_confidence: validation.confidence,
        verification_status: validation.requires_manual_review ? 'manual_review' : 'verified',
        last_verified_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return entity;
  }

  /**
   * Get detailed retention information for an invoice
   */
  async getInvoiceRetentionDetails(invoiceId: string): Promise<RetentionDetail[]> {
    const { data, error } = await this.supabase
      .from('invoice_taxes')
      .select('*')
      .eq('invoice_id', invoiceId)
      .in('tax_type', ['RETENCION_FUENTE', 'RETENCION_ICA', 'RETENCION_IVA']);

    if (error) {
      throw error;
    }

    return data?.map(record => ({
      tax_type: record.tax_type as 'RETENCION_FUENTE' | 'RETENCION_ICA' | 'RETENCION_IVA',
      concept_code: record.concept_code || '',
      concept_description: record.concept_description || record.tax_category || '',
      taxable_base: parseFloat(record.taxable_base) || 0,
      tax_rate: parseFloat(record.tax_rate) || 0,
      tax_amount: parseFloat(record.tax_amount) || 0,
      threshold_uvt: record.threshold_uvt,
      municipality: record.municipality,
      supplier_type: record.supplier_type || '',
      calculation_method: record.calculation_method as 'automatic' | 'manual' | 'override',
      applied_rule: record.applied_rule || '',
      confidence: parseFloat(record.confidence) || 0,
      dian_code: record.dian_code,
      municipal_code: record.municipal_code
    })) || [];
  }

  /**
   * Recalculate retentions for existing invoices
   */
  async recalculateInvoiceRetentions(
    invoiceId: string,
    companyId: string
  ): Promise<boolean> {
    try {
      // Get invoice
      const { data: invoice } = await this.supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .eq('company_id', companyId)
        .single();

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Reprocess retentions
      await this.processInvoiceRetentions(invoice, companyId);

      return true;
    } catch (error) {
      console.error('Error recalculating retentions:', error);
      return false;
    }
  }
}

export const retentionService = new RetentionService();