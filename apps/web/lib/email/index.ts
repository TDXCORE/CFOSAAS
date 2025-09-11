/**
 * Email Processor Service
 * Orchestrates the complete flow: Email -> ZIP extraction -> XML processing -> Invoice creation
 */

import { MicrosoftGraphConnector, type MicrosoftGraphCredentials, type EmailProcessingResult, type ProcessedEmailMessage } from './microsoft-graph-connector';
import { ZipExtractorService, type ExtractedFile, type ExtractionResult } from './zip-extractor';
import { xmlProcessor } from '../invoices/xml-processor';
import { invoicesService } from '../invoices/invoices-service';
import { getSupabaseServiceClient } from '../supabase/service-client';

export interface EmailProcessingConfig {
  microsoftGraph: MicrosoftGraphCredentials;
  processingOptions: {
    maxEmails?: number;
    daysBack?: number;
    includeRead?: boolean;
    autoMarkProcessed?: boolean;
    subjectFilters?: string[];
    senderFilters?: string[];
  };
  storageConfig: {
    bucketName: string;
    basePath: string; // e.g., "email-attachments"
  };
}

export interface AutoProcessingResult {
  success: boolean;
  summary: {
    totalEmails: number;
    processedEmails: number;
    extractedFiles: number;
    processedInvoices: number;
    errors: number;
  };
  results: EmailInvoiceProcessingResult[];
  errors: string[];
  processingTime: number;
}

export interface EmailInvoiceProcessingResult {
  emailId: string;
  subject: string;
  from: string;
  attachments: {
    filename: string;
    extractionResult?: ExtractionResult;
    invoiceResults: InvoiceProcessingResult[];
  }[];
  success: boolean;
  errors: string[];
}

export interface InvoiceProcessingResult {
  filename: string;
  invoiceId?: string;
  success: boolean;
  error?: string;
  validationErrors?: string[];
  invoice?: {
    invoiceNumber: string;
    supplierName: string;
    totalAmount: number;
    pucCode: string;
  };
}

export class EmailInvoiceProcessor {
  private graphConnector: MicrosoftGraphConnector;
  private zipExtractor: ZipExtractorService;
  private supabase = getSupabaseServiceClient();

  constructor(private config: EmailProcessingConfig) {
    this.graphConnector = new MicrosoftGraphConnector(config.microsoftGraph);
    this.zipExtractor = new ZipExtractorService();
  }

  /**
   * Process emails automatically and extract invoices
   */
  async processEmailsForInvoices(companyId: string): Promise<AutoProcessingResult> {
    const startTime = Date.now();
    
    const result: AutoProcessingResult = {
      success: false,
      summary: {
        totalEmails: 0,
        processedEmails: 0,
        extractedFiles: 0,
        processedInvoices: 0,
        errors: 0
      },
      results: [],
      errors: [],
      processingTime: 0
    };

    try {
      console.log('🚀 Starting automated email invoice processing...');

      // Step 1: Search for invoice emails
      const emailSearchResult = await this.searchInvoiceEmails();
      result.summary.totalEmails = emailSearchResult.totalEmails;

      console.log(`📊 Email search result: ${emailSearchResult.totalEmails} emails found`);
      console.log(`📊 Processed messages: ${emailSearchResult.processedMessages.length}`);
      console.log(`📊 Search errors: ${emailSearchResult.errors.length}`);
      if (emailSearchResult.errors.length > 0) {
        console.log('❌ Search errors:', emailSearchResult.errors);
      }

      if (emailSearchResult.totalEmails === 0) {
        console.log('📭 No invoice emails found');
        result.success = true;
        result.processingTime = Date.now() - startTime;
        return result;
      }

      console.log(`📨 Found ${emailSearchResult.totalEmails} potential invoice emails`);

      // Step 2: Process each email with attachments
      for (const emailMessage of emailSearchResult.processedMessages) {
        try {
          const emailResult = await this.processEmailForInvoices(emailMessage, companyId);
          result.results.push(emailResult);

          if (emailResult.success) {
            result.summary.processedEmails++;
            
            // Count extracted files and processed invoices
            for (const attachment of emailResult.attachments) {
              if (attachment.extractionResult) {
                result.summary.extractedFiles += attachment.extractionResult.files.length;
              }
              result.summary.processedInvoices += attachment.invoiceResults.filter(r => r.success).length;
            }

            // Mark email as processed if configured
            if (this.config.processingOptions.autoMarkProcessed) {
              await this.graphConnector.markEmailAsProcessed(emailMessage.emailId);
            }
          } else {
            result.summary.errors++;
          }

        } catch (error) {
          const errorMessage = `Failed to process email ${emailMessage.emailId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMessage);
          result.summary.errors++;
          console.error('❌', errorMessage);
        }
      }

      result.success = result.summary.errors < result.summary.totalEmails; // Success if majority processed
      result.processingTime = Date.now() - startTime;

      console.log(`✅ Email processing completed:
        - Total emails: ${result.summary.totalEmails}
        - Successfully processed: ${result.summary.processedEmails}
        - Extracted files: ${result.summary.extractedFiles}
        - Created invoices: ${result.summary.processedInvoices}
        - Errors: ${result.summary.errors}
        - Processing time: ${result.processingTime}ms`);

      return result;

    } catch (error) {
      result.errors.push(`Email processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Search for invoice emails using Microsoft Graph
   */
  private async searchInvoiceEmails(): Promise<EmailProcessingResult> {
    const searchOptions = {
      maxEmails: this.config.processingOptions.maxEmails || 20,
      daysBack: this.config.processingOptions.daysBack || 7,
      includeRead: this.config.processingOptions.includeRead ?? true,
      subjectFilters: this.config.processingOptions.subjectFilters || [
        'factura', 'invoice', 'comprobante', 'fe_', 'fv_', 'dian'
      ],
      senderFilters: this.config.processingOptions.senderFilters || [],
      attachmentExtensions: ['.zip', '.rar', '.xml', '.pdf']
    };

    return await this.graphConnector.searchInvoiceEmails(searchOptions);
  }

  /**
   * Test the email connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; mailboxInfo?: any }> {
    try {
      const connectionTest = await this.graphConnector.testConnection();
      
      if (connectionTest.success) {
        const mailboxInfo = await this.graphConnector.getMailboxInfo();
        return { success: true, mailboxInfo };
      } else {
        return { success: false, error: connectionTest.error };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown connection error' 
      };
    }
  }

  /**
   * Process individual email with attachments for invoice extraction
   */
  private async processEmailForInvoices(
    emailMessage: ProcessedEmailMessage, 
    companyId: string
  ): Promise<EmailInvoiceProcessingResult> {
    const result: EmailInvoiceProcessingResult = {
      emailId: emailMessage.emailId,
      subject: emailMessage.subject,
      from: emailMessage.from,
      attachments: [],
      success: false,
      errors: []
    };

    try {
      console.log(`🔄 Processing email: "${emailMessage.subject}"`);

      // Process each attachment
      for (const attachment of emailMessage.attachments) {
        if (!attachment.isInvoiceRelated) {
          continue; // Skip non-invoice attachments
        }

        const attachmentResult = {
          filename: attachment.name,
          extractionResult: undefined as ExtractionResult | undefined,
          invoiceResults: [] as InvoiceProcessingResult[]
        };

        try {
          console.log(`📎 Processing attachment: ${attachment.name}`);

          // Check if it's a compressed file that needs extraction
          const extension = this.getFileExtension(attachment.name);
          if (['.zip', '.rar'].includes(extension)) {
            // Extract compressed file
            console.log(`📦 Extracting compressed file: ${attachment.name}`);
            
            try {
              // Get attachment content (it should already be downloaded)
              if (!attachment.contentBytes) {
                throw new Error('Attachment content not available');
              }

              // Extract the compressed file
              const extractionResult = await this.zipExtractor.extractFiles(
                attachment.contentBytes, 
                attachment.name
              );
              
              attachmentResult.extractionResult = extractionResult;
              console.log(`📦 Extraction result: ${extractionResult.success ? 'SUCCESS' : 'FAILED'}`);
              console.log(`📁 Found ${extractionResult.files.length} files`);

              if (extractionResult.success && extractionResult.files.length > 0) {
                // Process each extracted XML file
                for (const extractedFile of extractionResult.files) {
                  if (extractedFile.extension === '.xml') {
                    console.log(`📄 Processing extracted XML: ${extractedFile.name}`);
                    
                    const xmlProcessingResult = await this.processXMLContent(
                      extractedFile.content.toString('utf-8'), 
                      extractedFile.name, 
                      companyId
                    );
                    
                    attachmentResult.invoiceResults.push(xmlProcessingResult);
                  }
                }
              }

            } catch (extractionError) {
              const errorMessage = `ZIP extraction failed: ${extractionError instanceof Error ? extractionError.message : 'Unknown error'}`;
              console.error(`❌ ${errorMessage}`);
              attachmentResult.extractionResult = {
                success: false,
                files: [],
                errors: [errorMessage]
              };
            }

          } else if (extension === '.xml') {
            // Process XML directly
            console.log(`📄 Processing XML file: ${attachment.name}`);
            
            try {
              if (!attachment.contentBytes) {
                throw new Error('XML attachment content not available');
              }

              const xmlContent = attachment.contentBytes.toString('utf-8');
              const xmlProcessingResult = await this.processXMLContent(
                xmlContent, 
                attachment.name, 
                companyId
              );
              
              attachmentResult.invoiceResults.push(xmlProcessingResult);

            } catch (xmlError) {
              const errorMessage = `XML processing failed: ${xmlError instanceof Error ? xmlError.message : 'Unknown error'}`;
              console.error(`❌ ${errorMessage}`);
              attachmentResult.invoiceResults.push({
                filename: attachment.name,
                success: false,
                error: errorMessage
              });
            }
          }

        } catch (attachmentError) {
          const errorMessage = `Failed to process attachment ${attachment.name}: ${attachmentError instanceof Error ? attachmentError.message : 'Unknown error'}`;
          result.errors.push(errorMessage);
          console.error('❌', errorMessage);
        }

        result.attachments.push(attachmentResult);
      }

      // Calculate success based on whether we processed any invoices successfully
      const totalInvoiceResults = result.attachments.reduce((sum, att) => sum + att.invoiceResults.length, 0);
      const successfulInvoices = result.attachments.reduce((sum, att) => 
        sum + att.invoiceResults.filter(inv => inv.success).length, 0);
      const totalExtractions = result.attachments.filter(att => att.extractionResult?.success).length;

      result.success = successfulInvoices > 0 || result.errors.length === 0;
      
      console.log(`📊 Email processing summary:
        - Attachments processed: ${result.attachments.length}
        - Extraction results: ${totalExtractions}
        - Invoice processing attempts: ${totalInvoiceResults}
        - Successfully created invoices: ${successfulInvoices}
        - Errors: ${result.errors.length}`);
      
      return result;

    } catch (error) {
      result.errors.push(`Email processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Process XML content and create invoice record
   */
  private async processXMLContent(
    xmlContent: string,
    fileName: string,
    companyId: string
  ): Promise<InvoiceProcessingResult> {
    try {
      console.log(`🔍 Processing XML content from: ${fileName}`);

      // Process XML with the Colombian processor
      const processingResult = await xmlProcessor.processXMLInvoice(xmlContent);
      
      if (processingResult.error || !processingResult.invoice) {
        console.log(`❌ XML processing failed: ${processingResult.error}`);
        return {
          filename: fileName,
          success: false,
          error: processingResult.error || 'No invoice data extracted',
          validationErrors: processingResult.validationErrors
        };
      }

      // Add file information to invoice data
      const invoiceData = {
        ...processingResult.invoice,
        source_file_name: fileName,
        source_file_type: 'xml' as const,
      };

      // Create invoice in database
      console.log(`💾 Creating invoice in database: ${invoiceData.invoice_number}`);
      const createResult = await invoicesService.createInvoice(invoiceData, companyId);

      if (createResult.error || !createResult.data) {
        console.log(`❌ Database creation failed: ${createResult.error}`);
        return {
          filename: fileName,
          success: false,
          error: createResult.error || 'Failed to create invoice in database',
          validationErrors: processingResult.validationErrors
        };
      }

      // Classify invoice automatically using PUC classifier
      console.log(`🏷️ Attempting PUC classification...`);
      try {
        const classificationResult = await invoicesService.classifyInvoicePUC(
          createResult.data.id,
          companyId
        );
        
        if (classificationResult.success) {
          console.log(`✅ PUC classification successful: ${classificationResult.puc_code}`);
        } else {
          console.log(`⚠️ PUC classification failed: ${classificationResult.error}`);
        }
      } catch (classificationError) {
        console.error('❌ Error during PUC classification:', classificationError);
        // Continue without failing the entire operation
      }

      console.log(`✅ Invoice created successfully: ${createResult.data.invoice_number}`);
      return {
        filename: fileName,
        invoiceId: createResult.data.id,
        success: true,
        invoice: {
          invoiceNumber: createResult.data.invoice_number,
          supplierName: createResult.data.supplier_name,
          totalAmount: createResult.data.total_amount,
          pucCode: createResult.data.puc_code || 'N/A'
        }
      };

    } catch (error) {
      console.error(`❌ Error processing XML ${fileName}:`, error);
      return {
        filename: fileName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown XML processing error'
      };
    }
  }

  /**
   * Get file extension with dot
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > -1 ? filename.substring(lastDot).toLowerCase() : '';
  }
}

export const createEmailInvoiceProcessor = (config: EmailProcessingConfig) => {
  return new EmailInvoiceProcessor(config);
};