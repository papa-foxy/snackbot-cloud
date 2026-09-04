import React, { useState } from 'react';
import {
  Lock, Mail, Loader2, AlertTriangle, Eye, EyeOff,
  KeyRound, ArrowLeft, CheckCircle2, Sparkles, UtensilsCrossed,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';
import { parseHashError, LINK_ERROR_MESSAGES } from '../utils/parseHashError';
import { AmbientCanvas } from '../components/AmbientCanvas';
import { FoodCarousel } from '../components/FoodCarousel';
import type { LoggedInUser, LoginProps, AuthView } from '../types';

export function LoginPage({ onLogin }: LoginProps) {
  // Detect Supabase hash errors on initial load (e.g. expired OTP redirect to root)
  const hashErr = React.useMemo(() => parseHashError(), []);
  const initialView: AuthView = hashErr ? 'link_error' : 'signin';

  const [view, setView] = useState<AuthView>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Clear the hash from the URL bar so it doesn't persist on refresh
  React.useEffect(() => {
    if (hashErr) window.history.replaceState(null, '', window.location.pathname);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-login ONLY when returning from an OAuth redirect ──────────────────
  React.useEffect(() => {
    // Only proceed if this page load is an OAuth redirect from Google/Apple
    const isOAuthRedirect =
      window.location.hash.includes('access_token') ||
      window.location.search.includes('code=');

    if (!isOAuthRedirect) return;

    const handleAuthSession = async (sessionUser: any) => {
      if (!sessionUser) return;
      try {
        setLoading(true);
        // Query staff record matching auth_id OR email
        const userEmail = sessionUser.email?.toLowerCase() ?? '';
        const { data: staff, error: staffErr } = await supabase
          .from('users')
          .select('id, name, email, role, is_active, avatar_url, is_platform_admin, merchant_id, auth_id')
          .or(`auth_id.eq.${sessionUser.id},email.eq.${userEmail}`)
          .maybeSingle();

        if (staffErr || !staff) {
          setError(`No staff account registered for ${sessionUser.email}. Please contact your administrator.`);
          await supabase.auth.signOut();
          return;
        }

        if (!staff.is_active) {
          setError('Your account has been disabled. Please contact your administrator.');
          await supabase.auth.signOut();
          return;
        }

        // Link auth_id if not yet associated
        if (!staff.auth_id) {
          await supabase.from('users').update({ auth_id: sessionUser.id }).eq('id', staff.id);
        }

        await recordLogin(staff.id);
        // Clear OAuth tokens from the URL bar cleanly
        window.history.replaceState(null, '', window.location.pathname);
        onLogin(toUser(staff));
      } catch (err: any) {
        setError(err.message ?? 'Authentication failed.');
      } finally {
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleAuthSession(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        handleAuthSession(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onLogin]);

  // ── Sign In ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const trimmedEmail = email.trim().toLowerCase();

      // Step 1: Authenticate via Supabase Auth
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
        await supabase.auth.signOut();
        throw new Error('No staff account found. Contact your administrator.');
      }

      if (!staff.is_active) {
        await supabase.auth.signOut();
        throw new Error('Your account has been disabled. Contact your administrator.');
      }

      // Step 3: Record login timestamp
      await recordLogin(staff.id);

      onLogin(toUser(staff));

    } catch (err: any) {
      setError(err.message ?? 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  // ── Social OAuth Login ──────────────────────────────────────────────────────
  const handleOAuthLogin = async (provider: 'google' | 'apple' | 'facebook') => {
    try {
      setLoading(true);
      setError('');
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}`,
          skipBrowserRedirect: true,
        },
      });

      if (oauthErr) throw oauthErr;

      if (!data?.url) {
        throw new Error(`Unable to initialize ${provider} sign-in.`);
      }

      // Pre-check if the provider is enabled before full-page navigation
      try {
        const probe = await fetch(data.url, { method: 'GET' });
        if (!probe.ok) {
          const body = await probe.json().catch(() => ({}));
          const name = provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : 'Facebook';
          if (body?.msg?.includes('not enabled') || body?.error_code === 'validation_failed') {
            throw new Error(`${name} sign-in is not enabled yet in your Supabase project. Please enable ${name} in your Supabase Dashboard under Authentication → Providers.`);
          }
          throw new Error(body?.msg ?? `Failed to connect to ${name} sign-in.`);
        }
      } catch (probeErr: any) {
        if (probeErr.message?.includes('not enabled') || probeErr.message?.includes('Supabase Dashboard')) {
          throw probeErr;
        }
        // If error was just a cross-origin redirect error from fetch, that means the provider is live!
      }

      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message ?? `Failed to sign in with ${provider}.`);
      setLoading(false);
    }
  };

  // ── Forgot Password ──────────────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const trimmedEmail = email.trim().toLowerCase();

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
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetErr) throw new Error(resetErr.message);
      }

      setView('reset_sent');
    } catch (err: any) {
      setError(err.message ?? 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AmbientCanvas>
      {/* ── Outer card (floats above the scene) ───────────────────────────────── */}
      <div className="relative z-10 bg-white rounded-3xl shadow-2xl shadow-black/40 border border-white/10 max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden p-3 md:p-4 gap-0">

        {/* ══ LEFT — Form column ═══════════════════════════════════════════════ */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center px-6 py-10 md:px-12">

          {/* Brand header */}
          <div className="flex flex-col items-center mb-8">
            <div className="bg-[#D97706] text-white p-3 rounded-2xl w-fit shadow-lg shadow-amber-600/30">
              <UtensilsCrossed className="w-7 h-7" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-4 text-center">
              {view === 'signin'     && 'Welcome Back!'}
              {view === 'forgot'     && 'Reset Password'}
              {view === 'reset_sent' && 'Check Your Email'}
              {view === 'link_error' && 'Link Expired'}
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 text-center max-w-xs">
              {view === 'signin'     && 'Sign in to access your SnackBot terminal and live orders.'}
              {view === 'forgot'     && 'Enter your staff email to receive a password reset link.'}
              {view === 'reset_sent' && `We sent a reset link to ${email}`}
              {view === 'link_error' && 'Your reset link is no longer valid.'}
            </p>
          </div>

          {/* ── Sign In Form ── */}
          {view === 'signin' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {error && <InlineError msg={error} />}

              <FormField label="Email address">
                <SplitInput icon={<Mail className="w-4 h-4" />}>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    className={inputCls}
                  />
                </SplitInput>
              </FormField>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setError(''); }}
                    className="text-xs font-medium text-slate-500 hover:text-amber-600 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <SplitInput
                  icon={<Lock className="w-4 h-4" />}
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                >
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </SplitInput>
              </div>

              <PrimaryButton loading={loading} label="Log In to Station" className="mt-5" />

              {/* ── Social / OAuth Providers ── */}
              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-xs text-slate-400 font-medium whitespace-nowrap">
                  or continue with
                </span>
                <div className="border-t border-slate-200 w-full" />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.97] text-slate-700 font-medium text-xs shadow-sm transition-all hover:border-slate-300 disabled:opacity-50"
                  title="Sign in with Google"
                >
                  <GoogleIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate font-semibold">Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('apple')}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.97] text-slate-700 font-medium text-xs shadow-sm transition-all hover:border-slate-300 disabled:opacity-50"
                  title="Sign in with Apple"
                >
                  <AppleIcon className="w-4 h-4 shrink-0 text-slate-900" />
                  <span className="truncate font-semibold">Apple</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('facebook')}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.97] text-slate-700 font-medium text-xs shadow-sm transition-all hover:border-slate-300 disabled:opacity-50"
                  title="Sign in with Facebook"
                >
                  <FacebookIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate font-semibold">Facebook</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => { window.location.href = '/demo-onboarding'; }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-amber-200 text-amber-700 hover:bg-amber-50 transition-all mt-1"
              >
                <Sparkles className="w-4 h-4" />
                Try Demo
              </button>
            </form>
          )}

          {/* ── Forgot Password Form ── */}
          {view === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              {error && <InlineError msg={error} />}

              <FormField label="Staff email address">
                <SplitInput icon={<Mail className="w-4 h-4" />}>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    className={inputCls}
                  />
                </SplitInput>
              </FormField>

              <PrimaryButton
                loading={loading}
                label="Send Reset Link"
                icon={<KeyRound className="w-4 h-4" />}
                className="mt-2"
              />

              <button
                type="button"
                onClick={() => { setView('signin'); setError(''); }}
                className="flex items-center justify-center gap-1.5 w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
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
              <p className="text-sm text-slate-600 leading-relaxed">
                If <strong>{email}</strong> is registered, a password reset link has been sent.
                Check your inbox and spam folder. The link expires in <strong>24 hours</strong>.
              </p>
              <button
                type="button"
                onClick={() => { setView('signin'); setEmail(''); setError(''); }}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition-all"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* ── Link Expired / Error ── */}
          {view === 'link_error' && (
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-[#29221D] border border-[#78350F]/50 rounded-2xl flex items-center justify-center shadow-inner">
                  <AlertTriangle className="w-8 h-8 text-[#D97706]" />
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {hashErr
                  ? (LINK_ERROR_MESSAGES[hashErr.errorCode] ?? hashErr.description ?? 'This link is invalid or has expired.')
                  : 'This link is invalid or has expired.'}
              </p>
              <button
                type="button"
                onClick={() => { setView('forgot'); setError(''); }}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition-all"
              >
                Request a New Reset Link
              </button>
              <button
                type="button"
                onClick={() => { setView('signin'); setError(''); }}
                className="flex items-center justify-center gap-1.5 w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
            </div>
          )}

          {/* Legal footnote */}
          <p className="text-[11px] text-slate-400 text-center mt-10">
            By signing in you agree to our{' '}
            <a href="#" className="underline hover:text-slate-600 transition-colors">Terms & Conditions</a>{' '}
            and{' '}
            <a href="#" className="underline hover:text-slate-600 transition-colors">Privacy Policy</a>.
          </p>
        </div>

        {/* ══ RIGHT — Food showcase column ══════════════════════════════════════ */}
        <div className="lg:col-span-6 xl:col-span-5 hidden lg:block relative">
          <FoodCarousel />
        </div>

      </div>
    </AmbientCanvas>
  );
}

// ─── Shared design tokens & Micro-components ─────────────────────────────────

const inputCls = [
  'w-full py-2.5 text-sm bg-transparent focus:outline-none',
  'placeholder:text-slate-400 text-slate-900',
].join(' ');

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-700 block">{label}</label>
      {children}
    </div>
  );
}

function SplitInput({
  icon, suffix, children,
}: {
  icon: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 bg-stone-50/80 border border-stone-200 rounded-xl focus-within:bg-white focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-400/25 transition-all">
      <span className="text-slate-400 shrink-0">{icon}</span>
      {children}
      {suffix && <span className="shrink-0">{suffix}</span>}
    </div>
  );
}

function PrimaryButton({
  loading, label, icon, className, disabled,
}: {
  loading: boolean;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={cn(
        'w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl',
        'text-sm font-semibold text-white',
        'bg-amber-600 hover:bg-amber-700',
        'shadow-md shadow-amber-600/20 hover:shadow-amber-700/30',
        'transition-all active:scale-[0.98]',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className,
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{icon}{label}</>}
    </button>
  );
}

function InlineError({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      {msg}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function recordLogin(userId: string) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);

    if (error) console.warn('Failed to direct-update last_login column:', error.message);
    await supabase.rpc('record_login', { p_user_id: userId });
  } catch (err) {
    console.error('Error recording login activity:', err);
  }
}

function toUser(staff: any): LoggedInUser {
  return {
    id: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role as LoggedInUser['role'],
    avatar_url: staff.avatar_url ?? null,
    is_platform_admin: staff.is_platform_admin ?? false,
    merchant_id: staff.merchant_id ?? null,
  };
}

// ─── OAuth Provider Icons ────────────────────────────────────────────────────

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function AppleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.36-.58.67-1.08 1.74-.95 2.77 1.01.08 2.05-.53 2.68-1.28z" />
    </svg>
  );
}

function FacebookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

