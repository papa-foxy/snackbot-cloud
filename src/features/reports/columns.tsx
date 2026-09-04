import React from 'react';
import { ColDef } from './types';
import { COLORS, fmt } from './constants';
import { cn } from '../../utils/cn';

export function MiniBar({ pct, color = '#4f46e5' }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-14 bg-gray-100 dark:bg-neutral-800 rounded-full h-1.5">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-neutral-500 w-7 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

export const TOTAL_SALES_COLS: ColDef[] = [
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

export const NET_SALES_COLS: ColDef[] = [
  { id: 'date',     label: 'Date',        defaultVisible: true,  render: (r) => <span className="font-medium text-gray-800 dark:text-neutral-200">{r.date}</span> },
  { id: 'gross',    label: 'Gross Sales', defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-700 dark:text-neutral-300', render: (r) => fmt(r.gross) },
  { id: 'discount', label: 'Discounts',   defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-rose-500', render: (r) => r.discount ? `−${fmt(r.discount)}` : '—' },
  { id: 'tax',      label: 'Tax',         defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-amber-500', render: (r) => r.tax ? `−${fmt(r.tax)}` : '—' },
  { id: 'refunds',  label: 'Refunds',     defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-rose-400', render: (r) => r.refunds ? `−${fmt(r.refunds)}` : '—' },
  { id: 'net',      label: 'Net Sales',   defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-bold text-emerald-600', render: (r) => fmt(r.net) },
  { id: 'orders',   label: 'Orders',      defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => r.orders },
  { id: 'margin',   label: 'Net Margin',  defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right', render: (r) => r.gross ? <MiniBar pct={(r.net / r.gross) * 100} color="#10b981" /> : '—' },
];

export const GROSS_SALES_COLS: ColDef[] = [
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

export const AOV_COLS: ColDef[] = [
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

export const HOURLY_COLS: ColDef[] = [
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

export const REFUND_COLS: ColDef[] = [
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

export const DISCOUNT_COLS: ColDef[] = [
  { id: 'date',      label: 'Date',            defaultVisible: true,  render: (r) => <span className="font-medium text-gray-800 dark:text-neutral-200">{r.date}</span> },
  { id: 'discount',  label: 'Discount',        defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right font-semibold text-rose-600', render: (r) => fmt(r.discount) },
  { id: 'orders',    label: 'Orders w/ Disc',  defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right text-gray-600 dark:text-neutral-400', render: (r) => r.ordersWithDiscount },
  { id: 'revenue',   label: 'Revenue',         defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-500 dark:text-neutral-500', render: (r) => fmt(r.revenue) },
  { id: 'discPct',   label: 'Disc % of Sales', defaultVisible: true,  headerClass: 'text-right', cellClass: 'text-right', render: (r) => r.revenue ? <MiniBar pct={(r.discount / r.revenue) * 100} color="#ef4444" /> : '—' },
  { id: 'avgDisc',   label: 'Avg Discount',    defaultVisible: false, headerClass: 'text-right', cellClass: 'text-right text-gray-400 dark:text-neutral-500', render: (r) => r.ordersWithDiscount ? fmt(r.discount / r.ordersWithDiscount) : '—' },
  { id: 'orderType', label: 'Order Type',      defaultVisible: false, render: (r) => <span className="text-xs text-gray-500 dark:text-neutral-500 capitalize">{r.topOrderType || '—'}</span> },
];

export const TRANSACTION_COLS: ColDef[] = [
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

export const TOP_ITEMS_COLS: ColDef[] = [
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

export const CATEGORY_COLS: ColDef[] = [
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

export const PAYMENT_COLS: ColDef[] = [
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
