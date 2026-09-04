import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronUp, ChevronDown, Search, X, Settings, GripVertical, CheckSquare, Square
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { ColDef } from '../types';
import { colorMap } from '../constants';

export function StatCard({ label, value, sub, trend, icon: Icon, color, loading }: {
  label: string; value: string; sub?: string; trend?: string;
  icon: React.ElementType; color: string; loading?: boolean;
}) {
  const c = colorMap[color];
  return (
    <div className={cn('bg-white dark:bg-[var(--sb-card)] rounded-xl border shadow-sm p-4', c.border)}>
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-gray-200 rounded w-2/3" />
          <div className="h-6 bg-gray-200 rounded w-1/2 mt-2" />
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 font-medium">{label}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-lg font-bold text-gray-900 dark:text-neutral-100">{value}</p>
              {trend && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                  trend.startsWith('+') ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                  {trend}
                </span>
              )}
            </div>
            {sub && <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{sub}</p>}
          </div>
          <div className={cn('p-2 rounded-lg', c.bg)}>
            <Icon className={cn('w-4 h-4', c.text)} />
          </div>
        </div>
      )}
    </div>
  );
}

export function Section({ title, icon: Icon, color, children, defaultOpen = true, badge }: {
  title: string; icon: React.ElementType; color: string;
  children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const c = colorMap[color];
  return (
    <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden">
      <button onClick={() => setOpen(p => !p)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:bg-neutral-800/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', c.bg)}><Icon className={cn('w-4 h-4', c.text)} /></div>
          <span className="font-semibold text-gray-900 dark:text-neutral-100 text-sm">{title}</span>
          {badge && <div className="ml-2">{badge}</div>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-neutral-500" />}
      </button>
      {open && <div className="border-t border-gray-100 dark:border-[var(--sb-border)]">{children}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-neutral-500 pointer-events-none" />
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-6 pr-6 py-1 text-xs border border-gray-200 dark:border-[var(--sb-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-gray-50 dark:bg-neutral-800/50 placeholder-gray-400" />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function SubTableHeader({ gradient, icon: Icon, title, subtitle, badge }: {
  gradient: string; icon: React.ElementType; title: string; subtitle?: string; badge?: React.ReactNode;
}) {
  return (
    <div className={cn('px-5 py-3 flex items-center gap-2.5 rounded-t-xl', gradient)}>
      <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: '#ffffff' }} />
      </div>
      <span className="text-sm font-bold text-white">{title}</span>
      {badge}
      {subtitle && <span className="text-xs ml-auto hidden sm:block text-white/70">{subtitle}</span>}
    </div>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: count }).map((_, i) => <div key={i} className="h-8 bg-gray-100 dark:bg-neutral-800 animate-pulse rounded" />)}
    </div>
  );
}

const PAGE_SIZE = 10;

export function FlexTable({ cols, rows, extra, tableId, noPagination, onRowClick }: {
  cols: ColDef[]; rows: any[]; extra?: any; tableId: string; noPagination?: boolean; onRowClick?: (row: any) => void
}) {
  const [visibleCols, setVisibleCols] = useState<string[]>(cols.filter(c => c.defaultVisible).map(c => c.id));
  const [colOrder, setColOrder]       = useState<string[]>(cols.map(c => c.id));
  const [showSettings, setShowSettings] = useState(false);
  const [dragOver, setDragOver]       = useState<string | null>(null);
  const [page, setPage]               = useState(0);
  const dragCol   = useRef<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSettings(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setPage(0); }, [rows.length]);

  const toggleCol = (id: string) => setVisibleCols(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const orderedVisible = colOrder.filter(id => visibleCols.includes(id)).map(id => cols.find(c => c.id === id)!).filter(Boolean);

  const onDragStart = (id: string) => { dragCol.current = id; };
  const onDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOver(id); };
  const onDrop      = (targetId: string) => {
    if (!dragCol.current || dragCol.current === targetId) { setDragOver(null); return; }
    setColOrder(prev => {
      const arr = [...prev], from = arr.indexOf(dragCol.current!), to = arr.indexOf(targetId);
      arr.splice(from, 1); arr.splice(to, 0, dragCol.current!); return arr;
    });
    setDragOver(null); dragCol.current = null;
  };

  const totalPages = noPagination ? 1 : Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows  = noPagination ? rows : rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="px-5 py-2 border-b border-gray-100 dark:border-[var(--sb-border)] flex items-center justify-between gap-2 bg-white dark:bg-[var(--sb-card)]">
        {!noPagination && rows.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-neutral-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
        )}
        <div ref={wrapperRef} className={cn('relative', noPagination || rows.length === 0 ? 'ml-auto' : '')}>
          <button onClick={() => setShowSettings(p => !p)}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg font-medium transition-colors',
              showSettings ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-[var(--sb-border)] hover:border-gray-300 dark:border-neutral-600')}>
            <Settings className="w-3.5 h-3.5" />Columns
          </button>

          {showSettings && (
            <div className="absolute right-0 top-full mt-1.5 z-[999] bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl shadow-2xl w-56 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50">
                <p className="text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide">Show / Hide Columns</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Drag to reorder</p>
              </div>
              <div className="p-2 space-y-0.5 max-h-72 overflow-y-auto">
                {colOrder.map(id => {
                  const col = cols.find(c => c.id === id)!; if (!col) return null;
                  const visible = visibleCols.includes(id);
                  return (
                    <div key={id} draggable onDragStart={() => onDragStart(id)} onDragOver={e => onDragOver(e, id)} onDrop={() => onDrop(id)}
                      className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab select-none transition-colors',
                        dragOver === id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 dark:hover:bg-neutral-700')}>
                      <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <button onClick={() => toggleCol(id)} className="flex items-center gap-2 flex-1 text-left">
                        {visible ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> : <Square className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                        <span className={cn('text-xs font-medium', visible ? 'text-gray-800 dark:text-neutral-200' : 'text-gray-400 dark:text-neutral-500')}>{col.label}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="px-3 py-2 border-t border-gray-100 dark:border-[var(--sb-border)] flex gap-2">
                <button onClick={() => setVisibleCols(cols.map(c => c.id))} className="flex-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">Show all</button>
                <button onClick={() => setVisibleCols(cols.filter(c => c.defaultVisible).map(c => c.id))} className="flex-1 text-xs text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300 font-medium">Reset</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 text-xs font-semibold uppercase tracking-wide">
            <tr>
              {orderedVisible.map(col => (
                <th key={col.id} draggable onDragStart={() => onDragStart(col.id)} onDragOver={e => onDragOver(e, col.id)} onDrop={() => onDrop(col.id)}
                  className={cn('px-5 py-3 cursor-grab select-none', col.headerClass, dragOver === col.id && 'bg-indigo-50')}>
                  <div className={cn('flex items-center gap-1.5',
                    col.headerClass?.includes('text-right') ? 'justify-end' : col.headerClass?.includes('text-center') ? 'justify-center' : 'justify-start')}>
                    {col.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedRows.length === 0 ? (
              <tr><td colSpan={orderedVisible.length} className="px-5 py-10 text-center text-gray-400 dark:text-neutral-500 text-sm">No data available</td></tr>
            ) : pagedRows.map((row, i) => (
              <tr key={i}
                onClick={() => onRowClick?.(row)}
                className={cn('transition-colors', onRowClick ? 'cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/20' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/50')}>
                {orderedVisible.map(col => <td key={col.id} className={cn('px-5 py-3', col.cellClass)}>{col.render(row, page * PAGE_SIZE + i, extra)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!noPagination && totalPages > 1 && (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-[var(--sb-border)] flex items-center justify-between bg-white dark:bg-[var(--sb-card)]">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-[var(--sb-border)] rounded-lg font-medium text-gray-600 dark:text-neutral-400 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors">
            ← Prev
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={cn('w-7 h-7 text-xs rounded-lg font-medium transition-colors',
                  page === i ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700')}>
                {i + 1}
              </button>
            ))}
          </div>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-[var(--sb-border)] rounded-lg font-medium text-gray-600 dark:text-neutral-400 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
