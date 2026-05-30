import React, { useState, useEffect, useCallback } from 'react';
import { 
  Ticket, Plus, Search, Filter, 
  Calendar, Clock, Tag, Percent, 
  Trash2, Edit2, CheckCircle2, 
  ChevronRight, Timer, X, Save, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/cn';
import { useTranslation } from '../contexts/TranslationContext';
import { useImpersonation } from '../contexts/ImpersonationContext';

// ── Merchant ID helper ────────────────────────────────────────────────────────
function getMerchantId(): string {
  try {
    return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? '';
  } catch { return ''; }
}

interface Promotion {
  id: string;
  code: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_spend: number;
  max_discount: number | null;
  starts_at: string;
  ends_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

type ModalMode = 'create' | 'edit' | 'view' | 'delete' | null;

const defaultForm: Omit<Promotion, 'id' | 'usage_count' | 'created_at'> = {
  code: '',
  name: '',
  type: 'percentage',
  value: 0,
  min_spend: 0,
  max_discount: null,
  starts_at: new Date().toISOString().slice(0, 16),
  ends_at: null,
  usage_limit: null,
  is_active: true,
};

function inputCls(err?: string) {
  return cn(
    'w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all',
    err
      ? 'border-red-300 focus:ring-red-200'
      : 'border-gray-200 dark:border-[var(--sb-border)] focus:ring-orange-200 focus:border-orange-400'
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[var(--sb-card)] rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  );
}

function Badge({ isActive, isExpired }: { isActive: boolean; isExpired: boolean }) {
  const label = isActive ? 'Active' : isExpired ? 'Expired' : 'Paused';
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
      isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500"
    )}>
      {label}
    </span>
  );
}

export function Promotions() {
  const { t } = useTranslation();
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const activeMerchantId = (isImpersonating ? impersonatedMerchantId : getMerchantId()) ?? '';

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [formData, setFormData] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  const fetchPromotions = useCallback(async () => {
    if (!activeMerchantId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('merchant_id', activeMerchantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error('Failed to fetch promotions', error);
      showToast('Failed to load promotions', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeMerchantId]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  const openCreate = () => {
    setFormData(defaultForm);
    setFormErrors({});
    setSelectedPromo(null);
    setModalMode('create');
  };

  const openEdit = (promo: Promotion) => {
    setSelectedPromo(promo);
    setFormData({
      code: promo.code,
      name: promo.name,
      type: promo.type,
      value: promo.value,
      min_spend: promo.min_spend,
      max_discount: promo.max_discount,
      starts_at: promo.starts_at.slice(0, 16),
      ends_at: promo.ends_at ? promo.ends_at.slice(0, 16) : null,
      usage_limit: promo.usage_limit,
      is_active: promo.is_active,
    });
    setFormErrors({});
    setModalMode('edit');
  };

  const openView   = (promo: Promotion) => { setSelectedPromo(promo); setModalMode('view'); };
  const openDelete = (promo: Promotion) => { setSelectedPromo(promo); setModalMode('delete'); };
  const closeModal = () => { setModalMode(null); setSelectedPromo(null); };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.code.trim()) errors.code = 'Code is required';
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (formData.value <= 0) errors.value = 'Value must be greater than 0';
    if (formData.type === 'percentage' && formData.value > 100) errors.value = 'Percentage cannot exceed 100%';
    if (formData.min_spend < 0) errors.min_spend = 'Min spend cannot be negative';
    if (!formData.starts_at) errors.starts_at = 'Start date is required';
    if (formData.ends_at && formData.ends_at < formData.starts_at) errors.ends_at = 'End date must be after start date';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    try {
      setSaving(true);
      const payload = {
        ...formData,
        code: formData.code.toUpperCase().trim(),
        starts_at: new Date(formData.starts_at).toISOString(),
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
        merchant_id: activeMerchantId,
      };
      if (modalMode === 'create') {
        const { error } = await supabase
          .from('promotions')
          .insert([{ ...payload, usage_count: 0 }]);
        if (error) throw error;
        showToast('Promotion created successfully!');
      } else if (modalMode === 'edit' && selectedPromo) {
        const { error } = await supabase
          .from('promotions')
          .update(payload)
          .eq('id', selectedPromo.id)
          .eq('merchant_id', activeMerchantId);
        if (error) throw error;
        showToast('Promotion updated successfully!');
      }
      await fetchPromotions();
      closeModal();
    } catch (error: any) {
      showToast(error.message || 'Failed to save promotion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPromo) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', selectedPromo.id)
        .eq('merchant_id', activeMerchantId);
      if (error) throw error;
      setPromotions(prev => prev.filter(p => p.id !== selectedPromo.id));
      showToast('Promotion deleted.');
      closeModal();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete promotion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (promo: Promotion) => {
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: !promo.is_active })
        .eq('id', promo.id)
        .eq('merchant_id', activeMerchantId);
      if (error) throw error;
      setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, is_active: !p.is_active } : p));
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const filteredPromotions = promotions.filter(p => {
    const matchesSearch = p.code.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const now = new Date();
    const isExpired = p.ends_at && new Date(p.ends_at) < now;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && p.is_active && !isExpired) ||
      (filterStatus === 'expired' && (isExpired || !p.is_active));
    return matchesSearch && matchesStatus;
  });

  const stats = {
    activeCount:       promotions.filter(p => p.is_active && (!p.ends_at || new Date(p.ends_at) > new Date())).length,
    totalRedemptions:  promotions.reduce((sum, p) => sum + p.usage_count, 0),
    expiringSoon:      promotions.filter(p => p.is_active && p.ends_at && new Date(p.ends_at) > new Date() && new Date(p.ends_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-2 duration-300",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Ticket className="w-6 h-6 text-orange-600" />
            {t('promotions.title', 'Promotions & Coupons')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Create and manage discount codes and seasonal offers.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 transition-all shadow-md shadow-orange-100">
          <Plus className="w-4 h-4" /> Create Promotion
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50', label: 'Active Promotions',  value: stats.activeCount,                        sub: 'running now',   subCls: 'text-gray-400 dark:text-neutral-500' },
          { icon: <Tag         className="w-5 h-5 text-blue-600"    />, bg: 'bg-blue-50',    label: 'Total Redemptions', value: stats.totalRedemptions.toLocaleString(),   sub: '+8% this week', subCls: 'text-emerald-600' },
          { icon: <Timer       className="w-5 h-5 text-amber-600"   />, bg: 'bg-amber-50',   label: 'Expiring Soon',     value: stats.expiringSoon,                        sub: 'within 7 days', subCls: 'text-amber-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-[var(--sb-card)] p-5 rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>{s.icon}</div>
              <span className="text-sm font-medium text-gray-500 dark:text-neutral-500">{s.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{s.value}</span>
              <span className={cn("text-xs font-medium", s.subCls)}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[var(--sb-card)] p-4 rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
          <input
            type="text"
            placeholder="Search by code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-neutral-800/50 border border-gray-100 dark:border-[var(--sb-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-50 dark:bg-neutral-800/50 border border-gray-100 dark:border-[var(--sb-border)] rounded-xl p-1">
            {(['all', 'active', 'expired'] as const).map(id => (
              <button
                key={id}
                onClick={() => setFilterStatus(id)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-lg transition-all capitalize",
                  filterStatus === id ? "bg-white dark:bg-[var(--sb-card)] text-gray-900 dark:text-neutral-100 shadow-sm" : "text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300"
                )}
              >{id}</button>
            ))}
          </div>
          <button className="p-2 bg-gray-50 dark:bg-neutral-800/50 border border-gray-100 dark:border-[var(--sb-border)] rounded-xl text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:bg-neutral-800 transition-all">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] p-6 animate-pulse">
              <div className="flex justify-between mb-4">
                <div className="h-6 bg-gray-100 dark:bg-neutral-800 rounded w-24" />
                <div className="h-6 bg-gray-100 dark:bg-neutral-800 rounded w-16" />
              </div>
              <div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-full mb-2" />
              <div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-2/3 mb-6" />
              <div className="flex justify-between border-t border-gray-50 pt-4">
                <div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-20" />
                <div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-20" />
              </div>
            </div>
          ))
        ) : filteredPromotions.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-dashed border-gray-300 dark:border-neutral-600">
            <Ticket className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-neutral-500 font-medium">No promotions found</p>
            <p className="text-gray-400 dark:text-neutral-500 text-sm mt-1">Try adjusting your filters or create a new promotion.</p>
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-xl hover:bg-orange-700 transition-all">
              Create your first promotion
            </button>
          </div>
        ) : (
          filteredPromotions.map((promo) => {
            const now       = new Date();
            const isExpired = !!(promo.ends_at && new Date(promo.ends_at) < now);
            const isActive  = promo.is_active && !isExpired;
            const usagePct  = promo.usage_limit ? Math.min((promo.usage_count / promo.usage_limit) * 100, 100) : 0;

            return (
              <div key={promo.id} className="bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm hover:shadow-md transition-all flex flex-col group">
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        promo.type === 'percentage' ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {promo.type === 'percentage' ? <Percent className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-neutral-100 group-hover:text-orange-600 transition-colors">{promo.code}</h3>
                        <p className="text-xs text-gray-500 dark:text-neutral-500">{promo.name}</p>
                      </div>
                    </div>
                    <button onClick={() => toggleActive(promo)} title="Toggle active status">
                      <Badge isActive={isActive} isExpired={isExpired} />
                    </button>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-neutral-500">Discount</span>
                      <span className="font-bold text-gray-900 dark:text-neutral-100">
                        {promo.type === 'percentage' ? `${promo.value}%` : `RM ${promo.value.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-neutral-500">Min. Spend</span>
                      <span className="text-gray-900 dark:text-neutral-100 font-medium">RM {promo.min_spend.toFixed(2)}</span>
                    </div>
                    {promo.max_discount && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-neutral-500">Max Discount</span>
                        <span className="text-gray-900 dark:text-neutral-100 font-medium">RM {promo.max_discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-neutral-500">Redemptions</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${usagePct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                          {promo.usage_count}{promo.usage_limit ? `/${promo.usage_limit}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-50 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Starts: {new Date(promo.starts_at).toLocaleDateString()}</span>
                    </div>
                    {promo.ends_at && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Ends: {new Date(promo.ends_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-100 dark:border-[var(--sb-border)] flex items-center justify-between rounded-b-2xl">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(promo)} className="p-2 text-gray-400 dark:text-neutral-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => openDelete(promo)} className="p-2 text-gray-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button onClick={() => openView(promo)} className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors">
                    View Details <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <Modal onClose={closeModal}>
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-[var(--sb-border)]">
            <h2 className="text-base font-bold text-gray-900 dark:text-neutral-100">{modalMode === 'create' ? 'Create Promotion' : 'Edit Promotion'}</h2>
            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800 transition-all"><X className="w-4 h-4 text-gray-500 dark:text-neutral-500" /></button>
          </div>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Promo Code *" error={formErrors.code}>
                <input className={inputCls(formErrors.code)} placeholder="e.g. SUMMER20" value={formData.code}
                  onChange={e => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
              </Field>
              <Field label="Name *" error={formErrors.name}>
                <input className={inputCls(formErrors.name)} placeholder="e.g. Summer Sale" value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Discount Type">
                <select className={inputCls()} value={formData.type}
                  onChange={e => setFormData(f => ({ ...f, type: e.target.value as 'percentage' | 'fixed' }))}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (RM)</option>
                </select>
              </Field>
              <Field label={`Value (${formData.type === 'percentage' ? '%' : 'RM'}) *`} error={formErrors.value}>
                <input type="number" className={inputCls(formErrors.value)} placeholder={formData.type === 'percentage' ? '10' : '5.00'}
                  min={0} max={formData.type === 'percentage' ? 100 : undefined} step={formData.type === 'percentage' ? 1 : 0.01}
                  value={formData.value || ''} onChange={e => setFormData(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Min. Spend (RM)" error={formErrors.min_spend}>
                <input type="number" className={inputCls(formErrors.min_spend)} placeholder="0.00" min={0} step={0.01}
                  value={formData.min_spend || ''} onChange={e => setFormData(f => ({ ...f, min_spend: parseFloat(e.target.value) || 0 }))} />
              </Field>
              {formData.type === 'percentage' && (
                <Field label="Max Discount (RM)">
                  <input type="number" className={inputCls()} placeholder="No limit" min={0} step={0.01}
                    value={formData.max_discount ?? ''} onChange={e => setFormData(f => ({ ...f, max_discount: e.target.value ? parseFloat(e.target.value) : null }))} />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date *" error={formErrors.starts_at}>
                <input type="datetime-local" className={inputCls(formErrors.starts_at)} value={formData.starts_at}
                  onChange={e => setFormData(f => ({ ...f, starts_at: e.target.value }))} />
              </Field>
              <Field label="End Date" error={formErrors.ends_at}>
                <input type="datetime-local" className={inputCls(formErrors.ends_at)} value={formData.ends_at ?? ''}
                  onChange={e => setFormData(f => ({ ...f, ends_at: e.target.value || null }))} />
              </Field>
            </div>
            <Field label="Usage Limit">
              <input type="number" className={inputCls()} placeholder="Unlimited" min={1}
                value={formData.usage_limit ?? ''} onChange={e => setFormData(f => ({ ...f, usage_limit: e.target.value ? parseInt(e.target.value) : null }))} />
            </Field>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-xl">
              <button type="button" onClick={() => setFormData(f => ({ ...f, is_active: !f.is_active }))}
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", formData.is_active ? "bg-orange-500" : "bg-gray-300")}>
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[var(--sb-card)] shadow transition-transform", formData.is_active ? "translate-x-6" : "translate-x-1")} />
              </button>
              <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                {formData.is_active ? 'Active — visible to customers' : 'Paused — hidden from customers'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-[var(--sb-border)]">
            <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:text-neutral-100 hover:bg-gray-100 dark:bg-neutral-800 rounded-xl transition-all">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-orange-600 text-white text-sm font-medium rounded-xl hover:bg-orange-700 disabled:opacity-60 transition-all shadow-md shadow-orange-100">
              {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {modalMode === 'create' ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* View Details Modal */}
      {modalMode === 'view' && selectedPromo && (
        <Modal onClose={closeModal}>
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-[var(--sb-border)]">
            <h2 className="text-base font-bold text-gray-900 dark:text-neutral-100">Promotion Details</h2>
            <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800 transition-all"><X className="w-4 h-4 text-gray-500 dark:text-neutral-500" /></button>
          </div>
          <div className="p-6 space-y-5">
            <div className={cn("flex items-center gap-4 p-4 rounded-2xl", selectedPromo.type === 'percentage' ? "bg-orange-50" : "bg-blue-50")}>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", selectedPromo.type === 'percentage' ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600")}>
                {selectedPromo.type === 'percentage' ? <Percent className="w-6 h-6" /> : <Tag className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-neutral-100">{selectedPromo.code}</h3>
                  <Badge isActive={selectedPromo.is_active && !(selectedPromo.ends_at && new Date(selectedPromo.ends_at) < new Date())} isExpired={!!(selectedPromo.ends_at && new Date(selectedPromo.ends_at) < new Date())} />
                </div>
                <p className="text-sm text-gray-500 dark:text-neutral-500">{selectedPromo.name}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Discount',     value: selectedPromo.type === 'percentage' ? `${selectedPromo.value}% off` : `RM ${selectedPromo.value.toFixed(2)} off` },
                { label: 'Min. Spend',   value: `RM ${selectedPromo.min_spend.toFixed(2)}` },
                { label: 'Max Discount', value: selectedPromo.max_discount ? `RM ${selectedPromo.max_discount.toFixed(2)}` : '—' },
                { label: 'Usage Limit',  value: selectedPromo.usage_limit ? selectedPromo.usage_limit.toLocaleString() : 'Unlimited' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 dark:bg-neutral-800/50 p-3 rounded-xl">
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mb-0.5">{item.label}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-neutral-100">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-neutral-500 font-medium">Redemptions</span>
                <span className="font-bold text-gray-900 dark:text-neutral-100">{selectedPromo.usage_count.toLocaleString()}{selectedPromo.usage_limit ? ` / ${selectedPromo.usage_limit.toLocaleString()}` : ''}</span>
              </div>
              {selectedPromo.usage_limit && (
                <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min((selectedPromo.usage_count / selectedPromo.usage_limit) * 100, 100)}%` }} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-neutral-500">Starts</p>
                  <p className="font-medium text-gray-700 dark:text-neutral-300">{new Date(selectedPromo.starts_at).toLocaleString()}</p>
                </div>
              </div>
              {selectedPromo.ends_at && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                  <div>
                    <p className="text-xs text-gray-400 dark:text-neutral-500">Ends</p>
                    <p className="font-medium text-gray-700 dark:text-neutral-300">{new Date(selectedPromo.ends_at).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-neutral-500">Created {new Date(selectedPromo.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-[var(--sb-border)]">
            <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:bg-neutral-800 rounded-xl transition-all">Close</button>
            <button onClick={() => openEdit(selectedPromo)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-xl hover:bg-orange-700 transition-all">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {modalMode === 'delete' && selectedPromo && (
        <Modal onClose={closeModal}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-neutral-100 mb-1">Delete Promotion?</h2>
            <p className="text-sm text-gray-500 dark:text-neutral-500 mb-1">
              You're about to permanently delete <span className="font-bold text-gray-700 dark:text-neutral-300">{selectedPromo.code}</span>.
            </p>
            <p className="text-xs text-gray-400 dark:text-neutral-500 mb-6">This action cannot be undone.</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={closeModal} className="px-5 py-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:bg-neutral-800 rounded-xl transition-all">Cancel</button>
              <button onClick={handleDelete} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-60 transition-all">
                {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}