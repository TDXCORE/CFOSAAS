/**
 * OpenAI Service - AI CFO Integration
 * Colombian Financial Intelligence powered by GPT-4
 */

import OpenAI from 'openai';

// Environment configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('OpenAI API key not found. AI CFO will use fallback responses.');
}

const openai = OPENAI_API_KEY ? new OpenAI({
  apiKey: OPENAI_API_KEY,
}) : null;

// Colombian Financial Context
const COLOMBIAN_CFO_SYSTEM_PROMPT = `
Eres un CFO virtual experto especializado en finanzas colombianas. Tu nombre es "CFO Virtual" y eres el asistente financiero inteligente de una plataforma SaaS.

EXPERTISE:
- Código tributario colombiano (IVA 19%, retenciones, ICA)
- Plan Único de Cuentas (PUC) Colombia
- Regulaciones DIAN y normatividad contable colombiana
- Análisis financiero para PYMES en Colombia
- Optimización fiscal legal
- Flujo de caja y proyecciones financieras
- Análisis de KPIs financieros colombianos

PERSONALIDAD:
- Profesional pero accesible
- Explicas conceptos complejos de forma simple
- Siempre das ejemplos prácticos colombianos
- Enfocado en generar valor y eficiencia
- Responsable y ético en temas tributarios

FORMATO DE RESPUESTAS:
- Respuestas concisas pero completas
- Usa emojis ocasionalmente para claridad (📊, 💰, ⚠️, ✅)
- Incluye ejemplos con pesos colombianos (COP)
- Sugiere acciones concretas cuando sea relevante
- Menciona fechas importantes del calendario tributario cuando aplique

LIMITACIONES:
- No puedes acceder a sistemas externos
- No puedes realizar transacciones
- Siempre recomienda consultar con contador certificado para decisiones importantes
- No das consejos legales específicos, solo orientación general
`;

// Financial Context Types
interface CompanyContext {
  name: string;
  taxId: string;
  industry?: string;
  monthlyRevenue?: number;
  employeeCount?: number;
}

interface ConversationContext {
  company?: CompanyContext;
  recentMessages?: string[];
  currentKPIs?: {
    revenue: number;
    expenses: number;
    taxBurden: number;
    cashFlow: number;
  };
}

interface AIResponse {
  message: string;
  suggestions?: string[];
  actionItems?: string[];
  relatedTopics?: string[];
}

export class OpenAIService {
  
  /**
   * Generate AI CFO response with Colombian financial context
   */
  async generateCFOResponse(
    userMessage: string,
    context: ConversationContext = {}
  ): Promise<AIResponse> {
    
    // Fallback response if OpenAI is not available
    if (!openai) {
      return this.getFallbackResponse(userMessage, context);
    }

    try {
      // Build context-aware prompt
      const contextPrompt = this.buildContextPrompt(context);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: COLOMBIAN_CFO_SYSTEM_PROMPT + contextPrompt
          },
          {
            role: "user", 
            content: userMessage
          }
        ],
        max_tokens: 800,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const aiMessage = completion.choices[0]?.message?.content || '';
      
      return {
        message: aiMessage,
        suggestions: this.extractSuggestions(aiMessage),
        actionItems: this.extractActionItems(aiMessage),
        relatedTopics: this.getRelatedTopics(userMessage)
      };

    } catch (error) {
      console.error('OpenAI API Error:', error);
      return this.getFallbackResponse(userMessage, context);
    }
  }

  /**
   * Build context prompt with company and financial data
   */
  private buildContextPrompt(context: ConversationContext): string {
    let prompt = '\n\nCONTEXTO ACTUAL:\n';
    
    if (context.company) {
      prompt += `Empresa: ${context.company.name}\n`;
      prompt += `NIT: ${context.company.taxId}\n`;
      
      if (context.company.industry) {
        prompt += `Sector: ${context.company.industry}\n`;
      }
      
      if (context.company.monthlyRevenue) {
        prompt += `Ingresos mensuales aproximados: ${this.formatCurrency(context.company.monthlyRevenue)}\n`;
      }
      
      if (context.company.employeeCount) {
        prompt += `Número de empleados: ${context.company.employeeCount}\n`;
      }
    }
    
    if (context.currentKPIs) {
      prompt += `\nMÉTRICAS ACTUALES:\n`;
      prompt += `- Ingresos: ${this.formatCurrency(context.currentKPIs.revenue)}\n`;
      prompt += `- Gastos: ${this.formatCurrency(context.currentKPIs.expenses)}\n`;
      prompt += `- Carga tributaria: ${context.currentKPIs.taxBurden}%\n`;
      prompt += `- Flujo de caja: ${this.formatCurrency(context.currentKPIs.cashFlow)}\n`;
    }
    
    return prompt;
  }

  /**
   * Extract actionable suggestions from AI response
   */
  private extractSuggestions(message: string): string[] {
    const suggestions: string[] = [];
    
    // Look for bullet points or numbered lists
    const lines = message.split('\n');
    for (const line of lines) {
      if (line.includes('recomiendo') || line.includes('sugiero') || line.includes('podrías')) {
        suggestions.push(line.trim());
      }
    }
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Extract action items from AI response
   */
  private extractActionItems(message: string): string[] {
    const actions: string[] = [];
    
    const actionKeywords = ['debes', 'necesitas', 'implementar', 'revisar', 'calcular', 'actualizar'];
    const lines = message.split('\n');
    
    for (const line of lines) {
      if (actionKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
        actions.push(line.trim());
      }
    }
    
    return actions.slice(0, 3); // Limit to 3 actions
  }

  /**
   * Get related financial topics based on user message
   */
  private getRelatedTopics(userMessage: string): string[] {
    const message = userMessage.toLowerCase();
    const topics: string[] = [];
    
    const topicMap: Record<string, string[]> = {
      'impuesto': ['Optimización fiscal', 'Deducciones tributarias', 'Calendario DIAN'],
      'factura': ['Clasificación PUC', 'Retenciones', 'IVA descontable'],
      'flujo': ['Proyecciones financieras', 'Capital de trabajo', 'Financiamiento'],
      'gasto': ['Control de costos', 'Presupuestación', 'Análisis de varianza'],
      'ingreso': ['Diversificación', 'Proyecciones de ventas', 'Análisis de rentabilidad']
    };
    
    for (const [keyword, relatedTopics] of Object.entries(topicMap)) {
      if (message.includes(keyword)) {
        topics.push(...relatedTopics);
      }
    }
    
    return [...new Set(topics)].slice(0, 4); // Remove duplicates and limit
  }

  /**
   * Fallback response when OpenAI is not available
   */
  private getFallbackResponse(userMessage: string, context: ConversationContext): AIResponse {
    const message = userMessage.toLowerCase();
    
    // Context-aware fallback responses
    if (message.includes('impuesto') || message.includes('tributario')) {
      return {
        message: `📊 Entiendo tu consulta sobre impuestos. En Colombia, las empresas deben considerar:\n\n• IVA del 19% sobre bienes y servicios gravados\n• Retención en la fuente según la actividad económica\n• ICA municipal (varía por ciudad)\n• Impuesto de renta corporativo\n\n💡 **Recomendación:** Revisa tu clasificación PUC y asegúrate de estar aprovechando todas las deducciones permitidas por la DIAN.\n\n⚠️ Para optimización fiscal específica, consulta con tu contador certificado.`,
        suggestions: [
          'Revisar deducciones tributarias disponibles',
          'Actualizar clasificación contable PUC',
          'Planificar pagos de impuestos trimestrales'
        ],
        relatedTopics: ['Retenciones', 'Deducciones', 'Calendario DIAN']
      };
    }

    if (message.includes('flujo') || message.includes('caja')) {
      return {
        message: `💰 El flujo de caja es fundamental para la salud financiera de tu empresa${context.company ? ` ${context.company.name}` : ''}.\n\n**Análisis recomendado:**\n• Ingresos vs gastos mensuales\n• Ciclo de conversión de efectivo\n• Proyecciones a 3-6 meses\n• Capital de trabajo necesario\n\n📈 **Sugerencia:** Implementa un dashboard de flujo de caja semanal para tomar decisiones oportunas.\n\n✅ Considera líneas de crédito preventivas para cubrir baches estacionales.`,
        suggestions: [
          'Crear proyección de flujo de caja a 90 días',
          'Negociar términos de pago con proveedores',
          'Establecer línea de crédito de respaldo'
        ],
        relatedTopics: ['Capital de trabajo', 'Financiamiento', 'Proyecciones']
      };
    }

    // Generic financial guidance
    return {
      message: `¡Hola! Soy tu CFO Virtual especializado en finanzas colombianas 🇨🇴\n\nPuedo ayudarte con:\n• Análisis de KPIs financieros\n• Optimización fiscal colombiana\n• Interpretación de facturas y gastos\n• Proyecciones de flujo de caja\n• Estrategias de crecimiento financiero\n\n💡 **Para comenzar**, cuéntame qué aspecto financiero te interesa analizar o si tienes alguna pregunta específica sobre tu empresa${context.company ? ` ${context.company.name}` : ''}.`,
      suggestions: [
        'Analizar métricas del dashboard actual',
        'Revisar optimizaciones fiscales',
        'Explicar KPIs financieros importantes'
      ],
      relatedTopics: ['Dashboard', 'Impuestos', 'KPIs', 'Análisis financiero']
    };
  }

  /**
   * Format currency in Colombian pesos
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Analyze uploaded financial document (future implementation)
   */
  async analyzeDocument(documentContent: string, documentType: 'invoice' | 'report' | 'statement'): Promise<AIResponse> {
    // This will be implemented when we add document processing
    return {
      message: '📄 Funcionalidad de análisis de documentos en desarrollo. Próximamente podrás subir facturas y reportes para análisis automático.',
      suggestions: ['Usar análisis manual por ahora'],
      relatedTopics: ['Procesamiento de facturas']
    };
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();