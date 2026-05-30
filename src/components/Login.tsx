import React, { useState } from 'react';
import { Store, Lock, Mail, Loader2, AlertTriangle, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../contexts/TranslationContext';
import { useSettings } from '../contexts/SettingsContext';
import { cn } from '../utils/cn';

export interface LoggedInUser {
  id: string;
  email: string;
  name: string;
  role: 'Manager' | 'Supervisor' | 'cashier' | 'kitchen' | 'waiter' | 'platform_admin';
  avatar_url?: string | null;
  is_platform_admin?: boolean;
  merchant_id?: string | null;
}

interface LoginProps {
  onLogin: (user: LoggedInUser) => void;
}

type View = 'signin' | 'forgot' | 'reset_sent' | 'link_error';

/** Parse Supabase error params that land in the URL hash (e.g. #error=access_denied&error_code=otp_expired) */
function parseHashError(): { errorCode: string; description: string } | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const errorCode = params.get('error_code') ?? params.get('error') ?? '';
  const description = params.get('error_description')?.replace(/\+/g, ' ') ?? '';
  if (!errorCode) return null;
  return { errorCode, description };
}

const LINK_ERROR_MESSAGES: Record<string, string> = {
  otp_expired:  'Your password-reset link has expired. Please request a new one.',
  access_denied: 'This link is no longer valid. Please request a new reset link.',
};

export function Login({ onLogin }: LoginProps) {
  const { t }           = useTranslation();
  const { settings, themeColors } = useSettings();

  // Detect Supabase hash errors on initial load (e.g. expired OTP redirect to root)
  const hashErr = React.useMemo(() => parseHashError(), []);
  const initialView: View = hashErr ? 'link_error' : 'signin';

  const [view, setView]         = useState<View>(initialView);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Clear the hash from the URL bar so it doesn't persist on refresh
  React.useEffect(() => {
    if (hashErr) window.history.replaceState(null, '', window.location.pathname);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isDark = settings.theme === 'dark'
    || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const logoAccent = isDark ? (themeColors?.bg ?? 'bg-violet-600') : (themeColors?.bgLight ?? 'bg-violet-600');
  const accent = 'bg-violet-600 text-white hover:bg-violet-700';

  // ── Sign In ──────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const trimmedEmail = email.trim().toLowerCase();

      // Step 1: Authenticate via Supabase Auth (this handles password hashing properly)
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (authErr || !authData.user) {
        throw new Error('Invalid email or password.');
      }

      // Step 2: Fetch staff profile using auth_id (links auth.users → public.users)
      const { data: staff, error: staffErr } = await supabase
        .from('users')
        .select('id, name, email, role, is_active, avatar_url, is_platform_admin, merchant_id, auth_id')
        .eq('auth_id', authData.user.id)
        .maybeSingle();

      if (staffErr || !staff) {
        // Auth succeeded but no users record — sign out and reject
        await supabase.auth.signOut();
        throw new Error('No staff account found. Contact your administrator.');
      }

      if (!staff.is_active) {
        await supabase.auth.signOut();
        throw new Error('Your account has been disabled. Contact your administrator.');
      }

      // Step 3: Record login (updates last_login timestamp directly)
      await recordLogin(staff.id);

      onLogin(toUser(staff));

    } catch (err: any) {
      setError(err.message ?? 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ──────────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const trimmedEmail = email.trim().toLowerCase();

      // Check if account exists and is active (don't reveal if email is registered)
      const { data: staff } = await supabase
        .from('users')
        .select('id, is_active, auth_id')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (staff && !staff.is_active) {
        throw new Error('This account is disabled. Contact your administrator.');
      }

      // Always send reset if auth_id exists — silently skip if not found (security best practice)
      if (staff?.auth_id) {
        const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw new Error(error.message);
      }

      setView('reset_sent');
    } catch (err: any) {
      setError(err.message ?? 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-violet-100/40 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Decorative blobs */}
      <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -right-48 w-[500px] h-[500px] bg-violet-100 rounded-full blur-3xl opacity-30" />
        <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-30" />
      </div>

      {/* Logo + title */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-5">
<img src="/snackbot-word-logo.png" alt="SnackBot" className="h-30 w-auto object-contain" /></div>
<h1 className="text-3xl font-extrabold text-black dark:text-white tracking-tight">
  {view === 'forgot'     && 'Reset Password'}
  {view === 'reset_sent' && 'Check Your Email'}
  {view === 'link_error' && 'Link Expired'}
</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-neutral-500">
          {view === 'forgot'     && 'Enter your email to receive a reset link'}
          {view === 'reset_sent' && `We sent a link to ${email}`}
          {view === 'link_error' && 'Your reset link is no longer valid'}
        </p>
      </div>

      {/* Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl shadow-xl shadow-gray-100/80 border border-gray-100 dark:border-[var(--sb-border)] px-8 py-8">

          {/* ── Sign In ── */}
          {view === 'signin' && (
            <form onSubmit={handleLogin} className="space-y-5">
              {error && <ErrorBox msg={error} />}

              <Field label="Email address">
                <InputWrapper icon={<Mail className="w-4 h-4" />}>
                  <input
                    type="email" required autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@snackbot.com"
                    className={inputCls}
                  />
                </InputWrapper>
              </Field>

              <Field label="Password">
                <InputWrapper icon={<Lock className="w-4 h-4" />} suffix={
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }>
                  <input
                    type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </InputWrapper>
              </Field>

              <div className="flex justify-end">
                <button type="button" onClick={() => { setView('forgot'); setError(''); }}
                  className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors">
                  Forgot password?
                </button>
              </div>

              <SubmitButton accent={accent} loading={loading} label="Sign in" />

              <button
                type="button"
                onClick={() => { window.location.href = '/demo-onboarding'; }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-violet-200 text-violet-700 hover:bg-violet-50 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Try Demo
              </button>
            </form>
          )}

          {/* ── Forgot Password ── */}
          {view === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-5">
              {error && <ErrorBox msg={error} />}

              <Field label="Staff email address">
                <InputWrapper icon={<Mail className="w-4 h-4" />}>
                  <input
                    type="email" required autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@snackbot.com"
                    className={inputCls}
                  />
                </InputWrapper>
              </Field>

              <SubmitButton accent={accent} loading={loading}
                label="Send Reset Link" icon={<KeyRound className="w-4 h-4" />} />

              <button type="button" onClick={() => { setView('signin'); setError(''); }}
                className="flex items-center justify-center gap-1.5 w-full text-sm text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
            </form>
          )}

          {/* ── Reset Sent ── */}
          {view === 'reset_sent' && (
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed">
                If <strong>{email}</strong> is registered, a password reset link has been sent.
                Check your inbox and spam folder. The link expires in <strong>24 hours</strong>.
              </p>
              <button onClick={() => { setView('signin'); setEmail(''); setError(''); }}
                className={cn('w-full py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:opacity-90 transition-all', accent)}>
                Back to Sign In
              </button>
            </div>
          )}

          {/* ── Link Expired / Error ── */}
          {view === 'link_error' && (
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed">
                {hashErr ? (LINK_ERROR_MESSAGES[hashErr.errorCode] ?? hashErr.description ?? 'This link is invalid or has expired.') : 'This link is invalid or has expired.'}
              </p>
              <button
                onClick={() => { setView('forgot'); setError(''); }}
                className={cn('w-full py-2.5 rounded-xl text-sm font-semibold text-white shadow-md hover:opacity-90 transition-all', accent)}
              >
                Request a New Reset Link
              </button>
              <button onClick={() => { setView('signin'); setError(''); }}
                className="flex items-center justify-center gap-1.5 w-full text-sm text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ResetPassword Page ──────────────────────────────────────────────────────

export function ResetPassword() {
  const { settings, themeColors } = useSettings();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState('');
  const [ready, setReady]       = useState(true);
  const [linkExpired, setLinkExpired] = useState(false);

  const isDark = settings.theme === 'dark'
    || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const accent = isDark ? (themeColors?.bg ?? 'bg-violet-600') : (themeColors?.bgLight ?? 'bg-violet-600');

  React.useEffect(() => {
  const hashErr = parseHashError();
  if (hashErr) {
    setLinkExpired(true);
    window.history.replaceState(null, '', window.location.pathname);
    return;
  }

  // Get session immediately - ConfirmationURL already exchanges the token
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) setReady(true);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') setReady(true);
    if (event === 'SIGNED_IN' && session) setReady(true);
  });

  return () => subscription.unsubscribe();
}, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    setError('');

    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw new Error(updateErr.message);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staff } = await supabase
          .from('users').select('id, name').eq('auth_id', user.id).maybeSingle();
        if (staff) {
          await supabase.from('audit_logs').insert({
            event:         'password_reset',
            actor_user_id: staff.id,
            details:       { method: 'email_link' },
            status:        'success',
            merchant_id:   user.user_metadata?.merchant_id ?? null,
          });
        }
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-5">
          <div className={cn('p-3.5 rounded-2xl shadow-lg', accent)}>
            <Store className={cn("w-9 h-9", isDark ? "text-white" : themeColors?.text)} />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold text-black dark:text-white">
          {done ? 'Password Updated!' : 'Set New Password'}
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl shadow-xl border border-gray-100 dark:border-[var(--sb-border)] px-8 py-8">
          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <p className="text-sm text-gray-600 dark:text-neutral-400">Your password has been updated. You can now sign in.</p>
              <a href="/" className={cn('block w-full py-2.5 rounded-xl text-sm font-semibold text-white text-center shadow-md hover:opacity-90 transition-all', accent)}>
                Go to Sign In
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {!ready && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
                  Verifying your reset link… If this persists, click the email link again.
                </div>
              )}
              {error && <ErrorBox msg={error} />}

              <Field label="New Password">
                <InputWrapper icon={<Lock className="w-4 h-4" />} suffix={
                  <button type="button" onClick={() => setShowPw(p => !p)} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }>
                  <input type={showPw ? 'text' : 'password'} required minLength={8}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters" className={inputCls} />
                </InputWrapper>
              </Field>

              <Field label="Confirm Password">
                <InputWrapper icon={<Lock className="w-4 h-4" />}>
                  <input type={showPw ? 'text' : 'password'} required
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat password" className={inputCls} />
                </InputWrapper>
              </Field>

              <div className="space-y-1">
                <Check ok={password.length >= 8}              label="At least 8 characters" />
                <Check ok={!!password && password === confirm}  label="Passwords match" />
              </div>

              <SubmitButton accent={accent} loading={loading} disabled={!ready}
                label="Update Password" icon={<KeyRound className="w-4 h-4" />} />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared micro-components ─────────────────────────────────────────────────

const inputCls = 'w-full py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-gray-400 dark:text-neutral-500 text-black dark:text-neutral-100';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-black dark:text-neutral-300">{label}</label>
      {children}
    </div>
  );
}

function InputWrapper({ icon, suffix, children }: {
  icon: React.ReactNode; suffix?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 border border-gray-200 dark:border-[var(--sb-border)] rounded-xl focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 transition-all">
      <span className="text-gray-400 dark:text-neutral-500 shrink-0">{icon}</span>
      {children}
      {suffix && <span className="shrink-0">{suffix}</span>}
    </div>
  );
}

function SubmitButton({ accent, loading, label, icon, disabled }: {
  accent: string; loading: boolean; label: string; icon?: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button type="submit" disabled={loading || disabled}
      className={cn(
        'w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white',
        'shadow-lg transition-all hover:opacity-95 active:scale-[0.98]',
        'disabled:opacity-70 disabled:cursor-not-allowed',
        accent
      )}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{icon}{label}</>}
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      {msg}
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className={cn('text-xs flex items-center gap-1.5 transition-colors', ok ? 'text-emerald-600' : 'text-gray-400 dark:text-neutral-500')}>
      <CheckCircle2 className="w-3.5 h-3.5" /> {label}
    </p>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function recordLogin(userId: string) {
  try {
    // 1. Directly update the last_login column in the users table
    const { error } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.warn('Failed to direct-update last_login column:', error.message);
    }

    // 2. Fallback/Complementary RPC call in case your database specifically relies on this trigger/log
    await supabase.rpc('record_login', { p_user_id: userId });
  } catch (err) {
    // non-critical, so we fail silently
    console.error('Error recording login activity:', err);
  }
}

function toUser(staff: any): LoggedInUser {
  return {
    id:                staff.id,
    email:             staff.email,
    name:              staff.name,
    role:              staff.role as LoggedInUser['role'],
    avatar_url:        staff.avatar_url ?? null,
    is_platform_admin: staff.is_platform_admin ?? false,
    merchant_id:       staff.merchant_id ?? null,
  };
}