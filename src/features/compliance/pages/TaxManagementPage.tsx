import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Trash2, Pencil, Check, X, AlertCircle,
  ToggleLeft, ToggleRight, Loader2, Receipt, ChevronDown, ChevronUp,
  Percent, Layers, ArrowUpDown, BookOpen, AlertTriangle,
  CheckCircle2, RefreshCw, Eye, Search
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTaxConfig, TaxConfig, calculateOrderTax } from '../../../hooks/useTaxConfig';
import { cn } from '../../../utils/cn';
import { useImpersonation } from '../../../contexts/ImpersonationContext';

// ── Constants ──────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  percentage:     'Percentage (%)',
  fixed:          'Fixed Amount',
  service_charge: 'Service Charge',
};

const APPLIES_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  all:      { label: 'All Items',    desc: 'Applies to every item in the order',        color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  category: { label: 'By Category', desc: 'Applies to items in selected categories',    color: 'bg-purple-50 text-purple-700 border-purple-200' },
  item:     { label: 'By Item',      desc: 'Applies to specific menu items only',        color: 'bg-cyan-50 text-cyan-700 border-cyan-200'       },
  order:    { label: 'Order Level',  desc: 'Applied once on the total order amount',     color: 'bg-amber-50 text-amber-700 border-amber-200'    },
};

const EMPTY_FORM: Omit<TaxConfig, 'id'> = {
  name: '', code: '', rate: 0, type: 'percentage',
  applies_to: 'all', is_inclusive: false,
  is_active: true, display_on_receipt: true, priority: 10,
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface Category { id: string; name: string }
interface MenuItem { id: string; name: string; category_id: string }

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
function DeleteConfirmModal({
  tax,
  onConfirm,
  onClose,
}: {
  tax:       TaxConfig;
  onConfirm: () => Promise<void>;
  onClose:   () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-neutral-100">Delete Tax Rule</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 p-1 rounded-lg hover:bg-gray-100 dark:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-gray-600 dark:text-neutral-400">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900 dark:text-neutral-100">"{tax.name}"</span>?
            This action cannot be undone.
          </p>
          {/* Tax summary */}
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center font-bold text-sm text-red-700 shrink-0">
              {tax.code || tax.name.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-neutral-100 text-sm">{tax.name}</p>
              <p className="text-xs text-gray-500 dark:text-neutral-500">
                {tax.type === 'fixed' ? `RM ${tax.rate.toFixed(2)}` : `${tax.rate}%`} · {TYPE_LABELS[tax.type]} · {APPLIES_LABELS[tax.applies_to].label}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:text-neutral-100 rounded-xl hover:bg-gray-100 dark:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-5 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Checkbox Assignment Panel ──────────────────────────────────────────────────
function AssignmentPanel({
  tax, categories, menuItems,
  assignedCategoryIds, assignedItemIds,
  onAssignCategory, onAssignItem,
}: {
  tax:                 TaxConfig;
  categories:          Category[];
  menuItems:           MenuItem[];
  assignedCategoryIds: Set<string>;
  assignedItemIds:     Set<string>;
  onAssignCategory:    (taxId: string, catId: string, assign: boolean) => Promise<void>;
  onAssignItem:        (taxId: string, itemId: string, assign: boolean) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  async function toggleCategory(catId: string) {
    setSaving(catId);
    await onAssignCategory(tax.id, catId, !assignedCategoryIds.has(catId));
    setSaving(null);
  }

  async function toggleItem(itemId: string) {
    setSaving(itemId);
    await onAssignItem(tax.id, itemId, !assignedItemIds.has(itemId));
    setSaving(null);
  }

  if (tax.applies_to === 'category') {
    const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-purple-700">Assign to Categories</p>
          <span className="text-xs text-gray-400 dark:text-neutral-500">{assignedCategoryIds.size} selected</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
          />
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
          {filtered.length === 0 && <p className="text-xs text-gray-400 dark:text-neutral-500 text-center py-4">No categories found</p>}
          {filtered.map(cat => {
            const checked = assignedCategoryIds.has(cat.id);
            const loading = saving === cat.id;
            return (
              <label key={cat.id} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors', checked ? 'bg-purple-50 border border-purple-200' : 'hover:bg-gray-50 dark:bg-neutral-800/50 border border-transparent')}>
                <div onClick={() => !loading && toggleCategory(cat.id)} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors', checked ? 'bg-purple-600 border-purple-600' : 'border-gray-300 dark:border-neutral-600', loading && 'opacity-50')}>
                  {loading ? <Loader2 className="w-2.5 h-2.5 text-white animate-spin" /> : checked && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="text-sm text-gray-800 dark:text-neutral-200 flex-1" onClick={() => !loading && toggleCategory(cat.id)}>{cat.name}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (tax.applies_to === 'item') {
    const filtered  = menuItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    const grouped   = categories.map(cat => ({ cat, items: filtered.filter(i => i.category_id === cat.id) })).filter(g => g.items.length > 0);
    const uncategorized = filtered.filter(i => !categories.find(c => c.id === i.category_id));

    return (
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-cyan-700">Assign to Menu Items</p>
          <span className="text-xs text-gray-400 dark:text-neutral-500">{assignedItemIds.size} selected</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
          />
        </div>
        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 && <p className="text-xs text-gray-400 dark:text-neutral-500 text-center py-4">No items found</p>}
          {[...grouped, ...(uncategorized.length > 0 ? [{ cat: { id: '__none__', name: 'Uncategorized' }, items: uncategorized }] : [])].map(({ cat, items }) => (
            <div key={cat.id}>
              <p className="text-xs font-semibold text-gray-400 dark:text-neutral-500 px-1 mb-1">{cat.name}</p>
              {items.map(item => {
                const checked = assignedItemIds.has(item.id);
                const loading = saving === item.id;
                return (
                  <label key={item.id} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors', checked ? 'bg-cyan-50 border border-cyan-200' : 'hover:bg-gray-50 dark:bg-neutral-800/50 border border-transparent')}>
                    <div onClick={() => !loading && toggleItem(item.id)} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors', checked ? 'bg-cyan-600 border-cyan-600' : 'border-gray-300 dark:border-neutral-600', loading && 'opacity-50')}>
                      {loading ? <Loader2 className="w-2.5 h-2.5 text-white animate-spin" /> : checked && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-sm text-gray-800 dark:text-neutral-200 flex-1" onClick={() => !loading && toggleItem(item.id)}>{item.name}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// ── Tax Form Modal ─────────────────────────────────────────────────────────────
function TaxFormModal({
  initial, categories, menuItems, onSave, onClose,
}: {
  initial:    Partial<TaxConfig> | null;
  categories: Category[];
  menuItems:  MenuItem[];
  onSave:     (data: Omit<TaxConfig, 'id'>, id?: string) => Promise<void>;
  onClose:    () => void;
}) {
  const [form, setForm] = useState<Omit<TaxConfig, 'id'>>({ ...EMPTY_FORM, ...(initial ?? {}) });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const isEdit = !!(initial as TaxConfig)?.id;

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Tax name is required.'); return; }
    if (form.rate < 0)     { setErr('Rate cannot be negative.'); return; }
    setSaving(true);
    await onSave(form, (initial as TaxConfig)?.id);
    setSaving(false);
    onClose();
  }

  const previewBase = 100;
  const previewTax  = form.type === 'fixed'
    ? (form.is_inclusive ? 0 : form.rate)
    : form.is_inclusive
      ? previewBase - previewBase / (1 + form.rate / 100)
      : previewBase * (form.rate / 100);
  const previewTotal = form.is_inclusive ? previewBase : previewBase + previewTax;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Percent className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-neutral-100">{isEdit ? 'Edit Tax Rule' : 'New Tax Rule'}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 p-1 rounded-lg hover:bg-gray-100 dark:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {err && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Tax Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. SST, Service Charge, VAT"
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Code</label>
              <input type="text" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SST" maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Rate {form.type === 'percentage' || form.type === 'service_charge' ? '(%)' : '(RM)'}</label>
              <input type="number" value={form.rate} onChange={e => set('rate', parseFloat(e.target.value) || 0)} min={0} step={0.01}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                <option value="percentage">Percentage (%)</option>
                <option value="service_charge">Service Charge</option>
                <option value="fixed">Fixed Amount (RM)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Applies To</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(APPLIES_LABELS).map(([val, { label, desc }]) => (
                <button key={val} type="button" onClick={() => set('applies_to', val as any)}
                  className={cn('text-left px-3 py-2.5 rounded-xl border-2 transition-all',
                    form.applies_to === val ? 'border-amber-400 bg-amber-50' : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:bg-neutral-800/50')}>
                  <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{label}</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
            {(form.applies_to === 'category' || form.applies_to === 'item') && (
              <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                After saving, expand the tax rule card to assign specific {form.applies_to === 'category' ? 'categories' : 'menu items'}.
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Priority <span className="text-gray-400 dark:text-neutral-500 font-normal">(higher = evaluated first)</span></label>
            <input type="number" value={form.priority} onChange={e => set('priority', parseInt(e.target.value) || 0)} min={0}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>

          <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-neutral-800">
            {[
              { key: 'is_inclusive',       label: 'Tax Inclusive',   desc: 'Price already includes this tax' },
              { key: 'display_on_receipt', label: 'Show on Receipt', desc: 'Display this tax as a line item on receipts' },
              { key: 'is_active',          label: 'Active',          desc: 'Enable this tax rule at checkout' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-neutral-200">{label}</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500">{desc}</p>
                </div>
                <button type="button" onClick={() => set(key as any, !(form as any)[key])} className="shrink-0">
                  {(form as any)[key] ? <ToggleRight className="w-7 h-7 text-emerald-500" /> : <ToggleLeft className="w-7 h-7 text-gray-300" />}
                </button>
              </label>
            ))}
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
            <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Live Preview on RM 100.00
            </p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-neutral-400"><span>Subtotal</span><span>RM 100.00</span></div>
              <div className="flex justify-between text-amber-700 font-medium">
                <span>{form.name || 'Tax'} ({form.type === 'fixed' ? `RM ${form.rate}` : `${form.rate}%`}){form.is_inclusive ? ' incl.' : ''}</span>
                <span>{form.is_inclusive ? '—' : `+ RM ${previewTax.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 dark:text-neutral-100 border-t border-amber-200 pt-1 mt-1">
                <span>Total</span><span>RM {previewTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:text-neutral-100 rounded-xl hover:bg-gray-100 dark:bg-neutral-800 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? 'Save Changes' : 'Add Tax Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tax Rule Card ──────────────────────────────────────────────────────────────
function TaxRuleCard({
  tax, onToggle, onEdit, onDelete, rank,
  categories, menuItems,
  assignedCategoryIds, assignedItemIds,
  onAssignCategory, onAssignItem,
}: {
  tax:                 TaxConfig;
  onToggle:            (id: string, val: boolean) => void;
  onEdit:              (tax: TaxConfig) => void;
  onDelete:            (tax: TaxConfig) => void;
  rank:                number;
  categories:          Category[];
  menuItems:           MenuItem[];
  assignedCategoryIds: Set<string>;
  assignedItemIds:     Set<string>;
  onAssignCategory:    (taxId: string, catId: string, assign: boolean) => Promise<void>;
  onAssignItem:        (taxId: string, itemId: string, assign: boolean) => Promise<void>;
  key?:                React.Key;
}) {
  const [expanded, setExpanded] = useState(false);
  const applies   = APPLIES_LABELS[tax.applies_to];
  const canExpand = tax.applies_to === 'category' || tax.applies_to === 'item';

  return (
    <div className={cn('group relative bg-white dark:bg-neutral-900 rounded-2xl border transition-all duration-200',
      tax.is_active ? 'border-gray-200 dark:border-neutral-700 shadow-sm hover:shadow-md hover:border-amber-200' : 'border-gray-100 dark:border-neutral-800 opacity-55')}>
      <div className="absolute -top-2.5 -left-2.5">
        <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-xs font-bold text-gray-500 dark:text-neutral-500 flex items-center justify-center shadow-sm">{rank}</span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm',
              tax.is_active ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500')}>
              {tax.code || tax.name.slice(0, 3).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-gray-900 dark:text-neutral-100">{tax.name}</h4>
                {tax.is_inclusive && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">Inclusive</span>}
                {!tax.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 font-medium">Inactive</span>}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-2xl font-black text-gray-900 dark:text-neutral-100">
                  {tax.type === 'fixed' ? `RM ${tax.rate.toFixed(2)}` : `${tax.rate}%`}
                </span>
                <span className="text-xs text-gray-400 dark:text-neutral-500">{TYPE_LABELS[tax.type]}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onToggle(tax.id, !tax.is_active)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800 transition-colors" title={tax.is_active ? 'Deactivate' : 'Activate'}>
              {tax.is_active ? <ToggleRight className="w-6 h-6 text-emerald-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400 dark:text-neutral-500" />}
            </button>
            <button onClick={() => onEdit(tax)} className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            {/* Now calls onDelete with the full tax object, not window.confirm */}
            <button onClick={() => onDelete(tax)} className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800">
          <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium', applies.color)}>{applies.label}</span>
          {tax.display_on_receipt && (
            <span className="text-xs px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200 font-medium flex items-center gap-1">
              <Receipt className="w-3 h-3" /> On Receipt
            </span>
          )}
          <span className="text-xs px-2.5 py-1 rounded-full border bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 border-gray-200 dark:border-neutral-700 font-medium flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" /> Priority {tax.priority}
          </span>
          {tax.applies_to === 'category' && assignedCategoryIds.size > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-200 font-medium">
              {assignedCategoryIds.size} {assignedCategoryIds.size === 1 ? 'category' : 'categories'}
            </span>
          )}
          {tax.applies_to === 'item' && assignedItemIds.size > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full border bg-cyan-50 text-cyan-700 border-cyan-200 font-medium">
              {assignedItemIds.size} {assignedItemIds.size === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {canExpand && (
          <button onClick={() => setExpanded(p => !p)}
            className={cn('mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
              expanded ? 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400' : 'bg-gray-50 dark:bg-neutral-800/50 hover:bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500')}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Hide' : `Assign ${tax.applies_to === 'category' ? 'Categories' : 'Items'}`}
          </button>
        )}

        {canExpand && expanded && (
          <AssignmentPanel
            tax={tax} categories={categories} menuItems={menuItems}
            assignedCategoryIds={assignedCategoryIds} assignedItemIds={assignedItemIds}
            onAssignCategory={onAssignCategory} onAssignItem={onAssignItem}
          />
        )}
      </div>
    </div>
  );
}

// ── Summary Stats ──────────────────────────────────────────────────────────────
function TaxSummaryStats({ taxes }: { taxes: TaxConfig[] }) {
  const active    = taxes.filter(t => t.is_active);
  const inactive  = taxes.filter(t => !t.is_active);
  const inclusive = active.filter(t => t.is_inclusive);
  const exclusive = active.filter(t => !t.is_inclusive);

  const stats = [
    { label: 'Active Rules',  value: active.length,    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    { label: 'Inactive',      value: inactive.length,  color: 'bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 border-gray-200 dark:border-neutral-700',           icon: AlertTriangle },
    { label: 'Tax Exclusive', value: exclusive.length, color: 'bg-amber-50 text-amber-700 border-amber-200',        icon: Percent },
    { label: 'Tax Inclusive', value: inclusive.length, color: 'bg-blue-50 text-blue-700 border-blue-200',           icon: Layers },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <div key={i} className={cn('rounded-2xl border px-4 py-3 flex items-center gap-3', s.color)}>
          <s.icon className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs font-medium opacity-75">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Simulator ──────────────────────────────────────────────────────────────────
function TaxSimulator({ configs, categories, menuItems, activeMerchantId }: {
  configs:    TaxConfig[];
  categories: Category[];
  menuItems:  MenuItem[];
  activeMerchantId: string;
}) {
  const [subtotal, setSubtotal]       = useState(100);
  const [selCategory, setSelCategory] = useState('');
  const [selItem, setSelItem]         = useState('');
  const [overrides, setOverrides]     = useState<any[]>([]);
  const [catRules, setCatRules]       = useState<any[]>([]);

  useEffect(() => {
    if (!activeMerchantId) return;
    Promise.all([
      supabase.from('tax_item_override').select('*').eq('merchant_id', activeMerchantId),
      supabase.from('tax_category_rule').select('*').eq('merchant_id', activeMerchantId),
    ]).then(([ov, cr]) => {
      setOverrides(ov.data ?? []);
      setCatRules(cr.data ?? []);
    });
  }, [activeMerchantId]);

  const ctx    = { configs, itemOverrides: overrides, categoryRules: catRules };
  const result = calculateOrderTax([{ menu_item_id: selItem || undefined, category_id: selCategory || undefined, subtotal }], ctx);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 dark:text-neutral-100">Tax Simulator</h3>
          <p className="text-xs text-gray-400 dark:text-neutral-500">Test how taxes apply to different items</p>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Subtotal (RM)</label>
            <input type="number" value={subtotal} onChange={e => setSubtotal(parseFloat(e.target.value) || 0)} min={0} step={0.01}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Category (optional)</label>
            <select value={selCategory} onChange={e => { setSelCategory(e.target.value); setSelItem(''); }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              <option value="">None</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Menu Item (optional)</label>
            <select value={selItem} onChange={e => setSelItem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              <option value="">None</option>
              {menuItems.filter(i => !selCategory || i.category_id === selCategory).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-gray-200 dark:border-neutral-700 space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-neutral-400"><span>Subtotal</span><span>RM {result.subtotal.toFixed(2)}</span></div>
          {result.tax_lines.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4" /> Tax Exempt — no taxes apply
            </div>
          ) : (
            result.tax_lines.map((line, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-amber-700 font-medium">
                  {line.name} ({line.rate}{line.type === 'fixed' ? ' RM' : '%'})
                  {line.is_inclusive && <span className="text-xs text-gray-400 dark:text-neutral-500 ml-1">(incl.)</span>}
                </span>
                <span className="font-semibold text-amber-700">{line.is_inclusive ? '—' : `+ RM ${line.amount.toFixed(2)}`}</span>
              </div>
            ))
          )}
          <div className="flex justify-between font-bold text-gray-900 dark:text-neutral-100 text-base border-t border-gray-300 dark:border-neutral-600 pt-2 mt-1">
            <span>Grand Total</span><span>RM {result.grand_total.toFixed(2)}</span>
          </div>
        </div>

        <div className="text-xs text-gray-400 dark:text-neutral-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <span>{selItem ? 'Item-level override → Category rule → Global taxes' : selCategory ? 'Category rule → Global taxes' : 'Global taxes applied (no item/category selected)'}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function TaxManagement() {
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const activeMerchantId = (isImpersonating ? impersonatedMerchantId : 
    (JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null)) ?? '';
  const { configs, loading, error, refetch } = useTaxConfig(activeMerchantId);

  const [taxes, setTaxes]           = useState<TaxConfig[]>([]);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<TaxConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaxConfig | null>(null); // ← delete modal
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([]);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<'rules' | 'simulator' | 'guide'>('rules');
  const [categoryAssignments, setCategoryAssignments] = useState<Record<string, Set<string>>>({});
  const [itemAssignments, setItemAssignments]         = useState<Record<string, Set<string>>>({});

  async function writeAudit(action: string, targetName: string, metadata?: Record<string, any>) {
    if (!activeMerchantId) return;
    try {
      await supabase.from('audit_logs').insert({
        action,
        target_name: targetName,
        metadata: metadata ?? null,
        merchant_id: activeMerchantId,
      });
    } catch {
      // non-critical
    }
  }

  useEffect(() => { setTaxes(configs); }, [configs]);

  useEffect(() => {
    async function fetchAll() {
      if (!activeMerchantId) return;
      const [catRes, menuRes, catRules, itemOverrides] = await Promise.all([
        supabase.from('menu_categories').select('id, name').eq('merchant_id', activeMerchantId).order('name'),
        supabase.from('menu').select('id, name, category_id').eq('merchant_id', activeMerchantId).is('deleted_at', null).order('name'),
        supabase.from('tax_category_rule').select('*').eq('merchant_id', activeMerchantId),
        supabase.from('tax_item_override').select('*').eq('merchant_id', activeMerchantId),
      ]);
      setCategories(catRes.data ?? []);
      setMenuItems(menuRes.data ?? []);

      const catMap: Record<string, Set<string>> = {};
      for (const row of catRules.data ?? []) {
        if (!catMap[row.tax_config_id]) catMap[row.tax_config_id] = new Set();
        catMap[row.tax_config_id].add(row.category_id);
      }
      setCategoryAssignments(catMap);

      const itemMap: Record<string, Set<string>> = {};
      for (const row of itemOverrides.data ?? []) {
        if (!itemMap[row.tax_config_id]) itemMap[row.tax_config_id] = new Set();
        itemMap[row.tax_config_id].add(row.menu_item_id);
      }
      setItemAssignments(itemMap);
    }
    fetchAll();
  }, [activeMerchantId]);

  async function handleSave(data: Omit<TaxConfig, 'id'>, id?: string) {
    if (!activeMerchantId) { setSaveError('Missing merchant context.'); return; }
    setSaveError(null);
    const payload = {
      name: data.name, code: data.code, rate: data.rate, type: data.type,
      applies_to: data.applies_to, is_inclusive: data.is_inclusive,
      is_active: data.is_active, display_on_receipt: data.display_on_receipt, priority: data.priority,
    };
    if (id) {
      const { error } = await supabase.from('tax_config').update(payload).eq('id', id).eq('merchant_id', activeMerchantId);
      if (error) { setSaveError(error.message); return; }
      setTaxes(prev => prev.map(t => t.id === id ? { ...t, ...payload } : t));
      await writeAudit('tax_rule_updated', data.name, { tax_id: id });
    } else {
      const { data: inserted, error } = await supabase.from('tax_config').insert({ ...payload, merchant_id: activeMerchantId }).select().single();
      if (error) { setSaveError(error.message); return; }
      setTaxes(prev => [...prev, inserted]);
      await writeAudit('tax_rule_created', data.name);
    }
  }

  async function handleToggle(id: string, val: boolean) {
    if (!activeMerchantId) { setSaveError('Missing merchant context.'); return; }
    setTaxes(prev => prev.map(t => t.id === id ? { ...t, is_active: val } : t));
    const { error } = await supabase.from('tax_config').update({ is_active: val }).eq('id', id).eq('merchant_id', activeMerchantId);
    if (error) {
      setSaveError(error.message);
      setTaxes(prev => prev.map(t => t.id === id ? { ...t, is_active: !val } : t));
    } else {
      await writeAudit('tax_rule_toggled', 'Tax Rule', { tax_id: id, is_active: val });
    }
  }

  // ← No more window.confirm — just set deleteTarget to open the modal
  async function handleDeleteConfirmed() {
    if (!deleteTarget || !activeMerchantId) return;
    setTaxes(prev => prev.filter(t => t.id !== deleteTarget.id));
    const { error } = await supabase.from('tax_config').delete().eq('id', deleteTarget.id).eq('merchant_id', activeMerchantId);
    if (error) { setSaveError(error.message); refetch(); }
    else await writeAudit('tax_rule_deleted', deleteTarget.name, { tax_id: deleteTarget.id });
  }

  async function handleAssignCategory(taxId: string, catId: string, assign: boolean) {
    if (assign) {
      const { error } = await supabase.from('tax_category_rule').insert({ tax_config_id: taxId, category_id: catId });
      if (error) { setSaveError(error.message); return; }
      setCategoryAssignments(prev => { const n = { ...prev }; if (!n[taxId]) n[taxId] = new Set(); n[taxId] = new Set([...n[taxId], catId]); return n; });
      await writeAudit('tax_category_assigned', 'Tax Category Assignment', { tax_id: taxId, category_id: catId });
    } else {
      const { error } = await supabase.from('tax_category_rule').delete().eq('tax_config_id', taxId).eq('category_id', catId);
      if (error) { setSaveError(error.message); return; }
      setCategoryAssignments(prev => { const n = { ...prev }; if (n[taxId]) n[taxId] = new Set([...n[taxId]].filter(id => id !== catId)); return n; });
      await writeAudit('tax_category_unassigned', 'Tax Category Assignment', { tax_id: taxId, category_id: catId });
    }
  }

  async function handleAssignItem(taxId: string, itemId: string, assign: boolean) {
    if (assign) {
      const { error } = await supabase.from('tax_item_override').insert({ tax_config_id: taxId, menu_item_id: itemId });
      if (error) { setSaveError(error.message); return; }
      setItemAssignments(prev => { const n = { ...prev }; if (!n[taxId]) n[taxId] = new Set(); n[taxId] = new Set([...n[taxId], itemId]); return n; });
      await writeAudit('tax_item_assigned', 'Tax Item Assignment', { tax_id: taxId, item_id: itemId });
    } else {
      const { error } = await supabase.from('tax_item_override').delete().eq('tax_config_id', taxId).eq('menu_item_id', itemId);
      if (error) { setSaveError(error.message); return; }
      setItemAssignments(prev => { const n = { ...prev }; if (n[taxId]) n[taxId] = new Set([...n[taxId]].filter(id => id !== itemId)); return n; });
      await writeAudit('tax_item_unassigned', 'Tax Item Assignment', { tax_id: taxId, item_id: itemId });
    }
  }

  const sortedTaxes   = [...taxes].sort((a, b) => b.priority - a.priority);
  const activeTaxes   = sortedTaxes.filter(t => t.is_active);
  const inactiveTaxes = sortedTaxes.filter(t => !t.is_active);

  const tabs = [
    { key: 'rules',     label: 'Tax Rules',   icon: Percent    },
    { key: 'simulator', label: 'Simulator',   icon: BookOpen   },
    { key: 'guide',     label: 'Setup Guide', icon: AlertCircle },
  ] as const;

  const cardProps = (tax: TaxConfig, rank: number) => ({
    tax, rank, categories, menuItems,
    assignedCategoryIds: categoryAssignments[tax.id] ?? new Set<string>(),
    assignedItemIds:     itemAssignments[tax.id]     ?? new Set<string>(),
    onToggle:            handleToggle,
    onEdit:              (t: TaxConfig) => { setEditTarget(t); setModalOpen(true); },
    onDelete:            (t: TaxConfig) => setDeleteTarget(t), // ← opens delete modal
    onAssignCategory:    handleAssignCategory,
    onAssignItem:        handleAssignItem,
  });

  return (
    <>
      {/* Edit / Create modal */}
      {modalOpen && (
        <TaxFormModal
          initial={editTarget} categories={categories} menuItems={menuItems}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          tax={deleteTarget}
          onConfirm={handleDeleteConfirmed}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              Tax Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1 ml-13">Configure tax rules that apply at checkout across your POS</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} disabled={loading} className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:bg-neutral-800/50 transition-colors shadow-sm disabled:opacity-50">
              <RefreshCw className={cn('w-4 h-4 text-gray-500 dark:text-neutral-500', loading && 'animate-spin')} />
            </button>
            <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors shadow-sm shadow-amber-100">
              <Plus className="w-4 h-4" /> Add Tax Rule
            </button>
          </div>
        </div>

        {(error || saveError) && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error || saveError}
          </div>
        )}

        <TaxSummaryStats taxes={taxes} />

        <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-xl w-fit">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === key ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 shadow-sm' : 'text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300')}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {activeTab === 'rules' && (
          <div className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 dark:text-neutral-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading tax rules...
              </div>
            ) : taxes.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-gray-300 dark:border-neutral-600">
                <Percent className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="font-semibold text-gray-500 dark:text-neutral-500">No tax rules yet</p>
                <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">Add your first tax rule to get started</p>
                <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors mx-auto">
                  <Plus className="w-4 h-4" /> Add Tax Rule
                </button>
              </div>
            ) : (
              <>
                {activeTaxes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-neutral-500 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Active Rules — applied at checkout ({activeTaxes.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {activeTaxes.map((tax, i) => <TaxRuleCard key={tax.id} {...cardProps(tax, i + 1)} />)}
                    </div>
                  </div>
                )}
                {inactiveTaxes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-neutral-500 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-gray-400 dark:text-neutral-500" /> Inactive Rules ({inactiveTaxes.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {inactiveTaxes.map((tax, i) => <TaxRuleCard key={tax.id} {...cardProps(tax, activeTaxes.length + i + 1)} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'simulator' && (
          <TaxSimulator configs={taxes} categories={categories} menuItems={menuItems} activeMerchantId={activeMerchantId} />
        )}

        {activeTab === 'guide' && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50">
              <h3 className="font-bold text-gray-900 dark:text-neutral-100 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" /> Tax Setup Guide for Malaysia
              </h3>
            </div>
            <div className="p-6 space-y-5 text-sm">
              {[
                { step: '1', title: 'Standard SST (Sales & Service Tax)', color: 'bg-amber-50 border-amber-200', content: 'Set Rate = 6%, Type = Percentage, Applies To = All Items, Inclusive = OFF. This is the standard configuration for most Malaysian F&B businesses.' },
                { step: '2', title: 'Service Charge (10%)', color: 'bg-blue-50 border-blue-200', content: 'Set Rate = 10%, Type = Service Charge, Applies To = Order Level. Service charge is applied on the subtotal after item taxes.' },
                { step: '3', title: 'Category or Item-Specific Taxes', color: 'bg-purple-50 border-purple-200', content: 'Set Applies To = By Category or By Item, then save. Expand the tax rule card and use the checkbox list to assign it to specific categories or menu items.' },
                { step: '4', title: 'Tax Inclusive Pricing', color: 'bg-emerald-50 border-emerald-200', content: 'Enable "Tax Inclusive" if your menu prices already include SST. The system extracts the tax portion and shows it separately on the receipt without adding extra.' },
                { step: '5', title: 'Priority Order', color: 'bg-rose-50 border-rose-200', content: 'Item Override → Category Rule → Global (All Items) → Order Level. Higher priority number = evaluated first. Set Service Charge priority higher than SST.' },
              ].map(({ step, title, color, content }) => (
                <div key={step} className={cn('rounded-xl border p-4', color)}>
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-white dark:bg-neutral-900 border border-current/20 text-sm font-black flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-neutral-100 mb-1">{title}</p>
                      <p className="text-gray-600 dark:text-neutral-400 leading-relaxed">{content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}