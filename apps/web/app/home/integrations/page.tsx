'use client';

import { PageBody, PageHeader } from '@kit/ui/page';
import { EmailIntegration } from '~/components/integrations/email-integration';
import { EmailDemo } from '~/components/integrations/email-demo';

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integraciones"
        description="Configura integraciones automáticas para procesamiento de facturas"
      />

      <PageBody>
        <div className="space-y-8">
          {/* Demo Component - Ready to use */}
          <EmailDemo />

          {/* Advanced Configuration */}
          <EmailIntegration />

          {/* Future integrations can be added here */}
          {/* <WhatsAppIntegration /> */}
          {/* <AccountingSystemIntegration /> */}
        </div>
      </PageBody>
    </>
  );
}