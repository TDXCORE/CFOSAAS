import { PageBody, PageHeader } from '@kit/ui/page';
import { FinancialDashboard } from '~/components/dashboard/financial-dashboard';

export default function DashboardPage() {
  return (
    <>
      <PageHeader 
        title="Dashboard Financiero"
        description="Análisis completo de métricas financieras y KPIs específicos para Colombia"
      />

      <PageBody>
        <FinancialDashboard />
      </PageBody>
    </>
  );
}