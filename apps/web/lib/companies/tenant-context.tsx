/**
 * Tenant Context - Multi-tenant Company State Management
 * Provides company switching and permission management for Colombian CFO SaaS
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUser } from '@kit/supabase/hooks/use-user';
import { companiesService } from './companies-service';
import type { Company, UserCompany, TenantContext, UserPermissions } from './types';

const TenantContextInstance = createContext<TenantContext | undefined>(undefined);

interface TenantProviderProps {
  children: React.ReactNode;
  initialCompanyId?: string;
}

export function TenantProvider({ children, initialCompanyId }: TenantProviderProps) {
  const user = useUser();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [userCompanies, setUserCompanies] = useState<UserCompany[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user companies on mount or user change
  const loadUserCompanies = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: companies, error } = await companiesService.getUserCompanies(user.id);
      
      if (error) {
        console.error('Error loading companies:', error);
        return;
      }

      // Convert companies to UserCompany format for context
      const userCompaniesData: UserCompany[] = companies.map(company => ({
        id: `${user.id}-${company.id}`,
        user_id: user.id,
        company_id: company.id,
        role: 'owner', // Will be fetched separately
        status: 'active',
        created_at: company.created_at,
        updated_at: company.updated_at,
      }));

      setUserCompanies(userCompaniesData);

      // Set initial company
      let targetCompany: Company | null = null;
      
      if (initialCompanyId) {
        targetCompany = companies.find(c => c.id === initialCompanyId) || null;
      } else if (companies.length > 0) {
        // Use first company as default
        targetCompany = companies[0];
      }

      if (targetCompany) {
        await switchToCompany(targetCompany);
      }
    } catch (error) {
      console.error('Error in loadUserCompanies:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, initialCompanyId]);

  // Switch to a specific company and load permissions
  const switchToCompany = async (company: Company) => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      
      // Get user role and permissions for this company
      const { role, permissions, error } = await companiesService.getUserCompanyRole(
        user.id, 
        company.id
      );

      if (error) {
        console.error('Error getting user role:', error);
        return;
      }

      setCurrentCompany(company);
      setUserRole(role);
      setUserPermissions(permissions);

      // Store in localStorage for persistence
      localStorage.setItem('currentCompanyId', company.id);
    } catch (error) {
      console.error('Error switching company:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch company by ID
  const switchCompany = async (companyId: string) => {
    if (!user?.id) return;

    try {
      const { data: company, error } = await companiesService.getCompanyById(companyId, user.id);
      
      if (error || !company) {
        console.error('Error fetching company:', error);
        return;
      }

      await switchToCompany(company);
    } catch (error) {
      console.error('Error in switchCompany:', error);
    }
  };

  // Refresh companies list
  const refreshCompanies = async () => {
    await loadUserCompanies();
  };

  // Load companies on user change
  useEffect(() => {
    loadUserCompanies();
  }, [loadUserCompanies]);

  // Restore company from localStorage on mount
  useEffect(() => {
    if (!isLoading && userCompanies.length > 0 && !currentCompany) {
      const savedCompanyId = localStorage.getItem('currentCompanyId');
      if (savedCompanyId && user?.id) {
        switchCompany(savedCompanyId).catch(console.error);
      }
    }
  }, [isLoading, userCompanies.length, currentCompany, user?.id]);

  const contextValue: TenantContext = {
    currentCompany,
    userCompanies,
    userRole,
    userPermissions,
    isLoading,
    switchCompany,
    refreshCompanies,
  };

  return (
    <TenantContextInstance.Provider value={contextValue}>
      {children}
    </TenantContextInstance.Provider>
  );
}

// Hook to use tenant context
export function useTenant(): TenantContext {
  const context = useContext(TenantContextInstance);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

// Hook to check specific permission
export function usePermission(permission: keyof UserPermissions): boolean {
  const { userRole, userPermissions } = useTenant();
  
  // Owners have all permissions
  if (userRole === 'owner') return true;
  
  // Check specific permission
  return userPermissions?.[permission] === true;
}

// Hook to check if user has any of the specified roles
export function useHasRole(roles: string | string[]): boolean {
  const { userRole } = useTenant();
  
  if (!userRole) return false;
  
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(userRole);
}

// Hook to get current company with type safety
export function useCurrentCompany(): Company | null {
  const { currentCompany } = useTenant();
  return currentCompany;
}

// Hook to check if user can access specific features
export function useFeatureAccess() {
  const { userRole, userPermissions } = useTenant();
  
  return {
    canManageInvoices: userRole === 'owner' || userRole === 'admin' || userRole === 'accountant',
    canViewReports: userPermissions?.can_view_reports === true,
    canExportData: userPermissions?.can_export_data === true,
    canManageUsers: userPermissions?.can_manage_users === true,
    canManageCompany: userPermissions?.can_edit_company === true,
    canChatWithCFO: userPermissions?.can_chat_with_cfo === true,
    canViewInsights: userPermissions?.can_view_insights === true,
    canManageIntegrations: userPermissions?.can_manage_integrations === true,
    canViewAuditTrail: userPermissions?.can_view_audit_trail === true,
  };
}

// Helper component to conditionally render based on permissions
interface PermissionGateProps {
  permission: keyof UserPermissions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const hasPermission = usePermission(permission);
  
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

// Helper component to conditionally render based on roles
interface RoleGateProps {
  roles: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ roles, children, fallback = null }: RoleGateProps) {
  const hasRole = useHasRole(roles);
  
  return hasRole ? <>{children}</> : <>{fallback}</>;
}

// Company selector dropdown data
export function useCompanySelectorData() {
  const { currentCompany, userCompanies, switchCompany, isLoading } = useTenant();
  const user = useUser();

  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    const loadCompanies = async () => {
      if (!user?.id) return;
      
      const { data } = await companiesService.getUserCompanies(user.id);
      setCompanies(data);
    };

    loadCompanies();
  }, [user?.id, userCompanies]);

  return {
    currentCompany,
    companies,
    switchCompany,
    isLoading,
  };
}