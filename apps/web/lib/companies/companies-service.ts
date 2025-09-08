/**
 * Companies Service - Multi-tenant Company Management
 * Handles Colombian company operations with Supabase
 */

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import type { 
  Company, 
  UserCompany, 
  CreateCompanyInput, 
  UpdateCompanyInput,
  CompaniesResponse,
  CompanyResponse,
  UserPermissions
} from './types';

class CompaniesService {
  private supabase = getSupabaseBrowserClient();

  /**
   * Get all companies for the current user
   */
  async getUserCompanies(userId: string): Promise<CompaniesResponse> {
    try {
      const { data, error } = await this.supabase
        .from('user_companies')
        .select(`
          *,
          companies:company_id (
            id,
            name,
            legal_name,
            tax_id,
            fiscal_regime,
            economic_activity_code,
            economic_activity_name,
            sector,
            company_size,
            country,
            department,
            city,
            address,
            settings,
            tax_settings,
            integration_settings,
            subscription_plan,
            subscription_status,
            trial_ends_at,
            created_at,
            updated_at,
            deleted_at
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .is('companies.deleted_at', null);

      if (error) {
        console.error('Error fetching user companies:', error);
        return { data: [], error: error.message };
      }

      // Transform data to extract companies
      const companies = data?.map((item: any) => item.companies).filter(Boolean) || [];
      
      return { data: companies as Company[], count: companies.length };
    } catch (error) {
      console.error('Error in getUserCompanies:', error);
      return { data: [], error: 'Failed to fetch companies' };
    }
  }

  /**
   * Get a specific company by ID (with permission check)
   */
  async getCompanyById(companyId: string, userId: string): Promise<CompanyResponse> {
    try {
      // First check if user has access to this company
      const { data: userCompany } = await this.supabase
        .from('user_companies')
        .select('*')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .eq('status', 'active')
        .single();

      if (!userCompany) {
        return { data: null, error: 'Access denied to this company' };
      }

      const { data, error } = await this.supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .is('deleted_at', null)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Company };
    } catch (error) {
      console.error('Error in getCompanyById:', error);
      return { data: null, error: 'Failed to fetch company' };
    }
  }

  /**
   * Create a new company and associate current user as owner
   */
  async createCompany(input: CreateCompanyInput, userId: string): Promise<CompanyResponse> {
    try {
      // Validate Colombian tax ID (NIT)
      if (!this.validateColombianNIT(input.tax_id)) {
        return { data: null, error: 'Invalid Colombian NIT format' };
      }

      // Check if tax_id already exists
      const { data: existingCompany } = await this.supabase
        .from('companies')
        .select('id')
        .eq('tax_id', input.tax_id)
        .is('deleted_at', null)
        .single();

      if (existingCompany) {
        return { data: null, error: 'A company with this NIT already exists' };
      }

      // Create company
      const { data: company, error: companyError } = await this.supabase
        .from('companies')
        .insert({
          ...input,
          country: 'CO', // Always Colombia
          settings: this.getDefaultSettings(),
          tax_settings: this.getDefaultTaxSettings(input.city),
          integration_settings: this.getDefaultIntegrationSettings(),
          subscription_plan: 'basic',
          subscription_status: 'trial',
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days trial
        })
        .select()
        .single();

      if (companyError) {
        return { data: null, error: companyError.message };
      }

      // Associate user as owner
      const { error: userCompanyError } = await this.supabase
        .from('user_companies')
        .insert({
          user_id: userId,
          company_id: company.id,
          role: 'owner',
          status: 'active',
          permissions: this.getOwnerPermissions(),
          accepted_at: new Date().toISOString(),
        });

      if (userCompanyError) {
        // Cleanup: delete the company if user association failed
        await this.supabase.from('companies').delete().eq('id', company.id);
        return { data: null, error: userCompanyError.message };
      }

      return { data: company as Company };
    } catch (error) {
      console.error('Error in createCompany:', error);
      return { data: null, error: 'Failed to create company' };
    }
  }

  /**
   * Update company information
   */
  async updateCompany(companyId: string, input: UpdateCompanyInput, userId: string): Promise<CompanyResponse> {
    try {
      // Check user permissions
      const hasPermission = await this.checkUserPermission(userId, companyId, 'can_edit_company');
      if (!hasPermission) {
        return { data: null, error: 'Insufficient permissions to edit company' };
      }

      const { data, error } = await this.supabase
        .from('companies')
        .update(input)
        .eq('id', companyId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Company };
    } catch (error) {
      console.error('Error in updateCompany:', error);
      return { data: null, error: 'Failed to update company' };
    }
  }

  /**
   * Soft delete a company
   */
  async deleteCompany(companyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Only owners can delete companies
      const { data: userCompany } = await this.supabase
        .from('user_companies')
        .select('role')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .eq('status', 'active')
        .single();

      if (!userCompany || userCompany.role !== 'owner') {
        return { success: false, error: 'Only owners can delete companies' };
      }

      const { error } = await this.supabase
        .from('companies')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', companyId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in deleteCompany:', error);
      return { success: false, error: 'Failed to delete company' };
    }
  }

  /**
   * Get user's role and permissions for a company
   */
  async getUserCompanyRole(userId: string, companyId: string): Promise<{
    role: string | null;
    permissions: UserPermissions | null;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('user_companies')
        .select('role, permissions')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .eq('status', 'active')
        .single();

      if (error) {
        return { role: null, permissions: null, error: error.message };
      }

      return { 
        role: data.role, 
        permissions: data.permissions as UserPermissions 
      };
    } catch (error) {
      console.error('Error in getUserCompanyRole:', error);
      return { role: null, permissions: null, error: 'Failed to get user role' };
    }
  }

  /**
   * Invite user to company
   */
  async inviteUserToCompany(
    companyId: string,
    email: string,
    role: string,
    invitedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if inviter has permission
      const hasPermission = await this.checkUserPermission(invitedBy, companyId, 'can_manage_users');
      if (!hasPermission) {
        return { success: false, error: 'Insufficient permissions to invite users' };
      }

      // Get user by email (assuming user exists in auth.users)
      const { data: userData, error: userError } = await this.supabase
        .from('auth.users')
        .select('id')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        return { success: false, error: 'User not found. User must sign up first.' };
      }

      // Check if user is already associated with company
      const { data: existing } = await this.supabase
        .from('user_companies')
        .select('id')
        .eq('user_id', userData.id)
        .eq('company_id', companyId)
        .single();

      if (existing) {
        return { success: false, error: 'User is already associated with this company' };
      }

      // Create invitation
      const { error } = await this.supabase
        .from('user_companies')
        .insert({
          user_id: userData.id,
          company_id: companyId,
          role,
          status: 'pending',
          invited_by: invitedBy,
          invited_at: new Date().toISOString(),
          permissions: this.getRolePermissions(role),
        });

      if (error) {
        return { success: false, error: error.message };
      }

      // TODO: Send invitation email

      return { success: true };
    } catch (error) {
      console.error('Error in inviteUserToCompany:', error);
      return { success: false, error: 'Failed to invite user' };
    }
  }

  // Helper methods

  private validateColombianNIT(nit: string): boolean {
    // Remove any non-numeric characters
    const cleanNit = nit.replace(/\D/g, '');
    
    // Must be between 8-10 digits
    if (cleanNit.length < 8 || cleanNit.length > 10) {
      return false;
    }

    // Basic format validation (more complex validation would check verification digit)
    return /^\d{8,10}$/.test(cleanNit);
  }

  private async checkUserPermission(userId: string, companyId: string, permission: keyof UserPermissions): Promise<boolean> {
    const { data } = await this.supabase
      .from('user_companies')
      .select('role, permissions')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single();

    if (!data) return false;

    // Owners have all permissions
    if (data.role === 'owner') return true;

    // Check specific permission
    const permissions = data.permissions as UserPermissions;
    return permissions?.[permission] === true;
  }

  private getDefaultSettings() {
    return {
      currency: 'COP',
      date_format: 'DD/MM/YYYY',
      timezone: 'America/Bogota',
      auto_classification: true,
      require_manual_review: false,
      default_retention_rate: 0.11,
      email_notifications: true,
    };
  }

  private getDefaultTaxSettings(city?: string) {
    const icaRates: Record<string, number> = {
      'Bogotá': 0.00414,
      'Medellín': 0.007,
      'Cali': 0.00414,
      'Barranquilla': 0.007,
      'Cartagena': 0.008,
    };

    return {
      iva_rate: 0.19,
      retention_rates: {
        services: 0.11,
        goods: 0.025,
        construction: 0.04,
        transport: 0.01,
        rent: 0.035,
      },
      ica_rate: city ? icaRates[city] || 0.007 : 0.007,
      municipality: city,
      retention_thresholds: {
        services: 4000000, // 4M COP
        goods: 1000000, // 1M COP
        construction: 500000, // 500K COP
      },
    };
  }

  private getDefaultIntegrationSettings() {
    return {
      microsoft_graph: {
        enabled: false,
      },
      openai: {
        enabled: true,
        model: 'gpt-4-turbo',
        temperature: 0.1,
        max_tokens: 2000,
      },
      storage: {
        bucket_name: 'invoice-documents',
        max_file_size: 10485760, // 10MB
        allowed_extensions: ['xml', 'pdf', 'zip', 'jpg', 'png'],
      },
    };
  }

  private getOwnerPermissions(): UserPermissions {
    return {
      can_view_invoices: true,
      can_upload_invoices: true,
      can_edit_invoices: true,
      can_delete_invoices: true,
      can_approve_invoices: true,
      can_chat_with_cfo: true,
      can_view_insights: true,
      can_export_data: true,
      can_manage_users: true,
      can_edit_company: true,
      can_view_billing: true,
      can_manage_integrations: true,
      can_view_reports: true,
      can_export_reports: true,
      can_view_audit_trail: true,
    };
  }

  private getRolePermissions(role: string): UserPermissions {
    const basePermissions = {
      can_view_invoices: true,
      can_upload_invoices: false,
      can_edit_invoices: false,
      can_delete_invoices: false,
      can_approve_invoices: false,
      can_chat_with_cfo: true,
      can_view_insights: true,
      can_export_data: false,
      can_manage_users: false,
      can_edit_company: false,
      can_view_billing: false,
      can_manage_integrations: false,
      can_view_reports: true,
      can_export_reports: false,
      can_view_audit_trail: false,
    };

    switch (role) {
      case 'owner':
        return this.getOwnerPermissions();
      
      case 'admin':
        return {
          ...basePermissions,
          can_upload_invoices: true,
          can_edit_invoices: true,
          can_delete_invoices: true,
          can_approve_invoices: true,
          can_export_data: true,
          can_manage_users: true,
          can_edit_company: true,
          can_manage_integrations: true,
          can_export_reports: true,
          can_view_audit_trail: true,
        };
      
      case 'accountant':
        return {
          ...basePermissions,
          can_upload_invoices: true,
          can_edit_invoices: true,
          can_approve_invoices: true,
          can_export_data: true,
          can_export_reports: true,
        };
      
      case 'auditor':
        return {
          ...basePermissions,
          can_export_data: true,
          can_export_reports: true,
          can_view_audit_trail: true,
        };
      
      case 'viewer':
      default:
        return basePermissions;
    }
  }
}

export const companiesService = new CompaniesService();