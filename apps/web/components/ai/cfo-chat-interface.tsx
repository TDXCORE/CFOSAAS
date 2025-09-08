/**
 * CFO Chat Interface Component
 * Complete chat interface for interacting with the AI CFO
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Badge } from '@kit/ui/badge';
import { Avatar, AvatarFallback } from '@kit/ui/avatar';
import { 
  Send, 
  Bot, 
  User, 
  Download, 
  Trash2, 
  RefreshCw,
  MessageSquare,
  TrendingUp,
  Calculator,
  FileText
} from 'lucide-react';
import { useCurrentCompany } from '~/lib/companies/tenant-context';
import { useCFOChat } from '~/lib/ai/use-cfo-chat';
import { useDashboard } from '~/lib/hooks/use-dashboard';
import { toast } from 'sonner';

interface CFOChatInterfaceProps {
  className?: string;
}

export function CFOChatInterface({ className }: CFOChatInterfaceProps) {
  const currentCompany = useCurrentCompany();
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get dashboard metrics for context
  const { metrics, kpis, isLoading: metricsLoading } = useDashboard();
  
  // Initialize CFO chat
  const {
    messages,
    isLoading,
    isTyping,
    sendMessage,
    clearChat,
    getProactiveInsights,
    exportChat,
  } = useCFOChat({
    context: {
      companyId: currentCompany?.id || '',
      companyName: currentCompany?.name || '',
      industry: currentCompany?.sector || undefined,
      fiscalRegime: currentCompany?.fiscal_regime || undefined,
    },
    metrics: kpis ? {
      totalInvoices: metrics?.overview.totalInvoices || 0,
      pendingReview: metrics?.overview.pendingReview || 0,
      processedToday: metrics?.overview.processedToday || 0,
      totalAmountMonth: metrics?.financial.revenue.current || 0,
      avgProcessingTime: metrics?.operations.processing.avgTime || 0,
      classificationAccuracy: kpis.classificationAccuracy / 100,
      manualReviewRate: kpis.manualReviewRate / 100,
      totalIVA: metrics?.financial.taxes.iva || 0,
      totalRetentions: metrics?.financial.taxes.retentions || 0,
      totalICA: metrics?.financial.taxes.ica || 0,
    } : undefined,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const message = inputMessage.trim();
    setInputMessage('');
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleExportChat = () => {
    const chatData = exportChat();
    const blob = new Blob([chatData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cfo-chat-${currentCompany?.name}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Chat exportado exitosamente');
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const quickActions = [
    {
      label: 'Analizar Facturas',
      icon: <FileText className="h-4 w-4" />,
      message: 'Analiza las facturas de este mes y dame insights sobre proveedores y gastos principales',
    },
    {
      label: 'Optimización Fiscal',
      icon: <Calculator className="h-4 w-4" />,
      message: 'Revisa mi carga tributaria actual y sugiere optimizaciones para reducir impuestos legalmente',
    },
    {
      label: 'Métricas Clave',
      icon: <TrendingUp className="h-4 w-4" />,
      message: 'Explícame las métricas más importantes de mi dashboard y qué indican sobre la salud financiera',
    },
  ];

  if (!currentCompany) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Selecciona una Empresa</h3>
          <p className="text-muted-foreground text-center">
            Para chatear con el CFO virtual, primero selecciona una empresa en el selector.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CFO Virtual</h1>
          <p className="text-muted-foreground">
            Tu asesor financiero especializado en empresas colombianas
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={getProactiveInsights} disabled={metricsLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Obtener Insights
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportChat}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Chat
          </Button>
          <Button variant="outline" size="sm" onClick={clearChat}>
            <Trash2 className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-auto p-3"
                  onClick={() => sendMessage(action.message)}
                  disabled={isLoading}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">{action.icon}</div>
                    <div className="text-left">
                      <div className="font-medium text-xs">{action.label}</div>
                    </div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-3">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">CFO Virtual</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {currentCompany.name} • {messages.length} mensajes
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  En línea
                </Badge>
              </div>
            </CardHeader>
            
            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto space-y-4 p-4">
              {messages.length === 0 && !isTyping && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">¡Hola! Soy tu CFO Virtual</h3>
                  <p className="text-muted-foreground max-w-md">
                    Estoy especializado en finanzas colombianas. Puedo ayudarte con análisis 
                    de facturas, optimización fiscal, métricas clave y mucho más.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Usa las acciones rápidas o escribe tu pregunta abajo.
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex space-x-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className={message.role === 'user' ? 'bg-secondary' : 'bg-primary text-primary-foreground'}>
                        {message.role === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`rounded-lg p-3 ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </div>
                      <div className="text-xs mt-2 opacity-70">
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex space-x-3 max-w-[80%]">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <Input
                  placeholder="Escribe tu pregunta aquí..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}