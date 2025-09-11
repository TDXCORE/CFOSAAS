'use client';

import { useState } from 'react';
import { PageBody, PageHeader } from '@kit/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { InvoiceUpload } from '~/components/invoices/invoice-upload';
import { InvoicesList } from '~/components/invoices/invoices-list';
import { InvoiceDetailView } from '~/components/invoices/invoice-detail-view';
import { InvoiceActions } from '~/components/invoices/invoice-actions';
import { useCurrentCompany } from '~/lib/companies/tenant-context';
import type { Invoice } from '~/lib/invoices/types';

export default function InvoicesPage() {
  const currentCompany = useCurrentCompany();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [refreshKey, setRefreshKey] = useState(0);

  // Handle invoice upload completion
  const handleUploadComplete = (invoiceIds: string[]) => {
    console.log('Upload completed for invoices:', invoiceIds);
    // Switch to list tab to show uploaded invoices
    setActiveTab('list');
    // Force refresh of the list
    setRefreshKey(prev => prev + 1);
  };

  // Handle invoice selection from list
  const handleInvoiceSelect = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setActiveTab('detail');
  };

  // Handle back from detail view
  const handleBackFromDetail = () => {
    setSelectedInvoice(null);
    setActiveTab('list');
  };

  // Handle invoice updates/deletions
  const handleInvoiceUpdated = () => {
    // Refresh the list
    setRefreshKey(prev => prev + 1);
  };

  const handleInvoiceDeleted = () => {
    // Go back to list and refresh
    setSelectedInvoice(null);
    setActiveTab('list');
    setRefreshKey(prev => prev + 1);
  };

  return (
    <>
      <PageHeader 
        title="Gestión de Facturas"
        description="Procesa, carga y gestiona facturas electrónicas colombianas"
      />

      <PageBody>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Cargar Facturas</TabsTrigger>
            <TabsTrigger value="list">Lista de Facturas</TabsTrigger>
            <TabsTrigger value="detail" disabled={!selectedInvoice}>
              {selectedInvoice ? `Factura ${selectedInvoice.invoice_number}` : 'Detalle'}
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="mt-6">
            <InvoiceUpload 
              onUploadComplete={handleUploadComplete}
              maxFiles={10}
              allowedTypes={['xml', 'pdf', 'zip']}
            />
          </TabsContent>

          {/* List Tab */}
          <TabsContent value="list" className="mt-6">
            <InvoicesList 
              key={refreshKey} // Force refresh when key changes
              onInvoiceSelect={handleInvoiceSelect}
            />
          </TabsContent>

          {/* Detail Tab */}
          <TabsContent value="detail" className="mt-6">
            {selectedInvoice && currentCompany ? (
              <div className="space-y-6">
                {/* Invoice Actions Bar */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Detalles de la Factura
                  </h2>
                  <InvoiceActions
                    invoice={selectedInvoice}
                    companyId={currentCompany.id}
                    onInvoiceUpdated={handleInvoiceUpdated}
                    onInvoiceDeleted={handleInvoiceDeleted}
                  />
                </div>

                {/* Invoice Detail View */}
                <InvoiceDetailView
                  invoiceId={selectedInvoice.id}
                  companyId={currentCompany.id}
                  onBack={handleBackFromDetail}
                  onEdit={(invoice) => {
                    // Could open an edit dialog or navigate to edit page
                    console.log('Edit invoice:', invoice);
                  }}
                />
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Selecciona una factura de la lista para ver sus detalles
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}