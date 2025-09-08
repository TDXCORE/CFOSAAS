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
  
  return {
    financial: {
      revenue: {
        current: Math.round(baseRevenue),
        previous: Math.round(previousRevenue),
        growth: Math.round(((baseRevenue - previousRevenue) / previousRevenue) * 100),
        trend: baseRevenue > previousRevenue ? 'up' : 'down'
      },
      expenses: {
        current: Math.round(baseRevenue * 0.75), // 75% of revenue typical for PYMES
        previous: Math.round(previousRevenue * 0.78),
        growth: -3.8,
        trend: 'down'
      },
      profit: {
        current: Math.round(baseRevenue * 0.15), // 15% margin
        previous: Math.round(previousRevenue * 0.12),
        growth: 25.3,
        trend: 'up'
      },
      taxes: {
        iva: Math.round(baseRevenue * 0.19 * 0.8), // IVA 19% on 80% of sales
        retentions: Math.round(baseRevenue * 0.025), // 2.5% retention average
        ica: Math.round(baseRevenue * 0.004), // ICA 0.4% average Colombia
        total: 0
      }
    },
    overview: {
      totalInvoices: Math.floor(Math.random() * 150) + 50, // 50-200 invoices/month
      pendingReview: Math.floor(Math.random() * 15) + 2, // 2-17 pending
      processedToday: Math.floor(Math.random() * 25) + 5, // 5-30 today
      averageProcessingTime: Math.floor(Math.random() * 180) + 30, // 30-210 seconds
      errorRate: Math.random() * 3 + 1, // 1-4% error rate
      lastProcessed: new Date(Date.now() - Math.random() * 3600000).toISOString() // Within last hour
    },
    period: {
      startDate: new Date(currentYear, currentMonth, 1).toISOString(),
      endDate: new Date(currentYear, currentMonth + 1, 0).toISOString(),
      type: 'monthly'
    }
  };
}

/**
 * Generate mock Colombian KPIs
 */
export function generateMockColombianKPIs(companyId: string): ColombianKPIs {
  return {
    // Automation metrics
    automationRate: Math.round(Math.random() * 30 + 65), // 65-95% automation
    classificationAccuracy: Math.round(Math.random() * 10 + 90), // 90-100% accuracy
    processingTime: Math.round(Math.random() * 120 + 45), // 45-165 seconds average
    
    // Colombian tax compliance
    taxBurden: Math.round((Math.random() * 8 + 32) * 10) / 10, // 32-40% total tax burden
    ivaRate: Math.round((Math.random() * 2 + 18) * 10) / 10, // 18-20% effective IVA
    retentionRate: Math.round((Math.random() * 1.5 + 2) * 100) / 100, // 2.0-3.5% retention
    icaRate: Math.round((Math.random() * 0.6 + 0.2) * 1000) / 1000, // 0.2-0.8% ICA
    
    // Colombian compliance metrics
    dianCompliance: Math.round(Math.random() * 5 + 95), // 95-100% DIAN compliance
    invoiceValidation: Math.round(Math.random() * 3 + 97), // 97-100% validation rate
    reportingAccuracy: Math.round(Math.random() * 5 + 95), // 95-100% reporting accuracy
    
    // Financial ratios specific to Colombia
    currentRatio: Math.round((Math.random() * 1.0 + 1.2) * 100) / 100, // 1.2-2.2 current ratio
    quickRatio: Math.round((Math.random() * 0.8 + 0.8) * 100) / 100, // 0.8-1.6 quick ratio
    debtToEquity: Math.round((Math.random() * 1.5 + 0.3) * 100) / 100, // 0.3-1.8 debt to equity
    workingCapital: Math.round(Math.random() * 20000000 + 5000000), // 5M-25M COP
    
    // Sectorial benchmarks (Colombia specific)
    sectoralPerformance: {
      revenue_growth: Math.round((Math.random() * 20 - 5) * 10) / 10, // -5% to 15% growth
      profit_margin: Math.round((Math.random() * 15 + 8) * 10) / 10, // 8-23% margin
      tax_efficiency: Math.round(Math.random() * 15 + 75), // 75-90% efficiency
      automation_score: Math.round(Math.random() * 25 + 60) // 60-85% automation
    }
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