/**
 * Companies List Component
 * Displays all companies for the current user with management options
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Building2, MapPin, Users, Settings, Trash2, Edit3 } from 'lucide-react';
import { useCompanySelectorData } from '~/lib/companies/tenant-context';

export function CompaniesList() {
  const { companies, currentCompany, switchCompany, isLoading } = useCompanySelectorData();

  // Debug logging
  React.useEffect(() => {
    console.log('CompaniesList Debug:', {
      companies,
      companiesCount: companies?.length,
      currentCompany,
      isLoading,
    });
  }, [companies, currentCompany, isLoading]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                <div className="flex space-x-2">
                  <div className="h-6 bg-muted rounded w-16"></div>
                  <div className="h-6 bg-muted rounded w-20"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!companies || companies.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay empresas registradas</h3>
          <p className="text-muted-foreground mb-4">
            Crea tu primera empresa para comenzar a usar la plataforma CFO SaaS.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getSubscriptionBadgeVariant = (status: string) => {
    switch (status) {
      case 'trial':
        return 'secondary';
      case 'active':
        return 'default';
      case 'expired':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      {companies.map((company) => {
        const isCurrentCompany = currentCompany?.id === company.id;
        
        return (
          <Card key={company.id} className={isCurrentCompany ? 'ring-2 ring-primary' : ''}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  {/* Company Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* Company Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-semibold truncate">
                        {company.name}
                      </h3>
                      {isCurrentCompany && (
                        <Badge variant="default" className="text-xs">
                          Actual
                        </Badge>
                      )}
                      <Badge 
                        variant={getSubscriptionBadgeVariant(company.subscription_status)} 
                        className="text-xs"
                      >
                        {company.subscription_status === 'trial' ? 'Prueba' : 
                         company.subscription_status === 'active' ? 'Activo' : 
                         company.subscription_status}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2 truncate">
                      {company.legal_name}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Building2 className="h-4 w-4" />
                        <span>NIT: {company.tax_id}</span>
                      </div>
                      
                      {company.city && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span>{company.city}, {company.department}</span>
                        </div>
                      )}
                      
                      {company.sector && (
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span className="capitalize">{company.sector}</span>
                        </div>
                      )}
                    </div>

                    {company.economic_activity_name && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {company.economic_activity_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {!isCurrentCompany && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => switchCompany(company.id)}
                    >
                      Seleccionar
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Additional Info */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Plan</p>
                    <p className="font-medium capitalize">{company.subscription_plan}</p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground">Régimen</p>
                    <p className="font-medium capitalize">
                      {company.fiscal_regime === 'simplified' ? 'Simplificado' :
                       company.fiscal_regime === 'common' ? 'Común' : 
                       company.fiscal_regime || 'No definido'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground">Tamaño</p>
                    <p className="font-medium capitalize">
                      {company.company_size === 'small' ? 'Pequeña' :
                       company.company_size === 'medium' ? 'Mediana' :
                       company.company_size === 'large' ? 'Grande' :
                       company.company_size === 'micro' ? 'Micro' : 
                       company.company_size || 'No definido'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground">Creada</p>
                    <p className="font-medium">
                      {new Date(company.created_at).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trial Warning */}
              {company.subscription_status === 'trial' && company.trial_ends_at && (
                <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    <strong>Período de prueba:</strong> Expira el {new Date(company.trial_ends_at).toLocaleDateString('es-CO')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}