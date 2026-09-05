import React, { useState, useEffect } from 'react';
import {
  X, Eye, Pencil, Shield, Store, Users, DollarSign,
  Building2, CheckCircle2, Ban, AlertTriangle, Trash2,
  Phone, Mail, MapPin, Tag, RefreshCw, Key
} from 'lucide-react';
import { Merchant, Branch, StaffUser, PLANS } from '../types';
import { MerchantAIAdvisorTab } from './MerchantAIAdvisorTab';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';

interface MerchantDrawerProps {
  merchant: Merchant;
  onClose: () => void;
  onImpersonate: (id: string, name: string, write: boolean) => void;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onMerchantUpdated: (updated: Merchant) => void;
  onMerchantDeleted: (id: string) => void;
}

export function MerchantDrawer({
  merchant,
  onClose,
  onImpersonate,
  onUpdateStatus,
  onMerchantUpdated,
  onMerchantDeleted,
}: MerchantDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'staff' | 'plan' | 'ai_advisor' | 'danger'>('overview');
  
  // Edit mode in Overview
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: merchant.name || '',
    owner_name: merchant.owner_name || '',
    owner_email: merchant.owner_email || '',
    owner_phone: merchant.owner_phone || '',
    city: merchant.city || '',
    business_type: merchant.business_type || 'Restaurant',
  });
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [editError, setEditError] = useState('');

  // Branches & Staff
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Plan
  const [selectedPlan, setSelectedPlan] = useState(merchant.plan);
  const [savingPlan, setSavingPlan] = useState(false);

  // Danger Zone
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Load branches and staff when respective tabs become active
  useEffect(() => {
    if (activeTab === 'branches' && branches.length === 0) {
      setLoadingBranches(true);
      supabase
        .from('branches')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setBranches((data as Branch[]) || []);
          setLoadingBranches(false);
        });
    }

    if (activeTab === 'staff' && staffList.length === 0) {
      setLoadingStaff(true);
      supabase
        .from('users')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setStaffList((data as StaffUser[]) || []);
          setLoadingStaff(false);
        });
    }
  }, [activeTab, merchant.id]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setEditError('Business name is required.');
      return;
    }

    setIsSavingDetails(true);
    setEditError('');

    const { data, error } = await supabase
      .from('business')
      .update({
        name: editForm.name,
        owner_name: editForm.owner_name,
        owner_email: editForm.owner_email,
        owner_phone: editForm.owner_phone,
        city: editForm.city,
        business_type: editForm.business_type,
      })
      .eq('id', merchant.id)
      .select()
      .single();

    setIsSavingDetails(false);

    if (error) {
      setEditError(error.message);
      return;
    }

    const updated = {
      ...merchant,
      ...editForm,
    };
    onMerchantUpdated(updated);
    setIsEditing(false);
  };

  const handleSavePlan = async () => {
    setSavingPlan(true);
    const newMrr = PLANS.find(p => p.id === selectedPlan)?.price ?? 99;
    const { error } = await supabase
      .from('business')
      .update({ plan: selectedPlan, plan_mrr: newMrr })
      .eq('id', merchant.id);

    setSavingPlan(false);
    if (!error) {
      onMerchantUpdated({
        ...merchant,
        plan: selectedPlan,
        plan_mrr: newMrr,
      });
    }
  };

  const handleDeleteMerchant = async () => {
    if (deleteConfirmInput !== merchant.name) return;
    setIsDeleting(true);

    // Remove from business table
    const { error } = await supabase.from('business').delete().eq('id', merchant.id);
    setIsDeleting(false);

    if (!error) {
      onMerchantDeleted(merchant.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Drawer Panel */}
      <aside className="relative w-full sm:w-[560px] h-full flex flex-col bg-white border-l border-slate-200 shadow-2xl z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300/80 text-[#D97706] font-bold flex items-center justify-center text-lg shadow-sm">
              {merchant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 leading-tight flex items-center gap-2">
                {merchant.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
                  {merchant.plan}
                </span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
                  merchant.plan_status === 'active'    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  merchant.plan_status === 'suspended' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                )}>
                  {merchant.plan_status}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Impersonation Banner */}
        <div className="flex gap-2.5 px-6 py-3 border-b border-amber-100 bg-amber-500/10">
          <button
            onClick={() => {
              onImpersonate(merchant.id, merchant.name, false);
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-amber-300 hover:bg-amber-50 transition-all shadow-sm"
          >
            <Eye className="w-4 h-4 text-amber-600" /> View as Merchant
          </button>
          <button
            onClick={() => {
              onImpersonate(merchant.id, merchant.name, true);
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] transition-all shadow-md shadow-amber-600/20"
          >
            <Pencil className="w-4 h-4" /> Act as Merchant (Write)
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 border-b border-slate-100 overflow-x-auto scrollbar-none">
          {(['overview', 'branches', 'staff', 'plan', 'ai_advisor', 'danger'] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={cn(
                'py-3.5 px-3 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === tabKey
                  ? 'border-[#D97706] text-[#D97706]'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              )}
            >
              {tabKey === 'ai_advisor' ? '✨ AI Advisor' : tabKey === 'danger' ? 'Danger Zone' : tabKey}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Summary Stats Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl p-3 bg-amber-500/5 border border-amber-200/60 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Branches</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">{merchant.branch_count ?? 0}</div>
                </div>
                <div className="rounded-2xl p-3 bg-amber-500/5 border border-amber-200/60 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Staff Accounts</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">{merchant.staff_count ?? 0}</div>
                </div>
                <div className="rounded-2xl p-3 bg-amber-500/5 border border-amber-200/60 text-center">
                  <div className="text-[10px] font-bold uppercase text-slate-400">MRR Revenue</div>
                  <div className="text-lg font-bold text-[#D97706] mt-0.5">RM {merchant.plan_mrr || 99}</div>
                </div>
              </div>

              {/* Edit Mode vs Read-Only Details */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Merchant Information</span>
                  <button
                    onClick={() => {
                      setIsEditing(!isEditing);
                      setEditError('');
                    }}
                    className="text-xs font-bold text-[#D97706] hover:text-[#B45309] transition-colors"
                  >
                    {isEditing ? 'Cancel' : 'Edit Details'}
                  </button>
                </div>

                {editError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {editError}
                  </div>
                )}

                {isEditing ? (
                  <form onSubmit={handleSaveDetails} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Business Name</label>
                      <input
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Owner Name</label>
                        <input
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10"
                          value={editForm.owner_name}
                          onChange={e => setEditForm({ ...editForm, owner_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Owner Email</label>
                        <input
                          type="email"
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10"
                          value={editForm.owner_email}
                          onChange={e => setEditForm({ ...editForm, owner_email: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Phone Number</label>
                        <input
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10"
                          value={editForm.owner_phone}
                          onChange={e => setEditForm({ ...editForm, owner_phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">City / Region</label>
                        <input
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10"
                          value={editForm.city}
                          onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Business Type</label>
                      <select
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#D97706]"
                        value={editForm.business_type}
                        onChange={e => setEditForm({ ...editForm, business_type: e.target.value })}
                      >
                        {['F&B', 'Restaurant', 'Café', 'Fast Food', 'Bakery', 'Bar / Bistro', 'Demo'].map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingDetails}
                      className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
                    >
                      {isSavingDetails ? 'Saving Changes…' : 'Save Details'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-400">Owner Name</span>
                      <span className="font-semibold text-slate-800">{merchant.owner_name || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-400">Email Address</span>
                      <span className="font-semibold text-slate-800">{merchant.owner_email || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-400">Phone</span>
                      <span className="font-semibold text-slate-800">{merchant.owner_phone || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-400">City / Location</span>
                      <span className="font-semibold text-slate-800">{merchant.city || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-400">Business Category</span>
                      <span className="font-semibold text-slate-800">{merchant.business_type || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-400">Joined Date</span>
                      <span className="font-semibold text-slate-800">{merchant.joined_date?.slice(0, 10) || '—'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Actions */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account Access</div>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">
                    Currently <span className="font-bold capitalize">{merchant.plan_status}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {merchant.plan_status === 'active' && (
                    <button
                      onClick={() => onUpdateStatus(merchant.id, 'suspended')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
                    >
                      Suspend Access
                    </button>
                  )}
                  {(merchant.plan_status === 'suspended' || merchant.plan_status === 'pending') && (
                    <button
                      onClick={() => onUpdateStatus(merchant.id, 'active')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      Approve & Activate
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── BRANCHES TAB ── */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Registered Outlets</h3>
                <span className="text-xs text-slate-500 font-semibold">{branches.length} Outlets</span>
              </div>

              {loadingBranches ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading branch records…</div>
              ) : branches.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                  No branches found for this merchant.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {branches.map(b => (
                    <div key={b.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 text-[#D97706] flex items-center justify-center shrink-0 mt-0.5">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{b.name}</div>
                          {b.code && <div className="text-[10px] text-slate-400 font-mono">Code: {b.code}</div>}
                          {b.address && <div className="text-[11px] text-slate-500 mt-0.5">{b.address}</div>}
                          {b.phone && <div className="text-[10px] text-slate-400 mt-0.5">Tel: {b.phone}</div>}
                        </div>
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                        b.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                      )}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STAFF TAB ── */}
          {activeTab === 'staff' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Team Accounts</h3>
                <span className="text-xs text-slate-500 font-semibold">{staffList.length} Members</span>
              </div>

              {loadingStaff ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading staff accounts…</div>
              ) : staffList.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                  No staff accounts found for this merchant.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {staffList.map(s => (
                    <div key={s.id} className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{s.name}</div>
                          <div className="text-[11px] text-slate-400">{s.email}</div>
                          {s.pin && <div className="text-[10px] text-amber-700 font-mono">PIN: •••• ({s.pin})</div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200">
                          {s.role || 'Staff'}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {s.is_active ? 'Active' : 'Disabled'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PLAN & BILLING TAB ── */}
          {activeTab === 'plan' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Change this merchant's subscription plan. Pricing will automatically adjust in their account metrics.
              </p>

              <div className="space-y-3">
                {PLANS.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id)}
                    className={cn(
                      'p-4 rounded-2xl cursor-pointer border transition-all shadow-sm',
                      selectedPlan === p.id
                        ? 'bg-amber-500/10 border-amber-300 ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border flex items-center justify-center bg-white"
                          style={{ borderColor: selectedPlan === p.id ? p.accent : '#cbd5e1' }}
                        >
                          {selectedPlan === p.id && <div className="w-2 h-2 rounded-full" style={{ background: p.accent }} />}
                        </div>
                        <span className="text-xs font-bold text-slate-900">{p.label} Plan</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">
                        RM {p.price}<span className="text-xs text-slate-400 font-normal">/mo</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {p.features.map(f => (
                        <span key={f} className="text-[10px] px-2 py-0.5 rounded-md bg-white/80 border border-slate-200 text-slate-600">
                          ✓ {f}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSavePlan}
                disabled={savingPlan || selectedPlan === merchant.plan}
                className="w-full py-3 rounded-xl text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] shadow-md shadow-amber-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {savingPlan ? 'Applying Plan Change…' : 'Save Plan & Update MRR'}
              </button>
            </div>
          )}

          {/* ── AI ADVISOR TAB ── */}
          {activeTab === 'ai_advisor' && (
            <MerchantAIAdvisorTab merchant={merchant} />
          )}

          {/* ── DANGER ZONE TAB ── */}
          {activeTab === 'danger' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600" /> Permanent Merchant Deletion
                </div>
                <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                  Deleting this merchant will permanently remove all associated business metadata from the platform. This action is irreversible.
                </p>

                <div className="mt-4 pt-4 border-t border-rose-200/80">
                  <label className="block text-[11px] font-bold text-rose-800 uppercase mb-1.5">
                    Type <span className="underline select-all">{merchant.name}</span> to confirm:
                  </label>
                  <input
                    className="w-full px-3 py-2 text-xs border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 bg-white"
                    placeholder={merchant.name}
                    value={deleteConfirmInput}
                    onChange={e => setDeleteConfirmInput(e.target.value)}
                  />

                  <button
                    onClick={handleDeleteMerchant}
                    disabled={deleteConfirmInput !== merchant.name || isDeleting}
                    className="w-full mt-3 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Deleting Merchant…' : 'I understand, permanently delete merchant'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
