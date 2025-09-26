/**
 * Retention Reports Service
 * Generates Colombian retention reports and certificates
 */

import { getSupabaseClient } from '../supabase/client-singleton';
import type { Invoice } from '../invoices/types';

interface RetentionSummary {
  supplier_tax_id: string;
  supplier_name: string;
  total_retefuente: number;
  total_reteiva: number;
  total_reteica: number;
  total_retentions: number;
  invoice_count: number;
  period: string;
}

interface RetentionCertificate {
  supplier_tax_id: string;
  supplier_name: string;
  period: string;
  retentions: Array<{
    concept_code: string;
    concept_description: string;
    tax_amount: number;
    taxable_base: number;
    tax_rate: number;
  }>;
  total_retained: number;
  issued_date: string;
}

export class RetentionReportsService {
  private supabase = getSupabaseClient();

  /**
   * Generate retention summary by supplier for a period
   */
  async generateRetentionSummary(
    companyId: string,
    startDate: string,
    endDate: string
  ): Promise<RetentionSummary[]> {
    try {
      const { data: taxes, error } = await this.supabase
        .from('invoice_taxes')
        .select(`
          tax_type,
          tax_amount,
          taxable_base,
          concept_code,
          concept_description,
          invoices!inner(
            supplier_tax_id,
            supplier_name,
            issue_date
          )
        `)
        .eq('company_id', companyId)
        .gte('invoices.issue_date', startDate)
        .lte('invoices.issue_date', endDate)
        .in('tax_type', ['retefuente', 'reteiva', 'reteica']);

      if (error) {
        throw error;
      }

      // Group by supplier
      const supplierMap = new Map<string, RetentionSummary>();

      taxes?.forEach((tax: any) => {
        const invoice = tax.invoices;
        const key = invoice.supplier_tax_id;

        if (!supplierMap.has(key)) {
          supplierMap.set(key, {
            supplier_tax_id: invoice.supplier_tax_id,
            supplier_name: invoice.supplier_name,
            total_retefuente: 0,
            total_reteiva: 0,
            total_reteica: 0,
            total_retentions: 0,
            invoice_count: 0,
            period: `${startDate} - ${endDate}`
          });
        }

        const summary = supplierMap.get(key)!;
        const amount = tax.tax_amount || 0;

        switch (tax.tax_type?.toLowerCase()) {
          case 'retefuente':
            summary.total_retefuente += amount;
            break;
          case 'reteiva':
            summary.total_reteiva += amount;
            break;
          case 'reteica':
            summary.total_reteica += amount;
            break;
        }

        summary.total_retentions += amount;
      });

      return Array.from(supplierMap.values())
        .sort((a, b) => b.total_retentions - a.total_retentions);

    } catch (error) {
      console.error('Error generating retention summary:', error);
      throw new Error('Failed to generate retention summary');
    }
  }

  /**
   * Generate retention certificate for a specific supplier
   */
  async generateRetentionCertificate(
    companyId: string,
    supplierTaxId: string,
    period: string
  ): Promise<RetentionCertificate | null> {
    try {
      const [startDate, endDate] = period.split(' - ');

      const { data: taxes, error } = await this.supabase
        .from('invoice_taxes')
        .select(`
          tax_type,
          tax_amount,
          taxable_base,
          tax_rate,
          concept_code,
          concept_description,
          invoices!inner(
            supplier_tax_id,
            supplier_name
          )
        `)
        .eq('company_id', companyId)
        .eq('invoices.supplier_tax_id', supplierTaxId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .in('tax_type', ['retefuente', 'reteiva', 'reteica']);

      if (error) {
        throw error;
      }

      if (!taxes || taxes.length === 0) {
        return null;
      }

      const supplierName = taxes[0].invoices.supplier_name;
      const retentions = taxes.map((tax: any) => ({
        concept_code: tax.concept_code || 'N/A',
        concept_description: tax.concept_description || tax.tax_type,
        tax_amount: tax.tax_amount || 0,
        taxable_base: tax.taxable_base || 0,
        tax_rate: tax.tax_rate || 0
      }));

      const totalRetained = retentions.reduce((sum, ret) => sum + ret.tax_amount, 0);

      return {
        supplier_tax_id: supplierTaxId,
        supplier_name: supplierName,
        period,
        retentions,
        total_retained: totalRetained,
        issued_date: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error generating retention certificate:', error);
      throw new Error('Failed to generate retention certificate');
    }
  }

  /**
   * Export retention summary to CSV format
   */
  exportToCSV(retentions: RetentionSummary[]): string {
    const headers = [
      'NIT/Cédula',
      'Proveedor',
      'RETEFUENTE',
      'RETEIVA',
      'RETEICA',
      'Total Retenciones',
      'Facturas',
      'Período'
    ];

    const rows = retentions.map(ret => [
      ret.supplier_tax_id,
      ret.supplier_name,
      ret.total_retefuente.toFixed(2),
      ret.total_reteiva.toFixed(2),
      ret.total_reteica.toFixed(2),
      ret.total_retentions.toFixed(2),
      ret.invoice_count.toString(),
      ret.period
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Generate Form 350 DIAN data structure (basic implementation)
   */
  async generateForm350Data(
    companyId: string,
    taxYear: number
  ): Promise<any> {
    // Basic structure for Form 350 - would need full DIAN specifications
    const startDate = `${taxYear}-01-01`;
    const endDate = `${taxYear}-12-31`;

    const summary = await this.generateRetentionSummary(companyId, startDate, endDate);

    return {
      tax_year: taxYear,
      company_id: companyId,
      total_retefuente: summary.reduce((sum, s) => sum + s.total_retefuente, 0),
      total_reteiva: summary.reduce((sum, s) => sum + s.total_reteiva, 0),
      total_reteica: summary.reduce((sum, s) => sum + s.total_reteica, 0),
      suppliers_count: summary.length,
      generated_at: new Date().toISOString(),
      // Additional Form 350 fields would be added here
      note: 'Basic Form 350 structure - requires full DIAN compliance implementation'
    };
  }
}

export const retentionReportsService = new RetentionReportsService();