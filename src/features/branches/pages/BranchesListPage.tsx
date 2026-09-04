import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, MapPin, Store, Loader2, X, Phone, Mail,
  ArrowLeft, Users, UtensilsCrossed, MonitorSmartphone, Save, KeyRound,
  Settings as SettingsIcon
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTranslation } from '../../../contexts/TranslationContext';
import { cn } from '../../../utils/cn';
import { useDataLoader } from '../../../hooks/useDataLoader';
import { useImpersonation } from '../../../contexts/ImpersonationContext';

// ─────────────────────────────────────────────────────────────────────────────
// BranchPage
// ─────────────────────────────────────────────────────────────────────────────

interface BranchPageProps {
  id: string;
  onBack: () => void;
}

function BranchPage({ id, onBack }: BranchPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'staff' | 'menu' | 'kds' | 'settings'>('staff');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [branchSettings, setBranchSettings] = useState<any[]>([]);

  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const getLocalMerchantId = () => {
    try { return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null; }
    catch { return null; }
  };
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : getLocalMerchantId();

  const [branch, setBranch] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [branchMenu, setBranchMenu] = useState<any[]>([]);
  const [kdsStations, setKdsStations] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  const unassignedUsers = allUsers.filter(u => !assignedUserIds.includes(u.id));
  const [staffForm, setStaffForm] = useState<any>({});
  const [isKdsModalOpen, setIsKdsModalOpen] = useState(false);
  const [kdsForm, setKdsForm] = useState<any>({});

  const fetchData = useCallback(async () => {
    if (!activeMerchantId || !id) return;
    setLoading(true);
    try {
      const [branchRes, staffRes, catRes, menuRes, bmRes, kdsRes, settingsRes, usersRes, assignedRes] = await Promise.all([
        supabase
          .from('branches')
          .select('*')
          .eq('id', id)
          .eq('merchant_id', activeMerchantId)
          .single(),

        supabase
          .from('branch_staff')
          .select('id, role, is_primary, user_id, users(id, name, email, pin, is_active, avatar_url)')
          .eq('branch_id', id)
          .eq('merchant_id', activeMerchantId),

        supabase
          .from('menu_categories')
          .select('id, name')
          .eq('merchant_id', activeMerchantId)
          .order('sort_order'),

        supabase
          .from('menu')
          .select('id, name, category_id, base_price, price_type')
          .eq('merchant_id', activeMerchantId)
          .is('deleted_at', null),

        supabase
          .from('branch_menu')
          .select('branch_id, menu_id, is_available, override_price, merchant_id')
          .eq('branch_id', id)
          .eq('merchant_id', activeMerchantId),

        supabase
          .from('kds_stations')
          .select('*')
          .eq('merchant_id', activeMerchantId),

        supabase
          .from('settings')
          .select('*')
          .eq('merchant_id', activeMerchantId)
          .in('key', [
            'split_bill_enabled',
            'menu_modifierRequired',
            'table_autoClose',
            'menu_negativeStock',
            'menu_priceOverride',
          ])
          .or(`branch_id.is.null,branch_id.eq.${id}`),

        supabase
          .from('users')
          .select('id, name, email, pin')
          .eq('merchant_id', activeMerchantId)
          .order('name'),

        supabase
          .from('branch_staff')
          .select('user_id')
          .eq('merchant_id', activeMerchantId),
      ]);

      if (branchRes.error) throw branchRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (assignedRes.error) throw assignedRes.error;

      setBranch(branchRes.data);

      const staffList = (staffRes.data || []).map((bs: any) => ({
        branch_staff_id: bs.id,
        role: bs.role,
        is_primary: bs.is_primary,
        ...bs.users,
      }));
      setStaff(staffList);

      setMenuCategories(catRes.data || []);
      setMenuItems(menuRes.data || []);
      setAllUsers(usersRes.data || []);
      setAssignedUserIds((assignedRes.data || []).map((bs: any) => bs.user_id));
      setBranchMenu(bmRes.data || []);
      setKdsStations(kdsRes.data || []);

      const settingsData = settingsRes.data || [];
      const newSettings = [
        { key: 'split_bill_enabled', label: 'Split Bill', description: 'Allow splitting bills between customers', merchantValue: 'false', branchValue: null, isOverridden: false, pendingValue: 'false' },
        { key: 'menu_modifierRequired', label: 'Require Modifier Selection', description: 'Force selection of required options (e.g., size, spice level)', merchantValue: 'false', branchValue: null, isOverridden: false, pendingValue: 'false' },
        { key: 'table_autoClose', label: 'Auto-Close Table After Payment', description: 'Automatically free table once bill is settled', merchantValue: 'false', branchValue: null, isOverridden: false, pendingValue: 'false' },
        { key: 'menu_negativeStock', label: 'Allow Negative Stock', description: 'Items can be ordered even when out of stock', merchantValue: 'false', branchValue: null, isOverridden: false, pendingValue: 'false' },
        { key: 'menu_priceOverride', label: 'Allow Price Override', description: 'Cashiers can manually change item prices', merchantValue: 'false', branchValue: null, isOverridden: false, pendingValue: 'false' },
      ].map(s => {
        const rows = settingsData.filter((r: any) => r.key === s.key);
        const merchantRow = rows.find((r: any) => r.branch_id === null);
        const branchRow = rows.find((r: any) => r.branch_id === id);
        
        const merchantVal = merchantRow ? merchantRow.value : 'false';
        const branchVal = branchRow ? branchRow.value : null;
        const overridden = branchRow !== undefined;
        
        return {
          ...s,
          merchantValue: merchantVal,
          branchValue: branchVal,
          isOverridden: overridden,
          pendingValue: overridden ? (branchVal ?? 'false') : merchantVal,
        };
      });
      setBranchSettings(newSettings);

    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to load branch data' });
    } finally {
      setLoading(false);
    }
  }, [id, activeMerchantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMerchantId) return;
    setSaving(true);
    try {
      if (staffForm.branch_staff_id) {
        // Edit mode: update both pin (users table) and role (branch_staff table)
        const { error: uErr } = await supabase
          .from('users')
          .update({ pin: staffForm.pin })
          .eq('id', staffForm.id);
        if (uErr) throw uErr;

        const { error: bsErr } = await supabase
          .from('branch_staff')
          .update({ role: staffForm.role || 'cashier' })
          .eq('id', staffForm.branch_staff_id);
        if (bsErr) throw bsErr;
      } else {
        // Add mode: assign selected user and update pin if specified
        if (!staffForm.id) {
          throw new Error('Please select a staff member.');
        }

        const { error: uErr } = await supabase
          .from('users')
          .update({ pin: staffForm.pin })
          .eq('id', staffForm.id);
        if (uErr) throw uErr;

        const { error: bsErr } = await supabase.from('branch_staff').insert([{
          branch_id: id,
          user_id: staffForm.id,
          role: staffForm.role || 'cashier',
          is_primary: false,
          merchant_id: activeMerchantId,
        }]);
        if (bsErr) throw bsErr;
      }

      setIsStaffModalOpen(false);
      setStaffForm({});
      fetchData();
      setAlert({ type: 'success', message: 'Staff saved successfully' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStaff = async (branchStaffId: string) => {
    if (!window.confirm('Remove this staff member from this branch?')) return;
    try {
      const { error } = await supabase.from('branch_staff').delete().eq('id', branchStaffId);
      if (error) throw error;
      fetchData();
      setAlert({ type: 'success', message: 'Staff removed from branch' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const toggleMenuItem = (menuId: string, isAvailable: boolean) => {
    const existing = branchMenu.find(bm => bm.menu_id === menuId);
    if (existing) {
      setBranchMenu(prev => prev.map(bm => bm.menu_id === menuId ? { ...bm, is_available: isAvailable } : bm));
    } else {
      setBranchMenu(prev => [...prev, { branch_id: id, menu_id: menuId, is_available: isAvailable, override_price: null, merchant_id: activeMerchantId }]);
    }
  };

  const updateOverridePrice = (menuId: string, price: number | null) => {
    const existing = branchMenu.find(bm => bm.menu_id === menuId);
    if (existing) {
      setBranchMenu(prev => prev.map(bm => bm.menu_id === menuId ? { ...bm, override_price: price } : bm));
    } else {
      setBranchMenu(prev => [...prev, { branch_id: id, menu_id: menuId, is_available: true, override_price: price, merchant_id: activeMerchantId }]);
    }
  };

  const handleSaveMenu = async () => {
    if (!activeMerchantId) return;
    setSaving(true);
    try {
      const payload = branchMenu.map(bm => ({
        branch_id: id,
        menu_id: bm.menu_id,
        is_available: bm.is_available,
        override_price: bm.override_price ?? null,
        merchant_id: activeMerchantId,
      }));

      const { error } = await supabase
        .from('branch_menu')
        .upsert(payload, { onConflict: 'branch_id,menu_id' });
      if (error) throw error;
      setAlert({ type: 'success', message: 'Menu availability saved' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMerchantId) return;
    setSaving(true);
    try {
      const payload = {
        name: kdsForm.name,
        is_active: kdsForm.is_active ?? true,
        merchant_id: activeMerchantId,
      };

      if (kdsForm.id) {
        const { error } = await supabase.from('kds_stations').update(payload).eq('id', kdsForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kds_stations').insert([payload]);
        if (error) throw error;
      }
      setIsKdsModalOpen(false);
      setKdsForm({});
      fetchData();
      setAlert({ type: 'success', message: 'KDS Station saved' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKds = async (kdsId: string) => {
    if (!window.confirm('Delete this KDS station?')) return;
    try {
      const { error } = await supabase.from('kds_stations').delete().eq('id', kdsId);
      if (error) throw error;
      fetchData();
      setAlert({ type: 'success', message: 'KDS station deleted' });
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  const handleSettingOverrideChange = (key: string, isOverridden: boolean) => {
    setBranchSettings(prev => prev.map(s => {
      if (s.key !== key) return s;
      return {
        ...s,
        isOverridden,
        pendingValue: isOverridden ? (s.branchValue ?? s.merchantValue) : s.merchantValue,
      };
    }));
  };

  const handleSettingValueChange = (key: string, pendingValue: string) => {
    setBranchSettings(prev => prev.map(s => {
      if (s.key !== key) return s;
      return {
        ...s,
        pendingValue,
      };
    }));
  };

  const getUpdatedBy = () => {
    try { return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.id ?? null; }
    catch { return null; }
  };

  const handleSaveSettings = async () => {
    if (!activeMerchantId) return;
    setSaving(true);
    try {
      const toUpsert: any[] = [];
      const toDelete: string[] = [];

      for (const s of branchSettings) {
        if (s.isOverridden) {
          toUpsert.push({
            key: s.key,
            value: s.pendingValue,
            description: s.key === 'split_bill_enabled'
              ? 'Payment setting: split_bill_enabled override'
              : `${s.key.startsWith('menu_') ? 'Menu' : s.key.startsWith('table_') ? 'Table' : 'General'} setting: ${s.key.split('_')[1]} override`,
            merchant_id: activeMerchantId,
            branch_id: id,
            updated_by: getUpdatedBy(),
          });
        } else {
          toDelete.push(s.key);
        }
      }

      if (toUpsert.length > 0) {
        const { error: upsertErr } = await supabase
          .from('settings')
          .upsert(toUpsert, { onConflict: 'merchant_id,branch_id,key' });
        if (upsertErr) throw upsertErr;
      }

      if (toDelete.length > 0) {
        const { error: deleteErr } = await supabase
          .from('settings')
          .delete()
          .eq('merchant_id', activeMerchantId)
          .eq('branch_id', id)
          .in('key', toDelete);
        if (deleteErr) throw deleteErr;
      }

      setAlert({ type: 'success', message: 'Settings saved successfully' });
      fetchData();
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!branch) {
    return <div className="p-8 text-center text-gray-500 dark:text-neutral-500">Branch not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-lg hover:bg-gray-50 dark:bg-neutral-800/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-neutral-400" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{branch.name}</h1>
            <span className={cn(
              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
              branch.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400'
            )}>
              {branch.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-0.5">{branch.address}</p>
        </div>
      </div>

      {alert && (
        <div className={cn(
          'px-4 py-3 rounded-lg text-sm font-medium border',
          alert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        )}>
          {alert.message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-[var(--sb-border)]">
        {(['staff', 'menu', 'kds', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors capitalize',
              activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 dark:text-neutral-500 hover:text-gray-800 dark:text-neutral-200'
            )}
          >
            {tab === 'staff' && <><Users className="w-4 h-4" /> Staff Access</>}
            {tab === 'menu'  && <><UtensilsCrossed className="w-4 h-4" /> Menu & Pricing</>}
            {tab === 'kds'   && <><MonitorSmartphone className="w-4 h-4" /> KDS Stations</>}
            {tab === 'settings' && <><SettingsIcon className="w-4 h-4" /> Settings</>}
          </button>
        ))}
      </div>

      {/* ── TAB: STAFF ────────────────────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-[var(--sb-border)] flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50/50">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-neutral-100">Assigned Staff</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-500">Manage PIN codes and access for this branch.</p>
            </div>
            <button
              onClick={() => { setStaffForm({}); setIsStaffModalOpen(true); }}
              className="flex items-center px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Staff
            </button>
          </div>

          {staff.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-neutral-500 text-sm">No staff assigned to this branch yet.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-medium border-b border-gray-100 dark:border-[var(--sb-border)]">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">PIN</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map(s => (
                  <tr key={s.branch_staff_id} className="hover:bg-gray-50 dark:bg-neutral-800/50">
                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-neutral-100">{s.name}</td>
                    <td className="px-6 py-3 text-gray-500 dark:text-neutral-500">{s.email || '-'}</td>
                    <td className="px-6 py-3 text-gray-500 dark:text-neutral-500 capitalize">{s.role || '-'}</td>
                    <td className="px-6 py-3 font-mono text-gray-600 dark:text-neutral-400">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
                        {s.pin || <span className="text-gray-300 italic">Not set</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => { setStaffForm(s); setIsStaffModalOpen(true); }} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-indigo-600 mx-1"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleRemoveStaff(s.branch_staff_id)} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-red-600 mx-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB: MENU ─────────────────────────────────────────────────────────── */}
      {activeTab === 'menu' && (
        <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-[var(--sb-border)] flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50/50 sticky top-0 z-10">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-neutral-100">Menu Customization</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-500">Toggle availability or set override pricing for this branch.</p>
            </div>
            <button
              onClick={handleSaveMenu} disabled={saving}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {menuCategories.map(cat => {
              const catItems = menuItems.filter(m => m.category_id === cat.id);
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id}>
                  <div className="px-5 py-2 bg-gray-50 dark:bg-neutral-800/50 font-semibold text-sm text-gray-700 dark:text-neutral-300 border-b border-gray-100 dark:border-[var(--sb-border)]">
                    {cat.name}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {catItems.map(item => {
                      const bm = branchMenu.find(b => b.menu_id === item.id);
                      const isAvail = bm ? bm.is_available : true;
                      const overridePrice = bm?.override_price ?? '';

                      return (
                        <div key={item.id} className={cn('px-5 py-3 flex items-center gap-4', !isAvail && 'opacity-60 bg-gray-50 dark:bg-neutral-800/50')}>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox" className="sr-only peer"
                              checked={isAvail}
                              onChange={e => toggleMenuItem(item.id, e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-[var(--sb-card)] after:border-gray-300 dark:border-neutral-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                          </label>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-neutral-100 truncate">{item.name}</p>
                            <p className="text-xs text-gray-500 dark:text-neutral-500">Base: RM {item.base_price?.toFixed(2) || '0.00'}</p>
                          </div>

                          <div className="w-32 shrink-0">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-neutral-500 font-medium">RM</span>
                              <input
                                type="number" step="0.01"
                                placeholder={item.base_price?.toFixed(2)}
                                value={overridePrice}
                                onChange={e => updateOverridePrice(item.id, e.target.value ? parseFloat(e.target.value) : null)}
                                disabled={!isAvail}
                                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 dark:bg-neutral-800 disabled:text-gray-400 dark:text-neutral-500"
                              />
                            </div>
                            <p className="text-[9px] text-gray-400 dark:text-neutral-500 text-center mt-1">Leave blank for base price</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB: KDS ──────────────────────────────────────────────────────────── */}
      {activeTab === 'kds' && (
        <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-[var(--sb-border)] flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50/50">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-neutral-100">Kitchen Display Systems</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-500">Setup KDS screens to route specific categories.</p>
            </div>
            <button
              onClick={() => { setKdsForm({ is_active: true }); setIsKdsModalOpen(true); }}
              className="flex items-center px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add KDS
            </button>
          </div>

          {kdsStations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-neutral-500 text-sm">No KDS stations configured.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
              {kdsStations.map(kds => (
                <div key={kds.id} className="border border-gray-200 dark:border-[var(--sb-border)] rounded-xl p-4 flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <MonitorSmartphone className="w-5 h-5 text-indigo-500" />
                      <h4 className="font-bold text-gray-900 dark:text-neutral-100">{kds.name}</h4>
                      {!kds.is_active && <span className="text-[10px] bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 px-2 py-0.5 rounded font-bold uppercase">Disabled</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setKdsForm(kds); setIsKdsModalOpen(true); }} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-indigo-600"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeleteKds(kds.id)} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STAFF MODAL ───────────────────────────────────────────────────────── */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[var(--sb-border)]">
              <h3 className="font-semibold text-gray-900 dark:text-neutral-100">{staffForm.branch_staff_id ? 'Edit Staff Member' : 'Add Staff to Branch'}</h3>
              <button onClick={() => setIsStaffModalOpen(false)} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveStaff} className="p-5 space-y-4">
              {!staffForm.branch_staff_id ? (
                unassignedUsers.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-gray-500 dark:text-neutral-400">All users have been assigned to this branch.</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Invite more users on the Users page first.</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Select Staff Member *</label>
                      <select
                        required
                        value={staffForm.id || ''}
                        onChange={e => {
                          const selectedUser = unassignedUsers.find(u => u.id === e.target.value);
                          setStaffForm({
                            ...staffForm,
                            id: e.target.value,
                            name: selectedUser?.name,
                            email: selectedUser?.email,
                            pin: selectedUser?.pin || '',
                            role: 'cashier',
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
                      >
                        <option value="">-- Choose Staff --</option>
                        {unassignedUsers.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Role *</label>
                      <select
                        value={staffForm.role || 'cashier'}
                        onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
                      >
                        <option value="cashier">Cashier</option>
                        <option value="kitchen">Kitchen</option>
                        <option value="waiter">Waiter</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Manager">Manager</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">4-Digit PIN *</label>
                      <input
                        required type="text" pattern="\d{4}" maxLength={4}
                        value={staffForm.pin || ''}
                        onChange={e => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '') })}
                        placeholder="e.g. 1234"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono tracking-widest bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
                      />
                      <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-1">Used for fast POS login.</p>
                    </div>
                  </>
                )
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Staff Member</label>
                    <p className="text-sm font-bold text-gray-900 dark:text-neutral-100">{staffForm.name}</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-500">{staffForm.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Role *</label>
                    <select
                      value={staffForm.role || 'cashier'}
                      onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
                    >
                      <option value="cashier">Cashier</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="waiter">Waiter</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Manager">Manager</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">4-Digit PIN *</label>
                    <input
                      required type="text" pattern="\d{4}" maxLength={4}
                      value={staffForm.pin || ''}
                      onChange={e => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '') })}
                      placeholder="e.g. 1234"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono tracking-widest bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
                    />
                    <p className="text-[10px] text-gray-500 dark:text-neutral-500 mt-1">Used for fast POS login.</p>
                  </div>
                </>
              )}

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setIsStaffModalOpen(false)} className="flex-1 py-2 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-neutral-800/50">Cancel</button>
                <button
                  type="submit"
                  disabled={saving || (!staffForm.branch_staff_id && unassignedUsers.length === 0)}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── KDS MODAL ─────────────────────────────────────────────────────────── */}
      {isKdsModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[var(--sb-border)]">
              <h3 className="font-semibold text-gray-900 dark:text-neutral-100">{kdsForm.id ? 'Edit KDS Station' : 'Add KDS Station'}</h3>
              <button onClick={() => setIsKdsModalOpen(false)} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveKds} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Station Name *</label>
                <input
                  required type="text" value={kdsForm.name || ''} placeholder="e.g. Drinks Bar"
                  onChange={e => setKdsForm({ ...kdsForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={kdsForm.is_active !== false}
                  onChange={e => setKdsForm({ ...kdsForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 dark:border-neutral-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">Station is Active</span>
              </label>

              <div className="pt-4 flex gap-2">
                <button type="button" onClick={() => setIsKdsModalOpen(false)} className="flex-1 py-2 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-neutral-800/50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── TAB: SETTINGS ─────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden animate-in fade-in duration-200">
          <div className="p-5 border-b border-gray-100 dark:border-[var(--sb-border)] flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50/50 sticky top-0 z-10">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-neutral-100">Branch-Specific Settings Overrides</h3>
              <p className="text-xs text-gray-500 dark:text-neutral-500">Enable override checkboxes to define settings independent of the merchant defaults.</p>
            </div>
            <button
              onClick={handleSaveSettings} disabled={saving}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="p-3.5 rounded-lg text-sm border bg-blue-50 text-blue-800 border-blue-200 flex gap-2 dark:bg-blue-900/10 dark:text-blue-200 dark:border-blue-800">
              <span className="shrink-0 mt-0.5 font-bold">💡 Tip:</span>
              <span>Unchecked settings will inherit the global merchant settings. Check the override box to apply a specific setting for this branch only.</span>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-neutral-800 border border-gray-100 dark:border-neutral-800 rounded-xl overflow-hidden">
              {branchSettings.map(s => {
                const displayVal = s.isOverridden ? s.pendingValue : s.merchantValue;
                const isTrue = displayVal === 'true';

                return (
                  <div key={s.key} className={cn(
                    'p-4 flex items-center justify-between gap-6 transition-colors',
                    s.isOverridden ? 'bg-indigo-50/10 dark:bg-indigo-950/10' : 'bg-transparent'
                  )}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={s.isOverridden}
                            onChange={e => handleSettingOverrideChange(s.key, e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 dark:border-neutral-600 focus:ring-indigo-500"
                          />
                          <span className={cn(
                            'text-sm font-semibold text-gray-900 dark:text-neutral-100',
                            s.isOverridden ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                          )}>
                            {s.label}
                          </span>
                        </label>
                        {s.isOverridden ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            Overridden
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-neutral-500">
                            Inheriting Default ({s.merchantValue === 'true' ? 'Enabled' : 'Disabled'})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1 leading-relaxed">{s.description}</p>
                    </div>

                    <div className="shrink-0 flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (s.isOverridden) {
                            handleSettingValueChange(s.key, s.pendingValue === 'true' ? 'false' : 'true');
                          }
                        }}
                        disabled={!s.isOverridden}
                        className={cn(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
                          isTrue ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-neutral-700',
                          !s.isOverridden && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <span className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                          isTrue ? 'translate-x-6' : 'translate-x-1'
                        )} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BranchesList
// ─────────────────────────────────────────────────────────────────────────────

export function BranchesList({ activeTab }: { activeTab?: string }) {
  const { t } = useTranslation();

  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const getLocalMerchantId = () => {
    try { return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null; }
    catch { return null; }
  };
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : getLocalMerchantId();

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchBranches = async () => {
    if (!activeMerchantId) return [];
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('merchant_id', activeMerchantId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  };

  const { data: branches, loading, refetch } = useDataLoader(`branches_${activeMerchantId}`, fetchBranches);

  useEffect(() => { if (activeMerchantId) refetch(); }, [activeMerchantId]);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [alert]);


  const handleOpenModal = (branch: any = null) => {
    setEditingBranch(branch);
    setFormData(branch ? { ...branch } : {
      name: '', code: '', address: '', phone: '', email: '', is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBranch(null);
    setFormData({});
    if ((window as any).__appNavigate) (window as any).__appNavigate('branches');
  };

  useEffect(() => {
    if (activeTab === 'branches/new') {
      handleOpenModal();
    } else if (activeTab && activeTab.startsWith('branches/')) {
      const branchId = activeTab.split('/')[1];
      if (branchId && branchId !== 'new') {
        setSelectedBranchId(branchId);
      }
    }
  }, [activeTab]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMerchantId) return;
    setSaving(true);
    try {
      const payload = { ...formData, merchant_id: activeMerchantId };
      if (editingBranch) {
        const { error } = await supabase.from('branches').update(payload).eq('id', editingBranch.id);
        if (error) throw error;
        setAlert({ type: 'success', message: 'Branch updated successfully!' });
      } else {
        const { error } = await supabase.from('branches').insert([payload]);
        if (error) throw error;
        setAlert({ type: 'success', message: 'Branch added successfully!' });
      }
      handleCloseModal();
      refetch();
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Failed to save branch.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete branch "${name}"?`)) return;
    try {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
      setAlert({ type: 'success', message: 'Branch deleted successfully!' });
      refetch();
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Failed to delete branch.' });
    }
  };

  if (selectedBranchId) {
    return (
      <BranchPage
        id={selectedBranchId}
        onBack={() => {
          setSelectedBranchId(null);
          if ((window as any).__appNavigate) (window as any).__appNavigate('branches');
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Branches</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Manage your restaurant locations and outlets.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Branch
        </button>
      </div>

      {alert && (
        <div className={cn(
          'px-4 py-3 rounded-lg text-sm font-medium border animate-in fade-in slide-in-from-top-2',
          alert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        )}>
          {alert.message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : branches && branches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch: any) => (
            <div key={branch.id} className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-100 dark:border-[var(--sb-border)] flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    branch.is_active ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500'
                  )}>
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-neutral-100">{branch.name}</h3>
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-1',
                      branch.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400'
                    )}>
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 flex-1 space-y-3">
                <div className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-neutral-400">
                  <MapPin className="w-4 h-4 text-gray-400 dark:text-neutral-500 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{branch.address || <span className="italic text-gray-400 dark:text-neutral-500">No address provided</span>}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-neutral-400">
                  <Phone className="w-4 h-4 text-gray-400 dark:text-neutral-500 shrink-0" />
                  <span>{branch.phone || '-'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-neutral-400">
                  <Mail className="w-4 h-4 text-gray-400 dark:text-neutral-500 shrink-0" />
                  <span className="truncate">{branch.email || '-'}</span>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-100 dark:border-[var(--sb-border)] flex items-center justify-between">
                <button
                  onClick={() => setSelectedBranchId(branch.id)}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Manage Details →
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleOpenModal(branch)} className="p-1.5 text-gray-400 dark:text-neutral-500 hover:text-indigo-600 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded hover:border-indigo-300 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(branch.id, branch.name)} className="p-1.5 text-gray-400 dark:text-neutral-500 hover:text-red-600 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded hover:border-red-300 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] py-16 px-4 text-center">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-neutral-100 mb-1">No branches found</h3>
          <p className="text-gray-500 dark:text-neutral-500 mb-6">Add your first restaurant branch to get started.</p>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Branch
          </button>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[var(--sb-border)]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
                {editingBranch ? 'Edit Branch' : 'Add New Branch'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 dark:text-neutral-500 hover:text-gray-500 dark:text-neutral-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Branch Name *</label>
                  <input type="text" name="name" value={formData.name || ''} onChange={handleChange} required
                    placeholder="e.g. Main Outlet"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Branch Code *</label>
                  <input type="text" name="code" value={formData.code || ''}
                    onChange={e => setFormData((p: any) => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))}
                    required placeholder="e.g. HQ, BR01"
                    maxLength={10}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase" />
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-1">Unique short code, max 10 chars.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Address</label>
                <input type="text" name="address" value={formData.address || ''} onChange={handleChange}
                  placeholder="Full street address"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Phone</label>
                  <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email || ''} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input type="checkbox" name="is_active" checked={formData.is_active !== false} onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 dark:border-neutral-600 focus:ring-indigo-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-neutral-300">Branch is active and operating</span>
              </label>
              <div className="pt-4 border-t border-gray-100 dark:border-[var(--sb-border)] flex justify-end gap-3 mt-6">
                <button type="button" onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:bg-neutral-800/50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}