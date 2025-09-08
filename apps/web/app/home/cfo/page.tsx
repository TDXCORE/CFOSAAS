import { PageBody, PageHeader } from '@kit/ui/page';
import { CFOChatInterface } from '~/components/ai/cfo-chat-interface';

export default function CFOChatPage() {
  return (
    <>
      <PageHeader 
        title="CFO Virtual"
        description="Chatea con tu CFO virtual experto en finanzas colombianas"
      />

      <PageBody>
        <CFOChatInterface />
      </PageBody>
    </>
  );
}