import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Loader2, Mail, User } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { AuthLayout } from '../components/AuthLayout';
import { AUTH_STYLES } from '../styles';

type DemoStep = 'business' | 'invite' | 'done';

interface DemoMerchant {
  id: string;
  name: string;
}

export function DemoOnboardingPage() {
  const [step, setStep] = useState<DemoStep>('business');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [merchant, setMerchant] = useState<DemoMerchant | null>(null);

  const createBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!businessName.trim() || !ownerName.trim() || !ownerEmail.trim()) {
        throw new Error('Business name, owner name, and owner email are required.');
      }

      const { data, error: insertError } = await supabase
        .from('business')
        .insert({
          name: businessName.trim(),
          owner_name: ownerName.trim(),
          owner_email: ownerEmail.trim().toLowerCase(),
          business_type: 'Demo',
          plan: 'basic',
          plan_mrr: 99,
          plan_status: 'pending',
          joined_date: new Date().toISOString().slice(0, 10),
        })
        .select('id, name')
        .single();

      if (insertError) throw new Error(`Failed to create business: ${insertError.message}`);
      if (!data) throw new Error('Business creation did not return a record.');

      setMerchant(data as DemoMerchant);
      setInviteEmail(ownerEmail.trim().toLowerCase());
      setStep('invite');
    } catch (err: any) {
      setError(err.message ?? 'Failed to create demo business.');
    } finally {
      setLoading(false);
    }
  };

  const sendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant) return;

    setError('');
    setLoading(true);

    try {
      if (!inviteEmail.trim()) {
        throw new Error('Please provide an email to send the staff invitation.');
      }

      const { error: inviteError } = await supabase.from('staff_invitations').insert({
        merchant_id: merchant.id,
        email: inviteEmail.trim().toLowerCase(),
        name: ownerName.trim() || 'Demo Manager',
        role: 'Manager',
      });

      if (inviteError) {
        throw new Error(`Failed to queue invitation: ${inviteError.message}`);
      }

      setStep('done');
    } catch (err: any) {
      setError(err.message ?? 'Failed to send invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout maxWidth="max-w-lg">
      <div className={AUTH_STYLES.card}>
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <a href="/" className={AUTH_STYLES.backLink}>
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </a>
          <span className={AUTH_STYLES.badge}>
            Sandbox Onboarding
          </span>
        </div>

        {/* Brand Icon Header */}
        <div className="text-center mb-6">
          <div className={AUTH_STYLES.iconBadge}>
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Try SnackBot Demo</h1>
          <p className="text-sm text-slate-500 mt-1.5 max-w-sm mx-auto">
            Spin up a test environment, invite yourself as Manager, and test cloud ordering flow in seconds.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Step 1: Business Setup ── */}
        {step === 'business' && (
          <form onSubmit={createBusiness} className="space-y-4">
            <div>
              <label className={AUTH_STYLES.label}>
                Business Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Acme Artisan Bakery"
                  className={AUTH_STYLES.input}
                />
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={AUTH_STYLES.label}>
                Your Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className={AUTH_STYLES.input}
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={AUTH_STYLES.label}>
                Contact Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className={AUTH_STYLES.input}
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={AUTH_STYLES.primaryButton}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Demo Merchant'}
            </button>
          </form>
        )}

        {/* ── Step 2: Staff Invitation ── */}
        {step === 'invite' && (
          <form onSubmit={sendInvitation} className="space-y-4">
            <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/60 text-xs text-amber-900 leading-relaxed">
              Created merchant <span className="font-bold text-[#D97706]">{merchant?.name}</span>. Now send yourself an invite to activate your account credentials.
            </div>

            <div>
              <label className={AUTH_STYLES.label}>
                Invite Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className={AUTH_STYLES.input}
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={AUTH_STYLES.primaryButton}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Manager Invitation'}
            </button>
          </form>
        )}

        {/* ── Step 3: Done Confirmation ── */}
        {step === 'done' && (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Demo Ready!</h2>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              We queued an onboarding invitation for <span className="text-slate-900 font-semibold">{inviteEmail}</span>. Check your inbox to set a password and begin testing live POS workflows.
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
        )}
      </div>
    </AuthLayout>
  );
}
