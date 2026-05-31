// src/components/AuditLogs.tsx
// Standalone full-page audit log — no props required, used as a top-level page
//
// CHANGELOG
// ─────────────────────────────────────────────────────────────────────────────
// v2.0.0  2026-03-03
//   NEW  "What Gets Logged" tab — documents every page & action the system
//        records, grouped by module (Auth, Staff, Orders, Menu, Schedule,
//        Inventory, System). Each row shows event label, action code, trigger
//        description and the page it fires from.
//   NEW  System-wide Sync — "Sync All Sources" button pulls from audit_logs
//        + orders + menu + inventory + schedule_templates tables and merges
//        them into one unified timeline sorted newest-first.
//   NEW  Source column + filter chips — every row tagged with its origin
//        module; chip row lets you filter to a single source instantly.
//        Clicking "View log →" in the Coverage tab jumps straight to that
//        source-filtered view.
//   NEW  Timestamp split into date + time for scannability.
//   NEW  "Last synced X ago" indicator under the page title.
//   FIX  log.action undefined crash — all string ops guarded with ?? ''.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert, Search, Loader2, Sparkles, Activity,
  LogIn, LogOut, UserPlus, UserX, UserCheck,
  Edit2, KeyRound, Shield, RefreshCw,
  ShoppingCart, UtensilsCrossed, Package, Clock,
  CalendarDays, ChevronRight, CheckCircle2, Info,
  List, Zap, Database, AlertTriangle,
  ArrowDownUp, BookOpen, Settings, GripVertical,
  CheckSquare, Square,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../contexts/TranslationContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { GoogleGenAI } from '@google/genai';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '../utils/cn';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type LogSource = 'auth' | 'orders' | 'menu' | 'inventory' | 'schedule' | 'staff' | 'system';

interface AuditEntry {
  id:          string;
  user_id:     string | null;
  user_name:   string | null;
  action:      string;
  target_id:   string | null;
  target_name: string | null;
  metadata:    Record<string, any> | null;
  ip_address:  string | null;
  source:      LogSource;
  created_at:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage map
// ─────────────────────────────────────────────────────────────────────────────

interface CoverageEvent {
  action:  string;
  label:   string;
  trigger: string;
  page:    string;
}

interface CoverageModule {
  id:     LogSource;
  label:  string;
  icon:   React.ComponentType<any>;
  color:  string;
  bg:     string;
  border: string;
  events: CoverageEvent[];
}

const COVERAGE: CoverageModule[] = [
  {
    id: 'auth', label: 'Authentication', icon: Shield,
    color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200',
    events: [
      { action: 'login',               label: 'Staff signed in',      trigger: 'User logs in with email + password',             page: 'Login page'       },
      { action: 'logout',              label: 'Staff signed out',      trigger: 'User clicks Sign Out in the nav',                page: 'Any page'         },
      { action: 'password_reset',      label: 'Password changed',      trigger: 'Staff completes password reset flow',            page: 'Reset Password'   },
      { action: 'password_reset_sent', label: 'Reset link sent',       trigger: 'Admin triggers Send reset email for a staff',    page: 'Staff Management' },
      { action: 'session_expired',     label: 'Session expired',       trigger: 'Auth token expired while user was active',       page: 'Any page'         },
    ],
  },
  {
    id: 'staff', label: 'Staff Management', icon: UserPlus,
    color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200',
    events: [
      { action: 'user_invited',  label: 'Invite sent',         trigger: 'Admin enters email and clicks Invite Staff',    page: 'Staff Management' },
      { action: 'user_created',  label: 'Staff account added', trigger: 'New staff completes signup via invite link',    page: 'Staff Management' },
      { action: 'user_updated',  label: 'Profile updated',     trigger: 'Admin edits name, role or email of a staff',   page: 'Staff Management' },
      { action: 'user_disabled', label: 'Account disabled',    trigger: 'Admin toggles account off',                    page: 'Staff Management' },
      { action: 'user_enabled',  label: 'Account re-enabled',  trigger: 'Admin toggles account back on',                page: 'Staff Management' },
      { action: 'user_deleted',  label: 'Staff removed',       trigger: 'Admin deletes a staff account permanently',    page: 'Staff Management' },
      { action: 'role_changed',  label: 'Role changed',        trigger: 'Admin changes staff role e.g. Cashier to Admin', page: 'Staff Management' },
    ],
  },
  {
    id: 'orders', label: 'Orders & POS', icon: ShoppingCart,
    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',
    events: [
      { action: 'order_created',    label: 'New order placed',      trigger: 'Staff creates order at POS terminal',          page: 'POS / Order'    },
      { action: 'order_updated',    label: 'Order modified',        trigger: 'Staff edits items on an in-progress order',    page: 'POS / Order'    },
      { action: 'order_completed',  label: 'Order completed',       trigger: 'Payment received and order marked done',       page: 'POS / Order'    },
      { action: 'order_cancelled',  label: 'Order cancelled',       trigger: 'Staff or manager cancels an active order',     page: 'POS / Order'    },
      { action: 'order_refunded',   label: 'Order refunded',        trigger: 'Manager processes a refund',                   page: 'Orders History' },
      { action: 'discount_applied', label: 'Discount applied',      trigger: 'Staff applies a manual discount or promo code',page: 'POS / Order'    },
      { action: 'payment_method',   label: 'Payment method changed',trigger: 'Staff changes payment method after selection', page: 'POS / Checkout' },
    ],
  },
  {
    id: 'menu', label: 'Menu Management', icon: UtensilsCrossed,
    color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200',
    events: [
      { action: 'Menu Item Created',          label: 'Item added',         trigger: 'Staff saves a new menu item',                  page: 'Menu Management' },
      { action: 'Menu Item Updated',          label: 'Item edited',        trigger: 'Staff edits name, price, or category',         page: 'Menu Management' },
      { action: 'Menu Item Deleted',          label: 'Item deleted',       trigger: 'Staff deletes a menu item',                    page: 'Menu Management' },
      { action: 'Menu Item Enabled',          label: 'Item turned ON',     trigger: 'Manual availability override toggled on',      page: 'Menu Management' },
      { action: 'Menu Item Disabled',         label: 'Item turned OFF',    trigger: 'Manual availability override toggled off',     page: 'Menu Management' },
      { action: 'Category Created',           label: 'Category added',     trigger: 'Staff saves a new category',                   page: 'Menu Management' },
      { action: 'Category Updated',           label: 'Category edited',    trigger: 'Staff edits a category name or sort order',    page: 'Menu Management' },
      { action: 'Category Deleted',           label: 'Category deleted',   trigger: 'Staff deletes a category',                     page: 'Menu Management' },
      { action: 'CSV Import',                 label: 'Bulk CSV imported',  trigger: 'Staff uploads a CSV file for bulk import',     page: 'Menu Management' },
      { action: 'Schedule Assignment Updated',label: 'Schedule assigned',  trigger: 'Staff assigns a schedule template to item/cat',page: 'Menu Management' },
    ],
  },
  {
    id: 'schedule', label: 'Schedule Templates', icon: CalendarDays,
    color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200',
    events: [
      { action: 'Schedule Template Created', label: 'Template created', trigger: 'Staff creates a new schedule template',        page: 'Menu -> Schedules' },
      { action: 'Schedule Template Updated', label: 'Template edited',  trigger: 'Staff edits a schedule template name or slots',page: 'Menu -> Schedules' },
      { action: 'Schedule Template Deleted', label: 'Template deleted', trigger: 'Staff deletes a schedule template',            page: 'Menu -> Schedules' },
    ],
  },
  {
    id: 'inventory', label: 'Inventory', icon: Package,
    color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200',
    events: [
      { action: 'inventory_added',   label: 'Stock added',      trigger: 'Staff adds a new inventory item',                page: 'Inventory'     },
      { action: 'inventory_updated', label: 'Stock updated',    trigger: 'Staff edits quantity, unit or threshold',        page: 'Inventory'     },
      { action: 'inventory_deleted', label: 'Stock removed',    trigger: 'Staff deletes an inventory item',                page: 'Inventory'     },
      { action: 'stock_restocked',   label: 'Restock recorded', trigger: 'Staff logs a restock delivery',                  page: 'Inventory'     },
      { action: 'stock_low_alert',   label: 'Low stock alert',  trigger: 'System detects stock below threshold',           page: 'System / Auto' },
      { action: 'stock_deducted',    label: 'Stock deducted',   trigger: 'Order completed — ingredients auto-deducted',    page: 'System / Auto' },
    ],
  },
  {
    id: 'system', label: 'System & Settings', icon: Database,
    color: 'text-gray-700 dark:text-neutral-300', bg: 'bg-gray-100 dark:bg-neutral-800', border: 'border-gray-300 dark:border-neutral-600',
    events: [
      { action: 'settings_updated',  label: 'Settings changed',  trigger: 'Admin saves any system settings',              page: 'Settings'          },
      { action: 'tax_config_updated',label: 'Tax config updated', trigger: 'Admin edits tax rates or rules',               page: 'Settings -> Tax'   },
      { action: 'backup_triggered',  label: 'Backup triggered',   trigger: 'Admin manually triggers a data backup',        page: 'Settings'          },
      { action: 'report_exported',   label: 'Report exported',    trigger: 'Staff exports a report as PDF or CSV',         page: 'Reports'           },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Source styles
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_STYLE: Record<LogSource, { cls: string; border: string; icon: React.ComponentType<any> }> = {
  auth:      { cls: 'bg-violet-100  text-violet-700',  border: 'border-violet-200',  icon: Shield          },
  staff:     { cls: 'bg-blue-100    text-blue-700',    border: 'border-blue-200',    icon: UserPlus        },
  orders:    { cls: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200', icon: ShoppingCart    },
  menu:      { cls: 'bg-indigo-100  text-indigo-700',  border: 'border-indigo-200',  icon: UtensilsCrossed },
  schedule:  { cls: 'bg-amber-100   text-amber-700',   border: 'border-amber-200',   icon: CalendarDays    },
  inventory: { cls: 'bg-orange-100  text-orange-700',  border: 'border-orange-200',  icon: Package         },
  system:    { cls: 'bg-gray-100 dark:bg-neutral-800    text-gray-600 dark:text-neutral-400',    border: 'border-gray-200 dark:border-[var(--sb-border)]',    icon: Database        },
};

// Build ACTION_META from coverage map (stays in sync automatically)
const ACTION_META: Record<string, { label: string; cls: string; icon: React.ComponentType<any>; source: LogSource }> = {};
COVERAGE.forEach(mod => {
  const s = SOURCE_STYLE[mod.id];
  mod.events.forEach(ev => {
    ACTION_META[ev.action] = { label: ev.label, cls: s.cls, icon: s.icon, source: mod.id };
  });
});

function detectSource(action: string): LogSource {
  const a = (action ?? '').toLowerCase();
  if (a.includes('login') || a.includes('logout') || a.includes('password') || a.includes('session')) return 'auth';
  if (a.includes('user_') || a.includes('role') || a.includes('staff') || a.includes('invite'))        return 'staff';
  if (a.includes('order') || a.includes('discount') || a.includes('payment') || a.includes('refund'))  return 'orders';
  if (a.includes('menu') || a.includes('category') || a.includes('csv') || a.includes('item'))         return 'menu';
  if (a.includes('schedule'))                                                                            return 'schedule';
  if (a.includes('inventory') || a.includes('stock'))                                                   return 'inventory';
  return 'system';
}

// ─────────────────────────────────────────────────────────────────────────────
// SourceBadge
// ─────────────────────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: LogSource }) {
  const s    = SOURCE_STYLE[source] ?? SOURCE_STYLE.system;
  const Icon = s.icon;
  const mod  = COVERAGE.find(m => m.id === source);
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', s.cls, s.border)}>
      <Icon className="w-2.5 h-2.5" />
      {mod?.label ?? source}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FlexTable
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

interface ColDef {
  id:             string;
  label:          string;
  defaultVisible: boolean;
  headerClass?:   string;
  cellClass?:     string;
  render:         (row: any, idx: number, extra?: any) => React.ReactNode;
}

function FlexTable({ cols, rows, tableId, noPagination, onRowClick }: {
  cols:          ColDef[];
  rows:          any[];
  tableId:       string;
  noPagination?: boolean;
  onRowClick?:   (row: any) => void;
}) {
  const [visibleCols,   setVisibleCols]   = useState<string[]>(cols.filter(c => c.defaultVisible).map(c => c.id));
  const [colOrder,      setColOrder]      = useState<string[]>(cols.map(c => c.id));
  const [showSettings,  setShowSettings]  = useState(false);
  const [dragOver,      setDragOver]      = useState<string | null>(null);
  const [page,          setPage]          = useState(0);
  const dragCol    = useRef<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSettings(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setPage(0); }, [rows.length]);

  const toggleCol      = (id: string) => setVisibleCols(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
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
      {/* Toolbar */}
      <div className="px-5 py-2 border-b border-gray-100 dark:border-[var(--sb-border)] flex items-center justify-between gap-2 bg-white dark:bg-[var(--sb-card)]">
        {!noPagination && rows.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-neutral-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
        )}
        <div ref={wrapperRef} className={cn('relative', noPagination || rows.length === 0 ? 'ml-auto' : '')}>
          <button onClick={() => setShowSettings(p => !p)}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg font-medium transition-colors',
              showSettings ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-[var(--sb-border)] hover:border-gray-300')}>
            <Settings className="w-3.5 h-3.5" /> Columns
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
          <tbody className="divide-y divide-gray-100 dark:divide-[var(--sb-border)]">
            {pagedRows.length === 0 ? (
              <tr><td colSpan={orderedVisible.length} className="px-5 py-10 text-center text-gray-400 dark:text-neutral-500 text-sm">No activity found matching your filters.</td></tr>
            ) : pagedRows.map((row, i) => (
              <tr key={row.id ?? i} onClick={() => onRowClick?.(row)}
                className={cn('transition-colors', onRowClick ? 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/50')}>
                {orderedVisible.map(col => (
                  <td key={col.id} className={cn('px-5 py-3.5', col.cellClass)}>
                    {col.render(row, page * PAGE_SIZE + i)}
                  </td>
                ))}
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

// ─────────────────────────────────────────────────────────────────────────────
// Audit column definitions
// ─────────────────────────────────────────────────────────────────────────────

const AUDIT_COLS: ColDef[] = [
  {
    id: 'timestamp', label: 'Timestamp', defaultVisible: true,
    render: (row) => (
      <div>
        <p className="text-xs font-medium text-gray-700 dark:text-neutral-300">{format(new Date(row.created_at), 'dd MMM yyyy')}</p>
        <p className="text-[11px] text-gray-400 dark:text-neutral-500">{format(new Date(row.created_at), 'HH:mm:ss')}</p>
      </div>
    ),
  },
  {
    id: 'source', label: 'Source', defaultVisible: true,
    render: (row) => <SourceBadge source={row.source} />,
  },
  {
    id: 'action', label: 'Action', defaultVisible: true,
    render: (row) => {
      const action = row.action ?? '';
      const meta   = ACTION_META[action] ?? {
        label: action.replace(/_/g, ' ') || 'unknown',
        cls:   'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400',
        icon:  Activity,
      };
      const Icon = meta.icon;
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', meta.cls)}>
          <Icon className="w-3 h-3" />
          {meta.label}
        </span>
      );
    },
  },
  {
    id: 'who', label: 'Who — What', defaultVisible: true,
    render: (row) => (
      <div>
        <span className="font-medium text-gray-900 dark:text-neutral-100 text-sm">{row.user_name ?? 'System'}</span>
        {row.target_name && (
          <span className="text-gray-400 dark:text-neutral-500 text-sm">
            {' → '}
            <span className="font-medium text-gray-700 dark:text-neutral-300">{row.target_name}</span>
          </span>
        )}
      </div>
    ),
  },
  {
    id: 'details', label: 'Details', defaultVisible: true, cellClass: 'max-w-xs',
    render: (row) => (
      <div className="space-y-0.5 text-xs text-gray-500 dark:text-neutral-500">
        {row.metadata && Object.entries(row.metadata)
          .filter(([k]) => k !== 'ip')
          .map(([k, v]) => (
            <p key={k}><span className="text-gray-400 dark:text-neutral-500">{k}:</span> {String(v)}</p>
          ))}
        {row.ip_address && <p className="text-gray-400 dark:text-neutral-500 font-mono">{row.ip_address}</p>}
      </div>
    ),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function AuditLogs() {
  const { t } = useTranslation();

  type MainTab = 'logs' | 'coverage';
  const [activeTab,    setActiveTab]    = useState<MainTab>('logs');
  const [logs,         setLogs]         = useState<AuditEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [lastSync,     setLastSync]     = useState<Date | null>(null);
  const [search,       setSearch]       = useState('');
  const [sourceFilter, setSourceFilter] = useState<LogSource | 'all'>('all');
  const [aiAnalysis,   setAiAnalysis]   = useState('');
  const [analyzing,    setAnalyzing]    = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [expandedMod,  setExpandedMod]  = useState<LogSource | null>('auth');
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : 
    (JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null);

  // ── Normalise any raw DB row into AuditEntry ─────────────────────────────
  const normalise = (row: any, overrideSource?: LogSource): AuditEntry => {
    const action = row.action ?? row.event ?? '';
    const source: LogSource = overrideSource
      ?? ACTION_META[action]?.source
      ?? detectSource(action);
    return {
      id:          row.id,
      user_id:     row.user_id     ?? null,
      user_name:   row.user_name   ?? row.staff_name ?? null,
      action,
      target_id:   row.target_id   ?? null,
      target_name: row.target_name ?? null,
      metadata:    row.metadata ?? (row.details ? { details: row.details } : null),
      ip_address:  row.ip_address  ?? null,
      source,
      created_at:  row.created_at,
    };
  };

  // ── Fetch: primary audit_logs table ──────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    if (!activeMerchantId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('merchant_id', activeMerchantId)
        .order('created_at', { ascending: false })
        .limit(300);

      if (!error && data && data.length > 0) {
        setLogs(data.map(r => normalise(r)));
        setLastSync(new Date());
        return;
      }

      // Fallback — synthesise from orders
      const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('*')
        .eq('merchant_id', activeMerchantId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (oErr) throw oErr;
      setLogs((orders ?? []).map(o => normalise({
        id:          o.id,
        user_name:   o.staff_name,
        action:      o.status === 'completed' ? 'order_completed' : 'order_created',
        target_name: `Order #${o.order_number}`,
        metadata:    { total: `RM ${o.total?.toFixed(2)}`, status: o.status },
        created_at:  o.created_at,
      }, 'orders')));
      setLastSync(new Date());
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  }, [activeMerchantId]);

  // ── Full system sync — merges all source tables ───────────────────────────
  const syncAll = async () => {
    if (!activeMerchantId) {
      setLogs([]);
      return;
    }
    setSyncing(true);
    setLoading(true);
    try {
      const combined: AuditEntry[] = [];

      // 1. Primary audit_logs
      const { data: auditRows } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('merchant_id', activeMerchantId)
        .order('created_at', { ascending: false })
        .limit(200);
      (auditRows ?? []).forEach(r => combined.push(normalise(r)));

      // 2. Orders
      const { data: orderRows } = await supabase
        .from('orders')
        .select('id, order_number, status, total, staff_name, created_at')
        .eq('merchant_id', activeMerchantId)
        .order('created_at', { ascending: false })
        .limit(100);
      (orderRows ?? []).forEach(o => {
        if (combined.find(e => e.target_name === `Order #${o.order_number}`)) return;
        combined.push(normalise({
          id:          `order-${o.id}`,
          user_name:   o.staff_name,
          action:      o.status === 'completed' ? 'order_completed'
                     : o.status === 'cancelled' ? 'order_cancelled'
                     : 'order_created',
          target_name: `Order #${o.order_number}`,
          metadata:    { total: `RM ${o.total?.toFixed(2)}`, status: o.status },
          created_at:  o.created_at,
        }, 'orders'));
      });

      // 3. Menu items
      const { data: menuRows } = await supabase
        .from('menu')
        .select('id, name, created_at, updated_at, deleted_at')
        .eq('merchant_id', activeMerchantId)
        .order('updated_at', { ascending: false })
        .limit(50);
      (menuRows ?? []).forEach(m => {
        const isNew     = m.created_at === m.updated_at;
        const isDeleted = !!m.deleted_at;
        const action    = isDeleted ? 'Menu Item Deleted' : isNew ? 'Menu Item Created' : 'Menu Item Updated';
        if (combined.find(e => e.action === action && e.target_name === m.name)) return;
        combined.push(normalise({
          id:          `menu-${m.id}-${action}`,
          action,
          target_name: m.name,
          metadata:    null,
          created_at:  isDeleted ? m.deleted_at : m.updated_at,
        }, 'menu'));
      });

      // 4. Inventory
      const { data: invRows } = await supabase
        .from('inventory')
        .select('id, name, quantity, unit, updated_at, created_at')
        .eq('merchant_id', activeMerchantId)
        .order('updated_at', { ascending: false })
        .limit(50);
      (invRows ?? []).forEach(i => {
        const isNew  = i.created_at === i.updated_at;
        const action = isNew ? 'inventory_added' : 'inventory_updated';
        if (combined.find(e => e.action === action && e.target_name === i.name)) return;
        combined.push(normalise({
          id:          `inv-${i.id}-${action}`,
          action,
          target_name: i.name,
          metadata:    { quantity: `${i.quantity} ${i.unit}` },
          created_at:  i.updated_at,
        }, 'inventory'));
      });

      // 5. Schedule templates
      const { data: tplRows } = await supabase
        .from('schedule_templates')
        .select('id, name, created_at')
        .eq('merchant_id', activeMerchantId)
        .order('created_at', { ascending: false })
        .limit(30);
      (tplRows ?? []).forEach(tpl => {
        if (combined.find(e => e.target_name === tpl.name && e.source === 'schedule')) return;
        combined.push(normalise({
          id:          `sched-${tpl.id}`,
          action:      'Schedule Template Created',
          target_name: tpl.name,
          metadata:    null,
          created_at:  tpl.created_at,
        }, 'schedule'));
      });

      combined.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setLogs(combined.slice(0, 300));
      setLastSync(new Date());
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => { syncAll(); }, [activeMerchantId]);

  // ── AI Analysis ──────────────────────────────────────────────────────────
  const analyzeFraud = async () => {
    setAnalyzing(true);
    try {
      const key = (import.meta.env as any).VITE_GEMINI_API_KEY;
      if (!key) throw new Error('Missing VITE_GEMINI_API_KEY');
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a security analyst for a F&B POS system. Analyze these recent staff activity logs for suspicious behaviour, anomalies, or security concerns. Look for: unusual login times, rapid account changes, repeated failed logins, privilege escalation, frequent order cancellations, accounts being disabled or deleted frequently. Provide a concise summary with specific alerts.\n\nLogs: ${JSON.stringify(logs.slice(0, 30))}`,
      });
      setAiAnalysis(response.text || 'No anomalies detected.');
      if (activeMerchantId) {
        await supabase.from('audit_logs').insert({
          action: 'ai_audit_analysis_run',
          user_name: 'System',
          target_name: 'Audit Logs',
          metadata: { sample_size: Math.min(logs.length, 30) },
          merchant_id: activeMerchantId,
        });
      }
    } catch (err: any) {
      console.error('AI audit analysis failed:', err);
      const isQuota = err?.status === 429 || err?.statusCode === 429 ||
        String(err).includes('429') || String(err).toLowerCase().includes('quota') || String(err).toLowerCase().includes('resourceexhausted');
      setAiAnalysis(isQuota ? 'AI quota exceeded. Please try again later.' : 'Failed to analyze data. Please try again.');
      if (activeMerchantId) {
        await supabase.from('audit_logs').insert({
          action: isQuota ? 'ai_audit_analysis_quota_exceeded' : 'ai_audit_analysis_failed',
          user_name: 'System',
          target_name: 'Audit Logs',
          metadata: { error: err?.message || String(err) },
          merchant_id: activeMerchantId,
        });
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = logs.filter(log => {
    const action = log.action ?? '';
    const q      = search.toLowerCase();
    const matchSearch = !q ||
      (log.user_name   ?? '').toLowerCase().includes(q) ||
      (log.target_name ?? '').toLowerCase().includes(q) ||
      action.toLowerCase().includes(q) ||
      (log.ip_address  ?? '').includes(q);
    const matchSource = sourceFilter === 'all' || log.source === sourceFilter;
    return matchSearch && matchSource;
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    total:     logs.length,
    logins:    logs.filter(l => (l.action ?? '') === 'login').length,
    orders:    logs.filter(l => l.source === 'orders').length,
    menuEdits: logs.filter(l => l.source === 'menu').length,
    alerts:    logs.filter(l => ['user_disabled','user_deleted','order_cancelled','order_refunded'].includes(l.action ?? '')).length,
  };

  const sourceChips = [
    { id: 'all' as const,  label: `All (${logs.length})` },
    ...COVERAGE.map(m => ({
      id: m.id,
      label: `${m.label} (${logs.filter(l => l.source === m.id).length})`,
    })),
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            {t('audit.title', 'Audit Logs')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
            {t('audit.subtitle', 'Full activity history across all pages and modules.')}
          </p>
          {lastSync && (
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last synced {formatDistanceToNow(lastSync, { addSuffix: true })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={syncAll} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm">
            {syncing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</>
              : <><ArrowDownUp className="w-4 h-4" /> Sync All Sources</>}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Events',  val: stats.total,     color: 'text-gray-700 dark:text-neutral-300',    bg: 'bg-gray-100 dark:bg-neutral-800',    icon: List           },
          { label: 'Sign-ins',      val: stats.logins,    color: 'text-emerald-600', bg: 'bg-emerald-50',  icon: LogIn          },
          { label: 'Order Events',  val: stats.orders,    color: 'text-indigo-600',  bg: 'bg-indigo-50',   icon: ShoppingCart   },
          { label: 'Menu Changes',  val: stats.menuEdits, color: 'text-violet-600',  bg: 'bg-violet-50',   icon: UtensilsCrossed },
          { label: 'Alert Events',  val: stats.alerts,    color: 'text-red-600',     bg: 'bg-red-50',      icon: AlertTriangle  },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm p-4">
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mb-2', s.bg)}>
                <Icon className={cn('w-4 h-4', s.color)} />
              </div>
              <p className={cn('text-xl font-bold', s.color)}>{s.val}</p>
              <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Main card with tabs */}
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden">

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-[var(--sb-border)] px-5 flex gap-6">
          {([
            { id: 'logs',     label: 'Activity Log',     icon: List     },
            { id: 'coverage', label: 'What Gets Logged', icon: BookOpen },
          ] as const).map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex items-center gap-2 text-sm font-medium py-4 border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300')}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── LOGS TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'logs' && (
          <>
            {/* AI panel */}
            <div className="mx-5 mt-5 bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border border-red-100 overflow-hidden">
              {/* Header — always visible */}
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="p-2.5 bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-sm shrink-0">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">AI Fraud & Anomaly Detection</h3>
                  {!showAnalysis && aiAnalysis && (
                    <p className="text-xs text-red-600 font-medium mt-0.5">Analysis ready — click to view</p>
                  )}
                  {!aiAnalysis && (
                    <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
                      Scans for unusual login times, rapid account changes, frequent cancellations, and privilege escalation.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {aiAnalysis && !analyzing && (
                    <button
                      onClick={() => setShowAnalysis(p => !p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 rounded-lg text-red-700 bg-white dark:bg-[var(--sb-card)] hover:bg-red-50 transition-colors">
                      {showAnalysis ? 'Hide' : 'Show'}
                    </button>
                  )}
                  <button onClick={() => { analyzeFraud(); setShowAnalysis(true); }} disabled={analyzing || logs.length === 0}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-[var(--sb-card)] border border-red-200 rounded-xl text-xs font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm">
                    {analyzing
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…</>
                      : <><Sparkles className="w-3.5 h-3.5" /> {aiAnalysis ? 'Re-run' : 'Run AI Analysis'}</>}
                  </button>
                </div>
              </div>

              {/* Analysis result — collapsible */}
              {aiAnalysis && showAnalysis && (
                <div className="px-5 pb-5">
                  <div className="bg-white dark:bg-[var(--sb-card)]/70 rounded-xl p-4 border border-red-100 space-y-2">
                    {aiAnalysis.split('\n').map((line, i) => {
                      const trimmed = line.trim();
                      if (!trimmed || trimmed === '---') return trimmed === '---'
                        ? <hr key={i} className="border-red-100 my-1" />
                        : null;

                      if (trimmed.startsWith('### ')) {
                        const text = trimmed.replace(/^###\s+/, '').replace(/\*\*/g, '');
                        return <p key={i} className="text-sm font-bold text-gray-900 dark:text-neutral-100 mt-3 mb-1">{text}</p>;
                      }
                      if (trimmed.startsWith('#### ')) {
                        const text = trimmed.replace(/^####\s+/, '').replace(/\*\*/g, '');
                        return <p key={i} className="text-xs font-bold text-red-700 mt-2">{text}</p>;
                      }
                      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                        const text = trimmed.slice(2);
                        const parts = text.split(/\*\*(.*?)\*\*/g);
                        return (
                          <div key={i} className="flex gap-2 text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
                            <span className="text-red-400 shrink-0 mt-0.5">•</span>
                            <span>{parts.map((p, j) => j % 2 === 1
                              ? <strong key={j} className="font-semibold text-gray-900 dark:text-neutral-100">{p}</strong>
                              : p)}</span>
                          </div>
                        );
                      }
                      const parts = trimmed.split(/\*\*(.*?)\*\*/g);
                      return (
                        <p key={i} className="text-xs text-gray-700 dark:text-neutral-300 leading-relaxed">
                          {parts.map((p, j) => j % 2 === 1
                            ? <strong key={j} className="font-semibold text-gray-900 dark:text-neutral-100">{p}</strong>
                            : p)}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="p-4 mt-4 border-t border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50/50 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by user, action, target…"
                  className="pl-9 pr-4 py-2 border border-gray-200 dark:border-[var(--sb-border)] rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white dark:bg-[var(--sb-card)]" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {sourceChips.map(chip => (
                  <button key={chip.id} onClick={() => setSourceFilter(chip.id as any)}
                    className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
                      sourceFilter === chip.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-[var(--sb-border)] hover:border-indigo-300')}>
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 dark:text-neutral-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2 text-indigo-400" />
                Loading activity…
              </div>
            ) : (
              <FlexTable
                cols={AUDIT_COLS}
                rows={filtered}
                tableId="audit-logs"
              />
            )}
          </>
        )}

        {/* ── COVERAGE TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'coverage' && (
          <div className="p-5 space-y-3">

            {/* Intro */}
            <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
              <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-indigo-900">Every action below is automatically recorded.</p>
                <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
                  No manual setup required — events are captured when they fire in the app and written to the{' '}
                  <code className="bg-indigo-100 px-1 rounded font-mono">audit_logs</code> table.
                  Click <strong>Sync All Sources</strong> to also pull inferred events from orders, menu, inventory and schedule tables.
                </p>
              </div>
            </div>

            {/* Module accordion */}
            {COVERAGE.map(mod => {
              const Icon     = mod.icon;
              const isOpen   = expandedMod === mod.id;
              const modCount = logs.filter(l => l.source === mod.id).length;
              return (
                <div key={mod.id} className={cn('rounded-2xl border overflow-hidden', mod.border)}>
                  <button
                    className={cn('w-full flex items-center gap-3 px-5 py-4 text-left transition-colors', mod.bg, isOpen && `border-b ${mod.border}`)}
                    onClick={() => setExpandedMod(isOpen ? null : mod.id)}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white dark:bg-[var(--sb-card)] shadow-sm shrink-0">
                      <Icon className={cn('w-5 h-5', mod.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-bold', mod.color)}>{mod.label}</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-500">{mod.events.length} tracked events</p>
                    </div>
                    <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border shrink-0', mod.bg, mod.color, mod.border)}>
                      {modCount} in log
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); setSourceFilter(mod.id); setActiveTab('logs'); }}
                      className="text-xs font-semibold text-gray-500 dark:text-neutral-500 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-white dark:bg-[var(--sb-card)] transition-all border border-transparent hover:border-gray-200 dark:border-[var(--sb-border)] shrink-0">
                      View log →
                    </button>
                    <ChevronRight className={cn('w-4 h-4 text-gray-400 dark:text-neutral-500 transition-transform shrink-0', isOpen && 'rotate-90')} />
                  </button>

                  {isOpen && (
                    <div className="bg-white dark:bg-[var(--sb-card)]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-100 dark:border-[var(--sb-border)]">
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider w-1/5">Event</th>
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider w-1/4">Action Code</th>
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">What triggers it</th>
                            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider w-1/6">Page</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {mod.events.map((ev, i) => (
                            <tr key={ev.action} className={i % 2 === 0 ? 'bg-white dark:bg-[var(--sb-card)]' : 'bg-gray-50 dark:bg-neutral-800/50/40'}>
                              <td className="px-5 py-3">
                                <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', mod.bg, mod.color, mod.border)}>
                                  <Icon className="w-2.5 h-2.5" />
                                  {ev.label}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <code className="text-[11px] bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 px-2 py-1 rounded-lg font-mono">
                                  {ev.action}
                                </code>
                              </td>
                              <td className="px-5 py-3 text-xs text-gray-600 dark:text-neutral-400">{ev.trigger}</td>
                              <td className="px-5 py-3">
                                <span className="text-[11px] font-medium text-gray-500 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded-lg">{ev.page}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Dev tip */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Adding a new event?</strong> Call <code className="bg-amber-100 px-1 rounded font-mono">writeAudit(event, details)</code> from any page component.
                The entry is automatically tagged with the correct source module based on the action name.
                See <code className="bg-amber-100 px-1 rounded font-mono">MenuManagement.tsx</code> for usage examples.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}