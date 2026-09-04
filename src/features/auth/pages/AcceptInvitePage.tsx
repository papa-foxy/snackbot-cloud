import React, { useState, useEffect } from 'react';
import {
  Lock, Mail, Loader2, AlertTriangle, Eye, EyeOff,
  CheckCircle2, ArrowLeft, UserPlus, User
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { AuthLayout } from '../components/AuthLayout';
import { AUTH_STYLES } from '../styles';

interface Invitation {
  id: string;
  email: string;
  name: string;
  role: string;
  merchant_id: string;
  accepted_at: string | null;
  created_at?: string;
}

export function AcceptInvitePage() {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. No token provided.');
      setLoading(false);
      return;
    }

    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('staff_invitations')
        .select('id, email, name, role, merchant_id, accepted_at, created_at')
        .eq('id', token)
        .single();

      if (fetchErr) throw fetchErr;
      if (!data) throw new Error('Invitation not found.');
      if (data.accepted_at) throw new Error('This invitation has already been accepted.');

      if (data.created_at) {
        const createdAt = new Date(data.created_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursDiff > 24) throw new Error('This invitation has expired. Please contact your administrator for a new invitation.');
      }

      setInvitation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (!invitation) throw new Error('No invitation loaded.');

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
        options: {
          data: {
            name: invitation.name,
            role: invitation.role,
            merchant_id: invitation.merchant_id,
          },
        },
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error('Failed to create account.');

      // Mark invitation as accepted
      await supabase
        .from('staff_invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', token);

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setSubmitting(false);
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
            Staff Onboarding
          </span>
        </div>

        {/* Brand Icon Header */}
        <div className="text-center mb-6">
          <div className={AUTH_STYLES.iconBadge}>
            <UserPlus className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {success ? 'Welcome to SnackBot!' : 'Accept Invitation'}
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 max-w-xs mx-auto">
            {success
              ? 'Your account has been set up successfully.'
              : 'Set your password to join your team station.'}
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-10 space-y-3">
            <Loader2 className="w-8 h-8 text-[#D97706] animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Verifying staff invitation...</p>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              Your staff account is ready. You can now log in to access your station terminal.
            </p>
            <div className="pt-2">
              <a href="/" className={AUTH_STYLES.primaryButton}>
                Go to Sign In
              </a>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && !loading && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Invitation Form */}
        {!loading && !success && invitation && (
          <form onSubmit={handleAccept} className="space-y-4">
            <div>
              <label className={AUTH_STYLES.label}>Name</label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={invitation.name}
                  className={AUTH_STYLES.disabledInput}
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={AUTH_STYLES.label}>Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={invitation.email}
                  className={AUTH_STYLES.disabledInput}
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={AUTH_STYLES.label}>Assigned Role</label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={invitation.role}
                  className={`${AUTH_STYLES.disabledInput} capitalize`}
                />
                <UserPlus className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={AUTH_STYLES.label}>Create Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={AUTH_STYLES.input}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={AUTH_STYLES.label}>Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className={AUTH_STYLES.input}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={AUTH_STYLES.primaryButton}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Accept & Join Team'
              )}
            </button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
