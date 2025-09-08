# PRD Técnico - CFO SaaS Platform

## Arquitectura del Sistema

### Stack Tecnológico
```typescript
interface TechStack {
  frontend: {
    framework: "Next.js 15" // App Router
    ui: "React 19" | "TypeScript 5.8"
    styling: "Tailwind CSS 4.1" | "shadcn/ui"
    state: "TanStack Query 5" | "Zustand"
    forms: "React Hook Form 7" | "Zod"
    i18n: "react-i18next 15"
  }
  backend: {
    database: "Supabase PostgreSQL"
    auth: "Supabase Auth + MFA"
    storage: "Supabase Storage"
    apis: "Next.js API Routes" | "Supabase Edge Functions"
    realtime: "Supabase Realtime"
  }
  ai: {
    llm: "OpenAI GPT-4 Turbo"
    ocr: "Azure Computer Vision"
    processing: "Azure Functions"
    embedding: "OpenAI text-embedding-3-small"
  }
  infrastructure: {
    hosting: "Vercel" | "Supabase Cloud"
    cdn: "Vercel Edge Network"
    monitoring: "Sentry" | "Vercel Analytics"
    cicd: "GitHub Actions"
  }
}
```

### Arquitectura Multi-Tenant
```typescript
// Modelo de multi-tenancy por company_id
interface TenantArchitecture {
  isolation: "Row Level Security (RLS)" // Supabase native
  sharding: "Single database, filtered by company_id"
  auth: "Supabase Auth with custom claims"
  storage: "Bucketed by company_id"
}

// Ejemplo RLS Policy
/*
CREATE POLICY "Users can only see their company's invoices" 
ON invoices FOR ALL 
USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid()
  )
);
*/
```

## Módulos Técnicos Principales

### 1. Módulo de Procesamiento de Facturas

#### Arquitectura del Procesador
```typescript
interface InvoiceProcessingEngine {
  // Pipeline de procesamiento
  pipeline: {
    ingestion: EmailProcessor | FileUploader | APIEndpoint
    extraction: XMLParser | PDFOCRProcessor | ZipExtractor
    validation: SchemaValidator | BusinessRuleValidator
    classification: PUCClassifier | MLClassificationEngine
    calculation: TaxEngine | AmountCalculator
    storage: DatabasePersistence | FileStorage
    notification: EventEmitter | WebhookDispatcher
  }
  
  // Configuración por país
  countryConfig: {
    colombia: ColombianTaxRules
    ecuador: EcuadorianTaxRules
    venezuela: VenezuelanTaxRules
  }
}

// Implementación del pipeline
class InvoiceProcessingPipeline {
  async process(input: ProcessingInput): Promise<ProcessingResult> {
    const stages = [
      this.ingestion,
      this.extraction, 
      this.validation,
      this.classification,
      this.calculation,
      this.storage,
      this.notification
    ];

    let data = input;
    for (const stage of stages) {
      data = await stage.process(data);
      if (data.hasErrors && data.severity === 'critical') {
        throw new ProcessingError(data.errors);
      }
    }

    return data;
  }
}
```

#### Procesamiento de Email con ZIP
```typescript
interface EmailProcessingSystem {
  // IMAP/POP3 client para lectura de emails
  emailReader: {
    protocols: ['IMAP', 'POP3', 'Microsoft Graph API']
    filters: {
      sender: string[]
      subject: RegExp[]
      hasAttachments: boolean
    }
    polling: {
      interval: number // 5 minutos
      maxEmails: number // 100 por batch
    }
  }

  // Extractor de archivos ZIP
  zipProcessor: {
    supportedFormats: ['.zip', '.rar', '.7z']
    maxFileSize: number // 50MB
    allowedFileTypes: ['.xml', '.pdf', '.xlsx']
    virusScan: boolean // true
  }

  // Procesador de archivos XML
  xmlProcessor: {
    schemas: ['UBL 2.1', 'DIAN Colombia', 'Custom']
    validation: 'strict' | 'lenient'
    encoding: ['UTF-8', 'ISO-8859-1']
  }
}

// Implementación
class EmailAttachmentProcessor {
  async processEmailWithZip(email: EmailMessage): Promise<ProcessingResult> {
    // 1. Verificar attachments
    const zipAttachments = email.attachments.filter(a => 
      a.contentType.includes('zip') || a.filename.endsWith('.zip')
    );

    if (zipAttachments.length === 0) {
      throw new Error('No ZIP attachments found');
    }

    // 2. Extraer archivos ZIP
    const extractedFiles: ExtractedFile[] = [];
    for (const attachment of zipAttachments) {
      const files = await this.extractZipFile(attachment.buffer);
      extractedFiles.push(...files);
    }

    // 3. Procesar archivos XML
    const results: ProcessingResult[] = [];
    for (const file of extractedFiles) {
      if (file.extension === '.xml') {
        const result = await this.processXMLFile(file);
        results.push(result);
      }
    }

    return this.consolidateResults(results);
  }

  private async extractZipFile(buffer: Buffer): Promise<ExtractedFile[]> {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    
    return entries
      .filter(entry => !entry.isDirectory)
      .filter(entry => this.isAllowedFileType(entry.name))
      .map(entry => ({
        name: entry.name,
        extension: path.extname(entry.name),
        content: entry.getData(),
        size: entry.header.size
      }));
  }
}
```

### 2. Motor de Clasificación PUC

#### Clasificador Inteligente
```typescript
interface PUCClassificationEngine {
  // Reglas basadas en ML
  mlClassifier: {
    model: 'random-forest' | 'neural-network'
    features: [
      'supplier_name',
      'invoice_description', 
      'amount_range',
      'tax_classification',
      'industry_sector'
    ]
    confidence: number // 0-1
    fallbackRules: BusinessRules[]
  }

  // Base de conocimiento PUC
  pucKnowledge: {
    accounts: PUCAccount[]
    mappings: SupplierPUCMapping[]
    sectors: IndustrySectorMapping[]
    patterns: ClassificationPattern[]
  }
}

// Definición de cuenta PUC
interface PUCAccount {
  code: string      // "4135" - Comercio al por mayor
  name: string      // "Comercio al por mayor y al por menor"
  level: 1 | 2 | 3 | 4  // Nivel jerárquico
  parent?: string   // Código padre
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  description: string
  examples: string[]
  keywords: string[]
}

// Implementación del clasificador
class PUCClassifier {
  async classify(invoiceData: InvoiceData): Promise<ClassificationResult> {
    // 1. Búsqueda por mapping directo
    const directMapping = await this.findDirectMapping(
      invoiceData.supplierTaxId
    );
    if (directMapping && directMapping.confidence > 0.9) {
      return directMapping;
    }

    // 2. Clasificación por ML
    const mlResult = await this.mlClassify(invoiceData);
    if (mlResult.confidence > 0.8) {
      return mlResult;
    }

    // 3. Clasificación por reglas de negocio
    const ruleResult = await this.applyBusinessRules(invoiceData);
    if (ruleResult.confidence > 0.7) {
      return ruleResult;
    }

    // 4. Clasificación manual requerida
    return {
      pucCode: null,
      confidence: 0,
      requiresManualReview: true,
      suggestedCodes: await this.getSuggestions(invoiceData)
    };
  }

  private async mlClassify(data: InvoiceData): Promise<ClassificationResult> {
    const features = this.extractFeatures(data);
    const prediction = await this.mlModel.predict(features);
    
    return {
      pucCode: prediction.class,
      confidence: prediction.probability,
      reasoning: prediction.feature_importance
    };
  }
}
```

### 3. Motor de Cálculo de Impuestos

#### Engine Tributario Multi-país
```typescript
interface TaxCalculationEngine {
  // Motores por país
  engines: {
    colombia: ColombianTaxEngine
    ecuador: EcuadorianTaxEngine
    venezuela: VenezuelanTaxEngine
  }

  // Reglas tributarias
  rules: {
    iva: IVATaxRules
    retencion: RetentionRules
    ica: ICAMunicipalRules
    reteiva: RetentionIVARules
    reteica: RetentionICARules
  }

  // Validación de cumplimiento
  compliance: {
    niif: NIIFComplianceValidator
    estatutoTributario: TaxCodeValidator
    municipalRules: MunicipalTaxValidator
  }
}

// Implementación Colombia
class ColombianTaxEngine implements TaxEngine {
  calculateTaxes(invoice: InvoiceData): TaxCalculationResult {
    const results: TaxCalculationResult = {
      subtotal: invoice.amount,
      taxes: [],
      retentions: [],
      total: invoice.amount
    };

    // 1. Calcular IVA
    const ivaResult = this.calculateIVA(invoice);
    results.taxes.push(ivaResult);
    results.total += ivaResult.amount;

    // 2. Calcular Retención en la fuente
    const retencionResult = this.calculateRetencion(invoice);
    if (retencionResult.amount > 0) {
      results.retentions.push(retencionResult);
      results.total -= retencionResult.amount;
    }

    // 3. Calcular ReteIVA
    const reteIVAResult = this.calculateReteIVA(invoice, ivaResult);
    if (reteIVAResult.amount > 0) {
      results.retentions.push(reteIVAResult);
      results.total -= reteIVAResult.amount;
    }

    // 4. Calcular ICA (si aplica)
    const icaResult = this.calculateICA(invoice);
    if (icaResult.amount > 0) {
      results.taxes.push(icaResult);
      results.total += icaResult.amount;
    }

    return results;
  }

  private calculateIVA(invoice: InvoiceData): TaxItem {
    // Determinar tarifa de IVA basada en el producto/servicio
    const rate = this.getIVARate(invoice);
    const taxableBase = this.getIVATaxableBase(invoice);
    
    return {
      type: 'IVA',
      rate: rate,
      taxableBase: taxableBase,
      amount: Math.round(taxableBase * rate),
      code: '01' // Código DIAN para IVA
    };
  }

  private getIVARate(invoice: InvoiceData): number {
    // Reglas de negocio para determinar tarifa
    if (this.isExemptProduct(invoice.pucCode)) return 0.0;
    if (this.isBasicProduct(invoice.pucCode)) return 0.05;
    if (this.isExcludedProduct(invoice.pucCode)) return 0.0;
    return 0.19; // Tarifa general
  }
}

// Configuración de reglas tributarias
const TaxRulesConfig = {
  colombia: {
    iva: {
      generalRate: 0.19,
      reducedRate: 0.05,
      exemptProducts: ['1100', '1200'], // PUC codes
      excludedProducts: ['2100', '2200']
    },
    retencion: {
      services: {
        rate: 0.11,
        minimumAmount: 4000000 // COP
      },
      goods: {
        rate: 0.025,
        minimumAmount: 1000000 // COP
      }
    },
    ica: {
      bogota: {
        commerce: 0.00414,
        services: 0.00966,
        industry: 0.00414
      },
      medellin: {
        commerce: 0.007,
        services: 0.007,
        industry: 0.007
      }
    }
  }
} as const;
```

### 4. Módulo AI CFO

#### Sistema de Análisis Financiero
```typescript
interface AICFOSystem {
  // Componentes principales
  components: {
    dataAnalyzer: FinancialDataAnalyzer
    insightGenerator: InsightGenerationEngine
    reportGenerator: ReportGenerationEngine
    chatbot: FinancialChatbot
    alertSystem: IntelligentAlertSystem
  }

  // Fuentes de datos
  dataSources: {
    internal: CompanyFinancialData
    external: {
      sectorBenchmarks: CamaraComercioData
      economicIndicators: BancoRepublicaAPI
      marketTrends: ExternalMarketData
    }
  }

  // Modelos de IA
  aiModels: {
    chatbot: 'gpt-4-turbo'
    analysis: 'gpt-4-turbo'
    forecasting: 'custom-time-series-model'
    classification: 'custom-ml-classifier'
  }
}

// Generador de insights financieros
class FinancialInsightGenerator {
  async generateInsights(companyData: CompanyFinancialData): Promise<Insight[]> {
    const insights: Insight[] = [];

    // 1. Análisis de flujo de caja
    const cashFlowInsight = await this.analyzeCashFlow(companyData);
    insights.push(cashFlowInsight);

    // 2. Comparación sectorial
    const sectorComparison = await this.compareSector(companyData);
    insights.push(sectorComparison);

    // 3. Análisis de riesgos
    const riskAnalysis = await this.analyzeRisks(companyData);
    insights.push(...riskAnalysis);

    // 4. Recomendaciones estratégicas
    const recommendations = await this.generateRecommendations(companyData);
    insights.push(...recommendations);

    return insights;
  }

  private async analyzeCashFlow(data: CompanyFinancialData): Promise<Insight> {
    const prompt = `
      Analiza el siguiente flujo de caja de una PYME del sector ${data.sector}:
      
      Ingresos último trimestre: ${data.revenue}
      Gastos último trimestre: ${data.expenses}
      Cuentas por cobrar: ${data.accountsReceivable}
      Cuentas por pagar: ${data.accountsPayable}
      
      Proporciona un análisis conciso en español sobre:
      1. Estado actual del flujo de caja
      2. Tendencias observadas
      3. Riesgos potenciales
      4. Recomendaciones específicas
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    return {
      type: 'cash-flow-analysis',
      title: 'Análisis de Flujo de Caja',
      content: response.choices[0].message.content,
      confidence: 0.85,
      priority: 'high',
      actionable: true
    };
  }
}

// Chatbot financiero
class FinancialChatbot {
  private systemPrompt = `
    Eres un CFO virtual experto en finanzas para PYMES en Colombia.
    
    Contexto:
    - Hablas en español colombiano
    - Te enfocas en consejos prácticos y accionables
    - Conoces la normatividad tributaria colombiana
    - Entiendes las particularidades de las PYMES
    
    Cuando respondas:
    - Sé conciso pero completo
    - Incluye números y métricas cuando sea posible
    - Sugiere acciones concretas
    - Menciona riesgos si es relevante
    - Haz referencias a la normatividad si aplica
  `;

  async processQuery(
    query: string, 
    companyData: CompanyFinancialData
  ): Promise<ChatbotResponse> {
    
    const contextPrompt = `
      Información de la empresa:
      Sector: ${companyData.sector}
      Ingresos anuales: ${companyData.annualRevenue}
      Número de empleados: ${companyData.employees}
      Ubicación: ${companyData.location}
      
      Pregunta del usuario: ${query}
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: contextPrompt }
      ],
      temperature: 0.4,
      max_tokens: 500
    });

    return {
      message: response.choices[0].message.content,
      confidence: this.calculateConfidence(query),
      suggestedActions: this.extractActions(response.choices[0].message.content),
      relatedTopics: this.findRelatedTopics(query)
    };
  }
}
```

### 5. Sistema de Integraciones

#### API Gateway y Conectores
```typescript
interface IntegrationSystem {
  // Gateway centralizado
  apiGateway: {
    authentication: 'JWT' | 'API-Key'
    rateLimiting: RateLimitConfig
    versioning: 'v1' | 'v2'
    documentation: 'OpenAPI 3.0'
  }

  // Conectores disponibles
  connectors: {
    accounting: {
      siigo: SiigoConnector
      sap: SAPBusinessOneConnector
      worldoffice: WorldOfficeConnector
      contabilidad: ContabilidadConnector
    }
    banking: {
      bancolombia: BancolombiaConnector
      davivienda: DaviviendaConnector
    }
    government: {
      dian: DIANConnector
      camaraComercio: CamaraComercioConnector
    }
  }

  // Webhooks y eventos
  events: {
    outgoing: WebhookDispatcher
    incoming: WebhookReceiver
    processing: EventProcessor
  }
}

// Conector genérico para sistemas contables
abstract class AccountingSystemConnector {
  abstract async authenticate(): Promise<AuthToken>
  abstract async exportInvoices(invoices: ProcessedInvoice[]): Promise<ExportResult>
  abstract async syncChartOfAccounts(): Promise<ChartOfAccounts>
  abstract async validateConnection(): Promise<ConnectionStatus>

  // Implementación común
  protected async handleRateLimit(operation: () => Promise<any>): Promise<any> {
    const retryConfig = { attempts: 3, delay: 1000 };
    return this.retry(operation, retryConfig);
  }
}

// Implementación específica para Siigo
class SiigoConnector extends AccountingSystemConnector {
  private baseURL = 'https://api.siigo.com/v1';
  private credentials: SiigoCredentials;

  async authenticate(): Promise<AuthToken> {
    const response = await fetch(`${this.baseURL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.credentials.username,
        access_key: this.credentials.accessKey
      })
    });

    const data = await response.json();
    return {
      token: data.access_token,
      expiresIn: data.expires_in,
      tokenType: 'Bearer'
    };
  }

  async exportInvoices(invoices: ProcessedInvoice[]): Promise<ExportResult> {
    const results: ExportResult = {
      successful: [],
      failed: [],
      totalProcessed: invoices.length
    };

    for (const invoice of invoices) {
      try {
        const siigoInvoice = this.transformToSiigoFormat(invoice);
        const response = await this.createInvoiceInSiigo(siigoInvoice);
        results.successful.push({
          originalId: invoice.id,
          externalId: response.id,
          status: 'exported'
        });
      } catch (error) {
        results.failed.push({
          originalId: invoice.id,
          error: error.message,
          status: 'failed'
        });
      }
    }

    return results;
  }

  private transformToSiigoFormat(invoice: ProcessedInvoice): SiigoInvoice {
    return {
      document: {
        id: invoice.documentType || '1', // Factura de venta
      },
      date: invoice.issueDate.toISOString().split('T')[0],
      customer: {
        identification: invoice.customerTaxId,
        branch_office: '0',
      },
      seller: invoice.sellerId,
      observations: invoice.notes,
      items: invoice.lineItems.map(item => ({
        code: item.productCode,
        description: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        discount: item.discount || 0,
        taxes: item.taxes.map(tax => ({
          id: tax.id,
          value: tax.rate * 100 // Siigo espera porcentaje
        }))
      })),
      payments: [{
        id: invoice.paymentMethodId || '1',
        value: invoice.totalAmount,
        due_date: invoice.dueDate?.toISOString().split('T')[0]
      }]
    };
  }
}
```

## Performance y Escalabilidad

### Optimizaciones de Performance
```typescript
interface PerformanceOptimizations {
  // Cache estratégico
  caching: {
    redis: RedisConfig          // Session, temp data
    cdnCaching: CDNConfig       // Static assets
    queryCache: QueryCacheConfig // Database queries
    apiCache: APICacheConfig    // External API responses
  }

  // Procesamiento asíncrono
  backgroundJobs: {
    queue: 'BullMQ'            // Job processing
    workers: WorkerConfig      // Processing workers
    scaling: AutoScalingConfig // Dynamic scaling
  }

  // Optimización de base de datos
  database: {
    indexing: IndexStrategy    // Query optimization
    partitioning: PartitionConfig // Large table management
    connectionPooling: PoolConfig // Connection management
  }

  // CDN y assets
  assets: {
    optimization: AssetOptimization // Image/JS/CSS optimization
    bundling: BundleStrategy       // Code splitting
    prefetching: PrefetchConfig    // Resource prefetching
  }
}

// Configuración de cache Redis
const CacheConfig = {
  redis: {
    host: process.env.REDIS_URL,
    ttl: {
      userSessions: 3600,        // 1 hour
      apiResponses: 300,         // 5 minutes
      processedInvoices: 86400,  // 24 hours
      taxCalculations: 3600,     // 1 hour
      aiInsights: 1800          // 30 minutes
    }
  },
  
  // Estrategia de invalidación
  invalidation: {
    onInvoiceUpdate: ['company-invoices', 'financial-summary'],
    onTaxRuleChange: ['tax-calculations', 'compliance-reports'],
    onAIModelUpdate: ['ai-insights', 'recommendations']
  }
} as const;

// Worker para procesamiento en background
class InvoiceProcessingWorker {
  private queue = new Queue('invoice-processing');

  constructor() {
    this.queue.process('process-xml', 10, this.processXMLJob);
    this.queue.process('calculate-taxes', 20, this.calculateTaxesJob);
    this.queue.process('generate-insights', 5, this.generateInsightsJob);
  }

  async addProcessingJob(invoiceData: InvoiceData): Promise<Job> {
    return this.queue.add('process-xml', invoiceData, {
      attempts: 3,
      backoff: 'exponential',
      delay: 0
    });
  }

  private async processXMLJob(job: Job): Promise<ProcessingResult> {
    const { xmlContent, companyId } = job.data;
    
    try {
      // Procesamiento intensivo en background
      const result = await this.processInvoiceXML(xmlContent, companyId);
      
      // Agregar job de cálculo de impuestos
      await this.queue.add('calculate-taxes', {
        invoiceId: result.id,
        companyId
      });

      return result;
    } catch (error) {
      // Log error y re-throw para retry automático
      console.error('Processing failed:', error);
      throw error;
    }
  }
}
```

### Escalabilidad y Límites
```typescript
interface ScalabilityLimits {
  // Límites por plan
  plans: {
    basic: {
      maxInvoicesPerMonth: 300
      maxFileSize: 10_000_000        // 10MB
      maxConcurrentProcessing: 2
      apiCallsPerHour: 1000
    }
    pro: {
      maxInvoicesPerMonth: 1000
      maxFileSize: 50_000_000        // 50MB
      maxConcurrentProcessing: 5
      apiCallsPerHour: 5000
    }
    enterprise: {
      maxInvoicesPerMonth: -1        // Unlimited
      maxFileSize: 100_000_000       // 100MB
      maxConcurrentProcessing: 20
      apiCallsPerHour: 20000
    }
  }

  // Límites técnicos
  technical: {
    maxBatchSize: 100              // Facturas por batch
    maxXMLSize: 5_000_000          // 5MB por XML
    maxZipFiles: 50                // Archivos por ZIP
    queryTimeout: 30_000           // 30 segundos
    aiResponseTimeout: 60_000      // 60 segundos
  }
}
```

## Seguridad y Compliance

### Medidas de Seguridad
```typescript
interface SecurityMeasures {
  // Autenticación y autorización
  auth: {
    mfa: 'TOTP' | 'SMS' | 'Email'
    sessionTimeout: number         // 4 horas
    passwordPolicy: PasswordPolicy
    roleBasedAccess: RBACConfig
  }

  // Encriptación
  encryption: {
    atRest: 'AES-256'             // Supabase default
    inTransit: 'TLS 1.3'          // HTTPS everywhere
    keyManagement: 'Supabase KMS'
  }

  // Auditoría
  auditing: {
    userActions: boolean          // true
    systemEvents: boolean         // true
    dataAccess: boolean           // true
    retention: number             // 7 años
  }

  // Compliance
  compliance: {
    gdpr: boolean                 // true
    colombianDataProtection: boolean // true
    soc2: boolean                 // true
    iso27001: boolean             // En progreso
  }
}

// Row Level Security policies (Supabase)
const RLSPolicies = `
  -- Usuarios solo ven datos de sus empresas
  CREATE POLICY "company_isolation" ON invoices
  FOR ALL USING (
    company_id IN (
      SELECT company_id 
      FROM user_companies 
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

  -- Roles granulares
  CREATE POLICY "role_based_access" ON invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_companies uc
      JOIN company_roles cr ON uc.company_id = cr.company_id
      WHERE uc.user_id = auth.uid()
      AND uc.company_id = invoices.company_id
      AND cr.role IN ('admin', 'accountant')
    )
  );
`;
```

## Monitoreo y Observabilidad

### Stack de Monitoreo
```typescript
interface MonitoringStack {
  // APM y errores
  apm: {
    sentry: SentryConfig          // Error tracking
    vercelAnalytics: boolean      // Performance metrics
    supabaseMetrics: boolean      // DB performance
  }

  // Logging estructurado
  logging: {
    level: 'info' | 'debug' | 'warn' | 'error'
    format: 'json'
    retention: number             // 30 días
    searchable: boolean           // true
  }

  // Métricas de negocio
  businessMetrics: {
    invoicesProcessed: Counter
    processingAccuracy: Gauge
    aiConfidence: Histogram
    userSatisfaction: Gauge
  }

  // Alertas
  alerting: {
    errorRate: { threshold: '5%', window: '5m' }
    responseTime: { threshold: '2s', window: '1m' }
    processingFailures: { threshold: 10, window: '10m' }
    aiModelErrors: { threshold: 3, window: '1h' }
  }
}

// Health checks
class HealthCheckService {
  async getSystemHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkStorage(),
      this.checkAIServices(),
      this.checkExternalAPIs(),
      this.checkProcessingQueue()
    ]);

    return {
      status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
      checks: checks.map((check, index) => ({
        name: ['database', 'storage', 'ai', 'external', 'queue'][index],
        status: check.status === 'fulfilled' ? 'pass' : 'fail',
        responseTime: check.status === 'fulfilled' ? check.value.responseTime : null,
        error: check.status === 'rejected' ? check.reason.message : null
      })),
      timestamp: new Date().toISOString()
    };
  }
}
```

---

Este PRD técnico proporciona la base completa para implementar la plataforma CFO SaaS utilizando el starter kit de Next.js/Supabase, definiendo claramente la arquitectura, componentes, y consideraciones técnicas necesarias para el desarrollo exitoso del proyecto.