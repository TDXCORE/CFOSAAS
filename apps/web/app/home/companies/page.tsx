import { PageBody, PageHeader } from '@kit/ui/page';
import { CreateCompanyDialog } from '~/components/create-company-dialog';
import { CompaniesList } from '~/components/companies/companies-list';

export default function CompaniesPage() {
  return (
    <>
      <PageHeader 
        title="Gestión de Empresas"
        description="Administra tus empresas y cambia entre contextos organizacionales"
      />

      <PageBody>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Tus Empresas</h2>
            <CreateCompanyDialog />
          </div>
          
          <CompaniesList />
        </div>
      </PageBody>
    </>
  );
}