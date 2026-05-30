import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Users as UsersIcon, Search, Shield, Mail,
  Edit2, Trash2, CheckCircle2, XCircle, KeyRound,
  ShieldCheck, Clock, UserPlus, History, X, Loader2,
  AlertTriangle, Send, RefreshCw, LogIn,
  Lock, Unlock, MoreHorizontal, User, Activity,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/cn';
import { usePermission, UserRole, isStaffRole } from './RoleGuard';
import { useImpersonation } from '../contexts/ImpersonationContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  avatar_url?: string | null;
}

interface LoginEntry {
  id: string;
  user_id: string;
  login_at: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
}

export interface CurrentUser { id: string; role: UserRole; name: string; }
interface UsersProps { currentUser: CurrentUser; }

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES: UserRole[] = ['Manager', 'Supervisor', 'cashier', 'kitchen', 'waiter'];

const ROLE_STYLE: Record<UserRole, string> = {
  Manager:    'bg-violet-100 text-violet-700 border-violet-200',
  Supervisor: 'bg-blue-100   text-blue-700   border-blue-200',
  cashier:    'bg-gray-100   text-gray-600   border-gray-200',
  kitchen:    'bg-orange-100 text-orange-700 border-orange-200',
  waiter:     'bg-teal-100   text-teal-700   border-teal-200',
};

const ROLE_PERMS: Record<UserRole, string[]> = {
  Manager:    ['Full system access', 'Manage all staff', 'All reports & settings', 'POS & orders'],
  Supervisor: ['Manage cashier/kitchen/waiter', 'View reports & inventory', 'POS & orders'],
  cashier:    ['POS & order taking', 'View own session'],
  kitchen:    ['Kitchen display', 'Update order status'],
  waiter:     ['Take & manage orders', 'Table management'],
};

const MATRIX_ROWS = [
  { page: 'Dashboard',                       m: true,  s: true,  c: true  },
  { page: 'POS / Take Orders',               m: true,  s: true,  c: true  },
  { page: 'Kitchen Display',                 m: true,  s: true,  c: true  },
  { page: 'Products & Menu',                 m: true,  s: true,  c: false },
  { page: 'Inventory',                       m: true,  s: true,  c: false },
  { page: 'Reports & Analytics',             m: true,  s: true,  c: false },
  { page: 'Staff & Permissions',             m: true,  s: false, c: false },
  { page: 'Manage Supervisors',              m: true,  s: false, c: false },
  { page: 'Manage Cashier/Kitchen/Waiter',   m: true,  s: true,  c: false },
  { page: 'Audit Logs',                      m: true,  s: false, c: false },
  { page: 'System Settings',                 m: true,  s: false, c: false },
  { page: 'Reset Any Password',              m: true,  s: true,  c: false },
  { page: 'View Login History',              m: true,  s: false, c: false },
  { page: 'View Own History',                m: true,  s: true,  c: true  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) =>
  d ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : 'Never';

const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

const AVATAR_COLORS = [
  'bg-violet-200 text-violet-800',
  'bg-blue-200   text-blue-800',
  'bg-emerald-200 text-emerald-800',
  'bg-amber-200  text-amber-800',
  'bg-pink-200   text-pink-800',
  'bg-teal-200   text-teal-800',
];

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, size = 'md', children }: {
  open: boolean; onClose: () => void; title: string;
  size?: 'sm' | 'md' | 'lg'; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  const maxW = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-white dark:bg-[var(--sb-card)] rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden border border-transparent dark:border-[var(--sb-border)]',
        'max-h-[90vh] animate-in fade-in zoom-in-95 duration-200', maxW
      )}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[var(--sb-border)] shrink-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-neutral-100">{title}</h3>
          <button onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Avatar({ user, size = 'md' }: { user: StaffUser; size?: 'sm' | 'md' | 'lg' }) {
  const color = AVATAR_COLORS[user.name.charCodeAt(0) % AVATAR_COLORS.length];
  const dim = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }[size];
  return (
    <div className={cn('rounded-full flex items-center justify-center font-bold shrink-0', dim, color)}>
      {initials(user.name)}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-medium', ROLE_STYLE[role])}>
      <Shield className="w-3 h-3" />{role}
    </span>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-500/20 dark:text-red-200 px-4 py-3 rounded-xl text-sm">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{msg}
    </div>
  );
}

function FormField({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 dark:text-neutral-500">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 dark:border-neutral-700 rounded-xl text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all';

// ─── Action Dropdown ──────────────────────────────────────────────────────────

function ActionMenu({ user, currentUser, onEdit, onDelete, onToggle, onReset, onHistory }: {
  user: StaffUser; currentUser: CurrentUser;
  onEdit: () => void; onDelete: () => void;
  onToggle: () => void; onReset: () => void; onHistory: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const { isManager, isSupervisor } = usePermission(currentUser.role);
  const isSelf    = user.id === currentUser.id;
  const canAdmin  = isManager || (isSupervisor && isStaffRole(user.role));

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 6, left: r.right - 208 });
    };
    updatePos();
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = !!ref.current?.contains(target);
      const inMenu = !!menuRef.current?.contains(target);
      if (!inTrigger && !inMenu) setOpen(false);
    };
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    document.addEventListener('mousedown', h);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const item = (icon: React.ReactNode, label: string, onClick: () => void, cls = '') => (
    <button onClick={() => { onClick(); setOpen(false); }}
      className={cn('flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors', cls)}>
      {icon}{label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button ref={btnRef} onClick={() => setOpen(o => !o)}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 rounded-lg transition-all">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="fixed w-52 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-xl z-[140] overflow-hidden py-1"
          style={{ top: menuPos.top, left: Math.max(8, menuPos.left) }}>
          {canAdmin  && item(<Edit2    className="w-4 h-4 text-gray-400" />, 'Edit Profile',    onEdit)}
          {             item(<History  className="w-4 h-4 text-gray-400" />, 'Login History',   onHistory)}
          {canAdmin  && item(<KeyRound className="w-4 h-4 text-gray-400" />, 'Reset Password',  onReset)}
          {canAdmin && !isSelf && <>
            <div className="my-1 border-t border-gray-100" />
            {item(
              user.is_active ? <Lock   className="w-4 h-4" /> : <Unlock className="w-4 h-4" />,
              user.is_active ? 'Disable Account' : 'Enable Account',
              onToggle,
              user.is_active ? 'text-amber-600 hover:!bg-amber-50' : 'text-emerald-600 hover:!bg-emerald-50'
            )}
            {item(<Trash2 className="w-4 h-4" />, 'Remove Staff', onDelete, 'text-red-600 hover:!bg-red-50')}
          </>}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Staff Form Modal ──────────────────────────────────────────────────────────

function StaffFormModal({ open, onClose, user, currentUser, onSaved, activeMerchantId }: {
  open: boolean; onClose: () => void;
  user: StaffUser | null; currentUser: CurrentUser; onSaved: () => void; activeMerchantId: string | null;
}) {
  const isEdit = !!user;
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [role,    setRole]    = useState<UserRole>('cashier');
  const [phone,   setPhone]   = useState('');
  const [pin,     setPin]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const isStaffLevel = ['cashier', 'kitchen', 'waiter'].includes(role);
  const needsInvite  = ['Manager', 'Supervisor'].includes(role);

  useEffect(() => {
    if (!open) return;
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setPhone(user.phone ?? '');
      setPin('');
    } else {
      setName(''); setEmail(''); setRole('cashier'); setPhone(''); setPin('');
    }
    setError('');
  }, [user, open]);

  const availableRoles: UserRole[] = currentUser.role === 'Manager'
    ? ALL_ROLES
    : ['cashier', 'kitchen', 'waiter'];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMerchantId) return;
    setLoading(true); setError('');

    try {
      if (isEdit) {
        // ── Edit existing staff ──────────────────────────────────
        const updateData: any = {
          name: name.trim(),
          role,
          phone: phone.trim() || null,
        };
        if (pin.trim()) updateData.pin = pin.trim();

        const { error: err } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', user!.id);
        if (err) throw err;

        await supabase.from('audit_logs').insert({
          user_id: currentUser.id, user_name: currentUser.name,
          action: 'user_updated', target_id: user!.id, target_name: name.trim(),
          metadata: { role },
          merchant_id: activeMerchantId
        });

      } else if (isStaffLevel) {
        // ── Create cashier/kitchen/waiter directly ───────────────
        if (!name.trim()) throw new Error('Name is required.');

        const { error: err } = await supabase.from('users').insert({
          name:      name.trim(),
          email:     email.trim().toLowerCase() || null,
          role,
          phone:     phone.trim() || null,
          pin:       pin.trim() || null,
          is_active: true,
          password:  null,
          merchant_id: activeMerchantId
        });
        if (err) throw err;

        await supabase.from('audit_logs').insert({
          user_id: currentUser.id, user_name: currentUser.name,
          action: 'user_created', target_name: name.trim(),
          metadata: { role },
          merchant_id: activeMerchantId
        });

      } else {
        // ── Invite Manager/Supervisor via email ──────────────────────────────────
        if (!email.trim()) throw new Error('Email is required for Manager/Supervisor.');

        // 1. Insert invitation record
        const { data: invitation, error: inviteErr } = await supabase
          .from('staff_invitations')
          .insert({
            email:       email.trim().toLowerCase(),
            role,
            name:        name.trim(),
            invited_by:  currentUser.id,
            merchant_id: activeMerchantId
          })
          .select('id')
          .single();

        if (inviteErr) throw new Error(`Could not create invitation: ${inviteErr.message}`);
        if (!invitation) throw new Error('Invitation record was not created.');

        // 2. Invoke Edge Function
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('send-invite', {
          body: { invitationId: invitation.id },
        });

        // 3. Surface the real error message from the Edge Function response body
        if (fnErr) {
          let detail = fnErr.message;
          try {
            if (fnErr.context && typeof fnErr.context.json === 'function') {
              const body = await fnErr.context.json() as { error?: string };
              if (body?.error) detail = body.error;
            }
          } catch {
            // ignore parse failure — fall back to fnErr.message
          }
          throw new Error(`Failed to send invite: ${detail}`);
        }

        // 4. Audit log
        await supabase.from('audit_logs').insert({
          user_id:     currentUser.id,
          user_name:   currentUser.name,
          action:      'user_invited',
          target_name: name.trim() || email.trim(),
          metadata:    { email: email.trim(), role },
          merchant_id: activeMerchantId
        });
      }

      onSaved(); onClose();
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Staff Member' : 'Add Staff Member'}>
      <form onSubmit={submit} className="space-y-4">
        {error && <ErrBox msg={error} />}

        {/* Info banner */}
        {!isEdit && (
          <div className={cn(
            'flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm border',
            needsInvite
              ? 'bg-blue-50 border-blue-100 text-blue-700'
              : 'bg-emerald-50 border-emerald-100 text-emerald-700'
          )}>
            {needsInvite
              ? '📧 An invite email will be sent to this person to set their password.'
              : '✅ Account will be created immediately. Set a PIN for POS login.'}
          </div>
        )}

        <FormField label="Full Name" required>
          <input required value={name} onChange={e => setName(e.target.value)}
            className={inputCls} placeholder="e.g. Ahmad Farid" />
        </FormField>

        {/* Email — required for Manager/Supervisor, optional for staff */}
        <FormField
          label="Email Address"
          required={needsInvite}
          hint={isStaffLevel ? 'Optional for cashier/kitchen/waiter' : 'Invite link will be sent here'}
        >
          <input
            type="email"
            required={needsInvite && !isEdit}
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputCls}
            placeholder={needsInvite ? 'staff@snackbot.com' : 'Optional'}
            disabled={isEdit}
          />
        </FormField>

        <FormField label="Role">
          <select value={role} onChange={e => setRole(e.target.value as UserRole)} className={inputCls}>
            {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5">
            <p className="text-xs font-semibold text-gray-500">Permissions:</p>
            {ROLE_PERMS[role].map(p => (
              <p key={p} className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{p}
              </p>
            ))}
          </div>
        </FormField>

        <FormField label="Phone (optional)">
          <input value={phone} onChange={e => setPhone(e.target.value)}
            className={inputCls} placeholder="+60 12-345 6789" />
        </FormField>

        {/* PIN — only for cashier/kitchen/waiter */}
        {isStaffLevel && (
          <FormField
            label={isEdit ? 'Update PIN (optional)' : 'PIN (optional)'}
            hint="4-6 digit PIN for POS login"
          >
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              className={inputCls}
              placeholder="e.g. 1234"
            />
          </FormField>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-all flex justify-center items-center gap-2">
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isEdit
                ? 'Save Changes'
                : needsInvite
                  ? '📧 Send Invite'
                  : '✅ Create Account'
            }
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Reset Password Modal ──────────────────────────────────────────────────────

function ResetPasswordModal({ open, onClose, user, currentUser, activeMerchantId }: {
  open: boolean; onClose: () => void; user: StaffUser | null; currentUser: CurrentUser; activeMerchantId: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');
  useEffect(() => { setSent(false); setError(''); }, [open]);

  const send = async () => {
    if (!user || !activeMerchantId) return;
    setLoading(true); setError('');
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id, user_name: currentUser.name,
        action: 'password_reset_sent', target_id: user.id, target_name: user.name,
        metadata: { email: user.email },
        merchant_id: activeMerchantId
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Reset Password" size="sm">
      {!sent ? (
        <div className="space-y-4">
          <div className="flex gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <KeyRound className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Send password reset link</p>
              <p className="text-xs text-amber-700 mt-0.5">
                A secure email will be sent to <strong>{user?.email}</strong>. Link expires in 24 hours.
              </p>
            </div>
          </div>
          {error && <ErrBox msg={error} />}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={send} disabled={loading}
              className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 flex justify-center items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" />Send Link</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Reset link sent!</p>
            <p className="text-sm text-gray-500 mt-1">{user?.name} will receive it at <strong>{user?.email}</strong>.</p>
          </div>
          <button onClick={onClose}
            className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">Done</button>
        </div>
      )}
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ open, onClose, user, onConfirm, loading }: {
  open: boolean; onClose: () => void; user: StaffUser | null; onConfirm: () => void; loading: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Remove Staff Member" size="sm">
      <div className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          Are you sure you want to remove <strong>{user?.name}</strong>?
          Their account will be <strong>disabled</strong> immediately.
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex justify-center items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" />Remove</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Login History Modal ──────────────────────────────────────────────────────

function LoginHistoryModal({ open, onClose, user }: {
  open: boolean; onClose: () => void; user: StaffUser | null;
}) {
  const [history, setHistory] = useState<LoginEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('login_history').select('*')
        .eq('user_id', user.id)
        .order('login_at', { ascending: false })
        .limit(50);
      setHistory(data || []);
      setLoading(false);
    })();
  }, [open, user]);

  return (
    <Modal open={open} onClose={onClose} title={`Login History — ${user?.name}`} size="lg">
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : history.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-400">No login history recorded.</div>
      ) : (
        <div className="space-y-2">
          {history.map(e => (
            <div key={e.id} className={cn(
              'flex items-start justify-between p-3.5 rounded-xl border text-sm',
              e.success ? 'bg-gray-50 border-gray-100' : 'bg-red-50 border-red-100'
            )}>
              <div className="flex items-center gap-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  e.success ? 'bg-emerald-100' : 'bg-red-100')}>
                  <LogIn className={cn('w-4 h-4', e.success ? 'text-emerald-600' : 'text-red-500')} />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{e.success ? 'Signed in successfully' : 'Failed attempt'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {e.ip_address ?? 'Unknown IP'}
                    {e.user_agent && <span className="text-gray-300 mx-1">·</span>}
                    {e.user_agent && <span className="truncate max-w-[200px] inline-block align-bottom">{e.user_agent}</span>}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 shrink-0 mt-1">{fmtDate(e.login_at)}</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── Role Matrix Modal ────────────────────────────────────────────────────────

function RoleMatrixModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Permissions Matrix" size="lg">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-2.5 pr-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Feature / Page
              </th>
              {(['Manager', 'Supervisor', 'Staff'] as const).map(r => (
                <th key={r} className="py-2.5 px-4 text-center text-xs font-semibold">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border',
                    r === 'Manager'    ? ROLE_STYLE['Manager']    :
                    r === 'Supervisor' ? ROLE_STYLE['Supervisor'] : ROLE_STYLE['cashier']
                  )}>{r}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_ROWS.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="py-2.5 pr-4 text-gray-700">{row.page}</td>
                {[row.m, row.s, row.c].map((has, j) => (
                  <td key={j} className="py-2.5 px-4 text-center">
                    {has
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      : <XCircle      className="w-4 h-4 text-gray-200   mx-auto" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-3">* Staff = cashier, kitchen, and waiter roles</p>
      </div>
    </Modal>
  );
}


// ─── Inline Audit Panel (embedded in Users page Audit tab) ───────────────────

interface AuditEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  target_id: string | null;
  target_name: string | null;
  metadata: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

const AUDIT_META: Record<string, { label: string; cls: string }> = {
  login:               { label: 'Signed in',       cls: 'bg-emerald-50 text-emerald-700' },
  logout:              { label: 'Signed out',       cls: 'bg-gray-100   text-gray-600'   },
  user_invited:        { label: 'Invite sent',      cls: 'bg-indigo-50  text-indigo-700' },
  user_created:        { label: 'Staff added',      cls: 'bg-blue-50    text-blue-700'   },
  user_updated:        { label: 'Profile updated',  cls: 'bg-violet-50  text-violet-700' },
  password_reset:      { label: 'Password reset',   cls: 'bg-amber-50   text-amber-700'  },
  password_reset_sent: { label: 'Reset link sent',  cls: 'bg-amber-50   text-amber-700'  },
  user_disabled:       { label: 'Account disabled', cls: 'bg-red-50     text-red-700'    },
  user_enabled:        { label: 'Account enabled',  cls: 'bg-emerald-50 text-emerald-700'},
  user_deleted:        { label: 'Staff removed',    cls: 'bg-red-50     text-red-700'    },
  role_changed:        { label: 'Role changed',     cls: 'bg-violet-50  text-violet-700' },
};

function InlineAuditPanel({ isManager, activeMerchantId }: { isManager: boolean; activeMerchantId: string | null }) {
  const [logs,    setLogs]    = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');

  const load = useCallback(async () => {
    if (!activeMerchantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('merchant_id', activeMerchantId) // 👉 Filter audit logs by merchant ID
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs(data || []);
    setLoading(false);
  }, [activeMerchantId]);

  useEffect(() => { load(); }, [load]);

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
          <Shield className="w-7 h-7 text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-600">Manager access required</p>
        <p className="text-xs text-gray-400">Only Managers can view the audit log.</p>
      </div>
    );
  }

  const filtered = logs.filter(log => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (log.user_name  ?? '').toLowerCase().includes(q) ||
      (log.target_name ?? '').toLowerCase().includes(q) ||
      log.action.includes(q);
    const matchFilter =
      filter === 'all'       ? true :
      filter === 'login'     ? log.action === 'login' || log.action === 'logout' :
      filter === 'user_'     ? log.action.startsWith('user_') :
      filter === 'password_' ? log.action.startsWith('password_') :
      true;
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by user, action, target…"
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
          />
        </div>
        <select
          value={filter} onChange={e => setFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm text-gray-600 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all">
          <option value="all">All Actions</option>
          <option value="login">Sign-ins / Sign-outs</option>
          <option value="user_">Staff changes</option>
          <option value="password_">Password resets</option>
        </select>
        <button onClick={load}
          className="p-2 text-gray-400 hover:text-gray-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-800 rounded-xl transition-all">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Log list */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50 dark:divide-neutral-800 max-h-[480px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 dark:text-neutral-500">
              {search ? 'No matching log entries.' : 'No staff activity recorded yet.'}
            </div>
          ) : (
            filtered.map(log => {
              const meta = AUDIT_META[log.action] ?? { label: log.action, cls: 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400' };
              return (
                <div key={log.id} className="flex items-start justify-between px-5 py-3.5 hover:bg-gray-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium shrink-0 mt-0.5 whitespace-nowrap', meta.cls)}>
                      {meta.label}
                    </span>
                    <div>
                      <p className="text-sm text-gray-800 dark:text-neutral-200">
                        <span className="font-medium">{log.user_name ?? 'System'}</span>
                        {log.target_name && (
                          <span className="text-gray-400 dark:text-neutral-500">
                            {' → '}
                            <span className="font-medium text-gray-700 dark:text-neutral-300">{log.target_name}</span>
                          </span>
                        )}
                      </p>
                      {log.metadata && Object.keys(log.metadata).filter(k => k !== 'ip').length > 0 && (
                        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                          {Object.entries(log.metadata)
                            .filter(([k]) => k !== 'ip')
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      )}
                      {log.ip_address && (
                        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{log.ip_address}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 shrink-0 ml-3 mt-1 whitespace-nowrap">
                    {new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(log.created_at))}
                  </p>
                </div>
              );
            })
          )}
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-800/50 text-xs text-gray-400 dark:text-neutral-500">
            Showing {filtered.length} of {logs.length} entries
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function Users({ currentUser }: UsersProps) {
  // All hooks must be called unconditionally (Rules of Hooks)
  const permission = usePermission(currentUser?.role ?? 'cashier');
  const { isManager, isSupervisor } = permission;
  const canManage = isManager || isSupervisor;

  // 👉 Resolve active merchant ID
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const getLocalMerchantId = () => {
    try { return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null; }
    catch { return null; }
  };
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : getLocalMerchantId();

  const [users,        setUsers]        = useState<StaffUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [tab,          setTab]          = useState<'staff' | 'audit'>('staff');

  const [formModal,    setFormModal]    = useState<{ open: boolean; user: StaffUser | null }>({ open: false, user: null });
  const [resetModal,   setResetModal]   = useState<{ open: boolean; user: StaffUser | null }>({ open: false, user: null });
  const [historyModal, setHistoryModal] = useState<{ open: boolean; user: StaffUser | null }>({ open: false, user: null });
  const [deleteModal,  setDeleteModal]  = useState<{ open: boolean; user: StaffUser | null; loading: boolean }>({ open: false, user: null, loading: false });
  const [matrixModal,  setMatrixModal]  = useState(false);

  const load = useCallback(async () => {
    if (!activeMerchantId) return;

    setLoading(true);

    const timeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    try {
      const result = await supabase
        .from('users')
        .select('id, name, email, role, is_active, phone, last_login, created_at')
        .eq('merchant_id', activeMerchantId) // 👉 Filter users by merchant ID
        .order('name');

      if (result.error) {
        console.error('[Users] ERROR:', result.error.message, '| code:', result.error.code, '| details:', result.error.details, '| hint:', result.error.hint);
      }

      setUsers(result.data || []);
    } catch (err) {
      console.error('[Users] EXCEPTION in load():', err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [activeMerchantId]); // Dependency added

  useEffect(() => {
    load();
  }, [load]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  const toggleActive = async (user: StaffUser) => {
    if (!activeMerchantId) return;
    const next = !user.is_active;
    await supabase.from('users').update({ is_active: next }).eq('id', user.id);
    await supabase.from('audit_logs').insert({
      user_id: currentUser.id, user_name: currentUser.name,
      action: next ? 'user_enabled' : 'user_disabled',
      target_id: user.id, target_name: user.name,
      merchant_id: activeMerchantId // 👉 Add merchant context to audit logs
    });
    load();
  };

  const deleteUser = async () => {
    if (!activeMerchantId) return;
    const user = deleteModal.user;
    if (!user) return;
    setDeleteModal(d => ({ ...d, loading: true }));
    await supabase.from('users').update({ is_active: false }).eq('id', user.id);
    await supabase.from('audit_logs').insert({
      user_id: currentUser.id, user_name: currentUser.name,
      action: 'user_deleted', target_id: user.id, target_name: user.name,
      merchant_id: activeMerchantId // 👉 Add merchant context to audit logs
    });
    setDeleteModal({ open: false, user: null, loading: false });
    load();
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      (!q || u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)) || u.role.toLowerCase().includes(q)) &&
      (roleFilter   === 'all' || u.role === roleFilter) &&
      (statusFilter === 'all' || (statusFilter === 'active' ? u.is_active : !u.is_active))
    );
  });

  const stats = {
    total:       users.length,
    active:      users.filter(u => u.is_active).length,
    managers:    users.filter(u => u.role === 'Manager').length,
    supervisors: users.filter(u => u.role === 'Supervisor').length,
    staff:       users.filter(u => isStaffRole(u.role)).length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-violet-600" />
            Staff & Permissions
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">Manage your team, roles and access control.</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button onClick={() => setMatrixModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all shadow-sm">
              <ShieldCheck className="w-4 h-4" /> Permissions
            </button>
          )}
          {canManage && (
            <button onClick={() => setFormModal({ open: true, user: null })}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-all shadow-md shadow-violet-100">
              <UserPlus className="w-4 h-4" /> Add Staff
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff',  val: stats.total,       sub: 'members',        icon: UsersIcon,    bg: 'bg-violet-50',  ic: 'text-violet-600' },
          { label: 'Active',       val: stats.active,      sub: 'can sign in',    icon: CheckCircle2, bg: 'bg-emerald-50', ic: 'text-emerald-600' },
          { label: 'Managers',     val: stats.managers,    sub: 'full access',    icon: Shield,       bg: 'bg-amber-50',   ic: 'text-amber-600' },
          { label: 'Staff',        val: stats.staff,       sub: 'cashier/kitchen/waiter', icon: User, bg: 'bg-blue-50',    ic: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', s.bg, 'dark:bg-white/5')}>
                <s.icon className={cn('w-[18px] h-[18px]', s.ic)} />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-neutral-400">{s.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{s.val}</span>
              <span className="text-xs text-gray-400 dark:text-neutral-500">{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-900 rounded-xl p-1 w-fit border border-transparent dark:border-neutral-800">
        {(['staff', 'audit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t
                ? 'bg-white text-gray-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200'
            )}>
            {t === 'staff' ? (
              <span className="flex items-center gap-1.5"><UsersIcon className="w-3.5 h-3.5" />Staff Members</span>
            ) : (
              <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />Audit Log</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Staff Tab ── */}
      {tab === 'staff' && (
        <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-visible">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50/50 dark:bg-[var(--sb-card)] flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email or role…"
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-900 dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
            </div>
            <div className="flex gap-2">
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}
                className="px-3 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-600 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all">
                <option value="all">All Roles</option>
                {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-neutral-700 rounded-xl text-sm text-gray-600 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
              <button onClick={load}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white dark:hover:bg-[var(--sb-border)] dark:hover:text-neutral-200 border border-gray-200 dark:border-neutral-700 rounded-xl transition-all">
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 dark:bg-neutral-900">
                <tr>
                  {['Staff Member', 'Role', 'Status', 'Phone', 'Last Login', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-gray-400 dark:text-neutral-500 text-sm">
                      No staff members found.
                    </td>
                  </tr>
                ) : (
                  filtered.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/60 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar user={user} />
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-neutral-100 flex items-center gap-1.5">
                              {user.name}
                              {user.id === currentUser.id && (
                                <span className="px-1.5 py-0.5 bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200 text-[10px] font-bold rounded-full">You</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3" />{user.email || <span className="italic">No Email</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><RoleBadge role={user.role} /></td>
                      <td className="px-5 py-4">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          user.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                            : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'
                        )}>
                          {user.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {user.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-gray-500 dark:text-neutral-400">
                          {user.phone ?? <span className="text-gray-300 dark:text-neutral-700">—</span>}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400">
                          <Clock className="w-3.5 h-3.5 text-gray-300 dark:text-neutral-600" />{fmtDate(user.last_login)}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <ActionMenu
                          user={user} currentUser={currentUser}
                          onEdit={()    => setFormModal({ open: true, user })}
                          onDelete={()  => setDeleteModal({ open: true, user, loading: false })}
                          onToggle={()  => toggleActive(user)}
                          onReset={()   => setResetModal({ open: true, user })}
                          onHistory={() => setHistoryModal({ open: true, user })}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900 text-xs text-gray-400 dark:text-neutral-500">
              Showing {filtered.length} of {users.length} staff members
            </div>
          )}
        </div>
      )}

      {/* ── Audit Tab — inline panel ── */}
      {tab === 'audit' && (
        <InlineAuditPanel isManager={isManager} activeMerchantId={activeMerchantId} />
      )}

      {/* ── Modals ── */}
      <StaffFormModal
        open={formModal.open} onClose={() => setFormModal({ open: false, user: null })}
        user={formModal.user} currentUser={currentUser} onSaved={load} activeMerchantId={activeMerchantId}
      />
      <ResetPasswordModal
        open={resetModal.open} onClose={() => setResetModal({ open: false, user: null })}
        user={resetModal.user} currentUser={currentUser} activeMerchantId={activeMerchantId}
      />
      <LoginHistoryModal
        open={historyModal.open} onClose={() => setHistoryModal({ open: false, user: null })}
        user={historyModal.user}
      />
      <DeleteModal
        open={deleteModal.open} onClose={() => setDeleteModal({ open: false, user: null, loading: false })}
        user={deleteModal.user} onConfirm={deleteUser} loading={deleteModal.loading}
      />
      <RoleMatrixModal open={matrixModal} onClose={() => setMatrixModal(false)} />
    </div>
  );
}