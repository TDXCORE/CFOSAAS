'use client';

import type { User } from '@supabase/supabase-js';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarNavigation,
  useSidebar,
} from '@kit/ui/shadcn-sidebar';

import { AppLogo } from '~/components/app-logo';
import { CompanySelector } from '~/components/company-selector';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { navigationConfig } from '~/config/navigation.config';
import { Tables } from '~/lib/database.types';

function CollapsibleLogo() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  if (isCollapsed) {
    return (
      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
        <span className="text-white text-sm font-bold">N</span>
      </div>
    );
  }

  return <AppLogo className={'max-w-full'} />;
}

export function HomeSidebar(props: {
  account?: Tables<'accounts'>;
  user: User;
}) {
  return (
    <Sidebar collapsible={'icon'}>
        <SidebarHeader className={'h-16 justify-center'}>
          <div className={'flex items-center justify-center'}>
            <CollapsibleLogo />
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
  );
}
