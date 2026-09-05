import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, DollarSign, ShoppingBag, Store, Calendar,
  CreditCard, ArrowUpRight, Filter, RefreshCw, BarChart2,
  Award, Eye, Sparkles, ChevronRight, Layers, PieChart as PieIcon
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Merchant, PageTab, PLANS } from '../types';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';

interface AnalyticsTabProps {
  merchants: Merchant[];
  totalMRR: number;
  totalGMV: number;
  totalOrders: number;
  loading: boolean;
  onNavigateTab: (tab: PageTab) => void;
  onInspectMerchant?: (merchant: Merchant) => void;
  onOpenAIChat?: (initialPrompt?: string) => void;
}

interface RawOrder {
  id: string;
  total: number;
  created_at: string;
  payment_method: string | null;
  status: string;
  merchant_id: string;
}

export function AnalyticsTab({
  merchants,
  totalMRR,
  totalGMV,
  totalOrders,
  loading: parentLoading,
  onNavigateTab,
  onInspectMerchant,
  onOpenAIChat,
}: AnalyticsTabProps) {
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
    // If empty or small, ensure at least some chronological points
    if (list.length === 0) {
      return [{ date: 'Today', gmv: periodGMV, orders: periodOrderCount }];
    }
    return list;
  }, [filteredOrders, periodGMV, periodOrderCount]);

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

  // Plan Distribution Breakdown
  const planData = useMemo(() => {
    return PLANS.map(plan => {
      const matchingMerchants = merchants.filter(m => m.plan === plan.id);
      const activeInPlan = matchingMerchants.filter(m => m.plan_status === 'active');
      const planMRR = activeInPlan.reduce((sum, m) => sum + (m.plan_mrr || plan.price), 0);

      return {
        plan: plan.label,
        count: matchingMerchants.length,
        activeCount: activeInPlan.length,
        mrr: planMRR,
        color: plan.id === 'enterprise' ? '#B45309' : plan.id === 'premium' ? '#D97706' : '#94a3b8',
      };
    });
  }, [merchants]);

  // Top Performing Merchants Leaderboard
  const topMerchants = useMemo(() => {
    return [...merchants]
      .sort((a, b) => (b.total_gmv || 0) - (a.total_gmv || 0))
      .slice(0, 8);
  }, [merchants]);

  // Business Category Breakdown
  const categoryData = useMemo(() => {
    const cats: Record<string, { count: number; gmv: number }> = {};
    merchants.forEach(m => {
      const cat = m.business_type || 'Restaurant';
      if (!cats[cat]) cats[cat] = { count: 0, gmv: 0 };
      cats[cat].count += 1;
      cats[cat].gmv += m.total_gmv || 0;
    });

    return Object.entries(cats).map(([name, stat]) => ({
      name,
      merchants: stat.count,
      gmv: stat.gmv,
    }));
  }, [merchants]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ── Top Bar: Header & Time Range Filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Platform Telemetry</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
              Live Real-Time
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1 tracking-tight">
            Platform Analytics & SaaS Performance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated gross merchandise volume, subscription revenues, and transaction telemetry across all {merchants.length} restaurants.
          </p>
        </div>

        {/* Time Filters & AI Trigger */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            {(['all', '30d', '7d', 'today'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-semibold transition-all uppercase text-[10px]',
                  timeRange === range
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                {range === 'all' ? 'All Time' : range === '30d' ? '30 Days' : range === '7d' ? '7 Days' : 'Today'}
              </button>
            ))}
          </div>

          <button
            onClick={() => onOpenAIChat?.('Analyze platform revenue trends and suggest actionable growth levers.')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-all shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
            <span className="hidden sm:inline">AI Trend Analysis</span>
          </button>
        </div>
      </div>

      {/* ── Metric Highlights Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* GMV */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Platform GMV</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            RM {periodGMV.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>AOV: <strong>RM {periodAOV.toFixed(2)}</strong></span>
            <span className="text-emerald-600 font-semibold">{periodOrderCount} orders</span>
          </div>
        </div>

        {/* Monthly Recurring Revenue (MRR) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">SaaS MRR</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#D97706] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            RM {totalMRR.toLocaleString('en-MY')}<span className="text-xs text-slate-400 font-normal">/mo</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>ARR Run-Rate:</span>
            <strong className="text-amber-800">RM {(totalMRR * 12).toLocaleString('en-MY')}/yr</strong>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Orders Volume</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {periodOrderCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Completion Rate:</span>
            <span className="text-blue-600 font-bold">{completionRate}%</span>
          </div>
        </div>

        {/* Pending Revenue Potential */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">MRR Expansion Potential</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-900 tracking-tight">
            +RM {(merchants.filter(m => m.plan_status === 'pending').length * 99).toLocaleString('en-MY')}<span className="text-xs text-slate-400 font-normal">/mo</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{merchants.filter(m => m.plan_status === 'pending').length} pending onboardings</span>
            <button
              onClick={() => onNavigateTab('merchants')}
              className="text-[#D97706] hover:underline font-bold text-[11px]"
            >
              Approve →
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* GMV Volume Timeline (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">GMV & Transaction Volume Trend</h3>
              <p className="text-xs text-slate-400">Chronological platform gross revenue</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="flex items-center gap-1 text-[#D97706]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" /> Gross Sales (RM)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="amberGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
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
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="gmv"
                  stroke="#D97706"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#amberGlow)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan MRR Distribution (1 col) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900">SaaS Plan Distribution</h3>
            <p className="text-xs text-slate-400">MRR contribution per subscription tier</p>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="plan" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `RM ${v}`} />
                <Tooltip
                  formatter={(val: any) => [`RM ${val}`, 'MRR']}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="mrr" radius={[6, 6, 0, 0]}>
                  {planData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Plan Summary Cards */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center text-xs">
            {planData.map(p => (
              <div key={p.plan} className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase">{p.plan}</div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">{p.count} tenants</div>
                <div className="text-[10px] text-amber-700 font-semibold">RM {p.mrr}/mo</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Payment Methods & Top Merchants ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Payment Methods Breakdown */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Payment Breakdown</h3>
              <p className="text-xs text-slate-400">Order payment method telemetry</p>
            </div>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3 mt-4">
            {paymentData.map(item => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{item.name}</span>
                  <span className="text-slate-500 font-bold">{item.count} orders ({item.pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
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

          {/* Business Types Strip */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 mb-2">Category Spread</h4>
            <div className="flex flex-wrap gap-1.5">
              {categoryData.map(c => (
                <span
                  key={c.name}
                  className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-1"
                >
                  <strong className="text-slate-900">{c.name}:</strong> {c.merchants} restaurants
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Top Performing Merchants Leaderboard (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Top Restaurant Leaderboard</h3>
              <p className="text-xs text-slate-400">Top revenue-generating merchant tenants</p>
            </div>
            <button
              onClick={() => onNavigateTab('merchants')}
              className="text-xs font-bold text-[#D97706] hover:text-[#B45309] flex items-center gap-1"
            >
              View All {merchants.length} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Restaurant</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3 text-right">Orders</th>
                  <th className="py-2.5 px-3 text-right">Gross GMV</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {topMerchants.map((m, index) => (
                  <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3">
                      <span className={cn(
                        'w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px]',
                        index === 0 ? 'bg-amber-100 text-amber-900 font-extrabold border border-amber-300' :
                        index === 1 ? 'bg-slate-200 text-slate-800' :
                        index === 2 ? 'bg-amber-50 text-amber-800' :
                        'text-slate-400'
                      )}>
                        #{index + 1}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{m.name}</div>
                      <div className="text-[10px] text-slate-400">{m.city || 'Malaysia'} • {m.business_type || 'Restaurant'}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                        {m.plan}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                      {m.order_count ?? 0}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      RM {(m.total_gmv ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onInspectMerchant?.(m)}
                        className="p-1 rounded-lg text-slate-400 hover:text-[#D97706] hover:bg-amber-50 transition-colors"
                        title="Inspect Merchant Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
