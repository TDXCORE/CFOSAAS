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
  Download,
  RefreshCw
} from 'lucide-react';
import { realDashboardService, RealDashboardMetrics } from '~/lib/dashboard/real-dashboard-service';
import { useCurrentCompany } from '~/lib/companies/tenant-context';

interface FinancialDashboardProps {
  className?: string;
}

export function FinancialDashboard({ className }: FinancialDashboardProps) {
  const currentCompany = useCurrentCompany();
  const [metrics, setMetrics] = useState<RealDashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load real dashboard metrics
  const loadDashboardData = async () => {
    if (!currentCompany?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Loading real dashboard data for company:', currentCompany.id);
      
      const realMetrics = await realDashboardService.getDashboardMetrics(currentCompany.id);
      setMetrics(realMetrics);
      console.log('✅ Real dashboard data loaded successfully');
    } catch (err) {
      console.error('❌ Error loading dashboard data:', err);
      setError('Error loading dashboard data');
      // Fallback to empty metrics
      setMetrics(getEmptyMetrics());
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when company changes
  useEffect(() => {
    loadDashboardData();
  }, [currentCompany?.id]);

  const refreshData = async () => {
    await loadDashboardData();
  };

  // Fallback empty metrics
  const getEmptyMetrics = (): RealDashboardMetrics => ({
    overview: {
      totalInvoices: 0,
      totalAmount: 0,
      pendingReview: 0,
      processedThisMonth: 0,
    },
    financial: {
      revenue: {
        current: 0,
        previous: 0,
        growth: 0,
      },
      taxes: {
        iva: 0,
        retentions: 0,
        ica: 0,
        total: 0,
      },
      cashFlow: {
        inflow: 0,
        outflow: 0,
        net: 0,
        projection: 0,
      },
    },
    suppliers: {
      total: 0,
      active: 0,
      top5: [],
    },
    alerts: [],
    kpis: {
      automationRate: 0,
      classificationAccuracy: 0,
      processingTime: 0,
      taxBurden: 0,
      avgInvoiceValue: 0,
    },
    activityData: {
      weeklyProcessing: [],
      monthlyTrend: [],
    },
  });

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

  // Loading state
  if (isLoading || !metrics) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-center p-12">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span>Cargando métricas financieras...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}. <button onClick={refreshData} className="underline">Intentar nuevamente</button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No company selected
  if (!currentCompany) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Selecciona una Empresa</h3>
              <p className="text-muted-foreground">
                Para ver el dashboard financiero, selecciona una empresa en el menú superior.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        {metrics.alerts.map((alert, index) => (
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
                  {formatCurrency(metrics.financial.revenue.current)}
                </p>
                <div className="flex items-center text-sm">
                  {metrics.financial.revenue.growth >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                  )}
                  <span className={metrics.financial.revenue.growth >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatPercentage(metrics.financial.revenue.growth)}
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
                  {metrics.overview.totalInvoices.toLocaleString('es-CO')}
                </p>
                <div className="flex items-center text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-500">
                    {metrics.overview.processedThisMonth} este mes
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
                  {formatPercentage(metrics.kpis.automationRate)}
                </p>
                <Progress value={metrics.kpis.automationRate} className="w-full mt-2" />
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
                  {formatPercentage(metrics.kpis.taxBurden)}
                </p>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(metrics.financial.taxes.total)} en impuestos
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
                <span className="font-semibold">{formatCurrency(metrics.financial.revenue.current)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Mes anterior</span>
                <span className="font-semibold">{formatCurrency(metrics.financial.revenue.previous)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Crecimiento</span>
                <span className={`font-semibold ${metrics.financial.revenue.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.financial.revenue.growth >= 0 ? '+' : ''}{formatPercentage(metrics.financial.revenue.growth)}
                </span>
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
                <span className="font-semibold">{formatCurrency(metrics.financial.taxes.iva)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Retenciones</span>
                <span className="font-semibold">{formatCurrency(metrics.financial.taxes.retentions)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">ICA</span>
                <span className="font-semibold">{formatCurrency(metrics.financial.taxes.ica)}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="font-bold">{formatCurrency(metrics.financial.taxes.total)}</span>
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
                <div className={`font-semibold ${metrics.financial.cashFlow.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(metrics.financial.cashFlow.net)}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Promedio por Factura</span>
              <span className="font-semibold">
                {formatCurrency(metrics.kpis.avgInvoiceValue)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Crecimiento Mensual</span>
              <Badge variant={metrics.financial.revenue.growth >= 0 ? "default" : "destructive"}>
                {formatPercentage(metrics.financial.revenue.growth)}
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
                  {formatPercentage(metrics.kpis.classificationAccuracy)}
                </span>
              </div>
              <Progress value={metrics.kpis.classificationAccuracy} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Tasa de Automatización</span>
                <span className="font-semibold">
                  {formatPercentage(metrics.kpis.automationRate)}
                </span>
              </div>
              <Progress value={metrics.kpis.automationRate} />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Tiempo Promedio</span>
              <span className="font-semibold">
                {(metrics.kpis.processingTime / 1000).toFixed(1)}s
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
              {metrics.suppliers.top5.map((supplier, index) => (
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
            {metrics.activityData.weeklyProcessing.map((week, index) => (
              <div key={week.week} className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">{week.count}</div>
                <div className="text-sm text-muted-foreground">{week.week}</div>
              </div>
            ))}
            {/* Fill remaining weeks if less than 4 */}
            {Array.from({ length: Math.max(0, 4 - metrics.activityData.weeklyProcessing.length) }).map((_, index) => (
              <div key={`empty-${index}`} className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">0</div>
                <div className="text-sm text-muted-foreground">Sem {index + metrics.activityData.weeklyProcessing.length + 1}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between text-sm text-muted-foreground">
            <span>Total procesadas: {metrics.overview.totalInvoices.toLocaleString('es-CO')}</span>
            <span>Pendientes: {metrics.overview.pendingReview}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}