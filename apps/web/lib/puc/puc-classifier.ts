/**
 * Colombian PUC (Plan Único de Cuentas) Classifier
 * Automatic account classification based on invoice content
 */

export interface PUCAccount {
  code: string;
  name: string;
  level: number;
  parent_code?: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  is_active: boolean;
  keywords: string[];
  patterns: string[];
  priority: number;
}

export interface ClassificationRule {
  id: string;
  name: string;
  puc_code: string;
  conditions: {
    supplier_name_contains?: string[];
    description_keywords?: string[];
    amount_range?: { min?: number; max?: number };
    tax_codes?: string[];
    patterns?: RegExp[];
  };
  confidence_weight: number;
  priority: number;
  is_active: boolean;
  company_id?: string; // null for global rules
}

export interface ClassificationResult {
  puc_code: string;
  puc_name: string;
  confidence: number;
  matched_rules: string[];
  suggestions?: PUCAccount[];
}

export class PUCClassifier {
  // Colombian PUC accounts database (simplified - in real implementation would come from DB)
  private pucAccounts: PUCAccount[] = [
    // Gastos Administrativos (51)
    {
      code: '5105',
      name: 'Gastos de Personal',
      level: 4,
      parent_code: '51',
      type: 'expense',
      is_active: true,
      keywords: ['salario', 'nomina', 'sueldo', 'honorarios', 'personal'],
      patterns: ['rrhh', 'recursos.*humanos'],
      priority: 1,
    },
    {
      code: '5110',
      name: 'Honorarios',
      level: 4,
      parent_code: '51',
      type: 'expense',
      is_active: true,
      keywords: ['honorarios', 'abogado', 'consultor', 'asesor', 'profesional'],
      patterns: ['servicios.*profesionales'],
      priority: 1,
    },
    {
      code: '5115',
      name: 'Impuestos',
      level: 4,
      parent_code: '51',
      type: 'expense',
      is_active: true,
      keywords: ['impuesto', 'gravamen', 'contribucion', 'ica', 'predial'],
      patterns: ['impuesto.*vehicular', 'impuesto.*predial'],
      priority: 1,
    },
    {
      code: '5120',
      name: 'Arrendamientos',
      level: 4,
      parent_code: '51',
      type: 'expense',
      is_active: true,
      keywords: ['arriendo', 'alquiler', 'canon', 'renta', 'arrendamiento'],
      patterns: ['canon.*arrendamiento'],
      priority: 1,
    },
    {
      code: '5135',
      name: 'Servicios',
      level: 4,
      parent_code: '51',
      type: 'expense',
      is_active: true,
      keywords: ['servicio', 'mantenimiento', 'limpieza', 'seguridad', 'vigilancia'],
      patterns: ['servicios.*publicos'],
      priority: 1,
    },
    {
      code: '5140',
      name: 'Gastos Legales',
      level: 4,
      parent_code: '51',
      type: 'expense',
      is_active: true,
      keywords: ['legal', 'notarial', 'registro', 'camara', 'comercio'],
      patterns: ['gastos.*legales', 'notaria'],
      priority: 1,
    },
    {
      code: '5145',
      name: 'Mantenimiento y Reparaciones',
      level: 4,
      parent_code: '51',
      type: 'expense',
      is_active: true,
      keywords: ['mantenimiento', 'reparacion', 'repuesto', 'revision', 'tecnico'],
      patterns: ['mant.*equipo', 'reparacion.*vehiculo'],
      priority: 1,
    },
    {
      code: '5160',
      name: 'Depreciaciones',
      level: 4,
      parent_code: '51',
      type: 'expense',
      is_active: true,
      keywords: ['depreciacion', 'amortizacion', 'deterioro'],
      patterns: ['deprec.*'],
      priority: 1,
    },

    // Gastos de Ventas (52)
    {
      code: '5205',
      name: 'Gastos de Personal de Ventas',
      level: 4,
      parent_code: '52',
      type: 'expense',
      is_active: true,
      keywords: ['vendedor', 'comercial', 'ventas', 'mercadeo'],
      patterns: ['personal.*ventas'],
      priority: 1,
    },
    {
      code: '5210',
      name: 'Comisiones',
      level: 4,
      parent_code: '52',
      type: 'expense',
      is_active: true,
      keywords: ['comision', 'incentivo', 'bonus', 'premio'],
      patterns: ['comis.*ventas'],
      priority: 1,
    },
    {
      code: '5215',
      name: 'Publicidad y Propaganda',
      level: 4,
      parent_code: '52',
      type: 'expense',
      is_active: true,
      keywords: ['publicidad', 'propaganda', 'marketing', 'promocion', 'anuncio'],
      patterns: ['marketing.*digital', 'redes.*sociales'],
      priority: 1,
    },

    // Compras (61)
    {
      code: '6105',
      name: 'Compra de Mercancías',
      level: 4,
      parent_code: '61',
      type: 'expense',
      is_active: true,
      keywords: ['mercancia', 'producto', 'inventario', 'materia prima'],
      patterns: ['compra.*inventario'],
      priority: 1,
    },
    {
      code: '6110',
      name: 'Materias Primas',
      level: 4,
      parent_code: '61',
      type: 'expense',
      is_active: true,
      keywords: ['materia prima', 'material', 'insumo', 'componente'],
      patterns: ['mat.*prima'],
      priority: 1,
    },

    // Ingresos Operacionales (41)
    {
      code: '4105',
      name: 'Agricultura, ganadería, caza y silvicultura',
      level: 4,
      parent_code: '41',
      type: 'income',
      is_active: true,
      keywords: ['agricultura', 'ganaderia', 'cultivo', 'cosecha'],
      patterns: ['agro.*'],
      priority: 1,
    },
    {
      code: '4135',
      name: 'Comercio al por mayor y al por menor',
      level: 4,
      parent_code: '41',
      type: 'income',
      is_active: true,
      keywords: ['venta', 'comercio', 'retail', 'mayorista'],
      patterns: ['venta.*productos'],
      priority: 1,
    },
    {
      code: '4175',
      name: 'Actividades de servicios empresariales',
      level: 4,
      parent_code: '41',
      type: 'income',
      is_active: true,
      keywords: ['servicio', 'consultoria', 'asesoria', 'outsourcing'],
      patterns: ['servicios.*empresariales'],
      priority: 1,
    },

    // Activos Fijos (15)
    {
      code: '1504',
      name: 'Equipo de oficina',
      level: 4,
      parent_code: '15',
      type: 'asset',
      is_active: true,
      keywords: ['mueble', 'escritorio', 'silla', 'oficina'],
      patterns: ['mobiliario.*oficina'],
      priority: 1,
    },
    {
      code: '1528',
      name: 'Equipo de computación y comunicación',
      level: 4,
      parent_code: '15',
      type: 'asset',
      is_active: true,
      keywords: ['computador', 'laptop', 'servidor', 'telefono', 'router'],
      patterns: ['equipo.*computo'],
      priority: 1,
    },
    {
      code: '1540',
      name: 'Flota y equipo de transporte',
      level: 4,
      parent_code: '15',
      type: 'asset',
      is_active: true,
      keywords: ['vehiculo', 'carro', 'camion', 'moto', 'transporte'],
      patterns: ['flota.*vehicular'],
      priority: 1,
    },
  ];

  /**
   * Classify invoice based on content analysis
   */
  async classifyInvoice(invoiceData: {
    supplier_name: string;
    invoice_number: string;
    total_amount: number;
    line_items?: Array<{
      product_name: string;
      product_description?: string;
      line_total: number;
    }>;
    taxes?: Array<{
      tax_type: string;
      tax_amount: number;
    }>;
  }): Promise<ClassificationResult> {
    
    const scores: Map<string, {
      score: number;
      matched_rules: string[];
      account: PUCAccount;
    }> = new Map();

    // Combine all text for analysis
    const textToAnalyze = [
      invoiceData.supplier_name,
      ...(invoiceData.line_items?.map(item => 
        `${item.product_name} ${item.product_description || ''}`
      ) || [])
    ].join(' ').toLowerCase();

    // Score each PUC account
    for (const account of this.pucAccounts) {
      let score = 0;
      const matchedRules: string[] = [];

      // Keyword matching
      for (const keyword of account.keywords) {
        if (textToAnalyze.includes(keyword.toLowerCase())) {
          score += 0.3;
          matchedRules.push(`keyword:${keyword}`);
        }
      }

      // Pattern matching
      for (const pattern of account.patterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(textToAnalyze)) {
          score += 0.4;
          matchedRules.push(`pattern:${pattern}`);
        }
      }

      // Supplier-specific rules
      score += this.getSupplierScore(invoiceData.supplier_name, account);

      // Amount-based rules
      score += this.getAmountScore(invoiceData.total_amount, account);

      // Apply priority weighting
      score *= account.priority;

      if (score > 0) {
        scores.set(account.code, {
          score,
          matched_rules: matchedRules,
          account,
        });
      }
    }

    // Get the best match
    const sortedScores = Array.from(scores.entries())
      .sort(([,a], [,b]) => b.score - a.score);

    if (sortedScores.length === 0) {
      // Default classification for unmatched invoices
      return {
        puc_code: '5135', // Servicios (default)
        puc_name: 'Servicios',
        confidence: 0.1,
        matched_rules: ['default_classification'],
        suggestions: this.getSuggestions(textToAnalyze).slice(0, 3),
      };
    }

    const [bestCode, bestResult] = sortedScores[0];
    const confidence = Math.min(bestResult.score, 1.0);

    return {
      puc_code: bestCode,
      puc_name: bestResult.account.name,
      confidence,
      matched_rules: bestResult.matched_rules,
      suggestions: confidence < 0.7 ? 
        sortedScores.slice(1, 4).map(([, result]) => result.account) : 
        undefined,
    };
  }

  /**
   * Get supplier-specific scoring
   */
  private getSupplierScore(supplierName: string, account: PUCAccount): number {
    const name = supplierName.toLowerCase();
    
    // Industry-specific supplier patterns
    const industryPatterns: Record<string, string[]> = {
      '5105': ['recursos humanos', 'rrhh', 'nomina', 'payroll'], // Personal
      '5110': ['abogados', 'consultores', 'auditores', 'asesores'], // Honorarios
      '5115': ['dian', 'secretaria hacienda', 'alcaldia', 'gobernacion'], // Impuestos
      '5120': ['inmobiliaria', 'propiedades', 'bienes raices'], // Arrendamientos
      '5135': ['epm', 'codensa', 'vanti', 'telefonica', 'claro', 'movistar'], // Servicios
      '5140': ['notaria', 'camara comercio', 'registros publicos'], // Legales
      '5145': ['taller', 'mecanica', 'mantenimiento', 'reparaciones'], // Mantenimiento
      '5215': ['publicidad', 'marketing', 'agencia', 'medios'], // Publicidad
    };

    const patterns = industryPatterns[account.code];
    if (!patterns) return 0;

    for (const pattern of patterns) {
      if (name.includes(pattern)) {
        return 0.3;
      }
    }

    return 0;
  }

  /**
   * Get amount-based scoring adjustments
   */
  private getAmountScore(amount: number, account: PUCAccount): number {
    // Typical amount ranges for different account types
    const amountRules: Record<string, { min?: number; max?: number; score: number }> = {
      '5105': { min: 1000000, score: 0.1 }, // Personal expenses usually higher
      '5110': { min: 500000, score: 0.1 }, // Professional fees
      '5115': { score: 0.05 }, // Taxes - any amount
      '5120': { min: 300000, score: 0.1 }, // Rent usually significant
      '5135': { max: 1000000, score: 0.05 }, // Services often smaller amounts
      '5215': { score: 0.05 }, // Marketing - variable amounts
    };

    const rule = amountRules[account.code];
    if (!rule) return 0;

    const { min, max, score } = rule;
    
    if (min && amount < min) return 0;
    if (max && amount > max) return 0;
    
    return score;
  }

  /**
   * Get classification suggestions based on text analysis
   */
  private getSuggestions(text: string): PUCAccount[] {
    return this.pucAccounts
      .filter(account => {
        return account.keywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        ) || account.patterns.some(pattern => 
          new RegExp(pattern, 'i').test(text)
        );
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  }

  /**
   * Get PUC account details by code
   */
  getPUCAccount(code: string): PUCAccount | null {
    return this.pucAccounts.find(account => account.code === code) || null;
  }

  /**
   * Get all available PUC accounts
   */
  getAllPUCAccounts(): PUCAccount[] {
    return [...this.pucAccounts];
  }

  /**
   * Search PUC accounts by name or code
   */
  searchPUCAccounts(query: string): PUCAccount[] {
    const q = query.toLowerCase();
    return this.pucAccounts.filter(account =>
      account.code.includes(q) ||
      account.name.toLowerCase().includes(q) ||
      account.keywords.some(keyword => keyword.includes(q))
    );
  }

  /**
   * Validate PUC code format
   */
  isValidPUCCode(code: string): boolean {
    return /^\d{4}$/.test(code) && this.getPUCAccount(code) !== null;
  }

  /**
   * Get PUC hierarchy (parent accounts)
   */
  getPUCHierarchy(code: string): PUCAccount[] {
    const account = this.getPUCAccount(code);
    if (!account) return [];

    const hierarchy: PUCAccount[] = [account];
    let currentCode = account.parent_code;

    while (currentCode) {
      const parent = this.pucAccounts.find(acc => acc.code === currentCode);
      if (parent) {
        hierarchy.unshift(parent);
        currentCode = parent.parent_code;
      } else {
        break;
      }
    }

    return hierarchy;
  }
}

export const pucClassifier = new PUCClassifier();