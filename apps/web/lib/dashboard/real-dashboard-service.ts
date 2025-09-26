/**
 * Real Dashboard Service
 * Fetches actual financial metrics from Supabase database
 */

import { getSupabaseClient } from '../supabase/client-singleton';

export interface RealDashboardMetrics {
  overview: {
    totalInvoices: number;
    totalAmount: number;
    pendingReview: number;
    processedThisMonth: number;
  };
  financial: {
    revenue: {
      current: number;
      previous: number;
      growth: number;
    };
    taxes: {
      iva: number;
      retentions: number;
      ica: number;
      total: number;
    };
    cashFlow: {
      inflow: number;
      outflow: number;
      net: number;
      projection: number;
    };
  };
  suppliers: {
    total: number;
    active: number;
    top5: Array<{
      id: string;
      name: string;
      amount: number;
      percentage: number;
    }>;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    priority: number;
    createdAt: string;
  }>;
  kpis: {
    automationRate: number;
    classificationAccuracy: number;
    processingTime: number;
    taxBurden: number;
    avgInvoiceValue: number;
  };
  activityData: {
    weeklyProcessing: Array<{
      week: string;
      count: number;
    }>;
    monthlyTrend: Array<{
      month: string;
      revenue: number;
      expenses: number;
    }>;
  };
}

class RealDashboardService {
  private supabase = getSupabaseClient();

  /**
   * Get complete dashboard metrics for a company
   */
  async getDashboardMetrics(companyId: string): Promise<RealDashboardMetrics> {
    try {
      console.log('🚀 Fetching real dashboard metrics for company:', companyId);

      // Run all queries in parallel for better performance
      const [
        invoicesData,
        taxesData,
        suppliersData,
        insightsData,
        companyData
      ] = await Promise.all([
        this.getInvoicesMetrics(companyId),
        this.getTaxesMetrics(companyId),
        this.getSuppliersMetrics(companyId),
        this.getInsightsData(companyId),
        this.getCompanyData(companyId)
      ]);

      // Combine all metrics
      const metrics = this.combineMetrics({
        invoicesData,
        taxesData,
        suppliersData,
        insightsData,
        companyData
      });

      console.log('✅ Real dashboard metrics compiled successfully');
      return metrics;
      
    } catch (error) {
      console.error('❌ Error fetching dashboard metrics:', error);
      throw new Error('Failed to fetch dashboard metrics');
    }
  }

  /**
   * Get invoices-related metrics
   */
  private async getInvoicesMetrics(companyId: string) {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get invoices from last 3 months for better visibility
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Current invoices (last 3 months)
    const { data: currentInvoices, error: currentError } = await this.supabase
      .from('invoices')
      .select('id, total_amount, subtotal, status, processing_status, created_at, puc_code, issue_date')
      .eq('company_id', companyId)
      .gte('issue_date', threeMonthsAgo.toISOString())
      .is('deleted_at', null);

    if (currentError) {
      console.error('Error fetching current invoices:', currentError);
      return this.getEmptyInvoicesMetrics();
    }

    // Previous month invoices for comparison
    const { data: previousInvoices, error: previousError } = await this.supabase
      .from('invoices')
      .select('total_amount')
      .eq('company_id', companyId)
      .gte('issue_date', previousMonth.toISOString())
      .lte('issue_date', previousMonthEnd.toISOString())
      .is('deleted_at', null);

    if (previousError) {
      console.warn('Warning fetching previous invoices:', previousError);
    }

    console.log('📊 Invoice metrics loaded:', {
      currentInvoicesCount: currentInvoices?.length || 0,
      previousInvoicesCount: previousInvoices?.length || 0,
      totalCurrentAmount: currentInvoices?.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0,
      sampleInvoices: currentInvoices?.slice(0, 2).map(inv => ({
        amount: inv.total_amount,
        status: inv.status,
        issue_date: inv.issue_date
      })) || []
    });

    return {
      current: currentInvoices || [],
      previous: previousInvoices || [],
      currentMonth,
      previousMonth
    };
  }

  /**
   * Get taxes breakdown metrics
   */
  private async getTaxesMetrics(companyId: string) {
    // Get all tax data from the past 3 months for better visibility
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: taxes, error } = await this.supabase
      .from('invoice_taxes')
      .select(`
        tax_type,
        tax_amount,
        taxable_base,
        tax_rate,
        concept_code,
        concept_description,
        municipality,
        supplier_type,
        created_at
      `)
      .eq('company_id', companyId)
      .gte('created_at', threeMonthsAgo.toISOString());

    if (error) {
      console.error('Error fetching taxes:', error);
      return {
        iva: 0,
        retentions: 0,
        ica: 0,
        total: 0,
        details: []
      };
    }

    // Calculate tax breakdown
    const taxData = taxes || [];
    const breakdown = {
      iva: 0,
      retentions: 0,
      ica: 0,
      total: 0,
      details: taxData
    };

    taxData.forEach(tax => {
      const amount = parseFloat(tax.tax_amount) || 0;
      const taxType = tax.tax_type?.toLowerCase() || '';

      if (taxType.includes('iva') && !taxType.includes('ret')) {
        breakdown.iva += amount;
      } else if (
        taxType.includes('retencion_fuente') ||
        taxType.includes('retefuente') ||
        taxType.includes('retencion_iva') ||
        taxType.includes('reteiva') ||
        taxType.includes('retencion_ica') ||
        taxType.includes('reteica')
      ) {
        breakdown.retentions += amount;
      } else if (
        taxType.includes('ica') && !taxType.includes('retencion')
      ) {
        breakdown.ica += amount;
      }

      breakdown.total += amount;
    });

    console.log('📊 Tax metrics calculated:', {
      iva: breakdown.iva,
      retentions: breakdown.retentions,
      ica: breakdown.ica,
      total: breakdown.total,
      taxCount: taxData.length,
      taxTypes: [...new Set(taxData.map(t => t.tax_type))],
      sampleTaxes: taxData.slice(0, 3).map(t => ({
        type: t.tax_type,
        amount: t.tax_amount,
        concept: t.concept_description
      }))
    });

    return breakdown;
  }

  /**
   * Get suppliers metrics
   */
  private async getSuppliersMetrics(companyId: string) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: suppliers, error } = await this.supabase
      .from('invoices')
      .select('supplier_name, supplier_tax_id, total_amount, created_at')
      .eq('company_id', companyId)
      .gte('created_at', threeMonthsAgo.toISOString())
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching suppliers:', error);
      return [];
    }

    return suppliers || [];
  }

  /**
   * Get AI insights for alerts
   */
  private async getInsightsData(companyId: string) {
    const { data: insights, error } = await this.supabase
      .from('ai_insights')
      .select('insight_type, title, content, priority, severity, created_at, is_dismissed')
      .eq('company_id', companyId)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching insights:', error);
      return [];
    }

    return insights || [];
  }

  /**
   * Get company information
   */
  private async getCompanyData(companyId: string) {
    const { data: company, error } = await this.supabase
      .from('companies')
      .select('name, sector, fiscal_regime, subscription_plan, created_at')
      .eq('id', companyId)
      .is('deleted_at', null)
      .single();

    if (error) {
      console.error('Error fetching company:', error);
      return null;
    }

    return company;
  }

  /**
   * Combine all metrics into dashboard structure
   */
  private combineMetrics(data: any): RealDashboardMetrics {
    const { invoicesData, taxesData, suppliersData, insightsData, companyData } = data;
    
    // Calculate overview metrics
    const totalInvoices = invoicesData.current?.length || 0;
    const totalAmount = invoicesData.current?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0;
    const previousAmount = invoicesData.previous?.reduce((sum: number, inv: any) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0;
    const pendingReview = invoicesData.current?.filter((inv: any) => inv.status === 'pending' || inv.processing_status === 'uploaded')?.length || 0;
    const processedThisMonth = invoicesData.current?.filter((inv: any) => inv.status === 'validated')?.length || 0;

    // Calculate growth
    const growth = previousAmount > 0 ? ((totalAmount - previousAmount) / previousAmount) * 100 : 0;

    // Calculate taxes breakdown
    const taxes = this.calculateTaxesBreakdown(taxesData);

    // Calculate suppliers metrics
    const suppliers = this.calculateSuppliersMetrics(suppliersData);

    // Convert insights to alerts
    const alerts = this.convertInsightsToAlerts(insightsData);

    // Calculate KPIs
    const kpis = this.calculateKPIs(invoicesData, totalAmount, totalInvoices, companyData);

    // Calculate activity data
    const activityData = this.calculateActivityData(invoicesData.current);

    return {
      overview: {
        totalInvoices,
        totalAmount,
        pendingReview,
        processedThisMonth,
      },
      financial: {
        revenue: {
          current: totalAmount,
          previous: previousAmount,
          growth: growth,
        },
        taxes: taxes,
        cashFlow: {
          inflow: totalAmount,
          outflow: taxes.total,
          net: totalAmount - taxes.total,
          projection: totalAmount * 1.1, // Simple projection
        },
      },
      suppliers: suppliers,
      alerts: alerts,
      kpis: kpis,
      activityData: activityData,
    };
  }

  /**
   * Calculate taxes breakdown from tax data
   */
  private calculateTaxesBreakdown(taxesData: any) {
    // If taxesData is already processed by getTaxesMetrics, use it directly
    if (taxesData && typeof taxesData === 'object' && 'iva' in taxesData) {
      return {
        iva: taxesData.iva || 0,
        retentions: taxesData.retentions || 0,
        ica: taxesData.ica || 0,
        total: taxesData.total || 0,
      };
    }

    // Fallback for old format (array)
    const taxArray = Array.isArray(taxesData) ? taxesData : [];
    let iva = 0;
    let retentions = 0;
    let ica = 0;

    taxArray.forEach(tax => {
      const amount = parseFloat(tax.tax_amount) || 0;
      const taxType = tax.tax_type?.toLowerCase() || '';

      if (taxType.includes('iva') && !taxType.includes('ret')) {
        iva += amount;
      } else if (
        taxType.includes('retencion_fuente') ||
        taxType.includes('retefuente') ||
        taxType.includes('retencion_iva') ||
        taxType.includes('reteiva') ||
        taxType.includes('retencion_ica') ||
        taxType.includes('reteica')
      ) {
        retentions += amount;
      } else if (
        taxType.includes('ica') && !taxType.includes('retencion')
      ) {
        ica += amount;
      }
    });

    return {
      iva,
      retentions,
      ica,
      total: iva + retentions + ica,
    };
  }

  /**
   * Calculate suppliers metrics
   */
  private calculateSuppliersMetrics(suppliersData: any[]) {
    if (!suppliersData.length) {
      return {
        total: 0,
        active: 0,
        top5: [],
      };
    }

    // Group by supplier
    const supplierGroups = suppliersData.reduce((groups: any, invoice: any) => {
      const key = invoice.supplier_tax_id || invoice.supplier_name;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          name: invoice.supplier_name,
          amount: 0,
          invoiceCount: 0,
        };
      }
      groups[key].amount += parseFloat(invoice.total_amount) || 0;
      groups[key].invoiceCount += 1;
      return groups;
    }, {});

    const suppliers = Object.values(supplierGroups) as any[];
    const totalAmount = suppliers.reduce((sum, s) => sum + s.amount, 0);

    // Sort and get top 5
    const top5 = suppliers
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(supplier => ({
        ...supplier,
        percentage: totalAmount > 0 ? (supplier.amount / totalAmount) * 100 : 0,
      }));

    return {
      total: suppliers.length,
      active: suppliers.filter(s => s.invoiceCount > 0).length,
      top5,
    };
  }

  /**
   * Convert AI insights to alerts format
   */
  private convertInsightsToAlerts(insightsData: any[]) {
    return insightsData.slice(0, 5).map(insight => ({
      type: insight.severity === 'error' ? 'error' as const : 
            insight.severity === 'warning' ? 'warning' as const : 'info' as const,
      title: insight.title,
      message: insight.content.substring(0, 200) + '...',
      priority: insight.priority === 'high' ? 1 : insight.priority === 'medium' ? 2 : 3,
      createdAt: insight.created_at,
    }));
  }

  /**
   * Calculate KPIs
   */
  private calculateKPIs(invoicesData: any, totalAmount: number, totalInvoices: number, companyData: any) {
    const processedInvoices = invoicesData.current?.filter((inv: any) => inv.status === 'validated')?.length || 0;
    const automationRate = totalInvoices > 0 ? (processedInvoices / totalInvoices) * 100 : 0;
    
    // Estimate classification accuracy based on invoices with PUC codes
    const classifiedInvoices = invoicesData.current?.filter((inv: any) => inv.puc_code)?.length || 0;
    const classificationAccuracy = totalInvoices > 0 ? (classifiedInvoices / totalInvoices) * 100 : 0;
    
    // Average processing time (mock for now)
    const processingTime = 125000; // milliseconds
    
    // Tax burden calculation would need more complex logic
    const taxBurden = 30.4; // placeholder
    
    const avgInvoiceValue = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

    return {
      automationRate,
      classificationAccuracy,
      processingTime,
      taxBurden,
      avgInvoiceValue,
    };
  }

  /**
   * Calculate activity data for charts
   */
  private calculateActivityData(invoicesData: any[]) {
    if (!invoicesData?.length) {
      return {
        weeklyProcessing: [],
        monthlyTrend: [],
      };
    }

    // Weekly processing data (last 4 weeks)
    const weeklyData = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekInvoices = invoicesData.filter(inv => {
        const invDate = new Date(inv.created_at);
        return invDate >= weekStart && invDate <= weekEnd;
      });
      
      weeklyData.push({
        week: `Semana ${4 - i}`,
        count: weekInvoices.length,
      });
    }

    // Monthly trend (simplified)
    const monthlyTrend = [{
      month: 'Este mes',
      revenue: invoicesData.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0),
      expenses: invoicesData.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0) * 0.11, // Estimated expenses
    }];

    return {
      weeklyProcessing: weeklyData,
      monthlyTrend,
    };
  }

  /**
   * Fallback empty metrics when no invoices data
   */
  private getEmptyInvoicesMetrics() {
    return {
      current: [],
      previous: [],
      currentMonth: new Date(),
      previousMonth: new Date(),
    };
  }
}

export const realDashboardService = new RealDashboardService();