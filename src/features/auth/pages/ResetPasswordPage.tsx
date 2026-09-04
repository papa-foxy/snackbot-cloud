import React, { useState, useEffect } from 'react';
import {
  Lock, Loader2, AlertTriangle, Eye, EyeOff,
  KeyRound, CheckCircle2, ArrowLeft
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';
import { parseHashError } from '../utils/parseHashError';
import { AuthLayout } from '../components/AuthLayout';
import { AUTH_STYLES } from '../styles';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(true);
  const [linkExpired, setLinkExpired] = useState(false);

  useEffect(() => {
    const hashErr = parseHashError();
    if (hashErr) {
      setLinkExpired(true);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

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
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

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
            event: 'password_reset',
            actor_user_id: staff.id,
            details: { method: 'email_link' },
            status: 'success',
            merchant_id: user.user_metadata?.merchant_id ?? null,
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
    <AuthLayout maxWidth="max-w-md">
      <div className={AUTH_STYLES.card}>
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <a href="/" className={AUTH_STYLES.backLink}>
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </a>
          <span className={AUTH_STYLES.badge}>
            Account Security
          </span>
        </div>

        {/* Brand Icon Header */}
        <div className="text-center mb-6">
          <div className={AUTH_STYLES.iconBadge}>
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {done ? 'Password Updated!' : 'Set New Password'}
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 max-w-xs mx-auto">
            {done
              ? 'Your password has been changed. You can now log in.'
              : 'Choose a strong password with at least 8 characters.'}
          </p>
        </div>

        {done ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your credentials are now up to date. You can return to the sign-in station.
            </p>
            <div className="pt-2">
              <a
                href="/"
                className={AUTH_STYLES.primaryButton}
              >
                Go to Sign In
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {linkExpired && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  This reset link has expired. Please{' '}
                  <a href="/" className="underline font-bold text-[#D97706]">request a new link</a>.
                </span>
              </div>
            )}
            {!ready && !linkExpired && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs flex items-start gap-2">
                <Loader2 className="w-4 h-4 shrink-0 animate-spin mt-0.5 text-slate-500" />
                <span>Verifying your reset link… If this persists, click the email link again.</span>
              </div>
            )}
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className={AUTH_STYLES.label}>New Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={AUTH_STYLES.input}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={AUTH_STYLES.label}>Confirm Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  className={AUTH_STYLES.input}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1 py-1">
              <p className={cn('text-xs flex items-center gap-1.5 transition-colors font-medium', password.length >= 8 ? 'text-emerald-600' : 'text-slate-400')}>
                <CheckCircle2 className="w-3.5 h-3.5" /> At least 8 characters
              </p>
              <p className={cn('text-xs flex items-center gap-1.5 transition-colors font-medium', password && password === confirm ? 'text-emerald-600' : 'text-slate-400')}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !ready || linkExpired}
              className={AUTH_STYLES.primaryButton}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-4 h-4" />Update Password</>}
            </button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
