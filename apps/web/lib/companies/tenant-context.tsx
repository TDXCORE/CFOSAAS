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

  // Error boundary protection
  const [hasError, setHasError] = useState(false);

  // Load user companies on mount or user change
  const loadUserCompanies = useCallback(async () => {
    const actualUser = user?.data || user;
    const userId = actualUser?.id;
    
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: companies, error } = await companiesService.getUserCompanies(userId);
      
      if (error) {
        console.error('Error loading companies:', error);
        return;
      }

      // Convert companies to UserCompany format for context
      const userCompaniesData: UserCompany[] = companies.map(company => ({
        id: `${userId}-${company.id}`,
        user_id: userId,
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
  }, [user?.data?.id || user?.id, initialCompanyId]);

  // Switch to a specific company and load permissions
  const switchToCompany = async (company: Company) => {
    const actualUser = user?.data || user;
    const userId = actualUser?.id;
    if (!userId) return;

    try {
      setIsLoading(true);
      
      // Get user role and permissions for this company
      const { role, permissions, error } = await companiesService.getUserCompanyRole(
        userId, 
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
    const actualUser = user?.data || user;
    const userId = actualUser?.id;
    if (!userId) return;

    try {
      const { data: company, error } = await companiesService.getCompanyById(companyId, userId);
      
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
    try {
      loadUserCompanies();
    } catch (error) {
      console.error('Error in useEffect loadUserCompanies:', error);
      setHasError(true);
      setIsLoading(false);
    }
  }, [loadUserCompanies]);

  // Restore company from localStorage on mount
  useEffect(() => {
    if (!isLoading && userCompanies.length > 0 && !currentCompany) {
      const savedCompanyId = localStorage.getItem('currentCompanyId');
      const actualUser = user?.data || user;
      const userId = actualUser?.id;
      if (savedCompanyId && userId) {
        switchCompany(savedCompanyId).catch(console.error);
      }
    }
  }, [isLoading, userCompanies.length, currentCompany, user?.data?.id || user?.id]);

  const contextValue: TenantContext = {
    currentCompany,
    userCompanies,
    userRole,
    userPermissions,
    isLoading,
    switchCompany,
    refreshCompanies,
  };

  // If there's an error or no user, provide default context
  if (hasError || !user) {
    const fallbackContext: TenantContext = {
      currentCompany: null,
      userCompanies: [],
      userRole: null,
      userPermissions: null,
      isLoading: false,
      switchCompany: async () => {},
      refreshCompanies: async () => {},
    };
    
    return (
      <TenantContextInstance.Provider value={fallbackContext}>
        {children}
      </TenantContextInstance.Provider>
    );
  }

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
    // Return fallback context instead of throwing error
    console.warn('useTenant called outside TenantProvider, returning fallback context');
    return {
      currentCompany: null,
      userCompanies: [],
      userRole: null,
      userPermissions: null,
      isLoading: false,
      switchCompany: async () => {},
      refreshCompanies: async () => {},
    };
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
      try {
        const actualUser = user?.data || user;
        const userId = actualUser?.id;
        
        console.log('🔍 Loading companies for user:', userId);
        console.log('🔐 Actual user object:', actualUser);
        
        if (!userId) {
          console.log('❌ No user ID, skipping company load');
          console.log('❓ User state:', { user, actualUser, userId });
          return;
        }
        
        const { data, error } = await companiesService.getUserCompanies(userId);
        console.log('📊 Companies service response:', { data, error, count: data?.length });
        setCompanies(data || []);
      } catch (error) {
        console.error('❌ Error loading companies for selector:', error);
        setCompanies([]);
      }
    };

    loadCompanies();
  }, [user?.data?.id || user?.id, userCompanies]);

  return {
    currentCompany,
    companies,
    switchCompany,
    isLoading,
  };
}