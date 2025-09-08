# Integraciones - CFO SaaS Platform

## Arquitectura de Integraciones

### Enfoque de Integración
```typescript
interface IntegrationArchitecture {
  // Patrón de conectores
  pattern: 'Adapter Pattern' | 'Plugin Architecture'
  
  // Tipos de integración
  types: {
    accounting: 'Sistemas contables (Siigo, SAP, etc.)'
    banking: 'Bancos (APIs de Open Banking)'
    government: 'Entidades gubernamentales (DIAN, Cámara)'
    email: 'Proveedores de email (Gmail, Outlook)'
    ai: 'Servicios de IA (OpenAI, Azure Cognitive)'
  }

  // Protocolos soportados
  protocols: ['REST API', 'SOAP', 'GraphQL', 'Webhooks', 'SFTP', 'Email IMAP/POP3']
  
  // Autenticación
  auth: ['OAuth 2.0', 'API Keys', 'JWT', 'Basic Auth', 'Certificate-based']
}
```

## 1. Integraciones con Sistemas Contables

### Siigo - Conector Principal
```typescript
interface SiigoIntegration {
  baseURL: 'https://api.siigo.com/v1'
  authentication: 'Custom Token-based'
  
  endpoints: {
    auth: '/auth'
    customers: '/customers'
    products: '/products'
    invoices: '/invoices'
    accounts: '/account-groups'
    taxes: '/taxes'
  }
  
  capabilities: {
    createInvoice: boolean        // true
    updateInvoice: boolean        // false - Siigo no permite
    getChartOfAccounts: boolean   // true
    syncCustomers: boolean        // true
    validateTaxes: boolean        // true
    webhookSupport: boolean       // false
  }
}

// Implementación del conector Siigo
class SiigoConnector implements AccountingConnector {
  private client: SiigoAPIClient;
  private rateLimiter: RateLimiter;

  constructor(credentials: SiigoCredentials) {
    this.client = new SiigoAPIClient(credentials);
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 100,
      interval: 'minute'
    });
  }

  async exportInvoices(invoices: ProcessedInvoice[]): Promise<ExportResult[]> {
    const results: ExportResult[] = [];
    
    for (const invoice of invoices) {
      await this.rateLimiter.removeTokens(1);
      
      try {
        // Transform to Siigo format
        const siigoInvoice = await this.transformToSiigoFormat(invoice);
        
        // Validate before sending
        const validation = await this.validateInvoice(siigoInvoice);
        if (!validation.isValid) {
          throw new ValidationError(validation.errors);
        }
        
        // Send to Siigo
        const response = await this.client.createInvoice(siigoInvoice);
        
        results.push({
          originalId: invoice.id,
          externalId: response.id,
          status: 'success',
          exportedAt: new Date()
        });
        
        // Update internal status
        await this.updateInvoiceStatus(invoice.id, 'exported', response.id);
        
      } catch (error) {
        console.error(`Failed to export invoice ${invoice.id}:`, error);
        
        results.push({
          originalId: invoice.id,
          status: 'error',
          error: error.message,
          retryable: this.isRetryableError(error)
        });
      }
    }
    
    return results;
  }

  private async transformToSiigoFormat(invoice: ProcessedInvoice): Promise<SiigoInvoice> {
    // Get customer from Siigo or create if doesn't exist
    const customer = await this.ensureCustomerExists(invoice.customer);
    
    return {
      document: {
        id: 1, // Factura de venta
      },
      date: invoice.issueDate.toISOString().split('T')[0],
      customer: {
        identification: customer.identification,
        branch_office: 0,
      },
      seller: invoice.sellerId || 629, // Default seller ID
      observations: invoice.description || '',
      items: await this.transformLineItems(invoice.lineItems),
      payments: [{
        id: 1, // Efectivo
        value: invoice.totalAmount,
        due_date: invoice.dueDate?.toISOString().split('T')[0]
      }],
      additional_fields: {
        company_id: invoice.companyId,
        our_reference: invoice.id
      }
    };
  }

  private async transformLineItems(items: InvoiceLineItem[]): Promise<SiigoItem[]> {
    return Promise.all(items.map(async (item) => {
      // Get or create product in Siigo
      const product = await this.ensureProductExists(item);
      
      return {
        code: product.code,
        description: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        discount: item.discount || 0,
        taxes: item.taxes.map(tax => ({
          id: this.mapTaxToSiigoId(tax.type),
          value: tax.rate * 100 // Siigo expects percentage
        }))
      };
    }));
  }

  private async ensureCustomerExists(customer: CustomerData): Promise<SiigoCustomer> {
    // Try to find existing customer
    const existing = await this.client.searchCustomer(customer.taxId);
    if (existing) return existing;

    // Create new customer
    const newCustomer: CreateSiigoCustomer = {
      type: 'Customer',
      person_type: customer.personType || 'Company',
      id_type: this.mapIdType(customer.idType),
      identification: customer.taxId,
      name: [customer.name],
      commercial_name: customer.commercialName || customer.name,
      branch_office: '0',
      active: true,
      vat_responsible: customer.vatResponsible || false,
      fiscal_responsibilities: this.mapFiscalResponsibilities(customer.fiscalRegime),
      address: {
        address: customer.address?.street || '',
        city: {
          country_code: 'Co',
          country_name: 'Colombia',
          state_code: customer.address?.state || '11',
          state_name: customer.address?.stateName || 'Bogotá',
          city_code: customer.address?.city || '11001',
          city_name: customer.address?.cityName || 'Bogotá'
        }
      },
      phones: customer.phone ? [{ number: customer.phone }] : [],
      contacts: customer.email ? [{ email: customer.email }] : []
    };

    return this.client.createCustomer(newCustomer);
  }
}

// Rate limiting y manejo de errores
class SiigoAPIClient {
  private baseURL = 'https://api.siigo.com/v1';
  private authToken: string | null = null;
  private tokenExpires: Date | null = null;

  async createInvoice(invoice: SiigoInvoice): Promise<SiigoInvoiceResponse> {
    await this.ensureAuthenticated();
    
    const response = await fetch(`${this.baseURL}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
        'Partner-Id': 'CFO-SAAS-PLATFORM'
      },
      body: JSON.stringify(invoice)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new SiigoAPIError(
        `HTTP ${response.status}: ${errorData.message}`,
        response.status,
        errorData
      );
    }

    return response.json();
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.authToken && this.tokenExpires && new Date() < this.tokenExpires) {
      return; // Token still valid
    }

    const authResponse = await fetch(`${this.baseURL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.credentials.username,
        access_key: this.credentials.accessKey
      })
    });

    if (!authResponse.ok) {
      throw new SiigoAuthError('Authentication failed');
    }

    const authData = await authResponse.json();
    this.authToken = authData.access_token;
    this.tokenExpires = new Date(Date.now() + (authData.expires_in * 1000));
  }
}
```

### SAP Business One Integration
```typescript
interface SAPBusinessOneIntegration {
  connection: 'SAP Business One DI API' | 'Service Layer REST API'
  
  capabilities: {
    createBusinessPartner: boolean    // true
    createItem: boolean              // true
    createInvoice: boolean           // true
    getChartOfAccounts: boolean      // true
    postJournalEntry: boolean        // true
    syncMasterData: boolean          // true
  }
}

// SAP Connector usando Service Layer
class SAPBusinessOneConnector implements AccountingConnector {
  private serviceLayerURL: string;
  private sessionId: string | null = null;

  async exportInvoices(invoices: ProcessedInvoice[]): Promise<ExportResult[]> {
    await this.login();
    
    const results: ExportResult[] = [];
    
    for (const invoice of invoices) {
      try {
        // Transform to SAP format
        const sapDocument = this.transformToSAPFormat(invoice);
        
        // Create invoice in SAP
        const response = await this.createDocument('Invoices', sapDocument);
        
        results.push({
          originalId: invoice.id,
          externalId: response.DocEntry.toString(),
          status: 'success'
        });
        
      } catch (error) {
        results.push({
          originalId: invoice.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    await this.logout();
    return results;
  }

  private async login(): Promise<void> {
    const response = await fetch(`${this.serviceLayerURL}/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CompanyDB: this.credentials.database,
        UserName: this.credentials.username,
        Password: this.credentials.password
      })
    });

    if (!response.ok) {
      throw new Error('SAP login failed');
    }

    const data = await response.json();
    this.sessionId = data.SessionId;
  }

  private transformToSAPFormat(invoice: ProcessedInvoice): SAPInvoice {
    return {
      CardCode: invoice.customer.code,
      DocDate: invoice.issueDate.toISOString().split('T')[0],
      TaxDate: invoice.taxDate?.toISOString().split('T')[0] || invoice.issueDate.toISOString().split('T')[0],
      Comments: invoice.description,
      DocumentLines: invoice.lineItems.map((item, index) => ({
        ItemCode: item.productCode,
        Quantity: item.quantity,
        UnitPrice: item.unitPrice,
        TaxCode: this.mapTaxCode(item.taxes[0]?.type),
        AccountCode: item.accountCode,
        CostingCode: item.costCenter,
        LineNum: index
      }))
    };
  }
}
```

## 2. Integraciones Bancarias

### Open Banking Colombia
```typescript
interface OpenBankingIntegration {
  // Bancos soportados
  supportedBanks: {
    bancolombia: BancolombiaConnector
    davivienda: DaviviendaConnector
    banco_bogota: BancoBogotaConnector
    bbva: BBVAConnector
  }

  // Funcionalidades
  capabilities: {
    getAccountBalance: boolean       // true
    getTransactions: boolean         // true
    categorizeTransactions: boolean  // true (con IA)
    reconcileInvoices: boolean      // true
    cashFlowPrediction: boolean     // true (con ML)
  }

  // Seguridad
  security: {
    oauth2: 'PKCE flow'
    encryption: 'TLS 1.3'
    tokenStorage: 'Encrypted in Supabase'
    consent: 'Explicit user consent required'
  }
}

// Conector genérico para bancos
abstract class BankConnector {
  protected abstract baseURL: string;
  protected abstract clientId: string;
  
  abstract async getAccountBalance(accountId: string): Promise<AccountBalance>;
  abstract async getTransactions(
    accountId: string, 
    dateFrom: Date, 
    dateTo: Date
  ): Promise<BankTransaction[]>;

  // Reconciliación automática con facturas
  async reconcileWithInvoices(
    transactions: BankTransaction[], 
    invoices: ProcessedInvoice[]
  ): Promise<ReconciliationResult> {
    
    const reconciled: ReconciliationMatch[] = [];
    const unmatched: BankTransaction[] = [];

    for (const transaction of transactions) {
      const match = await this.findMatchingInvoice(transaction, invoices);
      
      if (match) {
        reconciled.push({
          transaction: transaction,
          invoice: match.invoice,
          confidence: match.confidence,
          matchType: match.type
        });
      } else {
        unmatched.push(transaction);
      }
    }

    return { reconciled, unmatched };
  }

  private async findMatchingInvoice(
    transaction: BankTransaction, 
    invoices: ProcessedInvoice[]
  ): Promise<InvoiceMatch | null> {
    
    // 1. Exact amount match
    const exactMatches = invoices.filter(inv => 
      Math.abs(inv.totalAmount - transaction.amount) < 0.01
    );

    if (exactMatches.length === 1) {
      return {
        invoice: exactMatches[0],
        confidence: 0.95,
        type: 'exact_amount'
      };
    }

    // 2. Reference number match
    const referenceMatches = invoices.filter(inv =>
      transaction.reference?.includes(inv.invoiceNumber) ||
      transaction.description?.includes(inv.invoiceNumber)
    );

    if (referenceMatches.length === 1) {
      return {
        invoice: referenceMatches[0],
        confidence: 0.90,
        type: 'reference_match'
      };
    }

    // 3. Customer name + amount fuzzy match
    const fuzzyMatches = await this.fuzzyMatchCustomerAndAmount(
      transaction, 
      exactMatches
    );

    if (fuzzyMatches.length === 1 && fuzzyMatches[0].confidence > 0.8) {
      return fuzzyMatches[0];
    }

    return null;
  }
}

// Implementación específica Bancolombia
class BancolombiaConnector extends BankConnector {
  protected baseURL = 'https://developer.bancolombia.com/v1';
  
  async getAccountBalance(accountId: string): Promise<AccountBalance> {
    const response = await this.authenticatedRequest(
      `/accounts/${accountId}/balance`
    );
    
    return {
      accountId,
      balance: response.availableBalance,
      currency: response.currency,
      lastUpdated: new Date(response.valueDateTime)
    };
  }

  async getTransactions(
    accountId: string, 
    dateFrom: Date, 
    dateTo: Date
  ): Promise<BankTransaction[]> {
    
    const params = new URLSearchParams({
      fromDate: dateFrom.toISOString().split('T')[0],
      toDate: dateTo.toISOString().split('T')[0],
      limit: '100'
    });

    const response = await this.authenticatedRequest(
      `/accounts/${accountId}/transactions?${params}`
    );

    return response.transactions.map(this.transformTransaction);
  }

  private transformTransaction(txn: BancolombiaTransaction): BankTransaction {
    return {
      id: txn.transactionId,
      date: new Date(txn.valueDateTime),
      amount: parseFloat(txn.amount.value),
      currency: txn.amount.currency,
      type: txn.debitCreditIndicator === 'DBIT' ? 'debit' : 'credit',
      description: txn.transactionInformation,
      reference: txn.transactionReference,
      balance: parseFloat(txn.balanceAfterTransaction?.value || '0')
    };
  }
}
```

## 3. Integraciones Gubernamentales

### DIAN (Colombia) Integration
```typescript
interface DIANIntegration {
  services: {
    validateTaxId: 'RUT validation'
    getCompanyInfo: 'Company information lookup'
    validateInvoice: 'Electronic invoice validation'
    getTaxObligations: 'Tax obligations lookup'
    submitReports: 'Tax report submission (future)'
  }

  endpoints: {
    production: 'https://muisca.dian.gov.co'
    sandbox: 'https://catalogo-vpfe-hab.dian.gov.co'
  }
}

class DIANConnector {
  private baseURL: string;
  
  async validateTaxId(taxId: string): Promise<TaxIdValidationResult> {
    try {
      const response = await fetch(`${this.baseURL}/rut/validate/${taxId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CFO-SAAS-Platform/1.0'
        }
      });

      if (!response.ok) {
        throw new DIANError(`Validation failed: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        taxId,
        isValid: data.valid,
        companyName: data.businessName,
        fiscalRegime: data.fiscalRegime,
        economicActivity: data.economicActivities?.[0],
        address: data.address,
        status: data.taxpayerStatus
      };
      
    } catch (error) {
      console.error('DIAN validation error:', error);
      
      // Fallback to cache or manual verification
      return {
        taxId,
        isValid: null,
        error: error.message,
        requiresManualVerification: true
      };
    }
  }

  async getCompanyInfo(taxId: string): Promise<CompanyInfo> {
    const validation = await this.validateTaxId(taxId);
    
    if (!validation.isValid) {
      throw new Error(`Invalid tax ID: ${taxId}`);
    }

    return {
      taxId: validation.taxId,
      legalName: validation.companyName,
      fiscalRegime: validation.fiscalRegime,
      economicActivity: {
        code: validation.economicActivity?.code,
        description: validation.economicActivity?.description
      },
      address: validation.address,
      obligations: await this.getTaxObligations(taxId)
    };
  }

  private async getTaxObligations(taxId: string): Promise<TaxObligation[]> {
    // Implementation for getting tax obligations
    // This might require additional DIAN API endpoints or services
    return [];
  }
}
```

### Cámara de Comercio Integration
```typescript
interface CamaraComercioIntegration {
  services: {
    validateCompanyRegistry: boolean    // true
    getSectorBenchmarks: boolean       // true
    getIndustryClassification: boolean // true
    getFinancialIndicators: boolean   // true
  }
}

class CamaraComercioConnector {
  async getSectorBenchmarks(
    sector: string, 
    companySize: 'small' | 'medium' | 'large'
  ): Promise<SectorBenchmarks> {
    
    // This might use web scraping or API if available
    const response = await this.fetchBenchmarkData(sector, companySize);
    
    return {
      sector,
      companySize,
      metrics: {
        averageRevenue: response.avgRevenue,
        averageGrossMargin: response.avgGrossMargin,
        averageOperatingMargin: response.avgOperatingMargin,
        averageROA: response.avgROA,
        averageCurrentRatio: response.avgCurrentRatio,
        averageDebtToEquity: response.avgDebtToEquity
      },
      percentiles: {
        p25: response.percentile25,
        p50: response.percentile50,  // Median
        p75: response.percentile75,
        p90: response.percentile90
      },
      lastUpdated: new Date(response.lastUpdate)
    };
  }

  private async fetchBenchmarkData(
    sector: string, 
    size: string
  ): Promise<BenchmarkAPIResponse> {
    // Implementation depends on available APIs or data sources
    // Might involve web scraping if no API is available
    throw new Error('Not implemented - requires specific data source');
  }
}
```

## 4. Integraciones de Email

### Gmail/Google Workspace Integration
```typescript
interface GmailIntegration {
  auth: 'OAuth 2.0 with Gmail API'
  scopes: ['gmail.readonly', 'gmail.modify']
  
  capabilities: {
    readEmails: boolean           // true
    searchEmails: boolean         // true
    downloadAttachments: boolean  // true
    markAsProcessed: boolean      // true
    createLabels: boolean         // true
    moveToFolder: boolean         // true
  }
}

class GmailConnector implements EmailConnector {
  private gmail: gmail_v1.Gmail;

  constructor(private credentials: OAuth2Credentials) {
    const auth = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
    );
    
    auth.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken
    });

    this.gmail = google.gmail({ version: 'v1', auth });
  }

  async processInvoiceEmails(): Promise<EmailProcessingResult> {
    const query = this.buildInvoiceSearchQuery();
    const messages = await this.searchMessages(query);
    
    const results: EmailProcessingResult = {
      processed: [],
      failed: [],
      totalProcessed: messages.length
    };

    for (const message of messages) {
      try {
        const emailData = await this.getMessageWithAttachments(message.id!);
        
        if (emailData.attachments.length === 0) {
          continue; // Skip emails without attachments
        }

        const processResult = await this.processEmailAttachments(emailData);
        results.processed.push(processResult);

        // Mark as processed
        await this.addLabel(message.id!, 'CFO-PROCESSED');
        
      } catch (error) {
        console.error(`Failed to process email ${message.id}:`, error);
        results.failed.push({
          messageId: message.id!,
          error: error.message
        });
      }
    }

    return results;
  }

  private buildInvoiceSearchQuery(): string {
    const criteria = [
      'has:attachment',
      'filename:xml OR filename:zip',
      'subject:(factura OR invoice OR comprobante)',
      '-label:CFO-PROCESSED', // Exclude already processed
      'newer_than:7d'         // Only last 7 days
    ];

    return criteria.join(' ');
  }

  private async getMessageWithAttachments(messageId: string): Promise<EmailWithAttachments> {
    const message = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const attachments: EmailAttachment[] = [];
    const parts = message.data.payload?.parts || [];

    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        const attachmentData = await this.gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: messageId,
          id: part.body.attachmentId
        });

        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          data: Buffer.from(attachmentData.data.data || '', 'base64'),
          size: part.body.size || 0
        });
      }
    }

    return {
      id: messageId,
      subject: this.getHeader(message.data.payload?.headers, 'Subject'),
      from: this.getHeader(message.data.payload?.headers, 'From'),
      date: new Date(parseInt(message.data.internalDate || '0')),
      attachments
    };
  }

  private async processEmailAttachments(email: EmailWithAttachments): Promise<EmailProcessingResult> {
    const zipAttachments = email.attachments.filter(att => 
      att.mimeType.includes('zip') || att.filename.endsWith('.zip')
    );

    const xmlAttachments = email.attachments.filter(att =>
      att.mimeType.includes('xml') || att.filename.endsWith('.xml')
    );

    const results: ProcessedAttachment[] = [];

    // Process ZIP files
    for (const zipAttachment of zipAttachments) {
      const extractedFiles = await this.extractZipAttachment(zipAttachment);
      const xmlFiles = extractedFiles.filter(f => f.extension === '.xml');
      
      for (const xmlFile of xmlFiles) {
        const result = await this.processXMLContent(xmlFile.content, email);
        results.push({
          filename: xmlFile.name,
          originalFilename: zipAttachment.filename,
          processingResult: result
        });
      }
    }

    // Process direct XML attachments
    for (const xmlAttachment of xmlAttachments) {
      const result = await this.processXMLContent(xmlAttachment.data, email);
      results.push({
        filename: xmlAttachment.filename,
        processingResult: result
      });
    }

    return {
      emailId: email.id,
      subject: email.subject,
      from: email.from,
      processedAttachments: results,
      processedAt: new Date()
    };
  }
}
```

### Microsoft Outlook/Exchange Integration
```typescript
class OutlookConnector implements EmailConnector {
  private graphClient: Client;

  constructor(credentials: MicrosoftCredentials) {
    const authProvider = new AuthenticationProvider(credentials);
    this.graphClient = Client.initWithMiddleware({ authProvider });
  }

  async processInvoiceEmails(): Promise<EmailProcessingResult> {
    const searchQuery = this.buildOutlookSearchQuery();
    
    const messages = await this.graphClient
      .api('/me/messages')
      .search(searchQuery)
      .select(['id', 'subject', 'from', 'hasAttachments', 'receivedDateTime'])
      .filter('hasAttachments eq true')
      .top(50)
      .get();

    const results: EmailProcessingResult = {
      processed: [],
      failed: [],
      totalProcessed: messages.value.length
    };

    for (const message of messages.value) {
      try {
        const attachments = await this.getMessageAttachments(message.id);
        const processResult = await this.processAttachments(message, attachments);
        
        results.processed.push(processResult);

        // Move to processed folder
        await this.moveToFolder(message.id, 'CFO-Processed');
        
      } catch (error) {
        results.failed.push({
          messageId: message.id,
          error: error.message
        });
      }
    }

    return results;
  }

  private async getMessageAttachments(messageId: string): Promise<Attachment[]> {
    const attachments = await this.graphClient
      .api(`/me/messages/${messageId}/attachments`)
      .get();

    return attachments.value.filter((att: any) =>
      att.name.endsWith('.xml') || 
      att.name.endsWith('.zip') ||
      att.contentType.includes('xml') ||
      att.contentType.includes('zip')
    );
  }
}
```

## 5. Integraciones de IA

### OpenAI Integration
```typescript
interface OpenAIIntegration {
  models: {
    chat: 'gpt-4-turbo-preview'
    embedding: 'text-embedding-3-small'
    vision: 'gpt-4-vision-preview'
  }
  
  usage: {
    aiCFOChat: 'Financial advice and analysis'
    documentAnalysis: 'Invoice and document understanding'
    dataInsights: 'Pattern recognition in financial data'
    reportGeneration: 'Automated report creation'
  }
}

class OpenAIService {
  private openai: OpenAI;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 10000,  // TPM limit
      interval: 'minute'
    });
  }

  async generateFinancialInsight(
    companyData: CompanyFinancialData,
    query: string
  ): Promise<FinancialInsight> {
    
    await this.rateLimiter.removeTokens(1);

    const systemPrompt = this.buildSystemPrompt(companyData);
    const userPrompt = this.buildUserPrompt(query, companyData);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content!);
      
      return {
        query,
        insight: result.insight,
        recommendations: result.recommendations,
        confidence: result.confidence,
        reasoning: result.reasoning,
        actionItems: result.actionItems,
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new AIServiceError('Failed to generate insight', error);
    }
  }

  async analyzeInvoiceImage(imageData: Buffer): Promise<InvoiceAnalysisResult> {
    const base64Image = imageData.toString('base64');
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analiza esta factura y extrae los datos estructurados en formato JSON.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    return this.parseInvoiceAnalysis(response.choices[0].message.content!);
  }

  private buildSystemPrompt(companyData: CompanyFinancialData): string {
    return `
      Eres un CFO virtual experto en finanzas para PYMES en Colombia.
      
      Información de la empresa:
      - Sector: ${companyData.sector}
      - Tamaño: ${companyData.size}
      - Ingresos anuales: ${companyData.annualRevenue}
      - Empleados: ${companyData.employees}
      - Ubicación: ${companyData.location}
      
      Proporciona siempre respuestas en formato JSON con la siguiente estructura:
      {
        "insight": "Análisis principal",
        "recommendations": ["recomendación 1", "recomendación 2"],
        "confidence": 0.85,
        "reasoning": "Explicación del análisis",
        "actionItems": ["acción 1", "acción 2"]
      }
    `;
  }
}
```

### Azure Cognitive Services Integration
```typescript
interface AzureCognitiveIntegration {
  services: {
    computerVision: 'Document OCR and analysis'
    textAnalytics: 'Sentiment and key phrase extraction'
    formRecognizer: 'Structured document processing'
    translator: 'Multi-language support'
  }
}

class AzureOCRService {
  private client: ComputerVisionClient;

  constructor(endpoint: string, apiKey: string) {
    const credentials = new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': apiKey } });
    this.client = new ComputerVisionClient(credentials, endpoint);
  }

  async extractTextFromPDF(pdfBuffer: Buffer): Promise<OCRResult> {
    try {
      // Convert PDF to images first (using pdf-poppler or similar)
      const images = await this.pdfToImages(pdfBuffer);
      
      const extractedTexts: string[] = [];
      
      for (const image of images) {
        const result = await this.client.readInStream(image);
        const operationId = this.extractOperationId(result.operationLocation!);
        
        // Poll for results
        let readResult;
        do {
          await this.delay(1000);
          readResult = await this.client.getReadResult(operationId);
        } while (readResult.status === 'notStarted' || readResult.status === 'running');

        if (readResult.status === 'succeeded') {
          const text = readResult.analyzeResult?.readResults
            ?.map(page => page.lines?.map(line => line.text).join('\n'))
            .join('\n\n') || '';
          
          extractedTexts.push(text);
        }
      }

      return {
        text: extractedTexts.join('\n\n'),
        confidence: 0.9, // Azure typically has high confidence
        language: 'es', // Assume Spanish for Colombia
        pages: extractedTexts.length
      };

    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new OCRError('Failed to extract text from PDF', error);
    }
  }

  private extractOperationId(operationLocation: string): string {
    return operationLocation.split('/').pop()!;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## 6. Gestión de Integraciones

### Integration Manager
```typescript
class IntegrationManager {
  private connectors = new Map<string, any>();
  private healthChecker: IntegrationHealthChecker;

  constructor() {
    this.healthChecker = new IntegrationHealthChecker(this.connectors);
    this.setupHealthChecking();
  }

  async registerConnector(name: string, connector: any): Promise<void> {
    this.connectors.set(name, connector);
    
    // Test connection
    const isHealthy = await this.testConnectorHealth(name);
    if (!isHealthy) {
      console.warn(`Connector ${name} failed health check during registration`);
    }
  }

  async executeIntegration(
    integrationType: string,
    operation: string,
    data: any
  ): Promise<IntegrationResult> {
    
    const connector = this.connectors.get(integrationType);
    if (!connector) {
      throw new IntegrationError(`No connector found for ${integrationType}`);
    }

    try {
      const result = await connector[operation](data);
      
      // Log success
      await this.logIntegrationEvent({
        type: integrationType,
        operation,
        status: 'success',
        timestamp: new Date()
      });

      return result;

    } catch (error) {
      // Log failure
      await this.logIntegrationEvent({
        type: integrationType,
        operation,
        status: 'error',
        error: error.message,
        timestamp: new Date()
      });

      throw error;
    }
  }

  private async setupHealthChecking(): Promise<void> {
    // Check all integrations every 5 minutes
    setInterval(async () => {
      await this.healthChecker.checkAllConnectors();
    }, 5 * 60 * 1000);
  }

  private async testConnectorHealth(name: string): Promise<boolean> {
    try {
      const connector = this.connectors.get(name);
      if (connector?.healthCheck) {
        return await connector.healthCheck();
      }
      return true; // Assume healthy if no health check method
    } catch {
      return false;
    }
  }

  async getIntegrationStatus(): Promise<IntegrationStatus[]> {
    const statuses: IntegrationStatus[] = [];
    
    for (const [name, connector] of this.connectors) {
      const isHealthy = await this.testConnectorHealth(name);
      const lastUsed = await this.getLastUsedTimestamp(name);
      
      statuses.push({
        name,
        isHealthy,
        lastUsed,
        errorCount: await this.getErrorCount(name, '24h')
      });
    }

    return statuses;
  }
}
```

## 7. Configuración y Deployment

### Environment Configuration
```typescript
// config/integrations.config.ts
export const IntegrationsConfig = {
  siigo: {
    enabled: process.env.SIIGO_INTEGRATION_ENABLED === 'true',
    credentials: {
      username: process.env.SIIGO_USERNAME!,
      accessKey: process.env.SIIGO_ACCESS_KEY!
    },
    baseURL: process.env.SIIGO_API_URL || 'https://api.siigo.com/v1',
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    }
  },
  
  openai: {
    enabled: process.env.OPENAI_INTEGRATION_ENABLED === 'true',
    apiKey: process.env.OPENAI_API_KEY!,
    organization: process.env.OPENAI_ORG_ID,
    rateLimits: {
      tokensPerMinute: 10000,
      requestsPerMinute: 500
    }
  },
  
  gmail: {
    enabled: process.env.GMAIL_INTEGRATION_ENABLED === 'true',
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    scopes: ['gmail.readonly', 'gmail.modify']
  },
  
  dian: {
    enabled: process.env.DIAN_INTEGRATION_ENABLED === 'true',
    baseURL: process.env.NODE_ENV === 'production' 
      ? 'https://muisca.dian.gov.co'
      : 'https://catalogo-vpfe-hab.dian.gov.co'
  }
} as const;
```

### Testing Integrations
```typescript
// __tests__/integrations/siigo.integration.test.ts
describe('Siigo Integration', () => {
  let siigoConnector: SiigoConnector;
  
  beforeAll(() => {
    siigoConnector = new SiigoConnector({
      username: process.env.SIIGO_TEST_USERNAME!,
      accessKey: process.env.SIIGO_TEST_ACCESS_KEY!
    });
  });

  it('should authenticate successfully', async () => {
    const isAuthenticated = await siigoConnector.testConnection();
    expect(isAuthenticated).toBe(true);
  });

  it('should export invoice successfully', async () => {
    const testInvoice = createTestInvoice();
    const result = await siigoConnector.exportInvoices([testInvoice]);
    
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('success');
    expect(result[0].externalId).toBeDefined();
  });
});
```

---

Esta especificación de integraciones proporciona una base sólida para conectar la plataforma CFO SaaS con los sistemas externos necesarios, manteniendo flexibilidad para agregar nuevas integraciones en el futuro.