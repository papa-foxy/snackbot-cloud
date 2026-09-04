import { Table2, Users, CheckSquare, Percent } from 'lucide-react';
import { TableStats } from '../types';
import { Section, StatCard } from '../components/Primitives';

interface TableCustomerSectionProps {
  loading: boolean;
  tableStats: TableStats;
  totalOrders: number;
}

export function TableCustomerSection({
  loading,
  tableStats,
  totalOrders
}: TableCustomerSectionProps) {
  return (
    <Section title="Table & Customer" icon={Users} color="blue">
      <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Tables"   value={String(tableStats.total)}       icon={Table2}      color="blue"    loading={loading} />
        <StatCard label="Occupied"       value={String(tableStats.occupied)}    icon={Users}       color="blue"    loading={loading} />
        <StatCard label="Available"      value={String(tableStats.available)}   icon={CheckSquare} color="emerald" loading={loading} />
        <StatCard label="Occupancy Rate" value={`${tableStats.occupancyRate}%`} icon={Percent}     color="blue"    loading={loading} />
      </div>
      {!loading && (
        <div className="px-5 pb-5">
          <div className="bg-gray-100 dark:bg-neutral-800 rounded-full h-3 overflow-hidden">
            <div className="h-3 bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${tableStats.occupancyRate}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 dark:text-neutral-500 mt-1">
            <span>{tableStats.occupied} occupied</span><span>{tableStats.available} available</span>
          </div>
        </div>
      )}
      <div className="border-t border-gray-100 dark:border-[var(--sb-border)] px-5 py-4">
        <p className="text-xs text-gray-500 dark:text-neutral-500">
          Customers served this period (based on completed orders):{' '}
          <span className="font-semibold text-gray-900 dark:text-neutral-100">{totalOrders}</span>
        </p>
      </div>
    </Section>
  );
}
