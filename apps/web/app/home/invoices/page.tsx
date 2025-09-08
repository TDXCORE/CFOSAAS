import { PageBody, PageHeader } from '@kit/ui/page';
import { InvoiceUpload } from '~/components/invoices/invoice-upload';

export default function InvoicesPage() {
  return (
    <>
      <PageHeader 
        title="Gestión de Facturas"
        description="Procesa, carga y gestiona facturas electrónicas colombianas"
      />

      <PageBody>
        <div className="space-y-6">
          <InvoiceUpload />
          
          {/* TODO: Add invoice list and management components */}
          <div className="mt-8 p-6 border border-dashed border-border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Próximamente</h3>
            <p className="text-muted-foreground">
              Lista de facturas procesadas, filtros avanzados, y herramientas de gestión.
            </p>
          </div>
        </div>
      </PageBody>
    </>
  );
}