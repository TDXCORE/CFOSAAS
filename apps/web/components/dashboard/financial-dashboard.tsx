/**
 * Financial Dashboard Component
 * Colombian CFO SaaS Platform - Main dashboard with KPIs and insights
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  Clock, 
  Users,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  PieChart,
  Calendar,
  Download
} from 'lucide-react';
import { dashboardService } from '~/lib/analytics/dashboard-service';
import { useCurrentCompany } from '~/lib/companies/tenant-context';

interface FinancialDashboardProps {
  className?: string;
}

export function FinancialDashboard({ className }: FinancialDashboardProps) {
  // Static mock data to eliminate all hydration issues
  const mockMetrics = {
    overview: {
      totalInvoices: 48,
      totalAmount: 250000000,
      pendingReview: 3,
      processedToday: 12,
    },
    financial: {
      revenue: {
        current: 180000000,
        previous: 165000000,
        growth: 9.1,
      },
      taxes: {
        iva: 34200000,
        retentions: 19800000,
        ica: 748000,
        total: 54748000,
      },
      cashFlow: {
        inflow: 180000000,
        outflow: 19800000,
        net: 160200000,
        projection: 176220000,
      },
    },
    suppliers: {
      total: 15,
      active: 12,
      top5: [
        { id: '1', name: 'Proveedor Principal S.A.S', amount: 45000000, percentage: 18.0 },
        { id: '2', name: 'Distribuciones Norte Ltda', amount: 32500000, percentage: 13.0 },
        { id: '3', name: 'Servicios Integrales', amount: 28750000, percentage: 11.5 },
        { id: '4', name: 'Tecnología Empresarial', amount: 22500000, percentage: 9.0 },
        { id: '5', name: 'Logística Express', amount: 18750000, percentage: 7.5 },
      ],
    },
    alerts: [
      {
        type: 'warning' as const,
        title: 'Retención Pendiente',
        message: 'Hay 3 facturas con retenciones pendientes de aplicar',
        priority: 2,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  const mockKPIs = {
    automationRate: 87.5,
    classificationAccuracy: 94.2,
    processingTime: 125000,
    taxBurden: 30.4,
    avgInvoiceValue: 5208333,
  };

  const refreshData = async () => {
    // Simple refresh simulation
    console.log('Refreshing dashboard data...');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number, decimals = 1) => {
    return `${value.toFixed(decimals)}%`;
  };

  // No loading states or hydration checks - direct render

  // Removed chart colors as we're not using complex charts anymore

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Financiero</h1>
          <p className="text-muted-foreground">
            Métricas y análisis financieros
          </p>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
          >
            <BarChart3 className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-2">
        {mockMetrics.alerts.map((alert, index) => (
          <Alert key={index} variant={alert.type === 'error' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{alert.title}:</strong> {alert.message}
            </AlertDescription>
          </Alert>
        ))}
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Ingresos del Mes
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(mockMetrics.financial.revenue.current)}
                </p>
                <div className="flex items-center text-sm">
                  {mockMetrics.financial.revenue.growth >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={mockMetrics.financial.revenue.growth >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatPercentage(mockMetrics.financial.revenue.growth)}
                  </span>
                  <span className="text-muted-foreground ml-1">vs mes anterior</span>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Facturas Procesadas
                </p>
                <p className="text-2xl font-bold">
                  {mockMetrics.overview.totalInvoices.toLocaleString('es-CO')}
                </p>
                <div className="flex items-center text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-500">
                    {mockMetrics.overview.processedToday} hoy
                  </span>
                </div>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Automatización
                </p>
                <p className="text-2xl font-bold">
                  {formatPercentage(mockKPIs.automationRate)}
                </p>
                <Progress value={mockKPIs.automationRate} className="w-full mt-2" />
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Carga Tributaria
                </p>
                <p className="text-2xl font-bold">
                  {formatPercentage(mockKPIs.taxBurden)}
                </p>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(mockMetrics.financial.taxes.total)} en impuestos
                </div>
              </div>
              <PieChart className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row - Simplified */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Ingresos</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Este mes</span>
                <span className="font-semibold">{formatCurrency(180000000)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Mes anterior</span>
                <span className="font-semibold">{formatCurrency(165000000)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Crecimiento</span>
                <span className="font-semibold text-green-600">+9.1%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Desglose de Impuestos</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">IVA</span>
                <span className="font-semibold">{formatCurrency(mockMetrics.financial.taxes.iva)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Retenciones</span>
                <span className="font-semibold">{formatCurrency(mockMetrics.financial.taxes.retentions)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">ICA</span>
                <span className="font-semibold">{formatCurrency(mockMetrics.financial.taxes.ica)}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="font-bold">{formatCurrency(mockMetrics.financial.taxes.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Health */}
        <Card>
          <CardHeader>
            <CardTitle>Salud Financiera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Flujo de Caja</span>
              <div className="text-right">
                <div className={`font-semibold ${mockMetrics.financial.cashFlow.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(mockMetrics.financial.cashFlow.net)}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Promedio por Factura</span>
              <span className="font-semibold">
                {formatCurrency(mockKPIs.avgInvoiceValue)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Crecimiento Mensual</span>
              <Badge variant={mockMetrics.financial.revenue.growth >= 0 ? "default" : "destructive"}>
                {formatPercentage(mockMetrics.financial.revenue.growth)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Operational Efficiency */}
        <Card>
          <CardHeader>
            <CardTitle>Eficiencia Operacional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Precisión de Clasificación</span>
                <span className="font-semibold">
                  {formatPercentage(mockKPIs.classificationAccuracy)}
                </span>
              </div>
              <Progress value={mockKPIs.classificationAccuracy} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Tasa de Automatización</span>
                <span className="font-semibold">
                  {formatPercentage(mockKPIs.automationRate)}
                </span>
              </div>
              <Progress value={mockKPIs.automationRate} />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Tiempo Promedio</span>
              <span className="font-semibold">
                {(mockKPIs.processingTime / 1000).toFixed(1)}s
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Top Suppliers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Proveedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockMetrics.suppliers.top5.map((supplier, index) => (
                <div key={supplier.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-sm truncate max-w-[120px]">
                        {supplier.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatPercentage(supplier.percentage)} del total
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">
                      {formatCurrency(supplier.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processing Activity - Simplified */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad de Procesamiento (Últimas 4 Semanas)</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">432</div>
              <div className="text-sm text-muted-foreground">Semana 1</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">398</div>
              <div className="text-sm text-muted-foreground">Semana 2</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">467</div>
              <div className="text-sm text-muted-foreground">Semana 3</div>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">523</div>
              <div className="text-sm text-muted-foreground">Esta semana</div>
            </div>
          </div>
          <div className="mt-4 flex justify-between text-sm text-muted-foreground">
            <span>Total procesadas: 1,820</span>
            <span>Errores: 23 (1.3%)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}