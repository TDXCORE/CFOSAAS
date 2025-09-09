/**
 * Colombian Tax Calculation Engine
 * Advanced tax calculations for Colombian invoices (IVA, Retenciones, ICA)
 */

export interface TaxableEntity {
  tax_id: string;
  name: string;
  entity_type: 'natural_person' | 'company' | 'simplified_regime' | 'common_regime';
  municipality?: string;
  economic_activity?: string;
  is_ica_subject?: boolean;
  retention_agent?: boolean;
  iva_regime?: 'common' | 'simplified' | 'excluded';
}

export interface InvoiceTaxContext {
  invoice_amount: number;
  service_type: 'services' | 'goods' | 'construction' | 'rent' | 'transport' | 'professional';
  supplier: TaxableEntity;
  customer: TaxableEntity;
  issue_date: Date;
  municipality?: string;
}

export interface TaxCalculationResult {
  iva: {
    applicable: boolean;
    rate: number;
    amount: number;
    exemption_reason?: string;
    rule_applied: string;
  };
  retencion_fuente: {
    applicable: boolean;
    rate: number;
    amount: number;
    base_uvt?: number;
    rule_applied: string;
    dian_concept?: string;
  };
  retencion_iva: {
    applicable: boolean;
    rate: number;
    amount: number;
    rule_applied: string;
  };
  ica: {
    applicable: boolean;
    rate: number;
    amount: number;
    municipality: string;
    rule_applied: string;
  };
  summary: {
    total_taxes: number;
    total_retentions: number;
    net_amount: number;
    effective_tax_rate: number;
  };
}

export class ColombianTaxEngine {
  // 2024 UVT value (updated annually)
  private readonly UVT_2024 = 47065;

  // IVA rates by product/service type
  private readonly IVA_RATES: Record<string, number> = {
    'general': 0.19,
    'basic_goods': 0.05,
    'excluded': 0.00,
    'exempt': 0.00,
  };

  // Retention thresholds and rates (in UVT)
  private readonly RETENTION_RULES = {
    services: {
      threshold_uvt: 4, // 4 UVT
      rates: {
        natural_person: 0.10,
        company: 0.11,
      },
      dian_concept: '365 - Servicios en general',
    },
    professional: {
      threshold_uvt: 4,
      rates: {
        natural_person: 0.10,
        company: 0.11,
      },
      dian_concept: '365 - Servicios profesionales',
    },
    construction: {
      threshold_uvt: 4,
      rates: {
        natural_person: 0.035,
        company: 0.04,
      },
      dian_concept: '373 - Construcción',
    },
    goods: {
      threshold_uvt: 27, // 27 UVT
      rates: {
        natural_person: 0.025,
        company: 0.025,
      },
      dian_concept: '366 - Compra de bienes',
    },
    rent: {
      threshold_uvt: 27,
      rates: {
        natural_person: 0.035,
        company: 0.035,
      },
      dian_concept: '370 - Arrendamiento',
    },
    transport: {
      threshold_uvt: 4,
      rates: {
        natural_person: 0.035,
        company: 0.035,
      },
      dian_concept: '371 - Transporte',
    },
  };

  // ICA rates by municipality (per mil)
  private readonly ICA_RATES: Record<string, number> = {
    'Bogotá': 0.00414,
    'Medellín': 0.007,
    'Cali': 0.00414,
    'Barranquilla': 0.007,
    'Cartagena': 0.008,
    'Bucaramanga': 0.007,
    'Pereira': 0.008,
    'Santa Marta': 0.007,
    'Ibagué': 0.007,
    'Pasto': 0.008,
    'Manizales': 0.008,
    'Neiva': 0.009,
    'Villavicencio': 0.007,
    'Armenia': 0.009,
    'Popayán': 0.010,
  };

  /**
   * Calculate all applicable taxes for a Colombian invoice
   */
  async calculateTaxes(context: InvoiceTaxContext): Promise<TaxCalculationResult> {
    const result: TaxCalculationResult = {
      iva: {
        applicable: false,
        rate: 0,
        amount: 0,
        rule_applied: 'not_applicable',
      },
      retencion_fuente: {
        applicable: false,
        rate: 0,
        amount: 0,
        rule_applied: 'not_applicable',
      },
      retencion_iva: {
        applicable: false,
        rate: 0,
        amount: 0,
        rule_applied: 'not_applicable',
      },
      ica: {
        applicable: false,
        rate: 0,
        amount: 0,
        municipality: '',
        rule_applied: 'not_applicable',
      },
      summary: {
        total_taxes: 0,
        total_retentions: 0,
        net_amount: 0,
        effective_tax_rate: 0,
      },
    };

    // Calculate IVA
    result.iva = this.calculateIVA(context);

    // Calculate Retención en la Fuente
    result.retencion_fuente = this.calculateRetencionFuente(context);

    // Calculate Retención de IVA
    result.retencion_iva = this.calculateRetencionIVA(context, result.iva);

    // Calculate ICA
    result.ica = this.calculateICA(context);

    // Calculate summary
    result.summary = this.calculateSummary(context.invoice_amount, result);

    return result;
  }

  /**
   * Calculate IVA (Value Added Tax)
   */
  private calculateIVA(context: InvoiceTaxContext) {
    const { supplier, service_type, invoice_amount } = context;

    // Check if supplier is in simplified regime or excluded
    if (supplier.iva_regime === 'simplified') {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        exemption_reason: 'Supplier in simplified regime',
        rule_applied: 'simplified_regime',
      };
    }

    if (supplier.iva_regime === 'excluded') {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        exemption_reason: 'Supplier excluded from IVA',
        rule_applied: 'excluded_supplier',
      };
    }

    // Determine IVA rate based on service/product type
    let rate = this.IVA_RATES.general; // Default 19%
    let rule = 'general_iva_19';

    // Special rates for specific services/products
    switch (service_type) {
      case 'services':
        // Most services are subject to 19% IVA
        rate = this.IVA_RATES.general;
        rule = 'services_iva_19';
        break;
      
      case 'goods':
        // Check if goods are basic necessities (5% rate)
        if (this.isBasicGood(context)) {
          rate = this.IVA_RATES.basic_goods;
          rule = 'basic_goods_iva_5';
        } else {
          rate = this.IVA_RATES.general;
          rule = 'goods_iva_19';
        }
        break;
      
      case 'professional':
        rate = this.IVA_RATES.general;
        rule = 'professional_services_iva_19';
        break;
      
      case 'transport':
        // Transport services often have special treatment
        rate = this.IVA_RATES.general;
        rule = 'transport_iva_19';
        break;
    }

    return {
      applicable: true,
      rate,
      amount: invoice_amount * rate,
      rule_applied: rule,
    };
  }

  /**
   * Calculate Retención en la Fuente (Source Withholding)
   */
  private calculateRetencionFuente(context: InvoiceTaxContext) {
    const { supplier, customer, service_type, invoice_amount } = context;

    // Only companies that are retention agents apply withholdings
    if (!customer.retention_agent) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        rule_applied: 'customer_not_retention_agent',
      };
    }

    // Get retention rule for service type
    const rule = this.RETENTION_RULES[service_type];
    if (!rule) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        rule_applied: 'service_type_not_covered',
      };
    }

    // Check if amount exceeds threshold
    const threshold = rule.threshold_uvt * this.UVT_2024;
    if (invoice_amount < threshold) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        base_uvt: rule.threshold_uvt,
        rule_applied: 'below_threshold',
        dian_concept: rule.dian_concept,
      };
    }

    // Determine rate based on supplier type
    const rate = supplier.entity_type === 'natural_person' 
      ? rule.rates.natural_person 
      : rule.rates.company;

    return {
      applicable: true,
      rate,
      amount: invoice_amount * rate,
      base_uvt: rule.threshold_uvt,
      rule_applied: `${service_type}_${supplier.entity_type}`,
      dian_concept: rule.dian_concept,
    };
  }

  /**
   * Calculate Retención de IVA (IVA Withholding)
   */
  private calculateRetencionIVA(context: InvoiceTaxContext, ivaCalculation: any) {
    const { supplier, customer, service_type, invoice_amount } = context;

    // IVA retention only applies if IVA is applicable
    if (!ivaCalculation.applicable) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        rule_applied: 'no_iva_applicable',
      };
    }

    // Only retention agents can withhold IVA
    if (!customer.retention_agent) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        rule_applied: 'customer_not_retention_agent',
      };
    }

    // IVA retention threshold is typically 4 UVT (same as services)
    const threshold = 4 * this.UVT_2024;
    if (invoice_amount < threshold) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        rule_applied: 'below_iva_retention_threshold',
      };
    }

    // IVA retention rate is typically 15% of the IVA amount
    const retention_rate = 0.15;

    return {
      applicable: true,
      rate: retention_rate,
      amount: ivaCalculation.amount * retention_rate,
      rule_applied: 'iva_retention_15_percent',
    };
  }

  /**
   * Calculate ICA (Industry and Commerce Tax)
   */
  private calculateICA(context: InvoiceTaxContext) {
    const { supplier, municipality, invoice_amount } = context;

    // ICA only applies to certain activities and locations
    if (!supplier.is_ica_subject || !municipality) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        municipality: municipality || '',
        rule_applied: 'not_ica_subject',
      };
    }

    // Get ICA rate for municipality
    const rate = this.ICA_RATES[municipality];
    if (!rate) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        municipality,
        rule_applied: 'municipality_rate_not_found',
      };
    }

    // ICA typically has a minimum threshold
    const minimum_threshold = 5 * this.UVT_2024; // 5 UVT
    if (invoice_amount < minimum_threshold) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        municipality,
        rule_applied: 'below_ica_threshold',
      };
    }

    return {
      applicable: true,
      rate,
      amount: invoice_amount * rate,
      municipality,
      rule_applied: `ica_${municipality.toLowerCase().replace(/\s+/g, '_')}`,
    };
  }

  /**
   * Calculate tax summary
   */
  private calculateSummary(invoiceAmount: number, result: TaxCalculationResult) {
    const total_taxes = result.iva.amount + result.ica.amount;
    const total_retentions = result.retencion_fuente.amount + result.retencion_iva.amount;
    const net_amount = invoiceAmount + total_taxes - total_retentions;
    const effective_tax_rate = invoiceAmount > 0 ? (total_taxes / invoiceAmount) : 0;

    return {
      total_taxes,
      total_retentions,
      net_amount,
      effective_tax_rate,
    };
  }

  /**
   * Determine if a product/service qualifies for basic goods IVA rate
   */
  private isBasicGood(context: InvoiceTaxContext): boolean {
    // This would typically check against a database of product codes
    // For now, we'll use a simple heuristic
    const basicKeywords = [
      'alimento', 'medicina', 'medicamento', 'arroz', 'frijol', 
      'azucar', 'sal', 'aceite', 'leche', 'pan'
    ];

    // In a real implementation, this would check line items or product codes
    return false; // Simplified for this example
  }

  /**
   * Get current UVT value
   */
  getCurrentUVT(): number {
    return this.UVT_2024;
  }

  /**
   * Get ICA rate for a municipality
   */
  getICARate(municipality: string): number {
    return this.ICA_RATES[municipality] || 0;
  }

  /**
   * Get retention rules for a service type
   */
  getRetentionRules(serviceType: string) {
    return this.RETENTION_RULES[serviceType as keyof typeof this.RETENTION_RULES];
  }

  /**
   * Validate tax calculation result
   */
  validateTaxCalculation(result: TaxCalculationResult, invoiceAmount: number): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if amounts are reasonable
    if (result.summary.total_taxes > invoiceAmount) {
      errors.push('Total taxes cannot exceed invoice amount');
    }

    if (result.summary.total_retentions > invoiceAmount * 0.5) {
      warnings.push('High retention amount (>50% of invoice)');
    }

    if (result.iva.applicable && result.iva.amount === 0) {
      errors.push('IVA is applicable but amount is zero');
    }

    // Check effective tax rate
    if (result.summary.effective_tax_rate > 0.25) {
      warnings.push('Very high effective tax rate (>25%)');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export const colombianTaxEngine = new ColombianTaxEngine();