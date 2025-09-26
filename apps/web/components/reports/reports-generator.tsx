/**
 * Reports Generator Component
 * Interface for generating and exporting various financial reports
 */

'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@kit/ui/select';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Checkbox } from '@kit/ui/checkbox';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  Users,
  Calculator,
  Loader2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { useCurrentCompany } from '~/lib/companies/tenant-context';
import { reportsService, type ReportTemplate } from '~/lib/reports/reports-service';
import type { InvoiceFilters, ExportOptions } from '~/lib/invoices/types';
import { toast } from 'sonner';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

interface ReportsGeneratorProps {
  className?: string;
}

export function ReportsGenerator({ className }: ReportsGeneratorProps) {
  const currentCompany = useCurrentCompany();
  const supabase = useSupabase();
  
  // Set authenticated supabase client on reports service
  reportsService.setSupabaseClient(supabase);
  
  
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [filters, setFilters] = useState<InvoiceFilters>({
    date_from: '2024-01-01',
    date_to: '2025-12-31',
  });
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'json'>('csv');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const reportTemplates = reportsService.getReportTemplates();

  const getTemplateIcon = (type: string) => {
    switch (type) {
      case 'financial': return <BarChart3 className="h-5 w-5" />;
      case 'tax': return <Calculator className="h-5 w-5" />;
      case 'operational': return <PieChart className="h-5 w-5" />;
      case 'compliance': return <CheckCircle className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'financial': return 'bg-blue-100 text-blue-800';
      case 'tax': return 'bg-green-100 text-green-800';
      case 'operational': return 'bg-purple-100 text-purple-800';
      case 'compliance': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const generateReport = useCallback(async () => {
    if (!selectedTemplate || !currentCompany) {
      toast.error('Selecciona un template de reporte primero');
      return;
    }

    setIsGenerating(true);
    
    try {
      let data: any[] = [];

      switch (selectedTemplate.id) {
        case 'detailed-invoices':
          data = await reportsService.generateDetailedInvoiceReport(currentCompany.id, filters);
          break;

        case 'tax-summary':
          data = await reportsService.generateTaxSummaryReport(
            currentCompany.id,
            filters.date_from || '',
            filters.date_to || ''
          );
          break;

        case 'supplier-analysis':
          data = await reportsService.generateSupplierReport(currentCompany.id, filters);
          break;

        case 'puc-classification':
          data = await reportsService.generatePUCClassificationReport(currentCompany.id, filters);
          break;

        default:
          throw new Error('Template de reporte no soportado');
      }

      setReportData(data);
      setCurrentPage(1); // Reset to first page when new data is generated

      toast.success(`Reporte generado: ${data.length} registros`);

    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Error al generar reporte: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTemplate, currentCompany, filters]);

  const exportReport = useCallback(async () => {
    if (!selectedTemplate || !reportData) {
      toast.error('Genera el reporte primero antes de exportar');
      return;
    }

    const exportOptions: ExportOptions = {
      format: exportFormat,
      filters,
      date_range: filters.date_from && filters.date_to ? {
        from: filters.date_from,
        to: filters.date_to,
      } : undefined,
    };

    const result = await reportsService.exportReport(reportData, selectedTemplate, exportOptions);

    if (result.success) {
      toast.success(`Reporte exportado como ${result.file_name}`);
    } else {
      toast.error('Error al exportar: ' + (result.error || 'No se pudo exportar el reporte'));
    }
  }, [selectedTemplate, reportData, exportFormat, filters]);

  // Pagination calculations
  const totalPages = reportData ? Math.ceil(reportData.length / itemsPerPage) : 0;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = reportData ? reportData.slice(startIndex, endIndex) : [];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const formatValue = (value: any, type: string) => {
    if (value === null || value === undefined) return 'N/A';

    switch (type) {
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
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generador de Reportes</h1>
          <p className="text-muted-foreground">
            Genera reportes detallados para {currentCompany?.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Selection */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Reporte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {reportTemplates.map(template => (
                <div
                  key={template.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTemplate?.id === template.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-1">
                      {getTemplateIcon(template.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium text-sm">{template.name}</h3>
                        <Badge className={`text-xs ${getTypeColor(template.type)}`}>
                          {template.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Filters */}
          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span>Filtros</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date_from">Desde</Label>
                    <Input
                      id="date_from"
                      type="date"
                      value={filters.date_from || ''}
                      onChange={e => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="date_to">Hasta</Label>
                    <Input
                      id="date_to"
                      type="date"
                      value={filters.date_to || ''}
                      onChange={e => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="supplier_filter">NIT Proveedor (opcional)</Label>
                  <Input
                    id="supplier_filter"
                    placeholder="Ej: 900123456"
                    value={filters.supplier_tax_id || ''}
                    onChange={e => setFilters(prev => ({ ...prev, supplier_tax_id: e.target.value }))}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="manual_review"
                    checked={filters.requires_review === true}
                    onCheckedChange={checked => 
                      setFilters(prev => ({ 
                        ...prev, 
                        requires_review: checked === true ? true : undefined 
                      }))
                    }
                  />
                  <Label htmlFor="manual_review">Solo revisión manual</Label>
                </div>

                <Button 
                  onClick={generateReport} 
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generar Reporte
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Report Preview/Export */}
        <div className="lg:col-span-2">
          {reportData && selectedTemplate ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{selectedTemplate.name}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Select value={exportFormat} onValueChange={setExportFormat}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={exportReport} size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {reportData.length} registros encontrados
                  </p>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Filas por página:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        {selectedTemplate.columns.map(column => (
                          <th key={column.key} className="text-left p-2 font-medium text-sm">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.map((row, index) => (
                        <tr key={startIndex + index} className="border-b hover:bg-muted/50">
                          {selectedTemplate.columns.map(column => (
                            <td key={column.key} className="p-2 text-sm">
                              {formatValue(row[column.key], column.type)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {startIndex + 1} a {Math.min(endIndex, reportData.length)} de {reportData.length} registros
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {/* Page Numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            className="w-8"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Selecciona un Reporte</h3>
                <p className="text-muted-foreground text-center">
                  Elige un template de reporte de la lista de la izquierda para comenzar
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}