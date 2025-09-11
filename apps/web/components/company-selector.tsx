/**
 * Company Selector Component
 * Dropdown to switch between companies in multi-tenant setup
 */

'use client';

import React, { useState } from 'react';
import { ChevronDown, Plus, Building2, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { Skeleton } from '@kit/ui/skeleton';
import { useCompanySelectorData } from '~/lib/companies/tenant-context';
import { CreateCompanyDialog } from './create-company-dialog-simple';

export function CompanySelector() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Safe data fetching with error handling
  let selectorData;
  try {
    selectorData = useCompanySelectorData();
  } catch (error) {
    console.error('Error in CompanySelector data fetch:', error);
    selectorData = {
      currentCompany: null,
      companies: [],
      switchCompany: async () => {},
      isLoading: false,
    };
  }
  
  const { currentCompany, companies, switchCompany, isLoading } = selectorData;

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-4" />
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        No company selected
      </div>
    );
  }

  const handleCompanySwitch = (companyId: string) => {
    if (companyId !== currentCompany.id) {
      switchCompany(companyId);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center space-x-3 px-3 py-2 h-auto">
            <div className="flex items-center space-x-3">
              {/* Company Avatar */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
              </div>
              
              {/* Company Info */}
              <div className="flex flex-col items-start min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-sm truncate max-w-32">
                    {currentCompany.name}
                  </span>
                  {currentCompany.subscription_status === 'trial' && (
                    <Badge variant="secondary" className="text-xs">
                      Trial
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-32">
                  NIT: {currentCompany.tax_id}
                </span>
              </div>
            </div>
            
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Companies</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {companies.map((company) => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => handleCompanySwitch(company.id)}
              className="flex items-center space-x-3 p-3 cursor-pointer"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {/* Company Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                </div>
                
                {/* Company Details */}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm truncate">
                      {company.name}
                    </span>
                    {company.subscription_status === 'trial' && (
                      <Badge variant="secondary" className="text-xs">
                        Trial
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span className="truncate">NIT: {company.tax_id}</span>
                    {company.city && (
                      <>
                        <span>•</span>
                        <span>{company.city}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Active Indicator */}
              {currentCompany.id === company.id && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Company Dialog */}
      <CreateCompanyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}

// Compact version for mobile/small spaces
export function CompanySelectorCompact() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Safe data fetching with error handling
  let selectorData;
  try {
    selectorData = useCompanySelectorData();
  } catch (error) {
    console.error('Error in CompanySelectorCompact data fetch:', error);
    selectorData = {
      currentCompany: null,
      companies: [],
      switchCompany: async () => {},
      isLoading: false,
    };
  }
  
  const { currentCompany, companies, switchCompany, isLoading } = selectorData;

  if (isLoading) {
    return <Skeleton className="h-8 w-8 rounded" />;
  }

  if (!currentCompany) {
    return (
      <div className="text-xs text-muted-foreground">
        No company
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center space-x-2 px-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center">
              <Building2 className="w-3 h-3 text-white" />
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">{currentCompany.name}</span>
              <span className="text-xs text-muted-foreground font-normal">
                NIT: {currentCompany.tax_id}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {companies.map((company) => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => switchCompany(company.id)}
              className="flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{company.name}</div>
                <div className="text-xs text-muted-foreground">
                  NIT: {company.tax_id}
                </div>
              </div>
              {currentCompany.id === company.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateCompanyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}