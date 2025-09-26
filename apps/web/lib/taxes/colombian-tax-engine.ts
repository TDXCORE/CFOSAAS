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
  // 2025 UVT value (updated annually)
  private readonly UVT_2025 = 49799;

  // IVA rates by product/service type
  private readonly IVA_RATES: Record<string, number> = {
    'general': 0.19,
    'basic_goods': 0.05,
    'excluded': 0.00,
    'exempt': 0.00,
  };

  // Retention concepts and rates 2025 (Colombia)
  private readonly RETENTION_CONCEPTS = {
    'servicios_generales': {
      code: '365',
      threshold_uvt: 4,
      rates: {
        natural_person: { declarante: 0.04, no_declarante: 0.06 },
        company: 0.06
      },
      description: 'Servicios en general'
    },
    'servicios_profesionales': {
      code: '365',
      threshold_uvt: 4,
      rates: {
        natural_person: { declarante: 0.11, no_declarante: 0.11 },
        company: 0.11
      },
      description: 'Servicios profesionales'
    },
    'honorarios': {
      code: '329',
      threshold_uvt: 4,
      rates: {
        natural_person: { declarante: 0.11, no_declarante: 0.10 },
        company: 0.11
      },
      description: 'Honorarios'
    },
    'compras_bienes': {
      code: '366',
      threshold_uvt: 27,
      rates: {
        natural_person: { declarante: 0.025, no_declarante: 0.035 },
        company: 0.025
      },
      description: 'Compra de bienes'
    },
    'arrendamiento': {
      code: '370',
      threshold_uvt: 27,
      rates: {
        natural_person: { declarante: 0.035, no_declarante: 0.035 },
        company: 0.035
      },
      description: 'Arrendamiento'
    },
    'transporte': {
      code: '371',
      threshold_uvt: 4,
      rates: {
        natural_person: { declarante: 0.035, no_declarante: 0.035 },
        company: 0.035
      },
      description: 'Transporte de carga'
    },
    'rendimientos_financieros': {
      code: '330',
      threshold_uvt: 0, // Aplica desde $1
      rates: {
        natural_person: { declarante: 0.07, no_declarante: 0.07 },
        company: 0.07
      },
      description: 'Rendimientos financieros'
    }
  };

  // RETEICA rates by municipality 2025 (per mil)
  private readonly RETEICA_RATES: Record<string, any> = {
    'Bogotá': {
      services: {
        group_304: 0.00966, // Otros servicios
        group_302: 0.0069,  // Consultoría
        group_401: 0.014    // Financieras
      },
      commerce: {
        general: 0.00414,
        group_203: 0.0138   // Cigarrillos, licores, combustibles
      },
      industrial: {
        group_101: 0.00414
      },
      minimum_threshold_uvt: 4, // 4 UVT servicios, 27 UVT compras
      minimum_amounts: {
        services: 4,  // UVT
        commerce: 27  // UVT
      }
    },
    'Medellín': {
      services: { general: 0.007 },
      commerce: { general: 0.007 },
      industrial: { general: 0.005 },
      minimum_threshold_uvt: 15
    },
    'Cali': {
      services: { general: 0.00414 },
      commerce: { general: 0.00414 },
      industrial: { general: 0.003 },
      minimum_threshold_uvt: 3
    },
    'Bucaramanga': {
      services: { general: 0.007 },
      commerce: { general: 0.007 },
      industrial: { general: 0.005 },
      minimum_threshold_uvt: 25
    }
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
   * Calculate Retención en la Fuente (Source Withholding) - Updated 2025
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

    // Map service type to retention concept
    const conceptMapping: Record<string, string> = {
      'services': 'servicios_generales',
      'professional': 'servicios_profesionales',
      'goods': 'compras_bienes',
      'rent': 'arrendamiento',
      'transport': 'transporte',
      'construction': 'servicios_generales' // Default to general services
    };

    const conceptKey = conceptMapping[service_type] || 'servicios_generales';
    const concept = this.RETENTION_CONCEPTS[conceptKey];

    if (!concept) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        rule_applied: 'concept_not_found',
      };
    }

    // Check if amount exceeds threshold
    const threshold = concept.threshold_uvt * this.UVT_2025;
    if (invoice_amount < threshold) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        base_uvt: concept.threshold_uvt,
        rule_applied: 'below_threshold',
        dian_concept: `${concept.code} - ${concept.description}`,
      };
    }

    // Determine rate based on supplier type and declarant status
    let rate: number;
    if (supplier.entity_type === 'natural_person') {
      // For natural persons, check if they are declarant (simplified logic)
      const isDeclarant = this.isDeclarantTaxpayer(supplier.tax_id);
      rate = isDeclarant
        ? concept.rates.natural_person.declarante
        : concept.rates.natural_person.no_declarante;
    } else {
      rate = concept.rates.company;
    }

    return {
      applicable: true,
      rate,
      amount: invoice_amount * rate,
      base_uvt: concept.threshold_uvt,
      rule_applied: `${conceptKey}_${supplier.entity_type}`,
      dian_concept: `${concept.code} - ${concept.description}`,
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
    const threshold = 4 * this.UVT_2025;
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
   * Calculate RETEICA (ICA Withholding) - Updated 2025
   */
  private calculateICA(context: InvoiceTaxContext) {
    const { supplier, customer, municipality, invoice_amount, service_type } = context;

    // RETEICA only applies if customer is retention agent and supplier is ICA subject
    if (!customer.retention_agent || !supplier.is_ica_subject || !municipality) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        municipality: municipality || '',
        rule_applied: 'not_applicable_reteica',
      };
    }

    // Get RETEICA configuration for municipality
    const municipalityConfig = this.RETEICA_RATES[municipality];
    if (!municipalityConfig) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        municipality,
        rule_applied: 'municipality_not_configured',
      };
    }

    // Determine activity type and get appropriate rate
    let rate: number;
    let activityType: string;

    switch (service_type) {
      case 'services':
      case 'professional':
        activityType = 'services';
        // For Bogotá, use specific service groups
        if (municipality === 'Bogotá' && municipalityConfig.services.group_304) {
          rate = municipalityConfig.services.group_304; // Default to "otros servicios"
        } else {
          rate = municipalityConfig.services.general || municipalityConfig.services;
        }
        break;
      case 'goods':
        activityType = 'commerce';
        rate = municipalityConfig.commerce.general || municipalityConfig.commerce;
        break;
      case 'construction':
      case 'transport':
        activityType = 'services';
        rate = municipalityConfig.services.general || municipalityConfig.services;
        break;
      default:
        activityType = 'services';
        rate = municipalityConfig.services.general || municipalityConfig.services;
    }

    if (!rate) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        municipality,
        rule_applied: 'rate_not_found',
      };
    }

    // Check minimum threshold
    const thresholdUVT = municipalityConfig.minimum_amounts
      ? municipalityConfig.minimum_amounts[activityType]
      : municipalityConfig.minimum_threshold_uvt;

    const minimum_threshold = thresholdUVT * this.UVT_2025;
    if (invoice_amount < minimum_threshold) {
      return {
        applicable: false,
        rate: 0,
        amount: 0,
        municipality,
        rule_applied: 'below_reteica_threshold',
      };
    }

    return {
      applicable: true,
      rate,
      amount: invoice_amount * rate,
      municipality,
      rule_applied: `reteica_${municipality.toLowerCase().replace(/\s+/g, '_')}_${activityType}`,
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
   * Get current UVT value (2025)
   */
  getCurrentUVT(): number {
    return this.UVT_2025;
  }

  /**
   * Determine if taxpayer is declarant (simplified logic)
   */
  private isDeclarantTaxpayer(taxId: string): boolean {
    // Simplified logic: companies are generally declarant
    // Natural persons: check if tax_id length suggests company (9+ digits) vs person (8-10 digits)
    // This is a simplified approach - in production, this should query a proper database
    const cleanTaxId = taxId.replace(/[^0-9]/g, '');

    // Companies (NIT) usually have 9+ digits and are declarant
    if (cleanTaxId.length >= 9) {
      return true;
    }

    // For natural persons, we assume non-declarant unless they have high income
    // This should be determined by proper validation against DIAN records
    return false;
  }

  /**
   * Get RETEICA rates for a municipality
   */
  getRETEICARate(municipality: string, activityType: string = 'services'): number {
    const config = this.RETEICA_RATES[municipality];
    if (!config) return 0;

    switch (activityType) {
      case 'services':
        return config.services?.general || config.services || 0;
      case 'commerce':
        return config.commerce?.general || config.commerce || 0;
      case 'industrial':
        return config.industrial?.general || config.industrial || 0;
      default:
        return 0;
    }
  }

  /**
   * Get all RETEICA configurations
   */
  getAllRETEICAConfigs() {
    return this.RETEICA_RATES;
  }

  /**
   * Get retention concept for a service type
   */
  getRetentionConcept(conceptKey: string) {
    return this.RETENTION_CONCEPTS[conceptKey as keyof typeof this.RETENTION_CONCEPTS];
  }

  /**
   * Get all available retention concepts
   */
  getAllRetentionConcepts() {
    return this.RETENTION_CONCEPTS;
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