/**
 * Invoice Detail View Component
 * Displays complete invoice information including line items and taxes
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Separator } from '@kit/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import {
  ArrowLeft,
  FileText,
  Building,
  Calendar,
  DollarSign,
  User,
  Hash,
  Download,
  Edit,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Tag,
  Receipt,
  Calculator,
} from 'lucide-react';
import { invoiceListService } from '~/lib/invoices/invoice-list-service';
import type { Invoice } from '~/lib/invoices/types';
import { RetentionDetailComponent } from './retention-detail';
import { toast } from 'sonner';

interface InvoiceDetailViewProps {
  invoiceId: string;
  companyId: string;
  onBack: () => void;
  onEdit?: (invoice: Invoice) => void;
  className?: string;
}

export function InvoiceDetailView({
  invoiceId,
  companyId,
  onBack,
  onEdit,
  className
}: InvoiceDetailViewProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculatingRetentions, setRecalculatingRetentions] = useState(false);

  // Load invoice details
  useEffect(() => {
    const loadInvoiceDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const invoiceDetails = await invoiceListService.getInvoiceDetails(invoiceId, companyId);
        
        if (!invoiceDetails) {
          setError('Factura no encontrada');
          return;
        }
        
        setInvoice(invoiceDetails);
      } catch (err) {
        console.error('Error loading invoice details:', err);
        setError('Error cargando los detalles de la factura');
        toast.error('Error cargando los detalles de la factura');
      } finally {
        setLoading(false);
      }
    };

    loadInvoiceDetails();
  }, [invoiceId, companyId]);

  // Recalculate retentions
  const handleRecalculateRetentions = async () => {
    if (!invoice) {
      console.log('❌ No invoice available for recalculation');
      return;
    }

    // Debug: Show IDs
    console.log('🔍 Starting recalculation for:', {
      invoiceId: invoice.id,
      companyId: companyId,
      invoiceNumber: invoice.invoice_number,
      amount: invoice.total_amount
    });

    try {
      setRecalculatingRetentions(true);
      console.log('🚀 Calling recalculate API...');

      // Call the simplified recalculate API
      const response = await fetch('/api/simple-recalculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          companyId: companyId,
        }),
      });

      const result = await response.json();
      console.log('📊 API Response:', result);

      if (response.ok) {
        toast.success('Retenciones recalculadas exitosamente');
        console.log('✅ Recalculation successful, reloading invoice details...');

        // Reload the invoice details to show updated retentions
        const updatedInvoice = await invoiceListService.getInvoiceDetails(invoiceId, companyId);
        if (updatedInvoice) {
          setInvoice(updatedInvoice);
          console.log('🔄 Invoice details reloaded');
        }
      } else {
        console.error('❌ API error:', result);
        toast.error(result.message || 'Error recalculando retenciones');
      }
    } catch (error) {
      console.error('Error recalculating retentions:', error);
      toast.error('Error recalculando retenciones');
    } finally {
      setRecalculatingRetentions(false);
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

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get status badge
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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center space-x-2">
          <FileText className="h-6 w-6 animate-pulse" />
          <span>Cargando detalles de la factura...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !invoice) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Factura no encontrada'}
          <Button variant="link" onClick={onBack} className="ml-2 p-0">
            Volver a la lista
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Factura {invoice.invoice_number}</h1>
            <p className="text-muted-foreground">
              {invoice.supplier_name} • {formatDate(invoice.issue_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(invoice)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculateRetentions}
            disabled={recalculatingRetentions}
          >
            <Calculator className={`h-4 w-4 mr-2 ${recalculatingRetentions ? 'animate-spin' : ''}`} />
            {recalculatingRetentions ? 'Recalculando...' : 'Recalcular Retenciones'}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </Button>
        </div>
      </div>

      {/* Status and Alerts */}
      <div className="flex items-center space-x-4">
        {getStatusBadge(invoice.status)}
        {invoice.manual_review_required && (
          <Badge variant="outline" className="border-yellow-300 text-yellow-700">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Requiere Revisión
          </Badge>
        )}
        {invoice.puc_code && (
          <Badge variant="outline" className="border-blue-300 text-blue-700">
            <Tag className="h-3 w-3 mr-1" />
            PUC: {invoice.puc_code}
          </Badge>
        )}
      </div>

      {/* Main Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Información de la Factura</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                    <Hash className="h-4 w-4" />
                    <span>Número de Factura</span>
                  </div>
                  <p className="font-medium">{invoice.invoice_number}</p>
                </div>

                <div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span>Fecha de Emisión</span>
                  </div>
                  <p className="font-medium">{formatDate(invoice.issue_date)}</p>
                </div>

                {invoice.due_date && (
                  <div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                      <Clock className="h-4 w-4" />
                      <span>Fecha de Vencimiento</span>
                    </div>
                    <p className="font-medium">{formatDate(invoice.due_date)}</p>
                  </div>
                )}

                <div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                    <FileText className="h-4 w-4" />
                    <span>Tipo de Documento</span>
                  </div>
                  <p className="font-medium capitalize">{invoice.document_type}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>Información del Proveedor</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                    <User className="h-4 w-4" />
                    <span>Nombre del Proveedor</span>
                  </div>
                  <p className="font-medium">{invoice.supplier_name}</p>
                </div>

                <div>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                    <Hash className="h-4 w-4" />
                    <span>NIT/Cédula</span>
                  </div>
                  <p className="font-medium">{invoice.supplier_tax_id}</p>
                </div>

                {invoice.supplier_email && (
                  <div className="md:col-span-2">
                    <div className="text-sm text-muted-foreground mb-1">Email</div>
                    <p className="font-medium">{invoice.supplier_email}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Receipt className="h-5 w-5" />
                  <span>Productos/Servicios</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio Unit.</TableHead>
                      <TableHead className="text-right">Descuento</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.line_items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.product_name}</div>
                            {item.product_description && (
                              <div className="text-sm text-muted-foreground">
                                {item.product_description}
                              </div>
                            )}
                            {item.puc_code && (
                              <div className="text-xs text-blue-600 mt-1">
                                PUC: {item.puc_code}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">
                          {item.discount_percentage > 0 ? `${item.discount_percentage}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.line_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Retention Details Section */}
          <RetentionDetailComponent
            invoice={invoice}
            companyId={companyId}
          />
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          {/* Amount Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calculator className="h-5 w-5" />
                <span>Resumen de Montos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>

              {invoice.total_tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impuestos:</span>
                  <span className="font-medium">{formatCurrency(invoice.total_tax)}</span>
                </div>
              )}

              {invoice.total_retention > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Retenciones:</span>
                  <span className="font-medium text-red-600">-{formatCurrency(invoice.total_retention)}</span>
                </div>
              )}

              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(invoice.total_amount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Tax Details */}
          {invoice.taxes && invoice.taxes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Desglose de Impuestos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoice.taxes.map((tax) => (
                    <div key={tax.id} className="flex justify-between text-sm">
                      <div>
                        <div className="font-medium">{tax.tax_type}</div>
                        <div className="text-muted-foreground">
                          {tax.tax_rate}% sobre {formatCurrency(tax.taxable_base)}
                        </div>
                      </div>
                      <div className="text-right font-medium">
                        {formatCurrency(tax.tax_amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* PUC Classification */}
          {invoice.puc_code && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center space-x-2">
                  <Tag className="h-4 w-4" />
                  <span>Clasificación PUC</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <div className="font-medium">{invoice.puc_code}</div>
                    <div className="text-sm text-muted-foreground">{invoice.puc_name}</div>
                  </div>
                  {invoice.account_classification_confidence && (
                    <div className="text-xs text-muted-foreground">
                      Confianza: {(invoice.account_classification_confidence * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información de Procesamiento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado:</span>
                <span>{getStatusBadge(invoice.status)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Procesado:</span>
                <span>{formatDate(invoice.created_at)}</span>
              </div>

              {invoice.source_file_type && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo de archivo:</span>
                  <span className="uppercase">{invoice.source_file_type}</span>
                </div>
              )}

              {invoice.source_file_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Archivo fuente:</span>
                  <span className="font-mono text-xs truncate max-w-24" title={invoice.source_file_name}>
                    {invoice.source_file_name}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}