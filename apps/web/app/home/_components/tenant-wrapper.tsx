'use client';

import { TenantProvider } from '~/lib/companies/tenant-context';

interface TenantWrapperProps {
  children: React.ReactNode;
}

export function TenantWrapper({ children }: TenantWrapperProps) {
  return (
    <TenantProvider>
      {children}
    </TenantProvider>
  );
}