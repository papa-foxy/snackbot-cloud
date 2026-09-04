/**
 * Dashboard — updated to match Reports density/sizing
 * Spacing, text sizes, padding, icon sizes all aligned to Reports scale
 */

import { useState, useEffect, useRef } from 'react';
import {
  ArrowUpRight, ArrowDownRight, AlertTriangle, Info, ShieldAlert,
  UtensilsCrossed, MonitorSmartphone, Grid2X2, Package, Receipt, Plus,
  DollarSign, ShoppingCart, Users, TrendingUp, Clock,
  LayoutGrid, CreditCard, Sparkles, Loader2, X,
  Bell, CheckCircle2, ChevronRight, RefreshCw, Wifi, WifiOff, Award, Timer, Hash,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { supabase } from '../../../lib/supabase';
import { useTranslation } from '../../../contexts/TranslationContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { GoogleGenAI } from '@google/genai';
import { useDataLoader } from '../../../hooks/useDataLoader';
import { useImpersonation } from '../../../contexts/ImpersonationContext';
import { cn } from '../../../utils/cn';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardConfig {
  defaultDateRange: number; defaultChartType: string; advancedAnalytics: boolean;
  currency: string; businessName: string; timezone: string; autoPrint: boolean; showTax: boolean;
  taxInclusive: boolean; sstRate: string; lowStockAlert: boolean; lowStockThreshold: number;
  autoDeduction: boolean; ingredientTracking: boolean; lowStockNotif: boolean; unpaidAlert: boolean;
  vipAlert: boolean; scheduledAlert: boolean; emailSummary: boolean; summaryEmail: string;
  autoRelease: boolean; autoClose: boolean; qrOrdering: boolean; defaultDiningDuration: number;
  sessionTimeout: number; loyaltyEnable: boolean; pointsPerRm: number; pointsExpiry: number;
  promoCode: boolean; scheduledPromotions: boolean; offlineMode: boolean; syncFrequency: string;
}

const CONFIG_DEFAULTS: DashboardConfig = {
  defaultDateRange: 7, defaultChartType: 'bar', advancedAnalytics: false,
  currency: 'MYR', businessName: '', timezone: 'Asia/Kuala_Lumpur', autoPrint: false, showTax: true,
  taxInclusive: false, sstRate: '6%', lowStockAlert: false, lowStockThreshold: 10, autoDeduction: false,
  ingredientTracking: false, lowStockNotif: false, unpaidAlert: false, vipAlert: false, scheduledAlert: false,
  emailSummary: false, summaryEmail: '', autoRelease: false, autoClose: false, qrOrdering: false,
  defaultDiningDuration: 60, sessionTimeout: 30, loyaltyEnable: false, pointsPerRm: 1, pointsExpiry: 365,
  promoCode: false, scheduledPromotions: false, offlineMode: false, syncFrequency: 'realtime',
};

async function fetchConfig(merchantId: string): Promise<DashboardConfig> {
  const { data } = await supabase.from('settings').select('key, value').eq('merchant_id', merchantId);
  const m: Record<string, string> = {};
  for (const row of data ?? []) m[row.key] = row.value;
  return {
    defaultDateRange: parseInt(m['dashboard_defaultDateRange'] ?? '7'),
    defaultChartType: m['dashboard_defaultChartType'] ?? 'bar',
    advancedAnalytics: m['dashboard_advancedAnalytics'] === 'true',
    currency: m['general_currency'] ?? 'MYR',
    businessName: m['general_business_name'] ?? '',
    timezone: m['general_timezone'] ?? 'Asia/Kuala_Lumpur',
    autoPrint: m['general_autoPrint'] === 'true',
    showTax: m['general_showTax'] !== 'false',
    taxInclusive: m['tax_tax_inclusive'] === 'true',
    sstRate: m['tax_sst_rate'] ?? '6%',
    lowStockAlert: m['inventory_lowStockAlert'] === 'true',
    lowStockThreshold: parseInt(m['inventory_lowStockThreshold'] ?? '10'),
    autoDeduction: m['inventory_autoDeduction'] === 'true',
    ingredientTracking: m['inventory_ingredientTracking'] === 'true',
    lowStockNotif: m['notification_lowStockNotif'] === 'true',
    unpaidAlert: m['notification_unpaidAlert'] === 'true',
    vipAlert: m['notification_vipAlert'] === 'true',
    scheduledAlert: m['notification_scheduledAlert'] === 'true',
    emailSummary: m['notification_emailSummary'] === 'true',
    summaryEmail: m['notification_summaryEmail'] ?? '',
    autoRelease: m['table_autoRelease'] === 'true',
    autoClose: m['table_autoClose'] === 'true',
    qrOrdering: m['table_qrOrdering'] === 'true',
    defaultDiningDuration: parseInt(m['table_defaultDiningDuration'] ?? '60'),
    sessionTimeout: parseInt(m['security_sessionTimeout'] ?? '30'),
    loyaltyEnable: m['loyalty_loyaltyEnable'] === 'true',
    pointsPerRm: parseFloat(m['loyalty_pointsPerRm'] ?? '1'),
    pointsExpiry: parseInt(m['loyalty_pointsExpiry'] ?? '365'),
    promoCode: m['loyalty_promoCode'] === 'true',
    scheduledPromotions: m['loyalty_scheduledPromotions'] === 'true',
    offlineMode: m['cloud_offlineMode'] === 'true',
    syncFrequency: m['cloud_syncFrequency'] ?? 'realtime',
  };
}

const calcChange = (a: number, b: number) => {
  if (b === 0) return a > 0 ? '+100%' : '0%';
  const p = ((a - b) / b) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
};

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD — Reports density
// ─────────────────────────────────────────────────────────────────────────────

export function StatCard({ title, value, trend, isPositive, icon: Icon, color, loading, isDark }: any) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    fuchsia: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-200' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  };

  const c = colorMap[color] ?? colorMap.indigo;

  return (
    <div className={cn(
      'bg-white dark:bg-[var(--sb-card)] rounded-xl border shadow-sm p-4 hover:shadow-md transition-all group',
      c.border,
    )}>
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-neutral-800 rounded w-2/3" />
          <div className="h-6 bg-gray-200 dark:bg-neutral-800 rounded w-1/2 mt-2" />
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 font-medium uppercase tracking-wide">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-lg font-bold text-gray-900 dark:text-neutral-100">{value}</p>
              {trend && (
                <span className={cn(
                  'flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-full',
                  isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
                )}>
                  {isPositive
                    ? <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                  {trend}
                </span>
              )}
            </div>
            {trend && (
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">vs yesterday</p>
            )}
          </div>
          <div className={cn('p-2 rounded-lg transition-transform group-hover:scale-110 duration-300 shrink-0', c.bg)}>
            <Icon className={cn('w-4 h-4', c.text)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS PANEL — Reports density
// ─────────────────────────────────────────────────────────────────────────────

export function AlertsPanel({ alerts, isDark }: { alerts: any[]; isDark?: boolean }) {
  const cfg: Record<string, { icon: any; text: string; bg: string; border: string; dot: string }> = {
    warning: { icon: AlertTriangle, text: 'text-amber-800 dark:text-amber-200', bg: 'bg-amber-50 dark:bg-transparent', border: 'border-amber-200', dot: 'bg-amber-500' },
    danger: { icon: ShieldAlert, text: 'text-rose-800 dark:text-rose-200', bg: 'bg-rose-50 dark:bg-transparent', border: 'border-rose-200', dot: 'bg-rose-500' },
    info: { icon: Info, text: 'text-blue-800 dark:text-blue-200', bg: 'bg-blue-50 dark:bg-transparent', border: 'border-blue-200', dot: 'bg-blue-500' },
    success: { icon: CheckCircle2, text: 'text-emerald-800 dark:text-emerald-200', bg: 'bg-emerald-50 dark:bg-transparent', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  };

  return (
    <div className="bg-white dark:bg-[var(--sb-card)] p-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Urgent Alerts</h3>
        {alerts.length > 0 && (
          <span className="ml-auto text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        )}
      </div>
      <div className="space-y-2 flex-1">
        {alerts.length > 0 ? (
          alerts.map((alert, i) => {
            const { icon: Icon, text, bg, border, dot } = cfg[alert.type] ?? cfg.info;
            return (
              <div key={i} className={cn('flex items-start gap-2.5 p-3 rounded-lg border', bg, border, text)}>
                <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', dot)} />
                <Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-90" />
                <div>
                  <p className="text-xs font-medium leading-snug">{alert.message}</p>
                  {alert.time && <p className="text-xs opacity-70 mt-0.5">{alert.time}</p>}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-gray-800 dark:text-neutral-100">System Secure</p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">No urgent alerts.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONAL STATUS — Reports density
// ─────────────────────────────────────────────────────────────────────────────

export function OperationalStatus({ activeTables, totalTables, openOrders, longestTableTime = 0, idleTables = 0, isDark }: any) {
  return (
    <div className="bg-white dark:bg-[var(--sb-card)] p-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
          <UtensilsCrossed className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Operational Status</h3>
      </div>
      <div className="space-y-2 flex-1">
        {[
          { label: 'Active Tables', value: `${activeTables} / ${totalTables}`, cls: 'text-gray-900 dark:text-neutral-100' },
          { label: 'Longest Open Table', value: `${longestTableTime} mins`, cls: 'text-amber-600' },
          { label: 'Pending Orders', value: `${openOrders} orders`, cls: 'text-rose-600' },
          { label: 'Idle Tables (>15m)', value: `${idleTables} tables`, cls: 'text-gray-900 dark:text-neutral-100' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-neutral-800/50 rounded-lg">
            <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">{label}</span>
            <span className={cn('text-xs font-bold', cls)}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// REVENUE BREAKDOWN — Reports density
// ─────────────────────────────────────────────────────────────────────────────

export function RevenueBreakdown({ categoryData, paymentData, loading, isDark, dateRange }: {
  categoryData: any[]; paymentData: any[]; loading: boolean; isDark?: boolean; dateRange: number;
}) {
  return (
    <div className="bg-white dark:bg-[var(--sb-card)] p-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Revenue Breakdown</h3>
        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">{dateRange === 0 ? 'Today' : `Last ${dateRange} days`}</p>
      </div>
      <div className="flex-1 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-2">By Category</h4>
          <div className="h-[130px]">
            {loading ? (
              <div className="w-full h-full bg-gray-50 dark:bg-neutral-800/50 animate-pulse rounded-lg" />
            ) : categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} paddingAngle={4} dataKey="value">
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `RM ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-400 dark:text-neutral-500">No data</div>
            )}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-2">Payment Methods</h4>
          <div className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-50 dark:bg-neutral-800/50 animate-pulse rounded" />
              ))
            ) : paymentData.length > 0 ? (
              paymentData.map((method, i) => {
                const total = paymentData.reduce((sum, m) => sum + m.value, 0);
                const pct = total > 0 ? (method.value / total) * 100 : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-gray-700 dark:text-neutral-300 capitalize">{method.name}</span>
                      <span className="text-gray-500 dark:text-neutral-400">RM {method.value.toFixed(2)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-gray-400 dark:text-neutral-500 text-center py-2">No payment data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SALES CHART — Reports density
// ─────────────────────────────────────────────────────────────────────────────

export function SalesChart({ data, loading, chartType = 'area', isDark, dateRange }: {
  data: any[]; loading: boolean; chartType?: string; isDark?: boolean; dateRange: number;
}) {
  const sharedAxis = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} dy={10} />
      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} dx={-8}
        tickFormatter={(v) => `RM ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} />
      <Tooltip
        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)', padding: '8px', fontSize: '12px' }}
        itemStyle={{ fontWeight: 600, fontSize: '12px' }}
        labelStyle={{ color: '#9ca3af', marginBottom: '2px', fontSize: '11px' }}
        formatter={(value: number) => [`RM ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
      />
    </>
  );

  const renderChart = () => {
    const margin = { top: 6, right: 8, left: 0, bottom: 0 };
    if (chartType === 'bar') {
      return (
        <BarChart data={data} margin={margin}>
          {sharedAxis}
          <Bar dataKey="sales" fill="var(--color-primary)" radius={[3, 3, 0, 0]} maxBarSize={36} animationDuration={1500} />
        </BarChart>
      );
    }
    if (chartType === 'line') {
      return (
        <LineChart data={data} margin={margin}>
          {sharedAxis}
          <Line type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-primary)' }} activeDot={{ r: 4 }} animationDuration={1500} />
        </LineChart>
      );
    }
    return (
      <AreaChart data={data} margin={margin}>
        <defs>
          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        {sharedAxis}
        <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" animationDuration={1500} />
      </AreaChart>
    );
  };

  return (
    <div className="lg:col-span-2 bg-white dark:bg-[var(--sb-card)] p-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm hover:shadow-md transition-shadow h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Sales Trend</h3>
          <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">{dateRange === 0 ? 'Today — hourly' : `Last ${dateRange} days revenue`}</p>
        </div>
      </div>
      <div className="h-[240px] w-full">
        {loading ? (
          <div className="w-full h-full bg-gray-50 dark:bg-neutral-800/50 animate-pulse rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF SNAPSHOT — Reports density
// ─────────────────────────────────────────────────────────────────────────────

export function StaffSnapshot({ staffData, isDark }: { staffData: any[]; isDark?: boolean }) {
  return (
    <div className="bg-white dark:bg-[var(--sb-card)] p-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
          <Users className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Staff Snapshot</h3>
      </div>
      <div className="space-y-2 flex-1">
        {staffData.length > 0 ? (
          staffData.map((staff, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-neutral-800/50 rounded-lg">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-700 dark:text-indigo-200 font-bold text-xs shrink-0">
                  {staff.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-neutral-100">{staff.name}</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 uppercase font-medium tracking-wide">{staff.orders} orders</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-indigo-600">RM {staff.sales.toFixed(2)}</p>
                <div className="flex items-center justify-end gap-0.5 text-xs text-emerald-600 font-semibold mt-0.5">
                  <TrendingUp className="w-3 h-3" />
                  Top
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <p className="text-xs text-gray-400 dark:text-neutral-500 italic">No staff activity yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION BELL — Reports density
// ─────────────────────────────────────────────────────────────────────────────

function NotificationBell({ alerts, isDark }: { alerts: { type: string; message: string; time?: string }[]; isDark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const cfg: Record<string, { icon: any; cls: string; bg: string; text: string }> = {
    warning: { icon: AlertTriangle, cls: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-gray-800 dark:text-amber-200' },
    danger: { icon: AlertTriangle, cls: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-gray-800 dark:text-red-200' },
    info: { icon: Info, cls: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-gray-800 dark:text-blue-200' },
    success: { icon: CheckCircle2, cls: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-gray-800 dark:text-emerald-200' },
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="relative p-2 rounded-lg bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] hover:bg-gray-50 transition-colors shadow-sm"
      >
        <Bell className="w-4 h-4 text-gray-600 dark:text-neutral-300" />
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {alerts.length > 9 ? '9+' : alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 mt-1 w-80 bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-2xl border border-gray-200 dark:border-[var(--sb-border)] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50">
            <h3 className="font-semibold text-gray-700 dark:text-neutral-100 text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-500" /> Notifications
            </h3>
            <span className="text-xs bg-gray-200 text-gray-600 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded-full font-medium">
              {alerts.length} active
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-neutral-800">
            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm text-gray-500 dark:text-neutral-500">All clear!</p>
              </div>
            ) : alerts.map((alert, i) => {
              const { icon: Icon, cls, bg, text } = cfg[alert.type] ?? cfg.info;
              return (
                <div key={i} className={cn('flex items-start gap-3 px-4 py-3 transition-all hover:opacity-90', bg)}>
                  <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', cls)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-medium', text)}>{alert.message}</p>
                    {alert.time && <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{alert.time}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3 border-t border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50">
            <button className="text-xs text-indigo-600 dark:text-indigo-300 font-medium hover:text-indigo-800 w-full text-center">
              View all activity →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE SETTING CHIPS — Reports density
// ─────────────────────────────────────────────────────────────────────────────

function ActiveSettingChips({ config }: { config: DashboardConfig }) {
  const chips = [
    config.taxInclusive && { label: `Tax Incl. · ${config.sstRate}`, color: 'bg-amber-100 text-amber-700 border-amber-200' },
    config.loyaltyEnable && { label: `Loyalty · ${config.pointsPerRm}pt/${config.currency}1`, color: 'bg-pink-100 text-pink-700 border-pink-200' },
    config.promoCode && { label: 'Promo Codes', color: 'bg-violet-100 text-violet-700 border-violet-200' },
    config.qrOrdering && { label: 'QR Order', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    config.autoPrint && { label: 'Auto-Print', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    config.autoDeduction && { label: 'Auto Stock', color: 'bg-teal-100 text-teal-700 border-teal-200' },
    config.ingredientTracking && { label: 'Ingredient Tracking', color: 'bg-lime-100 text-lime-700 border-lime-200' },
    config.autoClose && { label: 'Auto-Close', color: 'bg-rose-100 text-rose-700 border-rose-200' },
    config.offlineMode && { label: 'Offline', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  ].filter(Boolean) as { label: string; color: string }[];

  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {chips.map((c, i) => (
        <span key={i} className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', c.color)}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM STATUS BAR — Reports density
// ─────────────────────────────────────────────────────────────────────────────

function SystemStatusBar({ config, lastUpdated, loading, onRefresh, lowStockCount, outOfStockCount, onNavigateLowStock, isDark }: {
  config: DashboardConfig; lastUpdated: Date | null; loading: boolean; onRefresh: () => void;
  lowStockCount?: number; outOfStockCount?: number; onNavigateLowStock?: () => void; isDark?: boolean;
}) {
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZone: config.timezone };
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-lg text-xs text-gray-500 dark:text-neutral-500 shadow-sm">
      <div className={cn('flex items-center gap-1.5 font-semibold', config.offlineMode ? 'text-slate-500' : 'text-emerald-600 dark:text-emerald-400')}>
        {config.offlineMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
        {config.offlineMode ? 'Offline' : `Live · ${config.syncFrequency}`}
      </div>
      <span className="text-gray-300 dark:text-neutral-700">·</span>
      <div className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />Session: {config.sessionTimeout}m</div>
      {config.emailSummary && config.summaryEmail && (
        <>
          <span className="text-gray-300 dark:text-neutral-700">·</span>
          <div className="flex items-center gap-1 text-blue-600"><Info className="w-3.5 h-3.5" />Report → {config.summaryEmail}</div>
        </>
      )}
      {config.lowStockAlert && lowStockCount !== undefined && lowStockCount > 0 && (
        <>
          <span className="text-gray-300 dark:text-neutral-700">·</span>
          <button onClick={onNavigateLowStock} className="flex items-center gap-1 text-amber-600 hover:text-amber-700 font-medium">
            <Package className="w-3.5 h-3.5" />{lowStockCount} low stock {outOfStockCount ? `(${outOfStockCount} out)` : ''}
          </button>
        </>
      )}
      <div className="flex items-center gap-1.5 ml-auto">
        {lastUpdated && <span className="text-gray-400 dark:text-neutral-500">Updated {lastUpdated.toLocaleTimeString([], timeOpts)}</span>}
        <button onClick={onRefresh} disabled={loading} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40">
          <RefreshCw className={cn('w-3.5 h-3.5 text-gray-500 dark:text-neutral-400', loading && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOYALTY BANNER — Reports density
// ─────────────────────────────────────────────────────────────────────────────

function LoyaltyBanner({ config, members, points, isDark }: { config: DashboardConfig; members: number; points: number; isDark?: boolean }) {
  return (
    <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 dark:from-pink-500/10 dark:via-purple-500/10 dark:to-indigo-500/10 border border-pink-100 dark:border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-4">
      <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
        <Award className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">Loyalty Program Active</p>
        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">
          {config.pointsPerRm} pt per {config.currency} 1 · expires {config.pointsExpiry}d
          {config.promoCode && <span className="ml-2 text-violet-600 dark:text-violet-300">· Promo on</span>}
          {config.scheduledPromotions && <span className="ml-2 text-indigo-600 dark:text-indigo-300">· Auto-promos on</span>}
        </p>
      </div>
      <div className="hidden sm:flex gap-6 text-center">
        <div>
          <p className="text-base font-bold text-pink-700 dark:text-pink-300">{members.toLocaleString()}</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500">Members</p>
        </div>
        <div>
          <p className="text-base font-bold text-purple-700 dark:text-purple-300">{points.toLocaleString()}</p>
          <p className="text-xs text-gray-400 dark:text-neutral-500">Points</p>
        </div>
      </div>
      <button className="text-xs font-medium text-pink-600 hover:text-pink-800 dark:text-pink-300 flex items-center gap-1 shrink-0">
        Manage <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOP ITEMS PANEL — Reports density
// ─────────────────────────────────────────────────────────────────────────────

function TopItemsPanel({ items, currency, isDark }: { items: any[]; currency: string; isDark?: boolean }) {
  const fmt = (v: number) => `${currency} ${v.toFixed(2)}`;
  return (
    <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--sb-border)] flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-neutral-100 text-sm flex items-center gap-2">
          <Hash className="w-4 h-4 text-indigo-500" /> Top Selling Items
        </h3>
        <span className="text-xs text-gray-400 dark:text-neutral-500">by revenue</span>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-neutral-800">
        {items.map((item, i) => {
          const pct = items[0]?.revenue > 0 ? (item.revenue / items[0].revenue) * 100 : 0;
          const medals = ['🥇', '🥈', '🥉'];
          return (
            <div key={i} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-sm w-6 text-center shrink-0">
                  {medals[i] ?? <span className="text-xs text-gray-400 dark:text-neutral-500 font-bold">{i + 1}</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-800 dark:text-neutral-200 truncate">{item.name}</span>
                    <span className="text-xs text-gray-500 dark:text-neutral-500 shrink-0 ml-3">{item.sales} sold · {fmt(item.revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: '#4f46e5' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT: DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export function Dashboard({ onNavigatePage }: { onNavigatePage?: (tab: string) => void }) {
  const { t } = useTranslation();
  const { themeColors, settings } = useSettings();
  const isDark = settings.theme === 'dark'
    || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [config, setConfig] = useState<DashboardConfig>(CONFIG_DEFAULTS);
  // 0 = Today (default), positive numbers = last N days
  const [dateRange, setDateRange] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);

  const getLocalMerchantId = () => {
    try { return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null; }
    catch { return null; }
  };
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : getLocalMerchantId();

  useEffect(() => {
    if (activeMerchantId) {
      // Load config in background but don't gate initial fetch on it
      fetchConfig(activeMerchantId).then(cfg => { setConfig(cfg); });
      const interval = setInterval(() => { fetchConfig(activeMerchantId).then(setConfig); }, 30_000);
      return () => clearInterval(interval);
    }
  }, [activeMerchantId]);

  const fmt = (val: number) =>
    `${config.currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleNavigateToLowStock = () => onNavigatePage?.('inventory');

  const fetchDashboardData = async () => {
    if (!activeMerchantId) { console.warn('[Dashboard] no activeMerchantId'); return null; }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // dateRange === 0 means "Today only"; otherwise last N days from start of today
    const rangeStart = dateRange === 0
      ? todayStart
      : new Date(todayStart.getTime() - dateRange * 24 * 60 * 60 * 1000);
    const rangeEnd = todayEnd;

    // Yesterday window (always used for trend comparison)
    const yestStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yestEnd = new Date(todayStart.getTime() - 1);

    // Fetch range orders + yesterday for trend (if dateRange === 0 we need yesterday separately)
    const fetchFrom = dateRange === 0 ? yestStart : rangeStart;

    const { data: allOrders, error } = await supabase
      .from('orders')
      .select('id, total, tax, discount, created_at, status, order_type, payment_method, waiter_id')
      .eq('merchant_id', activeMerchantId)
      .gte('created_at', fetchFrom.toISOString())
      .lte('created_at', rangeEnd.toISOString())
      .order('created_at', { ascending: true });
    if (error) throw error;

    const orders = allOrders || [];

    // Split into range-window orders and yesterday orders
    const rangeOrders = orders.filter(o => new Date(o.created_at) >= rangeStart);
    const completedOrders = rangeOrders.filter(o => o.status === 'completed');
    const openOrders = rangeOrders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));

    const yestOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= yestStart && d <= yestEnd && o.status === 'completed';
    });

    // KPI stats over selected range
    const totalRevenue = completedOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalTax = completedOrders.reduce((s, o) => s + (o.tax || 0), 0);
    const totalDiscount = completedOrders.reduce((s, o) => s + (o.discount || 0), 0);
    const netSales = config.taxInclusive ? totalRevenue : totalRevenue - totalTax - totalDiscount;
    const totalTx = completedOrders.length;
    const aov = totalTx > 0 ? totalRevenue / totalTx : 0;
    const customers = completedOrders.reduce((s, o) => s + (o.order_type === 'dine_in' ? 2 : 1), 0);

    // Yesterday comparison
    const yestRevenue = yestOrders.reduce((s, o) => s + (o.total || 0), 0);
    const yestTx = yestOrders.length;
    const yestAov = yestTx > 0 ? yestRevenue / yestTx : 0;

    // Chart data — for Today show hourly, for multi-day show daily
    let chartData: { name: string; sales: number }[] = [];
    if (dateRange === 0) {
      // Hourly buckets for today
      const hourly: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hourly[h] = 0;
      completedOrders.forEach(o => {
        const h = new Date(o.created_at).getHours();
        hourly[h] = (hourly[h] || 0) + (o.total || 0);
      });
      chartData = Object.entries(hourly).map(([h, sales]) => ({
        name: `${String(h).padStart(2, '0')}:00`,
        sales,
      }));
    } else {
      // Daily buckets
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dailyMap: Record<string, number> = {};
      for (let i = dateRange - 1; i >= 0; i--) {
        const d = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
        const key = `${days[d.getDay()]} ${d.getDate()}`;
        dailyMap[key] = 0;
      }
      completedOrders.forEach(o => {
        const d = new Date(o.created_at);
        const key = `${days[d.getDay()]} ${d.getDate()}`;
        if (key in dailyMap) dailyMap[key] += o.total || 0;
      });
      chartData = Object.entries(dailyMap).map(([name, sales]) => ({ name, sales }));
    }

    // Order items scoped to the same range via order ids
    const completedIds = completedOrders.map(o => o.id);
    let topItems: any[] = [];
    let categoryData: any[] = [];

    if (completedIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('order_id, quantity, subtotal, menu:menu_id(name, menu_categories(name))')
        .in('order_id', completedIds);

      const itemAgg: Record<string, { name: string; sales: number; revenue: number }> = {};
      const catAgg: Record<string, number> = {};

      (itemsData || []).forEach((item: any) => {
        const name = item.menu?.name || 'Unknown';
        if (!itemAgg[name]) itemAgg[name] = { name, sales: 0, revenue: 0 };
        itemAgg[name].sales += item.quantity || 0;
        itemAgg[name].revenue += item.subtotal || 0;
        const cat = item.menu?.menu_categories?.name || 'Uncategorized';
        catAgg[cat] = (catAgg[cat] || 0) + (item.subtotal || 0);
      });

      topItems = Object.values(itemAgg).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      categoryData = Object.entries(catAgg).map(([name, value]) => ({ name, value }));
    }

    // Payment breakdown over selected range
    const payAgg: Record<string, number> = {};
    completedOrders.forEach(o => { const pm = o.payment_method || 'Unknown'; payAgg[pm] = (payAgg[pm] || 0) + (o.total || 0); });
    const paymentData = Object.entries(payAgg).map(([name, value]) => ({ name, value }));

    const { data: tables } = await supabase.from('tables').select('status, updated_at').eq('merchant_id', activeMerchantId);
    const activeTables = tables?.filter(t => t.status === 'occupied').length || 0;
    const totalTables = tables?.length || 0;
    let longestTableTime = 0, idleTables = 0;
    tables?.forEach(t => {
      if (t.status === 'occupied' && t.updated_at) {
        const mins = Math.floor((now.getTime() - new Date(t.updated_at).getTime()) / 60000);
        if (mins > longestTableTime) longestTableTime = mins;
        if (mins > config.defaultDiningDuration) idleTables++;
      }
    });

    const { data: inventory } = await supabase.from('inventory').select('name, quantity, min_stock_level, unit').eq('merchant_id', activeMerchantId);
    const lowStock = inventory?.filter(i => i.quantity <= (config.lowStockThreshold || i.min_stock_level)) || [];
    setLowStockItems(config.lowStockAlert ? lowStock : []);

    let loyaltyMembers = 0, totalPoints = 0;
    if (config.loyaltyEnable) {
      const { data: loyaltyData } = await supabase.from('customers').select('loyalty_points').eq('merchant_id', activeMerchantId).not('loyalty_points', 'is', null);
      loyaltyMembers = loyaltyData?.length || 0;
      totalPoints = loyaltyData?.reduce((s, c) => s + (c.loyalty_points || 0), 0) || 0;
    }

    const now2 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: config.timezone });
    const alerts: { type: string; message: string; time?: string }[] = [];
    if (config.unpaidAlert && openOrders.length > 5) alerts.push({ type: 'info', message: `${openOrders.length} orders pending payment`, time: now2 });
    if (config.vipAlert) alerts.push({ type: 'info', message: 'VIP customer alerts are active', time: now2 });
    if (config.scheduledAlert) alerts.push({ type: 'info', message: 'Scheduled menu item alerts are active', time: now2 });
    const voided = rangeOrders.filter(o => o.status === 'voided').length;
    if (voided > 3) alerts.push({ type: 'danger', message: `High void activity: ${voided} in period`, time: now2 });
    if (config.autoRelease && idleTables > 0) alerts.push({ type: 'warning', message: `${idleTables} tables idle past ${config.defaultDiningDuration}m`, time: now2 });
    if (completedOrders.length > 0) alerts.push({ type: 'success', message: `${completedOrders.length} orders completed`, time: now2 });

    const { data: users } = await supabase.from('users').select('id, name').eq('merchant_id', activeMerchantId);
    const staffAgg: Record<string, { name: string; sales: number; orders: number }> = {};
    completedOrders.forEach(o => {
      if (o.waiter_id) {
        const name = users?.find(u => u.id === o.waiter_id)?.name || 'Unknown';
        if (!staffAgg[name]) staffAgg[name] = { name, sales: 0, orders: 0 };
        staffAgg[name].sales += o.total || 0;
        staffAgg[name].orders += 1;
      }
    });
    const staffData = Object.values(staffAgg).sort((a, b) => b.sales - a.sales).slice(0, 3);

    setLastUpdated(new Date());
    return {
      stats: {
        revenue: totalRevenue, netSales, transactions: totalTx, aov,
        activeTables, totalTables, openOrders: openOrders.length, customers,
        longestTableTime, idleTables, voidedToday: voided,
        revenueChange: calcChange(totalRevenue, yestRevenue),
        txChange: calcChange(totalTx, yestTx),
        aovChange: calcChange(aov, yestAov),
        loyaltyMembers, totalPoints,
      },
      chartData, topItems, categoryData, paymentData, alerts, staffData,
    };
  };

  const { data, loading, refetch } = useDataLoader(`dashboard_${dateRange}_${activeMerchantId}`, fetchDashboardData);
  useEffect(() => { if (activeMerchantId) refetch(); }, [dateRange, activeMerchantId]);

  const generateAISummary = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const periodLabel = dateRange === 0 ? 'Today' : `last ${dateRange} days`;
      const prompt = `You are a restaurant manager for ${config.businessName || 'this restaurant'}.
Currency: ${config.currency} | Tax: ${config.taxInclusive ? `Inclusive (${config.sstRate})` : 'Exclusive'} | Period: ${periodLabel}
Sales: ${fmt(data.stats.revenue)} (${data.stats.revenueChange} vs yesterday) | Net: ${fmt(data.stats.netSales)}
Orders: ${data.stats.transactions} (${data.stats.txChange}) | AOV: ${fmt(data.stats.aov)} (${data.stats.aovChange})
Customers: ${data.stats.customers} | Tables: ${data.stats.activeTables}/${data.stats.totalTables} active | Idle: ${data.stats.idleTables}
Voided: ${data.stats.voidedToday} | Pending: ${data.stats.openOrders}
${config.loyaltyEnable ? `Loyalty: ${data.stats.loyaltyMembers} members, ${data.stats.totalPoints} pts issued` : ''}
Top Items: ${data.topItems.map((i: any) => `${i.name}(${i.sales})`).join(', ')}
Alerts: ${data.alerts.map((a: any) => a.message).join('; ') || 'None'}
Write a concise 2-3 paragraph professional manager briefing. Be actionable.`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setAiSummary(response.text || 'Could not generate summary.');
    } catch (err: any) {
      console.error('Failed to generate AI summary:', err);
      const isQuota = err?.status === 429 || err?.statusCode === 429 ||
        String(err).includes('429') || String(err).toLowerCase().includes('quota') || String(err).toLowerCase().includes('resourceexhausted');
      setAiSummary(isQuota ? 'AI quota exceeded. Please try again later.' : 'Failed to generate AI summary. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const s = data?.stats;
  const outOfStockCount = lowStockItems.filter(i => i.quantity === 0).length;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {config.businessName
              ? <>{config.businessName} <span className="text-gray-400 dark:text-neutral-500 font-normal text-lg ml-1">/ Dashboard</span></>
              : t('dashboard.title', 'Dashboard Overview')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {t('dashboard.subtitle', 'Real-time performance metrics for your business.')}
          </p>
          <ActiveSettingChips config={config} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <NotificationBell isDark={isDark} alerts={data?.alerts || []} />
          <button
            onClick={generateAISummary} disabled={generating || loading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50',
              themeColors.bgLight, themeColors.border, themeColors.textLight, 'hover:opacity-80',
            )}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Summary
          </button>
          <div className="flex items-center bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-lg shadow-sm overflow-hidden">
            {[{ label: 'Today', value: 0 }, { label: '7D', value: 7 }, { label: '30D', value: 30 }, { label: '90D', value: 90 }].map(opt => (
              <button key={opt.value} onClick={() => setDateRange(opt.value)}
                className={cn('px-3 py-2 text-sm font-medium transition-colors', dateRange === opt.value ? `${themeColors.bg} text-white` : 'text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800')}>
                {opt.label}
              </button>
            ))}
          </div>
          <button
            className={cn('flex items-center gap-2 px-3 py-2 text-white rounded-lg text-sm font-medium transition-all shadow-sm', themeColors.bg, 'hover:opacity-90')}
            onClick={() => onNavigatePage?.('reports')}
          >
            <TrendingUp className="w-4 h-4" /> Reports
          </button>
        </div>
      </div>

      {/* System Status */}
      <SystemStatusBar
        isDark={isDark} config={config} lastUpdated={lastUpdated} loading={loading} onRefresh={refetch}
        lowStockCount={lowStockItems.length} outOfStockCount={outOfStockCount} onNavigateLowStock={handleNavigateToLowStock}
      />

      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-500/20 shadow-sm relative">
          <button onClick={() => setAiSummary(null)} className="absolute top-3 right-3 text-indigo-400 hover:text-indigo-600 dark:text-indigo-300">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">AI Performance Summary</h3>
            <span className="text-xs text-indigo-400 dark:text-indigo-300">· {dateRange === 0 ? 'Today' : `Last ${dateRange} days`} · {config.currency}</span>
          </div>
          <div className="text-sm text-indigo-800 dark:text-indigo-100 space-y-2 leading-relaxed">
            {aiSummary.split('\n').filter(p => p.trim()).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
        <StatCard isDark={isDark} title={t('stat.totalSales', 'Total Sales')} value={fmt(s?.revenue ?? 0)} trend={s?.revenueChange} isPositive={s?.revenueChange?.startsWith('+')} icon={DollarSign} color="indigo" loading={loading} />
        {config.showTax && (
          <StatCard isDark={isDark} title={t('stat.netSales', 'Net Sales')} value={fmt(s?.netSales ?? 0)} trend={s?.revenueChange} isPositive={s?.revenueChange?.startsWith('+')} icon={TrendingUp} color="emerald" loading={loading} />
        )}
        <StatCard isDark={isDark} title={t('stat.orders', 'Orders')} value={(s?.transactions ?? 0).toLocaleString()} trend={s?.txChange} isPositive={s?.txChange?.startsWith('+')} icon={ShoppingCart} color="blue" loading={loading} />
        <StatCard isDark={isDark} title={t('stat.aov', 'Avg Order Value')} value={fmt(s?.aov ?? 0)} trend={s?.aovChange} isPositive={s?.aovChange?.startsWith('+')} icon={CreditCard} color="amber" loading={loading} />
        <StatCard isDark={isDark} title={t('stat.tables', 'Active Tables')} value={`${s?.activeTables ?? 0} / ${s?.totalTables ?? 0}`} trend={null} isPositive={true} icon={LayoutGrid} color="rose" loading={loading} />
        <StatCard isDark={isDark} title={t('stat.open', 'Open Orders')} value={(s?.openOrders ?? 0).toString()} trend={null} isPositive={true} icon={Receipt} color="fuchsia" loading={loading} />
        <StatCard isDark={isDark} title={t('stat.customers', 'Customers')} value={(s?.customers ?? 0).toString()} trend={null} isPositive={true} icon={Users} color="cyan" loading={loading} />
        {config.advancedAnalytics && (
          <StatCard isDark={isDark} title="Idle Tables" value={(s?.idleTables ?? 0).toString()} trend={null} isPositive={false} icon={AlertTriangle} color="amber" loading={loading} />
        )}
        {config.loyaltyEnable && (
          <StatCard isDark={isDark} title="Loyalty Members" value={(s?.loyaltyMembers ?? 0).toLocaleString()} trend={null} isPositive={true} icon={Award} color="indigo" loading={loading} />
        )}
      </div>

      {/* Loyalty Banner */}
      {config.loyaltyEnable && (
        <LoyaltyBanner isDark={isDark} config={config} members={s?.loyaltyMembers ?? 0} points={s?.totalPoints ?? 0} />
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SalesChart isDark={isDark} data={data?.chartData || []} loading={loading} chartType={config.defaultChartType} dateRange={dateRange} />
        </div>
        <div className="lg:col-span-1">
          <RevenueBreakdown isDark={isDark} categoryData={data?.categoryData || []} paymentData={data?.paymentData || []} loading={loading} dateRange={dateRange} />
        </div>
      </div>

      {/* Top Items */}
      {config.advancedAnalytics && data?.topItems?.length > 0 && (
        <TopItemsPanel isDark={isDark} items={data!.topItems} currency={config.currency} />
      )}

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <OperationalStatus isDark={isDark} activeTables={s?.activeTables || 0} totalTables={s?.totalTables || 0} openOrders={s?.openOrders || 0} longestTableTime={s?.longestTableTime || 0} idleTables={s?.idleTables || 0} />
        <AlertsPanel isDark={isDark} alerts={data?.alerts || []} />
        <StaffSnapshot isDark={isDark} staffData={data?.staffData || []} />
      </div>


    </div>
  );
}