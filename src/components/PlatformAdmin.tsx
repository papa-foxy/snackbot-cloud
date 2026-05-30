import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Store, Eye, Pencil, Ban, CheckCircle2,
  Plus, X, RefreshCw, LogOut, Settings, Clock, Search,
  TrendingUp, Users, Building2, DollarSign, AlertTriangle,
  ChevronRight, Shield, ArrowUpRight, MoreHorizontal, Menu
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/cn';

// ── Types ──────────────────────────────────────────────────────────────────

interface Merchant {
  id: string;
  name: string;
  owner_name:  string | null;
  owner_email: string | null;
  owner_phone: string | null;
  city:        string | null;
  business_type: string | null;
  plan:        string;
  plan_status: string;
  plan_mrr:    number;
  joined_date: string | null;
  branch_count?: number;
  staff_count?:  number;
}

const isDemoMerchant = (merchant: Merchant) =>
  (merchant.business_type ?? '').toLowerCase() === 'demo';

interface ImpersonationLog {
  id:              string;
  merchant_id:     string;
  started_at:      string;
  ended_at:        string | null;
  is_write_access: boolean;
  merchant_name?:  string;
}

type Page = 'dashboard' | 'merchants' | 'access_log' | 'settings';

interface PlatformAdminProps {
  user: { id: string; name: string; email: string };
  onLogout:      () => void;
  onImpersonate: (merchantId: string, merchantName: string, writeAccess: boolean) => void;
}

// ── Plans ──────────────────────────────────────────────────────────────────

const PLANS = [
  { id: 'basic',      label: 'Basic',      price: 99,  accent: '#64748b', ring: 'ring-slate-200',   bg: 'bg-slate-50 text-slate-600',   text: 'text-slate-500'   },
  { id: 'premium',    label: 'Premium',    price: 299, accent: '#4f46e5', ring: 'ring-indigo-100', bg: 'bg-indigo-50 text-indigo-700', text: 'text-indigo-600' },
  { id: 'enterprise', label: 'Enterprise', price: 599, accent: '#d97706', ring: 'ring-amber-100',  bg: 'bg-amber-50 text-amber-700',  text: 'text-amber-600'  },
] as const;

const getPlan = (id: string) => PLANS.find(p => p.id === id) ?? PLANS[0];

// ── Tiny shared components ─────────────────────────────────────────────────

function PlanChip({ plan }: { plan: string }) {
  const p = getPlan(plan);
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ring-1', p.bg, p.ring)}>
      {p.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; label: string; cls: string }> = {
    active:    { dot: 'bg-emerald-500', label: 'Active',    cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/10' },
    suspended: { dot: 'bg-rose-500',     label: 'Suspended', cls: 'text-rose-700 bg-rose-50 ring-rose-600/10' },
    pending:   { dot: 'bg-amber-500',   label: 'Pending',   cls: 'text-amber-700 bg-amber-50 ring-amber-600/10' },
  };
  const c = cfg[status] ?? { dot: 'bg-slate-400', label: status, cls: 'text-slate-600 bg-slate-50 ring-slate-600/10' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ring-1 capitalize', c.cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const letter = (name ?? '?').charAt(0).toUpperCase();
  const hue = (name.charCodeAt(0) * 37) % 360;
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' };
  return (
    <div
      className={cn('rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm', sizes[size])}
      style={{ background: `hsl(${hue},50%,45%)` }}>
      {letter}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-sm"
    />
  );
}

// Fixed Option component rendering issues
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-sm">
      {children}
    </select>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

export function PlatformAdmin({ user, onLogout, onImpersonate }: PlatformAdminProps) {
  const [page, setPage]           = useState<Page>('dashboard');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading]     = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('business')
      .select('id,name,owner_name,owner_email,owner_phone,city,business_type,plan,plan_status,plan_mrr,joined_date')
      .order('joined_date', { ascending: false });

    if (!error && data) {
      const enriched = await Promise.all(data.map(async m => {
        const [{ count: bc }, { count: sc }] = await Promise.all([
          supabase.from('branches').select('id', { count: 'exact', head: true }).eq('merchant_id', m.id),
          supabase.from('users').select('id',    { count: 'exact', head: true }).eq('merchant_id', m.id),
        ]);
        return { ...m, branch_count: bc ?? 0, staff_count: sc ?? 0 };
      }));
      setMerchants(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMerchants(); }, [fetchMerchants]);

  const totalMRR  = merchants.reduce((s, m) => s + (m.plan_mrr || 0), 0);
  const activeCt  = merchants.filter(m => m.plan_status === 'active').length;
  const pendingCt = merchants.filter(m => m.plan_status === 'pending').length;

  const nav: { id: Page; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard',  label: 'Overview',    icon: LayoutDashboard },
    { id: 'merchants',  label: 'Merchants',   icon: Store           },
    { id: 'access_log', label: 'Access Log',  icon: Shield          },
    { id: 'settings',   label: 'Settings',    icon: Settings        },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-700 font-sans">
      
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-56 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 shrink-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>S</div>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-none">SnackBot</div>
              <div className="text-[9px] font-bold tracking-widest uppercase mt-0.5 text-indigo-600">Platform</div>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button 
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {nav.map(n => (
            <button key={n.id} onClick={() => { setPage(n.id); setIsSidebarOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left group',
                page === n.id
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100/50 font-bold'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
              )}>
              <n.icon className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                page === n.id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {n.label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="px-3 py-2 mb-2">
            <div className="text-xs font-bold text-slate-800 truncate">{user.name}</div>
            <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
          </div>
          <button onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all font-semibold">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content pane ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="lg:hidden bg-white border-b border-slate-200/80 px-4 py-3 flex items-center justify-between shrink-0 z-30 shadow-sm">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>S</div>
            <span className="text-xs font-bold text-slate-900 leading-none">SnackBot Platform</span>
          </div>
          <Avatar name={user.name} size="sm" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            {page === 'dashboard'  && <DashboardPage  merchants={merchants} totalMRR={totalMRR} activeCt={activeCt} pendingCt={pendingCt} loading={loading} onNavigate={setPage} onImpersonate={onImpersonate} />}
            {page === 'merchants'  && <MerchantsPage  merchants={merchants} loading={loading} onRefresh={fetchMerchants} setMerchants={setMerchants} onImpersonate={onImpersonate} />}
            {page === 'access_log' && <AccessLogPage  />}
            {page === 'settings'   && <SettingsPage   />}
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────

function DashboardPage({ merchants, totalMRR, activeCt, pendingCt, loading, onNavigate, onImpersonate }: {
  merchants: Merchant[]; totalMRR: number; activeCt: number; pendingCt: number;
  loading: boolean; onNavigate: (p: Page) => void;
  onImpersonate: (id: string, name: string, write: boolean) => void;
}) {
  const stats = [
    { label: 'Monthly Revenue',  value: `RM ${totalMRR.toLocaleString()}`, sub: 'recurring',          icon: DollarSign,   accent: '#4f46e5' },
    { label: 'Active Merchants', value: activeCt,                           sub: `of ${merchants.length} total`, icon: Store,        accent: '#10b981' },
    { label: 'Total Staff',      value: merchants.reduce((s, m) => s + (m.staff_count ?? 0), 0), sub: 'across all accounts', icon: Users, accent: '#7c3aed' },
    { label: 'Pending Approval', value: pendingCt,                          sub: 'need action',        icon: AlertTriangle, accent: '#d97706' },
  ];

  const planDist = PLANS.map(p => ({
    ...p,
    count: merchants.filter(m => m.plan === p.id).length,
    mrr:   merchants.filter(m => m.plan === p.id).reduce((s, m) => s + (m.plan_mrr || 0), 0),
  }));

  return (
    <>
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-xl font-bold text-slate-900">Good morning 👋</h1>
        <p className="text-sm text-slate-500 mt-0.5">Here's what's happening across your platform.</p>
      </div>

      {/* Stat cards - Responsive grid wrapping */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl p-5 border border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.accent}12` }}>
                <s.icon className="w-3.5 h-3.5" style={{ color: s.accent }} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{loading ? '—' : s.value}</div>
            <div className="text-[11px] text-slate-500 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent merchants — 3 cols */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200/60 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800">Recent Merchants</span>
            <button onClick={() => onNavigate('merchants')}
              className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 transition-colors font-bold">
              All merchants <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            {loading
              ? <div className="px-4 py-8 text-center text-xs text-slate-400">Loading…</div>
              : merchants.slice(0, 6).map(m => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-100/50 hover:bg-slate-50/50 transition-colors group"
                  style={{ minWidth: '350px' }}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} size="sm" />
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{m.name}</div>
                      <div className="text-[10px] text-slate-400">{m.city ?? '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PlanChip plan={m.plan} />
                    <span className="text-xs font-bold tabular-nums text-emerald-600">RM {m.plan_mrr}</span>
                    <button onClick={() => onImpersonate(m.id, m.name, false)}
                      className="p-1 rounded-md transition-all hover:bg-indigo-50 text-indigo-600 lg:opacity-0 lg:group-hover:opacity-100">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Plan distribution — 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200/60 bg-white shadow-sm p-5">
          <div className="text-xs font-bold text-slate-800 mb-5">Plan Distribution</div>
          <div className="space-y-5">
            {planDist.map(p => {
              const pct = merchants.length ? Math.round(p.count / merchants.length * 100) : 0;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.accent }} />
                      <span className="text-xs font-bold" style={{ color: p.accent }}>{p.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{p.count} · RM {p.mrr}/mo</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: p.accent }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total MRR</span>
              <span className="text-base font-bold text-indigo-600">RM {totalMRR.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Merchants page ─────────────────────────────────────────────────────────

function MerchantsPage({ merchants, loading, onRefresh, setMerchants, onImpersonate }: {
  merchants: Merchant[]; loading: boolean; onRefresh: () => void;
  setMerchants: React.Dispatch<React.SetStateAction<Merchant[]>>;
  onImpersonate: (id: string, name: string, write: boolean) => void;
}) {
  const [q, setQ]               = useState('');
  const [filter, setFilter]     = useState('all');
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [showNew, setShowNew]   = useState(false);

  const filtered = merchants.filter(m => {
    const matchQ = !q
      || m.name?.toLowerCase().includes(q.toLowerCase())
      || m.owner_name?.toLowerCase().includes(q.toLowerCase())
      || m.city?.toLowerCase().includes(q.toLowerCase());
    const matchF = filter === 'all' || m.plan_status === filter;
    return matchQ && matchF;
  });
  const demoMerchants = filtered.filter(isDemoMerchant);
  const realMerchants = filtered.filter(m => !isDemoMerchant(m));

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('business').update({ plan_status: status }).eq('id', id);
    setMerchants(p => p.map(m => m.id === id ? { ...m, plan_status: status } : m));
  };

  const counts = {
    all:       merchants.length,
    active:    merchants.filter(m => m.plan_status === 'active').length,
    pending:   merchants.filter(m => m.plan_status === 'pending').length,
    suspended: merchants.filter(m => m.plan_status === 'suspended').length,
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Merchants</h1>
          <p className="text-sm text-slate-500 mt-0.5">{merchants.length} total accounts</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={onRefresh}
            className="p-2.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100/40 transition-colors">
            <Plus className="w-4 h-4" /> New Merchant
          </button>
        </div>
      </div>

      {/* Filters + search - Wraps nicely on mobile */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/10 transition-all">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
            placeholder="Search by name, owner or city…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 gap-0.5 shadow-sm overflow-x-auto scrollbar-none">
          {(['all', 'active', 'pending', 'suspended'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider capitalize transition-all whitespace-nowrap',
                filter === f ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              )}>
              {f} <span className="opacity-50 ml-0.5">({counts[f]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Real accounts table */}
      <MerchantTable
        title="Real Accounts"
        merchants={realMerchants}
        loading={loading}
        onOpenMerchant={setSelected}
        onImpersonate={onImpersonate}
        onUpdateStatus={updateStatus}
      />

      {/* Demo accounts table */}
      <MerchantTable
        title="Demo Accounts"
        merchants={demoMerchants}
        loading={loading}
        onOpenMerchant={setSelected}
        onImpersonate={onImpersonate}
        onUpdateStatus={updateStatus}
      />

      {selected && (
        <MerchantDrawer
          merchant={selected}
          onClose={() => setSelected(null)}
          onImpersonate={onImpersonate}
          onUpdateStatus={updateStatus}
          setMerchants={setMerchants}
        />
      )}
      {showNew && (
        <NewMerchantModal
          onClose={() => setShowNew(false)}
          onSaved={m => { setMerchants(p => [m, ...p]); setShowNew(false); }}
        />
      )}
    </>
  );
}

function MerchantTable({
  title,
  merchants,
  loading,
  onOpenMerchant,
  onImpersonate,
  onUpdateStatus,
}: {
  title: string;
  merchants: Merchant[];
  loading: boolean;
  onOpenMerchant: (merchant: Merchant) => void;
  onImpersonate: (id: string, name: string, write: boolean) => void;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6 last:mb-0">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {title} ({merchants.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/30">
              {['Merchant', 'Plan', 'Branches', 'Staff', 'MRR', 'Status', 'Joined', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-400">Loading merchants…</td></tr>
            ) : merchants.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-400">No accounts in this section</td></tr>
            ) : merchants.map(m => (
              <tr key={m.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-100/80 last:border-b-0 cursor-pointer">
                <td className="px-4 py-3" onClick={() => onOpenMerchant(m)}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} size="sm" />
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{m.name}</div>
                      <div className="text-[10px] text-slate-400">{m.owner_name} · {m.city ?? '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3" onClick={() => onOpenMerchant(m)}><PlanChip plan={m.plan} /></td>
                <td className="px-4 py-3 text-xs text-slate-600 tabular-nums" onClick={() => onOpenMerchant(m)}>{m.branch_count ?? 0}</td>
                <td className="px-4 py-3 text-xs text-slate-600 tabular-nums" onClick={() => onOpenMerchant(m)}>{m.staff_count ?? 0}</td>
                <td className="px-4 py-3 text-xs font-bold tabular-nums text-emerald-600" onClick={() => onOpenMerchant(m)}>RM {m.plan_mrr}</td>
                <td className="px-4 py-3" onClick={() => onOpenMerchant(m)}><StatusDot status={m.plan_status} /></td>
                <td className="px-4 py-3 text-[10px] text-slate-400" onClick={() => onOpenMerchant(m)}>{m.joined_date?.slice(0, 10) ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { console.log('[Impersonate] READ', { merchantId: m.id, merchantName: m.name }); onImpersonate(m.id, m.name, false); }} title="View (read-only)"
                      className="p-1.5 rounded-lg transition-colors hover:bg-indigo-50 text-indigo-600">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { console.log('[Impersonate] WRITE', { merchantId: m.id, merchantName: m.name }); onImpersonate(m.id, m.name, true); }} title="Act (write access)"
                      className="p-1.5 rounded-lg transition-colors hover:bg-amber-50 text-amber-600">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {m.plan_status === 'active' && (
                      <button onClick={() => onUpdateStatus(m.id, 'suspended')} title="Suspend"
                        className="p-1.5 rounded-lg transition-colors hover:bg-rose-50 text-rose-600">
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {m.plan_status === 'suspended' && (
                      <button onClick={() => onUpdateStatus(m.id, 'active')} title="Reactivate"
                        className="p-1.5 rounded-lg transition-colors hover:bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {m.plan_status === 'pending' && (
                      <button onClick={() => onUpdateStatus(m.id, 'active')} title="Approve"
                        className="p-1.5 rounded-lg transition-colors hover:bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Merchant drawer ────────────────────────────────────────────────────────

function MerchantDrawer({ merchant, onClose, onImpersonate, onUpdateStatus, setMerchants }: {
  merchant: Merchant;
  onClose: () => void;
  onImpersonate: (id: string, name: string, write: boolean) => void;
  onUpdateStatus: (id: string, status: string) => void;
  setMerchants: React.Dispatch<React.SetStateAction<Merchant[]>>;
}) {
  const [tab, setTab]       = useState<'overview' | 'plan' | 'audit'>('overview');
  const [plan, setPlan]     = useState(merchant.plan);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs]     = useState<any[]>([]);

  useEffect(() => {
    if (tab !== 'audit') return;
    supabase.from('audit_logs').select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setLogs(data ?? []));
  }, [tab, merchant.id]);

  const savePlan = async () => {
    setSaving(true);
    const mrr = PLANS.find(p => p.id === plan)?.price ?? 0;
    await supabase.from('business').update({ plan, plan_mrr: mrr }).eq('id', merchant.id);
    setMerchants(p => p.map(m => m.id === merchant.id ? { ...m, plan, plan_mrr: mrr } : m));
    setSaving(false);
  };

  const infoRows = [
    ['Owner',    merchant.owner_name  ?? '—'],
    ['Email',    merchant.owner_email ?? '—'],
    ['Phone',    merchant.owner_phone ?? '—'],
    ['City',     merchant.city        ?? '—'],
    ['Business Type', merchant.business_type ?? '—'],
    ['Joined',   merchant.joined_date?.slice(0, 10) ?? '—'],
    ['Branches', String(merchant.branch_count ?? 0)],
    ['Staff',    String(merchant.staff_count  ?? 0)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      
      {/* Drawer */}
      <aside className="relative w-full sm:w-[500px] h-full flex flex-col bg-white border-l border-slate-200 shadow-2xl z-10 animate-in slide-in-from-right duration-250">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Avatar name={merchant.name} size="md" />
            <div>
              <div className="text-sm font-bold text-slate-800">{merchant.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <PlanChip plan={merchant.plan} />
                <StatusDot status={merchant.plan_status} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Impersonate buttons */}
        <div className="flex gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <button onClick={() => { console.log('[Impersonate Drawer] READ', { merchantId: merchant.id, merchantName: merchant.name }); onImpersonate(merchant.id, merchant.name, false); onClose(); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 shadow-sm transition-all">
            <Eye className="w-3.5 h-3.5" /> View as Merchant
          </button>
          <button onClick={() => { console.log('[Impersonate Drawer] WRITE', { merchantId: merchant.id, merchantName: merchant.name }); onImpersonate(merchant.id, merchant.name, true); onClose(); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 shadow-sm transition-all">
            <Pencil className="w-3.5 h-3.5" /> Act as Merchant
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 border-b border-slate-100">
          {(['overview', 'plan', 'audit'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('py-3.5 px-4 text-xs font-bold uppercase tracking-wider capitalize border-b-2 -mb-px transition-colors',
                tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Overview */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {infoRows.map(([k, v]) => (
                  <div key={k} className="rounded-xl p-3 bg-slate-50/60 border border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">{k}</div>
                    <div className="text-xs font-bold text-slate-800 truncate">{v}</div>
                  </div>
                ))}
              </div>
              {/* Status control */}
              <div className="rounded-xl p-4 bg-slate-50/60 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">Account Status</div>
                  <StatusDot status={merchant.plan_status} />
                </div>
                <div className="flex gap-2">
                  {merchant.plan_status === 'active' && (
                    <button onClick={() => onUpdateStatus(merchant.id, 'suspended')}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 transition-colors shadow-sm">
                      Suspend
                    </button>
                  )}
                  {merchant.plan_status === 'suspended' && (
                    <button onClick={() => onUpdateStatus(merchant.id, 'active')}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 transition-colors shadow-sm">
                      Reactivate
                    </button>
                  )}
                  {merchant.plan_status === 'pending' && (
                    <button onClick={() => onUpdateStatus(merchant.id, 'active')}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 transition-colors shadow-sm">
                      Approve
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Plan */}
          {tab === 'plan' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-4">Select a plan and save to apply the change immediately.</p>
              {PLANS.map(p => (
                <div key={p.id} onClick={() => setPlan(p.id)}
                  className={cn(
                    "p-4 rounded-xl cursor-pointer border transition-all shadow-sm",
                    plan === p.id ? "bg-indigo-50/40 border-indigo-200" : "bg-white border-slate-200 hover:bg-slate-50"
                  )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all bg-white"
                        style={{ borderColor: plan === p.id ? p.accent : '#cbd5e1' }}>
                        {plan === p.id && <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.accent }} />}
                      </div>
                      <span className="text-sm font-bold" style={{ color: plan === p.id ? p.accent : '#475569' }}>{p.label}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">RM {p.price}<span className="text-xs text-slate-400 font-normal">/mo</span></span>
                  </div>
                </div>
              ))}
              <button onClick={savePlan} disabled={saving || plan === merchant.plan}
                className="w-full mt-4 py-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? 'Saving…' : 'Save Plan Change'}
              </button>
            </div>
          )}

          {/* Audit */}
          {tab === 'audit' && (
            <div className="space-y-3">
              {logs.length === 0
                ? <p className="text-xs text-slate-400 text-center py-10">No audit logs found</p>
                : logs.map(log => (
                  <div key={log.id} className="rounded-xl p-3 border border-slate-100 bg-slate-50/40">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">{log.action ?? log.event ?? 'Action'}</span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 shrink-0',
                        log.status === 'success' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' : 'bg-rose-50 text-rose-700 ring-rose-600/10')}>
                        {log.status ?? 'logged'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1.5">{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ── New merchant modal ─────────────────────────────────────────────────────

function NewMerchantModal({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: (m: Merchant) => void;
}) {
  const [form, setForm] = useState({
    name: '', owner_name: '', owner_email: '',
    owner_phone: '', city: '', business_type: 'F&B', plan: 'basic',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const up = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name || !form.owner_email) { setError('Business name and email are required.'); return; }
    setSaving(true); setError('');
    const mrr = PLANS.find(p => p.id === form.plan)?.price ?? 0;
    const { data, error: err } = await supabase
      .from('business')
      .insert({ ...form, plan_mrr: mrr, plan_status: 'pending', joined_date: new Date().toISOString().slice(0, 10) })
      .select().single();
    if (err) { setError(err.message); setSaving(false); return; }
    onSaved(data as Merchant);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl bg-white border border-slate-200 animate-in zoom-in-95 duration-150">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Create Merchant</h2>
            <p className="text-xs text-slate-500 mt-0.5">Will be set to pending until approved</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs bg-rose-50 border border-rose-200 text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2">
            <Field label="Business Name"><Input placeholder="Restoran Nasi Lemak ABC" value={form.name} onChange={e => up('name', e.target.value)} /></Field>
          </div>
          <Field label="Owner Name"><Input placeholder="Ahmad Faris" value={form.owner_name} onChange={e => up('owner_name', e.target.value)} /></Field>
          <Field label="Owner Email"><Input type="email" placeholder="owner@biz.my" value={form.owner_email} onChange={e => up('owner_email', e.target.value)} /></Field>
          <Field label="Phone"><Input placeholder="+60 12-345 6789" value={form.owner_phone} onChange={e => up('owner_phone', e.target.value)} /></Field>
          <Field label="City"><Input placeholder="Kuala Lumpur" value={form.city} onChange={e => up('city', e.target.value)} /></Field>
          <div className="col-span-2">
            <Field label="Business Type">
              <Select value={form.business_type} onChange={e => up('business_type', e.target.value)}>
                {['F&B', 'Restaurant', 'Café', 'Fast Food', 'Bakery', 'Retail'].map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
        </div>

        {/* Plan selector */}
        <Field label="Subscription Plan">
          <div className="flex gap-2 mt-1.5">
            {PLANS.map(p => (
              <button key={p.id} onClick={() => up('plan', p.id)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-center border transition-all shadow-sm",
                  form.plan === p.id ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                )}>
                <div className="text-xs font-bold">{p.label}</div>
                <div className="text-[9px] opacity-80 mt-0.5">RM {p.price}/mo</div>
              </button>
            ))}
          </div>
        </Field>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 shadow-md shadow-indigo-100/40 transition-all">
            {saving ? 'Creating…' : 'Create Merchant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Access Log ─────────────────────────────────────────────────────────────

function AccessLogPage() {
  const [logs, setLogs]       = useState<ImpersonationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('impersonation_sessions')
      .select('*, business:merchant_id(name)')
      .order('started_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setLogs((data ?? []).map((d: any) => ({ ...d, merchant_name: d.business?.name })));
        setLoading(false);
      });
  }, []);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Access Log</h1>
        <p className="text-sm text-slate-500 mt-0.5">Every impersonation session by platform admins</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {['Merchant', 'Access Type', 'Started', 'Duration', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">No sessions recorded yet</td></tr>
              ) : logs.map(log => {
                const duration = log.ended_at
                  ? Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000)
                  : null;
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 text-xs font-bold text-slate-800">{log.merchant_name ?? log.merchant_id.slice(0, 8) + '…'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100/50"
                        style={log.is_write_access
                          ? { background: 'rgba(217,119,6,0.1)', color: '#d97706', border: '1px solid rgba(217,119,6,0.2)' }
                          : {}}>
                        {log.is_write_access ? <Pencil className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                        {log.is_write_access ? 'Write' : 'Read'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">{new Date(log.started_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">
                      {duration !== null
                        ? `${duration} min`
                        : <span className="flex items-center gap-1 text-amber-600 font-semibold"><Clock className="w-3.5 h-3.5 animate-pulse" />Active</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded ring-1',
                        log.ended_at 
                          ? 'bg-slate-100 text-slate-500 ring-slate-200' 
                          : 'bg-amber-50 text-amber-700 ring-amber-200')}>
                        {log.ended_at ? 'Ended' : 'Active'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────

function SettingsPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Platform Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">System-wide configuration and policies</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-bold text-slate-800 mb-4 uppercase tracking-widest border-b border-slate-100 pb-2">Plans</h2>
          <div className="space-y-1">
            {PLANS.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3 border-b border-slate-100/50 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.accent }} />
                  <span className="text-xs font-semibold text-slate-700">{p.label}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: p.accent }}>RM {p.price}<span className="text-slate-400 font-normal">/mo</span></span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-bold text-slate-800 mb-4 uppercase tracking-widest border-b border-slate-100 pb-2">Security Policies</h2>
          <div className="space-y-1">
            {[
              ['Impersonation logging',      'Enabled'],
              ['Write-access confirmation',  'Required'],
              ['Session auto-expire',        '4 hours'],
              ['Audit log retention',        '90 days'],
              ['RLS enforcement',            'All tables'],
              ['Cross-tenant data access',   'Blocked'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-3 border-b border-slate-100/50 last:border-b-0">
                <span className="text-xs text-slate-600">{label}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}