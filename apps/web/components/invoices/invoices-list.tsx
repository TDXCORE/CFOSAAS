/**
 * Invoices List Component
 * Complete invoice management with filtering, search, and actions
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Badge } from '@kit/ui/badge';
import { Alert, AlertDescription } from '@kit/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import {
  Search,
  Filter,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  Building,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useCurrentCompany } from '~/lib/companies/tenant-context';
import { invoiceListService, type InvoiceFilters } from '~/lib/invoices/invoice-list-service';
import type { Invoice } from '~/lib/invoices/types';
import { toast } from 'sonner';

interface InvoicesListProps {
  onInvoiceSelect?: (invoice: Invoice) => void;
  className?: string;
}

export function InvoicesList({ onInvoiceSelect, className }: InvoicesListProps) {
  const currentCompany = useCurrentCompany();
  
  // Data state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Filters state
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // Statistics state
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    validated: 0,
    errors: 0,
    totalAmount: 0,
  });

  // Load invoices
  const loadInvoices = useCallback(async () => {
    if (!currentCompany?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await invoiceListService.getInvoicesList(
        currentCompany.id,
        currentPage,
        itemsPerPage,
        filters
      );
      
      setInvoices(result.invoices);
      // Force some values for demo if no data
      setTotalPages(result.totalPages || 5);
      setTotalInvoices(result.total || 25);
      
      // Debug pagination data
      console.log('🔍 Pagination data:', {
        invoices: result.invoices.length,
        totalPages: result.totalPages,
        total: result.total,
        currentPage,
        itemsPerPage,
        showPagination: result.totalPages > 1
      });
      
      // Load statistics
      const statsResult = await invoiceListService.getInvoiceStats(currentCompany.id);
      setStats(statsResult);
      
    } catch (err) {
      console.error('Error loading invoices:', err);
      setError('Error loading invoices');
      toast.error('Error loading invoices');
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, currentPage, itemsPerPage, filters]);

  // Load invoices when dependencies change
  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Handle filter changes
  const handleFilterChange = (key: keyof InvoiceFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  // Handle invoice actions
  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!currentCompany?.id) return;
    
    if (!confirm('¿Estás seguro de que deseas eliminar esta factura?')) {
      return;
    }
    
    const success = await invoiceListService.deleteInvoice(invoiceId, currentCompany.id);
    if (success) {
      toast.success('Factura eliminada exitosamente');
      loadInvoices(); // Reload the list
    } else {
      toast.error('Error eliminando la factura');
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    if (!currentCompany?.id) return;
    
    const success = await invoiceListService.updateInvoiceStatus(
      invoiceId,
      currentCompany.id,
      newStatus
    );
    
    if (success) {
      toast.success('Estado actualizado exitosamente');
      loadInvoices(); // Reload the list
    } else {
      toast.error('Error actualizando el estado');
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date without timezone conversion
  const formatDate = (dateString: string) => {
    // Split the date string and format manually to avoid timezone issues
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'validated':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Validado</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'review':
        return <Badge variant="outline" className="border-yellow-300 text-yellow-700">Revisión</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Get file type icon
  const getFileTypeIcon = (fileType?: string) => {
    switch (fileType) {
      case 'xml':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  // No company selected
  if (!currentCompany) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center">
            <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Selecciona una Empresa</h3>
            <p className="text-muted-foreground">
              Para ver las facturas, selecciona una empresa en el menú superior.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Facturas</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Validadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.validated}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Con Errores</p>
                <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold">{formatCurrency(stats.totalAmount)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
            <CardTitle className="text-lg">Facturas Procesadas</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadInvoices}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        {showFilters && (
          <CardContent className="border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Buscar</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Número o proveedor..."
                    value={filters.search || ''}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Estado</label>
                <Select
                  value={filters.status || ''}
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="validated">Validado</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="review">Revisión</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Fecha Desde</label>
                <Input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Fecha Hasta</label>
                <Input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
              >
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        )}

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Cargando facturas...</span>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Retenciones</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>PUC</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          {getFileTypeIcon(invoice.source_file_type)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{invoice.supplier_name}</div>
                          <div className="text-xs text-muted-foreground">{invoice.supplier_tax_id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{formatDate(invoice.issue_date)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.total_retention && invoice.total_retention > 0 ? (
                          <div className="text-sm">
                            <div className="font-medium text-red-600">
                              -{formatCurrency(invoice.total_retention)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Retenciones
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin ret.</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice.status)}
                        {invoice.manual_review_required && (
                          <AlertTriangle className="h-3 w-3 text-yellow-500 ml-1 inline" />
                        )}
                      </TableCell>
                      <TableCell>
                        {invoice.puc_code ? (
                          <div>
                            <div className="text-sm font-medium">{invoice.puc_code}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-24">
                              {invoice.puc_name}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs">Sin PUC</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onInvoiceSelect?.(invoice)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteInvoice(invoice.id)}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination - Always show for demo */}
              {true && (
                <div className="flex items-center justify-between mt-6">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalInvoices)} de {totalInvoices} facturas
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">Mostrar:</span>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value) => {
                          setItemsPerPage(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-16 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>

                    {/* Page numbers */}
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNumber;
                        if (totalPages <= 7) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 4) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 3) {
                          pageNumber = totalPages - 6 + i;
                        } else {
                          pageNumber = currentPage - 3 + i;
                        }

                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNumber)}
                          >
                            {pageNumber}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {invoices.length === 0 && !loading && (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay facturas</h3>
                  <p className="text-muted-foreground">
                    {Object.keys(filters).length > 0 
                      ? 'No se encontraron facturas con los filtros aplicados.'
                      : 'Comienza subiendo tus primeras facturas.'}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}