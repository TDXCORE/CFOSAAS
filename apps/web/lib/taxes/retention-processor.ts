/**
 * Retention Processor for Colombian Tax System
 * Processes and calculates detailed retentions (RETEFUENTE, RETEICA, RETEIVA)
 */

import { colombianTaxEngine, type TaxCalculationResult, type InvoiceTaxContext } from './colombian-tax-engine';
import { entityValidator, type TaxEntity } from './entity-validator';
import type { Invoice } from '../invoices/types';

export interface RetentionDetail {
  tax_type: 'RETENCION_FUENTE' | 'RETENCION_ICA' | 'RETENCION_IVA';
  concept_code: string;
  concept_description: string;
  taxable_base: number;
  tax_rate: number;
  tax_amount: number;
  threshold_uvt?: number;
  municipality?: string;
  supplier_type: string;
  calculation_method: 'automatic' | 'manual' | 'override';
  applied_rule: string;
  confidence: number;
  dian_code?: string;
  municipal_code?: string;
}

export interface RetentionBreakdown {
  retefuente: RetentionDetail[];
  reteica: RetentionDetail[];
  reteiva: RetentionDetail[];
  total_retentions: number;
  summary: {
    total_retefuente: number;
    total_reteica: number;
    total_reteiva: number;
    net_amount: number;
  };
}

export interface EntityPair {
  supplier: TaxEntity;
  customer: TaxEntity;
}

export interface ProcessingContext {
  invoice: Invoice;
  entities: EntityPair;
  municipality?: string;
  service_classification?: string;
}

export class RetentionProcessor {
  /**
   * Process all retentions for an invoice
   */
  async processInvoiceRetentions(
    invoice: Invoice,
    supplierTaxId: string,
    customerTaxId: string,
    municipality?: string
  ): Promise<RetentionBreakdown> {

    // Validate entities
    const supplierValidation = await entityValidator.validateEntity(supplierTaxId, invoice.supplier_name);
    const customerValidation = await entityValidator.validateEntity(customerTaxId, 'Customer Entity');

    const entities: EntityPair = {
      supplier: supplierValidation.entity,
      customer: customerValidation.entity
    };

    // Create processing context
    const context: ProcessingContext = {
      invoice,
      entities,
      municipality: municipality || 'Bogotá', // Default to Bogotá
      service_classification: this.classifyService(invoice)
    };

    // Process each type of retention
    const retefuente = await this.processRetefuente(context);
    const reteica = await this.processReteica(context);
    const reteiva = await this.processReteiva(context);

    // Calculate totals
    const totalRetefuente = retefuente.reduce((sum, ret) => sum + ret.tax_amount, 0);
    const totalReteica = reteica.reduce((sum, ret) => sum + ret.tax_amount, 0);
    const totalReteiva = reteiva.reduce((sum, ret) => sum + ret.tax_amount, 0);
    const totalRetentions = totalRetefuente + totalReteica + totalReteiva;

    return {
      retefuente,
      reteica,
      reteiva,
      total_retentions: totalRetentions,
      summary: {
        total_retefuente: totalRetefuente,
        total_reteica: totalReteica,
        total_reteiva: totalReteiva,
        net_amount: invoice.total_amount - totalRetentions
      }
    };
  }

  /**
   * Process Retención en la Fuente
   */
  private async processRetefuente(context: ProcessingContext): Promise<RetentionDetail[]> {
    const { invoice, entities } = context;
    const retentions: RetentionDetail[] = [];

    // Only proceed if customer is retention agent
    if (!entities.customer.is_retention_agent) {
      return retentions;
    }

    // Create tax context for engine
    const taxContext: InvoiceTaxContext = {
      invoice_amount: invoice.subtotal,
      service_type: this.mapServiceType(context.service_classification || 'services'),
      supplier: {
        tax_id: entities.supplier.tax_id,
        name: entities.supplier.name,
        entity_type: entities.supplier.entity_type,
        municipality: context.municipality,
        is_ica_subject: entities.supplier.is_ica_subject,
        retention_agent: entities.supplier.is_retention_agent,
        iva_regime: entities.supplier.regime_type === 'simplified' ? 'simplified' : 'common'
      },
      customer: {
        tax_id: entities.customer.tax_id,
        name: entities.customer.name,
        entity_type: entities.customer.entity_type,
        municipality: context.municipality,
        is_ica_subject: entities.customer.is_ica_subject,
        retention_agent: entities.customer.is_retention_agent,
        iva_regime: entities.customer.regime_type === 'simplified' ? 'simplified' : 'common'
      },
      issue_date: new Date(invoice.issue_date),
      municipality: context.municipality
    };

    // Calculate using tax engine
    const taxResult = await colombianTaxEngine.calculateTaxes(taxContext);

    if (taxResult.retencion_fuente.applicable) {
      retentions.push({
        tax_type: 'RETENCION_FUENTE',
        concept_code: this.extractConceptCode(taxResult.retencion_fuente.dian_concept || ''),
        concept_description: taxResult.retencion_fuente.dian_concept || 'Retención en la fuente',
        taxable_base: invoice.subtotal,
        tax_rate: taxResult.retencion_fuente.rate,
        tax_amount: taxResult.retencion_fuente.amount,
        threshold_uvt: taxResult.retencion_fuente.base_uvt,
        supplier_type: entities.supplier.entity_type,
        calculation_method: 'automatic',
        applied_rule: taxResult.retencion_fuente.rule_applied,
        confidence: 0.95,
        dian_code: this.extractConceptCode(taxResult.retencion_fuente.dian_concept || '')
      });
    }

    return retentions;
  }

  /**
   * Process Retención de ICA (RETEICA)
   */
  private async processReteica(context: ProcessingContext): Promise<RetentionDetail[]> {
    const { invoice, entities } = context;
    const retentions: RetentionDetail[] = [];

    // Only proceed if customer is retention agent and supplier is ICA subject
    if (!entities.customer.is_retention_agent || !entities.supplier.is_ica_subject) {
      return retentions;
    }

    // Create tax context
    const taxContext: InvoiceTaxContext = {
      invoice_amount: invoice.subtotal,
      service_type: this.mapServiceType(context.service_classification || 'services'),
      supplier: {
        tax_id: entities.supplier.tax_id,
        name: entities.supplier.name,
        entity_type: entities.supplier.entity_type,
        municipality: context.municipality,
        is_ica_subject: entities.supplier.is_ica_subject,
        retention_agent: entities.supplier.is_retention_agent,
        iva_regime: entities.supplier.regime_type === 'simplified' ? 'simplified' : 'common'
      },
      customer: {
        tax_id: entities.customer.tax_id,
        name: entities.customer.name,
        entity_type: entities.customer.entity_type,
        municipality: context.municipality,
        is_ica_subject: entities.customer.is_ica_subject,
        retention_agent: entities.customer.is_retention_agent,
        iva_regime: entities.customer.regime_type === 'simplified' ? 'simplified' : 'common'
      },
      issue_date: new Date(invoice.issue_date),
      municipality: context.municipality
    };

    const taxResult = await colombianTaxEngine.calculateTaxes(taxContext);

    if (taxResult.ica.applicable) {
      retentions.push({
        tax_type: 'RETENCION_ICA',
        concept_code: 'ICA',
        concept_description: `RETEICA ${context.municipality}`,
        taxable_base: invoice.subtotal,
        tax_rate: taxResult.ica.rate,
        tax_amount: taxResult.ica.amount,
        municipality: context.municipality,
        supplier_type: entities.supplier.entity_type,
        calculation_method: 'automatic',
        applied_rule: taxResult.ica.rule_applied,
        confidence: 0.90,
        municipal_code: this.getMunicipalCode(context.municipality || '')
      });
    }

    return retentions;
  }

  /**
   * Process Retención de IVA (RETEIVA)
   */
  private async processReteiva(context: ProcessingContext): Promise<RetentionDetail[]> {
    const { invoice, entities } = context;
    const retentions: RetentionDetail[] = [];

    // Only proceed if customer is retention agent and invoice has IVA
    if (!entities.customer.is_retention_agent || invoice.total_tax <= 0) {
      return retentions;
    }

    // Create tax context
    const taxContext: InvoiceTaxContext = {
      invoice_amount: invoice.subtotal,
      service_type: this.mapServiceType(context.service_classification || 'services'),
      supplier: {
        tax_id: entities.supplier.tax_id,
        name: entities.supplier.name,
        entity_type: entities.supplier.entity_type,
        municipality: context.municipality,
        is_ica_subject: entities.supplier.is_ica_subject,
        retention_agent: entities.supplier.is_retention_agent,
        iva_regime: entities.supplier.regime_type === 'simplified' ? 'simplified' : 'common'
      },
      customer: {
        tax_id: entities.customer.tax_id,
        name: entities.customer.name,
        entity_type: entities.customer.entity_type,
        municipality: context.municipality,
        is_ica_subject: entities.customer.is_ica_subject,
        retention_agent: entities.customer.is_retention_agent,
        iva_regime: entities.customer.regime_type === 'simplified' ? 'simplified' : 'common'
      },
      issue_date: new Date(invoice.issue_date),
      municipality: context.municipality
    };

    const taxResult = await colombianTaxEngine.calculateTaxes(taxContext);

    if (taxResult.retencion_iva.applicable) {
      retentions.push({
        tax_type: 'RETENCION_IVA',
        concept_code: 'RETIVA',
        concept_description: 'Retención de IVA',
        taxable_base: invoice.total_tax, // Base is the IVA amount, not subtotal
        tax_rate: taxResult.retencion_iva.rate,
        tax_amount: taxResult.retencion_iva.amount,
        supplier_type: entities.supplier.entity_type,
        calculation_method: 'automatic',
        applied_rule: taxResult.retencion_iva.rule_applied,
        confidence: 0.95,
        dian_code: '05' // Standard RETEIVA code
      });
    }

    return retentions;
  }

  /**
   * Classify service type from invoice data
   */
  private classifyService(invoice: Invoice): string {
    const description = invoice.supplier_name.toLowerCase();
    const pucCode = invoice.puc_code || '';

    // Use PUC code for classification if available
    if (pucCode.startsWith('51')) return 'services';
    if (pucCode.startsWith('61')) return 'purchases';
    if (pucCode.startsWith('52')) return 'rent';

    // Fallback to text analysis
    if (description.includes('consultor') || description.includes('asesor')) {
      return 'professional';
    }
    if (description.includes('transport') || description.includes('logistic')) {
      return 'transport';
    }
    if (description.includes('construcción') || description.includes('obra')) {
      return 'construction';
    }

    return 'services'; // Default
  }

  /**
   * Map service classification to tax engine service types
   */
  private mapServiceType(classification: string): 'services' | 'goods' | 'construction' | 'rent' | 'transport' | 'professional' {
    const mapping: Record<string, any> = {
      'services': 'services',
      'professional': 'professional',
      'purchases': 'goods',
      'goods': 'goods',
      'rent': 'rent',
      'transport': 'transport',
      'construction': 'construction'
    };

    return mapping[classification] || 'services';
  }

  /**
   * Extract concept code from DIAN concept string
   */
  private extractConceptCode(dianConcept: string): string {
    const match = dianConcept.match(/^(\d+)/);
    return match ? match[1] : '365'; // Default to general services
  }

  /**
   * Get municipal code for RETEICA
   */
  private getMunicipalCode(municipality: string): string {
    const codes: Record<string, string> = {
      'Bogotá': '11001',
      'Medellín': '05001',
      'Cali': '76001',
      'Bucaramanga': '68001'
    };

    return codes[municipality] || '11001'; // Default to Bogotá
  }

  /**
   * Get retention summary for dashboard
   */
  async getRetentionSummary(invoices: Invoice[]): Promise<{
    total_retefuente: number;
    total_reteica: number;
    total_reteiva: number;
    total_retentions: number;
    by_concept: Record<string, number>;
  }> {
    let totalRetefuente = 0;
    let totalReteica = 0;
    let totalReteiva = 0;
    const byConcept: Record<string, number> = {};

    for (const invoice of invoices) {
      // This would be calculated from detailed retention records
      // For now, use existing totals
      totalRetefuente += invoice.total_retention || 0;
    }

    return {
      total_retefuente: totalRetefuente,
      total_reteica: totalReteica,
      total_reteiva: totalReteiva,
      total_retentions: totalRetefuente + totalReteica + totalReteiva,
      by_concept: byConcept
    };
  }
}

export const retentionProcessor = new RetentionProcessor();