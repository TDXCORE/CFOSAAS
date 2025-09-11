/**
 * Colombian XML Invoice Processor
 * Processes UBL XML invoices according to Colombian electronic invoice standards
 */

import { XMLParser } from 'fast-xml-parser';
import type {
  ColombianXMLInvoice,
  CreateInvoiceInput,
  CreateInvoiceLineItemInput,
  CreateInvoiceTaxInput,
  ProcessingMetadata,
  ValidationError,
} from './types';

export class ColombianXMLProcessor {
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
      removeNSPrefix: true, // Remove namespace prefixes
      parseTagValue: true,
      parseTrueNumberOnly: false,
      arrayMode: false,
      allowBooleanAttributes: true,
    });
  }

  /**
   * Process Colombian UBL XML invoice
   */
  async processXMLInvoice(xmlContent: string): Promise<{
    invoice: CreateInvoiceInput | null;
    metadata: ProcessingMetadata;
    validationErrors: ValidationError[];
    error?: string;
  }> {
    const startTime = Date.now();
    const validationErrors: ValidationError[] = [];
    const metadata: ProcessingMetadata = {
      extraction_method: 'xml_parse',
      processing_steps: [],
      processing_time_ms: 0,
    };

    try {
      // Parse XML
      metadata.processing_steps!.push('xml_parsing');
      const parsedXML = this.xmlParser.parse(xmlContent) as any;
      
      // Find invoice root (could be nested)
      console.log('🔍 Parsed XML root keys:', Object.keys(parsedXML));
      const invoiceData = this.findInvoiceRoot(parsedXML);
      
      if (!invoiceData) {
        console.error('❌ No invoice root found. Available paths checked:');
        console.error('parsedXML.Invoice:', !!parsedXML.Invoice);
        console.error('parsedXML["fe:Invoice"]:', !!parsedXML['fe:Invoice']);
        console.error('parsedXML["xmlns:Invoice"]:', !!parsedXML['xmlns:Invoice']);
        console.error('parsedXML.Document?.Invoice:', !!parsedXML.Document?.Invoice);
        console.error('parsedXML.UBLDocument?.Invoice:', !!parsedXML.UBLDocument?.Invoice);
        
        return {
          invoice: null,
          metadata,
          validationErrors,
          error: 'No valid invoice structure found in XML',
        };
      }

      // Validate XML structure
      metadata.processing_steps!.push('xml_validation');
      const structureValidation = this.validateXMLStructure(invoiceData);
      validationErrors.push(...structureValidation);

      if (structureValidation.some(e => e.severity === 'error')) {
        return {
          invoice: null,
          metadata,
          validationErrors,
          error: 'XML structure validation failed',
        };
      }

      // Extract invoice data
      metadata.processing_steps!.push('data_extraction');
      const invoice = await this.extractInvoiceData(invoiceData);
      
      if (!invoice) {
        return {
          invoice: null,
          metadata,
          validationErrors,
          error: 'Failed to extract invoice data from XML',
        };
      }

      // Business validation
      metadata.processing_steps!.push('business_validation');
      const businessValidation = this.validateBusinessRules(invoice);
      validationErrors.push(...businessValidation);

      // Calculate confidence
      const confidence = this.calculateExtractionConfidence(
        invoice,
        validationErrors,
        invoiceData
      );
      
      metadata.extraction_confidence = confidence;
      metadata.processing_time_ms = Date.now() - startTime;

      return {
        invoice,
        metadata,
        validationErrors,
      };

    } catch (error) {
      metadata.processing_time_ms = Date.now() - startTime;
      console.error('Error processing XML invoice:', error);
      
      return {
        invoice: null,
        metadata,
        validationErrors,
        error: `XML processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Find the invoice root in the parsed XML
   */
  private findInvoiceRoot(parsedXML: any): ColombianXMLInvoice | null {
    console.log('🔍 Looking for Invoice root in keys:', Object.keys(parsedXML));
    
    // Check if this is an AttachedDocument with embedded invoice
    if (parsedXML.AttachedDocument) {
      console.log('📎 Found AttachedDocument, looking for embedded Invoice...');
      const embeddedInvoice = this.extractEmbeddedInvoice(parsedXML.AttachedDocument);
      if (embeddedInvoice) {
        console.log('✅ Successfully extracted embedded Invoice from AttachedDocument');
        return { Invoice: embeddedInvoice };
      }
    }
    
    // Standard invoice root paths
    const possiblePaths = [
      parsedXML.Invoice,
      parsedXML['fe:Invoice'],
      parsedXML['xmlns:Invoice'],
      parsedXML.Document?.Invoice,
      parsedXML.UBLDocument?.Invoice,
      // Direct access for debugging
      parsedXML,
    ];

    for (let i = 0; i < possiblePaths.length; i++) {
      const path = possiblePaths[i];
      console.log(`🔍 Checking path ${i}:`, !!path, path ? Object.keys(path).slice(0, 5) : 'null');
      
      if (path && this.isValidInvoiceStructure(path)) {
        console.log('✅ Found valid invoice structure at path', i);
        return { Invoice: path };
      }
    }

    console.log('❌ No valid invoice structure found in any path');
    return null;
  }

  /**
   * Extract embedded invoice from AttachedDocument CDATA
   */
  private extractEmbeddedInvoice(attachedDoc: any): any | null {
    try {
      console.log('🔍 Extracting embedded invoice from AttachedDocument...');
      
      // Look for the CDATA content in Attachment > ExternalReference > Description
      const description = attachedDoc.Attachment?.ExternalReference?.Description;
      
      if (!description || typeof description !== 'string') {
        console.log('❌ No description found in AttachedDocument');
        return null;
      }

      console.log('📄 Found CDATA content, length:', description.length);
      
      // The description contains the full Invoice XML as CDATA
      // Extract the Invoice XML (it should start with <?xml and contain <Invoice>)
      const invoiceXmlMatch = description.match(/<Invoice[^>]*>[\s\S]*<\/Invoice>/);
      
      if (!invoiceXmlMatch) {
        console.log('❌ No Invoice XML found in CDATA');
        return null;
      }

      const invoiceXml = invoiceXmlMatch[0];
      console.log('✅ Extracted Invoice XML from CDATA, length:', invoiceXml.length);
      
      // Parse the extracted Invoice XML
      const parsedInvoice = this.xmlParser.parse(invoiceXml);
      console.log('✅ Parsed embedded Invoice, keys:', Object.keys(parsedInvoice));
      
      // Return the Invoice part
      return parsedInvoice.Invoice || parsedInvoice;
      
    } catch (error) {
      console.error('❌ Error extracting embedded invoice:', error);
      return null;
    }
  }

  /**
   * Check if the structure looks like a valid UBL invoice
   */
  private isValidInvoiceStructure(invoice: any): boolean {
    console.log('🔍 Checking invoice structure. Keys:', Object.keys(invoice).slice(0, 10));
    console.log('🔍 Looking for: ID, IssueDate, AccountingSupplierParty, LegalMonetaryTotal');
    console.log('🔍 Found:', {
      ID: !!invoice.ID,
      IssueDate: !!invoice.IssueDate,
      AccountingSupplierParty: !!invoice.AccountingSupplierParty,
      LegalMonetaryTotal: !!invoice.LegalMonetaryTotal,
      'cbc:ID': !!invoice['cbc:ID'],
      'cbc:IssueDate': !!invoice['cbc:IssueDate'],
      'cac:AccountingSupplierParty': !!invoice['cac:AccountingSupplierParty'],
      'cac:LegalMonetaryTotal': !!invoice['cac:LegalMonetaryTotal']
    });
    
    return !!(
      invoice.ID ||
      invoice.IssueDate ||
      invoice.AccountingSupplierParty ||
      invoice.LegalMonetaryTotal ||
      invoice['cbc:ID'] ||
      invoice['cbc:IssueDate'] ||
      invoice['cac:AccountingSupplierParty'] ||
      invoice['cac:LegalMonetaryTotal']
    );
  }

  /**
   * Validate XML structure against Colombian UBL standards
   */
  private validateXMLStructure(invoiceData: ColombianXMLInvoice): ValidationError[] {
    const errors: ValidationError[] = [];
    const invoice = invoiceData.Invoice;

    // Required fields validation
    if (!invoice.ID) {
      errors.push({
        field: 'invoice_number',
        message: 'Invoice ID is required',
        severity: 'error',
      });
    }

    if (!invoice.IssueDate) {
      errors.push({
        field: 'issue_date',
        message: 'Issue date is required',
        severity: 'error',
      });
    }

    if (!invoice.AccountingSupplierParty) {
      errors.push({
        field: 'supplier',
        message: 'Supplier information is required',
        severity: 'error',
      });
    }

    if (!invoice.LegalMonetaryTotal) {
      errors.push({
        field: 'totals',
        message: 'Monetary totals are required',
        severity: 'error',
      });
    }

    // Colombian specific validations
    if (invoice.AccountingSupplierParty) {
      const supplier = invoice.AccountingSupplierParty.Party;
      if (!supplier?.PartyTaxScheme?.CompanyID) {
        errors.push({
          field: 'supplier_tax_id',
          message: 'Supplier NIT is required',
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Extract invoice data from validated XML
   */
  private async extractInvoiceData(invoiceData: ColombianXMLInvoice): Promise<CreateInvoiceInput | null> {
    try {
      const invoice = invoiceData.Invoice;

      // Extract basic invoice info
      const invoiceNumber = this.extractText(invoice.ID);
      const issueDate = this.extractText(invoice.IssueDate);
      const dueDate = invoice.DueDate ? this.extractText(invoice.DueDate) : undefined;

      // Extract supplier information
      const supplier = invoice.AccountingSupplierParty?.Party;
      const supplierTaxId = supplier?.PartyTaxScheme?.CompanyID || 
                           supplier?.PartyIdentification?.[0]?.ID?._text || '';
      const supplierName = supplier?.PartyTaxScheme?.RegistrationName ||
                          supplier?.PartyName?.Name || '';

      // Extract customer information (optional)
      const customer = invoice.AccountingCustomerParty?.Party;
      const customerTaxId = customer?.PartyTaxScheme?.CompanyID ||
                           customer?.PartyIdentification?.[0]?.ID?._text;
      const customerName = customer?.PartyTaxScheme?.RegistrationName ||
                          customer?.PartyName?.Name;

      // Extract monetary totals
      const totals = invoice.LegalMonetaryTotal;
      const subtotal = this.parseAmount(totals?.LineExtensionAmount);
      const totalAmount = this.parseAmount(totals?.PayableAmount);
      const currency = this.extractCurrency(totals?.PayableAmount) || 'COP';

      // Extract tax information
      const taxTotals = Array.isArray(invoice.TaxTotal) ? invoice.TaxTotal : [invoice.TaxTotal].filter(Boolean);
      const totalTax = taxTotals.reduce((sum, taxTotal) => {
        return sum + this.parseAmount(taxTotal.TaxAmount);
      }, 0);

      // Extract line items
      const invoiceLines = Array.isArray(invoice.InvoiceLine) ? 
        invoice.InvoiceLine : [invoice.InvoiceLine].filter(Boolean);
      
      const lineItems: CreateInvoiceLineItemInput[] = invoiceLines.map((line, index) => ({
        line_number: index + 1,
        product_code: line.Item?.SellersItemIdentification?.ID || '',
        product_name: Array.isArray(line.Item?.Description) ? 
          line.Item.Description.join(' ') : 
          (line.Item?.Description || ''),
        quantity: this.parseAmount(line.InvoicedQuantity) || 1,
        unit_price: this.parseAmount(line.Price?.PriceAmount) || 0,
        discount_percentage: 0, // Would need to extract from allowances/charges
        discount_amount: 0,
        line_total: this.parseAmount(line.LineExtensionAmount) || 0,
      }));

      // Extract detailed tax information
      const taxes: CreateInvoiceTaxInput[] = [];
      
      taxTotals.forEach(taxTotal => {
        const taxSubtotals = Array.isArray(taxTotal.TaxSubtotal) ?
          taxTotal.TaxSubtotal : [taxTotal.TaxSubtotal].filter(Boolean);
        
        taxSubtotals.forEach(subtotal => {
          const taxScheme = subtotal.TaxCategory?.TaxScheme;
          const taxType = this.mapTaxSchemeToType(taxScheme?.ID || taxScheme?.Name);
          
          if (taxType) {
            taxes.push({
              tax_type: taxType,
              taxable_base: this.parseAmount(subtotal.TaxableAmount) || 0,
              tax_rate: subtotal.TaxCategory?.Percent ? 
                parseFloat(subtotal.TaxCategory.Percent) / 100 : 0,
              tax_amount: this.parseAmount(subtotal.TaxAmount) || 0,
              dian_code: taxScheme?.ID,
              calculation_method: 'automatic',
              applied_rule: `xml_extracted_${taxType}`,
            });
          }
        });
      });

      const result: CreateInvoiceInput = {
        invoice_number: invoiceNumber,
        document_type: 'invoice', // Could be extracted from document type code
        issue_date: (() => {
          const parsed = this.parseDate(issueDate);
          console.log('💾 FINAL DATE TO SAVE:', parsed);
          return parsed;
        })(),
        due_date: dueDate ? this.parseDate(dueDate) : undefined,
        supplier_tax_id: this.cleanNIT(supplierTaxId),
        supplier_name: supplierName,
        customer_tax_id: customerTaxId ? this.cleanNIT(customerTaxId) : undefined,
        customer_name: customerName,
        currency,
        subtotal,
        total_tax: totalTax,
        total_retention: 0, // Would need to be calculated based on rules
        total_amount: totalAmount,
        source_file_type: 'xml',
        line_items: lineItems,
        taxes: taxes,
      };

      return result;

    } catch (error) {
      console.error('Error extracting invoice data:', error);
      return null;
    }
  }

  /**
   * Validate business rules for Colombian invoices
   */
  private validateBusinessRules(invoice: CreateInvoiceInput): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate NIT format
    if (!this.isValidNIT(invoice.supplier_tax_id)) {
      errors.push({
        field: 'supplier_tax_id',
        message: 'Invalid NIT format',
        severity: 'error',
        suggestion: 'NIT should be 8-10 digits',
      });
    }

    // Validate amounts
    if (invoice.total_amount <= 0) {
      errors.push({
        field: 'total_amount',
        message: 'Total amount must be greater than zero',
        severity: 'error',
      });
    }

    // Check if subtotal + taxes approximately equals total
    const calculatedTotal = invoice.subtotal + (invoice.total_tax || 0);
    const difference = Math.abs(calculatedTotal - invoice.total_amount);
    if (difference > 0.01) { // Allow for small rounding differences
      errors.push({
        field: 'total_amount',
        message: 'Total amount does not match subtotal plus taxes',
        severity: 'warning',
        suggestion: `Expected ${calculatedTotal.toFixed(2)}, found ${invoice.total_amount.toFixed(2)}`,
      });
    }

    // Validate date format
    if (!this.isValidDate(invoice.issue_date)) {
      errors.push({
        field: 'issue_date',
        message: 'Invalid issue date format',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Calculate confidence score for extraction
   */
  private calculateExtractionConfidence(
    invoice: CreateInvoiceInput,
    validationErrors: ValidationError[],
    originalData: any
  ): number {
    let confidence = 1.0;

    // Deduct for validation errors
    const errorCount = validationErrors.filter(e => e.severity === 'error').length;
    const warningCount = validationErrors.filter(e => e.severity === 'warning').length;
    
    confidence -= errorCount * 0.2;
    confidence -= warningCount * 0.1;

    // Check data completeness
    const requiredFields = [
      'invoice_number', 'issue_date', 'supplier_tax_id', 
      'supplier_name', 'subtotal', 'total_amount'
    ];
    
    const missingFields = requiredFields.filter(field => !invoice[field as keyof CreateInvoiceInput]);
    confidence -= missingFields.length * 0.15;

    // Check if line items were extracted
    if (!invoice.line_items?.length) {
      confidence -= 0.1;
    }

    // Check if tax information was extracted
    if (!invoice.taxes?.length) {
      confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  // Helper methods

  private extractText(value: any): string {
    if (typeof value === 'string') return value;
    if (value?._text) return value._text.toString();
    if (value && typeof value === 'object') {
      const textValue = Object.values(value).find(v => typeof v === 'string');
      return textValue as string || '';
    }
    return value ? value.toString() : '';
  }

  private parseAmount(amountObj: any): number {
    if (typeof amountObj === 'number') return amountObj;
    if (typeof amountObj === 'string') return parseFloat(amountObj) || 0;
    if (amountObj?.['#text']) return parseFloat(amountObj['#text']) || 0;
    if (amountObj?._text) return parseFloat(amountObj._text) || 0;
    return 0;
  }

  private extractCurrency(amountObj: any): string | undefined {
    if (amountObj?.['@_currencyID']) return amountObj['@_currencyID'];
    if (amountObj?.currencyID) return amountObj.currencyID;
    if (amountObj?.currency) return amountObj.currency;
    return undefined;
  }

  private parseDate(dateString: string): string {
    console.log('🗓️ PARSING DATE:', dateString);
    try {
      // Handle Colombian XML dates (YYYY-MM-DD format) - return as-is without conversion
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
        const [year, month, day] = dateString.trim().split('-').map(Number);
        // Validate date components
        if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          // Return exactly as provided to avoid timezone issues
          return dateString.trim();
        }
      }
      
      // For other formats, try to parse but avoid timezone conversion
      try {
        // Create date object but extract parts manually to avoid timezone shift
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      } catch {
        // Continue to fallback
      }
      
      return dateString; // Return as-is if parsing fails
    } catch {
      return dateString; // Return as-is if parsing fails
    }
  }

  private cleanNIT(nit: any): string {
    // Convert to string and remove any non-numeric characters from NIT
    if (!nit) return '';
    const nitStr = String(nit);
    return nitStr.replace(/\D/g, '');
  }

  private isValidNIT(nit: string): boolean {
    const cleanNit = this.cleanNIT(nit);
    return /^\d{8,10}$/.test(cleanNit);
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  private mapTaxSchemeToType(schemeId: any): 'IVA' | 'ICA' | 'RETENCION_FUENTE' | null {
    if (!schemeId) return null;
    
    const id = String(schemeId).toLowerCase();
    
    // Common Colombian tax scheme IDs
    if (id.includes('iva') || id === '01') return 'IVA';
    if (id.includes('ica') || id === '03') return 'ICA';
    if (id.includes('retencion') || id.includes('retention') || id === '06') return 'RETENCION_FUENTE';
    
    return null;
  }
}

export const xmlProcessor = new ColombianXMLProcessor();