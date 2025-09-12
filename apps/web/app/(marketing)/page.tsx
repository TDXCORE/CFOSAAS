import Image from 'next/image';
import Link from 'next/link';

import { ArrowRightIcon, LayoutDashboard } from 'lucide-react';

import {
  CtaButton,
  FeatureCard,
  FeatureGrid,
  FeatureShowcase,
  FeatureShowcaseIconContainer,
  Hero,
  Pill,
} from '@kit/ui/marketing';
import { Trans } from '@kit/ui/trans';

import { withI18n } from '~/lib/i18n/with-i18n';

function Home() {
  return (
    <div className={'mt-4 flex flex-col space-y-24 py-14'}>
      <div className={'container mx-auto'}>
        <Hero
          pill={
            <Pill label={'Nuevo'}>
              <span>Plataforma AI CFO para PYMES en Colombia</span>
            </Pill>
          }
          title={
            <>
              <span>Tu CFO Virtual Experto</span>
              <span>para automatizar finanzas</span>
            </>
          }
          subtitle={
            <span>
              Democratiza herramientas financieras avanzadas con IA. Procesa facturas,
              calcula impuestos y recibe asesoría estratégica para tu PYME en Colombia.
            </span>
          }
          cta={<MainCallToActionButton />}
          image={
            <Image
              priority
              className={
                'dark:border-primary/10 rounded-2xl border border-gray-200'
              }
              width={3558}
              height={2222}
              src={`/images/dashboard.webp`}
              alt={`App Image`}
            />
          }
        />
      </div>

      <div className={'container mx-auto'}>
        <div
          className={'flex flex-col space-y-16 xl:space-y-32 2xl:space-y-36'}
        >
          <FeatureShowcase
            heading={
              <>
                <b className="font-semibold dark:text-white">
                  Asistencia Financiera Inteligente
                </b>
                .{' '}
                <span className="text-muted-foreground font-normal">
                  Automatiza tu contabilidad y recibe asesoría experta con IA
                  especializada en normativa colombiana.
                </span>
              </>
            }
            icon={
              <FeatureShowcaseIconContainer>
                <LayoutDashboard className="h-5" />
                <span>Solución Integral</span>
              </FeatureShowcaseIconContainer>
            }
          >
            <FeatureGrid>
              <FeatureCard
                className={'relative col-span-2 overflow-hidden'}
                label={'Dashboard Financiero'}
                description={`NPJ proporciona un dashboard completo para gestionar las finanzas de tu PYME con KPIs específicos para Colombia.`}
              />

              <FeatureCard
                className={
                  'relative col-span-2 w-full overflow-hidden lg:col-span-1'
                }
                label={'Procesamiento Automático'}
                description={`NPJ procesa automáticamente facturas XML desde tu email O365/Outlook con clasificación PUC inteligente.`}
              />

              <FeatureCard
                className={'relative col-span-2 overflow-hidden lg:col-span-1'}
                label={'AI CFO Experto'}
                description={`Asesoría financiera inteligente con 15+ años de experiencia en normativa tributaria colombiana.`}
              />

              <FeatureCard
                className={'relative col-span-2 overflow-hidden'}
                label={'Motor Tributario Colombia'}
                description={`NPJ calcula automáticamente IVA, retenciones, ICA y genera reportes DIAN-compliant para tu empresa.`}
              />
            </FeatureGrid>
          </FeatureShowcase>
        </div>
      </div>
    </div>
  );
}

export default withI18n(Home);

function MainCallToActionButton() {
  return (
    <div className={'flex space-x-4'}>
      <CtaButton>
        <Link href={'/auth/sign-up'}>
          <span className={'flex items-center space-x-0.5'}>
            <span>
              <Trans i18nKey={'common:getStarted'} />
            </span>

            <ArrowRightIcon
              className={
                'animate-in fade-in slide-in-from-left-8 h-4' +
                ' zoom-in fill-mode-both delay-1000 duration-1000'
              }
            />
          </span>
        </Link>
      </CtaButton>

      <CtaButton variant={'link'}>
        <Link href={'/contact'}>
          <Trans i18nKey={'common:contactUs'} />
        </Link>
      </CtaButton>
    </div>
  );
}
