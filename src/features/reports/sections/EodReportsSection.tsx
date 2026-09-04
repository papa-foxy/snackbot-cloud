import { useState } from 'react';
import { Receipt, Calendar } from 'lucide-react';
import { fmt } from '../constants';
import { cn } from '../../../utils/cn';
import { Section, SkeletonRows } from '../components/Primitives';
import { EodReportReceiptModal } from '../components/EodReportReceiptModal';

interface EodReportsSectionProps {
  loading: boolean;
  eodReports: any[];
}

export function EodReportsSection({ loading, eodReports }: EodReportsSectionProps) {
  const [selectedEod, setSelectedEod] = useState<any | null>(null);

  return (
    <Section title="EOD Reports (Z-Reports)" icon={Receipt} color="blue">
      {loading ? (
        <SkeletonRows count={3} />
      ) : eodReports.length === 0 ? (
        <div className="p-8 text-center text-gray-450 dark:text-neutral-500 font-medium">
          No EOD reports found for this date range.
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div className="grid gap-3">
            {eodReports.map((eod: any) => {
              const reportDate = new Date(eod.report_date);
              const completedCount = Number(eod.completed_orders || 0);
              const totalRevenue = Number(eod.grand_total || 0);
              const cashVariance = Number(eod.cash_variance || 0);

              const formattedDate = reportDate.toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'short', day: '2-digit' });

              return (
                <div 
                  key={eod.id} 
                  className="bg-white dark:bg-neutral-850 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-neutral-700/50 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">{formattedDate}</h4>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{completedCount} completed orders</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-13 sm:ml-0">
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Sales: {fmt(totalRevenue)}</p>
                      <div className="mt-1 flex justify-start sm:justify-end">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          cashVariance === 0 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/50'
                            : cashVariance < 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50'
                              : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50'
                        )}>
                          {cashVariance === 0 
                            ? 'Balanced' 
                            : `Variance: ${cashVariance >= 0 ? "+" : ""}${fmt(cashVariance)}`}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setSelectedEod(eod)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg text-xs font-semibold transition-colors shrink-0"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      View Z-Report
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {selectedEod && (
        <EodReportReceiptModal eod={selectedEod} onClose={() => setSelectedEod(null)} />
      )}
    </Section>
  );
}
