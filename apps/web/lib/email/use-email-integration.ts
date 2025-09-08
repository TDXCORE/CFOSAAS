/**
 * Microsoft Graph Email Integration Hook
 * Provides authentication and email processing functionality
 */

'use client';

import { useState, useCallback } from 'react';
import { emailProcessor, type EmailProcessingResult, type GraphApiTokens } from './email-processor';
import { useToast } from '@kit/ui/use-toast';

interface EmailIntegrationSettings {
  clientId?: string;
  tenantId?: string;
  isConfigured: boolean;
  lastSync?: string;
  autoSync: boolean;
  syncInterval: number; // minutes
  senderFilter: string[];
  subjectKeywords: string[];
}

interface UseEmailIntegrationReturn {
  // State
  isAuthenticated: boolean;
  isProcessing: boolean;
  settings: EmailIntegrationSettings;
  
  // Actions
  authenticateWithGraph: () => Promise<void>;
  processEmails: (options?: {
    since?: Date;
    maxEmails?: number;
  }) => Promise<EmailProcessingResult | null>;
  updateSettings: (newSettings: Partial<EmailIntegrationSettings>) => void;
  disconnectAccount: () => void;
  
  // Status
  lastProcessingResult?: EmailProcessingResult;
}

const GRAPH_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'offline_access',
];

export function useEmailIntegration(companyId: string): UseEmailIntegrationReturn {
  const { toast } = useToast();
  
  // State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tokens, setTokens] = useState<GraphApiTokens | null>(null);
  const [lastProcessingResult, setLastProcessingResult] = useState<EmailProcessingResult>();
  
  const [settings, setSettings] = useState<EmailIntegrationSettings>({
    isConfigured: false,
    autoSync: false,
    syncInterval: 60, // 1 hour
    senderFilter: [],
    subjectKeywords: ['factura', 'invoice', 'bill'],
  });

  /**
   * Authenticate with Microsoft Graph using popup
   */
  const authenticateWithGraph = useCallback(async () => {
    try {
      if (typeof window === 'undefined') {
        throw new Error('Authentication must be done in browser');
      }

      // Check if we have environment variables configured
      const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
      const tenantId = process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID || 'common';

      if (!clientId) {
        toast({
          title: 'Configuration Error',
          description: 'Microsoft Graph API is not configured. Please contact your administrator.',
          variant: 'destructive',
        });
        return;
      }

      // Build authorization URL
      const authParams = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: `${window.location.origin}/api/auth/microsoft/callback`,
        scope: GRAPH_SCOPES.join(' '),
        response_mode: 'query',
        state: companyId,
      });

      const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${authParams}`;

      // Open popup for authentication
      const popup = window.open(
        authUrl,
        'microsoft-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Wait for authentication to complete
      const result = await new Promise<{ code: string; state: string }>((resolve, reject) => {
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            reject(new Error('Authentication cancelled'));
          }
        }, 1000);

        // Listen for message from popup
        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'microsoft-auth-success') {
            clearInterval(checkClosed);
            popup.close();
            window.removeEventListener('message', messageHandler);
            resolve(event.data.result);
          }
          
          if (event.data.type === 'microsoft-auth-error') {
            clearInterval(checkClosed);
            popup.close();
            window.removeEventListener('message', messageHandler);
            reject(new Error(event.data.error));
          }
        };

        window.addEventListener('message', messageHandler);
      });

      // Exchange code for tokens
      const tokenResponse = await fetch('/api/auth/microsoft/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: result.code,
          companyId,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const tokenData = await tokenResponse.json();
      
      setTokens({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
      });

      setIsAuthenticated(true);
      setSettings(prev => ({
        ...prev,
        isConfigured: true,
        clientId,
        tenantId,
      }));

      // Test connection
      const connectionTest = await emailProcessor.testConnection(tokenData.access_token);
      
      if (connectionTest.success) {
        toast({
          title: 'Connected Successfully',
          description: `Connected to ${connectionTest.userInfo?.mail || 'Microsoft 365'}`,
        });
      } else {
        throw new Error(connectionTest.error);
      }

    } catch (error) {
      console.error('Microsoft Graph authentication error:', error);
      toast({
        title: 'Authentication Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Microsoft 365',
        variant: 'destructive',
      });
    }
  }, [companyId, toast]);

  /**
   * Process emails from Microsoft Graph
   */
  const processEmails = useCallback(async (options: {
    since?: Date;
    maxEmails?: number;
  } = {}): Promise<EmailProcessingResult | null> => {
    if (!tokens || !isAuthenticated) {
      toast({
        title: 'Not Authenticated',
        description: 'Please connect your Microsoft 365 account first.',
        variant: 'destructive',
      });
      return null;
    }

    setIsProcessing(true);
    
    try {
      // Check if token needs refresh
      let currentTokens = tokens;
      if (Date.now() > tokens.expiresAt - 300000) { // Refresh 5 minutes before expiry
        const refreshResult = await emailProcessor.refreshAccessToken(
          tokens.refreshToken || '',
          settings.clientId || '',
          '', // Client secret would be stored securely on server
          settings.tenantId
        );

        if (refreshResult.success && refreshResult.tokens) {
          currentTokens = refreshResult.tokens;
          setTokens(currentTokens);
        } else {
          throw new Error('Failed to refresh access token. Please re-authenticate.');
        }
      }

      // Process emails
      const result = await emailProcessor.processEmails(companyId, currentTokens, {
        ...options,
        senderFilter: settings.senderFilter,
        subjectKeywords: settings.subjectKeywords,
      });

      setLastProcessingResult(result);

      if (result.success) {
        const message = result.processedInvoices > 0
          ? `Processed ${result.processedInvoices} invoice(s) from ${result.processedEmails} email(s)`
          : `Checked ${result.processedEmails} email(s), no new invoices found`;

        toast({
          title: 'Email Processing Complete',
          description: message,
        });

        // Update last sync time
        setSettings(prev => ({
          ...prev,
          lastSync: new Date().toISOString(),
        }));
      } else {
        toast({
          title: 'Email Processing Issues',
          description: `${result.errors.length} error(s) occurred. Check console for details.`,
          variant: 'destructive',
        });
      }

      return result;

    } catch (error) {
      console.error('Email processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      toast({
        title: 'Processing Failed',
        description: errorMessage,
        variant: 'destructive',
      });

      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [tokens, isAuthenticated, companyId, settings, toast]);

  /**
   * Update integration settings
   */
  const updateSettings = useCallback((newSettings: Partial<EmailIntegrationSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings,
    }));
  }, []);

  /**
   * Disconnect Microsoft account
   */
  const disconnectAccount = useCallback(() => {
    setTokens(null);
    setIsAuthenticated(false);
    setSettings(prev => ({
      ...prev,
      isConfigured: false,
      lastSync: undefined,
    }));

    toast({
      title: 'Disconnected',
      description: 'Microsoft 365 account has been disconnected.',
    });
  }, [toast]);

  return {
    // State
    isAuthenticated,
    isProcessing,
    settings,
    
    // Actions
    authenticateWithGraph,
    processEmails,
    updateSettings,
    disconnectAccount,
    
    // Status
    lastProcessingResult,
  };
}