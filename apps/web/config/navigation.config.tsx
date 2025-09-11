import { 
  User, 
  BarChart3, 
  FileText, 
  Upload, 
  MessageSquare, 
  Building,
  PieChart,
  Settings2
} from 'lucide-react';
import { z } from 'zod';

import { NavigationConfigSchema } from '@kit/ui/navigation-schema';

import pathsConfig from '~/config/paths.config';

const iconClasses = 'w-4';

const routes = [
  {
    label: 'CFO SaaS',
    children: [
      {
        label: 'Dashboard Financiero',
        path: pathsConfig.app.dashboard,
        Icon: <BarChart3 className={iconClasses} />,
      },
      {
        label: 'Facturas',
        path: pathsConfig.app.invoices,
        Icon: <FileText className={iconClasses} />,
      },
      {
        label: 'Reportes',
        path: pathsConfig.app.reports,
        Icon: <PieChart className={iconClasses} />,
      },
      {
        label: 'CFO Virtual',
        path: pathsConfig.app.cfoChat,
        Icon: <MessageSquare className={iconClasses} />,
      },
      {
        label: 'Empresas',
        path: pathsConfig.app.companies,
        Icon: <Building className={iconClasses} />,
      },
      {
        label: 'Integraciones',
        path: '/home/integrations',
        Icon: <Settings2 className={iconClasses} />,
      },
    ],
  },
  {
    label: 'common:routes.settings',
    children: [
      {
        label: 'common:routes.profile',
        path: pathsConfig.app.profileSettings,
        Icon: <User className={iconClasses} />,
      },
    ],
  },
] satisfies z.infer<typeof NavigationConfigSchema>['routes'];

export const navigationConfig = NavigationConfigSchema.parse({
  routes,
  style: process.env.NEXT_PUBLIC_NAVIGATION_STYLE,
  sidebarCollapsed: process.env.NEXT_PUBLIC_HOME_SIDEBAR_COLLAPSED,
});
