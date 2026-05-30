import React, { useState, useEffect } from 'react';
import { 
  Users, Gift, Search, Plus, Filter, 
  TrendingUp, Award, History, MoreHorizontal,
  ChevronRight, Star, Mail, Phone, Calendar,
  X, Save, AlertTriangle, CheckCircle2, Edit2,
  Trash2, ArrowUp, ArrowDown, RotateCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/cn';
import { useTranslation } from '../contexts/TranslationContext';
import { useImpersonation } from '../contexts/ImpersonationContext'; // 👉 Added import

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  points: number;
  total_spent: number;
  last_visit: string | null;
  created_at: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
}

interface PointsHistory {
  id: string;
  customer_id: string;
  customer_name?: string;
  type: 'earn' | 'redeem' | 'adjust';
  points: number;
  description: string;
  created_at: string;
}

type ModalMode = 'add' | 'edit' | 'delete' | 'points' | null;

const TIERS = [
  { name: 'Bronze',   min: 0,    max: 499,  color: 'bg-orange-100 text-orange-700', bar: 'bg-orange-400' },
  { name: 'Silver',   min: 500,  max: 1999, color: 'bg-slate-100 text-slate-700',   bar: 'bg-slate-400' },
  { name: 'Gold',     min: 2000, max: 4999, color: 'bg-amber-100 text-amber-700',   bar: 'bg-amber-400' },
  { name: 'Platinum', min: 5000, max: null, color: 'bg-purple-100 text-purple-700', bar: 'bg-purple-500' },
];

function getTier(points: number): Customer['tier'] {
  if (points >= 5000) return 'Platinum';
  if (points >= 2000) return 'Gold';
  if (points >= 500)  return 'Silver';
  return 'Bronze';
}

function getTierMeta(tier: Customer['tier']) {
  return TIERS.find(t => t.name === tier)!;
}

// ── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[var(--sb-card)] rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  );
}

// ── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function inputCls(err?: string) {
  return cn(
    'w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all',
    err ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 dark:border-[var(--sb-border)] focus:ring-pink-200 focus:border-pink-400'
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const defaultCustomerForm = { name: '', email: '', phone: '' };

export function Loyalty() {
  const { t } = useTranslation();
  
  // 👉 Resolve active merchant ID
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const getLocalMerchantId = () => {
    try { return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null; }
    catch { return null; }
  };
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : getLocalMerchantId();

  const [customers, setCustomers]     = useState<Customer[]>([]);
  const [history, setHistory]         = useState<PointsHistory[]>([]);
  const [loading, setLoading]         = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab]     = useState<'customers' | 'history' | 'tiers'>('customers');
  const [modalMode, setModalMode]     = useState<ModalMode>(null);
  const [selected, setSelected]       = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState(defaultCustomerForm);
  const [formErrors, setFormErrors]   = useState<Record<string, string>>({});
  const [pointsForm, setPointsForm]   = useState({ type: 'earn' as 'earn' | 'redeem' | 'adjust', amount: '', description: '' });
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filterTier, setFilterTier]   = useState<string>('all');

  useEffect(() => { fetchCustomers(); }, [activeMerchantId]); // 👉 Refetch on merchant change
  useEffect(() => { if (activeTab === 'history') fetchHistory(); }, [activeTab, activeMerchantId]);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchCustomers = async () => {
    if (!activeMerchantId) return; // 👉 Guard clause
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('merchant_id', activeMerchantId) // 👉 Filter by merchant ID
        .order('points', { ascending: false });
        
      if (error) throw error;
      const enriched = (data || []).map(c => ({ ...c, tier: getTier(c.points) })) as Customer[];
      setCustomers(enriched);
    } catch (err) {
      console.error(err);
      showToast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!activeMerchantId) return; // 👉 Guard clause
    try {
      setHistoryLoading(true);
      // Determine which customers belong to this merchant to filter the history correctly
      // (assuming points_history doesn't have merchant_id, we filter by customer_id)
      const customerIds = customers.map(c => c.id);
      
      if (customerIds.length === 0) {
        setHistory([]);
        return;
      }

      const { data, error } = await supabase
        .from('points_history')
        .select('*, customers(name)')
        .in('customer_id', customerIds) // 👉 Scope history to merchant's customers
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) throw error;
      const enriched = (data || []).map((h: any) => ({ ...h, customer_name: h.customers?.name }));
      setHistory(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Validate customer form ───────────────────────────────────────────────
  const validateCustomer = () => {
    const errors: Record<string, string> = {};
    if (!customerForm.name.trim()) errors.name = 'Name is required';
    if (customerForm.email && !/^\S+@\S+\.\S+$/.test(customerForm.email)) errors.email = 'Invalid email';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Add customer ─────────────────────────────────────────────────────────
  const handleAddCustomer = async () => {
    if (!validateCustomer() || !activeMerchantId) return;
    try {
      setSaving(true);
      const { error } = await supabase.from('customers').insert([{
        merchant_id: activeMerchantId, // 👉 Inject merchant ID
        name: customerForm.name.trim(),
        email: customerForm.email || null,
        phone: customerForm.phone || null,
        points: 0,
        total_spent: 0,
      }]);
      if (error) throw error;
      showToast('Customer added!');
      await fetchCustomers();
      closeModal();
    } catch (err: any) {
      showToast(err.message || 'Failed to add customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit customer ────────────────────────────────────────────────────────
  const handleEditCustomer = async () => {
    if (!validateCustomer() || !selected) return;
    try {
      setSaving(true);
      const { error } = await supabase.from('customers').update({
        name: customerForm.name.trim(),
        email: customerForm.email || null,
        phone: customerForm.phone || null,
      }).eq('id', selected.id);
      if (error) throw error;
      showToast('Customer updated!');
      await fetchCustomers();
      closeModal();
    } catch (err: any) {
      showToast(err.message || 'Failed to update customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete customer ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      const { error } = await supabase.from('customers').delete().eq('id', selected.id);
      if (error) throw error;
      setCustomers(prev => prev.filter(c => c.id !== selected.id));
      showToast('Customer removed.');
      closeModal();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Adjust points ────────────────────────────────────────────────────────
  const handlePointsAdjust = async () => {
    if (!selected) return;
    const amount = parseInt(pointsForm.amount);
    if (!amount || amount <= 0) { setFormErrors({ amount: 'Enter a valid positive number' }); return; }
    if (!pointsForm.description.trim()) { setFormErrors({ description: 'Description is required' }); return; }
    try {
      setSaving(true);
      const delta = pointsForm.type === 'redeem' ? -amount : amount;
      const newPoints = Math.max(0, selected.points + delta);

      const { error: updateErr } = await supabase.from('customers').update({ points: newPoints }).eq('id', selected.id);
      if (updateErr) throw updateErr;

      // Insert history record (best-effort)
      await supabase.from('points_history').insert([{
        customer_id: selected.id,
        type: pointsForm.type,
        points: amount,
        description: pointsForm.description.trim(),
      }]);

      showToast(`Points ${pointsForm.type === 'redeem' ? 'redeemed' : pointsForm.type === 'earn' ? 'added' : 'adjusted'}!`);
      await fetchCustomers();
      closeModal();
    } catch (err: any) {
      showToast(err.message || 'Failed to update points', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Modal helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setCustomerForm(defaultCustomerForm);
    setFormErrors({});
    setSelected(null);
    setModalMode('add');
  };

  const openEdit = (c: Customer) => {
    setSelected(c);
    setCustomerForm({ name: c.name, email: c.email || '', phone: c.phone || '' });
    setFormErrors({});
    setModalMode('edit');
  };

  const openDelete = (c: Customer) => { setSelected(c); setModalMode('delete'); };

  const openPoints = (c: Customer) => {
    setSelected(c);
    setPointsForm({ type: 'earn', amount: '', description: '' });
    setFormErrors({});
    setModalMode('points');
  };

  const closeModal = () => { setModalMode(null); setSelected(null); };

  // ── Filtered data ────────────────────────────────────────────────────────
  const filteredCustomers = customers.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery);
    const matchesTier = filterTier === 'all' || c.tier === filterTier;
    return matchesSearch && matchesTier;
  });

  const stats = {
    totalMembers: customers.length,
    totalPoints: customers.reduce((sum, c) => sum + c.points, 0),
    activeThisMonth: customers.filter(c => c.last_visit && new Date(c.last_visit) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
    avgPoints: customers.length ? Math.round(customers.reduce((sum, c) => sum + c.points, 0) / customers.length) : 0,
  };

  // ── Tier progress ────────────────────────────────────────────────────────
  function TierProgress({ points, tier }: { points: number; tier: Customer['tier'] }) {
    const meta = getTierMeta(tier);
    const next = TIERS.find(t => t.min > meta.min);
    if (!next) return <span className="text-xs text-purple-600 font-medium">Max tier reached 🎉</span>;
    const pct = Math.min(((points - meta.min) / (next.min - meta.min)) * 100, 100);
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500 dark:text-neutral-500">
          <span>{points.toLocaleString()} pts</span>
          <span>{next.min.toLocaleString()} for {next.name}</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', meta.bar)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-2 duration-300',
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Gift className="w-6 h-6 text-pink-600" />
            {t('loyalty.title', 'Loyalty & Rewards')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Manage your customer relationships and rewards program.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:bg-neutral-800/50 transition-all shadow-sm"
          >
            <History className="w-4 h-4" /> Points History
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl text-sm font-medium hover:bg-pink-700 transition-all shadow-md shadow-pink-100"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <Users className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50', label: 'Total Members', value: stats.totalMembers, sub: '+12% this month', subCls: 'text-emerald-600' },
          { icon: <Star className="w-5 h-5 text-pink-600" />, bg: 'bg-pink-50', label: 'Total Points Issued', value: stats.totalPoints.toLocaleString(), sub: 'pts', subCls: 'text-gray-400 dark:text-neutral-500' },
          { icon: <TrendingUp className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50', label: 'Active Members', value: stats.activeThisMonth, sub: 'last 30 days', subCls: 'text-gray-400 dark:text-neutral-500' },
          { icon: <Award className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50', label: 'Avg. Points / Member', value: stats.avgPoints, sub: 'pts', subCls: 'text-gray-400 dark:text-neutral-500' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-[var(--sb-card)] p-5 rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', s.bg)}>{s.icon}</div>
              <span className="text-sm font-medium text-gray-500 dark:text-neutral-500">{s.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{s.value}</span>
              <span className={cn('text-xs font-medium', s.subCls)}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Panel */}
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-[var(--sb-border)] px-4">
          {[
            { id: 'customers', label: 'Customers', icon: Users },
            { id: 'history',   label: 'Points History', icon: History },
            { id: 'tiers',     label: 'Membership Tiers', icon: Award },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-4 text-sm font-medium transition-all relative',
                activeTab === tab.id ? 'text-pink-600' : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Customers tab ─────────────────────────────────────────────── */}
        {activeTab === 'customers' && (
          <>
            <div className="p-4 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50/50 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search by name, email or phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filterTier}
                  onChange={e => setFilterTier(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl text-sm text-gray-600 dark:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-pink-200"
                >
                  <option value="all">All Tiers</option>
                  {TIERS.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-neutral-800/50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Tier</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider text-right">Points</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider text-right">Total Spent</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Last Visit</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-32" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-16" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-28" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-12 ml-auto" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-20 ml-auto" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-24" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-4" /></td>
                      </tr>
                    ))
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                        <p className="text-gray-500 dark:text-neutral-500 font-medium">No customers found</p>
                        <button onClick={openAdd} className="mt-3 px-4 py-2 bg-pink-600 text-white text-sm font-medium rounded-xl hover:bg-pink-700 transition-all">
                          Add first customer
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(customer => {
                      const tierMeta = getTierMeta(customer.tier);
                      return (
                        <tr key={customer.id} className="hover:bg-gray-50 dark:bg-neutral-800/50 transition-colors group cursor-pointer">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-sm flex-shrink-0">
                                {customer.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">{customer.name}</p>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  {customer.email && (
                                    <span className="text-xs text-gray-500 dark:text-neutral-500 flex items-center gap-1">
                                      <Mail className="w-3 h-3" /> {customer.email}
                                    </span>
                                  )}
                                  {customer.phone && (
                                    <span className="text-xs text-gray-500 dark:text-neutral-500 flex items-center gap-1">
                                      <Phone className="w-3 h-3" /> {customer.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', tierMeta.color)}>
                              {customer.tier}
                            </span>
                          </td>
                          <td className="px-6 py-4 min-w-[160px]">
                            <TierProgress points={customer.points} tier={customer.tier} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-bold text-pink-600">{customer.points.toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-medium text-gray-900 dark:text-neutral-100">RM {customer.total_spent.toFixed(2)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-500">
                              <Calendar className="w-3 h-3" />
                              {customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : 'Never'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                              <button onClick={() => openPoints(customer)} title="Adjust points" className="p-1.5 text-gray-400 dark:text-neutral-500 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-all">
                                <Star className="w-4 h-4" />
                              </button>
                              <button onClick={() => openEdit(customer)} title="Edit" className="p-1.5 text-gray-400 dark:text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => openDelete(customer)} title="Delete" className="p-1.5 text-gray-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-100 dark:border-[var(--sb-border)] flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-neutral-500">
                Showing {filteredCustomers.length} of {customers.length} members
              </p>
            </div>
          </>
        )}

        {/* ── History tab ───────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div>
            <div className="p-4 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50/50 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-neutral-500">Last 100 points transactions</p>
              <button onClick={fetchHistory} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-neutral-500 hover:text-gray-800 dark:text-neutral-200 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-neutral-800/50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider text-right">Points</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historyLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({length:5}).map((_,j)=>(
                          <td key={j} className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-full" /></td>
                        ))}
                      </tr>
                    ))
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 dark:text-neutral-500">
                        <History className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                        No points history yet.
                      </td>
                    </tr>
                  ) : (
                    history.map(h => (
                      <tr key={h.id} className="hover:bg-gray-50 dark:bg-neutral-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-neutral-100">{h.customer_name || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
                            h.type === 'earn'   ? 'bg-emerald-100 text-emerald-700' :
                            h.type === 'redeem' ? 'bg-red-100 text-red-700' :
                                                  'bg-blue-100 text-blue-700'
                          )}>
                            {h.type === 'earn' ? <ArrowUp className="w-3 h-3" /> : h.type === 'redeem' ? <ArrowDown className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
                            {h.type.charAt(0).toUpperCase() + h.type.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-neutral-500">{h.description}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn('text-sm font-bold', h.type === 'redeem' ? 'text-red-600' : 'text-emerald-600')}>
                            {h.type === 'redeem' ? '-' : '+'}{h.points.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 dark:text-neutral-500">
                          {new Date(h.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tiers tab ─────────────────────────────────────────────────── */}
        {activeTab === 'tiers' && (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map(tier => {
              const count = customers.filter(c => c.tier === tier.name).length;
              const pct = customers.length ? Math.round((count / customers.length) * 100) : 0;
              return (
                <div key={tier.name} className="bg-gray-50 dark:bg-neutral-800/50 rounded-2xl p-5 border border-gray-100 dark:border-[var(--sb-border)]">
                  <div className="flex items-center justify-between mb-4">
                    <span className={cn('inline-flex px-3 py-1 rounded-full text-xs font-bold', tier.color)}>
                      {tier.name}
                    </span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{count}</span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-500 dark:text-neutral-500">
                    <div className="flex justify-between">
                      <span>Min points</span>
                      <span className="font-medium text-gray-700 dark:text-neutral-300">{tier.min.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max points</span>
                      <span className="font-medium text-gray-700 dark:text-neutral-300">{tier.max ? tier.max.toLocaleString() : '∞'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>% of members</span>
                      <span className="font-medium text-gray-700 dark:text-neutral-300">{pct}%</span>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', tier.bar)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / Edit Customer Modal ────────────────────────────────────── */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <Modal onClose={closeModal}>
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-[var(--sb-border)]">
            <h2 className="text-base font-bold text-gray-900 dark:text-neutral-100">
              {modalMode === 'add' ? 'Add Customer' : 'Edit Customer'}
            </h2>
            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800 transition-all">
              <X className="w-4 h-4 text-gray-500 dark:text-neutral-500" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <Field label="Full Name *" error={formErrors.name}>
              <input className={inputCls(formErrors.name)} placeholder="e.g. Ahmad Razif" value={customerForm.name}
                onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Email" error={formErrors.email}>
              <input type="email" className={inputCls(formErrors.email)} placeholder="email@example.com" value={customerForm.email}
                onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <input className={inputCls()} placeholder="+60 12-345 6789" value={customerForm.phone}
                onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))} />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-[var(--sb-border)]">
            <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:bg-neutral-800 rounded-xl transition-all">Cancel</button>
            <button onClick={modalMode === 'add' ? handleAddCustomer : handleEditCustomer} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-pink-600 text-white text-sm font-medium rounded-xl hover:bg-pink-700 disabled:opacity-60 transition-all shadow-md shadow-pink-100">
              {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {modalMode === 'add' ? 'Add Customer' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Points Adjustment Modal ──────────────────────────────────────── */}
      {modalMode === 'points' && selected && (
        <Modal onClose={closeModal}>
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-[var(--sb-border)]">
            <h2 className="text-base font-bold text-gray-900 dark:text-neutral-100">Manage Points</h2>
            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800 transition-all">
              <X className="w-4 h-4 text-gray-500 dark:text-neutral-500" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            {/* Customer summary */}
            <div className="flex items-center gap-3 p-3 bg-pink-50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-700 font-bold text-sm">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100">{selected.name}</p>
                <p className="text-xs text-pink-600 font-medium">{selected.points.toLocaleString()} pts · {selected.tier}</p>
              </div>
            </div>

            <Field label="Transaction Type">
              <div className="grid grid-cols-3 gap-2">
                {(['earn', 'redeem', 'adjust'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setPointsForm(f => ({ ...f, type }))}
                    className={cn('py-2 text-xs font-semibold rounded-xl border transition-all capitalize',
                      pointsForm.type === type
                        ? type === 'earn'   ? 'bg-emerald-600 text-white border-emerald-600'
                        : type === 'redeem' ? 'bg-red-600 text-white border-red-600'
                                            : 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-200 dark:border-[var(--sb-border)] hover:border-gray-300 dark:border-neutral-600'
                    )}>
                    {type}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Points Amount *" error={formErrors.amount}>
              <input type="number" className={inputCls(formErrors.amount)} placeholder="e.g. 100" min={1}
                value={pointsForm.amount} onChange={e => setPointsForm(f => ({ ...f, amount: e.target.value }))} />
            </Field>

            <Field label="Description *" error={formErrors.description}>
              <input className={inputCls(formErrors.description)} placeholder="e.g. Purchase reward, Birthday bonus..."
                value={pointsForm.description} onChange={e => setPointsForm(f => ({ ...f, description: e.target.value }))} />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-[var(--sb-border)]">
            <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:bg-neutral-800 rounded-xl transition-all">Cancel</button>
            <button onClick={handlePointsAdjust} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-pink-600 text-white text-sm font-medium rounded-xl hover:bg-pink-700 disabled:opacity-60 transition-all shadow-md shadow-pink-100">
              {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Star className="w-4 h-4" />}
              Confirm
            </button>
          </div>
        </Modal>
      )}

      {/* ── Delete Modal ─────────────────────────────────────────────────── */}
      {modalMode === 'delete' && selected && (
        <Modal onClose={closeModal}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-neutral-100 mb-1">Remove Customer?</h2>
            <p className="text-sm text-gray-500 dark:text-neutral-500 mb-1">
              You're about to remove <span className="font-bold text-gray-700 dark:text-neutral-300">{selected.name}</span> and all their data.
            </p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mb-6">This action cannot be undone.</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={closeModal} className="px-5 py-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:bg-neutral-800 rounded-xl transition-all">Cancel</button>
              <button onClick={handleDelete} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-60 transition-all">
                {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remove
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}