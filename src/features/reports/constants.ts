import {
  DollarSign, UtensilsCrossed, CreditCard, Users, Clock, Package, Receipt
} from 'lucide-react';
import { FilterType, DateRange, InsightConfig } from './types';

export const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

export const fmt = (n: number) => `RM ${n.toFixed(2)}`;

export const colorMap: Record<string, { bg: string; text: string; border: string; badge: string; active: string }> = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700',   active: 'bg-indigo-600 text-white border-indigo-600' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700',     active: 'bg-amber-500 text-white border-amber-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', active: 'bg-emerald-600 text-white border-emerald-600' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700',       active: 'bg-blue-600 text-white border-blue-600' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-200',  badge: 'bg-purple-100 text-purple-700',   active: 'bg-purple-600 text-white border-purple-600' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700',       active: 'bg-rose-600 text-white border-rose-600' },
};

export const filterTypeColors: Record<FilterType, string> = {
  order_type:     'bg-indigo-100 text-indigo-700 border-indigo-200',
  payment_method: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  category:       'bg-amber-100 text-amber-700 border-amber-200',
  menu_item:      'bg-purple-100 text-purple-700 border-purple-200',
};

export const makeRange = (days: number, label: string): DateRange => {
  const to = new Date(); const from = new Date();
  from.setDate(from.getDate() - days);
  return { from, to, label };
};

export const makeToday = (): DateRange => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to, label: 'Today' };
};

export const DATE_PRESETS: DateRange[] = [
  makeToday(),
  makeRange(7,   'Last 7 Days'),
  makeRange(30,  'Last 30 Days'),
  makeRange(90,  'Last 3 Months'),
  makeRange(180, 'Last 6 Months'),
];

export const INSIGHT_CONFIGS: InsightConfig[] = [
  { id: 'sales_revenue',        label: 'Sales & Revenue',        icon: DollarSign,      color: 'indigo',  description: 'Revenue trends, AOV, discounts, refunds' },
  { id: 'menu_insights',        label: 'Menu Insights',          icon: UtensilsCrossed, color: 'amber',   description: 'Top/worst sellers, category performance' },
  { id: 'payment_transactions', label: 'Payment & Transactions', icon: CreditCard,      color: 'emerald', description: 'Payment methods, transaction counts' },
  { id: 'table_customer',       label: 'Table & Customer',       icon: Users,           color: 'blue',    description: 'Occupancy, turnover, customer count' },
  { id: 'staff_shift',          label: 'Staff & Shift',          icon: Clock,           color: 'purple',  description: 'Sales per staff, shift performance' },
  { id: 'inventory_stock',      label: 'Inventory & Stock',      icon: Package,         color: 'rose',    description: 'Low stock, usage trends' },
  { id: 'eod_reports',          label: 'EOD Reports',            icon: Receipt,         color: 'blue',    description: 'Daily End of Day Reports (Z-Reports)' },
  { id: 'session_reports',      label: 'Session Reports',        icon: Clock,           color: 'purple',  description: 'Cashier sessions and shift summaries' },
];
