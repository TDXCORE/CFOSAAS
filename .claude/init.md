# Guía de Inicialización - CFO SaaS Platform

## Comando de Inicialización `/init`

Este comando inicializa el contexto completo del proyecto CFO SaaS Platform para Claude Code, cargando toda la información necesaria para el desarrollo.

### Uso
```
/init
```

## Resumen del Proyecto

### Información General
- **Nombre:** Plataforma SaaS de Asistencia Financiera y Automatización Contable para PYMES
- **Objetivo:** Democratizar herramientas financieras avanzadas mediante IA para PYMES en LATAM
- **Stack Base:** Next.js 15 + React 19 + Supabase + TypeScript + Tailwind CSS
- **Repositorio:** NextJS SaaS Starter Kit Lite (Makerkit)

### Problemas que Resuelve
1. **Falta de asesoría estratégica financiera** → AI CFO virtual
2. **Procesos contables manuales y propensos a errores** → Automatización inteligente

### Funcionalidades Core
- **Procesamiento automatizado de facturas** (XML, PDF, ZIP por email)
- **AI CFO** para análisis financiero y recomendaciones estratégicas  
- **Motor tributario** multi-país con cálculo automático de impuestos
- **Integraciones** con sistemas contables (Siigo, SAP, etc.)
- **Dashboard financiero** con KPIs y alertas inteligentes

## Arquitectura del Sistema

### Stack Tecnológico
```typescript
interface TechStack {
  frontend: "Next.js 15 + React 19 + TypeScript 5.8"
  ui: "Tailwind CSS 4.1 + shadcn/ui + Lucide Icons"
  backend: "Supabase (PostgreSQL + Auth + Storage + Edge Functions)"
  ai: "OpenAI GPT-4 Turbo + Azure Cognitive Services"
  deployment: "Vercel + Supabase Cloud"
  monitoring: "Sentry + Vercel Analytics"
}
```

### Estructura de Módulos
```
modules/
├── invoices/              # Procesamiento de facturas
│   ├── components/        # UI components
│   ├── services/          # Business logic
│   ├── hooks/             # React hooks
│   ├── types/             # TypeScript types
│   └── utils/             # Utilities
├── ai-cfo/                # Asistente financiero IA
├── tax-engine/            # Motor de cálculos tributarios  
├── integrations/          # Conectores externos
└── dashboard/             # Dashboard y reportes
```

## Plan de Desarrollo

### Fase 1: MVP (3 meses)
**Objetivo:** Validar concepto con cliente piloto (1,800 facturas/mes)

#### Milestone 1.1: Setup y Base (Semana 1-2)
- [x] Configuración Supabase con variables de producción
- [ ] Implementación de esquemas de base de datos
- [ ] Setup autenticación multi-tenant
- [ ] Pipeline CI/CD en Vercel

#### Milestone 1.2: Core Processing (Semana 3-6)  
- [ ] Procesador de archivos XML (facturas electrónicas)
- [ ] Sistema de ingesta de emails con ZIP
- [ ] Motor básico de clasificación PUC
- [ ] Cálculo de impuestos (IVA, Retención)
- [ ] Interface de carga manual

#### Milestone 1.3: Dashboard Básico (Semana 7-9)
- [ ] Dashboard con KPIs financieros
- [ ] Sistema de exportación (CSV, Excel)
- [ ] Validación manual con checkpoints
- [ ] Gestión multi-tenant

#### Milestone 1.4: Testing y Deploy (Semana 10-12)
- [ ] Testing con datos reales del piloto
- [ ] Optimización de performance (<30s/factura)
- [ ] Documentación completa
- [ ] Deploy a producción

### Fase 2: AI CFO y Integraciones (6 meses)
- AI CFO con ChatGPT integration
- OCR para facturas PDF  
- APIs para sistemas contables
- Análisis sectorial automático

### Fase 3: Escalamiento Regional (12 meses)
- Soporte multi-país (Ecuador, Venezuela)
- Mobile app
- Analytics avanzado con ML
- Marketplace de extensiones

## Base de Datos

### Arquitectura Multi-tenant
- **Estrategia:** Row Level Security (RLS) en Supabase
- **Aislamiento:** Filtrado por `company_id`
- **Escalabilidad:** Connection pooling + índices optimizados

### Tablas Principales
```sql
-- Core multi-tenancy
companies, user_companies

-- Invoice processing  
invoices, invoice_line_items, invoice_taxes

-- Tax engine
tax_rules, puc_accounts, classification_rules

-- AI CFO
ai_insights, chat_conversations, chat_messages

-- Integrations
integration_configs, integration_logs

-- Audit
audit_trail, financial_metrics
```

## Reglas de Código

### Convenciones Principales
- **Componentes:** PascalCase (InvoiceProcessor.tsx)
- **Hooks:** camelCase con 'use' (useInvoiceProcessor.ts)
- **Servicios:** camelCase (invoiceService.ts)
- **Tipos:** PascalCase (InvoiceData.ts)

### Patrones Obligatorios
```typescript
// 1. Usar shadcn/ui components siempre
import { Button } from '@kit/ui/button';

// 2. TanStack Query para data fetching
const { data, isLoading } = useQuery({
  queryKey: ['invoices', companyId],
  queryFn: () => invoiceService.getByCompany(companyId),
});

// 3. Zod para validaciones
const InvoiceSchema = z.object({
  supplierName: z.string().min(1),
  amount: z.number().positive(),
});

// 4. Manejo de errores consistente
try {
  await processInvoice(data);
} catch (error) {
  if (error instanceof InvoiceProcessingError) {
    toast.error(error.message);
  } else {
    toast.error('Something went wrong');
  }
}
```

## Integraciones Clave

### Sistemas Contables
- **Siigo:** Conector principal para Colombia
- **SAP Business One:** Enterprise clients  
- **World Office:** Mercado medio
- **Generic REST API:** Otros sistemas

### Servicios de IA
- **OpenAI GPT-4 Turbo:** AI CFO chatbot y análisis
- **Azure Computer Vision:** OCR para PDFs
- **Custom ML Models:** Clasificación PUC

### Email y Documentos  
- **Gmail/Google Workspace:** Lectura de emails con facturas
- **Microsoft Outlook:** Alternative email provider
- **Supabase Storage:** Almacenamiento de archivos

### Gobierno e Instituciones
- **DIAN Colombia:** Validación de RUT/NIT
- **Cámara de Comercio:** Benchmarks sectoriales
- **Bancos (Open Banking):** Conciliación automática

## Testing Strategy

### Niveles de Testing
- **Unit Tests (70%):** Vitest + Testing Library
- **Integration Tests (20%):** API y servicios  
- **E2E Tests (10%):** Playwright para flujos críticos

### Coverage Objectives
- **Tax Engine:** 90%+ (crítico para compliance)
- **Invoice Processing:** 85%+ (core business logic)
- **AI CFO:** 70%+ (complejo de testear)
- **UI Components:** 60%+ (focus en lógica)

## Variables de Entorno

### Requeridas para Desarrollo
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://ruqxximzgwkdxsskbflg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI  
OPENAI_API_KEY=your_openai_key

# Siigo Integration
SIIGO_USERNAME=your_username
SIIGO_ACCESS_KEY=your_access_key

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Configuración en Supabase
```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Configurar policies básicas
CREATE POLICY "Users can only access their companies" 
ON companies FOR ALL USING (
  id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid()
  )
);
```

## Comandos Útiles

### Desarrollo
```bash
# Iniciar desarrollo
pnpm dev

# Build y test  
pnpm build
pnpm test

# Database setup
pnpm supabase:setup
pnpm db:reset

# Deployment
vercel deploy
```

### Testing
```bash
# Unit tests
pnpm test:watch

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

## Flujos Críticos

### 1. Procesamiento de Factura por Email
```
Email con ZIP → Extracción → Parse XML → Clasificación PUC → 
Cálculo Impuestos → Validación → Storage → Notificación
```

### 2. AI CFO Query
```
User Query → Context Assembly → GPT-4 Processing → 
Structured Response → UI Rendering → Feedback Loop
```

### 3. Exportación a Sistema Contable
```
Facturas Validadas → Format Transformation → API Call → 
Status Tracking → Error Handling → User Notification
```

## Métricas de Éxito

### Técnicas
- **Procesamiento:** >95% accuracy, <30s per invoice
- **Uptime:** >99.9% availability
- **Performance:** <2s page load times

### Negocio
- **Adoption:** 1 piloto → 10 empresas → 100 empresas
- **Revenue:** $5K → $50K → $500K MRR
- **Satisfaction:** >4.5/5 NPS

## Contexto del Starter Kit Existente

### Qué ya está configurado
- ✅ Next.js 15 con App Router
- ✅ Supabase auth con MFA
- ✅ Multi-tenant architecture base
- ✅ shadcn/ui components
- ✅ Tailwind CSS setup
- ✅ TypeScript configuration
- ✅ i18n support
- ✅ Theme system (dark/light)

### Qué necesitamos agregar
- [ ] Módulos de dominio específicos
- [ ] Esquemas de base de datos
- [ ] Procesamiento de archivos
- [ ] Integraciones con IA
- [ ] Sistema de facturación
- [ ] Conectores externos

## Próximos Pasos

### Immediate Actions (Esta Semana)
1. **Database Schema:** Crear migrations iniciales en Supabase
2. **Module Structure:** Establecer estructura de carpetas para módulos
3. **Base Components:** Crear componentes base reutilizables
4. **API Routes:** Implementar endpoints básicos

### Priority Features (Próximas 2 Semanas)
1. **Invoice Upload:** Sistema de carga de archivos
2. **XML Parser:** Procesador de facturas XML
3. **PUC Classification:** Motor básico de clasificación
4. **Dashboard:** Interface principal con métricas

---

**Comando `/init` completo**
Al ejecutar `/init`, Claude Code carga automáticamente:
- ✅ Workplan completo con fases y milestones
- ✅ Reglas de código y convenciones
- ✅ Estrategia de testing
- ✅ PRD técnico detallado
- ✅ Especificaciones de integraciones
- ✅ Esquemas de base de datos
- ✅ Esta guía de inicialización

**Estado actual:** Repositorio base configurado, Supabase conectado, listo para comenzar desarrollo del MVP.