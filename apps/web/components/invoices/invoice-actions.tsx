/**
 * Invoice Actions Component
 * Handles invoice management actions like export, edit, delete
 */

'use client';

import { useState } from 'react';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Alert, AlertDescription } from '@kit/ui/alert';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Archive,
  Settings,
} from 'lucide-react';
import { invoiceListService } from '~/lib/invoices/invoice-list-service';
import type { Invoice } from '~/lib/invoices/types';
import { toast } from 'sonner';
import { PUCEditorSimple } from './puc-editor-simple';

interface InvoiceActionsProps {
  invoice: Invoice;
  companyId: string;
  onInvoiceUpdated?: () => void;
  onInvoiceDeleted?: () => void;
  className?: string;
}

export function InvoiceActions({
  invoice,
  companyId,
  onInvoiceUpdated,
  onInvoiceDeleted,
  className
}: InvoiceActionsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showPUCEditor, setShowPUCEditor] = useState(false);
  const [newStatus, setNewStatus] = useState(invoice.status);

  // Export invoice data
  const handleExport = async (format: 'json' | 'csv' | 'excel') => {
    try {
      setIsExporting(true);
      
      // Get full invoice details
      const invoiceDetails = await invoiceListService.getInvoiceDetails(invoice.id, companyId);
      
      if (!invoiceDetails) {
        toast.error('Error obteniendo detalles de la factura');
        return;
      }

      let exportData: string;
      let filename: string;
      let contentType: string;

      switch (format) {
        case 'json':
          exportData = JSON.stringify(invoiceDetails, null, 2);
          filename = `factura-${invoice.invoice_number}-${new Date().toISOString().split('T')[0]}.json`;
          contentType = 'application/json';
          break;

        case 'csv':
          // Convert to CSV format
          const csvHeaders = [
            'Número de Factura',
            'Proveedor',
            'NIT Proveedor', 
            'Fecha Emisión',
            'Subtotal',
            'Impuestos',
            'Retenciones',
            'Total',
            'Estado',
            'Código PUC',
            'Nombre PUC'
          ];

          const csvRow = [
            invoiceDetails.invoice_number,
            invoiceDetails.supplier_name,
            invoiceDetails.supplier_tax_id,
            invoiceDetails.issue_date,
            invoiceDetails.subtotal.toString(),
            invoiceDetails.total_tax.toString(),
            invoiceDetails.total_retention.toString(),
            invoiceDetails.total_amount.toString(),
            invoiceDetails.status,
            invoiceDetails.puc_code || '',
            invoiceDetails.puc_name || ''
          ];

          exportData = [csvHeaders.join(','), csvRow.join(',')].join('\n');
          filename = `factura-${invoice.invoice_number}-${new Date().toISOString().split('T')[0]}.csv`;
          contentType = 'text/csv';
          break;

        case 'excel':
          // For Excel, we'll use CSV format with Excel-friendly encoding
          const excelHeaders = [
            'Número de Factura',
            'Proveedor',
            'NIT Proveedor',
            'Fecha Emisión',
            'Subtotal',
            'Impuestos',
            'Retenciones',
            'Total',
            'Estado',
            'Código PUC',
            'Nombre PUC'
          ];

          const excelRow = [
            invoiceDetails.invoice_number,
            invoiceDetails.supplier_name,
            invoiceDetails.supplier_tax_id,
            invoiceDetails.issue_date,
            invoiceDetails.subtotal.toString(),
            invoiceDetails.total_tax.toString(),
            invoiceDetails.total_retention.toString(),
            invoiceDetails.total_amount.toString(),
            invoiceDetails.status,
            invoiceDetails.puc_code || '',
            invoiceDetails.puc_name || ''
          ];

          exportData = '\uFEFF' + [excelHeaders.join('\t'), excelRow.join('\t')].join('\n');
          filename = `factura-${invoice.invoice_number}-${new Date().toISOString().split('T')[0]}.xls`;
          contentType = 'application/vnd.ms-excel';
          break;

        default:
          throw new Error('Formato no soportado');
      }

      // Create and download file
      const blob = new Blob([exportData], { type: contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Factura exportada como ${format.toUpperCase()}`);
      setShowExportDialog(false);
      
    } catch (error) {
      console.error('Error exporting invoice:', error);
      toast.error('Error exportando la factura');
    } finally {
      setIsExporting(false);
    }
  };

  // Delete invoice
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      const success = await invoiceListService.deleteInvoice(invoice.id, companyId);
      
      if (success) {
        toast.success('Factura eliminada exitosamente');
        setShowDeleteDialog(false);
        onInvoiceDeleted?.();
      } else {
        toast.error('Error eliminando la factura');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Error eliminando la factura');
    } finally {
      setIsDeleting(false);
    }
  };

  // Update status
  const handleStatusUpdate = async () => {
    try {
      const success = await invoiceListService.updateInvoiceStatus(
        invoice.id,
        companyId,
        newStatus
      );
      
      if (success) {
        toast.success('Estado actualizado exitosamente');
        setShowStatusDialog(false);
        onInvoiceUpdated?.();
      } else {
        toast.error('Error actualizando el estado');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error actualizando el estado');
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Export Actions */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar Factura</DialogTitle>
            <DialogDescription>
              Selecciona el formato en el que deseas exportar la factura {invoice.invoice_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-4 py-4">
            <Button
              variant="outline"
              onClick={() => handleExport('json')}
              disabled={isExporting}
              className="justify-start h-12"
            >
              <FileText className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">JSON</div>
                <div className="text-sm text-muted-foreground">Datos completos en formato JSON</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="justify-start h-12"
            >
              <FileSpreadsheet className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">CSV</div>
                <div className="text-sm text-muted-foreground">Compatible con Excel y hojas de cálculo</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleExport('excel')}
              disabled={isExporting}
              className="justify-start h-12"
            >
              <Archive className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Excel</div>
                <div className="text-sm text-muted-foreground">Archivo Excel nativo (.xls)</div>
              </div>
            </Button>
          </div>

          {isExporting && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Exportando...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PUC Editor Button */}
      <Button variant="outline" size="sm" onClick={() => setShowPUCEditor(true)}>
        <Settings className="h-4 w-4 mr-2" />
        Modificar PUC
      </Button>

      {/* Status Update */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Estado
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Estado</DialogTitle>
            <DialogDescription>
              Cambiar el estado de la factura {invoice.invoice_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-4 py-4">
            <div>
              <Label htmlFor="status">Nuevo Estado</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="validated">Validado</SelectItem>
                  <SelectItem value="review">Requiere Revisión</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleStatusUpdate} disabled={newStatus === invoice.status}>
              Actualizar Estado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Action */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Confirmar Eliminación</span>
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar la factura <strong>{invoice.invoice_number}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              La factura será marcada como eliminada pero se conservará en el sistema para auditoría.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Factura
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PUC Editor Component */}
      <PUCEditorSimple
        invoice={invoice}
        companyId={companyId}
        isOpen={showPUCEditor}
        onClose={() => setShowPUCEditor(false)}
        onPUCUpdated={onInvoiceUpdated || (() => {})}
      />
    </div>
  );
}

interface BulkInvoiceActionsProps {
  selectedInvoices: Invoice[];
  companyId: string;
  onBulkAction: () => void;
  className?: string;
}

export function BulkInvoiceActions({
  selectedInvoices,
  companyId,
  onBulkAction,
  className
}: BulkInvoiceActionsProps) {
  const [isExporting, setIsExporting] = useState(false);

  // Bulk export
  const handleBulkExport = async (format: 'csv' | 'excel') => {
    try {
      setIsExporting(true);
      
      // Get details for all selected invoices
      const invoiceDetails = await Promise.all(
        selectedInvoices.map(invoice => 
          invoiceListService.getInvoiceDetails(invoice.id, companyId)
        )
      );

      const validInvoices = invoiceDetails.filter(Boolean);
      
      if (validInvoices.length === 0) {
        toast.error('No se pudieron exportar las facturas seleccionadas');
        return;
      }

      // Create CSV data
      const csvHeaders = [
        'Número de Factura',
        'Proveedor',
        'NIT Proveedor',
        'Fecha Emisión',
        'Subtotal',
        'Impuestos',
        'Retenciones',
        'Total',
        'Estado',
        'Código PUC',
        'Nombre PUC'
      ];

      const csvRows = validInvoices.map(invoice => [
        invoice!.invoice_number,
        invoice!.supplier_name,
        invoice!.supplier_tax_id,
        invoice!.issue_date,
        invoice!.subtotal.toString(),
        invoice!.total_tax.toString(),
        invoice!.total_retention.toString(),
        invoice!.total_amount.toString(),
        invoice!.status,
        invoice!.puc_code || '',
        invoice!.puc_name || ''
      ]);

      let exportData: string;
      let filename: string;
      let contentType: string;

      if (format === 'excel') {
        exportData = '\uFEFF' + [csvHeaders.join('\t'), ...csvRows.map(row => row.join('\t'))].join('\n');
        filename = `facturas-${new Date().toISOString().split('T')[0]}.xls`;
        contentType = 'application/vnd.ms-excel';
      } else {
        exportData = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
        filename = `facturas-${new Date().toISOString().split('T')[0]}.csv`;
        contentType = 'text/csv';
      }

      // Download file
      const blob = new Blob([exportData], { type: contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${validInvoices.length} facturas exportadas`);
      onBulkAction();
      
    } catch (error) {
      console.error('Error in bulk export:', error);
      toast.error('Error exportando las facturas');
    } finally {
      setIsExporting(false);
    }
  };

  if (selectedInvoices.length === 0) {
    return null;
  }

  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle className="text-base">
          Acciones para {selectedInvoices.length} facturas seleccionadas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkExport('csv')}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkExport('excel')}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Archive className="h-4 w-4 mr-2" />
            )}
            Exportar Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}