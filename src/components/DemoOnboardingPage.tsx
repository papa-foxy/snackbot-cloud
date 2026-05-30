import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Loader2, Mail, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant) return;

    setError('');
    setLoading(true);

    try {
      const normalizedEmail = inviteEmail.trim().toLowerCase();
      if (!normalizedEmail) throw new Error('Email is required.');

      const { data: invitation, error: inviteErr } = await supabase
        .from('staff_invitations')
        .insert({
          email: normalizedEmail,
          role: 'Manager',
          name: ownerName.trim(),
          merchant_id: merchant.id,
          invited_by: null,
        })
        .select('id')
        .single();

      if (inviteErr) throw new Error(`Could not create invitation: ${inviteErr.message}`);
      if (!invitation) throw new Error('Invitation record was not created.');

      const { error: fnErr } = await supabase.functions.invoke('send-invite', {
        body: { invitationId: invitation.id },
      });

      if (fnErr) {
        let detail = fnErr.message;
        try {
          if ((fnErr as any).context && typeof (fnErr as any).context.json === 'function') {
            const body = await (fnErr as any).context.json() as { error?: string };
            if (body?.error) detail = body.error;
          }
        } catch {
          // Fall back to default error message.
        }
        throw new Error(`Failed to send invite: ${detail}`);
      }

      setStep('done');
    } catch (err: any) {
      setError(err.message ?? 'Failed to send invitation email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-violet-100/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          {step === 'business' && 'Try Demo'}
          {step === 'invite' && 'Invite Owner'}
          {step === 'done' && 'Invitation Sent'}
        </h1>
        <p className="text-sm text-gray-500 text-center mt-1 mb-6">
          {step === 'business' && 'Create a demo merchant account to get started.'}
          {step === 'invite' && `Business created: ${merchant?.name}`}
          {step === 'done' && 'Check your email to accept the invitation and set your password.'}
        </p>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {step === 'business' && (
          <form onSubmit={createBusiness} className="space-y-4">
            <Field label="Business Name">
              <Input
                icon={<Building2 className="w-4 h-4" />}
                value={businessName}
                onChange={setBusinessName}
                placeholder="e.g. Demo Cafe"
              />
            </Field>

            <Field label="Owner Name">
              <Input
                icon={<User className="w-4 h-4" />}
                value={ownerName}
                onChange={setOwnerName}
                placeholder="e.g. Alex Tan"
              />
            </Field>

            <Field label="Owner Email">
              <Input
                icon={<Mail className="w-4 h-4" />}
                value={ownerEmail}
                onChange={setOwnerEmail}
                type="email"
                placeholder="owner@demo.com"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Demo Business'}
            </button>
          </form>
        )}

        {step === 'invite' && (
          <form onSubmit={sendInvite} className="space-y-4">
            <Field label="Invitation Email">
              <Input
                icon={<Mail className="w-4 h-4" />}
                value={inviteEmail}
                onChange={setInviteEmail}
                type="email"
                placeholder="owner@demo.com"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invitation Email'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-sm text-gray-600">
              The owner invitation has been sent. The user can open that email and follow the same acceptance process as the normal invite flow.
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full bg-violet-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-700"
            >
              Back to Login
            </button>
          </div>
        )}

        <button
          onClick={() => { window.location.href = '/'; }}
          className="mt-5 text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center justify-center gap-1 mx-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-800">{label}</label>
      {children}
    </div>
  );
}

function Input({
  icon,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 transition-all">
      <span className="text-gray-400 shrink-0">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-gray-400 text-black"
      />
    </div>
  );
}
