import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Store, ShoppingBag, ShieldCheck,
  ChevronRight, Eye, Pencil, Activity, ArrowUpRight,
  TrendingUp, CreditCard, Sparkles, Filter, Award, BarChart2
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Merchant, PageTab, PLANS } from '../types';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';

interface OverviewTabProps {
  merchants: Merchant[];
  totalMRR: number;
  totalGMV: number;
  totalOrders: number;
  activeCt: number;
  pendingCt: number;
  loading: boolean;
  onNavigate: (tab: PageTab) => void;
  onImpersonate: (id: string, name: string, write: boolean) => void;
  onInspectMerchant?: (merchant: Merchant) => void;
  onOpenAIChat?: (prompt?: string) => void;
}

interface RawOrder {
  id: string;
  total: number;
  created_at: string;
  payment_method: string | null;
  status: string;
  merchant_id: string;
}

export function OverviewTab({
  merchants,
  totalMRR,
  totalGMV,
  totalOrders,
  activeCt,
  pendingCt,
  loading,
  onNavigate,
  onImpersonate,
  onInspectMerchant,
  onOpenAIChat,
}: OverviewTabProps) {
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [timeRange, setTimeRange] = useState<'all' | '30d' | '7d' | 'today'>('all');

  // Fetch full orders for granular analytics
  const fetchOrders = async () => {
    setLoadingOrders(true);
    const { data } = await supabase
      .from('orders')
      .select('id, total, created_at, payment_method, status, merchant_id')
      .order('created_at', { ascending: true });

    setOrders((data as RawOrder[]) || []);
    setLoadingOrders(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Filter orders by time range
  const filteredOrders = useMemo(() => {
    if (timeRange === 'all') return orders;
    const now = new Date().getTime();
    const days = timeRange === 'today' ? 1 : timeRange === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    return orders.filter(o => {
      const orderTime = new Date(o.created_at).getTime();
      return orderTime >= cutoff;
    });
  }, [orders, timeRange]);

  // Aggregated KPIs
  const periodGMV = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredOrders]);

  const periodOrderCount = filteredOrders.length;
  const periodAOV = periodOrderCount > 0 ? periodGMV / periodOrderCount : 0;
  const completedOrders = filteredOrders.filter(o => o.status === 'completed').length;
  const completionRate = periodOrderCount > 0 ? Math.round((completedOrders / periodOrderCount) * 100) : 100;

  // Timeline Data for Recharts AreaChart
  const timelineData = useMemo(() => {
    const map = new Map<string, { date: string; gmv: number; orders: number }>();

    filteredOrders.forEach(o => {
      const d = new Date(o.created_at);
      const dateKey = `${d.getMonth() + 1}/${d.getDate()}`;
      const existing = map.get(dateKey) || { date: dateKey, gmv: 0, orders: 0 };
      existing.gmv += Number(o.total) || 0;
      existing.orders += 1;
      map.set(dateKey, existing);
    });

    const list = Array.from(map.values());
    if (list.length === 0) {
      return [{ date: 'Today', gmv: periodGMV, orders: periodOrderCount }];
    }
    return list;
  }, [filteredOrders, periodGMV, periodOrderCount]);

  // Plan Distribution Breakdown
  const planDist = useMemo(() => {
    return PLANS.map(p => {
      const matching = merchants.filter(m => m.plan === p.id);
      const activeInPlan = matching.filter(m => m.plan_status === 'active');
      return {
        ...p,
        count: matching.length,
        activeCount: activeInPlan.length,
        mrr: activeInPlan.reduce((s, m) => s + (m.plan_mrr || p.price), 0),
        color: p.id === 'enterprise' ? '#B45309' : p.id === 'premium' ? '#D97706' : '#94a3b8',
      };
    });
  }, [merchants]);

  // Payment Method Breakdown
  const paymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      const method = (o.payment_method || 'cash').toUpperCase();
      counts[method] = (counts[method] || 0) + 1;
    });

    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: periodOrderCount > 0 ? Math.round((count / periodOrderCount) * 100) : 0,
    }));
  }, [filteredOrders, periodOrderCount]);

  // Top Performing Merchants Leaderboard
  const topMerchants = useMemo(() => {
    return [...merchants]
      .sort((a, b) => (b.total_gmv || 0) - (a.total_gmv || 0))
      .slice(0, 6);
  }, [merchants]);

  // Category Spread
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    merchants.forEach(m => {
      const cat = m.business_type || 'Restaurant';
      cats[cat] = (cats[cat] || 0) + 1;
    });
    return Object.entries(cats).map(([name, count]) => ({ name, count }));
  }, [merchants]);

  const stats = [
    {
      label: 'Gross Sales (GMV)',
      value: `RM ${periodGMV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${periodOrderCount} orders (AOV: RM ${periodAOV.toFixed(2)})`,
      icon: ShoppingBag,
      accent: '#D97706',
      badge: timeRange === 'all' ? 'All Time' : timeRange.toUpperCase(),
    },
    {
      label: 'Monthly Run Rate (MRR)',
      value: `RM ${totalMRR.toLocaleString()}`,
      sub: `ARR Run-Rate: RM ${(totalMRR * 12).toLocaleString()}`,
      icon: DollarSign,
      accent: '#B45309',
      badge: `${activeCt} active`,
    },
    {
      label: 'Active Restaurants',
      value: activeCt,
      sub: `${pendingCt} pending approval (+RM ${pendingCt * 99}/mo)`,
      icon: Store,
      accent: '#10B981',
      badge: `${merchants.length} total`,
    },
    {
      label: 'Platform Status',
      value: '99.9% Uptime',
      sub: `Keepalive active • ${completionRate}% order completion`,
      icon: ShieldCheck,
      accent: '#059669',
      badge: 'Protected',
    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ── Compact Header Bar with Time Filters & Quick AI ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
              <Activity className="w-2.5 h-2.5 text-amber-600 animate-pulse" /> Superadmin Console
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">Real-time Platform Telemetry</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1 tracking-tight">
            Dashboard Overview & Analytics
          </h1>
        </div>

        {/* Time Filters & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            {(['all', '30d', '7d', 'today'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-2.5 py-1 rounded-lg font-semibold transition-all uppercase text-[10px]',
                  timeRange === range
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                {range === 'all' ? 'All' : range}
              </button>
            ))}
          </div>

          <button
            onClick={() => onOpenAIChat?.('Give me a 30-second platform executive snapshot and revenue trends.')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-all shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
            <span>AI Snapshot</span>
          </button>

          <button
            onClick={() => onNavigate('merchants')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] shadow-xs transition-all flex items-center gap-1"
          >
            Restaurants ({merchants.length}) <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Key Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, idx) => (
          <div
            key={idx}
            className="rounded-xl p-3.5 border border-slate-200 bg-white shadow-xs hover:border-amber-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shadow-xs"
                style={{ background: `${s.accent}12`, color: s.accent }}
              >
                <s.icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="text-xl font-bold text-slate-900 tracking-tight tabular-nums">
              {loading ? '—' : s.value}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
              <span className="text-slate-500 truncate text-[10px]">{s.sub}</span>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                {s.badge}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Analytics Visualizations Row: GMV Timeline AreaChart & Plan MRR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* GMV Timeline AreaChart (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-xs p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  GMV & Transaction Timeline
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                  {timeRange === 'all' ? 'All Time' : timeRange.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Chronological gross revenue volume across restaurant terminals</p>
            </div>
            <div className="text-xs font-bold text-slate-900">
              RM {periodGMV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="amberGlowOverview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => `RM ${val}`}
                />
                <Tooltip
                  formatter={(value: any) => [`RM ${Number(value).toFixed(2)}`, 'GMV']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    border: 'none',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="gmv"
                  stroke="#D97706"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#amberGlowOverview)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution & MRR Contribution (1 col) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Plan Subscriptions</span>
              <span className="text-[11px] font-bold text-slate-500">{merchants.length} Total</span>
            </div>

            <div className="h-32 w-full mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planDist} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `RM ${v}`} />
                  <Tooltip
                    formatter={(val: any) => [`RM ${val}`, 'MRR']}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      border: 'none',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="mrr" radius={[4, 4, 0, 0]}>
                    {planDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5">
              {planDist.map(p => {
                const pct = merchants.length ? Math.round((p.count / merchants.length) * 100) : 0;
                return (
                  <div key={p.id} className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                      <span className="font-bold text-slate-800">{p.label}</span>
                      <span className="text-slate-400">({p.count} tenants)</span>
                    </div>
                    <span className="font-bold text-slate-800">RM {p.mrr.toLocaleString()}/mo</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Total SaaS MRR</span>
              <strong className="text-amber-800">RM {totalMRR.toLocaleString()}/mo</strong>
            </div>
            <button
              onClick={() => onNavigate('settings')}
              className="text-[11px] font-bold text-[#D97706] hover:underline"
            >
              Plan Settings →
            </button>
          </div>
        </div>
      </div>

      {/* ── Top Restaurants Leaderboard & Payment Method Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Top Performing Restaurants (3 cols) */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-[#D97706]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Top Performing Restaurants
                </span>
              </div>
              <button
                onClick={() => onNavigate('merchants')}
                className="flex items-center gap-1 text-xs text-[#D97706] hover:text-[#B45309] font-bold transition-colors"
              >
                View all {merchants.length} <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                    <th className="py-2.5 px-4">Rank</th>
                    <th className="py-2.5 px-4">Restaurant</th>
                    <th className="py-2.5 px-4">Plan</th>
                    <th className="py-2.5 px-4 text-right">Orders</th>
                    <th className="py-2.5 px-4 text-right">GMV (RM)</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {topMerchants.map((m, index) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2 px-4">
                        <span className={cn(
                          'w-5 h-5 rounded flex items-center justify-center font-bold text-[10px]',
                          index === 0 ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold' :
                          index === 1 ? 'bg-slate-200 text-slate-800' :
                          index === 2 ? 'bg-amber-50 text-amber-800' :
                          'text-slate-400'
                        )}>
                          #{index + 1}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        <div className="font-bold text-slate-900">{m.name}</div>
                        <div className="text-[10px] text-slate-400">{m.city || 'Malaysia'}</div>
                      </td>
                      <td className="py-2 px-4">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          {m.plan}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right font-medium text-slate-700">
                        {m.order_count ?? 0}
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-slate-900">
                        RM {(m.total_gmv ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onInspectMerchant?.(m)}
                            className="p-1 rounded text-slate-400 hover:text-[#D97706] hover:bg-amber-50 transition-colors"
                            title="Inspect Restaurant"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onImpersonate(m.id, m.name, true)}
                            className="p-1 rounded text-amber-700 hover:bg-amber-100 transition-colors"
                            title="Act as Merchant"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Payment Methods Breakdown & Categories (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-[#D97706]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Payment Breakdown
                </span>
              </div>
              <span className="text-[11px] text-slate-400">{periodOrderCount} orders</span>
            </div>

            <div className="space-y-2.5 mb-4">
              {paymentData.map(item => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">{item.name}</span>
                    <span className="text-slate-500 font-bold">{item.count} orders ({item.pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        item.name === 'QR' || item.name === 'DUITNOW' ? 'bg-[#D97706]' :
                        item.name === 'CASH' ? 'bg-emerald-500' : 'bg-blue-500'
                      )}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Business Category Spread */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-800 mb-2">Category Distribution</div>
              <div className="flex flex-wrap gap-1.5">
                {categoryData.map(c => (
                  <span
                    key={c.name}
                    className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[10px] text-slate-600 font-medium"
                  >
                    <strong>{c.name}:</strong> {c.count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Need deep operational diagnostics?</span>
            <button
              onClick={() => onNavigate('expert_system')}
              className="font-bold text-[#D97706] hover:underline flex items-center gap-1"
            >
              Open Platform Doctor →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
