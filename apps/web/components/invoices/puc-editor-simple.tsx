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
import { Label } from '@kit/ui/label';
import { Loader2 } from 'lucide-react';
import { invoiceListService } from '~/lib/invoices/invoice-list-service';
import { getSupabaseClient } from '~/lib/supabase/client-singleton';
import type { Invoice } from '~/lib/invoices/types';
import { toast } from 'sonner';

interface PUCEditorProps {
  invoice: Invoice;
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  onPUCUpdated: () => void;
}

interface SimplePUCAccount {
  code: string;
  name: string;
}

export function PUCEditorSimple({
  invoice,
  companyId,
  isOpen,
  onClose,
  onPUCUpdated,
}: PUCEditorProps) {
  const [pucAccounts, setPucAccounts] = useState<SimplePUCAccount[]>([]);
  const [selectedPUC, setSelectedPUC] = useState(invoice.puc_code || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const supabase = getSupabaseClient();

  // Load PUC accounts when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadPUCAccounts();
      setSelectedPUC(invoice.puc_code || '');
    }
  }, [isOpen, invoice.puc_code]);

  const loadPUCAccounts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('puc_accounts')
        .select('code, name')
        .eq('is_active', true)
        .order('code');

      if (error) {
        toast.error('Error cargando cuentas PUC');
        return;
      }

      setPucAccounts(data || []);
    } catch (error) {
      toast.error('Error cargando cuentas PUC');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPUC) {
      toast.error('Debe seleccionar una cuenta PUC');
      return;
    }

    const selectedAccount = pucAccounts.find(acc => acc.code === selectedPUC);
    if (!selectedAccount) {
      toast.error('Cuenta PUC no válida');
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
      toast.error('Error actualizando la cuenta PUC');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modificar Cuenta PUC</DialogTitle>
          <DialogDescription>
            Factura {invoice.invoice_number} - Actual: {invoice.puc_code} - {invoice.puc_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Cargando cuentas PUC...
            </div>
          ) : (
            <div>
              <Label htmlFor="puc-select">Nueva cuenta PUC</Label>
              <Select value={selectedPUC} onValueChange={setSelectedPUC}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta PUC" />
                </SelectTrigger>
                <SelectContent>
                  {pucAccounts.map((account) => (
                    <SelectItem key={account.code} value={account.code}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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