/**
 * PUC Editor Component
 * Allows users to modify the automatically assigned PUC code for invoices
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Loader2, Search, Info } from 'lucide-react';
import { pucClassifier, type PUCAccount } from '~/lib/puc/puc-classifier';
import { invoiceListService } from '~/lib/invoices/invoice-list-service';
import type { Invoice } from '~/lib/invoices/types';
import { toast } from 'sonner';

interface PUCEditorProps {
  invoice: Invoice;
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  onPUCUpdated: () => void;
}

export function PUCEditor({
  invoice,
  companyId,
  isOpen,
  onClose,
  onPUCUpdated,
}: PUCEditorProps) {
  const [pucAccounts, setPucAccounts] = useState<PUCAccount[]>([]);
  const [selectedPUC, setSelectedPUC] = useState(invoice.puc_code || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // Load PUC accounts on component mount
  useEffect(() => {
    const loadPUCAccounts = async () => {
      setIsLoading(true);
      setLoadingError(null);
      
      try {
        const result = await pucClassifier.getAllPUCAccounts();
        if (result.error) {
          setLoadingError(result.error);
        } else if (result.data) {
          setPucAccounts(result.data.filter(account => account.is_active));
        }
      } catch (error) {
        setLoadingError('Error cargando cuentas PUC');
        console.error('Error loading PUC accounts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadPUCAccounts();
      setSelectedPUC(invoice.puc_code || '');
      setSearchTerm('');
    }
  }, [isOpen, invoice.puc_code]);

  // Filter PUC accounts based on search term
  const filteredPUCAccounts = pucAccounts.filter(account => 
    account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.keywords?.some(keyword => 
      keyword.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Get selected PUC account details
  const selectedAccount = pucAccounts.find(account => account.code === selectedPUC);

  // Handle PUC update
  const handleSave = async () => {
    if (!selectedPUC || !selectedAccount) {
      toast.error('Debe seleccionar una cuenta PUC');
      return;
    }

    setIsSaving(true);
    
    try {
      const success = await invoiceListService.updateInvoicePUC(
        invoice.id,
        companyId,
        selectedAccount.code,
        selectedAccount.name
      );

      if (success) {
        toast.success('Cuenta PUC actualizada exitosamente');
        onPUCUpdated();
        onClose();
      } else {
        toast.error('Error actualizando la cuenta PUC');
      }
    } catch (error) {
      console.error('Error updating PUC:', error);
      toast.error('Error actualizando la cuenta PUC');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Modificar Cuenta PUC</span>
          </DialogTitle>
          <DialogDescription>
            Factura {invoice.invoice_number} - {invoice.supplier_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current PUC Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Cuenta actual:</strong> {invoice.puc_code} - {invoice.puc_name}
            </AlertDescription>
          </Alert>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Cargando cuentas PUC...</span>
            </div>
          )}

          {/* Error State */}
          {loadingError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-600">
                {loadingError}
              </AlertDescription>
            </Alert>
          )}

          {/* PUC Selection */}
          {!isLoading && !loadingError && (
            <>
              {/* Search Filter */}
              <div>
                <Label htmlFor="search">Buscar cuenta PUC</Label>
                <Input
                  id="search"
                  placeholder="Buscar por código, nombre o palabra clave..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* PUC Selector */}
              <div>
                <Label htmlFor="puc-select">Seleccionar nueva cuenta PUC</Label>
                <Select value={selectedPUC} onValueChange={setSelectedPUC}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecciona una cuenta PUC" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {filteredPUCAccounts.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No se encontraron cuentas PUC que coincidan con la búsqueda
                      </div>
                    ) : (
                      filteredPUCAccounts.map((account) => (
                        <SelectItem key={account.code} value={account.code}>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {account.code} - {account.name}
                            </span>
                            {account.description && (
                              <span className="text-xs text-muted-foreground">
                                {account.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Account Details */}
              {selectedAccount && (
                <div className="rounded-lg border p-4 bg-muted/30">
                  <h4 className="font-medium mb-2">Detalles de la cuenta seleccionada</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Código:</span> {selectedAccount.code}
                    </div>
                    <div>
                      <span className="font-medium">Tipo:</span> {selectedAccount.account_type}
                    </div>
                    <div>
                      <span className="font-medium">Naturaleza:</span> {selectedAccount.nature}
                    </div>
                    <div>
                      <span className="font-medium">Nivel:</span> {selectedAccount.level}
                    </div>
                    {selectedAccount.description && (
                      <div className="col-span-2">
                        <span className="font-medium">Descripción:</span> {selectedAccount.description}
                      </div>
                    )}
                    {selectedAccount.keywords && selectedAccount.keywords.length > 0 && (
                      <div className="col-span-2">
                        <span className="font-medium">Palabras clave:</span> {selectedAccount.keywords.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !selectedPUC || selectedPUC === invoice.puc_code}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Actualizar PUC'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}