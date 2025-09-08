/**
 * Financial Dashboard Component
 * Colombian CFO SaaS Platform - Main dashboard with KPIs and insights
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Progress } from '@kit/ui/progress';
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
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { useCurrentCompany } from '~/lib/companies/tenant-context';
import { dashboardService, type DashboardMetrics, type ColombianKPIs } from '~/lib/analytics/dashboard-service';
import { useToast } from '@kit/ui/use-toast';

interface FinancialDashboardProps {
  className?: string;
}

export function FinancialDashboard({ className }: FinancialDashboardProps) {
  const { toast } = useToast();
  const currentCompany = useCurrentCompany();
  
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [kpis, setKPIs] = useState<ColombianKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // Load dashboard data
  useEffect(() => {
    if (currentCompany) {
      loadDashboardData();
    }
  }, [currentCompany]);

  const loadDashboardData = async () => {
    if (!currentCompany) return;

    try {
      setIsLoading(true);
      const [dashboardMetrics, colombianKPIs] = await Promise.all([
        dashboardService.getDashboardMetrics(currentCompany.id),
        dashboardService.getColombianKPIs(currentCompany.id),
      ]);

      setMetrics(dashboardMetrics);
      setKPIs(colombianKPIs);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las métricas del dashboard',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    
    toast({
      title: 'Dashboard Actualizado',
      description: 'Las métricas se han actualizado exitosamente',
    });
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

  if (isLoading || !metrics || !kpis) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const chartColors = {
    primary: '#0ea5e9',
    secondary: '#84cc16',
    accent: '#f59e0b',
    danger: '#ef4444',
    muted: '#64748b',
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Financiero</h1>
          <p className="text-muted-foreground">
            Métricas y análisis para {currentCompany?.name}
          </p>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
          >
            {refreshing ? (
              <Clock className="h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
            Actualizar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {metrics.alerts.length > 0 && (
        <div className="space-y-2">
          {metrics.alerts.slice(0, 3).map((alert, index) => (
            <Alert key={index} variant={alert.type === 'error' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{alert.title}:</strong> {alert.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

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
                    {metrics.overview.processedToday} hoy
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
                  {formatPercentage(kpis.automationRate)}
                </p>
                <Progress value={kpis.automationRate} className="w-full mt-2" />
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
                  {formatPercentage(kpis.taxBurden)}
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metrics.trends.monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Ingresos']}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke={chartColors.primary} 
                  fill={chartColors.primary}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tax Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Desglose de Impuestos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  dataKey="value"
                  data={[
                    { name: 'IVA', value: metrics.financial.taxes.iva, fill: chartColors.primary },
                    { name: 'Retenciones', value: metrics.financial.taxes.retentions, fill: chartColors.secondary },
                    { name: 'ICA', value: metrics.financial.taxes.ica, fill: chartColors.accent },
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </RechartsPieChart>
            </ResponsiveContainer>
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
                {formatCurrency(kpis.avgInvoiceValue)}
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
                  {formatPercentage(kpis.classificationAccuracy)}
                </span>
              </div>
              <Progress value={kpis.classificationAccuracy} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Tasa de Automatización</span>
                <span className="font-semibold">
                  {formatPercentage(kpis.automationRate)}
                </span>
              </div>
              <Progress value={kpis.automationRate} />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Tiempo Promedio</span>
              <span className="font-semibold">
                {(kpis.processingTime / 1000).toFixed(1)}s
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
              {metrics.suppliers.top5.slice(0, 5).map((supplier, index) => (
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

      {/* Processing Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad de Procesamiento (Últimas 4 Semanas)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={metrics.trends.weekly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar 
                dataKey="processed" 
                fill={chartColors.primary} 
                name="Procesadas"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="errors" 
                fill={chartColors.danger} 
                name="Errores"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}