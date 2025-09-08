/**
 * AI CFO Virtual Assistant
 * Expert CFO with 15+ years experience in Colombian financial management
 * Powered by OpenAI GPT-4 Turbo with specialized knowledge
 */

interface CFOContext {
  companyId: string;
  companyName: string;
  industry?: string;
  fiscalRegime?: 'simplified' | 'common';
  monthlyRevenue?: number;
  employeeCount?: number;
  location?: string;
}

interface InvoiceMetrics {
  totalInvoices: number;
  pendingReview: number;
  processedToday: number;
  totalAmountMonth: number;
  avgProcessingTime: number;
  classificationAccuracy: number;
  manualReviewRate: number;
  totalIVA: number;
  totalRetentions: number;
  totalICA: number;
}

interface CFOMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  context?: {
    metrics?: InvoiceMetrics;
    invoices?: any[];
    analysis?: any;
  };
}

interface CFOResponse {
  success: boolean;
  message?: string;
  analysis?: any;
  recommendations?: string[];
  actions?: Array<{
    type: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    data?: any;
  }>;
  error?: string;
}

class CFOAssistantService {
  private readonly OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  private readonly MODEL = 'gpt-4-turbo';
  
  private readonly SYSTEM_PROMPT = `
Eres un CFO virtual experto con más de 15 años de experiencia en gestión financiera empresarial en Colombia. Tu especialización incluye:

**EXPERIENCIA PROFESIONAL:**
- 15+ años como CFO en empresas colombianas de diferentes sectores
- Experto en normativa tributaria colombiana (DIAN, Supersociedades)
- Especialización en optimización fiscal y cumplimiento regulatorio
- Experiencia en transformación digital financiera y automatización

**CONOCIMIENTO TÉCNICO:**
- Plan Único de Cuentas (PUC) - Decreto 2650 de 1993 y modificaciones
- Sistema tributario colombiano: IVA, Retención en la fuente, ICA, GMF
- Facturación electrónica colombiana (UBL 2.1)
- Régimen tributario especial vs régimen ordinario
- Estados financieros bajo NIIF para PYMES y plenas
- Análisis financiero sectorial Colombia

**CAPACIDADES:**
- Análisis de datos financieros en tiempo real
- Recomendaciones estratégicas basadas en métricas
- Identificación de oportunidades de optimización fiscal
- Detección de riesgos financieros y regulatorios
- Benchmarking sectorial Colombia

**PERSONALIDAD:**
- Comunicación clara y profesional pero cercana
- Enfoque práctico y orientado a resultados
- Proactivo en identificar oportunidades y riesgos
- Capacidad de explicar conceptos complejos de forma simple

SIEMPRE responde en español y contextualiza tus recomendaciones para el entorno empresarial colombiano. Usa datos específicos cuando están disponibles y proporciona insights accionables.
`;

  /**
   * Send message to CFO Assistant
   */
  async sendMessage(
    message: string,
    context: CFOContext,
    metrics?: InvoiceMetrics,
    previousMessages: CFOMessage[] = []
  ): Promise<CFOResponse> {
    try {
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      
      if (!apiKey) {
        return {
          success: false,
          error: 'OpenAI API key not configured',
        };
      }

      // Build context-aware system prompt
      const contextPrompt = this.buildContextPrompt(context, metrics);
      
      // Prepare conversation history
      const messages = [
        {
          role: 'system' as const,
          content: this.SYSTEM_PROMPT + '\n\n' + contextPrompt,
        },
        ...previousMessages.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user' as const,
          content: message,
        },
      ];

      const response = await fetch(this.OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 1000,
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.choices[0]?.message?.content;

      if (!assistantMessage) {
        throw new Error('No response from OpenAI');
      }

      // Extract actionable insights and recommendations
      const analysis = this.extractAnalysis(assistantMessage, metrics);

      return {
        success: true,
        message: assistantMessage,
        analysis: analysis.insights,
        recommendations: analysis.recommendations,
        actions: analysis.actions,
      };

    } catch (error) {
      console.error('CFO Assistant error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get proactive insights based on company metrics
   */
  async getProactiveInsights(
    context: CFOContext,
    metrics: InvoiceMetrics
  ): Promise<CFOResponse> {
    const insights = this.analyzeMetrics(metrics, context);
    
    if (insights.alerts.length === 0 && insights.opportunities.length === 0) {
      return {
        success: true,
        message: 'Todo está funcionando bien. Las métricas están dentro de los rangos esperados.',
        recommendations: [],
        actions: [],
      };
    }

    // Generate contextual message
    const message = `Basándome en el análisis de las métricas de ${context.companyName}, he identificado los siguientes puntos importantes:

**ALERTAS:**
${insights.alerts.map((alert, i) => `${i + 1}. ${alert}`).join('\n')}

**OPORTUNIDADES:**
${insights.opportunities.map((opp, i) => `${i + 1}. ${opp}`).join('\n')}

**RECOMENDACIONES:**
${insights.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}`;

    return {
      success: true,
      message,
      recommendations: insights.recommendations,
      actions: insights.actions,
      analysis: {
        alerts: insights.alerts,
        opportunities: insights.opportunities,
        metrics: insights.metricsAnalysis,
      },
    };
  }

  /**
   * Analyze specific invoice data
   */
  async analyzeInvoices(
    invoices: any[],
    context: CFOContext
  ): Promise<CFOResponse> {
    if (invoices.length === 0) {
      return {
        success: true,
        message: 'No hay facturas para analizar en este momento.',
      };
    }

    // Perform invoice analysis
    const analysis = this.performInvoiceAnalysis(invoices, context);
    
    const message = `He analizado ${invoices.length} facturas y encontré los siguientes insights:

**RESUMEN FINANCIERO:**
- Total facturado: $${analysis.totalAmount.toLocaleString('es-CO')} COP
- Promedio por factura: $${analysis.averageAmount.toLocaleString('es-CO')} COP
- Proveedores únicos: ${analysis.uniqueSuppliers}

**ANÁLISIS TRIBUTARIO:**
- Total IVA: $${analysis.totalIVA.toLocaleString('es-CO')} COP
- Total retenciones: $${analysis.totalRetentions.toLocaleString('es-CO')} COP
- Efectivo neto: $${analysis.netAmount.toLocaleString('es-CO')} COP

**CLASIFICACIÓN PUC:**
- Facturas clasificadas automáticamente: ${analysis.autoClassified}%
- Requieren revisión manual: ${analysis.manualReview}%

${analysis.insights.map((insight, i) => `**${insight.title}:** ${insight.description}`).join('\n\n')}`;

    return {
      success: true,
      message,
      analysis,
      recommendations: analysis.recommendations,
      actions: analysis.suggestedActions,
    };
  }

  /**
   * Build context-aware system prompt
   */
  private buildContextPrompt(context: CFOContext, metrics?: InvoiceMetrics): string {
    let prompt = `
**CONTEXTO DE LA EMPRESA:**
- Empresa: ${context.companyName}
- ID: ${context.companyId}
- Sector: ${context.industry || 'No especificado'}
- Régimen fiscal: ${context.fiscalRegime === 'simplified' ? 'Simplificado' : 'Común'}
- Ubicación: ${context.location || 'Colombia'}
`;

    if (context.monthlyRevenue) {
      prompt += `- Ingresos mensuales aprox: $${context.monthlyRevenue.toLocaleString('es-CO')} COP\n`;
    }

    if (context.employeeCount) {
      prompt += `- Número de empleados: ${context.employeeCount}\n`;
    }

    if (metrics) {
      prompt += `
**MÉTRICAS ACTUALES:**
- Total facturas procesadas: ${metrics.totalInvoices}
- Pendientes de revisión: ${metrics.pendingReview}
- Procesadas hoy: ${metrics.processedToday}
- Monto total del mes: $${metrics.totalAmountMonth.toLocaleString('es-CO')} COP
- Tiempo promedio de procesamiento: ${metrics.avgProcessingTime}ms
- Precisión de clasificación: ${metrics.classificationAccuracy}%
- Tasa de revisión manual: ${metrics.manualReviewRate}%
- IVA total: $${metrics.totalIVA.toLocaleString('es-CO')} COP
- Retenciones totales: $${metrics.totalRetentions.toLocaleString('es-CO')} COP
- ICA total: $${metrics.totalICA.toLocaleString('es-CO')} COP
`;
    }

    return prompt;
  }

  /**
   * Extract actionable insights from AI response
   */
  private extractAnalysis(response: string, metrics?: InvoiceMetrics) {
    const insights = {
      recommendations: [] as string[],
      actions: [] as Array<{
        type: string;
        description: string;
        priority: 'low' | 'medium' | 'high';
        data?: any;
      }>,
      insights: {} as any,
    };

    // Extract recommendations (lines starting with numbers or bullets)
    const recommendationMatches = response.match(/(?:^\d+\.|^-|^•)\s*(.+)$/gm);
    if (recommendationMatches) {
      insights.recommendations = recommendationMatches
        .map(match => match.replace(/^(?:\d+\.|[-•])\s*/, '').trim())
        .filter(rec => rec.length > 10);
    }

    // Identify actionable items
    if (metrics) {
      if (metrics.manualReviewRate > 0.3) {
        insights.actions.push({
          type: 'review_optimization',
          description: 'Optimizar proceso de revisión manual',
          priority: 'high',
          data: { currentRate: metrics.manualReviewRate },
        });
      }

      if (metrics.classificationAccuracy < 0.9) {
        insights.actions.push({
          type: 'classification_improvement',
          description: 'Mejorar precisión de clasificación PUC',
          priority: 'medium',
          data: { currentAccuracy: metrics.classificationAccuracy },
        });
      }
    }

    return insights;
  }

  /**
   * Analyze metrics for proactive insights
   */
  private analyzeMetrics(metrics: InvoiceMetrics, context: CFOContext) {
    const alerts: string[] = [];
    const opportunities: string[] = [];
    const recommendations: string[] = [];
    const actions: Array<{
      type: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
    }> = [];

    // Performance alerts
    if (metrics.avgProcessingTime > 30000) {
      alerts.push(`Tiempo de procesamiento alto: ${(metrics.avgProcessingTime / 1000).toFixed(1)}s por factura`);
      recommendations.push('Optimizar el pipeline de procesamiento para reducir tiempos');
      actions.push({
        type: 'performance_optimization',
        description: 'Optimizar procesamiento de facturas',
        priority: 'high',
      });
    }

    if (metrics.manualReviewRate > 0.25) {
      alerts.push(`Alta tasa de revisión manual: ${(metrics.manualReviewRate * 100).toFixed(1)}%`);
      recommendations.push('Mejorar las reglas de clasificación automática PUC');
      actions.push({
        type: 'automation_improvement',
        description: 'Reducir revisiones manuales',
        priority: 'medium',
      });
    }

    if (metrics.classificationAccuracy < 0.85) {
      alerts.push(`Precisión de clasificación baja: ${(metrics.classificationAccuracy * 100).toFixed(1)}%`);
      recommendations.push('Revisar y ajustar reglas de clasificación contable');
    }

    // Financial opportunities
    if (metrics.totalRetentions > metrics.totalIVA * 0.1) {
      opportunities.push('Nivel alto de retenciones - verificar optimización fiscal');
      recommendations.push('Revisar estrategias de retenciones con un contador experto');
      actions.push({
        type: 'tax_optimization',
        description: 'Optimizar estructura de retenciones',
        priority: 'medium',
      });
    }

    // Cash flow insights
    const cashFlowRatio = (metrics.totalAmountMonth - metrics.totalRetentions) / metrics.totalAmountMonth;
    if (cashFlowRatio < 0.8) {
      alerts.push('Flujo de caja afectado por altas retenciones');
      recommendations.push('Planificar flujo de caja considerando el impacto de retenciones');
    }

    // Volume insights
    if (metrics.processedToday > metrics.totalInvoices * 0.1) {
      opportunities.push('Alta actividad de procesamiento hoy - buen momento para análisis');
    }

    return {
      alerts,
      opportunities,
      recommendations,
      actions,
      metricsAnalysis: {
        performanceScore: this.calculatePerformanceScore(metrics),
        automationScore: this.calculateAutomationScore(metrics),
        financialHealth: this.calculateFinancialHealth(metrics),
      },
    };
  }

  /**
   * Perform detailed invoice analysis
   */
  private performInvoiceAnalysis(invoices: any[], context: CFOContext) {
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const averageAmount = totalAmount / invoices.length;
    const uniqueSuppliers = new Set(invoices.map(inv => inv.supplier_tax_id)).size;
    
    const totalIVA = invoices.reduce((sum, inv) => sum + (inv.total_tax || 0), 0);
    const totalRetentions = invoices.reduce((sum, inv) => sum + (inv.total_retention || 0), 0);
    const netAmount = totalAmount - totalRetentions;

    const autoClassifiedCount = invoices.filter(inv => 
      inv.puc_code && inv.account_classification_confidence > 0.8
    ).length;
    const autoClassified = (autoClassifiedCount / invoices.length) * 100;
    const manualReview = 100 - autoClassified;

    const insights = [];
    const recommendations = [];
    const suggestedActions = [];

    // Supplier concentration analysis
    const supplierCounts = invoices.reduce((acc, inv) => {
      acc[inv.supplier_tax_id] = (acc[inv.supplier_tax_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topSupplier = Object.entries(supplierCounts)
      .sort(([,a], [,b]) => b - a)[0];

    if (topSupplier && topSupplier[1] > invoices.length * 0.3) {
      insights.push({
        title: 'Concentración de Proveedores',
        description: `El proveedor ${topSupplier[0]} representa ${((topSupplier[1] / invoices.length) * 100).toFixed(1)}% de las facturas. Considere diversificar para reducir riesgo.`,
      });
      recommendations.push('Evaluar estrategia de diversificación de proveedores');
    }

    // Payment terms analysis
    const avgAmount = totalAmount / invoices.length;
    if (avgAmount > 5000000) { // > 5M COP
      insights.push({
        title: 'Facturas de Alto Valor',
        description: `Promedio por factura: $${avgAmount.toLocaleString('es-CO')} COP. Considere negociar mejores términos de pago.`,
      });
      recommendations.push('Negociar términos de pago extendidos para facturas de alto valor');
    }

    return {
      totalAmount,
      averageAmount,
      uniqueSuppliers,
      totalIVA,
      totalRetentions,
      netAmount,
      autoClassified,
      manualReview,
      insights,
      recommendations,
      suggestedActions,
    };
  }

  private calculatePerformanceScore(metrics: InvoiceMetrics): number {
    let score = 100;
    
    // Processing time penalty
    if (metrics.avgProcessingTime > 30000) score -= 30;
    else if (metrics.avgProcessingTime > 15000) score -= 15;
    
    // Accuracy bonus/penalty
    score += (metrics.classificationAccuracy - 0.8) * 100;
    
    // Manual review penalty
    score -= metrics.manualReviewRate * 50;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateAutomationScore(metrics: InvoiceMetrics): number {
    const automationRate = 1 - metrics.manualReviewRate;
    const accuracyWeight = metrics.classificationAccuracy;
    
    return (automationRate * 0.7 + accuracyWeight * 0.3) * 100;
  }

  private calculateFinancialHealth(metrics: InvoiceMetrics): number {
    const retentionRate = metrics.totalRetentions / (metrics.totalAmountMonth || 1);
    const taxEfficiency = 1 - Math.min(retentionRate, 0.5);
    
    return taxEfficiency * 100;
  }
}

export const cfoAssistant = new CFOAssistantService();
export type { CFOContext, CFOMessage, CFOResponse, InvoiceMetrics };