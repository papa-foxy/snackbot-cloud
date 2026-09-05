import React, { useState } from 'react';
import { X, AlertTriangle, Store, User, Mail, Phone, MapPin, Tag } from 'lucide-react';
import { Merchant, PLANS } from '../types';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';

interface NewMerchantModalProps {
  onClose: () => void;
  onSaved: (merchant: Merchant) => void;
}

export function NewMerchantModal({ onClose, onSaved }: NewMerchantModalProps) {
  const [form, setForm] = useState({
    name: '',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    city: '',
    business_type: 'Restaurant',
    plan: 'basic',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.owner_email.trim()) {
      setError('Business name and owner email are required.');
      return;
    }

    setSaving(true);
    setError('');

    const selectedPlanConfig = PLANS.find(p => p.id === form.plan);
    const mrr = selectedPlanConfig?.price ?? 99;

    const { data, error: insertErr } = await supabase
      .from('business')
      .insert({
        ...form,
        plan_mrr: mrr,
        plan_status: 'pending',
        joined_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    setSaving(false);

    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    onSaved(data as Merchant);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl bg-white border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-[#D97706] flex items-center justify-center shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Onboard New Restaurant</h2>
              <p className="text-xs text-slate-500 mt-0.5">Account will be created in pending approval status</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl p-3.5 text-xs bg-rose-50 border border-rose-200 text-rose-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Restaurant / Business Name *
            </label>
            <input
              className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D97706] focus:ring-4 focus:ring-[#D97706]/10 transition-all"
              placeholder="e.g. Restoran Sambal Hijau"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Owner Full Name
              </label>
              <input
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D97706] focus:ring-4 focus:ring-[#D97706]/10 transition-all"
                placeholder="e.g. Azman bin Ali"
                value={form.owner_name}
                onChange={e => updateField('owner_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Owner Email *
              </label>
              <input
                type="email"
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D97706] focus:ring-4 focus:ring-[#D97706]/10 transition-all"
                placeholder="owner@sambalhijau.my"
                value={form.owner_email}
                onChange={e => updateField('owner_email', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Contact Phone
              </label>
              <input
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D97706] focus:ring-4 focus:ring-[#D97706]/10 transition-all"
                placeholder="+60 12-345 6789"
                value={form.owner_phone}
                onChange={e => updateField('owner_phone', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                City / Location
              </label>
              <input
                className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D97706] focus:ring-4 focus:ring-[#D97706]/10 transition-all"
                placeholder="Kuala Lumpur"
                value={form.city}
                onChange={e => updateField('city', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Cuisine / Business Type
            </label>
            <select
              className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#D97706] transition-all"
              value={form.business_type}
              onChange={e => updateField('business_type', e.target.value)}
            >
              {['Restaurant', 'Café', 'Fast Food', 'Bakery', 'Bar / Bistro', 'F&B Franchise', 'Demo'].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Subscription Plan
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PLANS.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => updateField('plan', p.id)}
                  className={cn(
                    'p-3 rounded-2xl border text-center transition-all',
                    form.plan === p.id
                      ? 'bg-amber-500/10 border-amber-300 ring-2 ring-amber-500/20 text-amber-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <div className="text-xs font-bold">{p.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">RM {p.price}/mo</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] shadow-lg shadow-amber-600/20 transition-all disabled:opacity-50"
            >
              {saving ? 'Creating Account…' : 'Create Restaurant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
