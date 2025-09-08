import { PageBody, PageHeader } from '@kit/ui/page';
import { ReportsGenerator } from '~/components/reports/reports-generator';

export default function ReportsPage() {
  return (
    <>
      <PageHeader 
        title="Reportes Financieros"
        description="Genera reportes detallados para análisis financiero y cumplimiento tributario"
      />

      <PageBody>
        <ReportsGenerator />
      </PageBody>
    </>
  );
}