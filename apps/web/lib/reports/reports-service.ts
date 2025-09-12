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
    // Check if this is a mock company
    if (companyId.startsWith('mock-company-')) {
      return this.generateMockInvoiceReport(companyId, filters);
    }

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
    // Check if this is a mock company
    if (companyId.startsWith('mock-company-')) {
      return this.generateMockTaxSummaryReport(companyId, dateFrom, dateTo);
    }

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
    // Check if this is a mock company
    if (companyId.startsWith('mock-company-')) {
      return this.generateMockSupplierReport(companyId, filters);
    }

    let query = this.supabase
      .from('invoices')
      .select(`
        supplier_tax_id,
        supplier_name,
        total_amount,
        total_tax,
        total_retention,
        issue_date,
        account_classification_confidence,
        manual_review_required
      `)
      .eq('company_id', companyId)
      .eq('status', 'validated');

    // Apply date filters
    if (filters.date_from) {
      query = query.gte('issue_date', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('issue_date', filters.date_to);
    }

    const { data: invoices, error } = await query;

    if (error) {
      throw new Error(`Error generating supplier report: ${error.message}`);
    }

    // Group by supplier
    const supplierMap = new Map<string, {
      supplier_name: string;
      invoices: any[];
      total_amount: number;
      total_taxes: number;
      confidences: number[];
    }>();

    (invoices || []).forEach(invoice => {
      const key = invoice.supplier_tax_id;
      
      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          supplier_name: invoice.supplier_name || key,
          invoices: [],
          total_amount: 0,
          total_taxes: 0,
          confidences: [],
        });
      }

      const supplierData = supplierMap.get(key)!;
      supplierData.invoices.push(invoice);
      supplierData.total_amount += invoice.total_amount || 0;
      supplierData.total_taxes += (invoice.total_tax || 0) + (invoice.total_retention || 0);
      
      if (invoice.account_classification_confidence) {
        supplierData.confidences.push(invoice.account_classification_confidence);
      }
    });

    return Array.from(supplierMap.entries()).map(([supplier_tax_id, data]) => {
      const sortedDates = data.invoices
        .map(inv => inv.issue_date)
        .sort();

      const avg_confidence = data.confidences.length > 0
        ? data.confidences.reduce((sum, conf) => sum + conf, 0) / data.confidences.length
        : 0;

      return {
        supplier_tax_id,
        supplier_name: data.supplier_name,
        total_invoices: data.invoices.length,
        total_amount: data.total_amount,
        avg_invoice_value: data.total_amount / data.invoices.length,
        total_taxes: data.total_taxes,
        last_invoice_date: sortedDates[sortedDates.length - 1] || '',
        first_invoice_date: sortedDates[0] || '',
        classification_accuracy: avg_confidence * 100,
      };
    }).sort((a, b) => b.total_amount - a.total_amount);
  }

  /**
   * Generate PUC classification report
   */
  async generatePUCClassificationReport(
    companyId: string,
    filters: InvoiceFilters = {}
  ): Promise<PUCClassificationReport[]> {
    // Check if this is a mock company
    if (companyId.startsWith('mock-company-')) {
      return this.generateMockPUCReport(companyId, filters);
    }

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

  /**
   * Generate mock invoice data for demo/testing purposes
   */
  private generateMockInvoiceReport(companyId: string, filters: InvoiceFilters = {}): DetailedInvoiceReport[] {
    const mockInvoices: DetailedInvoiceReport[] = [
      {
        invoice_number: 'FACT-2024-001',
        issue_date: '2024-01-15',
        due_date: '2024-02-15',
        supplier_name: 'Proveedor Principal S.A.S',
        supplier_tax_id: '900123456-1',
        customer_name: 'Mi Empresa SAS',
        subtotal: 5000000,
        total_tax: 950000,
        total_retention: 125000,
        total_amount: 5825000,
        puc_code: '5135',
        puc_name: 'Servicios',
        status: 'validated',
        processing_status: 'calculated',
        source_file_type: 'xml',
        manual_review_required: false,
        created_at: '2024-01-15T10:30:00Z'
      },
      {
        invoice_number: 'FACT-2024-002',
        issue_date: '2024-01-16',
        due_date: '2024-02-16',
        supplier_name: 'Distribuciones Colombia Ltda',
        supplier_tax_id: '800987654-2',
        customer_name: 'Mi Empresa SAS',
        subtotal: 3200000,
        total_tax: 608000,
        total_retention: 80000,
        total_amount: 3728000,
        puc_code: '4135',
        puc_name: 'Comercio al por mayor y al por menor',
        status: 'validated',
        processing_status: 'calculated',
        source_file_type: 'xml',
        manual_review_required: false,
        created_at: '2024-01-16T14:22:00Z'
      },
      {
        invoice_number: 'FACT-2024-003',
        issue_date: '2024-01-17',
        due_date: '2024-02-17',
        supplier_name: 'Suministros Bogotá',
        supplier_tax_id: '700456789-3',
        customer_name: 'Mi Empresa SAS',
        subtotal: 1800000,
        total_tax: 342000,
        total_retention: 45000,
        total_amount: 2097000,
        puc_code: '5145',
        puc_name: 'Mantenimiento y Reparaciones',
        status: 'validated',
        processing_status: 'calculated',
        source_file_type: 'pdf',
        manual_review_required: true,
        created_at: '2024-01-17T09:15:00Z'
      },
      {
        invoice_number: 'FACT-2024-004',
        issue_date: '2024-01-18',
        due_date: '2024-02-18',
        supplier_name: 'Comercializadora Andina',
        supplier_tax_id: '600321987-4',
        customer_name: 'Mi Empresa SAS',
        subtotal: 2400000,
        total_tax: 456000,
        total_retention: 60000,
        total_amount: 2796000,
        puc_code: '5110',
        puc_name: 'Honorarios',
        status: 'validated',
        processing_status: 'calculated',
        source_file_type: 'xml',
        manual_review_required: false,
        created_at: '2024-01-18T16:45:00Z'
      },
      {
        invoice_number: 'FACT-2024-005',
        issue_date: '2024-01-19',
        due_date: '2024-02-19',
        supplier_name: 'Importadora del Valle',
        supplier_tax_id: '500654321-5',
        customer_name: 'Mi Empresa SAS',
        subtotal: 4200000,
        total_tax: 798000,
        total_retention: 105000,
        total_amount: 4893000,
        puc_code: '1528',
        puc_name: 'Equipo de computación y comunicación',
        status: 'pending',
        processing_status: 'classified',
        source_file_type: 'xml',
        manual_review_required: false,
        created_at: '2024-01-19T11:30:00Z'
      },
      {
        invoice_number: 'FACT-2024-006',
        issue_date: '2024-01-20',
        due_date: '2024-02-20',
        supplier_name: 'Servicios Profesionales CO',
        supplier_tax_id: '400789123-6',
        customer_name: 'Mi Empresa SAS',
        subtotal: 6500000,
        total_tax: 1235000,
        total_retention: 162500,
        total_amount: 7572500,
        puc_code: '5110',
        puc_name: 'Honorarios',
        status: 'validated',
        processing_status: 'calculated',
        source_file_type: 'xml',
        manual_review_required: false,
        created_at: '2024-01-20T13:20:00Z'
      }
    ];

    // Apply basic filters
    let filteredInvoices = mockInvoices;

    if (filters.status?.length) {
      filteredInvoices = filteredInvoices.filter(inv => filters.status!.includes(inv.status));
    }

    if (filters.supplier_tax_id) {
      filteredInvoices = filteredInvoices.filter(inv => inv.supplier_tax_id === filters.supplier_tax_id);
    }

    if (filters.date_from) {
      filteredInvoices = filteredInvoices.filter(inv => inv.issue_date >= filters.date_from!);
    }

    if (filters.date_to) {
      filteredInvoices = filteredInvoices.filter(inv => inv.issue_date <= filters.date_to!);
    }

    if (filters.requires_review !== undefined) {
      filteredInvoices = filteredInvoices.filter(inv => inv.manual_review_required === filters.requires_review);
    }

    return filteredInvoices;
  }

  /**
   * Generate mock supplier analysis report
   */
  private generateMockSupplierReport(companyId: string, filters: InvoiceFilters = {}): SupplierReport[] {
    return [
      {
        supplier_tax_id: '900123456-1',
        supplier_name: 'Proveedor Principal S.A.S',
        total_invoices: 8,
        total_amount: 12500000,
        avg_invoice_value: 1562500,
        total_taxes: 2375000,
        last_invoice_date: '2024-01-20',
        first_invoice_date: '2024-01-15',
        classification_accuracy: 95.5,
      },
      {
        supplier_tax_id: '800987654-2',
        supplier_name: 'Distribuciones Colombia Ltda',
        total_invoices: 5,
        total_amount: 8200000,
        avg_invoice_value: 1640000,
        total_taxes: 1558000,
        last_invoice_date: '2024-01-18',
        first_invoice_date: '2024-01-16',
        classification_accuracy: 87.2,
      },
      {
        supplier_tax_id: '700456789-3',
        supplier_name: 'Suministros Bogotá',
        total_invoices: 3,
        total_amount: 4300000,
        avg_invoice_value: 1433333,
        total_taxes: 817000,
        last_invoice_date: '2024-01-17',
        first_invoice_date: '2024-01-17',
        classification_accuracy: 92.8,
      }
    ];
  }

  /**
   * Generate mock PUC classification report
   */
  private generateMockPUCReport(companyId: string, filters: InvoiceFilters = {}): PUCClassificationReport[] {
    const totalAmount = 25000000; // Total amount for percentage calculations

    return [
      {
        puc_code: '5135',
        puc_name: 'Servicios',
        invoice_count: 12,
        total_amount: 8500000,
        percentage_of_total: 34.0,
        avg_confidence: 92.5,
        manual_review_count: 1,
      },
      {
        puc_code: '4135',
        puc_name: 'Comercio al por mayor y al por menor',
        invoice_count: 8,
        total_amount: 6200000,
        percentage_of_total: 24.8,
        avg_confidence: 88.3,
        manual_review_count: 0,
      },
      {
        puc_code: '5110',
        puc_name: 'Honorarios',
        invoice_count: 6,
        total_amount: 5800000,
        percentage_of_total: 23.2,
        avg_confidence: 95.1,
        manual_review_count: 0,
      },
      {
        puc_code: '5145',
        puc_name: 'Mantenimiento y Reparaciones',
        invoice_count: 4,
        total_amount: 2900000,
        percentage_of_total: 11.6,
        avg_confidence: 89.7,
        manual_review_count: 2,
      },
      {
        puc_code: '1528',
        puc_name: 'Equipo de computación y comunicación',
        invoice_count: 2,
        total_amount: 1600000,
        percentage_of_total: 6.4,
        avg_confidence: 91.2,
        manual_review_count: 0,
      }
    ];
  }

  /**
   * Generate mock tax summary report
   */
  private generateMockTaxSummaryReport(companyId: string, dateFrom: string, dateTo: string): TaxSummaryReport[] {
    return [
      {
        period: '2024-01',
        total_invoices: 32,
        total_amount: 25000000,
        total_iva: 4750000,
        total_retentions: 625000,
        total_ica: 100000,
        net_amount: 24375000,
        tax_burden_percentage: 21.9,
      },
      {
        period: '2024-02',
        total_invoices: 28,
        total_amount: 22500000,
        total_iva: 4275000,
        total_retentions: 562500,
        total_ica: 90000,
        net_amount: 21937500,
        tax_burden_percentage: 21.9,
      },
      {
        period: '2024-03',
        total_invoices: 35,
        total_amount: 28200000,
        total_iva: 5358000,
        total_retentions: 705000,
        total_ica: 112800,
        net_amount: 27495000,
        tax_burden_percentage: 21.9,
      }
    ];
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