'use client';

import { useState, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { Badge } from '@kit/ui/badge';
import { 
  Mail, 
  Settings, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  Download,
  FileText,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentCompany } from '~/lib/companies/tenant-context';

interface EmailIntegrationConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  mailbox?: string;
}

interface ProcessingOptions {
  maxEmails: number;
  daysBack: number;
  includeRead: boolean;
  autoMarkProcessed: boolean;
  subjectFilters: string[];
}

interface ProcessingStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  lastRunAt: string | null;
  averageProcessingTime: number;
  totalInvoicesProcessed: number;
  recentLogs: Array<{
    id: string;
    createdAt: string;
    status: string;
    summary: any;
    processingTime: number;
    errorMessage?: string;
  }>;
}

export function EmailIntegration() {
  const currentCompany = useCurrentCompany();
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasIntegration, setHasIntegration] = useState(false);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [lastProcessingResult, setLastProcessingResult] = useState<any>(null);

  const [config, setConfig] = useState<EmailIntegrationConfig>({
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
    clientSecret: '', // No exponer el secreto en el cliente
    tenantId: process.env.NEXT_PUBLIC_AZURE_TENANT_ID || '',
    mailbox: process.env.NEXT_PUBLIC_USER_EMAIL || 'ventas@tdxcore.com'
  });

  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    maxEmails: 10,
    daysBack: 7,
    includeRead: false,
    autoMarkProcessed: true,
    subjectFilters: ['factura', 'invoice', 'comprobante', 'fe_', 'fv_', 'dian']
  });

  useEffect(() => {
    if (currentCompany) {
      loadIntegrationStatus();
      loadProcessingStats();
    }
  }, [currentCompany]);

  const loadIntegrationStatus = async () => {
    try {
      const response = await fetch(`/api/emails/process?companyId=${currentCompany?.id}`);
      const data = await response.json();
      
      if (data.success) {
        setHasIntegration(data.hasIntegration);
      }
    } catch (error) {
      console.error('Failed to load integration status:', error);
    }
  };

  const loadProcessingStats = async () => {
    try {
      const response = await fetch(`/api/emails/process?companyId=${currentCompany?.id}&action=stats`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load processing stats:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!currentCompany) return;

    setIsTesting(true);
    try {
      const response = await fetch('/api/emails/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompany.id,
          microsoftGraphConfig: config,
          testMode: true
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('¡Conexión exitosa con Microsoft Graph!', {
          description: `Buzón: ${result.connectionResult.mailboxInfo?.email || 'N/A'}`
        });
      } else {
        toast.error('Error de conexión', {
          description: result.connectionResult?.error || 'Error desconocido'
        });
      }

    } catch (error) {
      console.error('Connection test error:', error);
      toast.error('Error probando la conexión', {
        description: error instanceof Error ? error.message : 'Error desconocido de red'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleProcessEmails = async () => {
    if (!currentCompany) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/emails/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompany.id,
          microsoftGraphConfig: config,
          processingOptions,
          testMode: false
        })
      });

      const result = await response.json();
      setLastProcessingResult(result);
      
      if (result.success) {
        toast.success('¡Procesamiento completado!', {
          description: `${result.summary.processedInvoices} facturas procesadas de ${result.summary.totalEmails} emails`
        });
        
        // Reload stats
        await loadProcessingStats();
      } else {
        toast.error('Procesamiento completado con errores', {
          description: `Errores: ${result.errors?.length || 0}`
        });
      }

    } catch (error) {
      toast.error('Error procesando emails');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!currentCompany) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Selecciona una empresa para configurar la integración</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <CardTitle>Integración Email</CardTitle>
              {hasIntegration && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Configurado
                </Badge>
              )}
            </div>
            
            <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Configurar Microsoft Graph</DialogTitle>
                  <DialogDescription>
                    Configura la conexión con O365/Outlook para procesar emails automáticamente
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      value={config.clientId}
                      onChange={(e) => setConfig(prev => ({ ...prev, clientId: e.target.value }))}
                      placeholder="Application (client) ID"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input
                      id="clientSecret"
                      type="password"
                      value={config.clientSecret}
                      onChange={(e) => setConfig(prev => ({ ...prev, clientSecret: e.target.value }))}
                      placeholder="Configurado en el servidor (opcional)"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="tenantId">Tenant ID</Label>
                    <Input
                      id="tenantId"
                      value={config.tenantId}
                      onChange={(e) => setConfig(prev => ({ ...prev, tenantId: e.target.value }))}
                      placeholder="Directory (tenant) ID"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="mailbox">Mailbox (opcional)</Label>
                    <Input
                      id="mailbox"
                      value={config.mailbox}
                      onChange={(e) => setConfig(prev => ({ ...prev, mailbox: e.target.value }))}
                      placeholder="email@empresa.com"
                    />
                  </div>
                  
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Necesitas registrar una aplicación en Azure AD y configurar los permisos Mail.Read para Microsoft Graph.
                    </AlertDescription>
                  </Alert>
                </div>

                <DialogFooter className="flex-col space-y-2">
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      onClick={() => setShowConfigDialog(false)}
                      disabled={isTesting}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleTestConnection}
                      disabled={isTesting || !config.clientId || !config.tenantId}
                      className="flex-1"
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Probando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Probar Conexión
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <Alert className="bg-blue-50 border-blue-200">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>¿Conexión OK?</strong> Usa el botón azul "Procesar Emails" en la sección principal para buscar y procesar facturas.
                    </AlertDescription>
                  </Alert>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Procesa automáticamente emails con archivos ZIP/RAR que contengan facturas XML
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm">
                <strong>Estado:</strong> {hasIntegration ? 'Configurado' : 'No configurado'}
              </p>
              
              {stats && (
                <>
                  <p className="text-sm">
                    <strong>Última ejecución:</strong> {' '}
                    {stats.lastRunAt 
                      ? new Date(stats.lastRunAt).toLocaleString('es-CO')
                      : 'Nunca'
                    }
                  </p>
                  <p className="text-sm">
                    <strong>Total facturas procesadas:</strong> {stats.totalInvoicesProcessed}
                  </p>
                </>
              )}
            </div>
            
            <Button
              onClick={handleProcessEmails}
              disabled={isProcessing || !config.clientId || !config.tenantId}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando emails...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Procesar Emails
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Processing Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opciones de Procesamiento</CardTitle>
          <CardDescription>
            Configura cómo se procesan los emails con facturas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxEmails">Máximo emails por ejecución</Label>
              <Input
                id="maxEmails"
                type="number"
                min="1"
                max="50"
                value={processingOptions.maxEmails}
                onChange={(e) => setProcessingOptions(prev => ({ 
                  ...prev, 
                  maxEmails: parseInt(e.target.value) || 10 
                }))}
              />
            </div>
            
            <div>
              <Label htmlFor="daysBack">Días hacia atrás</Label>
              <Input
                id="daysBack"
                type="number"
                min="1"
                max="30"
                value={processingOptions.daysBack}
                onChange={(e) => setProcessingOptions(prev => ({ 
                  ...prev, 
                  daysBack: parseInt(e.target.value) || 7 
                }))}
              />
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeRead"
                checked={processingOptions.includeRead}
                onChange={(e) => setProcessingOptions(prev => ({ 
                  ...prev, 
                  includeRead: e.target.checked 
                }))}
              />
              <Label htmlFor="includeRead">Incluir emails ya leídos</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoMarkProcessed"
                checked={processingOptions.autoMarkProcessed}
                onChange={(e) => setProcessingOptions(prev => ({ 
                  ...prev, 
                  autoMarkProcessed: e.target.checked 
                }))}
              />
              <Label htmlFor="autoMarkProcessed">Marcar emails como procesados</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estadísticas de Procesamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.successfulRuns}</div>
                <div className="text-sm text-muted-foreground">Ejecuciones exitosas</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalInvoicesProcessed}</div>
                <div className="text-sm text-muted-foreground">Facturas procesadas</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {stats.averageProcessingTime > 0 
                    ? `${Math.round(stats.averageProcessingTime / 1000)}s` 
                    : 'N/A'
                  }
                </div>
                <div className="text-sm text-muted-foreground">Tiempo promedio</div>
              </div>
            </div>

            {stats.recentLogs && stats.recentLogs.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3">Ejecuciones Recientes</h4>
                <div className="space-y-2">
                  {stats.recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center space-x-2">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">
                          {new Date(log.createdAt).toLocaleString('es-CO')}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-muted-foreground">
                          {log.summary?.processedInvoices || 0} facturas
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {Math.round((log.processingTime || 0) / 1000)}s
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Last Processing Result */}
      {lastProcessingResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Último Resultado de Procesamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Estado:</span>
                <Badge variant={lastProcessingResult.success ? "default" : "destructive"}>
                  {lastProcessingResult.success ? 'Exitoso' : 'Con errores'}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Emails encontrados: {lastProcessingResult.summary?.totalEmails || 0}</div>
                <div>Facturas procesadas: {lastProcessingResult.summary?.processedInvoices || 0}</div>
                <div>Archivos extraídos: {lastProcessingResult.summary?.extractedFiles || 0}</div>
                <div>Tiempo total: {Math.round((lastProcessingResult.processingTime || 0) / 1000)}s</div>
              </div>
              
              {lastProcessingResult.errors && lastProcessingResult.errors.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {lastProcessingResult.errors.length} errores encontrados. Ver logs para detalles.
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