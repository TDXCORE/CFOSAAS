'use client';

import { useState } from 'react';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Badge } from '@kit/ui/badge';
import { 
  Mail, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  FileText,
  Package,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentCompany } from '~/lib/companies/tenant-context';

export function EmailDemo() {
  const currentCompany = useCurrentCompany();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleDemoProcessing = async () => {
    if (!currentCompany) return;

    setIsProcessing(true);
    try {
      // Simulate email processing with the configured credentials
      const response = await fetch('/api/emails/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompany.id,
          microsoftGraphConfig: {
            // Let the server use environment variables
          },
          processingOptions: {
            maxEmails: 5,
            daysBack: 30,
            includeRead: false,
            autoMarkProcessed: true
          },
          testMode: false
        })
      });

      const result = await response.json();
      setLastResult(result);
      
      if (result.success) {
        toast.success('¡Procesamiento exitoso!', {
          description: `${result.summary?.processedInvoices || 0} facturas procesadas de ${result.summary?.totalEmails || 0} emails`
        });
      } else {
        toast.error('Error en el procesamiento', {
          description: result.error || 'Error desconocido'
        });
      }

    } catch (error) {
      toast.error('Error conectando con el servidor');
      setLastResult({
        success: false,
        error: 'Error de conexión'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!currentCompany) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Selecciona una empresa para probar la integración</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Demo - Procesamiento Automático de Emails</CardTitle>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Listo para usar
            </Badge>
          </div>
          <CardDescription>
            Prueba el procesamiento automático usando las credenciales preconfiguradas de ventas@tdxcore.com
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                <strong>Configuración actual:</strong><br/>
                • Buzón: ventas@tdxcore.com<br/>
                • Tenant: TDX Core<br/>
                • Busca emails con archivos ZIP/RAR que contengan facturas XML<br/>
                • Procesa automáticamente y crea facturas en el sistema
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Configuración:</p>
                <p className="text-sm text-muted-foreground">• Máximo 5 emails por ejecución</p>
                <p className="text-sm text-muted-foreground">• Buscar últimos 30 días</p>
                <p className="text-sm text-muted-foreground">• Solo emails no leídos</p>
                <p className="text-sm text-muted-foreground">• Marcar como procesados automáticamente</p>
              </div>
              
              <Button
                onClick={handleDemoProcessing}
                disabled={isProcessing}
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Procesar Emails
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Cómo funciona?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-medium text-sm">1. Buscar Emails</h4>
              <p className="text-xs text-muted-foreground">
                Conecta con Outlook y busca emails con facturas
              </p>
            </div>
            
            <div className="text-center">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Package className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-medium text-sm">2. Extraer ZIP/RAR</h4>
              <p className="text-xs text-muted-foreground">
                Descomprime archivos y encuentra XMLs
              </p>
            </div>
            
            <div className="text-center">
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-medium text-sm">3. Procesar XML</h4>
              <p className="text-xs text-muted-foreground">
                Extrae datos y clasifica automáticamente
              </p>
            </div>
            
            <div className="text-center">
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Download className="h-6 w-6 text-orange-600" />
              </div>
              <h4 className="font-medium text-sm">4. Crear Factura</h4>
              <p className="text-xs text-muted-foreground">
                Guarda en base de datos con cálculos PUC
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Último Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Estado:</span>
                <Badge variant={lastResult.success ? "default" : "destructive"}>
                  {lastResult.success ? 'Exitoso' : 'Error'}
                </Badge>
              </div>
              
              {lastResult.summary && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Emails encontrados: {lastResult.summary.totalEmails || 0}</div>
                  <div>Emails procesados: {lastResult.summary.processedEmails || 0}</div>
                  <div>Archivos extraídos: {lastResult.summary.extractedFiles || 0}</div>
                  <div>Facturas creadas: {lastResult.summary.processedInvoices || 0}</div>
                </div>
              )}
              
              {lastResult.error && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Error: {lastResult.error}
                    {lastResult.details && (
                      <div className="mt-1 text-xs">
                        Detalles: {lastResult.details}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {lastResult.success && lastResult.summary?.processedInvoices > 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    ¡Éxito! Se procesaron {lastResult.summary.processedInvoices} facturas.
                    Puedes verlas en la página de <a href="/home/invoices" className="underline font-medium">Facturas</a>.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}