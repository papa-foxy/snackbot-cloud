import { Users, Clock } from 'lucide-react';
import { fmt } from '../constants';
import { Section, SkeletonRows } from '../components/Primitives';

interface StaffShiftSectionProps {
  loading: boolean;
  staffData: any[];
  shiftData: any[];
}

export function StaffShiftSection({
  loading,
  staffData,
  shiftData
}: StaffShiftSectionProps) {
  return (
    <Section title="Staff & Shift" icon={Clock} color="purple">
      <div className="divide-y divide-gray-100">
        <div>
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Sales per Staff</span>
          </div>
          {loading ? <SkeletonRows count={3} /> : staffData.length === 0
            ? <p className="px-5 pb-4 text-sm text-gray-400 dark:text-neutral-500">No staff data available</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 text-xs font-semibold uppercase tracking-wide">
                    <tr>
                      <th className="px-5 py-3 text-left">#</th>
                      <th className="px-5 py-3 text-left">Staff</th>
                      <th className="px-5 py-3 text-right">Orders</th>
                      <th className="px-5 py-3 text-right">Revenue</th>
                      <th className="px-5 py-3 text-right">Avg/Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {staffData.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:bg-neutral-800/50">
                        <td className="px-5 py-3 text-gray-400 dark:text-neutral-500 font-medium">{i + 1}</td>
                        <td className="px-5 py-3 font-medium text-gray-800 dark:text-neutral-200">{s.name}</td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-neutral-400">{s.orders}</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-neutral-100">{fmt(s.revenue)}</td>
                        <td className="px-5 py-3 text-right text-gray-500 dark:text-neutral-500">{s.orders ? fmt(s.revenue / s.orders) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
        <div>
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Shift Performance</span>
          </div>
          {loading ? <SkeletonRows count={3} /> : shiftData.length === 0
            ? <p className="px-5 pb-4 text-sm text-gray-400 dark:text-neutral-500">No shift data</p>
            : (
              <div className="px-5 pb-5 space-y-3">
                {shiftData.map((s, i) => {
                  const maxRev = Math.max(...shiftData.map(x => x.revenue));
                  const pct    = maxRev ? Math.round((s.revenue / maxRev) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 dark:text-neutral-300">{s.name}</span>
                        <span className="text-gray-500 dark:text-neutral-500">{fmt(s.revenue)} · {s.orders} orders</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-neutral-800 rounded-full h-2">
                        <div className="h-2 rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </Section>
  );
}
