/**
 * Dashboard Hook
 * Manages dashboard state, data fetching, and real-time updates
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { dashboardService, type DashboardMetrics, type ColombianKPIs } from '~/lib/analytics/dashboard-service';
import { useCurrentCompany } from '~/lib/companies/tenant-context';
import { toast } from 'sonner';

interface UseDashboardOptions {
  refreshInterval?: number; // in milliseconds
  autoRefresh?: boolean;
  onDataUpdate?: (metrics: DashboardMetrics, kpis: ColombianKPIs) => void;
  onError?: (error: Error) => void;
}

interface UseDashboardReturn {
  // Data
  metrics: DashboardMetrics | null;
  kpis: ColombianKPIs | null;
  
  // State
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  error: Error | null;
  
  // Actions
  refresh: () => Promise<void>;
  exportData: (format: 'json' | 'csv') => Promise<void>;
  
  // Real-time status
  isRealTimeEnabled: boolean;
  toggleRealTime: () => void;
}

const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useDashboard(options: UseDashboardOptions = {}): UseDashboardReturn {
  const {
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    autoRefresh = true,
    onDataUpdate,
    onError,
  } = options;

  const currentCompany = useCurrentCompany();
  
  // State
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [kpis, setKPIs] = useState<ColombianKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(autoRefresh);
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  /**
   * Load dashboard data
   */
  const loadData = useCallback(async (showRefreshingState = false) => {
    if (!currentCompany) return;

    try {
      if (showRefreshingState) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      setError(null);

      // Load data in parallel
      const [dashboardMetrics, colombianKPIs] = await Promise.all([
        dashboardService.getDashboardMetrics(currentCompany.id),
        dashboardService.getColombianKPIs(currentCompany.id),
      ]);

      if (!mountedRef.current) return;

      setMetrics(dashboardMetrics);
      setKPIs(colombianKPIs);
      setLastUpdated(new Date());

      // Trigger callback
      onDataUpdate?.(dashboardMetrics, colombianKPIs);

      // Show success message only for manual refresh
      if (showRefreshingState) {
        toast.success('Dashboard actualizado: Los datos se han actualizado correctamente');
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error desconocido');
      
      if (!mountedRef.current) return;
      
      setError(error);
      onError?.(error);

      console.error('Dashboard data loading error:', error);
      
      toast.error('Error al cargar dashboard: ' + error.message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [currentCompany, onDataUpdate, onError]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  /**
   * Setup auto refresh
   */
  const setupAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (isRealTimeEnabled && currentCompany) {
      intervalRef.current = setInterval(() => {
        loadData(false); // Silent refresh
      }, refreshInterval);
    }
  }, [isRealTimeEnabled, currentCompany, refreshInterval, loadData]);

  /**
   * Toggle real-time updates
   */
  const toggleRealTime = useCallback(() => {
    setIsRealTimeEnabled(prev => {
      const newValue = !prev;
      
      const message = newValue 
        ? `Actualizaciones automáticas activadas: Dashboard se actualizará cada ${refreshInterval / 60000} minutos`
        : 'Actualizaciones automáticas desactivadas: Deberás actualizar manualmente';
      toast.success(message);
      
      return newValue;
    });
  }, [refreshInterval]);

  /**
   * Export dashboard data
   */
  const exportData = useCallback(async (format: 'json' | 'csv') => {
    if (!metrics || !kpis || !currentCompany) {
      toast.error('No hay datos para exportar: Espera a que se carguen los datos del dashboard');
      return;
    }

    try {
      const exportData = {
        companyName: currentCompany.name,
        companyId: currentCompany.id,
        exportedAt: new Date().toISOString(),
        lastUpdated: lastUpdated?.toISOString(),
        metrics,
        kpis,
      };

      let content: string;
      let mimeType: string;
      let filename: string;

      if (format === 'json') {
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        filename = `dashboard-${currentCompany.name}-${new Date().toISOString().split('T')[0]}.json`;
      } else {
        // CSV format
        const csvRows = [
          ['Métrica', 'Valor', 'Unidad'],
          ['Ingresos del Mes', metrics.financial.revenue.current.toString(), 'COP'],
          ['Crecimiento', metrics.financial.revenue.growth.toString(), '%'],
          ['Total Facturas', metrics.overview.totalInvoices.toString(), 'cantidad'],
          ['Pendientes Revisión', metrics.overview.pendingReview.toString(), 'cantidad'],
          ['IVA Total', metrics.financial.taxes.iva.toString(), 'COP'],
          ['Retenciones', metrics.financial.taxes.retentions.toString(), 'COP'],
          ['ICA Total', metrics.financial.taxes.ica.toString(), 'COP'],
          ['Tasa Automatización', kpis.automationRate.toString(), '%'],
          ['Precisión Clasificación', kpis.classificationAccuracy.toString(), '%'],
          ['Tiempo Procesamiento', kpis.processingTime.toString(), 'ms'],
          ['Carga Tributaria', kpis.taxBurden.toString(), '%'],
        ];

        content = csvRows.map(row => row.join(',')).join('\n');
        mimeType = 'text/csv';
        filename = `dashboard-${currentCompany.name}-${new Date().toISOString().split('T')[0]}.csv`;
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exportación exitosa: Dashboard exportado como ${format.toUpperCase()}`);

    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error al exportar: No se pudo exportar el dashboard');
    }
  }, [metrics, kpis, currentCompany, lastUpdated]);

  // Load initial data when company changes
  useEffect(() => {
    if (currentCompany) {
      loadData();
    } else {
      setMetrics(null);
      setKPIs(null);
      setIsLoading(false);
    }
  }, [currentCompany, loadData]);

  // Setup auto refresh when enabled state changes
  useEffect(() => {
    setupAutoRefresh();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [setupAutoRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Handle page visibility change to pause/resume auto refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, pause auto refresh
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Page is visible again, resume auto refresh
        setupAutoRefresh();
        
        // Refresh data if it's been more than refresh interval since last update
        if (lastUpdated && isRealTimeEnabled) {
          const timeSinceUpdate = Date.now() - lastUpdated.getTime();
          if (timeSinceUpdate > refreshInterval) {
            loadData(false);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setupAutoRefresh, lastUpdated, refreshInterval, isRealTimeEnabled, loadData]);

  return {
    // Data
    metrics,
    kpis,
    
    // State
    isLoading,
    isRefreshing,
    lastUpdated,
    error,
    
    // Actions
    refresh,
    exportData,
    
    // Real-time
    isRealTimeEnabled,
    toggleRealTime,
  };
}