import Link from 'next/link';

import { cn } from '@kit/ui/utils';

function LogoImage({
  className,
  width = 105,
}: {
  className?: string;
  width?: number;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex items-center space-x-2">
        {/* Logo Icon - Simple geometric design */}
        <div className="w-6 h-6 md:w-8 md:h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <div className="w-3 h-3 md:w-4 md:h-4 bg-white rounded-sm" />
        </div>
        {/* NPJ Text - Responsive sizing */}
        <span className="text-lg md:text-2xl font-bold text-primary dark:text-white tracking-tight whitespace-nowrap">
          NPJ
        </span>
      </div>
    </div>
  );
}

export function AppLogo({
  href,
  label,
  className,
}: {
  href?: string | null;
  className?: string;
  label?: string;
}) {
  if (href === null) {
    return <LogoImage className={className} />;
  }

  return (
    <Link aria-label={label ?? 'Home Page'} href={href ?? '/'}>
      <LogoImage className={className} />
    </Link>
  );
}
