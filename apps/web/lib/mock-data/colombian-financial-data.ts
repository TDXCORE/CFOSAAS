/**
 * Mock Colombian Financial Data
 * Realistic data for testing and demo purposes
 */

import type { DashboardMetrics, ColombianKPIs } from '../analytics/dashboard-service';
import type { Company } from '../companies/types';

/**
 * Generate mock Colombian financial data for a company
 */
export function generateMockDashboardMetrics(companyId: string): DashboardMetrics {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // Simulate realistic Colombian PYME data
  const baseRevenue = Math.random() * 50000000 + 10000000; // 10M - 60M COP
  const previousRevenue = baseRevenue * (0.85 + Math.random() * 0.3); // -15% to +15%
  
  const ivaAmount = Math.round(baseRevenue * 0.19 * 0.8);
  const retentionsAmount = Math.round(baseRevenue * 0.025);
  const icaAmount = Math.round(baseRevenue * 0.004);
  const totalTaxes = ivaAmount + retentionsAmount + icaAmount;
  
  const totalInvoices = Math.floor(Math.random() * 150) + 50;
  const totalAmount = Math.round(baseRevenue);

  return {
    overview: {
      totalInvoices,
      totalAmount,
      pendingReview: Math.floor(Math.random() * 15) + 2,
      processedToday: Math.floor(Math.random() * 25) + 5,
      averageProcessingTime: Math.floor(Math.random() * 180) + 30,
      errorRate: Math.random() * 3 + 1,
      lastProcessed: new Date(Date.now() - Math.random() * 3600000).toISOString()
    },
    financial: {
      revenue: {
        current: Math.round(baseRevenue),
        previous: Math.round(previousRevenue),
        growth: Math.round(((baseRevenue - previousRevenue) / previousRevenue) * 100),
        forecast: Math.round(baseRevenue * 1.1),
        trend: baseRevenue > previousRevenue ? 'up' : 'down'
      },
      expenses: {
        current: Math.round(baseRevenue * 0.75),
        previous: Math.round(previousRevenue * 0.78),
        growth: -3.8,
        trend: 'down'
      },
      profit: {
        current: Math.round(baseRevenue * 0.15),
        previous: Math.round(previousRevenue * 0.12),
        growth: 25.3,
        trend: 'up'
      },
      taxes: {
        iva: ivaAmount,
        retentions: retentionsAmount,
        ica: icaAmount,
        total: totalTaxes
      },
      cashFlow: {
        inflow: Math.round(baseRevenue),
        outflow: retentionsAmount,
        net: Math.round(baseRevenue - retentionsAmount),
        projection: Math.round((baseRevenue - retentionsAmount) * 1.1)
      }
    },
    operations: {
      processing: {
        avgTime: Math.floor(Math.random() * 180000) + 30000,
        successRate: Math.round(Math.random() * 10 + 90),
        errorRate: Math.round(Math.random() * 8 + 2),
        throughput: Math.round(totalInvoices / 30)
      },
      automation: {
        rate: Math.round(Math.random() * 30 + 65),
        savings: Math.round((totalInvoices * 0.8) * 4500),
        accuracy: Math.round(Math.random() * 10 + 90)
      }
    },
    suppliers: {
      total: Math.floor(Math.random() * 25) + 15,
      active: Math.floor(Math.random() * 20) + 12,
      top5: [
        {
          id: 'supplier-1',
          name: 'Proveedor Principal S.A.S',
          amount: Math.round(totalAmount * 0.25),
          percentage: 25.0
        },
        {
          id: 'supplier-2', 
          name: 'Distribuciones Colombia Ltda',
          amount: Math.round(totalAmount * 0.18),
          percentage: 18.0
        },
        {
          id: 'supplier-3',
          name: 'Suministros Bogotá',
          amount: Math.round(totalAmount * 0.15),
          percentage: 15.0
        },
        {
          id: 'supplier-4',
          name: 'Comercializadora Andina',
          amount: Math.round(totalAmount * 0.12),
          percentage: 12.0
        },
        {
          id: 'supplier-5',
          name: 'Importadora del Valle',
          amount: Math.round(totalAmount * 0.08),
          percentage: 8.0
        }
      ]
    },
    trends: {
      monthly: [
        { month: 'Ene', revenue: Math.round(baseRevenue * 0.85), invoices: Math.floor(totalInvoices * 0.8), taxes: Math.round(totalTaxes * 0.85) },
        { month: 'Feb', revenue: Math.round(baseRevenue * 0.90), invoices: Math.floor(totalInvoices * 0.85), taxes: Math.round(totalTaxes * 0.90) },
        { month: 'Mar', revenue: Math.round(baseRevenue * 0.95), invoices: Math.floor(totalInvoices * 0.92), taxes: Math.round(totalTaxes * 0.95) },
        { month: 'Abr', revenue: Math.round(baseRevenue * 1.02), invoices: Math.floor(totalInvoices * 1.05), taxes: Math.round(totalTaxes * 1.02) },
        { month: 'May', revenue: Math.round(baseRevenue * 1.08), invoices: Math.floor(totalInvoices * 1.1), taxes: Math.round(totalTaxes * 1.08) },
        { month: 'Jun', revenue: Math.round(baseRevenue), invoices: totalInvoices, taxes: totalTaxes }
      ],
      weekly: [
        { week: 'Sem 1', processed: Math.floor(totalInvoices * 0.2), errors: Math.floor(totalInvoices * 0.01) },
        { week: 'Sem 2', processed: Math.floor(totalInvoices * 0.25), errors: Math.floor(totalInvoices * 0.008) },
        { week: 'Sem 3', processed: Math.floor(totalInvoices * 0.28), errors: Math.floor(totalInvoices * 0.012) },
        { week: 'Sem 4', processed: Math.floor(totalInvoices * 0.27), errors: Math.floor(totalInvoices * 0.006) }
      ]
    },
    alerts: [
      {
        type: 'warning' as const,
        title: 'Facturas Pendientes',
        message: `Hay ${Math.floor(Math.random() * 5) + 3} facturas pendientes de revisión manual`,
        priority: 2,
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
      },
      {
        type: 'info' as const,
        title: 'Actualización DIAN',
        message: 'Nueva versión del formato de facturación electrónica disponible',
        priority: 1,
        createdAt: new Date(Date.now() - Math.random() * 172800000).toISOString()
      }
    ],
    period: {
      startDate: new Date(currentYear, currentMonth, 1).toISOString(),
      endDate: new Date(currentYear, currentMonth + 1, 0).toISOString(),
      type: 'monthly' as const
    }
  };
}

/**
 * Generate mock Colombian KPIs
 */
export function generateMockColombianKPIs(companyId: string): ColombianKPIs {
  const baseRevenue = Math.random() * 50000000 + 10000000;
  
  return {
    // Financial Health
    monthlyRevenue: Math.round(baseRevenue),
    monthlyGrowth: Math.round((Math.random() * 30 - 10) * 10) / 10, // -10% to +20%
    cashFlow: Math.round(baseRevenue * 0.15), // 15% of revenue as cash flow
    avgInvoiceValue: Math.round(baseRevenue / (Math.floor(Math.random() * 150) + 50)),
    
    // Tax Efficiency  
    ivaRate: Math.round((Math.random() * 2 + 18) * 10) / 10, // 18-20% effective IVA
    retentionRate: Math.round((Math.random() * 1.5 + 2) * 100) / 100, // 2.0-3.5% retention
    icaRate: Math.round((Math.random() * 0.6 + 0.2) * 1000) / 1000, // 0.2-0.8% ICA
    taxBurden: Math.round((Math.random() * 8 + 32) * 10) / 10, // 32-40% total tax burden
    
    // Operational Efficiency
    processingTime: Math.round(Math.random() * 120000 + 45000), // 45-165 seconds in milliseconds
    automationRate: Math.round(Math.random() * 30 + 65), // 65-95% automation
    classificationAccuracy: Math.round(Math.random() * 10 + 90), // 90-100% accuracy
    manualReviewRate: Math.round(Math.random() * 20 + 5), // 5-25% manual review
    
    // Supplier Management
    supplierCount: Math.floor(Math.random() * 25) + 15, // 15-40 suppliers
    supplierConcentration: Math.round(Math.random() * 15 + 20), // 20-35% concentration
    avgPaymentTerms: Math.floor(Math.random() * 30) + 15, // 15-45 days
    
    // Compliance
    onTimeFilingRate: Math.round(Math.random() * 5 + 95), // 95-100% on time filing
    taxComplianceScore: Math.round(Math.random() * 15 + 80), // 80-95% compliance score
    
    // Industry Benchmarks
    sectorAvgRevenue: Math.round(baseRevenue * (0.8 + Math.random() * 0.6)), // ±20% of company revenue
    sectorAvgMargin: Math.round((Math.random() * 10 + 10) * 10) / 10, // 10-20% sector margin
    competitivePosition: Math.round(Math.random() * 40 + 60), // 60-100% competitive position
  };
}

/**
 * Generate mock company data for Colombia
 */
export function generateMockCompanies(userId: string): Company[] {
  const companies: Company[] = [
    {
      id: 'mock-company-1',
      name: 'Distribuidora El Éxito SAS',
      nit: '890123456-7',
      email: 'admin@distribuidora-exito.com',
      phone: '+57 1 234-5678',
      address: 'Carrera 15 #93-17, Bogotá DC',
      city: 'Bogotá',
      department: 'Cundinamarca',
      country: 'Colombia',
      industry_sector: 'retail',
      company_size: 'medium',
      tax_regime: 'responsable_iva',
      accounting_period: 'monthly',
      fiscal_year_end: '2024-12-31',
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      settings: {
        currency: 'COP',
        timezone: 'America/Bogota',
        default_retention: 2.5,
        auto_classification: true,
        email_notifications: true
      }
    },
    {
      id: 'mock-company-2', 
      name: 'Consultores Asociados Ltda',
      nit: '800987654-3',
      email: 'contacto@consultores-asociados.co',
      phone: '+57 2 345-6789',
      address: 'Avenida 6N #23-45, Cali',
      city: 'Cali',
      department: 'Valle del Cauca',
      country: 'Colombia',
      industry_sector: 'services',
      company_size: 'small',
      tax_regime: 'responsable_iva',
      accounting_period: 'monthly',
      fiscal_year_end: '2024-12-31',
      created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      is_active: true,
      settings: {
        currency: 'COP',
        timezone: 'America/Bogota', 
        default_retention: 3.5,
        auto_classification: false,
        email_notifications: false
      }
    }
  ];
  
  return companies;
}

/**
 * Simulate API delay for realistic UX
 */
export function simulateApiDelay(ms: number = 1000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}