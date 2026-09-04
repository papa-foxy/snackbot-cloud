import { Package, AlertTriangle, X } from 'lucide-react';
import { fmt } from '../constants';
import { cn } from '../../../utils/cn';
import { Section, StatCard, SkeletonRows } from '../components/Primitives';

interface InventoryStockSectionProps {
  loading: boolean;
  lowStockItems: any[];
  inventoryData: any[];
}

export function InventoryStockSection({
  loading,
  lowStockItems,
  inventoryData
}: InventoryStockSectionProps) {
  const outOfStock = inventoryData.filter((i: any) => Number(i.quantity) <= 0).length;

  return (
    <Section title="Inventory & Stock" icon={Package} color="rose">
      <div className="p-5 grid grid-cols-3 gap-3 border-b border-gray-100 dark:border-[var(--sb-border)]">
        <StatCard label="Total Items"  value={String(inventoryData.length)} icon={Package}       color="rose" loading={loading} />
        <StatCard label="Low Stock"    value={String(lowStockItems.length)} icon={AlertTriangle} color="rose" loading={loading} sub="At or below minimum" />
        <StatCard label="Out of Stock" value={String(outOfStock)}           icon={X}             color="rose" loading={loading} />
      </div>
      <div className="border-b border-gray-100 dark:border-[var(--sb-border)]">
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Low Stock Alerts</span>
          {lowStockItems.length > 0 && <span className="text-xs bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">{lowStockItems.length}</span>}
        </div>
        {loading ? <SkeletonRows count={3} /> : lowStockItems.length === 0
          ? <p className="px-5 pb-4 text-sm text-emerald-600 font-medium">✓ All stock levels are healthy</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-rose-50 text-rose-600 text-xs font-semibold uppercase tracking-wide">
                  <tr>
                    <th className="px-5 py-3 text-left">Item</th>
                    <th className="px-5 py-3 text-right">Current</th>
                    <th className="px-5 py-3 text-right">Min Level</th>
                    <th className="px-5 py-3 text-left">Unit</th>
                    <th className="px-5 py-3 text-left">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {lowStockItems.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-rose-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-neutral-200">{item.name}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={cn('font-bold', Number(item.quantity) <= 0 ? 'text-rose-600' : 'text-amber-600')}>{item.quantity}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-500 dark:text-neutral-500">{item.min_stock_level}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-neutral-500">{item.unit}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-neutral-500 text-xs">{item.supplier || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
      <div>
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <Package className="w-4 h-4 text-rose-400" /><span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Stock Overview</span>
        </div>
        {loading ? <SkeletonRows count={5} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 text-xs font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">Item</th>
                  <th className="px-5 py-3 text-right">Qty</th>
                  <th className="px-5 py-3 text-left">Unit</th>
                  <th className="px-5 py-3 text-right">Cost/Unit</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inventoryData.map((item: any, i: number) => {
                  const qty = Number(item.quantity), min = Number(item.min_stock_level), isLow = qty <= min;
                  return (
                    <tr key={i} className="hover:bg-gray-50 dark:bg-neutral-800/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-neutral-200">{item.name}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-neutral-100">{item.quantity}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-neutral-500">{item.unit}</td>
                      <td className="px-5 py-3 text-right text-gray-500 dark:text-neutral-500">{item.cost_per_unit ? fmt(Number(item.cost_per_unit)) : '—'}</td>
                      <td className="px-5 py-3 text-right">
                        {isLow ? (
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
                            qty <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>
                            {qty <= 0 ? 'Out of stock' : 'Low stock'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}
