/**
 * Reports Service
 * Generate various reports for Colombian tax and accounting purposes
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { InvoiceFilters, ExportOptions, ExportResult } from '~/lib/invoices/types';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'financial' | 'tax' | 'operational' | 'compliance';
  columns: ReportColumn[];
  filters?: InvoiceFilters;
}

interface ReportColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'percentage' | 'date' | 'boolean';
  format?: string;
}

interface DetailedInvoiceReport {
  invoice_number: string;
  issue_date: string;
  due_date?: string;
  supplier_name: string;
  supplier_tax_id: string;
  customer_name?: string;
  subtotal: number;
  total_tax: number;
  total_retention: number;
  total_amount: number;
  puc_code?: string;
  puc_name?: string;
  status: string;
  processing_status: string;
  source_file_type?: string;
  manual_review_required: boolean;
  created_at: string;
}

interface TaxSummaryReport {
  period: string;
  total_invoices: number;
  total_amount: number;
  total_iva: number;
  total_retentions: number;
  total_ica: number;
  net_amount: number;
  tax_burden_percentage: number;
}

interface SupplierReport {
  supplier_tax_id: string;
  supplier_name: string;
  total_invoices: number;
  total_amount: number;
  avg_invoice_value: number;
  total_taxes: number;
  total_retefuente: number;
  total_reteica: number;
  total_reteiva: number;
  total_retentions: number;
  last_invoice_date: string;
  first_invoice_date: string;
  classification_accuracy: number;
}

interface PUCClassificationReport {
  puc_code: string;
  puc_name: string;
  invoice_count: number;
  total_amount: number;
  percentage_of_total: number;
  avg_confidence: number;
  manual_review_count: number;
}

class ReportsService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Method overloads to accept external supabase client
  setSupabaseClient(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get available report templates
   */
  getReportTemplates(): ReportTemplate[] {
    return [
      {
        id: 'detailed-invoices',
        name: 'Reporte Detallado de Facturas',
        description: 'Listado completo de todas las facturas con detalles tributarios',
        type: 'financial',
        columns: [
          { key: 'invoice_number', label: 'Número', type: 'string' },
          { key: 'issue_date', label: 'Fecha Emisión', type: 'date' },
          { key: 'supplier_name', label: 'Proveedor', type: 'string' },
          { key: 'supplier_tax_id', label: 'NIT', type: 'string' },
          { key: 'subtotal', label: 'Subtotal', type: 'currency' },
          { key: 'total_tax', label: 'Impuestos', type: 'currency' },
          { key: 'total_retention', label: 'Retenciones', type: 'currency' },
          { key: 'total_amount', label: 'Total', type: 'currency' },
          { key: 'puc_code', label: 'Cuenta PUC', type: 'string' },
          { key: 'status', label: 'Estado', type: 'string' },
        ],
      },
      {
        id: 'tax-summary',
        name: 'Resumen Tributario Mensual',
        description: 'Consolidado de impuestos por período para DIAN',
        type: 'tax',
        columns: [
          { key: 'period', label: 'Período', type: 'string' },
          { key: 'total_amount', label: 'Base Gravable', type: 'currency' },
          { key: 'total_iva', label: 'IVA', type: 'currency' },
          { key: 'total_retentions', label: 'Retenciones', type: 'currency' },
          { key: 'total_ica', label: 'ICA', type: 'currency' },
          { key: 'net_amount', label: 'Neto a Pagar', type: 'currency' },
          { key: 'tax_burden_percentage', label: 'Carga Tributaria', type: 'percentage' },
        ],
      },
      {
        id: 'supplier-analysis',
        name: 'Análisis de Proveedores',
        description: 'Estadísticas detalladas por proveedor',
        type: 'operational',
        columns: [
          { key: 'supplier_name', label: 'Proveedor', type: 'string' },
          { key: 'supplier_tax_id', label: 'NIT', type: 'string' },
          { key: 'total_invoices', label: 'Facturas', type: 'number' },
          { key: 'total_amount', label: 'Monto Total', type: 'currency' },
          { key: 'avg_invoice_value', label: 'Promedio', type: 'currency' },
          { key: 'total_taxes', label: 'Impuestos', type: 'currency' },
          { key: 'total_retefuente', label: 'ReteFuente', type: 'currency' },
          { key: 'total_reteica', label: 'ReteICA', type: 'currency' },
          { key: 'total_reteiva', label: 'ReteIVA', type: 'currency' },
          { key: 'classification_accuracy', label: 'Precisión', type: 'percentage' },
        ],
      },
      {
        id: 'puc-classification',
        name: 'Clasificación PUC',
        description: 'Distribución de facturas por cuenta contable',
        type: 'compliance',
        columns: [
          { key: 'puc_code', label: 'Código PUC', type: 'string' },
          { key: 'puc_name', label: 'Descripción', type: 'string' },
          { key: 'invoice_count', label: 'Facturas', type: 'number' },
          { key: 'total_amount', label: 'Monto', type: 'currency' },
          { key: 'percentage_of_total', label: '% del Total', type: 'percentage' },
          { key: 'avg_confidence', label: 'Confianza Promedio', type: 'percentage' },
        ],
      },
    ];
  }

  /**
   * Generate detailed invoice report
   */
  async generateDetailedInvoiceReport(
    companyId: string,
    filters: InvoiceFilters = {}
  ): Promise<DetailedInvoiceReport[]> {

    let query = this.supabase
      .from('invoices')
      .select(`
        invoice_number,
        issue_date,
        due_date,
        supplier_name,
        supplier_tax_id,
        customer_name,
        subtotal,
        total_tax,
        total_retention,
        total_amount,
        puc_code,
        status,
        processing_status,
        source_file_type,
        manual_review_required,
        created_at
      `)
      .eq('company_id', companyId);

    // Apply filters
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

    if (filters.amount_min) {
      query = query.gte('total_amount', filters.amount_min);
    }

    if (filters.amount_max) {
      query = query.lte('total_amount', filters.amount_max);
    }

    if (filters.puc_code) {
      query = query.eq('puc_code', filters.puc_code);
    }

    if (filters.requires_review !== undefined) {
      query = query.eq('manual_review_required', filters.requires_review);
    }

    if (filters.search) {
      query = query.or(
        `invoice_number.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%`
      );
    }

    query = query.order('issue_date', { ascending: false });

    const { data: invoices, error } = await query;

    if (error) {
      throw new Error(`Error generating report: ${error.message}`);
    }

    if (!invoices || invoices.length === 0) {
      return [];
    }

    // Get PUC names separately to avoid JOIN issues
    const pucCodes = [...new Set(invoices.map(inv => inv.puc_code).filter(Boolean))];
    let pucMap = new Map<string, string>();

    if (pucCodes.length > 0) {
      const { data: pucAccounts } = await this.supabase
        .from('puc_accounts')
        .select('code, name')
        .in('code', pucCodes);

      if (pucAccounts) {
        pucAccounts.forEach(puc => {
          pucMap.set(puc.code, puc.name);
        });
      }
    }

    return invoices.map(invoice => ({
      ...invoice,
      puc_name: invoice.puc_code ? (pucMap.get(invoice.puc_code) || '') : '',
    }));
  }

  /**
   * Generate tax summary report
   */
  async generateTaxSummaryReport(
    companyId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<TaxSummaryReport[]> {

    // Get invoices first
    const { data: invoices, error } = await this.supabase
      .from('invoices')
      .select(`
        id,
        issue_date,
        total_amount,
        total_tax,
        total_retention
      `)
      .eq('company_id', companyId)
      .gte('issue_date', dateFrom)
      .lte('issue_date', dateTo)
      .eq('status', 'validated');

    if (error) {
      throw new Error(`Error generating tax summary: ${error.message}`);
    }

    if (!invoices || invoices.length === 0) {
      return [];
    }

    // Get tax details separately
    const invoiceIds = invoices.map(inv => inv.id);
    let taxData: any[] = [];

    if (invoiceIds.length > 0) {
      const { data: taxes } = await this.supabase
        .from('invoice_taxes')
        .select('invoice_id, tax_type, tax_amount')
        .in('invoice_id', invoiceIds);
      
      taxData = taxes || [];
    }

    // Create tax map by invoice
    const taxMap = new Map<string, any[]>();
    taxData.forEach(tax => {
      if (!taxMap.has(tax.invoice_id)) {
        taxMap.set(tax.invoice_id, []);
      }
      taxMap.get(tax.invoice_id)!.push(tax);
    });

    // Group by month
    const monthlyData = new Map<string, {
      total_invoices: number;
      total_amount: number;
      total_iva: number;
      total_retentions: number;
      total_ica: number;
    }>();

    invoices.forEach(invoice => {
      const monthKey = invoice.issue_date.substring(0, 7); // YYYY-MM
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          total_invoices: 0,
          total_amount: 0,
          total_iva: 0,
          total_retentions: 0,
          total_ica: 0,
        });
      }

      const monthData = monthlyData.get(monthKey)!;
      monthData.total_invoices++;
      monthData.total_amount += invoice.total_amount || 0;
      
      // Calculate tax breakdown from separate tax data
      const invoiceTaxes = taxMap.get(invoice.id) || [];
      invoiceTaxes.forEach(tax => {
        switch (tax.tax_type) {
          case 'IVA':
            monthData.total_iva += tax.tax_amount;
            break;
          case 'RETENCION_FUENTE':
          case 'RETENCION_IVA':
          case 'RETENCION_ICA':
            monthData.total_retentions += tax.tax_amount;
            break;
          case 'ICA':
            monthData.total_ica += tax.tax_amount;
            break;
        }
      });
    });

    return Array.from(monthlyData.entries()).map(([period, data]) => {
      const net_amount = data.total_amount - data.total_retentions;
      const tax_burden_percentage = data.total_amount > 0 
        ? ((data.total_iva + data.total_retentions + data.total_ica) / data.total_amount) * 100
        : 0;

      return {
        period,
        ...data,
        net_amount,
        tax_burden_percentage,
      };
    }).sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Generate supplier analysis report
   */
  async generateSupplierReport(
    companyId: string,
    filters: InvoiceFilters = {}
  ): Promise<SupplierReport[]> {

    console.log('🚀 Starting supplier report for company:', companyId);
    console.log('🔍 Filters applied:', filters);

    // SIMPLE QUERY: Get ALL invoices for this company, no filters
    const { data: invoices, error } = await this.supabase
      .from('invoices')
      .select(`
        id,
        supplier_tax_id,
        supplier_name,
        total_amount,
        total_tax,
        total_retention,
        issue_date,
        status,
        created_at,
        deleted_at
      `)
      .eq('company_id', companyId)
      .order('supplier_name', { ascending: true });

    console.log('📊 Raw invoice data:', {
      totalInvoices: invoices?.length || 0,
      error: error?.message,
      // Show ALL unique supplier names
      allUniqueSuppliers: invoices ? [...new Set(invoices.map(inv => inv.supplier_name))].sort() : [],
    });

    // Check specifically for "prosuminisitrso"
    const prosuministrsoInvoices = invoices?.filter(inv =>
      inv.supplier_name?.toLowerCase().includes('prosum') ||
      inv.supplier_name?.toLowerCase().includes('ministro') ||
      inv.supplier_name?.toLowerCase().includes('suministr')
    ) || [];

    console.log('🔍 Prosuminisitrso search:', {
      found: prosuministrsoInvoices.length,
      invoices: prosuministrsoInvoices.map(inv => ({
        id: inv.id,
        supplier_name: inv.supplier_name,
        supplier_tax_id: inv.supplier_tax_id,
        total_amount: inv.total_amount,
        status: inv.status,
        deleted_at: inv.deleted_at
      }))
    });

    if (error) {
      throw new Error(`Error generating supplier report: ${error.message}`);
    }

    if (!invoices || invoices.length === 0) {
      console.log('⚠️ No invoices found for supplier report');
      return [];
    }

    // Get detailed retention information for all invoices
    const invoiceIds = invoices.map(inv => inv.id);
    let retentionData: any[] = [];

    if (invoiceIds.length > 0) {
      const { data: taxes } = await this.supabase
        .from('invoice_taxes')
        .select('invoice_id, tax_type, tax_amount')
        .in('invoice_id', invoiceIds)
        .in('tax_type', ['RETENCION_FUENTE', 'RETENCION_ICA', 'RETENCION_IVA']);

      retentionData = taxes || [];
    }

    // Create retention map by invoice
    const retentionMap = new Map<string, {
      retefuente: number;
      reteica: number;
      reteiva: number;
    }>();

    retentionData.forEach(retention => {
      if (!retentionMap.has(retention.invoice_id)) {
        retentionMap.set(retention.invoice_id, {
          retefuente: 0,
          reteica: 0,
          reteiva: 0,
        });
      }

      const invoiceRetentions = retentionMap.get(retention.invoice_id)!;
      const amount = parseFloat(retention.tax_amount) || 0;

      switch (retention.tax_type) {
        case 'RETENCION_FUENTE':
          invoiceRetentions.retefuente += amount;
          break;
        case 'RETENCION_ICA':
          invoiceRetentions.reteica += amount;
          break;
        case 'RETENCION_IVA':
          invoiceRetentions.reteiva += amount;
          break;
      }
    });

    // Group by supplier
    const supplierMap = new Map<string, {
      supplier_name: string;
      invoices: any[];
      total_amount: number;
      total_taxes: number;
      total_retefuente: number;
      total_reteica: number;
      total_reteiva: number;
      confidences: number[];
    }>();

    invoices.forEach(invoice => {
      // Use supplier name as the primary key, fallback to tax_id if no name
      const key = invoice.supplier_name || invoice.supplier_tax_id || 'UNKNOWN';

      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          supplier_name: invoice.supplier_name || 'N/A',
          supplier_tax_id: invoice.supplier_tax_id || 'N/A',
          invoices: [],
          total_amount: 0,
          total_taxes: 0,
          total_retefuente: 0,
          total_reteica: 0,
          total_reteiva: 0,
          confidences: [],
        });
      }

      const supplierData = supplierMap.get(key)!;
      supplierData.invoices.push(invoice);
      supplierData.total_amount += invoice.total_amount || 0;
      supplierData.total_taxes += (invoice.total_tax || 0) + (invoice.total_retention || 0);

      // Add retention breakdown
      const invoiceRetentions = retentionMap.get(invoice.id);
      if (invoiceRetentions) {
        supplierData.total_retefuente += invoiceRetentions.retefuente;
        supplierData.total_reteica += invoiceRetentions.reteica;
        supplierData.total_reteiva += invoiceRetentions.reteiva;
      }

      if (invoice.account_classification_confidence) {
        supplierData.confidences.push(invoice.account_classification_confidence);
      }
    });

    const suppliers = Array.from(supplierMap.entries()).map(([supplierKey, data]) => {
      const sortedDates = data.invoices
        .map(inv => inv.issue_date)
        .sort();

      const avg_confidence = data.confidences.length > 0
        ? data.confidences.reduce((sum, conf) => sum + conf, 0) / data.confidences.length
        : 0;

      return {
        supplier_tax_id: data.supplier_tax_id,
        supplier_name: data.supplier_name,
        total_invoices: data.invoices.length,
        total_amount: data.total_amount,
        avg_invoice_value: data.total_amount / data.invoices.length,
        total_taxes: data.total_taxes,
        total_retefuente: data.total_retefuente,
        total_reteica: data.total_reteica,
        total_reteiva: data.total_reteiva,
        total_retentions: data.total_retefuente + data.total_reteica + data.total_reteiva,
        last_invoice_date: sortedDates[sortedDates.length - 1] || '',
        first_invoice_date: sortedDates[0] || '',
        classification_accuracy: avg_confidence * 100,
      };
    }).sort((a, b) => b.total_amount - a.total_amount);

    console.log('✅ Generated supplier report:', {
      totalSuppliers: suppliers.length,
      supplierNames: suppliers.map(s => s.supplier_name).slice(0, 5)
    });

    return suppliers;
  }

  /**
   * Generate PUC classification report
   */
  async generatePUCClassificationReport(
    companyId: string,
    filters: InvoiceFilters = {}
  ): Promise<PUCClassificationReport[]> {

    const { data: invoices, error } = await this.supabase
      .from('invoices')
      .select(`
        puc_code,
        total_amount,
        account_classification_confidence,
        manual_review_required
      `)
      .eq('company_id', companyId)
      .eq('status', 'validated')
      .not('puc_code', 'is', null);

    if (error) {
      throw new Error(`Error generating PUC report: ${error.message}`);
    }

    if (!invoices || invoices.length === 0) {
      return [];
    }

    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

    // Get PUC names separately
    const pucCodes = [...new Set(invoices.map(inv => inv.puc_code).filter(Boolean))];
    let pucNamesMap = new Map<string, string>();

    if (pucCodes.length > 0) {
      const { data: pucAccounts } = await this.supabase
        .from('puc_accounts')
        .select('code, name')
        .in('code', pucCodes);

      if (pucAccounts) {
        pucAccounts.forEach(puc => {
          pucNamesMap.set(puc.code, puc.name);
        });
      }
    }

    // Group by PUC code
    const pucMap = new Map<string, {
      puc_name: string;
      invoices: any[];
      total_amount: number;
      confidences: number[];
      manual_reviews: number;
    }>();

    invoices.forEach(invoice => {
      const key = invoice.puc_code!;
      
      if (!pucMap.has(key)) {
        pucMap.set(key, {
          puc_name: pucNamesMap.get(key) || 'Sin descripción',
          invoices: [],
          total_amount: 0,
          confidences: [],
          manual_reviews: 0,
        });
      }

      const pucData = pucMap.get(key)!;
      pucData.invoices.push(invoice);
      pucData.total_amount += invoice.total_amount || 0;
      
      if (invoice.account_classification_confidence) {
        pucData.confidences.push(invoice.account_classification_confidence);
      }
      
      if (invoice.manual_review_required) {
        pucData.manual_reviews++;
      }
    });

    return Array.from(pucMap.entries()).map(([puc_code, data]) => {
      const avg_confidence = data.confidences.length > 0
        ? data.confidences.reduce((sum, conf) => sum + conf, 0) / data.confidences.length
        : 0;

      return {
        puc_code,
        puc_name: data.puc_name,
        invoice_count: data.invoices.length,
        total_amount: data.total_amount,
        percentage_of_total: totalAmount > 0 ? (data.total_amount / totalAmount) * 100 : 0,
        avg_confidence: avg_confidence * 100,
        manual_review_count: data.manual_reviews,
      };
    }).sort((a, b) => b.total_amount - a.total_amount);
  }

  /**
   * Export report to various formats
   */
  async exportReport(
    reportData: any[],
    template: ReportTemplate,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${template.id}-${timestamp}`;

      let content: string;
      let mimeType: string;
      let fileExtension: string;

      switch (options.format) {
        case 'csv':
          content = this.generateCSV(reportData, template);
          mimeType = 'text/csv';
          fileExtension = 'csv';
          break;

        case 'excel':
          content = this.generateCSV(reportData, template); // Simplified - could use xlsx library
          mimeType = 'application/vnd.ms-excel';
          fileExtension = 'csv';
          break;

        case 'json':
          content = JSON.stringify({
            template: template.name,
            generatedAt: new Date().toISOString(),
            filters: options.filters,
            data: reportData,
          }, null, 2);
          mimeType = 'application/json';
          fileExtension = 'json';
          break;

        default:
          throw new Error(`Formato no soportado: ${options.format}`);
      }

      // Create download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return {
        success: true,
        file_name: `${filename}.${fileExtension}`,
      };

    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Generate CSV content
   */
  private generateCSV(data: any[], template: ReportTemplate): string {
    const headers = template.columns.map(col => col.label);
    const rows = [headers];

    data.forEach(item => {
      const row = template.columns.map(col => {
        const value = item[col.key];
        
        if (value === null || value === undefined) return '';
        
        switch (col.type) {
          case 'currency':
            return new Intl.NumberFormat('es-CO', {
              style: 'currency',
              currency: 'COP',
              minimumFractionDigits: 0,
            }).format(value);
            
          case 'percentage':
            return `${value.toFixed(2)}%`;
            
          case 'date':
            return new Date(value).toLocaleDateString('es-CO');
            
          case 'number':
            return value.toLocaleString('es-CO');
            
          default:
            return String(value);
        }
      });
      
      rows.push(row);
    });

    return rows.map(row => 
      row.map(cell => 
        typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
      ).join(',')
    ).join('\n');
  }



}

export const reportsService = new ReportsService();
export type { 
  ReportTemplate, 
  ReportColumn, 
  DetailedInvoiceReport, 
  TaxSummaryReport, 
  SupplierReport, 
  PUCClassificationReport 
};