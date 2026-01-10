import { Badge } from '@/components/ui/badge';
import { getMOTStatus, getDaysUntilMOT, MOTStatus } from '@/types/fleet';
import { AlertTriangle, CheckCircle, Clock, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MOTStatusBadgeProps {
  motDueDate: string | null;
  showDays?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

const statusConfig: Record<MOTStatus, {
  label: string;
  icon: typeof CheckCircle;
  className: string;
}> = {
  valid: {
    label: 'Valid',
    icon: CheckCircle,
    className: 'bg-status-valid text-status-valid-foreground border-status-valid',
  },
  'due-soon': {
    label: 'Due Soon',
    icon: Clock,
    className: 'bg-status-warning text-status-warning-foreground border-status-warning',
  },
  overdue: {
    label: 'Overdue',
    icon: AlertTriangle,
    className: 'bg-status-danger text-status-danger-foreground border-status-danger animate-pulse-glow',
  },
  unknown: {
    label: 'Unknown',
    icon: HelpCircle,
    className: 'bg-muted text-muted-foreground border-muted',
  },
};

export function MOTStatusBadge({ motDueDate, showDays = true, size = 'default' }: MOTStatusBadgeProps) {
  const status = getMOTStatus(motDueDate);
  const daysUntil = getDaysUntilMOT(motDueDate);
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    default: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium inline-flex items-center gap-1.5 border',
        config.className,
        sizeClasses[size]
      )}
    >
      <Icon className={cn('shrink-0', size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4')} />
      <span>{config.label}</span>
      {showDays && daysUntil !== null && (
        <span className="opacity-80">
          ({daysUntil >= 0 ? `${daysUntil}d` : `${Math.abs(daysUntil)}d ago`})
        </span>
      )}
    </Badge>
  );
}
