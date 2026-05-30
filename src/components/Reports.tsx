/**
 * Reports — single-file bundle
 * Combines: types.ts · constants.ts · columns.tsx · useReportData.ts
 *           Primitives.tsx · FilterSidebar.tsx · ReportHeader.tsx
 *           AIInsightDrawer.tsx · SalesRevenueSection.tsx · MenuInsightsSection.tsx
 *           PaymentTransactionsSection.tsx · TableCustomerSection.tsx
 *           StaffShiftSection.tsx · InventoryStockSection.tsx · Reports.tsx
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Cell, AreaChart, Area, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, UtensilsCrossed, CreditCard, Users, Clock, Package,
  SlidersHorizontal, X, Search,
  Calendar, Download, Sparkles, RefreshCw, ChevronDown,
  Eye, CheckSquare, Square, EyeOff,
  Settings, GripVertical,
  ChevronUp, Loader2,
  Star, TrendingDown, Layers,
  Hash, TrendingUp, BarChart3, Percent, Receipt, AlertTriangle, ShoppingBag,
  Table2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/cn';
import { useSettings } from '../contexts/SettingsContext';
import { useImpersonation } from '../contexts/ImpersonationContext';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type FilterType = 'order_type' | 'payment_method' | 'category' | 'menu_item';

interface ActiveFilter {
  id: string;
  type: FilterType;
  label: string;
  value: string;
}

interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

type InsightSection =
  | 'sales_revenue'
  | 'menu_insights'
  | 'payment_transactions'
  | 'table_customer'
  | 'staff_shift'
  | 'inventory_stock'
  | 'eod_reports'
  | 'session_reports';

interface InsightConfig {
  id: InsightSection;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

interface ColDef {
  id: string;
  label: string;
  defaultVisible: boolean;
  render: (row: any, i: number, extra?: any) => React.ReactNode;
  headerClass?: string;
  cellClass?: string;
}

interface DailySalesRow {
  date: string; revenue: number; orders: number; gross: number; tax: number;
  discount: number; refunds: number; net: number; subtotal: number;
  ordersWithDiscount: number; topOrderType: string;
  byType: Record<string, number>; byTypeCount: Record<string, number>;
}

interface TableStats {
  total: number; occupied: number; available: number; occupancyRate: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

const fmt    = (n: number) => `RM ${n.toFixed(2)}`;

const colorMap: Record<string, { bg: string; text: string; border: string; badge: string; active: string }> = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700',   active: 'bg-indigo-600 text-white border-indigo-600' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700',     active: 'bg-amber-500 text-white border-amber-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', active: 'bg-emerald-600 text-white border-emerald-600' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700',       active: 'bg-blue-600 text-white border-blue-600' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-200',  badge: 'bg-purple-100 text-purple-700',   active: 'bg-purple-600 text-white border-purple-600' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700',       active: 'bg-rose-600 text-white border-rose-600' },
};

const filterTypeColors: Record<FilterType, string> = {
  order_type:     'bg-indigo-100 text-indigo-700 border-indigo-200',
  payment_method: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  category:       'bg-amber-100 text-amber-700 border-amber-200',
  menu_item:      'bg-purple-100 text-purple-700 border-purple-200',
};

const makeRange = (days: number, label: string): DateRange => {
  const to = new Date(); const from = new Date();
  from.setDate(from.getDate() - days);
  return { from, to, label };
};

const makeToday = (): DateRange => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to, label: 'Today' };
};

const DATE_PRESETS: DateRange[] = [
  makeToday(),
  makeRange(7,   'Last 7 Days'),
  makeRange(30,  'Last 30 Days'),
  makeRange(90,  'Last 3 Months'),
  makeRange(180, 'Last 6 Months'),
];

const INSIGHT_CONFIGS: InsightConfig[] = [
  { id: 'sales_revenue',        label: 'Sales & Revenue',        icon: DollarSign,      color: 'indigo',  description: 'Revenue trends, AOV, discounts, refunds' },
  { id: 'menu_insights',        label: 'Menu Insights',          icon: UtensilsCrossed, color: 'amber',   description: 'Top/worst sellers, category performance' },
  { id: 'payment_transactions', label: 'Payment & Transactions', icon: CreditCard,      color: 'emerald', description: 'Payment methods, transaction counts' },
  { id: 'table_customer',       label: 'Table & Customer',       icon: Users,           color: 'blue',    description: 'Occupancy, turnover, customer count' },
  { id: 'staff_shift',          label: 'Staff & Shift',          icon: Clock,           color: 'purple',  description: 'Sales per staff, shift performance' },
  { id: 'inventory_stock',      label: 'Inventory & Stock',      icon: Package,         color: 'rose',    description: 'Low stock, usage trends' },
  { id: 'eod_reports',          label: 'EOD Reports',            icon: Receipt,         color: 'blue',    description: 'Daily End of Day Reports (Z-Reports)' },
  { id: 'session_reports',      label: 'Session Reports',        icon: Clock,           color: 'purple',  description: 'Cashier sessions and shift summaries' },
];

// ─────────────────────────────────────────────────────────────────────────────
// COLUMNS
// ─────────────────────────────────────────────────────────────────────────────

function MiniBar({ pct, color = '#4f46e5' }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-14 bg-gray-100 dark:bg-neutral-800 rounded-full h-1.5">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-neutral-500 w-7 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

const TOTAL_SALES_COLS: ColDef[] = [
  { id: 'date',     label: 'Date',        defaultVisible: true,  render: (r) => <span className="font-medium text-gray-800 dark:text-neutral-200">{r.date}</span> },
  { id: 'revenue',  label: 'Total Sales', defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-gray-900 dark:text-neutral-100', render: (r) => fmt(r.revenue) },
  { id: 'orders',   label: 'Orders',      defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-600 dark:text-neutral-400', render: (r) => r.orders },
  { id: 'aov',      label: 'AOV',         defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.orders ? fmt(r.revenue / r.orders) : '—' },
  { id: 'discount', label: 'Discounts',   defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-rose-500', render: (r) => r.discount ? fmt(r.discount) : '—' },
  { id: 'tax',      label: 'Tax',         defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-400 dark:text-neutral-500', render: (r) => r.tax ? fmt(r.tax) : '—' },
  { id: 'net',      label: 'Net Sales',   defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-emerald-600 font-medium', render: (r) => fmt(Math.max(0, r.revenue - (r.discount || 0) - (r.tax || 0))) },
  { id: 'pct',      label: '% of Period', defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right', render: (r, _, extra) => <MiniBar pct={extra?.total ? (r.revenue / extra.total) * 100 : 0} /> },
  { id: 'dine_in',  label: 'Dine In',     defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.byType?.dine_in ? fmt(r.byType.dine_in) : '—' },
  { id: 'takeaway', label: 'Takeaway',    defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.byType?.takeaway ? fmt(r.byType.takeaway) : '—' },
  { id: 'delivery', label: 'Delivery',    defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.byType?.delivery ? fmt(r.byType.delivery) : '—' },
];

const NET_SALES_COLS: ColDef[] = [
  { id: 'date',     label: 'Date',        defaultVisible: true,  render: (r) => <span className="font-medium text-gray-800 dark:text-neutral-200">{r.date}</span> },
  { id: 'gross',    label: 'Gross Sales', defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-700 dark:text-neutral-300', render: (r) => fmt(r.gross) },
  { id: 'discount', label: 'Discounts',   defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-rose-500', render: (r) => r.discount ? `−${fmt(r.discount)}` : '—' },
  { id: 'tax',      label: 'Tax',         defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-amber-500', render: (r) => r.tax ? `−${fmt(r.tax)}` : '—' },
  { id: 'refunds',  label: 'Refunds',     defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-rose-400', render: (r) => r.refunds ? `−${fmt(r.refunds)}` : '—' },
  { id: 'net',      label: 'Net Sales',   defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-bold text-emerald-600', render: (r) => fmt(r.net) },
  { id: 'orders',   label: 'Orders',      defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.orders },
  { id: 'margin',   label: 'Net Margin',  defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right', render: (r) => r.gross ? <MiniBar pct={(r.net / r.gross) * 100} color="#10b981" /> : '—' },
];

const GROSS_SALES_COLS: ColDef[] = [
  { id: 'date',     label: 'Date',          defaultVisible: true,  render: (r) => <span className="font-medium text-gray-800 dark:text-neutral-200">{r.date}</span> },
  { id: 'gross',    label: 'Gross Sales',   defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-gray-900 dark:text-neutral-100', render: (r) => fmt(r.gross) },
  { id: 'orders',   label: 'Orders',        defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-600 dark:text-neutral-400', render: (r) => r.orders },
  { id: 'subtotal', label: 'Subtotal',      defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => fmt(r.subtotal) },
  { id: 'tax',      label: 'Tax Collected', defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-amber-500', render: (r) => fmt(r.tax) },
  { id: 'discount', label: 'Discounts',     defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-rose-500', render: (r) => fmt(r.discount) },
  { id: 'pct',      label: '% of Period',   defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right', render: (r, _, extra) => <MiniBar pct={extra?.total ? (r.gross / extra.total) * 100 : 0} color="#6366f1" /> },
  { id: 'dine_in',  label: 'Dine In',       defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.byType?.dine_in ? fmt(r.byType.dine_in) : '—' },
  { id: 'takeaway', label: 'Takeaway',      defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.byType?.takeaway ? fmt(r.byType.takeaway) : '—' },
  { id: 'delivery', label: 'Delivery',      defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.byType?.delivery ? fmt(r.byType.delivery) : '—' },
];

const AOV_COLS: ColDef[] = [
  { id: 'date',     label: 'Date',          defaultVisible: true,  render: (r) => <span className="font-medium text-gray-800 dark:text-neutral-200">{r.date}</span> },
  { id: 'aov',      label: 'AOV',           defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-gray-900 dark:text-neutral-100', render: (r) => fmt(r.aov) },
  { id: 'orders',   label: 'Orders',        defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-600 dark:text-neutral-400', render: (r) => r.orders },
  { id: 'revenue',  label: 'Revenue',       defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => fmt(r.revenue) },
  { id: 'aov_dine', label: 'AOV Dine In',   defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-400 dark:text-neutral-500', render: (r) => r.aovDineIn ? fmt(r.aovDineIn) : '—' },
  { id: 'aov_take', label: 'AOV Takeaway',  defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-400 dark:text-neutral-500', render: (r) => r.aovTakeaway ? fmt(r.aovTakeaway) : '—' },
  { id: 'aov_del',  label: 'AOV Delivery',  defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-400 dark:text-neutral-500', render: (r) => r.aovDelivery ? fmt(r.aovDelivery) : '—' },
  { id: 'vs_avg',   label: 'vs Period Avg', defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right', render: (r, _, extra) => {
    if (!extra?.avg) return '—';
    const diff = r.aov - extra.avg;
    return <span className={diff >= 0 ? 'text-emerald-600 font-medium' : 'text-rose-500 font-medium'}>{diff >= 0 ? '+' : ''}{fmt(diff)}</span>;
  }},
];

const HOURLY_COLS: ColDef[] = [
  { id: 'hour',    label: 'Hour',    defaultVisible: true,  render: (r) => <span className="font-medium text-gray-800 dark:text-neutral-200">{r.hour}</span> },
  { id: 'revenue', label: 'Revenue', defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-gray-900 dark:text-neutral-100', render: (r) => fmt(r.revenue) },
  { id: 'orders',  label: 'Orders',  defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-600 dark:text-neutral-400', render: (r) => r.orders },
  { id: 'aov',     label: 'AOV',     defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.orders ? fmt(r.revenue / r.orders) : '—' },
  { id: 'disc',    label: 'Discount',defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-rose-400', render: (r) => r.discount ? fmt(r.discount) : '—' },
  { id: 'peak',    label: 'Peak',    defaultVisible: true,  headerClass: 'text-center', cellClass: 'text-center', render: (r, _, extra) => {
    const isPeak = extra?.peakHour === r.hour;
    return isPeak ? <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700 font-medium">Peak</span> : null;
  }},
];

const REFUND_COLS: ColDef[] = [
  { id: 'date',      label: 'Date',       defaultVisible: true,  render: (r) => <span className="font-medium text-gray-800 dark:text-neutral-200">{r.date}</span> },
  { id: 'orderNum',  label: 'Order #',    defaultVisible: true,  render: (r) => <span className="text-xs font-mono text-gray-600 dark:text-neutral-400">{r.order_number || r.id?.slice(0, 8)}</span> },
  { id: 'amount',    label: 'Amount',     defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-rose-600', render: (r) => fmt(r.total || 0) },
  { id: 'type',      label: 'Type',       defaultVisible: true,  render: (r) => {
    const isVoided   = r.status === 'voided' || r.status === 'cancelled';
    const isRefunded = r.status === 'refunded';
    const label = isRefunded ? 'Refunded' : 'Voided';
    const cls   = isRefunded ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700';
    return <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', cls)}>{label}</span>;
  }},
  { id: 'orderType', label: 'Order Type', defaultVisible: false, render: (r) => <span className="text-xs text-gray-500 dark:text-neutral-500 capitalize">{r.order_type || '—'}</span> },
  { id: 'payment',   label: 'Payment',    defaultVisible: false, render: (r) => <span className="text-xs text-gray-500 dark:text-neutral-500 capitalize">{r.payment_method || '—'}</span> },
  { id: 'discount',  label: 'Discount',   defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-400 dark:text-neutral-500', render: (r) => r.discount ? fmt(r.discount) : '—' },
  { id: 'notes',     label: 'Notes',      defaultVisible: false, render: (r) => <span className="text-xs text-gray-400 dark:text-neutral-500">{r.notes || '—'}</span> },
];

const DISCOUNT_COLS: ColDef[] = [
  { id: 'date',      label: 'Date',            defaultVisible: true,  render: (r) => <span className="font-medium text-gray-800 dark:text-neutral-200">{r.date}</span> },
  { id: 'discount',  label: 'Discount',        defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-rose-600', render: (r) => fmt(r.discount) },
  { id: 'orders',    label: 'Orders w/ Disc',  defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-600 dark:text-neutral-400', render: (r) => r.ordersWithDiscount },
  { id: 'revenue',   label: 'Revenue',         defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => fmt(r.revenue) },
  { id: 'discPct',   label: 'Disc % of Sales', defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right', render: (r) => r.revenue ? <MiniBar pct={(r.discount / r.revenue) * 100} color="#ef4444" /> : '—' },
  { id: 'avgDisc',   label: 'Avg Discount',    defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-400 dark:text-neutral-500', render: (r) => r.ordersWithDiscount ? fmt(r.discount / r.ordersWithDiscount) : '—' },
  { id: 'orderType', label: 'Order Type',      defaultVisible: false, render: (r) => <span className="text-xs text-gray-500 dark:text-neutral-500 capitalize">{r.topOrderType || '—'}</span> },
];

const TRANSACTION_COLS: ColDef[] = [
  { id: 'date',      label: 'Date',         defaultVisible: true,  render: (r) => <span className="text-xs text-gray-500 dark:text-neutral-400">{r.date}</span> },
  { id: 'time',      label: 'Time',         defaultVisible: true,  render: (r) => <span className="font-mono text-xs text-gray-600 dark:text-neutral-400">{r.time}</span> },
  { id: 'orderNum',  label: 'Order #',      defaultVisible: true,  render: (r) => <span className="font-mono text-xs font-medium text-gray-800 dark:text-neutral-200">{r.order_number || r.id?.slice(0, 8)}</span> },
  { id: 'total',     label: 'Total',        defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-gray-900 dark:text-neutral-100', render: (r) => fmt(r.total || 0) },
  { id: 'subtotal',  label: 'Subtotal',     defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => fmt(r.subtotal || 0) },
  { id: 'tax',       label: 'Tax',          defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-amber-500', render: (r) => r.tax ? fmt(r.tax) : '—' },
  { id: 'discount',  label: 'Discount',     defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-rose-500', render: (r) => r.discount ? fmt(r.discount) : '—' },
  { id: 'orderType', label: 'Order Type',   defaultVisible: true,  render: (r) => <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize',
    r.order_type === 'dine_in' ? 'bg-blue-100 text-blue-700' : r.order_type === 'takeaway' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700')}>{r.order_type || '—'}</span> },
  { id: 'payment',   label: 'Payment',      defaultVisible: true,  render: (r) => <span className="text-xs text-gray-500 dark:text-neutral-500 capitalize">{r.payment_method || '—'}</span> },
  { id: 'status',    label: 'Status',       defaultVisible: true,  render: (r) => {
    const s = r.status;
    let label: string;
    let cls: string;
    if (s === 'completed')               { label = 'Completed'; cls = 'bg-emerald-100 text-emerald-700'; }
    else if (s === 'refunded')           { label = 'Refunded';  cls = 'bg-rose-100 text-rose-700'; }
    else if (s === 'voided' || s === 'cancelled') { label = 'Voided';    cls = 'bg-orange-100 text-orange-700'; }
    else                                 { label = s;           cls = 'bg-gray-100 text-gray-600'; }
    return <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', cls)}>{label}</span>;
  }},
];

const TOP_ITEMS_COLS: ColDef[] = [
  { id: 'rank',     label: '#',           defaultVisible: true,  headerClass: 'w-8', render: (_, i) => <span className="text-gray-400 dark:text-neutral-500 font-medium">{i + 1}</span> },
  { id: 'name',     label: 'Item',        defaultVisible: true,  render: (r) => <span className="font-medium text-gray-800 dark:text-neutral-200">{r.name}</span> },
  { id: 'category', label: 'Category',    defaultVisible: false, render: (r) => <span className="text-gray-500 dark:text-neutral-500 text-xs">{r.category || '—'}</span> },
  { id: 'qty',      label: 'Qty Sold',    defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-600 dark:text-neutral-400', render: (r) => r.qty },
  { id: 'revenue',  label: 'Revenue',     defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-gray-900 dark:text-neutral-100', render: (r) => fmt(r.revenue) },
  { id: 'avg',      label: 'Avg Price',   defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.qty ? fmt(r.revenue / r.qty) : '—' },
  { id: 'discount', label: 'Disc Applied',defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-rose-400', render: (r) => r.discount ? fmt(r.discount) : '—' },
  { id: 'orders',   label: 'In # Orders', defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-400 dark:text-neutral-500', render: (r) => r.orderCount || '—' },
  { id: 'pct',      label: '% of Total',  defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right', render: (r, _, extra) => <MiniBar pct={extra?.totalRev ? (r.revenue / extra.totalRev) * 100 : 0} /> },
  { id: 'staff',    label: 'Top Staff',   defaultVisible: false, render: (r) => <span className="text-xs text-gray-400 dark:text-neutral-500">{r.topStaff || '—'}</span> },
];

const CATEGORY_COLS: ColDef[] = [
  { id: 'name',    label: 'Category',   defaultVisible: true,  render: (r, i) => (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
      <span className="font-medium text-gray-800 dark:text-neutral-200">{r.name}</span>
    </div>
  )},
  { id: 'revenue', label: 'Revenue',    defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-gray-900 dark:text-neutral-100', render: (r) => fmt(r.value) },
  { id: 'orders',  label: 'Items Sold', defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-600 dark:text-neutral-400', render: (r) => r.orders || '—' },
  { id: 'aov',     label: 'Avg/Order',  defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.orders ? fmt(r.value / r.orders) : '—' },
  { id: 'discount',label: 'Discounts',  defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-rose-400', render: (r) => r.discount ? fmt(r.discount) : '—' },
  { id: 'pct',     label: 'Share',      defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right', render: (r, i) => <MiniBar pct={r.pct} color={COLORS[i % COLORS.length]} /> },
];

const PAYMENT_COLS: ColDef[] = [
  { id: 'name',    label: 'Method',      defaultVisible: true,  render: (r, i) => (
    <div className="flex items-center gap-2 capitalize">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
      {r.name}
    </div>
  )},
  { id: 'revenue', label: 'Revenue',     defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-gray-900 dark:text-neutral-100', render: (r) => fmt(r.value) },
  { id: 'count',   label: 'Transactions',defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-600 dark:text-neutral-400', render: (r) => r.count || '—' },
  { id: 'avg',     label: 'Avg Amount',  defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.count ? fmt(r.value / r.count) : '—' },
  { id: 'discount',label: 'Discounts',   defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-rose-400', render: (r) => r.discount ? fmt(r.discount) : '—' },
  { id: 'refunds', label: 'Refunds',     defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-rose-300', render: (r) => r.refundCount ? `${r.refundCount} (${fmt(r.refundAmount || 0)})` : '—' },
  { id: 'pct',     label: 'Share',       defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right', render: (r, i, extra) => <MiniBar pct={extra?.total ? (r.value / extra.total) * 100 : 0} color={COLORS[i % COLORS.length]} /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: useReportData
// ─────────────────────────────────────────────────────────────────────────────

function getStoredMerchantId(): string | null {
  try {
    const stored = localStorage.getItem('snackbot_user');
    if (!stored) return null;
    return JSON.parse(stored)?.merchant_id ?? null;
  } catch { return null; }
}

async function resolveMerchantId(): Promise<string | null> {
  const fromStorage = getStoredMerchantId();
  if (fromStorage) return fromStorage;
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const { data } = await supabase.from('users').select('merchant_id').eq('auth_id', authUser.id).single();
    if (data?.merchant_id) {
      try {
        const raw = localStorage.getItem('snackbot_user');
        if (raw) { const p = JSON.parse(raw); p.merchant_id = data.merchant_id; localStorage.setItem('snackbot_user', JSON.stringify(p)); }
      } catch { /* non-critical */ }
      return data.merchant_id;
    }
  } catch { /* non-critical */ }
  return null;
}

function useReportData(dateRange: DateRange, activeFilters: ActiveFilter[], overrideMerchantId?: string | null) {
  const [loading, setLoading]           = useState(true);
  const [lastSynced, setLastSynced]     = useState<Date | null>(null);
  const [orderTypeOptions, setOrderTypeOptions] = useState<string[]>([]);
  const [paymentOptions, setPaymentOptions]     = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions]   = useState<string[]>([]);
  const [menuItemOptions, setMenuItemOptions]   = useState<{ id: string; name: string }[]>([]);
  const [totalSales, setTotalSales]       = useState(0);
  const [grossSales, setGrossSales]       = useState(0);
  const [netSales, setNetSales]           = useState(0);
  const [totalOrders, setTotalOrders]     = useState(0);
  const [aov, setAov]                     = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [totalTax, setTotalTax]           = useState(0);
  const [refundCount, setRefundCount]     = useState(0);
  const [refundAmount, setRefundAmount]   = useState(0);
  const [dailySales, setDailySales]       = useState<any[]>([]);
  const [hourlySales, setHourlySales]     = useState<any[]>([]);
  const [totalSalesRows, setTotalSalesRows] = useState<any[]>([]);
  const [netSalesRows, setNetSalesRows]     = useState<any[]>([]);
  const [grossSalesRows, setGrossSalesRows] = useState<any[]>([]);
  const [aovRows, setAovRows]               = useState<any[]>([]);
  const [hourlyRows, setHourlyRows]         = useState<any[]>([]);
  const [refundRows, setRefundRows]         = useState<any[]>([]);
  const [discountRows, setDiscountRows]     = useState<any[]>([]);
  const [transactionRows, setTransactionRows] = useState<any[]>([]);
  const [topItems, setTopItems]         = useState<any[]>([]);
  const [worstItems, setWorstItems]     = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [paymentData, setPaymentData]   = useState<any[]>([]);
  const [orderTypeData, setOrderTypeData] = useState<any[]>([]);
  const [tableStats, setTableStats]     = useState<TableStats>({ total: 0, occupied: 0, available: 0, occupancyRate: 0 });
  const [staffData, setStaffData]       = useState<any[]>([]);
  const [shiftData, setShiftData]       = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);

  // New EOD & Session States
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [eodReports, setEodReports] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    const merchantId = overrideMerchantId ?? await resolveMerchantId();
    if (!merchantId) { console.error('useReportData: no merchant_id'); setLoading(false); return; }

    try {
      // 1. Fetch branches for the merchant
      const { data: branchList } = await supabase
        .from('branches')
        .select('id, name')
        .eq('merchant_id', merchantId);
      const fetchedBranches = branchList || [];
      setBranches(fetchedBranches);

      let currentBranchId = selectedBranchId;
      if (!currentBranchId && fetchedBranches.length > 0) {
        currentBranchId = fetchedBranches[0].id;
        setSelectedBranchId(currentBranchId);
      }

      // 2. Fetch orders filtered by merchant and branch
      let orderQuery = supabase
        .from('orders')
        .select('id, order_number, total, subtotal, tax, discount, payment_method, order_type, status, created_at, waiter_id, cashier_id, table_id, notes, customer_id, branch_id')
        .eq('merchant_id', merchantId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: true });

      if (currentBranchId) {
        orderQuery = orderQuery.eq('branch_id', currentBranchId);
      }

      const typeValues = activeFilters.filter(f => f.type === 'order_type').map(f => f.value);
      if (typeValues.length > 0) orderQuery = orderQuery.in('order_type', typeValues);
      const payValues = activeFilters.filter(f => f.type === 'payment_method').map(f => f.value);
      if (payValues.length > 0) orderQuery = orderQuery.in('payment_method', payValues);

      const { data: allOrders } = await orderQuery;
      const orders          = allOrders || [];
      const completedOrders = orders.filter((o: any) => o.status === 'completed');
      const refundedOrders  = orders.filter((o: any) => ['cancelled', 'voided', 'refunded'].includes(o.status));

      if (orderTypeOptions.length === 0 || paymentOptions.length === 0) {
        let optsQuery = supabase.from('orders').select('order_type, payment_method').eq('merchant_id', merchantId).eq('status', 'completed');
        if (currentBranchId) optsQuery = optsQuery.eq('branch_id', currentBranchId);
        const { data: opts } = await optsQuery;
        setOrderTypeOptions([...new Set((opts || []).map((o: any) => o.order_type).filter(Boolean))]);
        setPaymentOptions([...new Set((opts || []).map((o: any) => o.payment_method).filter(Boolean))]);
      }

      const { data: menuList } = await supabase.from('menu').select('id, name, category_id, base_price, menu_categories(name)').eq('merchant_id', merchantId);
      if (menuItemOptions.length === 0 && menuList) setMenuItemOptions(menuList.map((m: any) => ({ id: m.id, name: m.name })));

      const { data: catList } = await supabase.from('menu_categories').select('id, name').eq('merchant_id', merchantId);
      if (categoryOptions.length === 0 && catList) setCategoryOptions(catList.map((c: any) => c.name));

      const categoryValues = activeFilters.filter(f => f.type === 'category').map(f => f.value);
      const menuItemValues = activeFilters.filter(f => f.type === 'menu_item').map(f => f.value);
      const hasItemFilters = categoryValues.length > 0 || menuItemValues.length > 0;

      let safeOrders = [...completedOrders];
      const allOrderIds = safeOrders.map((o: any) => o.id);
      let orderItems: any[] = [];

      if (allOrderIds.length > 0) {
        let itemQ = supabase.from('order_items').select('menu_id, quantity, subtotal, order_id').in('order_id', allOrderIds);
        if (menuItemValues.length > 0) itemQ = itemQ.in('menu_id', menuItemValues);
        const { data: items } = await itemQ;
        orderItems = items || [];
        if (categoryValues.length > 0) {
          orderItems = orderItems.filter(oi => {
            const m = menuList?.find((x: any) => x.id === oi.menu_id);
            return categoryValues.includes((m as any)?.menu_categories?.name || '');
          });
        }
        if (hasItemFilters) {
          const qualIds = new Set(orderItems.map(oi => oi.order_id));
          safeOrders = safeOrders.filter((o: any) => qualIds.has(o.id));
        }
      }

      const gross = safeOrders.reduce((s: number, o: any) => s + Number(o.subtotal || 0), 0);
      const disc  = safeOrders.reduce((s: number, o: any) => s + Number(o.discount || 0), 0);
      const tax   = safeOrders.reduce((s: number, o: any) => s + Number(o.tax || 0), 0);
      const total = safeOrders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      const net   = total - disc - tax;
      setGrossSales(gross); setTotalDiscount(disc); setTotalTax(tax);
      setTotalSales(total); setNetSales(net < 0 ? 0 : net);
      setTotalOrders(safeOrders.length);
      setAov(safeOrders.length ? total / safeOrders.length : 0);
      setRefundCount(refundedOrders.length);
      setRefundAmount(refundedOrders.reduce((s: number, o: any) => s + Number(o.total || 0), 0));

      type DayBucket = {
        date: string; revenue: number; orders: number; gross: number; tax: number;
        discount: number; refunds: number; net: number; subtotal: number;
        ordersWithDiscount: number; topOrderType: string;
        byType: Record<string, number>; byTypeCount: Record<string, number>;
      };
      type HourBucket = { hour: string; revenue: number; orders: number; discount: number };

      const dailyMap: Record<string, DayBucket>  = {};
      const hourlyMap: Record<number, HourBucket> = {};

      safeOrders.forEach((o: any) => {
        const day  = new Date(o.created_at).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
        const hour = new Date(o.created_at).getHours();
        const rev  = Number(o.total    || 0);
        const dis  = Number(o.discount || 0);
        const tx   = Number(o.tax      || 0);
        const sub  = Number(o.subtotal || 0);
        const ot   = o.order_type || 'unknown';

        if (!dailyMap[day]) dailyMap[day] = {
          date: day, revenue: 0, orders: 0, gross: 0, tax: 0, discount: 0,
          refunds: 0, net: 0, subtotal: 0, ordersWithDiscount: 0, topOrderType: '',
          byType: {}, byTypeCount: {},
        };
        dailyMap[day].revenue  += rev; dailyMap[day].gross    += sub;
        dailyMap[day].tax      += tx;  dailyMap[day].discount += dis;
        dailyMap[day].subtotal += sub; dailyMap[day].orders   += 1;
        if (dis > 0) dailyMap[day].ordersWithDiscount += 1;
        dailyMap[day].byType[ot]      = (dailyMap[day].byType[ot]      || 0) + rev;
        dailyMap[day].byTypeCount[ot] = (dailyMap[day].byTypeCount[ot] || 0) + 1;

        if (!hourlyMap[hour]) hourlyMap[hour] = { hour: `${String(hour).padStart(2, '0')}:00`, revenue: 0, orders: 0, discount: 0 };
        hourlyMap[hour].revenue  += rev;
        hourlyMap[hour].orders   += 1;
        hourlyMap[hour].discount += dis;
      });

      refundedOrders.forEach((o: any) => {
        const day = new Date(o.created_at).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
        if (dailyMap[day]) dailyMap[day].refunds += Number(o.total || 0);
      });

      const dailyArr = Object.values(dailyMap).map(d => ({
        ...d,
        net: Math.max(0, d.revenue - d.discount - d.tax - d.refunds),
        topOrderType: Object.entries(d.byTypeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      }));

      setDailySales(dailyArr); setTotalSalesRows(dailyArr);
      setNetSalesRows(dailyArr.map(d => ({ date: d.date, gross: d.revenue, discount: d.discount, tax: d.tax, refunds: d.refunds, net: d.net, orders: d.orders })));
      setGrossSalesRows(dailyArr.map(d => ({ date: d.date, gross: d.revenue, orders: d.orders, subtotal: d.subtotal, tax: d.tax, discount: d.discount, byType: d.byType })));
      setAovRows(dailyArr.map(d => ({
        date: d.date,
        aov:         d.orders ? d.revenue / d.orders : 0,
        orders:      d.orders, revenue: d.revenue,
        aovDineIn:   d.byTypeCount['dine_in']  ? d.byType['dine_in']  / d.byTypeCount['dine_in']  : 0,
        aovTakeaway: d.byTypeCount['takeaway'] ? d.byType['takeaway'] / d.byTypeCount['takeaway'] : 0,
        aovDelivery: d.byTypeCount['delivery'] ? d.byType['delivery'] / d.byTypeCount['delivery'] : 0,
      })));

      const hourlyArr = Array.from({ length: 24 }, (_, h) =>
        hourlyMap[h] || { hour: `${String(h).padStart(2, '0')}:00`, revenue: 0, orders: 0, discount: 0 }
      );
      setHourlySales(hourlyArr); setHourlyRows(hourlyArr);

      setRefundRows(refundedOrders.map((o: any) => ({
        ...o, date: new Date(o.created_at).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
      })));
      setDiscountRows(
        dailyArr.filter(d => d.discount > 0 || d.orders > 0).map(d => ({
          date: d.date, discount: d.discount, ordersWithDiscount: d.ordersWithDiscount,
          revenue: d.revenue, topOrderType: d.topOrderType,
        }))
      );

      // Transactions (individual orders)
      const txRows = [...safeOrders, ...refundedOrders]
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((o: any) => ({
          ...o,
          time: new Date(o.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
          date: new Date(o.created_at).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
        }));
      setTransactionRows(txRows);

      // Payment
      const payMap: Record<string, any> = {};
      safeOrders.forEach((o: any) => {
        const m = o.payment_method || 'Unknown';
        if (!payMap[m]) payMap[m] = { name: m, value: 0, count: 0, discount: 0, refundCount: 0, refundAmount: 0 };
        payMap[m].value += Number(o.total || 0); payMap[m].count += 1; payMap[m].discount += Number(o.discount || 0);
      });
      refundedOrders.forEach((o: any) => {
        const m = o.payment_method || 'Unknown';
        if (payMap[m]) { payMap[m].refundCount += 1; payMap[m].refundAmount += Number(o.total || 0); }
      });
      setPaymentData(Object.values(payMap).map(p => ({ ...p, value: +p.value.toFixed(2) })));

      const typeMap: Record<string, number> = {};
      safeOrders.forEach((o: any) => { const t = o.order_type || 'Unknown'; typeMap[t] = (typeMap[t] || 0) + 1; });
      setOrderTypeData(Object.entries(typeMap).map(([name, value]) => ({ name, value })));

      // Menu items
      const filteredIds = safeOrders.map((o: any) => o.id);
      if (filteredIds.length > 0) {
        let relevantItems = orderItems;
        if (!hasItemFilters) {
          const { data: allItems } = await supabase.from('order_items').select('menu_id, quantity, subtotal, order_id').in('order_id', filteredIds);
          relevantItems = allItems || [];
        }
        const itemMap: Record<string, any> = {};
        relevantItems.forEach((oi: any) => {
          const m       = menuList?.find((x: any) => x.id === oi.menu_id) as any;
          const name    = m?.name || 'Unknown';
          const cat     = m?.menu_categories?.name || 'Uncategorized';
          const ord     = safeOrders.find((o: any) => o.id === oi.order_id) as any;
          const itemDisc = ord ? Number(ord.discount || 0) / Math.max(1, relevantItems.filter((x: any) => x.order_id === oi.order_id).length) : 0;
          if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0, category: cat, orderCount: 0, discount: 0 };
          itemMap[name].qty += oi.quantity; itemMap[name].revenue += Number(oi.subtotal || 0);
          itemMap[name].orderCount += 1; itemMap[name].discount += itemDisc;
        });
        const sorted = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
        setTopItems(sorted.slice(0, 10)); setWorstItems([...sorted].reverse().slice(0, 10));

        const catMap: Record<string, any> = {};
        relevantItems.forEach((oi: any) => {
          const m   = menuList?.find((x: any) => x.id === oi.menu_id) as any;
          const cat = m?.menu_categories?.name || 'Uncategorized';
          const ord = safeOrders.find((o: any) => o.id === oi.order_id) as any;
          const itemDisc = ord ? Number(ord.discount || 0) / Math.max(1, relevantItems.filter((x: any) => x.order_id === oi.order_id).length) : 0;
          if (!catMap[cat]) catMap[cat] = { name: cat, value: 0, orders: 0, pct: 0, discount: 0 };
          catMap[cat].value += Number(oi.subtotal || 0); catMap[cat].orders += 1; catMap[cat].discount += itemDisc;
        });
        const catTotal = Object.values(catMap).reduce((s, v) => s + v.value, 0);
        setCategoryData(Object.values(catMap).sort((a, b) => b.value - a.value).map(c => ({ ...c, value: +c.value.toFixed(2), pct: catTotal ? Math.round((c.value / catTotal) * 100) : 0 })));
      } else {
        setTopItems([]); setWorstItems([]); setCategoryData([]);
      }

      // Staff
      const { data: users } = await supabase.from('users').select('id, name, role').eq('merchant_id', merchantId);
      const staffMap: Record<string, any> = {};
      safeOrders.forEach((o: any) => {
        const uid  = o.waiter_id || o.cashier_id; if (!uid) return;
        const u    = (users || []).find((x: any) => x.id === uid) as any;
        const name = u?.name || uid.slice(0, 8);
        if (!staffMap[uid]) staffMap[uid] = { name, revenue: 0, orders: 0 };
        staffMap[uid].revenue += Number(o.total || 0); staffMap[uid].orders += 1;
      });
      setStaffData(Object.values(staffMap).sort((a, b) => b.revenue - a.revenue));

      const shiftMap: Record<string, any> = {};
      safeOrders.forEach((o: any) => {
        const h     = new Date(o.created_at).getHours();
        const shift = h >= 6 && h < 14 ? 'Morning (6–14)' : h >= 14 && h < 22 ? 'Afternoon (14–22)' : 'Night (22–6)';
        if (!shiftMap[shift]) shiftMap[shift] = { name: shift, revenue: 0, orders: 0 };
        shiftMap[shift].revenue += Number(o.total || 0); shiftMap[shift].orders += 1;
      });
      setShiftData(Object.values(shiftMap));

      // Tables
      let tablesQuery = supabase.from('tables').select('id, status').eq('merchant_id', merchantId);
      if (currentBranchId) tablesQuery = tablesQuery.eq('branch_id', currentBranchId);
      const { data: tables } = await tablesQuery;
      const tArr = tables || []; const occupied = tArr.filter((t: any) => t.status === 'occupied').length;
      setTableStats({ total: tArr.length, occupied, available: tArr.length - occupied, occupancyRate: tArr.length ? Math.round((occupied / tArr.length) * 100) : 0 });

      // Inventory
      let invQuery = supabase.from('inventory').select('id, name, quantity, min_stock_level, unit, cost_per_unit, supplier').eq('merchant_id', merchantId);
      if (currentBranchId) invQuery = invQuery.eq('branch_id', currentBranchId);
      const { data: inv } = await invQuery;
      const invArr = inv || [];
      setLowStockItems(invArr.filter((i: any) => Number(i.quantity) <= Number(i.min_stock_level)).sort((a: any, b: any) => Number(a.quantity) - Number(b.quantity)));
      setInventoryData(invArr.sort((a: any, b: any) => Number(a.quantity) - Number(b.quantity)).slice(0, 15));

      // EOD Reports & Sessions Fetch
      if (currentBranchId) {
        const fromDateStr = dateRange.from.toISOString().split('T')[0];
        const toDateStr = dateRange.to.toISOString().split('T')[0];
        const { data: eodData } = await supabase.rpc('get_eod_reports', {
          p_merchant_id: merchantId,
          p_branch_id: currentBranchId,
          p_from_date: fromDateStr,
          p_to_date: toDateStr,
        });
        setEodReports(eodData || []);

        const { data: shiftData } = await supabase
          .from('shifts')
          .select('*, users(name)')
          .eq('merchant_id', merchantId)
          .eq('branch_id', currentBranchId)
          .gte('clock_in', dateRange.from.toISOString())
          .lte('clock_in', dateRange.to.toISOString())
          .order('clock_in', { ascending: false });
        setShifts(shiftData || []);
      } else {
        setEodReports([]);
        setShifts([]);
      }

      setLastSynced(new Date());
    } catch (err) {
      console.error('Report error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, activeFilters, overrideMerchantId, selectedBranchId]);

  useEffect(() => { fetchReportData(); }, [fetchReportData]);
  useEffect(() => {
    const ch = supabase.channel('reports-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchReportData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchReportData]);

  return {
    loading, lastSynced, fetchReportData,
    orderTypeOptions, paymentOptions, categoryOptions, menuItemOptions,
    totalSales, grossSales, netSales, totalOrders, aov,
    totalDiscount, totalTax, refundCount, refundAmount,
    dailySales, hourlySales, totalSalesRows, netSalesRows, grossSalesRows,
    aovRows, hourlyRows, refundRows, discountRows, transactionRows,
    topItems, worstItems, categoryData, paymentData, orderTypeData,
    tableStats, staffData, shiftData, lowStockItems, inventoryData,
    branches, selectedBranchId, setSelectedBranchId, eodReports, shifts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, trend, icon: Icon, color, loading }: {
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

function Section({ title, icon: Icon, color, children, defaultOpen = true, badge }: {
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

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
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

function SubTableHeader({ gradient, icon: Icon, title, subtitle, badge }: {
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

function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: count }).map((_, i) => <div key={i} className="h-8 bg-gray-100 dark:bg-neutral-800 animate-pulse rounded" />)}
    </div>
  );
}

const PAGE_SIZE = 10;

function FlexTable({ cols, rows, extra, tableId, noPagination, onRowClick }: { cols: ColDef[]; rows: any[]; extra?: any; tableId: string; noPagination?: boolean; onRowClick?: (row: any) => void }) {
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

  // Reset to first page when rows change
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
      {/* Toolbar — relative so the modal anchors to this row */}
      <div className="px-5 py-2 border-b border-gray-100 dark:border-[var(--sb-border)] flex items-center justify-between gap-2 bg-white dark:bg-[var(--sb-card)]">
        {!noPagination && rows.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-neutral-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
        )}
        {/* Anchor wrapper — relative + z-index so modal floats above card content */}
        <div ref={wrapperRef} className={cn('relative', noPagination || rows.length === 0 ? 'ml-auto' : '')}>
          <button onClick={() => setShowSettings(p => !p)}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg font-medium transition-colors',
              showSettings ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-[var(--sb-border)] hover:border-gray-300 dark:border-neutral-600')}>
            <Settings className="w-3.5 h-3.5" />Columns
          </button>

          {/* Modal — absolute from button wrapper, always visible above card */}
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

      {/* Pagination */}
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
// FILTER SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────

function FilterSidebar({ activeFilters, orderTypeOptions, paymentOptions, categoryOptions, menuItemOptions, onToggleFilter, onRemoveFilter, onClearAll, isActive }: {
  activeFilters: ActiveFilter[]; orderTypeOptions: string[]; paymentOptions: string[];
  categoryOptions: string[]; menuItemOptions: { id: string; name: string }[];
  onToggleFilter: (type: FilterType, value: string, label: string) => void;
  onRemoveFilter: (id: string) => void; onClearAll: () => void;
  isActive: (type: FilterType, value: string) => boolean;
}) {
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
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50/60 flex items-center justify-between">
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

// ─────────────────────────────────────────────────────────────────────────────
// REPORT HEADER
// ─────────────────────────────────────────────────────────────────────────────

function ReportHeader({
  lastSynced, loading, dateRange, onDateRangeChange, visibleInsights, onToggleInsight,
  showAiDrawer, onToggleAiDrawer, onRefresh, onExportCSV, showFilter, onToggleFilter,
  branches, selectedBranchId, onBranchChange
}: {
  lastSynced: Date | null; loading: boolean; dateRange: DateRange;
  onDateRangeChange: (r: DateRange) => void; visibleInsights: InsightSection[];
  onToggleInsight: (id: InsightSection) => void; showAiDrawer: boolean;
  onToggleAiDrawer: () => void; onRefresh: () => void; onExportCSV: () => void;
  showFilter: boolean; onToggleFilter: () => void;
  branches: { id: string; name: string }[];
  selectedBranchId: string;
  onBranchChange: (id: string) => void;
}) {
  const { themeColors } = useSettings();
  const [showDatePicker, setShowDatePicker]         = useState(false);
  const [customFrom, setCustomFrom]                 = useState('');
  const [customTo, setCustomTo]                     = useState('');
  const [showInsightSelector, setShowInsightSelector] = useState(false);
  const insightSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (insightSelectorRef.current && !insightSelectorRef.current.contains(e.target as Node)) setShowInsightSelector(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    onDateRangeChange({ from: new Date(customFrom), to: new Date(customTo), label: `${customFrom} → ${customTo}` });
    setShowDatePicker(false);
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          Business Reports
          {loading && <RefreshCw className={cn('w-4 h-4 animate-spin', themeColors.text)} />}
        </h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1 flex items-center gap-2">
          {lastSynced && <span className="text-xs text-gray-400 dark:text-neutral-500">Last synced {lastSynced.toLocaleTimeString()}</span>}
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-600 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live Data
          </span>
        </p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {/* Filter toggle */}
        <button onClick={onToggleFilter}
          className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
            showFilter
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              : 'bg-white dark:bg-[var(--sb-card)] text-gray-700 dark:text-neutral-300 border-gray-300 dark:border-neutral-600 hover:bg-gray-50')}>
          <SlidersHorizontal className="w-4 h-4" />
          {showFilter ? 'Hide Filters' : 'Show Filters'}
        </button>

        {/* AI Insights */}
        <button onClick={onToggleAiDrawer}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm',
            showAiDrawer
              ? `${themeColors.bg} text-white ring-4 ${themeColors.bgLight.replace('bg-', 'ring-')}`
              : `bg-white dark:bg-[var(--sb-card)] ${themeColors.text} border ${themeColors.border} hover:${themeColors.bgLight}`)}>
          <Sparkles className={cn('w-4 h-4', showAiDrawer ? 'text-white' : themeColors.text)} />
          AI Insights
          {showAiDrawer && <X className="w-3.5 h-3.5 ml-1 opacity-60" />}
        </button>

        {/* Insight Visibility Selector */}
        <div className="relative" ref={insightSelectorRef}>
          <button onClick={() => setShowInsightSelector(p => !p)}
            className={cn('flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors',
              showInsightSelector ? `${themeColors.bg} text-white border-transparent` : 'bg-white dark:bg-[var(--sb-card)] text-gray-700 dark:text-neutral-300 border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:bg-neutral-800/50')}>
            <Eye className="w-4 h-4" /> Insights
            <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full leading-none',
              showInsightSelector ? `bg-white dark:bg-[var(--sb-card)] ${themeColors.text}` : `${themeColors.bgLight} ${themeColors.textLight}`)}>
              {visibleInsights.length}/{INSIGHT_CONFIGS.length}
            </span>
          </button>
          {showInsightSelector && (
            <div className="absolute right-0 mt-1 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl shadow-xl z-20 w-72 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50">
                <p className="text-xs font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wide">Visible Insight Sections</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Select which sections appear on the report</p>
              </div>
              <div className="p-2 space-y-1">
                {INSIGHT_CONFIGS.map(cfg => {
                  const active = visibleInsights.includes(cfg.id);
                  const c = colorMap[cfg.color]; const Icon = cfg.icon;
                  return (
                    <button key={cfg.id} onClick={() => onToggleInsight(cfg.id)}
                      className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                        active ? cn(c.bg, c.border, 'border') : 'hover:bg-gray-50 dark:bg-neutral-800/50 border border-transparent')}>
                      <div className={cn('p-1.5 rounded-md', active ? 'bg-white dark:bg-[var(--sb-card)] shadow-sm' : 'bg-gray-100 dark:bg-neutral-800')}>
                        <Icon className={cn('w-3.5 h-3.5', active ? c.text : 'text-gray-400 dark:text-neutral-500')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-semibold', active ? 'text-gray-900 dark:text-neutral-100' : 'text-gray-500 dark:text-neutral-500')}>{cfg.label}</p>
                        <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">{cfg.description}</p>
                      </div>
                      {active ? <CheckSquare className={cn('w-4 h-4 shrink-0', c.text)} /> : <Square className="w-4 h-4 shrink-0 text-gray-300" />}
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-2 border-t border-gray-100 dark:border-[var(--sb-border)] flex gap-2">
                <button onClick={() => INSIGHT_CONFIGS.forEach(c => !visibleInsights.includes(c.id) && onToggleInsight(c.id))}
                  className={cn('flex-1 text-xs font-medium py-1', themeColors.text, 'hover:opacity-80')}>Show all</button>
                <button onClick={() => INSIGHT_CONFIGS.forEach(c => visibleInsights.includes(c.id) && onToggleInsight(c.id))}
                  className="flex-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 font-medium py-1">Hide all</button>
              </div>
            </div>
          )}
        </div>

        {/* Refresh */}
        <button onClick={onRefresh} disabled={loading}
          className="p-2 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg text-gray-500 dark:text-neutral-500 hover:bg-gray-50 dark:bg-neutral-800/50 disabled:opacity-50" title="Refresh">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>

        {/* Branch Selector */}
        {branches.length > 0 && (
          <div className="relative">
            <select
              value={selectedBranchId}
              onChange={e => onBranchChange(e.target.value)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id} className="bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date picker */}
        <div className="relative">
          <button onClick={() => setShowDatePicker(p => !p)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:bg-neutral-800/50">
            <Calendar className="w-4 h-4" />{dateRange.label}<ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
          </button>
          {showDatePicker && (
            <div className="absolute right-0 mt-1 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl shadow-xl z-20 w-72 overflow-hidden">
              {DATE_PRESETS.map(r => (
                <button key={r.label} onClick={() => { onDateRangeChange(r); setShowDatePicker(false); }}
                  className={cn('block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-100 dark:border-[var(--sb-border)] last:border-0',
                    dateRange.label === r.label ? `${themeColors.text} font-semibold ${themeColors.bgLight}` : 'text-gray-700 dark:text-neutral-300')}>
                  {r.label}
                </button>
              ))}
              <div className="p-3 border-t border-gray-100 dark:border-[var(--sb-border)] space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Custom Range</p>
                <div className="flex gap-2">
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className={cn('flex-1 px-2 py-1.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-xs focus:outline-none focus:ring-2', `focus:ring-${themeColors.bg.split('-')[1]}-500`)} />
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    className={cn('flex-1 px-2 py-1.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-xs focus:outline-none focus:ring-2', `focus:ring-${themeColors.bg.split('-')[1]}-500`)} />
                </div>
                <button onClick={applyCustomRange} className={cn('w-full py-1.5 text-white text-xs font-semibold rounded-lg hover:opacity-90', themeColors.bg)}>Apply</button>
              </div>
            </div>
          )}
        </div>

        {/* Export */}
        <button onClick={onExportCSV}
          className={cn('flex items-center gap-2 px-3 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm', themeColors.bg)}>
          <Download className="w-4 h-4" />Export CSV
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN RENDERER (lightweight, no dependencies)
// ─────────────────────────────────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  const inlineFormat = (line: string): React.ReactNode => {
    // Bold **text** or __text__, inline code `code`
    const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (/^\*\*(.+)\*\*$/.test(part) || /^__(.+)__$/.test(part))
        return <strong key={idx} className="font-semibold text-gray-900 dark:text-neutral-100">{part.replace(/^\*\*|\*\*$|^__|__$/g, '')}</strong>;
      if (/^`(.+)`$/.test(part))
        return <code key={idx} className="px-1 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
      return part;
    });
  };

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines — add spacing
    if (line.trim() === '' || line.trim() === '---') { nodes.push(<div key={i} className="h-2" />); i++; continue; }

    // H3 ###
    if (/^###\s+/.test(line)) {
      nodes.push(<h3 key={i} className="text-sm font-bold text-indigo-700 dark:text-indigo-400 mt-3 mb-1">{inlineFormat(line.replace(/^###\s+/, ''))}</h3>);
      i++; continue;
    }
    // H4 ####
    if (/^####\s+/.test(line)) {
      nodes.push(<h4 key={i} className="text-xs font-bold text-gray-800 dark:text-neutral-200 mt-2 mb-0.5">{inlineFormat(line.replace(/^####\s+/, ''))}</h4>);
      i++; continue;
    }
    // H2 ##
    if (/^##\s+/.test(line)) {
      nodes.push(<h2 key={i} className="text-base font-bold text-gray-900 dark:text-neutral-100 mt-3 mb-1">{inlineFormat(line.replace(/^##\s+/, ''))}</h2>);
      i++; continue;
    }
    // H1 #
    if (/^#\s+/.test(line)) {
      nodes.push(<h1 key={i} className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-3 mb-1">{inlineFormat(line.replace(/^#\s+/, ''))}</h1>);
      i++; continue;
    }
    // Bullet * or -
    if (/^[\*\-]\s+/.test(line)) {
      nodes.push(
        <div key={i} className="flex gap-2 items-start text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
          <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
          <span>{inlineFormat(line.replace(/^[\*\-]\s+/, ''))}</span>
        </div>
      );
      i++; continue;
    }
    // Numbered list 1.
    if (/^\d+\.\s+/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      nodes.push(
        <div key={i} className="flex gap-2 items-start text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
          <span className="text-indigo-500 font-semibold shrink-0 w-4">{num}.</span>
          <span>{inlineFormat(line.replace(/^\d+\.\s+/, ''))}</span>
        </div>
      );
      i++; continue;
    }
    // Normal paragraph
    nodes.push(<p key={i} className="text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">{inlineFormat(line)}</p>);
    i++;
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI INSIGHT DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function AIInsightDrawer({ show, onClose, dateRange, activeFilters, loading, totalSales, netSales, grossSales, totalOrders, aov, totalDiscount, refundCount, topItems, categoryData, paymentData, staffData }: {
  show: boolean; onClose: () => void; dateRange: DateRange; activeFilters: ActiveFilter[]; loading: boolean;
  totalSales: number; netSales: number; grossSales: number; totalOrders: number; aov: number;
  totalDiscount: number; refundCount: number; topItems: any[]; categoryData: any[]; paymentData: any[]; staffData: any[];
}) {
  const [aiInsight, setAiInsight]       = useState('');
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiUserPrompt, setAiUserPrompt] = useState('');
  const [aiError, setAiError]           = useState(false);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  const generateInsight = async () => {
    setAiLoading(true); setAiError(false); setAiErrorMessage(null); setAiInsight('');
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');

      const ctx = {
        period:        dateRange.label,
        totalSales:    totalSales.toFixed(2),
        netSales:      netSales.toFixed(2),
        grossSales:    grossSales.toFixed(2),
        totalOrders,
        aov:           aov.toFixed(2),
        totalDiscount: totalDiscount.toFixed(2),
        refundCount,
        topItems:      topItems.slice(0, 5),
        categoryData,
        paymentData,
        staffData:     staffData.slice(0, 5),
      };

      const prompt = `You are a restaurant business analyst. Analyze this POS data for ${ctx.period}.
Important: This is a Malaysian restaurant. Always use RM (Ringgit Malaysia) as the currency symbol, never use $ or USD.
${aiUserPrompt
  ? `The user specifically wants to know: "${aiUserPrompt}"\nFocus your analysis on answering this question, then add any critical insights.`
  : 'Give a concise 3-sentence performance summary and 3 specific actionable recommendations.'}
Be direct and data-driven.

Data: ${JSON.stringify(ctx)}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errMsg  = errBody?.error?.message || `HTTP ${res.status}`;
        throw new Error(res.status === 429 ? 'AI quota exceeded. Try again later.' : errMsg);
      }

      const data = await res.json();
      const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      // Strip markdown fences if model wraps response
      const text = raw.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
      setAiInsight(text || 'No insight generated.');

    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      setAiError(true);
      setAiErrorMessage(msg);
      setAiInsight(msg);
    } finally {
      setAiLoading(false);
    }
  };

  if (!show) return null;
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-xl border border-indigo-100 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-sm shrink-0"><Sparkles className="w-5 h-5 text-indigo-600" /></div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">AI Sales Insights</h3>
            <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2">
            {activeFilters.length > 0 ? `Filtered: ${activeFilters.map(f => f.label).join(', ')} · ` : ''}{dateRange.label}
          </p>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1">
              What would you like to know? <span className="font-normal text-gray-400 dark:text-neutral-500">(optional)</span>
            </label>
            <textarea value={aiUserPrompt} onChange={e => setAiUserPrompt(e.target.value)}
              placeholder="e.g. Why did sales drop on Tuesday? Which items should I promote? How can I improve AOV?"
              rows={2}
              className="w-full px-3 py-2 text-xs border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-[var(--sb-card)] placeholder-gray-400 resize-none" />
          </div>
          {aiInsight
            ? <div className={cn(aiError ? 'text-red-600' : '', 'mb-3 space-y-1')}>
                {aiError ? <p className="text-sm text-red-600">{aiInsight}</p> : renderMarkdown(aiInsight)}
              </div>
            : <p className="text-gray-500 dark:text-neutral-500 text-sm mb-3">Generate AI-powered insights based on your current report data.</p>}
          {aiErrorMessage && <p className="text-xs text-red-500 mt-1">{aiErrorMessage}</p>}
          <button onClick={generateInsight} disabled={aiLoading || loading}
            className="mt-3 flex items-center px-4 py-2 bg-white dark:bg-[var(--sb-card)] border border-indigo-200 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-50">
            {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {aiLoading ? 'Analyzing...' : aiInsight ? 'Regenerate' : 'Generate Insights'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION RECEIPT MODAL
// ─────────────────────────────────────────────────────────────────────────────

function TransactionReceiptModal({ order, onClose }: { order: any; onClose: () => void }) {
  const [items, setItems]         = useState<any[]>([]);
  const [business, setBusiness]   = useState<any>(null);
  const [branch, setBranch]       = useState<any>(null);
  const [orderRaw, setOrderRaw]   = useState<any>(null);
  const [tableName, setTableName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [payment, setPayment]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!order?.id) return;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const merchantId = order.merchant_id;

        // 1. Business info (store header)
        const { data: biz } = await supabase
          .from('business')
          .select('name, address, contact_number, receipt_header, receipt_footer, logo_url, sst_number, ssm_number')
          .eq('id', merchantId)
          .single();
        setBusiness(biz || null);

        // 2. Fetch raw/full order to ensure we have branch_id etc.
        const { data: rawOrd } = await supabase
          .from('orders')
          .select('*')
          .eq('id', order.id)
          .single();
        setOrderRaw(rawOrd || null);

        // 3. Fetch branch details
        const branchId = order.branch_id || rawOrd?.branch_id;
        if (branchId) {
          const { data: br } = await supabase
            .from('branches')
            .select('name, address, phone')
            .eq('id', branchId)
            .maybeSingle();
          setBranch(br || null);
        } else {
          setBranch(null);
        }

        // 4. Order items
        const { data: rawItems, error: itemErr } = await supabase
          .from('order_items')
          .select('id, menu_id, variant_id, quantity, unit_price, subtotal, notes, status, modifier_note')
          .eq('order_id', order.id);
        if (itemErr) throw new Error(itemErr.message);

        // 5. Menu names
        const menuIds = [...new Set((rawItems || []).map((i: any) => i.menu_id).filter(Boolean))];
        let menuMap: Record<string, string> = {};
        if (menuIds.length > 0) {
          const { data: menus } = await supabase.from('menu').select('id, name').in('id', menuIds);
          (menus || []).forEach((m: any) => { menuMap[m.id] = m.name; });
        }

        // 6. Variant names
        const variantIds = [...new Set((rawItems || []).map((i: any) => i.variant_id).filter(Boolean))];
        let variantMap: Record<string, string> = {};
        if (variantIds.length > 0) {
          const { data: variants } = await supabase.from('menu_variants').select('id, name').in('id', variantIds);
          (variants || []).forEach((v: any) => { variantMap[v.id] = v.name; });
        }

        setItems((rawItems || []).map((i: any) => ({
          ...i,
          menuName:    menuMap[i.menu_id]      || 'Unknown item',
          variantName: variantMap[i.variant_id] || null,
        })));

        // 7. Table name
        const tableId = order.table_id || rawOrd?.table_id;
        if (tableId) {
          const { data: tbl } = await supabase.from('tables').select('table_number').eq('id', tableId).single();
          setTableName(tbl?.table_number ? `Table ${tbl.table_number}` : '');
        } else {
          setTableName('');
        }

        // 8. Staff name (waiter or cashier)
        const staffId = rawOrd?.waiter_id || rawOrd?.cashier_id || order.waiter_id || order.cashier_id;
        if (staffId) {
          const { data: user } = await supabase.from('users').select('name').eq('id', staffId).maybeSingle();
          setStaffName(user?.name || '');
        } else {
          setStaffName('');
        }

        // 9. Customer name
        const customerId = rawOrd?.customer_id || order.customer_id;
        if (customerId) {
          const { data: cust } = await supabase.from('customers').select('name').eq('id', customerId).maybeSingle();
          setCustomerName(cust?.name || '');
        } else {
          setCustomerName('');
        }

        // 10. Payment details
        const { data: payments } = await supabase
          .from('payments')
          .select('method, amount, amount_tendered, change_amount, reference_no, status')
          .eq('order_id', order.id)
          .order('created_at', { ascending: false })
          .limit(1);
        setPayment(payments?.[0] || null);

      } catch (e: any) {
        setError(e.message || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [order?.id]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const subtotal      = Number(order.subtotal || 0);
  const discount      = Number(order.discount || 0);
  const serviceCharge = 0; // service_charge column does not exist in DB
  const tax           = Number(order.tax      || 0);
  const total         = Number(order.total    || 0);
  const isVoided      = order.status === 'voided' || order.status === 'cancelled';
  const isRefunded    = order.status === 'refunded';

  const amountTendered = payment?.amount_tendered != null ? Number(payment.amount_tendered) : null;
  const change         = payment?.change_amount != null ? Number(payment.change_amount) : null;
  const payMethod      = payment?.method || order.payment_method || '';

  const orderTypeLabel = (type: string) => {
    switch (type) {
      case 'dine_in': return 'Dine-in';
      case 'takeaway': return 'Takeaway';
      case 'delivery': return 'Delivery';
      default: return type ? type.replace(/_/g, ' ') : '';
    }
  };

  const methodDisplayName = (code: string) => {
    if (!code) return '—';
    switch (code.toLowerCase()) {
      case 'cash': return 'Cash';
      case 'card': return 'Card';
      case 'ewallet':
      case 'e_wallet': return 'E-Wallet';
      case 'qr': return 'QR Pay';
      case 'alipay':
      case 'alipay+': return 'Alipay+';
      case 'duitnow': return 'DuitNow';
      default: return code;
    }
  };

  const dottedLine = (
    <div className="flex my-3 select-none">
      {Array.from({ length: 36 }).map((_, idx) => (
        <div key={idx} className="flex-1 h-[1px] bg-gray-300 dark:bg-neutral-700 mx-[1px]" />
      ))}
    </div>
  );

  const renderRow = (label: string, value: string, bold = false, valueColor?: string) => (
    <div className={cn("flex justify-between items-start py-0.5 text-xs font-mono", bold && "font-bold")}>
      <span className="text-gray-500 dark:text-neutral-400">{label}</span>
      <span className={cn("text-gray-800 dark:text-neutral-200 text-right ml-8 capitalize font-medium", valueColor)}>{value || '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative bg-white dark:bg-neutral-900 text-gray-800 dark:text-neutral-100 rounded-2xl shadow-2xl w-full max-w-[420px] max-h-[780px] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-white dark:bg-neutral-900 shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-4.5 h-4.5 text-indigo-500" />
            <span className="font-bold text-gray-900 dark:text-white text-sm">Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            {isVoided && (
              <span className="bg-red-100 text-red-700 font-extrabold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                VOIDED
              </span>
            )}
            {isRefunded && (
              <span className="bg-amber-100 text-amber-700 font-extrabold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                REFUNDED
              </span>
            )}
            <button onClick={onClose} className="p-1 rounded-full bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
              <X className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto px-7 py-5 bg-gray-50 dark:bg-neutral-950">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs text-gray-400 dark:text-neutral-500">Loading receipt details...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-rose-500 font-mono text-xs">{error}</div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
              
              {/* ① HEADER — Receipt Title & Branch Details */}
              <div className="text-center">
                <h4 className="text-sm font-extrabold tracking-widest font-mono text-gray-900 dark:text-white">RECEIPT</h4>
                {dottedLine}
                <div className="mt-2">
                  <h5 className="text-sm font-bold tracking-wider uppercase text-gray-900 dark:text-white">
                    {branch?.name ? branch.name : (business?.name || 'Snackbot')}
                  </h5>
                  {(branch?.address || business?.address) && (
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-1 whitespace-pre-wrap leading-relaxed">
                      {branch?.address || business?.address}
                    </p>
                  )}
                  {(branch?.phone || business?.phone) && (
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-0.5">
                      Tel: {branch?.phone || business?.phone}
                    </p>
                  )}
                  {(business?.ssm_number || business?.sst_number) && (
                    <div className="text-[10px] text-gray-400 dark:text-neutral-500 mt-1.5 space-y-0.5 font-mono">
                      {business?.ssm_number && <p>SSM: {business.ssm_number}</p>}
                      {business?.sst_number && <p>SST ID: {business.sst_number}</p>}
                    </div>
                  )}
                  {business?.receipt_header && (
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-2 italic leading-relaxed">
                      {business.receipt_header}
                    </p>
                  )}
                </div>
              </div>

              {dottedLine}

              {/* ② TRANSACTION METADATA */}
              <div className="space-y-0.5">
                {renderRow('Receipt No.', order.order_number || order.id?.slice(0, 8).toUpperCase(), true)}
                {renderRow('Date', new Date(order.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }))}
                {renderRow('Time', new Date(order.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true }))}
                {renderRow('Order Type', orderTypeLabel(order.order_type))}
                {tableName && renderRow('Table', tableName)}
                {(() => {
                  const pax = Number(orderRaw?.pax || orderRaw?.guest_count || 0);
                  return pax > 0 ? renderRow('Pax', String(pax)) : null;
                })()}
                {staffName && renderRow('Staff', staffName)}
                {customerName && renderRow('Customer', customerName)}
              </div>

              {dottedLine}

              {/* ③ ITEMIZED ORDER */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-3 font-mono">
                  {items.map((item, i) => {
                    const isRefundedItem = item.status === 'refunded' || item.status === 'cancelled' || isVoided;
                    const lineTotal = Number(item.subtotal || (Number(item.unit_price || 0) * Number(item.quantity || 1)));
                    const displayName = item.variantName ? `${item.menuName} (${item.variantName})` : item.menuName;
                    
                    return (
                      <div key={i} className="text-xs">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-2 flex-1 min-w-0">
                            <span className="text-gray-400 dark:text-neutral-500 shrink-0 w-6">{item.quantity}×</span>
                            <span className={cn('font-medium text-gray-800 dark:text-neutral-200', isRefundedItem && 'line-through text-gray-400 dark:text-neutral-500')}>
                              {displayName}
                            </span>
                          </div>
                          <span className={cn('font-semibold shrink-0 ml-4 text-gray-900 dark:text-white', isRefundedItem && 'line-through text-gray-400 dark:text-neutral-500')}>
                            RM {lineTotal.toFixed(2)}
                          </span>
                        </div>
                        {item.quantity > 1 && (
                          <div className="text-[10px] text-gray-400 dark:text-neutral-500 pl-6 mt-0.5">
                            @ RM {Number(item.unit_price || 0).toFixed(2)} each
                          </div>
                        )}
                        {item.modifier_note && (
                          <div className="text-[10px] text-gray-400 dark:text-neutral-500 pl-6 mt-0.5">
                            + {item.modifier_note}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-[10px] text-gray-400 dark:text-neutral-500 pl-6 mt-0.5 italic">
                            Note: {item.notes}
                          </div>
                        )}
                        {isRefundedItem && (
                          <div className="text-[10px] text-red-500 pl-6 mt-1 flex items-center gap-1 font-semibold">
                            <AlertTriangle className="w-3 h-3 shrink-0" /> {isVoided ? 'Voided' : 'Refunded / Cancelled'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {dottedLine}

              {/* ④ FINANCIAL SUMMARY */}
              <div className="space-y-1">
                {renderRow('Subtotal', `RM ${subtotal.toFixed(2)}`)}
                {discount > 0 && (
                  <div className="flex justify-between py-0.5 text-xs font-mono">
                    <span className="text-gray-500 dark:text-neutral-400">Discount</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">- RM {discount.toFixed(2)}</span>
                  </div>
                )}
                {serviceCharge > 0 && renderRow('Service Charge (10%)', `RM ${serviceCharge.toFixed(2)}`)}
                {tax > 0 && renderRow('Service Tax (6%)', `RM ${tax.toFixed(2)}`)}
                
                <div className="flex justify-between items-baseline mt-3 pt-3 border-t border-gray-200 dark:border-neutral-800">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">GRAND TOTAL</span>
                  <span className={cn('text-base font-extrabold text-gray-900 dark:text-white',
                    (isVoided || isRefunded) && 'text-red-500 dark:text-red-400 line-through'
                  )}>
                    RM {total.toFixed(2)}
                  </span>
                </div>
              </div>

              {dottedLine}

              {/* ⑤ PAYMENT DETAILS */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Payment</p>
                <div className="space-y-0.5">
                  {renderRow('Method', methodDisplayName(payMethod))}
                  {amountTendered != null && renderRow('Tendered', `RM ${amountTendered.toFixed(2)}`)}
                  {change != null && change >= 0 && renderRow('Change', `RM ${change.toFixed(2)}`, true)}
                  <div className="flex justify-between py-0.5 text-xs font-mono">
                    <span className="text-gray-500 dark:text-neutral-400">Status</span>
                    <span className={cn('font-bold',
                      isVoided || isRefunded ? 'text-red-500 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'
                    )}>
                      {isVoided ? 'VOIDED' : isRefunded ? 'REFUNDED' : 'PAID'}
                    </span>
                  </div>
                </div>
              </div>

              {dottedLine}

              {/* ⑥ FOOTER */}
              <div className="text-center text-[11px] text-gray-500 dark:text-neutral-400 space-y-2 mt-2">
                {business?.receipt_footer ? (
                  <p className="italic whitespace-pre-wrap">{business.receipt_footer}</p>
                ) : (
                  <>
                    <p className="font-bold text-gray-900 dark:text-white">Thank you for dining with us!</p>
                    <p>We hope to see you again soon.</p>
                  </>
                )}

                {business?.wifi_password && (
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500 flex items-center justify-center gap-1 mt-2 font-mono">
                    <Clock className="w-3.5 h-3.5 inline text-gray-400" /> Wi-Fi: {business.wifi_password}
                  </p>
                )}

                {(business?.instagram || business?.facebook) && (
                  <div className="flex justify-center gap-3 text-[10px] text-gray-400 dark:text-neutral-500 mt-1 font-mono">
                    {business?.instagram && <span>IG: @{business.instagram}</span>}
                    {business?.facebook && <span>FB: {business.facebook}</span>}
                  </div>
                )}

                <p className="text-[9px] text-gray-400 dark:text-neutral-500 pt-3 font-mono">
                  Generated {new Date().toLocaleString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                </p>
              </div>

            </div>
          )}
        </div>

        {/* Dialog Close Button Bar */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-neutral-800 flex bg-white dark:bg-neutral-900 shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            Close
          </button>
        </div>      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

function SalesRevenueSection({ loading, totalSales, grossSales, netSales, totalOrders, aov, totalDiscount, totalTax, refundCount, refundAmount, dailySales, hourlySales, totalSalesRows, netSalesRows, grossSalesRows, aovRows, hourlyRows, refundRows, discountRows, transactionRows }: {
  loading: boolean; totalSales: number; grossSales: number; netSales: number; totalOrders: number; aov: number;
  totalDiscount: number; totalTax: number; refundCount: number; refundAmount: number;
  dailySales: any[]; hourlySales: any[]; totalSalesRows: any[]; netSalesRows: any[];
  grossSalesRows: any[]; aovRows: any[]; hourlyRows: any[]; refundRows: any[]; discountRows: any[]; transactionRows: any[];
}) {
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const maxRev   = Math.max(...hourlyRows.map((r: any) => r.revenue));
  const peakHour = hourlyRows.find((r: any) => r.revenue === maxRev && maxRev > 0)?.hour;

  return (
    <Section title="Sales & Revenue" icon={DollarSign} color="indigo"
      badge={!loading && totalSales > 0 ? (
        <div className="flex gap-2">
          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">↑ 12% vs last period</span>
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">Peak: {peakHour}:00</span>
        </div>
      ) : undefined}>

      <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-gray-100 dark:border-[var(--sb-border)]">
        <StatCard label="Total Sales"     value={fmt(totalSales)}     icon={DollarSign}    color="indigo"  loading={loading} sub={`${totalOrders} orders`} trend="+12.5%" />
        <StatCard label="Gross Sales"     value={fmt(grossSales)}     icon={BarChart3}     color="blue"    loading={loading} sub="Before deductions" />
        <StatCard label="Net Sales"       value={fmt(netSales)}       icon={TrendingUp}    color="emerald" loading={loading} sub="After tax & discount" trend="+8.2%" />
        <StatCard label="Avg Order Value" value={fmt(aov)}            icon={Percent}       color="amber"   loading={loading} sub="Revenue ÷ orders" />
        <StatCard label="Total Discount"  value={fmt(totalDiscount)}  icon={Receipt}       color="rose"    loading={loading} />
        <StatCard label="Total Tax"       value={fmt(totalTax)}       icon={Hash}          color="purple"  loading={loading} />
        <StatCard label="Refunds/Voids"   value={String(refundCount)} icon={AlertTriangle} color="rose"    loading={loading} sub={fmt(refundAmount)} />
        <StatCard label="Total Orders"    value={String(totalOrders)} icon={ShoppingBag}   color="indigo"  loading={loading} />
      </div>

      {/* Total Sales Daily */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-indigo-600 to-indigo-500" icon={DollarSign} title="Total Sales – Daily Breakdown" subtitle="Sum of all completed orders per day" />
        <div className="px-5 pb-3 pt-3 bg-white dark:bg-[var(--sb-card)]">
          {loading ? <div className="h-40 bg-gray-50 dark:bg-neutral-800/50 animate-pulse rounded-lg" /> : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailySales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={v => `RM${v}`} />
                  <Tooltip formatter={(v: any) => [`RM ${Number(v).toFixed(2)}`, 'Revenue']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        {loading ? <SkeletonRows /> : <FlexTable cols={TOTAL_SALES_COLS} rows={totalSalesRows} extra={{ total: totalSales }} tableId="total-sales" />}
      </div>

      {/* Net Sales */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-emerald-600 to-emerald-500" icon={TrendingUp} title="Net Sales – After Discounts, Refunds & Tax" subtitle="Gross − Discounts − Tax − Refunds" />
        {loading ? <SkeletonRows /> : <FlexTable cols={NET_SALES_COLS} rows={netSalesRows} tableId="net-sales" />}
      </div>

      {/* Gross Sales */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-blue-600 to-blue-500" icon={BarChart3} title="Gross Sales – Before Deductions" subtitle="Raw subtotal before tax, discounts, refunds" />
        {loading ? <SkeletonRows /> : <FlexTable cols={GROSS_SALES_COLS} rows={grossSalesRows} extra={{ total: grossSales }} tableId="gross-sales" />}
      </div>

      {/* AOV */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-amber-500 to-amber-400" icon={Percent} title="Average Order Value (AOV)" subtitle="Revenue ÷ number of orders" />
        {loading ? <SkeletonRows /> : <FlexTable cols={AOV_COLS} rows={aovRows} extra={{ avg: aov }} tableId="aov" />}
      </div>

      {/* Hourly */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-violet-600 to-violet-500" icon={Clock} title="Sales by Hour – Peak Period Analysis" subtitle="Peak hour highlighted in amber" />
        {loading ? <div className="h-40 bg-gray-50 dark:bg-neutral-800/50 animate-pulse rounded-lg mx-5 mt-3 mb-3" /> : (
          <div className="px-5 pb-3 pt-3 bg-white dark:bg-[var(--sb-card)]">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlySales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={v => `RM${v}`} />
                  <Tooltip formatter={(v: any) => [`RM ${Number(v).toFixed(2)}`, 'Revenue']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }} />
                  <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                    {hourlyRows.map((r: any, i: number) => <Cell key={i} fill={r.revenue === maxRev && maxRev > 0 ? '#f59e0b' : '#7c3aed'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {loading ? <SkeletonRows count={6} /> : <FlexTable cols={HOURLY_COLS} rows={hourlyRows} extra={{ total: totalSales, peakHour }} tableId="hourly" noPagination />}
      </div>

      {/* Refunds */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-rose-600 to-rose-500" icon={AlertTriangle} title="Refunds & Voids" subtitle="Cancelled / voided orders in period"
          badge={refundRows.length > 0 ? <span className="text-xs bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">{refundRows.length}</span> : undefined} />
        {loading ? <SkeletonRows count={3} /> : refundRows.length === 0
          ? <p className="px-5 py-4 text-sm text-emerald-600 font-medium">✓ No refunds or voids in this period</p>
          : <FlexTable cols={REFUND_COLS} rows={refundRows} tableId="refunds" onRowClick={setSelectedTx} />}
      </div>

      {/* Discounts */}
      <div className="mx-5 mb-5 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-orange-500 to-orange-400" icon={Receipt} title="Discounts Given" subtitle="Total discount applied per day" />
        {loading ? <SkeletonRows /> : <FlexTable cols={DISCOUNT_COLS} rows={discountRows} tableId="discounts" />}
        {!loading && discountRows.length > 0 && (
          <div className="px-5 py-3 bg-orange-50 border-t border-orange-100 flex flex-wrap gap-6 text-xs">
            <span className="text-gray-600 dark:text-neutral-400">Total Discounts: <strong className="text-orange-700">{fmt(totalDiscount)}</strong></span>
            <span className="text-gray-600 dark:text-neutral-400">% of Total Sales: <strong className="text-orange-700">{totalSales ? ((totalDiscount / totalSales) * 100).toFixed(1) : 0}%</strong></span>
            <span className="text-gray-600 dark:text-neutral-400">Avg Discount/Order: <strong className="text-orange-700">{totalOrders ? fmt(totalDiscount / totalOrders) : '—'}</strong></span>
          </div>
        )}
      </div>

      {/* Sales by Transaction */}
      <div className="mx-5 mb-5 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-teal-600 to-teal-500" icon={Receipt} title="Sales by Transaction" subtitle="Click a row to view receipt"
          badge={transactionRows.length > 0 ? <span className="text-xs bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">{transactionRows.length}</span> : undefined} />
        {loading ? <SkeletonRows count={5} /> : transactionRows.length === 0
          ? <p className="px-5 py-4 text-sm text-gray-400 dark:text-neutral-500">No transactions in this period</p>
          : <FlexTable cols={TRANSACTION_COLS} rows={transactionRows} tableId="transactions" onRowClick={setSelectedTx} />}
      </div>

      {/* Receipt modal */}
      {selectedTx && <TransactionReceiptModal order={selectedTx} onClose={() => setSelectedTx(null)} />}
    </Section>
  );
}

function MenuInsightsSection({ loading, topItems, worstItems, categoryData }: {
  loading: boolean; topItems: any[]; worstItems: any[]; categoryData: any[];
}) {
  const topTotal = topItems.reduce((s, i) => s + i.revenue, 0);
  return (
    <Section title="Menu Insights" icon={UtensilsCrossed} color="amber">
      <div className="border-b border-gray-100 dark:border-[var(--sb-border)]">
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" /><span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Top-Selling Items</span>
        </div>
        {loading ? <SkeletonRows /> : <FlexTable cols={TOP_ITEMS_COLS} rows={topItems} extra={{ totalRev: topTotal }} tableId="top-items" />}
      </div>
      <div className="border-b border-gray-100 dark:border-[var(--sb-border)]">
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-rose-500" /><span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Worst-Selling Items</span>
        </div>
        {loading ? <SkeletonRows count={3} /> : <FlexTable cols={TOP_ITEMS_COLS} rows={worstItems} extra={{ totalRev: topTotal }} tableId="worst-items" />}
      </div>
      <div>
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-500" /><span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Category Performance</span>
        </div>
        {loading ? <SkeletonRows count={3} /> : <FlexTable cols={CATEGORY_COLS} rows={categoryData} tableId="category" />}
      </div>
    </Section>
  );
}

function PaymentTransactionsSection({ loading, totalOrders, aov, paymentData }: {
  loading: boolean; totalOrders: number; aov: number; paymentData: any[];
}) {
  const payTotal = paymentData.reduce((s, p) => s + p.value, 0);
  return (
    <Section title="Payment & Transactions" icon={CreditCard} color="emerald">
      <div className="p-5 grid grid-cols-3 gap-3 border-b border-gray-100 dark:border-[var(--sb-border)]">
        <StatCard label="Total Transactions" value={String(totalOrders)}         icon={Hash}       color="emerald" loading={loading} />
        <StatCard label="Avg Payment"         value={fmt(aov)}                   icon={TrendingUp} color="emerald" loading={loading} />
        <StatCard label="Payment Methods"     value={String(paymentData.length)} icon={CreditCard} color="emerald" loading={loading} />
      </div>
      <div className="p-5 flex gap-6 flex-wrap">
        {!loading && paymentData.length > 0 && (
          <div className="w-40 h-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [`RM ${Number(v).toFixed(2)}`]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          {paymentData.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-gray-600 dark:text-neutral-400 capitalize flex-1">{p.name}</span>
              <span className="font-semibold text-gray-800 dark:text-neutral-200">{fmt(p.value)}</span>
              <span className="text-gray-400 dark:text-neutral-500">{p.count} txn</span>
            </div>
          ))}
        </div>
      </div>
      <FlexTable cols={PAYMENT_COLS} rows={paymentData} extra={{ total: payTotal }} tableId="payment" />
    </Section>
  );
}

function TableCustomerSection({ loading, tableStats, totalOrders }: {
  loading: boolean; tableStats: TableStats; totalOrders: number;
}) {
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

function StaffShiftSection({ loading, staffData, shiftData }: {
  loading: boolean; staffData: any[]; shiftData: any[];
}) {
  return (
    <Section title="Staff & Shift" icon={Clock} color="purple">
      <div className="divide-y divide-gray-100">
        <div>
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" /><span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Sales per Staff</span>
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
            <Clock className="w-4 h-4 text-purple-500" /><span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Shift Performance</span>
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

function InventoryStockSection({ loading, lowStockItems, inventoryData }: {
  loading: boolean; lowStockItems: any[]; inventoryData: any[];
}) {
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

interface EodReportReceiptModalProps {
  eod: any;
  onClose: () => void;
}

function EodReportReceiptModal({ eod, onClose }: EodReportReceiptModalProps) {
  const d = (val: any) => Number(val || 0);
  const s = (val: any) => String(val || '');

  const grossSales = d(eod.gross_sales);
  const discount = d(eod.discount);
  const tax = d(eod.tax);
  const grandTotal = d(eod.grand_total);
  const cashSales = d(eod.cash_sales);
  const cardSales = d(eod.card_sales);
  const ewalletSales = d(eod.ewallet_sales);
  const qrSales = d(eod.qr_sales);
  const completedOrds = d(eod.completed_orders);
  const voidedOrds = d(eod.voided_orders);
  const voidedAmount = d(eod.voided_amount);
  const openingCash = d(eod.opening_cash);
  const closingCash = d(eod.closing_cash);
  const expectedCash = d(eod.expected_cash);
  const cashVariance = d(eod.cash_variance);
  const printedBy = s(eod.printed_by);

  const netSales = grossSales - discount;
  const avgBasket = completedOrds > 0 ? grandTotal / completedOrds : 0;
  const totalTendered = cashSales + cardSales + ewalletSales + qrSales;
  const variance = totalTendered - grandTotal;

  const reportDateStr = eod.report_date ? new Date(eod.report_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const generatedAtStr = eod.generated_at ? new Date(eod.generated_at).toLocaleString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  const dottedLine = <div className="border-t border-dashed border-gray-400 dark:border-neutral-500 my-2" />;
  const solidLine = <div className="border-t border-gray-400 dark:border-neutral-500 my-3" />;

  const renderRow = (label: string, value: string, isBold = false, isLarge = false) => (
    <div className={cn("flex justify-between py-0.5 font-mono text-xs", isBold && "font-bold", isLarge && "text-sm font-bold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  const renderIndentRow = (label: string, value: string) => (
    <div className="flex justify-between py-0.5 font-mono text-xs text-gray-500 dark:text-neutral-400 pl-4">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative bg-white dark:bg-neutral-900 text-gray-800 dark:text-neutral-100 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-gray-900 dark:text-white">Z-Report — End of Day</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="w-5.5 h-5.5 text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200" />
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 select-none bg-gray-50 dark:bg-neutral-950">
          <div className="max-w-sm mx-auto p-4 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-sm rounded-lg">
            <div className="text-center mb-4">
              <h4 className="font-mono text-sm font-bold tracking-wider uppercase">BRANCH CLOSEOUT</h4>
              <p className="font-mono text-[10px] text-gray-500 dark:text-neutral-400">END-OF-DAY REPORT — Z-CLOSE</p>
            </div>
            
            {solidLine}

            {renderRow("Date", reportDateStr)}
            {renderRow("Report ID", s(eod.id).substring(0, 8).toUpperCase())}
            {renderRow("Cashier", printedBy)}
            {renderRow("Opening Cash", fmt(openingCash))}
            {generatedAtStr && renderRow("Generated", generatedAtStr)}

            {solidLine}

            <p className="font-mono text-xs font-bold text-gray-500 dark:text-neutral-400 py-1">1. SALES & REVENUE</p>
            {dottedLine}
            {renderRow("Gross Sales", fmt(grossSales))}
            {dottedLine}
            {renderIndentRow("Discounts", `- ${fmt(discount)}`)}
            {renderIndentRow("Voided / Cancelled", `- ${fmt(voidedAmount)}`)}
            {dottedLine}
            {renderRow("Net Sales", fmt(netSales), true)}
            {renderIndentRow("SST / Tax", `+ ${fmt(tax)}`)}
            {dottedLine}
            {renderRow("GRAND TOTAL", fmt(grandTotal), true, true)}

            {solidLine}

            <p className="font-mono text-xs font-bold text-gray-500 dark:text-neutral-400 py-1">2. TENDER BREAKDOWN</p>
            {dottedLine}
            {renderRow("Cash", fmt(cashSales))}
            {renderRow("Card", fmt(cardSales))}
            {renderRow("E-Wallet", fmt(ewalletSales))}
            {renderRow("QR / DuitNow", fmt(qrSales))}
            {dottedLine}
            {renderRow("Total Tendered", fmt(totalTendered), true)}
            {renderRow("Variance", `${variance >= 0 ? "+" : ""}${fmt(variance)}`)}
            {renderRow("Status", Math.abs(variance) < 0.01 ? "BALANCED" : "DISCREPANCY", true)}

            {solidLine}

            <p className="font-mono text-xs font-bold text-gray-500 dark:text-neutral-400 py-1">3. CASH DRAWER</p>
            {dottedLine}
            {renderRow("Opening Float", fmt(openingCash))}
            {renderRow("Cash Sales", `+ ${fmt(cashSales)}`)}
            {dottedLine}
            {renderRow("Expected in Drawer", fmt(expectedCash), true)}
            {renderRow("Actual Cash Counted", fmt(closingCash), true)}
            {dottedLine}
            {renderRow(
              "Over / Short", 
              `${cashVariance >= 0 ? "+" : ""}${fmt(cashVariance)} (${Math.abs(cashVariance) < 0.01 ? "EXACT" : cashVariance > 0 ? "OVER" : "SHORT"})`, 
              true
            )}

            {solidLine}

            <p className="font-mono text-xs font-bold text-gray-500 dark:text-neutral-400 py-1">4. OPERATIONS</p>
            {dottedLine}
            {renderRow("Completed Orders", String(completedOrds))}
            {renderRow("Voided Orders", `${voidedOrds} (${fmt(voidedAmount)})`)}
            {renderRow("Avg Basket Size", fmt(avgBasket))}

            {solidLine}

            <div className="text-center text-[9px] text-gray-400 dark:text-neutral-500 space-y-1 mt-4">
              <p>MANAGER APPROVED · ACCOUNTING COPY</p>
              <p>Retain for 7 years per Malaysian tax regulation.</p>
              <p className="font-bold mt-2">*** END OF REPORT ***</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EodReportsSection({ loading, eodReports }: { loading: boolean; eodReports: any[] }) {
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

function SessionReportsSection({ loading, shifts, transactionRows }: { loading: boolean; shifts: any[]; transactionRows: any[] }) {
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // Reset to first page when shifts count changes
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

          {/* Pagination Controls */}
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

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function Reports() {
  const [dateRange, setDateRange]       = useState<DateRange>(DATE_PRESETS[0]);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const [showFilter, setShowFilter] = useState<boolean>(() => {
    try { return localStorage.getItem('reports_show_filter') === 'true'; } catch { return false; }
  });

  const handleToggleFilter = () => {
    setShowFilter(prev => {
      const next = !prev;
      try { localStorage.setItem('reports_show_filter', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const toggleFilter = (type: FilterType, value: string, label: string) => {
    setActiveFilters(prev => {
      const exists = prev.find(f => f.type === type && f.value === value);
      if (exists) return prev.filter(f => !(f.type === type && f.value === value));
      return [...prev, { id: `${type}-${value}`, type, value, label }];
    });
  };
  const isActive     = (type: FilterType, value: string) => activeFilters.some(f => f.type === type && f.value === value);
  const removeFilter = (id: string) => setActiveFilters(prev => prev.filter(f => f.id !== id));
  const clearAll     = () => setActiveFilters([]);

  const [visibleInsights, setVisibleInsights] = useState<InsightSection[]>([
    'sales_revenue', 'menu_insights', 'payment_transactions',
  ]);
  const toggleInsight = (id: InsightSection) =>
    setVisibleInsights(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const show = (id: InsightSection) => visibleInsights.includes(id);

  const [showAiDrawer, setShowAiDrawer] = useState(false);

  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : null;

  const data = useReportData(dateRange, activeFilters, activeMerchantId);

  const handleExportCSV = () => {
    const rows: any[] = [
      ['Period', dateRange.label], [],
      ['Total Sales', `RM ${data.totalSales.toFixed(2)}`],
      ['Gross Sales', `RM ${data.grossSales.toFixed(2)}`],
      ['Net Sales',   `RM ${data.netSales.toFixed(2)}`],
      ['Total Orders', data.totalOrders],
      ['AOV',         `RM ${data.aov.toFixed(2)}`],
      ['Discounts',   `RM ${data.totalDiscount.toFixed(2)}`],
      ['Tax',         `RM ${data.totalTax.toFixed(2)}`],
      ['Refunds',     data.refundCount], [],
      ['Item', 'Qty', 'Revenue'],
      ...data.topItems.map(i => [i.name, i.qty, i.revenue.toFixed(2)]), [],
      ['Category', 'Revenue', '%'],
      ...data.categoryData.map(c => [c.name, c.value, `${c.pct}%`]), [],
      ['Payment', 'Revenue', 'Count'],
      ...data.paymentData.map(p => [p.name, p.value, p.count]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `report-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="flex gap-6">
      {showFilter && (
        <FilterSidebar
          activeFilters={activeFilters}
          orderTypeOptions={data.orderTypeOptions}
          paymentOptions={data.paymentOptions}
          categoryOptions={data.categoryOptions}
          menuItemOptions={data.menuItemOptions}
          onToggleFilter={toggleFilter}
          onRemoveFilter={removeFilter}
          onClearAll={clearAll}
          isActive={isActive}
        />
      )}

      <div className="flex-1 min-w-0 space-y-5">
        <ReportHeader
          lastSynced={data.lastSynced}
          loading={data.loading}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          visibleInsights={visibleInsights}
          onToggleInsight={toggleInsight}
          showAiDrawer={showAiDrawer}
          onToggleAiDrawer={() => setShowAiDrawer(p => !p)}
          onRefresh={data.fetchReportData}
          onExportCSV={handleExportCSV}
          showFilter={showFilter}
          onToggleFilter={() => handleToggleFilter()}
          branches={data.branches}
          selectedBranchId={data.selectedBranchId}
          onBranchChange={data.setSelectedBranchId}
        />

        <AIInsightDrawer
          show={showAiDrawer}
          onClose={() => setShowAiDrawer(false)}
          dateRange={dateRange}
          activeFilters={activeFilters}
          loading={data.loading}
          totalSales={data.totalSales}
          netSales={data.netSales}
          grossSales={data.grossSales}
          totalOrders={data.totalOrders}
          aov={data.aov}
          totalDiscount={data.totalDiscount}
          refundCount={data.refundCount}
          topItems={data.topItems}
          categoryData={data.categoryData}
          paymentData={data.paymentData}
          staffData={data.staffData}
        />

        {visibleInsights.length === 0 && (
          <div className="bg-white dark:bg-[var(--sb-card)] dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] dark:border-[var(--sb-border)] shadow-sm p-12 text-center">
            <EyeOff className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-neutral-500 dark:text-neutral-300 font-medium">No insight sections selected</p>
            <p className="text-gray-400 dark:text-neutral-500 dark:text-neutral-500 text-sm mt-1">
              Click the <strong>Insights</strong> button above to choose which sections to display.
            </p>
          </div>
        )}

        {show('sales_revenue')        && <SalesRevenueSection        loading={data.loading} totalSales={data.totalSales} grossSales={data.grossSales} netSales={data.netSales} totalOrders={data.totalOrders} aov={data.aov} totalDiscount={data.totalDiscount} totalTax={data.totalTax} refundCount={data.refundCount} refundAmount={data.refundAmount} dailySales={data.dailySales} hourlySales={data.hourlySales} totalSalesRows={data.totalSalesRows} netSalesRows={data.netSalesRows} grossSalesRows={data.grossSalesRows} aovRows={data.aovRows} hourlyRows={data.hourlyRows} refundRows={data.refundRows} discountRows={data.discountRows} transactionRows={data.transactionRows} />}
        {show('menu_insights')        && <MenuInsightsSection        loading={data.loading} topItems={data.topItems} worstItems={data.worstItems} categoryData={data.categoryData} />}
        {show('payment_transactions') && <PaymentTransactionsSection loading={data.loading} totalOrders={data.totalOrders} aov={data.aov} paymentData={data.paymentData} />}
        {show('table_customer')       && <TableCustomerSection       loading={data.loading} tableStats={data.tableStats} totalOrders={data.totalOrders} />}
        {show('staff_shift')          && <StaffShiftSection          loading={data.loading} staffData={data.staffData} shiftData={data.shiftData} />}
        {show('inventory_stock')      && <InventoryStockSection      loading={data.loading} lowStockItems={data.lowStockItems} inventoryData={data.inventoryData} />}
        {show('eod_reports')          && <EodReportsSection          loading={data.loading} eodReports={data.eodReports} />}
        {show('session_reports')      && <SessionReportsSection      loading={data.loading} shifts={data.shifts} transactionRows={data.transactionRows} />}
      </div>
    </div>
  );
}