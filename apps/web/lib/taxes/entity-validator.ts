/**
 * Entity Validator for Colombian Tax System
 * Validates and determines tax characteristics of suppliers and customers
 */

export interface TaxEntity {
  tax_id: string;
  name: string;
  entity_type: 'natural_person' | 'company';
  regime_type: 'simplified' | 'common' | 'special';
  is_retention_agent: boolean;
  is_ica_subject: boolean;
  is_declarant: boolean;
  municipalities: string[];
  verification_status: 'verified' | 'pending' | 'manual_review';
  last_verified_at?: Date;
}

export interface EntityValidationResult {
  entity: TaxEntity;
  confidence: number;
  validation_notes: string[];
  requires_manual_review: boolean;
}

export class EntityValidator {
  /**
   * Validate and determine entity characteristics from tax ID
   */
  async validateEntity(taxId: string, entityName?: string): Promise<EntityValidationResult> {
    const cleanTaxId = this.sanitizeTaxId(taxId);

    // Determine entity type based on tax ID format
    const entityType = this.determineEntityType(cleanTaxId);

    // Determine regime type
    const regimeType = this.determineRegimeType(cleanTaxId, entityType);

    // Check if retention agent
    const isRetentionAgent = this.isRetentionAgent(cleanTaxId, entityType);

    // Check if ICA subject
    const isICASubject = this.isICASubject(cleanTaxId, entityType);

    // Check if declarant taxpayer
    const isDeclarant = this.isDeclarantTaxpayer(cleanTaxId, entityType);

    const entity: TaxEntity = {
      tax_id: cleanTaxId,
      name: entityName || 'Unknown Entity',
      entity_type: entityType,
      regime_type: regimeType,
      is_retention_agent: isRetentionAgent,
      is_ica_subject: isICASubject,
      is_declarant: isDeclarant,
      municipalities: [], // Will be populated from database or external service
      verification_status: 'pending'
    };

    // Calculate confidence based on validation rules
    const confidence = this.calculateConfidence(cleanTaxId, entityType);

    // Determine if manual review is needed
    const requiresManualReview = confidence < 0.8 || this.needsManualReview(cleanTaxId);

    const validationNotes: string[] = [];
    if (entityType === 'natural_person' && cleanTaxId.length > 10) {
      validationNotes.push('Tax ID format suggests natural person but length is unusual');
    }
    if (isRetentionAgent && entityType === 'natural_person') {
      validationNotes.push('Natural person marked as retention agent - verify income levels');
    }

    return {
      entity,
      confidence,
      validation_notes: validationNotes,
      requires_manual_review: requiresManualReview
    };
  }

  /**
   * Determine entity type based on Colombian tax ID patterns
   */
  private determineEntityType(taxId: string): 'natural_person' | 'company' {
    // Colombian NITs (companies) typically have 9+ digits
    // Cédulas (natural persons) typically have 6-10 digits

    const digitCount = taxId.replace(/[^0-9]/g, '').length;

    // Companies usually have NITs starting with specific patterns
    const firstDigit = parseInt(taxId.charAt(0));

    // Heuristic rules for Colombian tax IDs
    if (digitCount >= 9) {
      // Most likely a company NIT
      return 'company';
    }

    if (digitCount <= 8) {
      // Most likely a natural person cédula
      return 'natural_person';
    }

    // Edge case: 9 digits could be either
    // Check first digit patterns common for companies
    if (firstDigit >= 8) {
      return 'company'; // Companies often start with 8, 9
    }

    return 'natural_person'; // Default assumption
  }

  /**
   * Determine tax regime type
   */
  private determineRegimeType(taxId: string, entityType: 'natural_person' | 'company'): 'simplified' | 'common' | 'special' {
    if (entityType === 'natural_person') {
      // Most natural persons are in simplified regime unless proven otherwise
      return 'simplified';
    }

    // For companies, default to common regime
    // Special regime entities should be identified from database
    return 'common';
  }

  /**
   * Check if entity is a retention agent
   */
  private isRetentionAgent(taxId: string, entityType: 'natural_person' | 'company'): boolean {
    // Companies are generally retention agents
    if (entityType === 'company') {
      return true;
    }

    // Natural persons need to meet income thresholds
    // This is simplified - should check against DIAN database
    return false;
  }

  /**
   * Check if entity is subject to ICA
   */
  private isICASubject(taxId: string, entityType: 'natural_person' | 'company'): boolean {
    // Companies performing commercial/industrial activities are typically ICA subjects
    if (entityType === 'company') {
      return true; // Default assumption
    }

    // Natural persons may be ICA subjects if they have commercial activities
    return false; // Conservative assumption
  }

  /**
   * Check if entity is a declarant taxpayer
   */
  private isDeclarantTaxpayer(taxId: string, entityType: 'natural_person' | 'company'): boolean {
    // Companies are generally declarants
    if (entityType === 'company') {
      return true;
    }

    // Natural persons: depends on income levels
    // This should be verified against DIAN records
    return false; // Conservative assumption for individuals
  }

  /**
   * Clean and sanitize tax ID
   */
  private sanitizeTaxId(taxId: string): string {
    return taxId.replace(/[^0-9]/g, '');
  }

  /**
   * Calculate confidence score for validation
   */
  private calculateConfidence(taxId: string, entityType: 'natural_person' | 'company'): number {
    let confidence = 0.5; // Base confidence

    const digitCount = taxId.length;

    // Higher confidence for standard patterns
    if (entityType === 'company' && digitCount >= 9) {
      confidence += 0.3;
    }

    if (entityType === 'natural_person' && digitCount >= 6 && digitCount <= 10) {
      confidence += 0.3;
    }

    // Penalize unusual patterns
    if (digitCount < 6 || digitCount > 12) {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Check if entity needs manual review
   */
  private needsManualReview(taxId: string): boolean {
    // Flag for manual review based on specific patterns
    const digitCount = taxId.length;

    // Unusual tax ID lengths
    if (digitCount < 6 || digitCount > 12) {
      return true;
    }

    // All zeros or sequential numbers (test data)
    if (/^0+$/.test(taxId) || /^(0123456789|1234567890)/.test(taxId)) {
      return true;
    }

    return false;
  }

  /**
   * Bulk validate multiple entities
   */
  async validateEntities(entities: Array<{ tax_id: string; name?: string }>): Promise<EntityValidationResult[]> {
    const results: EntityValidationResult[] = [];

    for (const entityData of entities) {
      try {
        const result = await this.validateEntity(entityData.tax_id, entityData.name);
        results.push(result);
      } catch (error) {
        // Create error result
        results.push({
          entity: {
            tax_id: entityData.tax_id,
            name: entityData.name || 'Unknown',
            entity_type: 'natural_person',
            regime_type: 'simplified',
            is_retention_agent: false,
            is_ica_subject: false,
            is_declarant: false,
            municipalities: [],
            verification_status: 'manual_review'
          },
          confidence: 0,
          validation_notes: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
          requires_manual_review: true
        });
      }
    }

    return results;
  }

  /**
   * Update entity information from external source (DIAN, etc.)
   */
  async updateFromExternalSource(taxId: string): Promise<Partial<TaxEntity> | null> {
    // Placeholder for integration with external validation services
    // In production, this would call DIAN APIs or other official sources

    console.log(`External validation for ${taxId} - not implemented yet`);
    return null;
  }
}

export const entityValidator = new EntityValidator();