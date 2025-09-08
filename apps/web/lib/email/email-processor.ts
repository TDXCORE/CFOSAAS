/**
 * Email Processing Service
 * Integrates with Microsoft Graph API to read O365/Outlook emails
 * Processes ZIP attachments containing XML invoice files
 */

import { invoiceStorage } from '~/lib/storage/invoice-storage';
import { xmlProcessor } from '~/lib/invoices/xml-processor';
import { invoicesService } from '~/lib/invoices/invoices-service';
import type { CreateInvoiceInput } from '~/lib/invoices/types';

interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string; // Base64 encoded
}

interface EmailMessage {
  id: string;
  subject: string;
  sender: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  receivedDateTime: string;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
}

interface EmailProcessingResult {
  success: boolean;
  processedEmails: number;
  processedInvoices: number;
  errors: string[];
  invoiceIds: string[];
}

interface GraphApiTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

class EmailProcessorService {
  private readonly GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
  
  /**
   * Process emails from Microsoft Graph API
   */
  async processEmails(
    companyId: string,
    tokens: GraphApiTokens,
    options: {
      since?: Date;
      maxEmails?: number;
      senderFilter?: string[];
      subjectKeywords?: string[];
    } = {}
  ): Promise<EmailProcessingResult> {
    const result: EmailProcessingResult = {
      success: false,
      processedEmails: 0,
      processedInvoices: 0,
      errors: [],
      invoiceIds: [],
    };

    try {
      // Get emails from Outlook
      const emails = await this.fetchEmails(tokens.accessToken, options);
      
      if (!emails || emails.length === 0) {
        result.success = true;
        return result;
      }

      // Process each email
      for (const email of emails) {
        try {
          const emailResult = await this.processEmail(email, companyId, tokens.accessToken);
          
          if (emailResult.success) {
            result.processedEmails++;
            result.processedInvoices += emailResult.invoicesProcessed;
            result.invoiceIds.push(...emailResult.invoiceIds);
          } else {
            result.errors.push(...emailResult.errors);
          }
        } catch (error) {
          const errorMsg = `Error processing email ${email.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      result.success = result.errors.length === 0 || result.processedEmails > 0;
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Email processing failed:', errorMsg);
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Fetch emails from Microsoft Graph API
   */
  private async fetchEmails(
    accessToken: string,
    options: {
      since?: Date;
      maxEmails?: number;
      senderFilter?: string[];
      subjectKeywords?: string[];
    }
  ): Promise<EmailMessage[]> {
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // Build query parameters
    const params = new URLSearchParams();
    
    // Filter by date
    if (options.since) {
      params.append('$filter', `receivedDateTime ge ${options.since.toISOString()}`);
    }

    // Only emails with attachments
    if (!params.has('$filter')) {
      params.append('$filter', 'hasAttachments eq true');
    } else {
      params.set('$filter', params.get('$filter') + ' and hasAttachments eq true');
    }

    // Limit results
    if (options.maxEmails) {
      params.append('$top', options.maxEmails.toString());
    }

    // Sort by received date (newest first)
    params.append('$orderby', 'receivedDateTime desc');

    // Select required fields
    params.append('$select', 'id,subject,sender,receivedDateTime,hasAttachments');

    const url = `${this.GRAPH_API_BASE}/me/messages?${params.toString()}`;
    
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let emails: EmailMessage[] = data.value || [];

    // Apply client-side filters
    if (options.senderFilter?.length) {
      emails = emails.filter(email => 
        options.senderFilter!.some(sender => 
          email.sender?.emailAddress?.address?.toLowerCase().includes(sender.toLowerCase())
        )
      );
    }

    if (options.subjectKeywords?.length) {
      emails = emails.filter(email =>
        options.subjectKeywords!.some(keyword =>
          email.subject?.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    return emails;
  }

  /**
   * Process a single email message
   */
  private async processEmail(
    email: EmailMessage,
    companyId: string,
    accessToken: string
  ): Promise<{
    success: boolean;
    invoicesProcessed: number;
    invoiceIds: string[];
    errors: string[];
  }> {
    const result = {
      success: false,
      invoicesProcessed: 0,
      invoiceIds: [] as string[],
      errors: [] as string[],
    };

    try {
      // Get email attachments
      const attachments = await this.getEmailAttachments(email.id, accessToken);
      
      if (!attachments || attachments.length === 0) {
        return result;
      }

      // Process each attachment
      for (const attachment of attachments) {
        try {
          if (this.isProcessableAttachment(attachment)) {
            const attachmentResult = await this.processAttachment(
              attachment,
              companyId,
              {
                emailId: email.id,
                emailSender: email.sender?.emailAddress?.address,
                emailSubject: email.subject,
                receivedDate: email.receivedDateTime,
              }
            );

            if (attachmentResult.success) {
              result.invoicesProcessed += attachmentResult.invoicesProcessed;
              result.invoiceIds.push(...attachmentResult.invoiceIds);
            } else {
              result.errors.push(...attachmentResult.errors);
            }
          }
        } catch (error) {
          const errorMsg = `Error processing attachment ${attachment.name}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      result.success = result.invoicesProcessed > 0 || result.errors.length === 0;
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Get attachments for an email
   */
  private async getEmailAttachments(
    emailId: string,
    accessToken: string
  ): Promise<EmailAttachment[]> {
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const url = `${this.GRAPH_API_BASE}/me/messages/${emailId}/attachments`;
    
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to get attachments: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Check if attachment is processable (XML, PDF, or ZIP)
   */
  private isProcessableAttachment(attachment: EmailAttachment): boolean {
    const processableTypes = [
      'application/xml',
      'text/xml',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
    ];

    const processableExtensions = ['.xml', '.pdf', '.zip'];

    return (
      processableTypes.includes(attachment.contentType) ||
      processableExtensions.some(ext => 
        attachment.name.toLowerCase().endsWith(ext)
      )
    );
  }

  /**
   * Process individual attachment
   */
  private async processAttachment(
    attachment: EmailAttachment,
    companyId: string,
    emailMetadata: {
      emailId: string;
      emailSender?: string;
      emailSubject?: string;
      receivedDate?: string;
    }
  ): Promise<{
    success: boolean;
    invoicesProcessed: number;
    invoiceIds: string[];
    errors: string[];
  }> {
    const result = {
      success: false,
      invoicesProcessed: 0,
      invoiceIds: [] as string[],
      errors: [] as string[],
    };

    try {
      if (!attachment.contentBytes) {
        result.errors.push(`No content available for attachment ${attachment.name}`);
        return result;
      }

      // Decode base64 content
      const buffer = Buffer.from(attachment.contentBytes, 'base64');
      const file = new File([buffer], attachment.name, {
        type: attachment.contentType,
      });

      // Upload file to storage
      const uploadResult = await invoiceStorage.uploadFile(file, {
        originalName: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        companyId,
        fileType: invoiceStorage.getFileType(attachment.name) as 'xml' | 'pdf' | 'zip',
      });

      if (!uploadResult.success) {
        result.errors.push(uploadResult.error || 'File upload failed');
        return result;
      }

      // Process based on file type
      const fileType = invoiceStorage.getFileType(attachment.name);

      if (fileType === 'xml') {
        // Process XML directly
        const xmlContent = buffer.toString('utf-8');
        const processingResult = await xmlProcessor.processXMLInvoice(xmlContent);

        if (processingResult.invoice) {
          const { data: invoice, error } = await invoicesService.createInvoice(
            {
              ...processingResult.invoice,
              source_file_name: attachment.name,
              source_file_type: 'xml',
              source_file_url: uploadResult.publicUrl,
              source_email_id: emailMetadata.emailId,
              source_email_sender: emailMetadata.emailSender,
            },
            companyId
          );

          if (invoice) {
            result.invoicesProcessed = 1;
            result.invoiceIds.push(invoice.id);
          } else {
            result.errors.push(error || 'Failed to save XML invoice');
          }
        } else {
          result.errors.push(processingResult.error || 'Failed to process XML');
        }

      } else if (fileType === 'zip') {
        // Process ZIP file
        const zipResult = await invoiceStorage.processZipFile(file, {
          originalName: attachment.name,
          contentType: attachment.contentType,
          size: attachment.size,
          companyId,
          fileType: 'zip',
        });

        if (zipResult.success && zipResult.extractedFiles) {
          // Process each extracted XML file
          for (const extractedFile of zipResult.extractedFiles) {
            if (extractedFile.type === 'xml') {
              try {
                const processingResult = await xmlProcessor.processXMLInvoice(
                  extractedFile.content
                );

                if (processingResult.invoice) {
                  const { data: invoice, error } = await invoicesService.createInvoice(
                    {
                      ...processingResult.invoice,
                      source_file_name: extractedFile.name,
                      source_file_type: 'xml',
                      source_file_url: uploadResult.publicUrl,
                      source_email_id: emailMetadata.emailId,
                      source_email_sender: emailMetadata.emailSender,
                    },
                    companyId
                  );

                  if (invoice) {
                    result.invoicesProcessed++;
                    result.invoiceIds.push(invoice.id);
                  }
                }
              } catch (error) {
                console.warn(`Failed to process ${extractedFile.name}:`, error);
              }
            }
          }
        } else {
          result.errors.push(zipResult.error || 'ZIP processing failed');
        }

      } else if (fileType === 'pdf') {
        // Create placeholder for PDF
        const invoiceNumber = `PDF-${Date.now()}`;
        
        const { data: invoice, error } = await invoicesService.createInvoice(
          {
            invoice_number: invoiceNumber,
            issue_date: new Date().toISOString().split('T')[0],
            supplier_tax_id: '000000000',
            supplier_name: 'PDF Email Import - Requires Manual Entry',
            subtotal: 0,
            total_amount: 0,
            source_file_name: attachment.name,
            source_file_type: 'pdf',
            source_file_url: uploadResult.publicUrl,
            source_email_id: emailMetadata.emailId,
            source_email_sender: emailMetadata.emailSender,
            status: 'pending',
            processing_status: 'uploaded',
            manual_review_required: true,
          },
          companyId
        );

        if (invoice) {
          result.invoicesProcessed = 1;
          result.invoiceIds.push(invoice.id);
        } else {
          result.errors.push(error || 'Failed to save PDF placeholder');
        }
      }

      result.success = result.invoicesProcessed > 0;
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Test Microsoft Graph API connection
   */
  async testConnection(accessToken: string): Promise<{
    success: boolean;
    userInfo?: any;
    error?: string;
  }> {
    try {
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${this.GRAPH_API_BASE}/me`, { headers });

      if (!response.ok) {
        return {
          success: false,
          error: `Graph API error: ${response.status} ${response.statusText}`,
        };
      }

      const userInfo = await response.json();
      return {
        success: true,
        userInfo,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    tenantId: string = 'common'
  ): Promise<{
    success: boolean;
    tokens?: GraphApiTokens;
    error?: string;
  }> {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/Mail.Read offline_access',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Token refresh failed: ${response.status} ${response.statusText}`,
        };
      }

      const tokenData = await response.json();

      return {
        success: true,
        tokens: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || refreshToken,
          expiresAt: Date.now() + (tokenData.expires_in * 1000),
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      };
    }
  }
}

export const emailProcessor = new EmailProcessorService();
export type { EmailProcessingResult, GraphApiTokens };