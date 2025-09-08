# Reglas de Código - CFO SaaS Platform

## Stack Tecnológico Base

### Framework y Librerías Core
- **Next.js 15** con App Router (NO Pages Router)
- **React 19** con Concurrent Features
- **TypeScript 5.8** (strict mode habilitado)
- **Tailwind CSS 4.1** con configuración existente
- **Supabase** para backend y base de datos

### Librerías UI y Estado
- **shadcn/ui** para componentes base (ya configurado)
- **TanStack Query 5** para data fetching y cache
- **React Hook Form 7** con Zod para validaciones
- **Zustand** para estado global cuando sea necesario
- **next-themes** para tema dark/light

## Estructura de Directorios

### Mantener estructura existente del starter kit:
```
apps/web/
├── app/                          # Next.js App Router
│   ├── (marketing)/             # Rutas públicas
│   ├── home/                    # Dashboard principal
│   ├── api/                     # API Routes
│   └── globals.css
├── components/                   # Componentes globales
├── lib/                         # Utilidades y configuraciones
├── config/                      # Archivos de configuración
└── types/                       # Definiciones de tipos

### Nuevas carpetas específicas del dominio:
├── modules/                     # Módulos de negocio
│   ├── invoices/               # Módulo de facturas
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   ├── ai-cfo/                 # Módulo AI CFO
│   ├── tax-engine/             # Motor de impuestos
│   └── integrations/           # Integraciones externas
```

## Convenciones de Nomenclatura

### Archivos y Carpetas
```typescript
// Componentes React: PascalCase
InvoiceProcessor.tsx
TaxCalculator.tsx
AICFODashboard.tsx

// Hooks: camelCase con prefijo 'use'
useInvoiceProcessor.ts
useAICFOInsights.ts
useTaxCalculation.ts

// Servicios y utilitarios: camelCase
invoiceService.ts
taxCalculationUtils.ts
emailProcessor.ts

// Tipos y interfaces: PascalCase
InvoiceData.ts
TaxCalculation.ts
CompanyProfile.ts

// Páginas en app/: kebab-case
invoice-processing/
ai-cfo-dashboard/
tax-reports/
```

### Variables y Funciones
```typescript
// Variables: camelCase
const invoiceData = {};
const taxCalculationResult = {};

// Constantes: UPPER_SNAKE_CASE
const MAX_INVOICE_SIZE = 1000;
const DEFAULT_TAX_RATE = 0.19;

// Funciones: camelCase descriptivo
const processInvoiceXML = () => {};
const calculateTaxes = () => {};
const generateFinancialReport = () => {};
```

## Patrones de Código Específicos

### 1. Componentes React

#### Estructura base:
```typescript
'use client'; // Solo si necesita client-side

import { useState, useEffect } from 'react';
import { cn } from '@kit/ui/utils';
import { Button } from '@kit/ui/button';

interface InvoiceProcessorProps {
  companyId: string;
  onProcessComplete: (result: ProcessingResult) => void;
  className?: string;
}

export function InvoiceProcessor({ 
  companyId, 
  onProcessComplete, 
  className 
}: InvoiceProcessorProps) {
  // Hooks al inicio
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Event handlers
  const handleProcess = async () => {
    // Implementation
  };
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* JSX */}
    </div>
  );
}
```

### 2. Hooks Personalizados

#### Para lógica de negocio:
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { invoiceService } from '~/modules/invoices/services/invoiceService';

export function useInvoiceProcessor(companyId: string) {
  const processInvoice = useMutation({
    mutationFn: invoiceService.processXML,
    onSuccess: (data) => {
      // Invalidar queries relacionadas
    },
  });

  const invoices = useQuery({
    queryKey: ['invoices', companyId],
    queryFn: () => invoiceService.getByCompany(companyId),
  });

  return {
    processInvoice,
    invoices,
    isProcessing: processInvoice.isPending,
  };
}
```

### 3. Servicios y APIs

#### API Routes (app/api/):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const ProcessInvoiceSchema = z.object({
  xmlContent: z.string(),
  companyId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { xmlContent, companyId } = ProcessInvoiceSchema.parse(body);
    
    const supabase = getSupabaseServerClient();
    
    // Lógica de procesamiento
    const result = await processInvoiceXML(xmlContent, companyId);
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error processing invoice:', error);
    return NextResponse.json(
      { error: 'Failed to process invoice' }, 
      { status: 500 }
    );
  }
}
```

#### Servicios del lado cliente:
```typescript
import { createClient } from '@supabase/supabase-js';

export const invoiceService = {
  async processXML(xmlContent: string, companyId: string) {
    const response = await fetch('/api/invoices/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xmlContent, companyId }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to process invoice');
    }
    
    return response.json();
  },

  async getByCompany(companyId: string) {
    // Implementación con Supabase
  },
};
```

## Tipos y Validaciones

### Definición de tipos de dominio:
```typescript
// modules/invoices/types/InvoiceTypes.ts
export interface InvoiceData {
  id: string;
  companyId: string;
  supplierName: string;
  supplierTaxId: string;
  invoiceNumber: string;
  issueDate: Date;
  amount: number;
  taxAmount: number;
  currency: 'COP' | 'USD' | 'EUR';
  status: 'pending' | 'processing' | 'completed' | 'error';
  sourceFile: string;
  processingMetadata?: ProcessingMetadata;
}

export interface ProcessingMetadata {
  accuracy: number;
  processingTime: number;
  errorMessages?: string[];
  classifications: AccountClassification[];
}

export interface AccountClassification {
  pucCode: string;
  accountName: string;
  amount: number;
  confidence: number;
}
```

### Esquemas de validación con Zod:
```typescript
// modules/invoices/schemas/invoiceSchemas.ts
import { z } from 'zod';

export const InvoiceSchema = z.object({
  supplierName: z.string().min(1, 'Supplier name is required'),
  supplierTaxId: z.string().regex(/^\d{9,11}$/, 'Invalid tax ID format'),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['COP', 'USD', 'EUR']),
});

export const ProcessInvoiceRequestSchema = z.object({
  xmlContent: z.string().min(1, 'XML content is required'),
  companyId: z.string().uuid('Invalid company ID'),
});
```

## Manejo de Estados y Datos

### TanStack Query para data fetching:
```typescript
// Configuración en app/layout.tsx ya existe
// Usar para todas las operaciones de datos

// Query Keys consistentes:
export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: string) => [...invoiceKeys.lists(), { filters }] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
};
```

### Zustand para estado global (usar con moderación):
```typescript
// lib/stores/appStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppState {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company) => void;
  processingQueue: string[];
  addToQueue: (invoiceId: string) => void;
  removeFromQueue: (invoiceId: string) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        currentCompany: null,
        setCurrentCompany: (company) => set({ currentCompany: company }),
        processingQueue: [],
        addToQueue: (invoiceId) => 
          set((state) => ({ 
            processingQueue: [...state.processingQueue, invoiceId] 
          })),
        removeFromQueue: (invoiceId) =>
          set((state) => ({
            processingQueue: state.processingQueue.filter(id => id !== invoiceId)
          })),
      }),
      { name: 'app-store' }
    )
  )
);
```

## Styling y UI

### Usar Tailwind con shadcn/ui:
```typescript
// Siempre usar la utilidad cn para condicional styling
import { cn } from '@kit/ui/utils';

// ✅ Correcto
<div className={cn(
  "base-classes here",
  isActive && "active-classes",
  variant === 'danger' && "danger-classes",
  className // Siempre permitir className override
)} />

// ❌ Incorrecto
<div className={`base-classes ${isActive ? 'active' : ''}`} />
```

### Componentes consistentes:
```typescript
// Usar componentes existentes de @kit/ui cuando sea posible
import { Button } from '@kit/ui/button';
import { Card } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Toast } from '@kit/ui/toast';

// Crear componentes específicos solo cuando sea necesario
// En modules/[domain]/components/
```

## Error Handling y Logging

### Manejo de errores consistente:
```typescript
// En servicios
export class InvoiceProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'InvoiceProcessingError';
  }
}

// En componentes
try {
  await processInvoice(data);
} catch (error) {
  if (error instanceof InvoiceProcessingError) {
    toast.error(error.message);
    // Log específico del error
  } else {
    toast.error('Something went wrong');
    console.error('Unexpected error:', error);
  }
}
```

### Logging estructurado:
```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, meta?: object) => {
    console.log(JSON.stringify({ level: 'info', message, meta, timestamp: new Date().toISOString() }));
  },
  error: (message: string, error?: Error, meta?: object) => {
    console.error(JSON.stringify({ level: 'error', message, error: error?.message, meta, timestamp: new Date().toISOString() }));
  },
  // etc...
};
```

## Testing

### Unit tests con Jest/Vitest:
```typescript
// modules/invoices/__tests__/invoiceService.test.ts
import { describe, it, expect, vi } from 'vitest';
import { invoiceService } from '../services/invoiceService';

describe('InvoiceService', () => {
  it('should process XML correctly', async () => {
    const xmlContent = '<xml>...</xml>';
    const companyId = 'company-123';
    
    const result = await invoiceService.processXML(xmlContent, companyId);
    
    expect(result).toMatchObject({
      success: true,
      invoiceData: expect.any(Object)
    });
  });
});
```

### Integration tests:
```typescript
// __tests__/api/invoices.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '~/app/api/invoices/process/route';

describe('/api/invoices/process', () => {
  it('should process invoice successfully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        xmlContent: validXMLContent,
        companyId: 'test-company-id'
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
  });
});
```

## Performance y Optimización

### Code Splitting:
```typescript
// Lazy loading para módulos pesados
import dynamic from 'next/dynamic';

const InvoiceProcessor = dynamic(
  () => import('~/modules/invoices/components/InvoiceProcessor'),
  { 
    loading: () => <InvoiceProcessorSkeleton />,
    ssr: false // Si no necesita SSR
  }
);
```

### Memoización:
```typescript
import { useMemo, useCallback } from 'react';

// Para cálculos costosos
const expensiveCalculation = useMemo(() => {
  return heavyProcessing(data);
}, [data]);

// Para funciones que se pasan como props
const handleProcess = useCallback((invoiceId: string) => {
  // Implementation
}, [dependency]);
```

## Seguridad

### Validación en ambos lados:
```typescript
// Siempre validar en el servidor
export async function POST(request: NextRequest) {
  const data = ProcessInvoiceRequestSchema.parse(await request.json());
  // Process...
}

// Y también en el cliente para UX
const handleSubmit = (data: InvoiceFormData) => {
  try {
    InvoiceSchema.parse(data);
    // Submit...
  } catch (error) {
    // Show validation errors
  }
};
```

### Sanitización de datos:
```typescript
import DOMPurify from 'dompurify';

// Para contenido HTML generado por IA
const sanitizedContent = DOMPurify.sanitize(aiGeneratedHTML);
```

---

**Nota:** Estas reglas deben seguirse consistentemente en todo el proyecto para mantener la calidad y mantenibilidad del código. Aprovechar al máximo la configuración existente del starter kit de Makerkit.