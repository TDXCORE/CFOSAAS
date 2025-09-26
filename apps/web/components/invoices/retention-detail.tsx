/**
 * Retention Detail Component
 * Shows detailed breakdown of Colombian tax retentions
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@kit/ui/collapsible';
import {
  ChevronDown,
  ChevronUp,
  Calculator,
  FileText,
  MapPin,
  Percent,
  Info,
  AlertCircle,
} from 'lucide-react';
import type { Invoice, RetentionDetail } from '~/lib/invoices/types';
import { invoiceListService } from '~/lib/invoices/invoice-list-service';

interface RetentionDetailProps {
  invoice: Invoice;
  companyId: string;
}

interface RetentionSummary {
  retefuente: number;
  reteica: number;
  reteiva: number;
  details: Array<{
    tax_type: string;
    concept_code: string;
    concept_description: string;
    tax_amount: number;
    tax_rate: number;
    municipality?: string;
  }>;
}

export function RetentionDetailComponent({ invoice, companyId }: RetentionDetailProps) {
  const [retentionData, setRetentionData] = useState<RetentionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadRetentionDetails();
  }, [invoice.id]);

  const loadRetentionDetails = async () => {
    try {
      setLoading(true);
      const data = await invoiceListService.getInvoiceRetentionDetails(invoice.id, companyId);
      setRetentionData(data);
    } catch (error) {
      console.error('Error loading retention details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`;
  };

  const getRetentionTypeColor = (type: string) => {
    switch (type) {
      case 'RETENCION_FUENTE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'RETENCION_ICA':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'RETENCION_IVA':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRetentionTypeName = (type: string) => {
    switch (type) {
      case 'RETENCION_FUENTE':
        return 'Retención en la Fuente';
      case 'RETENCION_ICA':
        return 'Retención ICA';
      case 'RETENCION_IVA':
        return 'Retención IVA';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="flex items-center space-x-2">
            <Calculator className="h-4 w-4 animate-spin" />
            <span>Cargando detalle de retenciones...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!retentionData || retentionData.details.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <Info className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-center">
            No se encontraron retenciones para esta factura
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Las retenciones se calculan automáticamente según la normativa colombiana 2025
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalRetentions = retentionData.retefuente + retentionData.reteica + retentionData.reteiva;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Retenciones</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalRetentions)}
                </p>
              </div>
              <Calculator className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Retención Fuente</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(retentionData.retefuente)}
                </p>
              </div>
              <FileText className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Retención ICA</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(retentionData.reteica)}
                </p>
              </div>
              <MapPin className="h-6 w-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Retención IVA</p>
                <p className="text-xl font-bold text-purple-600">
                  {formatCurrency(retentionData.reteiva)}
                </p>
              </div>
              <Percent className="h-6 w-6 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Detalle de Retenciones</CardTitle>
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  {showDetails ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      Ocultar Detalle
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Ver Detalle
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead className="text-right">Tarifa</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Municipio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retentionData.details.map((detail, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getRetentionTypeColor(detail.tax_type)}
                            >
                              {getRetentionTypeName(detail.tax_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">
                                {detail.concept_description}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">
                              {detail.concept_code}
                            </code>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatPercentage(detail.tax_rate)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(detail.tax_amount)}
                          </TableCell>
                          <TableCell>
                            {detail.municipality ? (
                              <div className="flex items-center space-x-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{detail.municipality}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardHeader>

        <CardContent>
          {/* Quick Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {retentionData.retefuente > 0 && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-800">Retención en la Fuente</p>
                  <p className="text-xs text-blue-600">Según concepto DIAN</p>
                </div>
                <p className="text-lg font-bold text-blue-800">
                  {formatCurrency(retentionData.retefuente)}
                </p>
              </div>
            )}

            {retentionData.reteica > 0 && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-green-800">Retención ICA</p>
                  <p className="text-xs text-green-600">Actividad comercial</p>
                </div>
                <p className="text-lg font-bold text-green-800">
                  {formatCurrency(retentionData.reteica)}
                </p>
              </div>
            )}

            {retentionData.reteiva > 0 && (
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-purple-800">Retención IVA</p>
                  <p className="text-xs text-purple-600">15% sobre IVA</p>
                </div>
                <p className="text-lg font-bold text-purple-800">
                  {formatCurrency(retentionData.reteiva)}
                </p>
              </div>
            )}
          </div>

          {/* Calculation Info */}
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Información de Cálculo:</p>
                <ul className="space-y-1">
                  <li>• Retenciones calculadas según normativa colombiana 2025</li>
                  <li>• UVT 2025: $49.799 (valor actualizado)</li>
                  <li>• Tarifas aplicadas según tipo de proveedor y actividad</li>
                  <li>• Umbrales mínimos validados automáticamente</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}