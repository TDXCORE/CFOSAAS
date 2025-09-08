import type { User } from '@supabase/supabase-js';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarNavigation,
} from '@kit/ui/shadcn-sidebar';

import { AppLogo } from '~/components/app-logo';
import { CompanySelector } from '~/components/company-selector';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { TenantContextProvider } from '~/lib/companies/tenant-context';
import { navigationConfig } from '~/config/navigation.config';
import { Tables } from '~/lib/database.types';

export function HomeSidebar(props: {
  account?: Tables<'accounts'>;
  user: User;
}) {
  return (
    <TenantContextProvider>
      <Sidebar collapsible={'icon'}>
        <SidebarHeader className={'h-16 justify-center'}>
          <div className={'flex items-center justify-between space-x-2'}>
            <div>
              <AppLogo className={'max-w-full'} />
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="space-y-4">
          {/* Company Selector */}
          <div className="px-2">
            <CompanySelector />
          </div>
          
          <SidebarNavigation config={navigationConfig} />
        </SidebarContent>

        <SidebarFooter>
          <ProfileAccountDropdownContainer
            user={props.user}
            account={props.account}
          />
        </SidebarFooter>
      </Sidebar>
    </TenantContextProvider>
  );
}
