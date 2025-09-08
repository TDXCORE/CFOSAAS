# Estrategia de Testing - CFO SaaS Platform (Colombia)

## Filosofía de Testing

### Principios Fundamentales
1. **Testing Pyramid:** Muchos unit tests, algunos integration tests, pocos E2E tests
2. **Test-Driven Development (TDD)** para lógica crítica de negocio
3. **Coverage mínimo:** 80% para funciones críticas, 60% general
4. **Fast Feedback:** Tests que corren rápido y fallan temprano
5. **Reliability:** Tests deterministas y estables

### Niveles de Testing
- **Unit Tests (70%):** Funciones puras, hooks, utilidades
- **Integration Tests (20%):** APIs, servicios, base de datos
- **E2E Tests (10%):** Flujos críticos de usuario

## Stack de Testing

### Herramientas Base
```json
{
  "testing": {
    "runner": "Vitest", // Más rápido que Jest para Vite/TypeScript
    "framework": "@testing-library/react",
    "e2e": "Playwright", // Más estable que Cypress
    "mocking": "MSW (Mock Service Worker)",
    "coverage": "c8",
    "database": "@supabase/testing-tools"
  }
}
```

### Configuración
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      threshold: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60
        },
        // Thresholds más altos para módulos críticos
        './modules/invoices/**': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        './modules/tax-engine/**': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    }
  }
});
```

## Unit Testing

### Testing de Utilidades y Servicios
```typescript
// modules/invoices/__tests__/invoiceUtils.test.ts
import { describe, it, expect } from 'vitest';
import { parseXMLInvoice, calculateTaxes, validatePUCCode } from '../utils/invoiceUtils';

describe('invoiceUtils', () => {
  describe('parseXMLInvoice', () => {
    it('should parse valid XML invoice correctly', () => {
      const validXML = `
        <Invoice>
          <ID>INV-001</ID>
          <IssueDate>2024-01-15</IssueDate>
          <InvoiceLine>
            <LineExtensionAmount currencyID="COP">1000000</LineExtensionAmount>
          </InvoiceLine>
        </Invoice>
      `;
      
      const result = parseXMLInvoice(validXML);
      
      expect(result).toMatchObject({
        id: 'INV-001',
        issueDate: new Date('2024-01-15'),
        amount: 1000000,
        currency: 'COP'
      });
    });

    it('should throw error for invalid XML', () => {
      const invalidXML = '<invalid>xml';
      
      expect(() => parseXMLInvoice(invalidXML)).toThrow('Invalid XML format');
    });
  });

  describe('calculateTaxes', () => {
    it('should calculate IVA correctly', () => {
      const invoice = {
        amount: 1000000,
        taxableItems: [
          { amount: 800000, taxType: 'IVA', rate: 0.19 },
          { amount: 200000, taxType: 'IVA', rate: 0.05 }
        ]
      };

      const result = calculateTaxes(invoice);

      expect(result.iva).toBe(162000); // 800000 * 0.19 + 200000 * 0.05
      expect(result.total).toBe(1162000);
    });
  });

  describe('validatePUCCode', () => {
    it('should validate PUC code format', () => {
      expect(validatePUCCode('1105')).toBe(true);      // Caja
      expect(validatePUCCode('2205')).toBe(true);      // Proveedores
      expect(validatePUCCode('4135')).toBe(true);      // Comercio
      expect(validatePUCCode('123')).toBe(false);      // Too short
      expect(validatePUCCode('99999')).toBe(false);    // Invalid range
    });
  });
});
```

### Testing de Hooks Personalizados
```typescript
// modules/invoices/__tests__/useInvoiceProcessor.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInvoiceProcessor } from '../hooks/useInvoiceProcessor';
import { server } from '../../__mocks__/server';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useInvoiceProcessor', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should process invoice successfully', async () => {
    const { result } = renderHook(
      () => useInvoiceProcessor('company-123'),
      { wrapper: createWrapper() }
    );

    const xmlContent = '<Invoice><ID>INV-001</ID></Invoice>';
    
    result.current.processInvoice.mutate({
      xmlContent,
      companyId: 'company-123'
    });

    await waitFor(() => {
      expect(result.current.processInvoice.isSuccess).toBe(true);
    });

    expect(result.current.processInvoice.data).toMatchObject({
      success: true,
      invoiceId: expect.any(String)
    });
  });

  it('should handle processing errors', async () => {
    // Mock server error response
    const { result } = renderHook(
      () => useInvoiceProcessor('company-123'),
      { wrapper: createWrapper() }
    );

    result.current.processInvoice.mutate({
      xmlContent: '<invalid>',
      companyId: 'company-123'
    });

    await waitFor(() => {
      expect(result.current.processInvoice.isError).toBe(true);
    });
  });
});
```

### Testing de Componentes React
```typescript
// modules/invoices/__tests__/InvoiceUploader.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceUploader } from '../components/InvoiceUploader';
import { server } from '../../__mocks__/server';

const mockOnUploadComplete = vi.fn();

describe('InvoiceUploader', () => {
  beforeEach(() => {
    mockOnUploadComplete.mockClear();
  });

  it('should render upload interface', () => {
    render(
      <InvoiceUploader 
        companyId="company-123" 
        onUploadComplete={mockOnUploadComplete}
      />
    );

    expect(screen.getByText(/drag.*drop.*files/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument();
  });

  it('should handle file upload', async () => {
    const user = userEvent.setup();
    const file = new File(
      ['<Invoice><ID>INV-001</ID></Invoice>'], 
      'invoice.xml', 
      { type: 'text/xml' }
    );

    render(
      <InvoiceUploader 
        companyId="company-123" 
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const input = screen.getByLabelText(/upload files/i);
    await user.upload(input, file);

    expect(screen.getByText('invoice.xml')).toBeInTheDocument();
    
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalledWith({
        success: true,
        processedFiles: 1
      });
    });
  });

  it('should validate file types', async () => {
    const user = userEvent.setup();
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });

    render(
      <InvoiceUploader 
        companyId="company-123" 
        onUploadComplete={mockOnUploadComplete}
      />
    );

    const input = screen.getByLabelText(/upload files/i);
    await user.upload(input, invalidFile);

    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
  });
});
```

## Integration Testing

### Testing de API Routes
```typescript
// __tests__/api/invoices/process.test.ts
import { createMocks } from 'node-mocks-http';
import { POST } from '~/app/api/invoices/process/route';
import { createTestSupabaseClient } from '@/tests/utils/supabase';

// Mock Supabase client
vi.mock('@kit/supabase/server-client', () => ({
  getSupabaseServerClient: () => createTestSupabaseClient()
}));

describe('/api/invoices/process', () => {
  it('should process valid XML invoice', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: {
        xmlContent: '<Invoice><ID>INV-001</ID></Invoice>',
        companyId: 'company-123'
      },
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      invoiceData: {
        id: 'INV-001',
        companyId: 'company-123'
      }
    });
  });

  it('should validate request body', async () => {
    const { req } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: {
        xmlContent: '', // Invalid empty content
        companyId: 'invalid-id' // Invalid UUID
      },
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('validation');
  });

  it('should handle processing errors', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        xmlContent: '<invalid>xml</invalid>',
        companyId: 'company-123'
      },
    });

    const response = await POST(req as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to process invoice');
  });
});
```

### Testing de Servicios con Base de Datos
```typescript
// modules/invoices/__tests__/invoiceService.integration.test.ts
import { createTestSupabaseClient, resetDatabase } from '@/tests/utils/supabase';
import { InvoiceService } from '../services/InvoiceService';

describe('InvoiceService Integration', () => {
  let service: InvoiceService;
  let supabase: ReturnType<typeof createTestSupabaseClient>;

  beforeAll(async () => {
    supabase = createTestSupabaseClient();
    service = new InvoiceService(supabase);
  });

  beforeEach(async () => {
    await resetDatabase(supabase);
  });

  it('should save processed invoice to database', async () => {
    const invoiceData = {
      companyId: 'company-123',
      supplierName: 'Test Supplier',
      amount: 1000000,
      taxAmount: 190000,
      currency: 'COP' as const
    };

    const savedInvoice = await service.save(invoiceData);

    expect(savedInvoice).toMatchObject({
      id: expect.any(String),
      ...invoiceData,
      status: 'pending'
    });

    // Verify in database
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', savedInvoice.id)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject(invoiceData);
  });

  it('should retrieve invoices by company', async () => {
    // Setup test data
    await service.save({
      companyId: 'company-123',
      supplierName: 'Supplier 1',
      amount: 1000000,
      taxAmount: 190000,
      currency: 'COP'
    });

    await service.save({
      companyId: 'company-123',
      supplierName: 'Supplier 2',
      amount: 2000000,
      taxAmount: 380000,
      currency: 'COP'
    });

    const invoices = await service.getByCompany('company-123');

    expect(invoices).toHaveLength(2);
    expect(invoices[0]).toMatchObject({
      companyId: 'company-123',
      supplierName: expect.any(String)
    });
  });
});
```

## End-to-End Testing

### Setup de Playwright
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Tests Críticos
```typescript
// e2e/invoice-processing.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Invoice Processing Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/auth/sign-in');
    await page.fill('[data-testid="email"]', 'test@company.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="sign-in-button"]');
    
    // Wait for dashboard
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should process XML invoice successfully', async ({ page }) => {
    // Navigate to invoice processing
    await page.goto('/home/invoices/process');

    // Upload XML file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="upload-button"]');
    const fileChooser = await fileChooserPromise;
    
    const xmlFilePath = path.join(__dirname, 'fixtures', 'sample-invoice.xml');
    await fileChooser.setFiles(xmlFilePath);

    // Process file
    await page.click('[data-testid="process-button"]');
    
    // Wait for processing to complete
    await expect(page.locator('[data-testid="processing-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-id"]')).toHaveText(/INV-\d+/);

    // Verify invoice appears in list
    await page.goto('/home/invoices');
    await expect(page.locator('[data-testid="invoice-list"]')).toContainText('Test Supplier');
  });

  test('should handle multiple file upload', async ({ page }) => {
    await page.goto('/home/invoices/batch-process');

    // Upload ZIP file with multiple invoices
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="upload-zip-button"]');
    const fileChooser = await fileChooserPromise;
    
    const zipFilePath = path.join(__dirname, 'fixtures', 'invoices-batch.zip');
    await fileChooser.setFiles(zipFilePath);

    // Start batch processing
    await page.click('[data-testid="start-batch-button"]');

    // Monitor progress
    const progressBar = page.locator('[data-testid="progress-bar"]');
    await expect(progressBar).toBeVisible();

    // Wait for completion
    await expect(page.locator('[data-testid="batch-complete"]')).toBeVisible({
      timeout: 30000
    });

    // Verify results
    const resultsText = await page.locator('[data-testid="batch-results"]').textContent();
    expect(resultsText).toContain('5 invoices processed');
    expect(resultsText).toContain('0 errors');
  });

  test('should validate invoice data and allow corrections', async ({ page }) => {
    await page.goto('/home/invoices/validate');

    // Select sample to validate
    await page.click('[data-testid="validate-sample-button"]');

    // Review validation results
    await expect(page.locator('[data-testid="validation-table"]')).toBeVisible();
    
    // Make correction to flagged item
    const errorRow = page.locator('[data-testid="validation-error"]').first();
    await errorRow.click();
    
    await page.fill('[data-testid="correction-input"]', '4135'); // Correct PUC code
    await page.click('[data-testid="save-correction"]');

    // Approve batch
    await page.click('[data-testid="approve-batch-button"]');
    
    await expect(page.locator('[data-testid="approval-success"]')).toBeVisible();
  });
});
```

### E2E para AI CFO
```typescript
// e2e/ai-cfo.spec.ts
import { test, expect } from '@playwright/test';

test.describe('AI CFO Dashboard', () => {
  test('should display financial insights', async ({ page }) => {
    await page.goto('/home/ai-cfo');

    // Check dashboard elements
    await expect(page.locator('[data-testid="cash-flow-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-alerts"]')).toBeVisible();
    await expect(page.locator('[data-testid="sector-comparison"]')).toBeVisible();

    // Test AI chat
    await page.fill('[data-testid="chat-input"]', '¿Cómo está mi flujo de caja?');
    await page.press('[data-testid="chat-input"]', 'Enter');

    // Wait for AI response
    const aiResponse = page.locator('[data-testid="chat-response"]').last();
    await expect(aiResponse).toBeVisible({ timeout: 10000 });
    await expect(aiResponse).toContainText(/flujo de caja/i);
  });

  test('should generate financial report', async ({ page }) => {
    await page.goto('/home/ai-cfo/reports');

    await page.selectOption('[data-testid="report-type"]', 'monthly');
    await page.selectOption('[data-testid="report-period"]', '2024-01');
    
    await page.click('[data-testid="generate-report-button"]');

    // Wait for report generation
    const downloadPromise = page.waitForEvent('download');
    await expect(page.locator('[data-testid="report-ready"]')).toBeVisible({ timeout: 15000 });
    await page.click('[data-testid="download-report"]');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('financial-report');
  });
});
```

## Mocking y Test Data

### MSW Setup
```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import { invoiceFixtures } from './fixtures/invoices';

export const handlers = [
  // Invoice processing
  http.post('/api/invoices/process', async ({ request }) => {
    const body = await request.json();
    
    if (body.xmlContent.includes('<invalid>')) {
      return HttpResponse.json(
        { error: 'Invalid XML format' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      invoiceData: invoiceFixtures.processed
    });
  }),

  // AI CFO insights
  http.get('/api/ai-cfo/insights/:companyId', ({ params }) => {
    return HttpResponse.json({
      insights: [
        {
          type: 'cash-flow-warning',
          message: 'Su flujo de caja muestra una tendencia negativa',
          confidence: 0.85
        }
      ]
    });
  }),
];

// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Test Fixtures
```typescript
// tests/fixtures/invoices.ts
export const invoiceFixtures = {
  validXML: `
    <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
      <ID>INV-001</ID>
      <IssueDate>2024-01-15</IssueDate>
      <InvoiceLine>
        <Item>
          <Description>Servicio de consultoría</Description>
        </Item>
        <LineExtensionAmount currencyID="COP">1000000</LineExtensionAmount>
      </InvoiceLine>
    </Invoice>
  `,
  
  processed: {
    id: 'inv_123',
    companyId: 'company_123',
    supplierName: 'Test Supplier',
    amount: 1000000,
    taxAmount: 190000,
    currency: 'COP',
    status: 'completed'
  },

  invalidXML: '<invalid>xml</invalid>',
  
  batchData: [
    { id: 'inv_1', amount: 500000 },
    { id: 'inv_2', amount: 750000 },
    { id: 'inv_3', amount: 1200000 }
  ]
};
```

## Performance Testing

### Load Testing con Artillery
```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Load test"

scenarios:
  - name: "Invoice processing"
    weight: 70
    flow:
      - post:
          url: "/api/invoices/process"
          headers:
            Content-Type: "application/json"
          json:
            xmlContent: "{{ $randomInvoiceXML }}"
            companyId: "{{ $randomCompanyId }}"
            
  - name: "AI CFO queries"
    weight: 30
    flow:
      - get:
          url: "/api/ai-cfo/insights/{{ $randomCompanyId }}"
```

## Test Commands

### Package.json scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:integration": "vitest --config vitest.integration.config.ts",
    "test:load": "artillery run artillery-config.yml",
    "test:all": "pnpm test && pnpm test:e2e"
  }
}
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
        
      - name: Run unit tests
        run: pnpm test:coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Install Playwright
        run: pnpm playwright install --with-deps
        
      - name: Run E2E tests
        run: pnpm test:e2e
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Métricas de Calidad

### Coverage Goals por Módulo
- **Tax Engine Colombia:** 90%+ (crítico para compliance)
- **Invoice Processing:** 85%+ (core business logic)
- **Microsoft Graph Integration:** 80%+ (crítico para ingesta)
- **AI CFO:** 70%+ (más difícil de testear, mucho mocking)
- **Supabase Storage:** 75%+ (manejo de archivos)
- **UI Components:** 60%+ (focus en lógica, no en rendering)
- **Utilities:** 95%+ (funciones puras, fáciles de testear)

### Test Quality Metrics
- **Test execution time:** <30 segundos para unit tests
- **E2E test reliability:** >95% success rate
- **Mutation testing score:** >80% para módulos críticos
- **Test maintenance ratio:** <10% tiempo dedicado a fixing tests

---

Esta estrategia de testing MVP asegura alta calidad y confiabilidad del código, enfocada en las integraciones core (Microsoft Graph, OpenAI, Supabase Storage) y optimizada para desarrollo rápido en Vercel mientras mantiene cobertura robusta para compliance tributario colombiano.