/**
 * Microsoft Graph API Connector
 * Connects to O365/Outlook to read emails with invoice attachments
 */

import { Client, ClientOptions } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication, ClientCredentialRequest } from '@azure/msal-node';

export interface MicrosoftGraphCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  mailbox?: string; // Optional specific mailbox, defaults to authenticated user
}

export interface EmailMessage {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  receivedDateTime: string;
  hasAttachments: boolean;
  attachments: EmailAttachment[];
  bodyPreview: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: Buffer;
  isInline: boolean;
}

export interface EmailProcessingOptions {
  maxEmails?: number;
  daysBack?: number;
  includeRead?: boolean;
  subjectFilters?: string[];
  senderFilters?: string[];
  attachmentExtensions?: string[];
}

export interface EmailProcessingResult {
  totalEmails: number;
  processedEmails: number;
  emailsWithAttachments: number;
  totalAttachments: number;
  invoiceAttachments: number;
  errors: string[];
  processedMessages: ProcessedEmailMessage[];
}

export interface ProcessedEmailMessage {
  emailId: string;
  subject: string;
  from: string;
  receivedDateTime: string;
  attachments: ProcessedAttachment[];
  processed: boolean;
  error?: string;
}

export interface ProcessedAttachment {
  name: string;
  size: number;
  contentType: string;
  isInvoiceRelated: boolean;
  contentBytes?: Buffer;
  extractedFiles?: {
    name: string;
    extension: string;
    size: number;
    isXml: boolean;
  }[];
}

/**
 * Custom Authentication Provider for Microsoft Graph
 */
class ClientCredentialAuthProvider implements AuthenticationProvider {
  private msalClient: ConfidentialClientApplication;
  private tenantId: string;

  constructor(credentials: MicrosoftGraphCredentials) {
    this.tenantId = credentials.tenantId;
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        authority: `https://login.microsoftonline.com/${credentials.tenantId}`,
      }
    });
  }

  async getAccessToken(): Promise<string> {
    const clientCredentialRequest: ClientCredentialRequest = {
      scopes: ['https://graph.microsoft.com/.default'],
    };

    try {
      const response = await this.msalClient.acquireTokenByClientCredential(clientCredentialRequest);
      return response?.accessToken || '';
    } catch (error) {
      throw new Error(`Failed to acquire access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class MicrosoftGraphConnector {
  private client: Client;
  private credentials: MicrosoftGraphCredentials;
  private authProvider: ClientCredentialAuthProvider;
  private validMailbox?: string; // Store the working mailbox address

  constructor(credentials: MicrosoftGraphCredentials) {
    this.credentials = credentials;
    this.authProvider = new ClientCredentialAuthProvider(credentials);
    
    const clientOptions: ClientOptions = {
      authProvider: {
        getAccessToken: async () => {
          return await this.authProvider.getAccessToken();
        }
      }
    };

    this.client = Client.initWithMiddleware(clientOptions);
  }

  /**
   * Test connection to Microsoft Graph
   */
  async testConnection(): Promise<{ success: boolean; error?: string; mailboxInfo?: any }> {
    const mailboxCandidates = [
      this.credentials.mailbox || 'ventas@tdxcore.com',
      'ventas@tdxcoresas.onmicrosoft.com',  // Try UPN format
      'ventas@tdxcore.com'
    ];

    // Try different mailbox formats
    for (const mailbox of mailboxCandidates) {
      try {
        console.log(`🔍 Testing access to mailbox: ${mailbox}`);
        
        const mailboxInfo = await this.client.api(`/users/${mailbox}`).get();
        console.log(`✅ Mailbox access successful:`, {
          id: mailboxInfo.id,
          email: mailboxInfo.mail || mailboxInfo.userPrincipalName,
          displayName: mailboxInfo.displayName,
          userPrincipalName: mailboxInfo.userPrincipalName
        });
        
        // Store the working mailbox for future use
        this.validMailbox = mailbox;
        
        return { 
          success: true, 
          mailboxInfo: {
            id: mailboxInfo.id,
            email: mailboxInfo.mail || mailboxInfo.userPrincipalName,
            displayName: mailboxInfo.displayName,
            userPrincipalName: mailboxInfo.userPrincipalName,
            usedAddress: mailbox,
            message: 'Microsoft Graph connection successful'
          }
        };
      } catch (error) {
        console.log(`❌ Failed to access mailbox ${mailbox}:`, error instanceof Error ? error.message : 'Unknown error');
        continue; // Try next candidate
      }
    }

    // If all mailbox attempts fail, try basic organization test
    try {
      console.log(`🔄 All mailbox tests failed. Trying basic organization test...`);
      const orgResponse = await this.client.api('/organization').get();
      console.log(`✅ Organization access successful`);
      
      return { 
        success: true, 
        mailboxInfo: { 
          connectionTest: 'basic_success',
          organizationFound: orgResponse.value?.length || 0,
          organizationName: orgResponse.value?.[0]?.displayName || 'Unknown',
          message: 'Basic Microsoft Graph connection successful, but mailbox access failed',
          warning: 'Cannot access specific mailbox. Check user exists and has Exchange license.',
          testedAddresses: mailboxCandidates
        }
      };
    } catch (basicError) {
      console.error(`❌ Basic organization test also failed:`, basicError);
      return { 
        success: false, 
        error: basicError instanceof Error ? basicError.message : 'Unknown connection error' 
      };
    }
  }

  /**
   * Search for emails with invoice attachments
   */
  async searchInvoiceEmails(options: EmailProcessingOptions = {}): Promise<EmailProcessingResult> {
    const {
      maxEmails = 50,
      daysBack = 7,
      includeRead = true,
      subjectFilters = ['factura', 'invoice', 'comprobante', 'fe_'],
      senderFilters = [],
      attachmentExtensions = ['.zip', '.rar', '.xml', '.pdf']
    } = options;

    const result: EmailProcessingResult = {
      totalEmails: 0,
      processedEmails: 0,
      emailsWithAttachments: 0,
      totalAttachments: 0,
      invoiceAttachments: 0,
      errors: [],
      processedMessages: []
    };

    try {
      // Build search query
      const searchQuery = this.buildInvoiceSearchQuery({
        daysBack,
        subjectFilters,
        senderFilters,
        includeRead
      });

      console.log(`🔍 Searching emails with query: ${searchQuery}`);

      // Search for messages in specific mailbox
      const mailbox = this.validMailbox || this.credentials.mailbox || 'ventas@tdxcore.com';
      console.log(`📧 Searching mailbox: ${mailbox}`);
      console.log(`📅 Looking for emails from last ${daysBack} days`);
      console.log(`🔖 Subject filters: ${subjectFilters.join(', ')}`);
      console.log(`📎 Only emails with attachments: true`);
      console.log(`📊 Max emails to search: ${maxEmails}`);
      
      const messages = await this.client
        .api(`/users/${mailbox}/messages`)
        .search(searchQuery)
        .select(['id', 'subject', 'from', 'hasAttachments', 'receivedDateTime', 'bodyPreview'])
        .filter('hasAttachments eq true')
        .top(maxEmails)
        .orderby('receivedDateTime desc')
        .get();

      result.totalEmails = messages.value?.length || 0;
      console.log(`📬 Found ${result.totalEmails} emails matching criteria`);

      if (result.totalEmails === 0) {
        console.log('📭 No emails found matching search criteria');
        return result;
      }

      console.log(`📨 Found ${result.totalEmails} emails with attachments`);

      // Process each email
      for (const message of messages.value || []) {
        try {
          const processedMessage = await this.processEmailMessage(message, attachmentExtensions);
          result.processedMessages.push(processedMessage);

          if (processedMessage.processed) {
            result.processedEmails++;
            
            if (processedMessage.attachments.length > 0) {
              result.emailsWithAttachments++;
              result.totalAttachments += processedMessage.attachments.length;
              result.invoiceAttachments += processedMessage.attachments
                .filter(att => att.isInvoiceRelated).length;
            }
          }

        } catch (error) {
          const errorMessage = `Failed to process email ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMessage);
          console.error('❌', errorMessage);
        }
      }

      console.log(`✅ Email processing summary:
        - Total emails: ${result.totalEmails}
        - Successfully processed: ${result.processedEmails}
        - Emails with attachments: ${result.emailsWithAttachments}
        - Total attachments: ${result.totalAttachments}
        - Invoice-related attachments: ${result.invoiceAttachments}
        - Errors: ${result.errors.length}`);

      return result;

    } catch (error) {
      console.log(`❌ Primary search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('🔍 Trying fallback search - just emails with attachments in last 7 days...');
      
      // Fallback: Try a very broad search - just attachments and date filter
      try {
        const mailbox = this.validMailbox || this.credentials.mailbox || 'ventas@tdxcore.com';
        // Ultra-basic search - no filters, no sorting (Microsoft Graph is very restrictive)
        const broadMessages = await this.client
          .api(`/users/${mailbox}/messages`)
          .select(['id', 'subject', 'from', 'hasAttachments', 'receivedDateTime', 'bodyPreview'])
          .top(20) // Get more emails to filter manually
          .get();
          
        console.log(`📊 Fallback search found ${broadMessages.value?.length || 0} emails total`);
        if (broadMessages.value?.length > 0) {
          console.log('📋 Recent emails:');
          broadMessages.value.forEach((msg: any, index: number) => {
            console.log(`  ${index + 1}. "${msg.subject}" - ${msg.receivedDateTime} - Attachments: ${msg.hasAttachments} - From: ${msg.from?.emailAddress?.address || 'unknown'}`);
          });
          
          // Filter manually: by attachments, date, and content since Microsoft Graph search doesn't work
          const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
          
          for (const message of broadMessages.value) {
            // Only process emails with attachments
            if (!message.hasAttachments) {
              continue;
            }
            
            // Check if email is within date range
            const messageDate = new Date(message.receivedDateTime);
            if (messageDate < cutoffDate) {
              continue; // Skip old emails
            }
            
            const subjectLower = (message.subject || '').toLowerCase();
            const bodyPreview = (message.bodyPreview || '').toLowerCase();
            
            // Check if email contains invoice-related keywords
            const hasInvoiceKeywords = subjectFilters.some(filter => 
              subjectLower.includes(filter.toLowerCase()) || 
              bodyPreview.includes(filter.toLowerCase())
            );
            
            if (hasInvoiceKeywords) {
              console.log(`✅ Found invoice-related email: "${message.subject}"`);
              try {
                const processedMessage = await this.processEmailMessage(message, attachmentExtensions);
                result.processedMessages.push(processedMessage);

                if (processedMessage.processed) {
                  result.processedEmails++;
                  
                  if (processedMessage.attachments.length > 0) {
                    result.emailsWithAttachments++;
                    result.totalAttachments += processedMessage.attachments.length;
                    result.invoiceAttachments += processedMessage.attachments
                      .filter(att => att.isInvoiceRelated).length;
                  }
                }
              } catch (processError) {
                const errorMessage = `Failed to process email ${message.id}: ${processError instanceof Error ? processError.message : 'Unknown error'}`;
                result.errors.push(errorMessage);
                console.error('❌', errorMessage);
              }
            }
          }
          
          result.totalEmails = result.processedMessages.length;
          console.log(`✅ Fallback processing found ${result.totalEmails} invoice-related emails`);
        }
      } catch (fallbackError) {
        console.error('❌ Fallback search also failed:', fallbackError);
        result.errors.push(`Both primary and fallback search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      return result;
    }
  }

  /**
   * Process individual email message
   */
  private async processEmailMessage(
    message: any, 
    allowedExtensions: string[]
  ): Promise<ProcessedEmailMessage> {
    const processedMessage: ProcessedEmailMessage = {
      emailId: message.id,
      subject: message.subject || '',
      from: message.from?.emailAddress?.address || 'unknown',
      receivedDateTime: message.receivedDateTime,
      attachments: [],
      processed: false
    };

    try {
      if (!message.hasAttachments) {
        processedMessage.processed = true;
        return processedMessage;
      }

      // Get attachments
      const attachments = await this.getMessageAttachments(message.id);
      
      for (const attachment of attachments) {
        const extension = this.getFileExtension(attachment.name);
        
        // Only process allowed file types
        if (!allowedExtensions.includes(extension)) {
          continue;
        }

        const processedAttachment: ProcessedAttachment = {
          name: attachment.name,
          size: attachment.size,
          contentType: attachment.contentType,
          isInvoiceRelated: this.isInvoiceRelatedAttachment(attachment.name, extension)
        };

        // Download attachment content if it's invoice-related
        if (processedAttachment.isInvoiceRelated) {
          try {
            const contentBytes = await this.downloadAttachmentContent(message.id, attachment.id);
            processedAttachment.contentBytes = contentBytes;
            
            console.log(`✅ Downloaded attachment content: ${attachment.name} (${contentBytes.length} bytes)`);
            
            // If it's a compressed file, note that for extraction
            if (['.zip', '.rar'].includes(extension)) {
              processedAttachment.extractedFiles = []; // Will be populated by ZIP extractor
            }

          } catch (downloadError) {
            console.warn(`⚠️  Failed to download attachment ${attachment.name}: ${downloadError}`);
          }
        }

        processedMessage.attachments.push(processedAttachment);
      }

      processedMessage.processed = true;
      return processedMessage;

    } catch (error) {
      processedMessage.error = error instanceof Error ? error.message : 'Unknown processing error';
      return processedMessage;
    }
  }

  /**
   * Get attachments for a specific message
   */
  private async getMessageAttachments(messageId: string): Promise<EmailAttachment[]> {
    try {
      const mailbox = this.validMailbox || this.credentials.mailbox || 'ventas@tdxcore.com';
      const attachmentsResponse = await this.client
        .api(`/users/${mailbox}/messages/${messageId}/attachments`)
        .select(['id', 'name', 'contentType', 'size', 'isInline'])
        .get();

      return (attachmentsResponse.value || []).map((att: any) => ({
        id: att.id,
        name: att.name || 'unnamed',
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        isInline: att.isInline || false
      }));

    } catch (error) {
      console.error(`Failed to get attachments for message ${messageId}:`, error);
      return [];
    }
  }

  /**
   * Download attachment content
   */
  private async downloadAttachmentContent(messageId: string, attachmentId: string): Promise<Buffer> {
    try {
      const mailbox = this.validMailbox || this.credentials.mailbox || 'ventas@tdxcore.com';
      const attachment = await this.client
        .api(`/users/${mailbox}/messages/${messageId}/attachments/${attachmentId}/$value`)
        .get();

      // Handle different response types
      if (attachment instanceof Buffer) {
        return attachment;
      } else if (attachment instanceof ReadableStream) {
        // Convert ReadableStream to Buffer
        const chunks: Uint8Array[] = [];
        const reader = attachment.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        
        return Buffer.from(result);
      } else if (typeof attachment === 'string') {
        // Base64 string
        return Buffer.from(attachment, 'base64');
      } else if (attachment && typeof attachment === 'object') {
        // Try to extract data from object
        const data = (attachment as any).data || (attachment as any).contentBytes;
        if (data) {
          return Buffer.from(data, 'base64');
        }
      }

      // Fallback: try to convert directly to Buffer
      return Buffer.from(attachment);

    } catch (error) {
      throw new Error(`Failed to download attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build search query for invoice emails
   */
  private buildInvoiceSearchQuery(options: {
    daysBack: number;
    subjectFilters: string[];
    senderFilters: string[];
    includeRead: boolean;
  }): string {
    const { daysBack, subjectFilters, senderFilters, includeRead } = options;
    const queryParts: string[] = [];

    // Date filter
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - daysBack);
    queryParts.push(`received:>=${dateFilter.toISOString().split('T')[0]}`);

    // Must have attachments
    queryParts.push('hasAttachments:true');

    // Content filters (search only in subject for now - body search may not work)
    if (subjectFilters.length > 0) {
      const contentConditions = subjectFilters
        .map(filter => `subject:"${filter}"`)
        .join(' OR ');
      queryParts.push(`(${contentConditions})`);
    }

    // Sender filters (OR condition)
    if (senderFilters.length > 0) {
      const senderConditions = senderFilters
        .map(sender => `from:"${sender}"`)
        .join(' OR ');
      queryParts.push(`(${senderConditions})`);
    }

    // Read status
    if (!includeRead) {
      queryParts.push('isRead:false');
    }

    // Attachment type hints - Disabled temporarily for debugging
    // queryParts.push('(attachment:xml OR attachment:zip OR attachment:pdf OR attachment:rar)');

    return queryParts.join(' AND ');
  }

  /**
   * Check if attachment is invoice-related
   */
  private isInvoiceRelatedAttachment(filename: string, extension: string): boolean {
    // Archive files that might contain invoices
    if (['.zip', '.rar'].includes(extension)) {
      return true;
    }

    // Direct invoice files
    if (extension === '.xml') {
      const invoicePatterns = [
        /factura/i,
        /invoice/i,
        /fe_/i, // Facturación Electrónica
        /ubl/i, // UBL format
        /dian/i, // DIAN related
        /fv_/i, // Factura de Venta
        /comprobante/i,
      ];
      
      return invoicePatterns.some(pattern => pattern.test(filename));
    }

    // PDF invoices (lower priority)
    if (extension === '.pdf') {
      const pdfInvoicePatterns = [
        /factura/i,
        /invoice/i,
        /comprobante/i,
      ];
      
      return pdfInvoicePatterns.some(pattern => pattern.test(filename));
    }

    return false;
  }

  /**
   * Get file extension with dot
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > -1 ? filename.substring(lastDot).toLowerCase() : '';
  }

  /**
   * Mark email as processed (add category or flag)
   */
  async markEmailAsProcessed(messageId: string): Promise<boolean> {
    try {
      const mailbox = this.validMailbox || this.credentials.mailbox || 'ventas@tdxcore.com';
      await this.client
        .api(`/users/${mailbox}/messages/${messageId}`)
        .patch({
          categories: ['Processed by CFO SaaS'],
          isRead: true
        });

      return true;
    } catch (error) {
      console.error(`Failed to mark email ${messageId} as processed:`, error);
      return false;
    }
  }

  /**
   * Get user mailbox info
   */
  async getMailboxInfo(): Promise<any> {
    try {
      const mailbox = this.validMailbox || this.credentials.mailbox || 'ventas@tdxcore.com';
      const user = await this.client.api(`/users/${mailbox}`).get();
      return {
        id: user.id,
        email: user.mail || user.userPrincipalName,
        displayName: user.displayName,
        mailboxType: user.mailboxType || 'user'
      };
    } catch (error) {
      throw new Error(`Failed to get mailbox info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const createMicrosoftGraphConnector = (credentials: MicrosoftGraphCredentials) => {
  return new MicrosoftGraphConnector(credentials);
};