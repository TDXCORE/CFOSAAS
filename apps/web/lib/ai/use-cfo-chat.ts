/**
 * CFO Chat Hook
 * Manages conversation state and interactions with AI CFO assistant
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cfoAssistant, type CFOContext, type CFOMessage, type CFOResponse, type InvoiceMetrics } from './cfo-assistant';
import { useToast } from '@kit/ui/use-toast';

interface UseCFOChatOptions {
  context: CFOContext;
  metrics?: InvoiceMetrics;
  onMessageSent?: (message: CFOMessage) => void;
  onResponseReceived?: (response: CFOMessage) => void;
  autoLoadInsights?: boolean;
}

interface UseCFOChatReturn {
  // State
  messages: CFOMessage[];
  isLoading: boolean;
  isTyping: boolean;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  regenerateResponse: () => Promise<void>;
  getProactiveInsights: () => Promise<void>;
  analyzeInvoices: (invoices: any[]) => Promise<void>;
  
  // Utilities
  exportChat: () => string;
  importChat: (chatData: string) => boolean;
}

const STORAGE_KEY_PREFIX = 'cfo-chat-';
const MAX_MESSAGES = 50; // Limit chat history
const TYPING_DELAY = 1000; // Simulate typing delay

export function useCFOChat({
  context,
  metrics,
  onMessageSent,
  onResponseReceived,
  autoLoadInsights = true,
}: UseCFOChatOptions): UseCFOChatReturn {
  const { toast } = useToast();
  const [messages, setMessages] = useState<CFOMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const lastMessageRef = useRef<string>('');
  const chatKey = `${STORAGE_KEY_PREFIX}${context.companyId}`;

  // Load chat history on mount
  useEffect(() => {
    const savedChat = localStorage.getItem(chatKey);
    if (savedChat) {
      try {
        const parsedMessages = JSON.parse(savedChat);
        setMessages(parsedMessages.slice(-MAX_MESSAGES)); // Keep only recent messages
      } catch (error) {
        console.warn('Failed to load chat history:', error);
      }
    }

    // Load proactive insights on first visit
    if (autoLoadInsights && messages.length === 0) {
      setTimeout(() => getProactiveInsights(), 2000);
    }
  }, [context.companyId]);

  // Save chat history when messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(chatKey, JSON.stringify(messages));
    }
  }, [messages, chatKey]);

  /**
   * Generate unique message ID
   */
  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Add message to chat
   */
  const addMessage = useCallback((message: Omit<CFOMessage, 'id'>) => {
    const fullMessage: CFOMessage = {
      ...message,
      id: generateMessageId(),
    };

    setMessages(prev => [...prev.slice(-MAX_MESSAGES + 1), fullMessage]);
    return fullMessage;
  }, []);

  /**
   * Send user message and get AI response
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage = addMessage({
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    });

    onMessageSent?.(userMessage);
    lastMessageRef.current = content;

    setIsLoading(true);
    setIsTyping(true);

    try {
      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, TYPING_DELAY));

      const response = await cfoAssistant.sendMessage(
        content,
        context,
        metrics,
        messages.slice(-10) // Send last 10 messages for context
      );

      setIsTyping(false);

      if (response.success && response.message) {
        const assistantMessage = addMessage({
          role: 'assistant',
          content: response.message,
          timestamp: new Date().toISOString(),
          context: {
            metrics,
            analysis: response.analysis,
          },
        });

        onResponseReceived?.(assistantMessage);

        // Show action recommendations if available
        if (response.actions && response.actions.length > 0) {
          const highPriorityActions = response.actions.filter(a => a.priority === 'high');
          if (highPriorityActions.length > 0) {
            toast({
              title: 'Acciones Recomendadas',
              description: `${highPriorityActions.length} recomendación(es) de alta prioridad disponible(s)`,
            });
          }
        }
      } else {
        throw new Error(response.error || 'No se recibió respuesta del CFO');
      }

    } catch (error) {
      console.error('CFO chat error:', error);
      
      const errorMessage = addMessage({
        role: 'assistant',
        content: 'Disculpa, he tenido un problema técnico. Por favor intenta de nuevo o reformula tu pregunta.',
        timestamp: new Date().toISOString(),
      });

      onResponseReceived?.(errorMessage);

      toast({
        title: 'Error de Comunicación',
        description: 'No pude procesar tu mensaje. Por favor intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [context, metrics, messages, isLoading, addMessage, onMessageSent, onResponseReceived, toast]);

  /**
   * Get proactive insights from CFO
   */
  const getProactiveInsights = useCallback(async () => {
    if (!metrics || isLoading) return;

    setIsLoading(true);
    setIsTyping(true);

    try {
      await new Promise(resolve => setTimeout(resolve, TYPING_DELAY));

      const response = await cfoAssistant.getProactiveInsights(context, metrics);
      setIsTyping(false);

      if (response.success && response.message) {
        const assistantMessage = addMessage({
          role: 'assistant',
          content: `**💡 Insights Proactivos**\n\n${response.message}`,
          timestamp: new Date().toISOString(),
          context: {
            metrics,
            analysis: response.analysis,
          },
        });

        onResponseReceived?.(assistantMessage);

        // Add welcome message if this is the first interaction
        if (messages.length === 0) {
          setTimeout(() => {
            const welcomeMessage = addMessage({
              role: 'assistant',
              content: `¡Hola! Soy tu CFO virtual especializado en empresas colombianas. He revisado las métricas de ${context.companyName} y tengo algunos insights importantes para compartir contigo. \n\n¿En qué puedo ayudarte hoy? Puedo analizar tus facturas, optimizar procesos, o resolver dudas sobre normativa tributaria colombiana.`,
              timestamp: new Date().toISOString(),
            });
            onResponseReceived?.(welcomeMessage);
          }, 2000);
        }
      }

    } catch (error) {
      console.error('Proactive insights error:', error);
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  }, [context, metrics, messages.length, isLoading, addMessage, onResponseReceived]);

  /**
   * Analyze specific invoices
   */
  const analyzeInvoices = useCallback(async (invoices: any[]) => {
    if (isLoading || invoices.length === 0) return;

    setIsLoading(true);
    setIsTyping(true);

    try {
      await new Promise(resolve => setTimeout(resolve, TYPING_DELAY));

      const response = await cfoAssistant.analyzeInvoices(invoices, context);
      setIsTyping(false);

      if (response.success && response.message) {
        const assistantMessage = addMessage({
          role: 'assistant',
          content: `**📊 Análisis de Facturas**\n\n${response.message}`,
          timestamp: new Date().toISOString(),
          context: {
            invoices,
            analysis: response.analysis,
          },
        });

        onResponseReceived?.(assistantMessage);
      }

    } catch (error) {
      console.error('Invoice analysis error:', error);
      setIsTyping(false);
      toast({
        title: 'Error en Análisis',
        description: 'No pude analizar las facturas. Intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [context, isLoading, addMessage, onResponseReceived, toast]);

  /**
   * Regenerate last AI response
   */
  const regenerateResponse = useCallback(async () => {
    if (!lastMessageRef.current || isLoading) return;

    // Remove last assistant message if exists
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        return prev.slice(0, -1);
      }
      return prev;
    });

    // Resend last user message
    await sendMessage(lastMessageRef.current);
  }, [isLoading, sendMessage]);

  /**
   * Clear chat history
   */
  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(chatKey);
    lastMessageRef.current = '';
    
    toast({
      title: 'Chat Limpio',
      description: 'El historial de conversación ha sido eliminado.',
    });
  }, [chatKey, toast]);

  /**
   * Export chat history as JSON
   */
  const exportChat = useCallback(() => {
    const exportData = {
      companyId: context.companyId,
      companyName: context.companyName,
      exportedAt: new Date().toISOString(),
      messages,
    };

    return JSON.stringify(exportData, null, 2);
  }, [context, messages]);

  /**
   * Import chat history from JSON
   */
  const importChat = useCallback((chatData: string): boolean => {
    try {
      const parsed = JSON.parse(chatData);
      
      if (parsed.companyId !== context.companyId) {
        toast({
          title: 'Error de Importación',
          description: 'Este chat pertenece a otra empresa.',
          variant: 'destructive',
        });
        return false;
      }

      if (Array.isArray(parsed.messages)) {
        setMessages(parsed.messages.slice(-MAX_MESSAGES));
        toast({
          title: 'Chat Importado',
          description: `Se importaron ${parsed.messages.length} mensajes.`,
        });
        return true;
      }

      return false;
    } catch (error) {
      toast({
        title: 'Error de Importación',
        description: 'Formato de archivo inválido.',
        variant: 'destructive',
      });
      return false;
    }
  }, [context.companyId, toast]);

  return {
    // State
    messages,
    isLoading,
    isTyping,
    
    // Actions
    sendMessage,
    clearChat,
    regenerateResponse,
    getProactiveInsights,
    analyzeInvoices,
    
    // Utilities
    exportChat,
    importChat,
  };
}