# Integraciones - CFO SaaS Platform (Colombia)

## Arquitectura de Integraciones

### Enfoque de Integración - MVP Simplificado
```typescript
interface IntegrationArchitecture {
  // Patrón de conectores
  pattern: 'Adapter Pattern' // Arquitectura simple y extensible
  
  // Tipos de integración (MVP)
  types: {
    email: 'Microsoft Graph API (O365/Outlook)' // Único proveedor
    storage: 'Supabase Storage' // Almacenamiento de documentos
    ai: 'OpenAI API' // CFO virtual y análisis
    // Nota: Sin integraciones contables o gubernamentales en MVP
  }

  // Protocolos soportados
  protocols: ['REST API', 'Microsoft Graph API']
  
  // Autenticación
  auth: ['OAuth 2.0 + PKCE', 'API Keys']
  
  // Compatibilidad
  compatibility: {
    platform: 'Vercel Edge Functions'
    runtime: 'Node.js Edge Runtime'
    database: 'Supabase PostgreSQL'
  }
}
```

## 1. Integración Principal: Microsoft Graph API (O365)

### Conector O365/Outlook
```typescript
interface O365Integration {
  baseURL: 'https://graph.microsoft.com/v1.0'
  authentication: 'OAuth 2.0 + PKCE'
  
  endpoints: {
    messages: '/me/messages'
    attachments: '/me/messages/{id}/attachments'
    mailboxSettings: '/me/mailboxSettings'
  }
  
  capabilities: {
    readEmails: boolean          // true
    downloadAttachments: boolean // true
    searchEmails: boolean        // true
    markAsProcessed: boolean     // true
    createFolders: boolean       // true
    webhookSupport: boolean      // true (change notifications)
  }
  
  vercelCompatibility: {
    edgeFunctions: boolean       // true
    serverlessRuntime: boolean   // true
    coldStarts: 'Optimized'     // Fast initialization
  }
}

// Implementación del conector Microsoft Graph
class O365OutlookConnector implements EmailConnector {
  private client: SiigoAPIClient;
  private rateLimiter: RateLimiter;

  constructor(credentials: MicrosoftGraphCredentials) {
    this.client = new GraphAPIClient(credentials);
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 2000, // Microsoft Graph limits
      interval: 'minute'
    });
  }

  async processInvoiceEmails(): Promise<EmailProcessingResult[]> {
    const results: EmailProcessingResult[] = [];
    
    try {
      // Search for emails with invoice attachments
      const messages = await this.searchInvoiceEmails();
      
      for (const message of messages) {
        await this.rateLimiter.removeTokens(1);
        
        try {
          // Download attachments
          const attachments = await this.downloadAttachments(message.id);
          
          // Process each attachment
          const processedAttachments = [];
          for (const attachment of attachments) {
            if (this.isInvoiceFile(attachment)) {
              const processed = await this.processAttachment(attachment, message);
              processedAttachments.push(processed);
            }
          }
          
          results.push({
            messageId: message.id,
            subject: message.subject,
            from: message.from.emailAddress.address,
            attachments: processedAttachments,
            status: 'success',
            processedAt: new Date()
          });
          
          // Mark as processed
          await this.markEmailAsProcessed(message.id);
          
        } catch (error) {
          console.error(`Failed to process email ${message.id}:`, error);
          
          results.push({
            messageId: message.id,
            status: 'error',
            error: error.message,
            retryable: this.isRetryableError(error)
          });
        }
      }
    } catch (error) {
      console.error('Failed to search emails:', error);
      throw new EmailProcessingError('Email search failed', error);
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

### Supabase Storage Integration
```typescript
interface SupabaseStorageIntegration {
  connection: 'Supabase Storage API'
  
  capabilities: {
    uploadFiles: boolean             // true
    downloadFiles: boolean           // true
    createBuckets: boolean          // true
    fileMetadata: boolean           // true
    publicUrls: boolean             // true
    securityPolicies: boolean       // true (RLS)
  }
  
  organization: {
    structure: 'company_id/year/month/filename'
    buckets: {
      invoices: 'invoice-documents'
      processed: 'processed-files'
      exports: 'export-files'
    }
  }
}

// Supabase Storage Connector
class SupabaseStorageConnector implements StorageConnector {
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

## 2. Integración con OpenAI

### OpenAI API para CFO Virtual
```typescript
interface OpenAIIntegration {
  // Modelos soportados
  models: {
    chatbot: 'gpt-4-turbo' // CFO virtual
    analysis: 'gpt-4-turbo' // Análisis financiero
    vision: 'gpt-4-vision-preview' // OCR para PDFs
    embedding: 'text-embedding-3-small' // Búsqueda semántica
  }

  // Funcionalidades
  capabilities: {
    financialAdvice: boolean         // true - Consultas CFO
    documentAnalysis: boolean        // true - Análisis de facturas
    insightGeneration: boolean       // true - Insights automáticos
    reportGeneration: boolean        // true - Reportes inteligentes
    conversationalChat: boolean      // true - Chat contextual
  }

  // Configuración Vercel
  vercelOptimization: {
    edgeCompatible: boolean          // true
    streaming: boolean               // true - Respuestas en tiempo real
    rateLimiting: boolean           // true - Control de costos
    caching: boolean                // true - Cache de respuestas
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

## 3. Sistema de Archivos y Documentos

### Procesamiento de Documentos
```typescript
interface DocumentProcessingSystem {
  // Tipos de documentos soportados
  supportedFormats: {
    xml: 'Facturas electrónicas UBL 2.1'
    pdf: 'Facturas escaneadas (OCR con OpenAI Vision)'
    zip: 'Archivos comprimidos con múltiples facturas'
  }

  // Pipeline de procesamiento
  pipeline: {
    extraction: 'Extracción de datos estructurados'
    validation: 'Validación de esquemas XML/UBL'
    classification: 'Clasificación PUC automática'
    storage: 'Almacenamiento en Supabase Storage'
    indexing: 'Indexación para búsqueda'
  }

  // Compatibilidad Vercel
  vercelFeatures: {
    edgeFunctions: boolean           // true
    fileUploads: boolean            // true (con middleware)
    largeFiles: boolean             // true (hasta 100MB)
    streaming: boolean              // true (procesamiento en tiempo real)
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

### Sistema de Notificaciones
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

## 4. Detalles de Implementación Microsoft Graph

### Configuración OAuth 2.0 + PKCE
```typescript
interface MicrosoftGraphOAuth {
  auth: 'OAuth 2.0 with PKCE (RFC 7636)'
  scopes: ['Mail.Read', 'Mail.ReadWrite', 'Files.ReadWrite']
  
  endpoints: {
    authorization: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    graph: 'https://graph.microsoft.com/v1.0'
  }
  
  vercelImplementation: {
    authFlow: 'Serverless OAuth handler'
    tokenStorage: 'Encrypted in Supabase'
    refreshTokens: 'Automatic refresh with Edge Functions'
    errorHandling: 'Graceful degradation'
  }
}

class MicrosoftGraphConnector implements EmailConnector {
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

## 5. OpenAI CFO Virtual - Implementación Completa

### CFO Expert System
```typescript
interface OpenAICFOSystem {
  // Sistema experto CFO
  expertSystem: {
    role: 'Senior CFO with 15+ years experience in Colombia'
    specialization: [
      'PYMES financial management',
      'Colombian tax optimization',
      'Cash flow management', 
      'NIIF compliance',
      'Sectoral benchmarking'
    ]
    models: {
      conversation: 'gpt-4-turbo' // Conversaciones principales
      analysis: 'gpt-4-turbo'    // Análisis profundo
      vision: 'gpt-4-vision-preview' // Análisis de documentos
      embedding: 'text-embedding-3-small' // Búsqueda contextual
    }
  }
  
  // Capacidades específicas
  capabilities: {
    strategicAdvice: 'Recomendaciones estratégicas personalizadas'
    riskAnalysis: 'Identificación proactiva de riesgos financieros'
    opportunityDetection: 'Detección de oportunidades de optimización'
    complianceGuidance: 'Guía normativa colombiana'
    sectoralBenchmarking: 'Comparación con estándares sectoriales'
    cashFlowForecasting: 'Proyecciones de flujo de caja'
  }
  
  // Optimización Vercel
  vercelOptimizations: {
    streaming: boolean              // true - Respuestas en tiempo real
    edgeDeployment: boolean         // true - Baja latencia
    contextCaching: boolean         // true - Reducir costos
    rateLimiting: boolean          // true - Control de uso por empresa
    errorHandling: boolean         // true - Fallbacks inteligentes
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

## 6. Gestión Simplificada de Integraciones

### Integration Manager (MVP)
```typescript
class IntegrationManager {
  private connectors = {
    email: null as O365OutlookConnector | null,
    storage: null as SupabaseStorageConnector | null,
    ai: null as OpenAICFOConnector | null
  };
  private healthChecker: IntegrationHealthChecker;

  constructor() {
    this.healthChecker = new IntegrationHealthChecker();
    this.setupHealthChecking();
    this.initializeConnectors();
  }

  private async initializeConnectors(): Promise<void> {
    // Initialize only the three core connectors
    try {
      this.connectors.email = new O365OutlookConnector({
        clientId: process.env.MICROSOFT_CLIENT_ID!,
        tenantId: process.env.MICROSOFT_TENANT_ID!,
        // PKCE - No client secret needed
      });
      
      this.connectors.storage = new SupabaseStorageConnector({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
      });
      
      this.connectors.ai = new OpenAICFOConnector({
        apiKey: process.env.OPENAI_API_KEY!
      });
      
      console.log('All integrations initialized successfully');
    } catch (error) {
      console.error('Failed to initialize integrations:', error);
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

## 7. Configuración y Deployment en Vercel

### Environment Configuration (MVP)
```typescript
// config/integrations.config.ts
export const IntegrationsConfig = {
  microsoft: {
    enabled: process.env.MICROSOFT_INTEGRATION_ENABLED === 'true',
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    tenantId: process.env.MICROSOFT_TENANT_ID!, // 'common' para multi-tenant
    scopes: ['Mail.Read', 'Mail.ReadWrite', 'Files.ReadWrite'],
    redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
    rateLimits: {
      requestsPerSecond: 10,
      requestsPerMinute: 2000
    }
  },
  
  openai: {
    enabled: process.env.OPENAI_INTEGRATION_ENABLED === 'true',
    apiKey: process.env.OPENAI_API_KEY!,
    organization: process.env.OPENAI_ORG_ID,
    rateLimits: {
      tokensPerMinute: 50000, // Sufficient for CFO usage
      requestsPerMinute: 500,
      maxTokensPerRequest: 4096
    },
    models: {
      cfo: 'gpt-4-turbo',
      vision: 'gpt-4-vision-preview',
      embedding: 'text-embedding-3-small'
    }
  },
  
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    storage: {
      buckets: {
        invoices: 'invoice-documents',
        processed: 'processed-files',
        exports: 'export-files'
      },
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedTypes: ['.xml', '.pdf', '.zip']
    }
  },
  
  vercel: {
    deployment: {
      functions: {
        timeout: 60, // 60 seconds for processing
        memory: 1024 // 1GB for large file processing
      },
      edge: {
        regions: ['iad1', 'cle1'], // US East for better latency to Colombia
        runtime: 'edge'
      }
    }
  }
} as const;
```

### Testing Integrations
```typescript
// __tests__/integrations/microsoft-graph.integration.test.ts
describe('Microsoft Graph Integration', () => {
  let graphConnector: O365OutlookConnector;
  
  beforeAll(() => {
    graphConnector = new O365OutlookConnector({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      tenantId: process.env.MICROSOFT_TENANT_ID!
    });
  });

  it('should search for invoice emails', async () => {
    const emails = await graphConnector.searchInvoiceEmails();
    expect(emails).toBeInstanceOf(Array);
    expect(emails.length).toBeGreaterThanOrEqual(0);
  });

  it('should process email attachments', async () => {
    const mockEmail = createMockEmailWithAttachment();
    const result = await graphConnector.processEmailAttachments(mockEmail);
    
    expect(result).toHaveProperty('messageId');
    expect(result).toHaveProperty('attachments');
    expect(result.status).toBe('success');
  });
});

// __tests__/integrations/openai-cfo.integration.test.ts
describe('OpenAI CFO Integration', () => {
  let cfoConnector: OpenAICFOConnector;
  
  beforeAll(() => {
    cfoConnector = new OpenAICFOConnector({
      apiKey: process.env.OPENAI_API_KEY!
    });
  });

  it('should provide financial advice', async () => {
    const query = '¿Cómo puedo mejorar mi flujo de caja?';
    const companyData = createMockCompanyData();
    
    const advice = await cfoConnector.getFinancialAdvice(query, companyData);
    
    expect(advice).toHaveProperty('recommendations');
    expect(advice).toHaveProperty('reasoning');
    expect(advice.confidence).toBeGreaterThan(0.7);
  });
});
```

---

Esta especificación de integraciones MVP proporciona una base sólida y simple para la plataforma CFO SaaS, enfocada en las tres integraciones core necesarias: Microsoft Graph (O365), Supabase Storage, y OpenAI. La arquitectura está optimizada para Vercel y permite escalabilidad futura sin complejidad innecesaria en la versión inicial.