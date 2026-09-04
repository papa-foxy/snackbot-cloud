import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { fmt } from '../constants';
import { cn } from '../../../utils/cn';
import { Section, SkeletonRows } from '../components/Primitives';

interface SessionReportsSectionProps {
  loading: boolean;
  shifts: any[];
  transactionRows: any[];
}

export function SessionReportsSection({
  loading,
  shifts,
  transactionRows
}: SessionReportsSectionProps) {
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    setPage(0);
  }, [shifts.length]);

  const getCashierName = (shift: any) => {
    const usersRaw = shift.users;
    if (!usersRaw) return 'Unknown Cashier';
    if (Array.isArray(usersRaw)) {
      return usersRaw[0]?.name || 'Unknown Cashier';
    }
    return usersRaw.name || 'Unknown Cashier';
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'Active Now';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const totalPages = Math.max(1, Math.ceil(shifts.length / pageSize));
  const currentShifts = shifts.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <Section title="Cashier Sessions (Shifts)" icon={Clock} color="purple">
      {loading ? (
        <SkeletonRows count={3} />
      ) : shifts.length === 0 ? (
        <div className="p-8 text-center text-gray-400 dark:text-neutral-500 font-medium">
          No shift sessions found for this date range.
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div className="grid gap-3">
            {currentShifts.map((shift: any) => {
              const clockIn = new Date(shift.clock_in);
              const clockOut = shift.clock_out ? new Date(shift.clock_out) : null;
              const openingCash = Number(shift.opening_cash || 0);
              const closingCash = shift.closing_cash !== null && shift.closing_cash !== undefined ? Number(shift.closing_cash) : null;
              const notes = shift.notes || '';
              const isShiftActive = !clockOut;
              const cashierName = getCashierName(shift);

              const shiftClockInTime = new Date(shift.clock_in).getTime();
              const shiftClockOutTime = clockOut ? new Date(shift.clock_out).getTime() : null;

              const shiftSales = transactionRows.reduce((sum: number, o: any) => {
                if (o.status !== 'completed' && o.status !== 'paid') return sum;
                const orderTime = new Date(o.created_at).getTime();
                if (orderTime >= shiftClockInTime && (shiftClockOutTime === null || orderTime <= shiftClockOutTime)) {
                  return sum + Number(o.total || 0);
                }
                return sum;
              }, 0);

              const formattedInDate = clockIn.toLocaleDateString('en-MY', { month: 'short', day: '2-digit', year: 'numeric' });
              const formattedInTime = clockIn.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
              const formattedOutTime = clockOut ? clockOut.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : 'Present';
              const durationStr = formatDuration(shift.clock_in, shift.clock_out);

              return (
                <div 
                  key={shift.id} 
                  className="bg-white dark:bg-neutral-850 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                      isShiftActive 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20' 
                        : 'bg-purple-50 dark:bg-purple-950/20'
                    )}>
                      {isShiftActive ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      ) : (
                        <Clock className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white">{cashierName}</h4>
                        {isShiftActive && (
                          <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-450 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide leading-none">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                        {formattedInDate} • {formattedInTime} - {formattedOutTime} ({durationStr})
                      </p>
                      {notes && (
                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 italic">
                          Note: {notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end justify-center ml-13 sm:ml-0 text-left sm:text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      Sales: {fmt(shiftSales)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                      Float: {fmt(openingCash)}
                      {closingCash !== null && ` → ${fmt(closingCash)}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 flex items-center justify-between mt-4">
              <button 
                onClick={() => setPage(p => Math.max(0, p - 1))} 
                disabled={page === 0}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-neutral-800 rounded-lg font-medium text-gray-600 dark:text-neutral-400 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-500 dark:text-neutral-400 font-medium">
                Page {page + 1} of {totalPages}
              </span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
                disabled={page === totalPages - 1}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-neutral-800 rounded-lg font-medium text-gray-600 dark:text-neutral-400 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
