/**
 * Colombian PUC (Plan Único de Cuentas) Classifier
 * Automatic account classification based on invoice content
 * Uses database table puc_accounts exclusively
 */

import { getSupabaseServiceClient } from '../supabase/service-client';

export interface PUCAccount {
  id: string;
  code: string;
  name: string;
  description?: string;
  level: number;
  parent_code?: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  nature: 'debit' | 'credit';
  keywords: string[];
  supplier_patterns: string[];
  typical_amounts?: any;
  tax_implications?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  private serviceClient = getSupabaseServiceClient();
  private pucAccountsCache: PUCAccount[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Load PUC accounts from database with caching
   */
  private async loadPUCAccounts(): Promise<PUCAccount[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.pucAccountsCache && now < this.cacheExpiry) {
      return this.pucAccountsCache;
    }

    try {
      const { data, error } = await this.serviceClient
        .from('puc_accounts')
        .select('*')
        .eq('is_active', true)
        .eq('level', 4) // Only classification accounts
        .order('code');

      if (error) {
        console.error('Error loading PUC accounts:', error);
        throw new Error(`Failed to load PUC accounts: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No active PUC accounts found in database');
      }

      // Cache the results
      this.pucAccountsCache = data as PUCAccount[];
      this.cacheExpiry = now + this.CACHE_DURATION;

      console.log(`✅ Loaded ${data.length} PUC accounts from database`);
      return this.pucAccountsCache;

    } catch (error) {
      console.error('Critical error loading PUC accounts:', error);
      throw error;
    }
  }

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
    
    try {
      // Load PUC accounts from database
      const pucAccounts = await this.loadPUCAccounts();
      
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

      console.log('🔍 Analyzing text:', textToAnalyze.slice(0, 100) + '...');
      console.log('📊 Available PUC accounts:', pucAccounts.length);

      // Score each PUC account
      for (const account of pucAccounts) {
        let score = 0;
        const matchedRules: string[] = [];

        // Keyword matching
        if (account.keywords && account.keywords.length > 0) {
          for (const keyword of account.keywords) {
            if (textToAnalyze.includes(keyword.toLowerCase())) {
              score += 0.3;
              matchedRules.push(`keyword:${keyword}`);
            }
          }
        }

        // Pattern matching
        if (account.supplier_patterns && account.supplier_patterns.length > 0) {
          for (const pattern of account.supplier_patterns) {
            try {
              const regex = new RegExp(pattern, 'i');
              if (regex.test(textToAnalyze)) {
                score += 0.4;
                matchedRules.push(`pattern:${pattern}`);
              }
            } catch (regexError) {
              console.warn(`Invalid regex pattern: ${pattern}`);
            }
          }
        }

        // Supplier-specific rules
        score += this.getSupplierScore(invoiceData.supplier_name, account);

        // Amount-based rules
        score += this.getAmountScore(invoiceData.total_amount, account);

        if (score > 0) {
          scores.set(account.code, {
            score,
            matched_rules: matchedRules,
            account,
          });
          console.log(`💯 Account ${account.code} (${account.name}) scored: ${score.toFixed(3)}`);
        }
      }

      // Get the best match
      const sortedScores = Array.from(scores.entries())
        .sort(([,a], [,b]) => b.score - a.score);

      if (sortedScores.length === 0) {
        // Default classification for unmatched invoices - get first available account
        const defaultAccount = pucAccounts.find(acc => acc.code === '5135') || pucAccounts[0];
        
        console.log('⚠️ No matches found, using default account:', defaultAccount?.code);
        
        return {
          puc_code: defaultAccount?.code || '5135',
          puc_name: defaultAccount?.name || 'Servicios',
          confidence: 0.1,
          matched_rules: ['default_classification'],
          suggestions: this.getSuggestions(textToAnalyze, pucAccounts).slice(0, 3),
        };
      }

      const [bestCode, bestResult] = sortedScores[0];
      const confidence = Math.min(bestResult.score, 1.0);

      console.log(`🎯 Best match: ${bestCode} (${bestResult.account.name}) with confidence ${confidence.toFixed(3)}`);

      return {
        puc_code: bestCode,
        puc_name: bestResult.account.name,
        confidence,
        matched_rules: bestResult.matched_rules,
        suggestions: confidence < 0.7 ? 
          sortedScores.slice(1, 4).map(([, result]) => result.account) : 
          undefined,
      };
      
    } catch (error) {
      console.error('❌ Error in PUC classification:', error);
      
      // Fallback to basic default
      return {
        puc_code: '5135',
        puc_name: 'Servicios',
        confidence: 0.05,
        matched_rules: ['error_fallback'],
        suggestions: [],
      };
    }
  }

  /**
   * Get supplier-specific scoring
   */
  private getSupplierScore(supplierName: string, account: PUCAccount): number {
    const supplier = supplierName.toLowerCase();
    
    // Company type indicators
    if (supplier.includes('microsoft') && account.code === '2805') return 0.5;
    if (supplier.includes('software') && account.code === '2805') return 0.4;
    if (supplier.includes('servicio') && account.code === '5135') return 0.3;
    if (supplier.includes('abogado') && account.code === '5110') return 0.4;
    
    return 0;
  }

  /**
   * Get amount-based scoring
   */
  private getAmountScore(amount: number, account: PUCAccount): number {
    // Amount-based rules (simplified)
    if (amount > 10000000 && account.account_type === 'asset') return 0.1; // Large amounts likely assets
    if (amount < 500000 && account.code.startsWith('51')) return 0.1; // Small amounts likely admin expenses
    
    return 0;
  }

  /**
   * Get alternative suggestions
   */
  private getSuggestions(textToAnalyze: string, pucAccounts: PUCAccount[]): PUCAccount[] {
    const suggestions: Array<{ account: PUCAccount; score: number }> = [];

    for (const account of pucAccounts) {
      let score = 0;

      // Simple keyword matching for suggestions
      if (account.keywords && account.keywords.length > 0) {
        for (const keyword of account.keywords) {
          if (textToAnalyze.includes(keyword.toLowerCase())) {
            score += 1;
          }
        }
      }

      if (score > 0) {
        suggestions.push({ account, score });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.account);
  }

  /**
   * Add new PUC account to database
   */
  async addPUCAccount(account: Omit<PUCAccount, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.serviceClient
        .from('puc_accounts')
        .insert(account);

      if (error) {
        return { success: false, error: error.message };
      }

      // Clear cache to force reload
      this.pucAccountsCache = null;
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update existing PUC account
   */
  async updatePUCAccount(code: string, updates: Partial<PUCAccount>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.serviceClient
        .from('puc_accounts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('code', code);

      if (error) {
        return { success: false, error: error.message };
      }

      // Clear cache to force reload
      this.pucAccountsCache = null;
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get all PUC accounts for management
   */
  async getAllPUCAccounts(): Promise<{ data: PUCAccount[] | null; error?: string }> {
    try {
      const { data, error } = await this.serviceClient
        .from('puc_accounts')
        .select('*')
        .order('code');

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as PUCAccount[] };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const pucClassifier = new PUCClassifier();