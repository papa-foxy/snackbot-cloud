import { Eye, EyeOff, Pencil, X } from 'lucide-react';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { cn } from '../../utils/cn';

export function ImpersonationBanner() {
  const { isImpersonating, merchantName, isWriteAccess, endImpersonation } = useImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className={cn(
      'fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-4 py-2 text-sm font-semibold',
      isWriteAccess
        ? 'bg-amber-500 text-white'
        : 'bg-indigo-600 text-white'
    )}>
      <div className="flex items-center gap-2">
        {isWriteAccess
          ? <Pencil className="w-4 h-4" />
          : <Eye className="w-4 h-4" />
        }
        <span>
          {isWriteAccess ? 'Acting as' : 'Viewing as'}:&nbsp;
          <strong>{merchantName}</strong>
        </span>
        <span className={cn(
          'ml-2 px-2 py-0.5 rounded-full text-xs font-bold',
          isWriteAccess ? 'bg-amber-700/40' : 'bg-indigo-800/40'
        )}>
          {isWriteAccess ? 'WRITE ACCESS' : 'READ ONLY'}
        </span>
      </div>

      <button
        onClick={endImpersonation}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500 dark:bg-[var(--sb-card)]/20 hover:bg-white dark:bg-[var(--sb-card)]/30 transition-colors text-xs font-bold"
      >
        <X className="w-3.5 h-3.5" />
        Exit
      </button>
    </div>
  );
}
