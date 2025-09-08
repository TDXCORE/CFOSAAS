import { PageBody, PageHeader } from '@kit/ui/page';
import { CompanySelector } from '~/components/company-selector';
import { CreateCompanyDialog } from '~/components/create-company-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

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
            <h2 className="text-xl font-semibold">Empresas Activas</h2>
            <CreateCompanyDialog />
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanySelector />
            </CardContent>
          </Card>

          <div className="mt-8 p-6 border border-dashed border-border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Próximamente</h3>
            <p className="text-muted-foreground">
              Lista completa de empresas, configuración avanzada, roles y permisos.
            </p>
          </div>
        </div>
      </PageBody>
    </>
  );
}