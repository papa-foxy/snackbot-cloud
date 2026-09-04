import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { FilterType, ActiveFilter } from '../types';
import { filterTypeColors } from '../constants';
import { SearchInput } from './Primitives';

interface FilterSidebarProps {
  activeFilters: ActiveFilter[];
  orderTypeOptions: string[];
  paymentOptions: string[];
  categoryOptions: string[];
  menuItemOptions: { id: string; name: string }[];
  onToggleFilter: (type: FilterType, value: string, label: string) => void;
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
  isActive: (type: FilterType, value: string) => boolean;
}

export function FilterSidebar({
  activeFilters,
  orderTypeOptions,
  paymentOptions,
  categoryOptions,
  menuItemOptions,
  onToggleFilter,
  onRemoveFilter,
  onClearAll,
  isActive
}: FilterSidebarProps) {
  const [searchOrderType, setSearchOrderType] = useState('');
  const [searchPayment, setSearchPayment]     = useState('');
  const [searchCategory, setSearchCategory]   = useState('');
  const [searchMenuItem, setSearchMenuItem]   = useState('');

  const filtOrderType = orderTypeOptions.filter(v => v.toLowerCase().includes(searchOrderType.toLowerCase()));
  const filtPayment   = paymentOptions.filter(v => v.toLowerCase().includes(searchPayment.toLowerCase()));
  const filtCategory  = categoryOptions.filter(v => v.toLowerCase().includes(searchCategory.toLowerCase()));
  const filtMenuItem  = menuItemOptions.filter(m => m.name.toLowerCase().includes(searchMenuItem.toLowerCase()));

  return (
    <aside className="w-52 shrink-0">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden sticky top-4">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wide">Filters</span>
            {activeFilters.length > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-full leading-none">{activeFilters.length}</span>}
          </div>
          {activeFilters.length > 0 && <button onClick={onClearAll} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear all</button>}
        </div>

        <div className="divide-y divide-gray-100 max-h-[calc(100vh-14rem)] overflow-y-auto">
          {orderTypeOptions.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-2">Order Type</p>
              <SearchInput value={searchOrderType} onChange={setSearchOrderType} placeholder="Search..." />
              <div className="flex flex-wrap gap-1.5">
                {filtOrderType.length === 0
                  ? <p className="text-xs text-gray-400 dark:text-neutral-500 italic">No matches</p>
                  : filtOrderType.map(v => (
                    <button key={v} onClick={() => onToggleFilter('order_type', v, v)}
                      className={cn('px-2.5 py-1 text-xs rounded-full border font-medium capitalize transition-colors',
                        isActive('order_type', v) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-300 dark:border-neutral-600 hover:border-indigo-300 hover:text-indigo-600')}>
                      {v}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {paymentOptions.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-2">Payment</p>
              <SearchInput value={searchPayment} onChange={setSearchPayment} placeholder="Search..." />
              <div className="flex flex-wrap gap-1.5">
                {filtPayment.length === 0
                  ? <p className="text-xs text-gray-400 dark:text-neutral-500 italic">No matches</p>
                  : filtPayment.map(v => (
                    <button key={v} onClick={() => onToggleFilter('payment_method', v, v)}
                      className={cn('px-2.5 py-1 text-xs rounded-full border font-medium capitalize transition-colors',
                        isActive('payment_method', v) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-300 dark:border-neutral-600 hover:border-emerald-300 hover:text-emerald-600')}>
                      {v}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {categoryOptions.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-2">Category</p>
              <SearchInput value={searchCategory} onChange={setSearchCategory} placeholder="Search..." />
              <div className="flex flex-wrap gap-1.5">
                {filtCategory.length === 0
                  ? <p className="text-xs text-gray-400 dark:text-neutral-500 italic">No matches</p>
                  : filtCategory.map(v => (
                    <button key={v} onClick={() => onToggleFilter('category', v, v)}
                      className={cn('px-2.5 py-1 text-xs rounded-full border font-medium capitalize transition-colors',
                        isActive('category', v) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-300 dark:border-neutral-600 hover:border-amber-300 hover:text-amber-600')}>
                      {v}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {menuItemOptions.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mb-2">Menu Item</p>
              <SearchInput value={searchMenuItem} onChange={setSearchMenuItem} placeholder="Search items..." />
              <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                {filtMenuItem.length === 0
                  ? <p className="text-xs text-gray-400 dark:text-neutral-500 italic">No matches</p>
                  : filtMenuItem.map(m => (
                    <button key={m.id} onClick={() => onToggleFilter('menu_item', m.id, m.name)}
                      className={cn('w-full text-left px-2.5 py-1.5 text-xs rounded-lg border font-medium transition-colors',
                        isActive('menu_item', m.id) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-[var(--sb-border)] hover:border-purple-300 hover:text-purple-600')}>
                      {m.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {activeFilters.length > 0 && (
          <div className="px-3 pb-3 pt-2 flex flex-wrap gap-1.5 border-t border-gray-100 dark:border-[var(--sb-border)]">
            {activeFilters.map(f => (
              <span key={f.id} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', filterTypeColors[f.type])}>
                {f.label}
                <button onClick={() => onRemoveFilter(f.id)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
