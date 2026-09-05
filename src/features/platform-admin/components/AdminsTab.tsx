import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, RefreshCw, UserCheck, Key, AlertTriangle, X } from 'lucide-react';
import { StaffUser } from '../types';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';

interface AdminsTabProps {
  currentUser: { id: string; name: string; email: string };
}

export function AdminsTab({ currentUser }: AdminsTabProps) {
  const [admins, setAdmins] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchAdmins = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, is_platform_admin, is_active, created_at, last_login')
      .eq('is_platform_admin', true)
      .order('created_at', { ascending: false });

    setAdmins((data as StaffUser[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim()) return;

    setIsPromoting(true);
    setActionError('');
    setActionSuccess('');

    // Check if user exists with this email
    const { data: foundUser, error: findErr } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', targetEmail.trim().toLowerCase())
      .maybeSingle();

    if (findErr || !foundUser) {
      setIsPromoting(false);
      setActionError(`No registered user found with email "${targetEmail}". Ask them to create a staff account first.`);
      return;
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ is_platform_admin: true })
      .eq('id', foundUser.id);

    setIsPromoting(false);

    if (updateErr) {
      setActionError(updateErr.message);
      return;
    }

    setActionSuccess(`Successfully granted Platform Superadmin privileges to ${foundUser.name} (${foundUser.email}).`);
    setTargetEmail('');
    setShowAddModal(false);
    fetchAdmins();
  };

  const handleRevokeAdmin = async (userId: string, userName: string) => {
    if (userId === currentUser.id) {
      alert('You cannot revoke your own superadmin access.');
      return;
    }

    if (!confirm(`Revoke Platform Superadmin access from ${userName}?`)) return;

    await supabase
      .from('users')
      .update({ is_platform_admin: false })
      .eq('id', userId);

    fetchAdmins();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Platform Administrators</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Superusers with full platform-level privileges, tenant impersonation, and billing controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchAdmins}
            title="Refresh List"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin text-[#D97706]')} />
          </button>
          <button
            onClick={() => {
              setActionError('');
              setActionSuccess('');
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] shadow-md shadow-amber-600/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Grant Superadmin
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
          <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Admin Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Superadmin Accounts ({admins.length})
          </span>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Full Privileges
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="text-left px-5 py-3">Superadmin</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role Designation</th>
                <th className="text-left px-4 py-3">Last Active</th>
                <th className="text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-xs text-slate-400">
                    Loading admin directory…
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-xs text-slate-400">
                    No platform admins found.
                  </td>
                </tr>
              ) : (
                admins.map(adm => {
                  const isCurrent = adm.id === currentUser.id;
                  return (
                    <tr key={adm.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200/80 text-[#D97706] font-bold flex items-center justify-center text-sm shadow-sm">
                            {adm.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                              {adm.name}
                              {isCurrent && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">ID: {adm.id.slice(0, 8)}…</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-slate-700 font-medium">{adm.email}</td>

                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                          {adm.role || 'Superadmin'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-[11px] text-slate-500">
                        {adm.last_login ? new Date(adm.last_login).toLocaleString() : 'Recently'}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {isCurrent ? (
                          <span className="text-[11px] text-slate-400 italic">Active Session</span>
                        ) : (
                          <button
                            onClick={() => handleRevokeAdmin(adm.id, adm.name)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline transition-colors"
                          >
                            Revoke Admin
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl bg-white border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#D97706] flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Grant Superadmin Rights</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {actionError}
              </div>
            )}

            <form onSubmit={handleGrantAdmin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  User Email Address
                </label>
                <input
                  type="email"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D97706] focus:ring-4 focus:ring-[#D97706]/10"
                  placeholder="colleague@snackbot.my"
                  value={targetEmail}
                  onChange={e => setTargetEmail(e.target.value)}
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The user must already have registered an account on SnackBot.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPromoting}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] shadow-md shadow-amber-600/20 disabled:opacity-50"
                >
                  {isPromoting ? 'Promoting…' : 'Grant Superadmin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
