import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Store, Eye, Pencil, Ban, CheckCircle2,
  Plus, X, RefreshCw, LogOut, Settings, Clock, Search,
  TrendingUp, Users, Building2, DollarSign, AlertTriangle,
  ChevronRight, Shield, ArrowUpRight, MoreHorizontal
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
  { id: 'basic',      label: 'Basic',      price: 99,  accent: '#6B7280', ring: 'ring-gray-500/30',   bg: 'bg-gray-50 dark:bg-neutral-800/500/10',   text: 'text-gray-400 dark:text-neutral-500'   },
  { id: 'premium',    label: 'Premium',    price: 299, accent: '#6366F1', ring: 'ring-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
  { id: 'enterprise', label: 'Enterprise', price: 599, accent: '#F59E0B', ring: 'ring-amber-500/30',  bg: 'bg-amber-500/10',  text: 'text-amber-400'  },
] as const;

const getPlan = (id: string) => PLANS.find(p => p.id === id) ?? PLANS[0];

// ── Tiny shared components ─────────────────────────────────────────────────

function PlanChip({ plan }: { plan: string }) {
  const p = getPlan(plan);
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ring-1', p.bg, p.text, p.ring)}>
      {p.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; label: string; cls: string }> = {
    active:    { dot: 'bg-emerald-400', label: 'Active',    cls: 'text-emerald-400 bg-emerald-400/10 ring-emerald-400/20' },
    suspended: { dot: 'bg-red-400',     label: 'Suspended', cls: 'text-red-400     bg-red-400/10     ring-red-400/20'     },
    pending:   { dot: 'bg-amber-400',   label: 'Pending',   cls: 'text-amber-400   bg-amber-400/10   ring-amber-400/20'   },
  };
  const c = cfg[status] ?? { dot: 'bg-gray-50 dark:bg-neutral-800/500', label: status, cls: 'text-gray-400 dark:text-neutral-500 bg-gray-400/10 ring-gray-400/20' };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ring-1 capitalize', c.cls)}>
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
      className={cn('rounded-xl flex items-center justify-center font-bold text-white shrink-0', sizes[size])}
      style={{ background: `hsl(${hue},55%,45%)` }}>
      {letter}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-widest mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-[#0d0f14] border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 dark:text-neutral-400 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
    />
  );
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full bg-[#0d0f14] border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all">
      {children}
    </select>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

export function PlatformAdmin({ user, onLogout, onImpersonate }: PlatformAdminProps) {
  const [page, setPage]           = useState<Page>('dashboard');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading]     = useState(true);

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
    <div className="flex h-screen overflow-hidden" style={{ background: '#080a0f', color: '#e2e8f0', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="w-52 shrink-0 flex flex-col border-r" style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.06)' }}>

        {/* Logo */}
        <div className="px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>S</div>
            <div>
              <div className="text-xs font-bold text-white leading-none">SnackBot</div>
              <div className="text-[9px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: '#6366f1' }}>Platform</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {nav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left',
                page === n.id
                  ? 'text-white'
                  : 'text-gray-500 dark:text-neutral-500 hover:text-gray-300 hover:bg-white dark:bg-[var(--sb-card)]/4'
              )}
              style={page === n.id ? { background: 'rgba(99,102,241,0.15)', color: '#818cf8' } : {}}>
              <n.icon className="w-3.5 h-3.5 shrink-0" />
              {n.label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="p-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-3 py-2 mb-1">
            <div className="text-xs font-semibold text-white truncate">{user.name}</div>
            <div className="text-[10px] text-gray-600 dark:text-neutral-400 truncate">{user.email}</div>
          </div>
          <button onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 dark:text-neutral-500 hover:text-red-400 hover:bg-red-400/5 transition-all">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {page === 'dashboard'  && <DashboardPage  merchants={merchants} totalMRR={totalMRR} activeCt={activeCt} pendingCt={pendingCt} loading={loading} onNavigate={setPage} onImpersonate={onImpersonate} />}
          {page === 'merchants'  && <MerchantsPage  merchants={merchants} loading={loading} onRefresh={fetchMerchants} setMerchants={setMerchants} onImpersonate={onImpersonate} />}
          {page === 'access_log' && <AccessLogPage  />}
          {page === 'settings'   && <SettingsPage   />}
        </div>
      </main>
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
    { label: 'Monthly Revenue',  value: `RM ${totalMRR.toLocaleString()}`, sub: 'recurring',          icon: DollarSign,   accent: '#6366f1' },
    { label: 'Active Merchants', value: activeCt,                           sub: `of ${merchants.length} total`, icon: Store,        accent: '#10b981' },
    { label: 'Total Staff',      value: merchants.reduce((s, m) => s + (m.staff_count ?? 0), 0), sub: 'across all accounts', icon: Users, accent: '#8b5cf6' },
    { label: 'Pending Approval', value: pendingCt,                          sub: 'need action',        icon: AlertTriangle, accent: '#f59e0b' },
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
        <h1 className="text-lg font-bold text-white">Good morning 👋</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">Here's what's happening across your platform.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl p-4 border" style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-neutral-500">{s.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.accent}18` }}>
                <s.icon className="w-3.5 h-3.5" style={{ color: s.accent }} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">{loading ? '—' : s.value}</div>
            <div className="text-[11px] text-gray-600 dark:text-neutral-400 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Recent merchants — 3 cols */}
        <div className="col-span-3 rounded-xl border overflow-hidden" style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xs font-bold text-white">Recent Merchants</span>
            <button onClick={() => onNavigate('merchants')}
              className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-semibold">
              All merchants <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div>
            {loading
              ? <div className="px-4 py-8 text-center text-xs text-gray-600 dark:text-neutral-400">Loading…</div>
              : merchants.slice(0, 6).map(m => (
                <div key={m.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white dark:bg-[var(--sb-card)]/2 transition-colors group"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} size="sm" />
                    <div>
                      <div className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">{m.name}</div>
                      <div className="text-[10px] text-gray-600 dark:text-neutral-400">{m.city ?? '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PlanChip plan={m.plan} />
                    <span className="text-xs font-bold tabular-nums" style={{ color: '#10b981' }}>RM {m.plan_mrr}</span>
                    <button onClick={() => onImpersonate(m.id, m.name, false)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md transition-all hover:bg-indigo-500/20 text-indigo-400">
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Plan distribution — 2 cols */}
        <div className="col-span-2 rounded-xl border p-4" style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-bold text-white mb-5">Plan Distribution</div>
          <div className="space-y-5">
            {planDist.map(p => {
              const pct = merchants.length ? Math.round(p.count / merchants.length * 100) : 0;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.accent }} />
                      <span className="text-xs font-semibold" style={{ color: p.accent }}>{p.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-neutral-500">{p.count} · RM {p.mrr}/mo</span>
                  </div>
                  <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: p.accent }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-widest font-semibold">Total MRR</span>
              <span className="text-base font-bold" style={{ color: '#6366f1' }}>RM {totalMRR.toLocaleString()}</span>
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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">Merchants</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">{merchants.length} total accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh}
            className="p-2 rounded-lg border text-gray-500 dark:text-neutral-500 hover:text-white transition-colors"
            style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.08)' }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
            style={{ background: '#6366f1' }}>
            <Plus className="w-3.5 h-3.5" /> New Merchant
          </button>
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 rounded-lg border px-3 py-2"
          style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.08)' }}>
          <Search className="w-3.5 h-3.5 text-gray-600 dark:text-neutral-400 shrink-0" />
          <input className="flex-1 bg-transparent text-xs text-gray-200 placeholder:text-gray-600 dark:text-neutral-400 outline-none"
            placeholder="Search by name, owner or city…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="flex rounded-lg border p-0.5 gap-0.5" style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.08)' }}>
          {(['all', 'active', 'pending', 'suspended'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 rounded-md text-[10px] font-bold capitalize transition-all',
                filter === f ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-neutral-500 hover:text-gray-300'
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
    <div className="rounded-xl border overflow-hidden mb-5 last:mb-0" style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-neutral-400">
          {title} ({merchants.length})
        </h2>
      </div>
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Merchant', 'Plan', 'Branches', 'Staff', 'MRR', 'Status', 'Joined', ''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-widest">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-gray-600 dark:text-neutral-400">Loading merchants…</td></tr>
          ) : merchants.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-gray-600 dark:text-neutral-400">No accounts in this section</td></tr>
          ) : merchants.map(m => (
            <tr key={m.id} className="group hover:bg-white dark:bg-[var(--sb-card)]/2 transition-colors cursor-pointer"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td className="px-4 py-3" onClick={() => onOpenMerchant(m)}>
                <div className="flex items-center gap-2.5">
                  <Avatar name={m.name} size="sm" />
                  <div>
                    <div className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">{m.name}</div>
                    <div className="text-[10px] text-gray-600 dark:text-neutral-400">{m.owner_name} · {m.city ?? '—'}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3"><PlanChip plan={m.plan} /></td>
              <td className="px-4 py-3 text-xs text-gray-500 dark:text-neutral-500 tabular-nums">{m.branch_count ?? 0}</td>
              <td className="px-4 py-3 text-xs text-gray-500 dark:text-neutral-500 tabular-nums">{m.staff_count ?? 0}</td>
              <td className="px-4 py-3 text-xs font-bold tabular-nums" style={{ color: '#10b981' }}>RM {m.plan_mrr}</td>
              <td className="px-4 py-3"><StatusDot status={m.plan_status} /></td>
              <td className="px-4 py-3 text-[10px] text-gray-600 dark:text-neutral-400">{m.joined_date?.slice(0, 10) ?? '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { console.log('[Impersonate] READ', { merchantId: m.id, merchantName: m.name }); onImpersonate(m.id, m.name, false); }} title="View (read-only)"
                    className="p-1.5 rounded-md transition-colors hover:bg-indigo-500/20 text-indigo-400">
                    <Eye className="w-3 h-3" />
                  </button>
                  <button onClick={() => { console.log('[Impersonate] WRITE', { merchantId: m.id, merchantName: m.name }); onImpersonate(m.id, m.name, true); }} title="Act (write access)"
                    className="p-1.5 rounded-md transition-colors hover:bg-amber-500/20 text-amber-400">
                    <Pencil className="w-3 h-3" />
                  </button>
                  {m.plan_status === 'active' && (
                    <button onClick={() => onUpdateStatus(m.id, 'suspended')} title="Suspend"
                      className="p-1.5 rounded-md transition-colors hover:bg-red-500/20 text-red-400">
                      <Ban className="w-3 h-3" />
                    </button>
                  )}
                  {m.plan_status === 'suspended' && (
                    <button onClick={() => onUpdateStatus(m.id, 'active')} title="Reactivate"
                      className="p-1.5 rounded-md transition-colors hover:bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                    </button>
                  )}
                  {m.plan_status === 'pending' && (
                    <button onClick={() => onUpdateStatus(m.id, 'active')} title="Approve"
                      className="p-1.5 rounded-md transition-colors hover:bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-[500px] flex flex-col overflow-hidden" style={{ background: '#0c0e14', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <Avatar name={merchant.name} size="md" />
            <div>
              <div className="text-sm font-bold text-white">{merchant.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <PlanChip plan={merchant.plan} />
                <StatusDot status={merchant.plan_status} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-600 dark:text-neutral-400 hover:text-white hover:bg-white dark:bg-[var(--sb-card)]/6 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Impersonate buttons */}
        <div className="flex gap-2 px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => { console.log('[Impersonate Drawer] READ', { merchantId: merchant.id, merchantName: merchant.name }); onImpersonate(merchant.id, merchant.name, false); onClose(); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8' }}>
            <Eye className="w-3.5 h-3.5" /> View as Merchant
          </button>
          <button onClick={() => { console.log('[Impersonate Drawer] WRITE', { merchantId: merchant.id, merchantName: merchant.name }); onImpersonate(merchant.id, merchant.name, true); onClose(); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
            <Pencil className="w-3.5 h-3.5" /> Act as Merchant
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {(['overview', 'plan', 'audit'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('py-3 px-4 text-xs font-semibold capitalize border-b-2 -mb-px transition-colors',
                tab === t ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-600 dark:text-neutral-400 hover:text-gray-300'
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Overview */}
          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {infoRows.map(([k, v]) => (
                  <div key={k} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-[10px] text-gray-600 dark:text-neutral-400 uppercase tracking-widest font-semibold mb-1">{k}</div>
                    <div className="text-xs font-semibold text-white truncate">{v}</div>
                  </div>
                ))}
              </div>
              {/* Status control */}
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div className="text-[10px] text-gray-600 dark:text-neutral-400 uppercase tracking-widest font-semibold mb-1">Account Status</div>
                  <StatusDot status={merchant.plan_status} />
                </div>
                <div className="flex gap-2">
                  {merchant.plan_status === 'active' && (
                    <button onClick={() => onUpdateStatus(merchant.id, 'suspended')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                      Suspend
                    </button>
                  )}
                  {merchant.plan_status === 'suspended' && (
                    <button onClick={() => onUpdateStatus(merchant.id, 'active')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                      Reactivate
                    </button>
                  )}
                  {merchant.plan_status === 'pending' && (
                    <button onClick={() => onUpdateStatus(merchant.id, 'active')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                      Approve
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Plan */}
          {tab === 'plan' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 dark:text-neutral-400 mb-4">Select a plan and save to apply the change immediately.</p>
              {PLANS.map(p => (
                <div key={p.id} onClick={() => setPlan(p.id)}
                  className="p-4 rounded-xl cursor-pointer transition-all"
                  style={{
                    border: `1px solid ${plan === p.id ? p.accent + '50' : 'rgba(255,255,255,0.06)'}`,
                    background: plan === p.id ? p.accent + '12' : 'rgba(255,255,255,0.02)',
                  }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full border-2 flex items-center justify-center transition-all"
                        style={{ borderColor: plan === p.id ? p.accent : 'rgba(255,255,255,0.2)' }}>
                        {plan === p.id && <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.accent }} />}
                      </div>
                      <span className="text-sm font-semibold" style={{ color: plan === p.id ? p.accent : '#9ca3af' }}>{p.label}</span>
                    </div>
                    <span className="text-sm font-bold text-white">RM {p.price}<span className="text-xs text-gray-600 dark:text-neutral-400 font-normal">/mo</span></span>
                  </div>
                </div>
              ))}
              <button onClick={savePlan} disabled={saving || plan === merchant.plan}
                className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: '#6366f1' }}>
                {saving ? 'Saving…' : 'Save Plan Change'}
              </button>
            </div>
          )}

          {/* Audit */}
          {tab === 'audit' && (
            <div className="space-y-2">
              {logs.length === 0
                ? <p className="text-xs text-gray-600 dark:text-neutral-400 text-center py-10">No audit logs found</p>
                : logs.map(log => (
                  <div key={log.id} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-white">{log.action ?? log.event ?? 'Action'}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0',
                        log.status === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400')}>
                        {log.status ?? 'logged'}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-600 dark:text-neutral-400 mt-1">{new Date(log.created_at).toLocaleString()}</div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)' }}>

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold text-white">Create Merchant</h2>
            <p className="text-xs text-gray-600 dark:text-neutral-400 mt-0.5">Will be set to pending until approved</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-600 dark:text-neutral-400 hover:text-white hover:bg-white dark:bg-[var(--sb-card)]/6 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
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
                className="flex-1 py-2.5 rounded-xl text-center transition-all"
                style={{
                  border: `1px solid ${form.plan === p.id ? p.accent + '50' : 'rgba(255,255,255,0.08)'}`,
                  background: form.plan === p.id ? p.accent + '15' : 'rgba(255,255,255,0.02)',
                }}>
                <div className="text-xs font-bold" style={{ color: form.plan === p.id ? p.accent : '#6b7280' }}>{p.label}</div>
                <div className="text-[10px] text-gray-600 dark:text-neutral-400 mt-0.5">RM {p.price}/mo</div>
              </button>
            ))}
          </div>
        </Field>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-500 dark:text-neutral-500 hover:text-white transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
            style={{ background: '#6366f1' }}>
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
        <h1 className="text-lg font-bold text-white">Access Log</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">Every impersonation session by platform admins</p>
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.06)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Merchant', 'Access Type', 'Started', 'Duration', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-gray-600 dark:text-neutral-400 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-gray-600 dark:text-neutral-400">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-gray-600 dark:text-neutral-400">No sessions recorded yet</td></tr>
            ) : logs.map(log => {
              const duration = log.ended_at
                ? Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000)
                : null;
              return (
                <tr key={log.id} className="hover:bg-white dark:bg-[var(--sb-card)]/2 transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3 text-xs font-semibold text-white">{log.merchant_name ?? log.merchant_id.slice(0, 8) + '…'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md"
                      style={log.is_write_access
                        ? { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }
                        : { background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                      {log.is_write_access ? <Pencil className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                      {log.is_write_access ? 'Write' : 'Read'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-gray-500 dark:text-neutral-500">{new Date(log.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[10px] text-gray-500 dark:text-neutral-500">
                    {duration !== null
                      ? `${duration} min`
                      : <span className="flex items-center gap-1 text-amber-400"><Clock className="w-3 h-3" />Active</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
                      style={log.ended_at
                        ? { background: 'rgba(255,255,255,0.06)', color: '#6b7280' }
                        : { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}>
                      {log.ended_at ? 'Ended' : 'Active'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────

function SettingsPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white">Platform Settings</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">System-wide configuration and policies</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border p-5" style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.06)' }}>
          <h2 className="text-xs font-bold text-white mb-4 uppercase tracking-widest">Plans</h2>
          <div className="space-y-1">
            {PLANS.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.accent }} />
                  <span className="text-xs font-semibold text-white">{p.label}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: p.accent }}>RM {p.price}<span className="text-gray-600 dark:text-neutral-400 font-normal">/mo</span></span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-5" style={{ background: '#0c0e14', borderColor: 'rgba(255,255,255,0.06)' }}>
          <h2 className="text-xs font-bold text-white mb-4 uppercase tracking-widest">Security Policies</h2>
          <div className="space-y-1">
            {[
              ['Impersonation logging',      'Enabled'],
              ['Write-access confirmation',  'Required'],
              ['Session auto-expire',        '4 hours'],
              ['Audit log retention',        '90 days'],
              ['RLS enforcement',            'All tables'],
              ['Cross-tenant data access',   'Blocked'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-xs text-gray-400 dark:text-neutral-500">{label}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
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