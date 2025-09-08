/**
 * Simple Progress Component
 * Temporary replacement for @kit/ui/progress
 */

import { cn } from '@kit/ui/shadcn';

interface ProgressProps {
  value: number;
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  
  return (
    <div className={cn("w-full bg-muted rounded-full h-2", className)}>
      <div 
        className="bg-primary h-full rounded-full transition-all duration-300" 
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}