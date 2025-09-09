/**
 * Simple Create Company Dialog
 * Minimal version to avoid import errors
 */

'use client';

import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from 'sonner';

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCompanyDialog({ open, onOpenChange }: CreateCompanyDialogProps) {
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !taxId.trim()) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate company creation
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Empresa creada exitosamente');
      onOpenChange(false);
      setName('');
      setTaxId('');
    } catch (error) {
      toast.error('Error al crear la empresa');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span>Crear Nueva Empresa</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nombre de la Empresa *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: Mi Empresa S.A.S."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              NIT *
            </label>
            <Input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="ej: 900123456"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear Empresa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}