/**
 * Colombian KPI Summary Component
 * Displays key performance indicators specific to Colombian business environment
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Badge } from '@kit/ui/badge';
import { Progress } from '@kit/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Calculator, 
  Clock, 
  Users,
  Target,
  Award,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import type { ColombianKPIs } from '~/lib/analytics/dashboard-service';

interface ColombianKPISummaryProps {
  kpis: ColombianKPIs;
  className?: string;
}

export function ColombianKPISummary({ kpis, className }: ColombianKPISummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number, decimals = 1) => {
    return `${value.toFixed(decimals)}%`;
  };

  const getPerformanceLevel = (score: number) => {
    if (score >= 90) return { label: 'Excelente', variant: 'default', color: 'text-green-600' };
    if (score >= 75) return { label: 'Bueno', variant: 'secondary', color: 'text-blue-600' };
    if (score >= 60) return { label: 'Regular', variant: 'outline', color: 'text-yellow-600' };
    return { label: 'Necesita Mejora', variant: 'destructive', color: 'text-red-600' };
  };

  const getTaxEfficiencyStatus = (rate: number, type: 'iva' | 'retention' | 'ica') => {
    const benchmarks = {
      iva: { good: 19, warning: 22 }, // Expected IVA rate in Colombia
      retention: { good: 3.5, warning: 6 }, // Typical retention rates
      ica: { good: 0.5, warning: 1.5 }, // ICA varies by municipality
    };

    const benchmark = benchmarks[type];
    if (rate <= benchmark.good) return 'optimal';
    if (rate <= benchmark.warning) return 'acceptable';
    return 'high';
  };

  const automationPerf = getPerformanceLevel(kpis.automationRate);
  const accuracyPerf = getPerformanceLevel(kpis.classificationAccuracy);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Colombian Tax Efficiency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>Eficiencia Tributaria Colombia</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* IVA Analysis */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">IVA Efectivo</span>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{formatPercentage(kpis.ivaRate)}</span>
                  {getTaxEfficiencyStatus(kpis.ivaRate, 'iva') === 'optimal' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </div>
              <Progress value={Math.min(kpis.ivaRate, 25)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Esperado: 19% • Colombia estándar
              </p>
            </div>

            {/* Retention Analysis */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Retención en la Fuente</span>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{formatPercentage(kpis.retentionRate)}</span>
                  {getTaxEfficiencyStatus(kpis.retentionRate, 'retention') === 'optimal' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </div>
              <Progress value={Math.min(kpis.retentionRate * 2, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Rango típico: 2-6% • Según tipo de servicio
              </p>
            </div>

            {/* ICA Analysis */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">ICA Municipal</span>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{formatPercentage(kpis.icaRate)}</span>
                  {getTaxEfficiencyStatus(kpis.icaRate, 'ica') === 'optimal' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </div>
              <Progress value={Math.min(kpis.icaRate * 20, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Varía por municipio • 0.2-1.5% típico
              </p>
            </div>
          </div>

          {/* Overall Tax Burden */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Carga Tributaria Total</span>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold">{formatPercentage(kpis.taxBurden)}</span>
                {kpis.taxBurden <= 25 ? (
                  <Badge variant="default">Óptima</Badge>
                ) : kpis.taxBurden <= 35 ? (
                  <Badge variant="secondary">Aceptable</Badge>
                ) : (
                  <Badge variant="destructive">Alta</Badge>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Porcentaje de ingresos destinado a impuestos y retenciones
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Operational Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Rendimiento Operacional</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Automatización</span>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{formatPercentage(kpis.automationRate)}</span>
                  <Badge variant={automationPerf.variant as any}>
                    {automationPerf.label}
                  </Badge>
                </div>
              </div>
              <Progress value={kpis.automationRate} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1">
                Meta: >85% para eficiencia óptima
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Precisión PUC</span>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{formatPercentage(kpis.classificationAccuracy)}</span>
                  <Badge variant={accuracyPerf.variant as any}>
                    {accuracyPerf.label}
                  </Badge>
                </div>
              </div>
              <Progress value={kpis.classificationAccuracy} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1">
                Clasificación automática Plan Único de Cuentas
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tiempo Promedio</span>
              <div className="text-right">
                <div className="font-semibold">
                  {(kpis.processingTime / 1000).toFixed(1)}s
                </div>
                <div className="text-xs text-muted-foreground">
                  por factura
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Gestión de Proveedores</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Proveedores Activos</span>
              <span className="font-semibold">{kpis.supplierCount}</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Concentración Top 1</span>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{formatPercentage(kpis.supplierConcentration)}</span>
                  {kpis.supplierConcentration > 50 ? (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
              <Progress value={kpis.supplierConcentration} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.supplierConcentration > 50 
                  ? "Alta concentración - considere diversificar" 
                  : "Buena diversificación de proveedores"
                }
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Términos Promedio</span>
              <span className="font-semibold">{kpis.avgPaymentTerms} días</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance & Benchmarks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Cumplimiento DIAN</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Presentación a Tiempo</span>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{formatPercentage(kpis.onTimeFilingRate)}</span>
                  {kpis.onTimeFilingRate >= 95 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
              </div>
              <Progress value={kpis.onTimeFilingRate} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Score de Cumplimiento</span>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{kpis.taxComplianceScore}/100</span>
                  <Badge variant={kpis.taxComplianceScore >= 85 ? "default" : "secondary"}>
                    {kpis.taxComplianceScore >= 85 ? "Excelente" : "Bueno"}
                  </Badge>
                </div>
              </div>
              <Progress value={kpis.taxComplianceScore} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5" />
              <span>Benchmarks Sectoriales</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Ingresos vs Sector</span>
              <div className="text-right">
                <div className="font-semibold">
                  {formatCurrency(kpis.monthlyRevenue)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Sector: {formatCurrency(kpis.sectorAvgRevenue)}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Posición Competitiva</span>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">Top {100 - kpis.competitivePosition}%</span>
                  {kpis.competitivePosition >= 75 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-amber-500" />
                  )}
                </div>
              </div>
              <Progress value={kpis.competitivePosition} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Percentil en el sector colombiano
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Margen Sectorial</span>
              <span className="font-semibold">{formatPercentage(kpis.sectorAvgMargin)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}