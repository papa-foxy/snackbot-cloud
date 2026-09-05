import React, { useState, useEffect } from 'react';
import {
  Settings, Shield, DollarSign, Bell, AlertTriangle,
  CheckCircle2, Save, Radio, Power, Clock, Lock
} from 'lucide-react';
import { PLANS, PlatformSettings } from '../types';
import { cn } from '../../../utils/cn';

import { supabase } from '../../../lib/supabase';

export function SettingsTab() {
  const [settings, setSettings] = useState<PlatformSettings>(() => {
    const saved = localStorage.getItem('snackbot_platform_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      requireTwoFactor: true,
      enforceRLS: true,
      sessionTimeoutHours: 4,
      auditRetentionDays: 90,
      maintenanceMode: false,
      maintenanceNotice: 'SnackBot Cloud is undergoing scheduled database maintenance. Please check back shortly.',
      broadcastAnnouncement: '',
      allowPublicRegistrations: true,
    };
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync latest platform announcement from Supabase on mount
  useEffect(() => {
    const fetchRemoteSettings = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_broadcast_announcement')
          .maybeSingle();

        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value);
            if (typeof parsed === 'object') {
              setSettings(prev => ({
                ...prev,
                broadcastAnnouncement: parsed.message ?? prev.broadcastAnnouncement,
                maintenanceMode: parsed.maintenanceMode ?? prev.maintenanceMode,
                maintenanceNotice: parsed.maintenanceNotice ?? prev.maintenanceNotice,
              }));
            }
          } catch {}
        }
      } catch (err) {
        console.warn('Failed to fetch remote platform settings:', err);
      }
    };

    fetchRemoteSettings();
  }, []);

  const handleToggle = (key: keyof PlatformSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    localStorage.setItem('snackbot_platform_settings', JSON.stringify(settings));

    try {
      // Sync broadcast announcement & maintenance settings to Supabase
      const payload = {
        merchant_id: '00000000-0000-0000-0000-000000000001',
        key: 'platform_broadcast_announcement',
        value: JSON.stringify({
          message: settings.broadcastAnnouncement,
          active: Boolean(settings.broadcastAnnouncement && settings.broadcastAnnouncement.trim()),
          maintenanceMode: settings.maintenanceMode,
          maintenanceNotice: settings.maintenanceNotice,
          updated_at: new Date().toISOString()
        }),
        description: 'Global platform broadcast announcement and maintenance settings',
        updated_at: new Date().toISOString()
      };

      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', 'platform_broadcast_announcement')
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('settings')
          .update({
            value: payload.value,
            updated_at: payload.updated_at
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('settings')
          .insert([payload]);
      }
    } catch (err) {
      console.warn('Failed to sync settings to Supabase:', err);
    }

    // Broadcast window event for instant same-browser notification
    window.dispatchEvent(new CustomEvent('snackbot_announcement_updated', {
      detail: {
        message: settings.broadcastAnnouncement,
        active: Boolean(settings.broadcastAnnouncement && settings.broadcastAnnouncement.trim()),
        maintenanceMode: settings.maintenanceMode,
        maintenanceNotice: settings.maintenanceNotice
      }
    }));

    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Platform Configuration</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Configure system-wide security, tenant limits, maintenance modes, and global announcements.
          </p>
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] shadow-md shadow-amber-600/20 transition-all"
        >
          <Save className="w-4 h-4" /> Save All Settings
        </button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Platform configuration successfully saved and applied!</span>
        </div>
      )}

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security & Access Policies */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#D97706] flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Security & Authentication</h2>
              <p className="text-[11px] text-slate-500">Global access control policies for all tenants</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-900">Multi-Factor Authentication (2FA)</div>
                <div className="text-[11px] text-slate-500">Require OTP code for superadmin portal logins</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('requireTwoFactor')}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5',
                  settings.requireTwoFactor ? 'bg-[#D97706]' : 'bg-slate-200'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white shadow-md transition-transform',
                    settings.requireTwoFactor ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-900">PostgreSQL Row Level Security (RLS)</div>
                <div className="text-[11px] text-slate-500">Enforce strict tenant data isolation in database</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('enforceRLS')}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5',
                  settings.enforceRLS ? 'bg-[#D97706]' : 'bg-slate-200'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white shadow-md transition-transform',
                    settings.enforceRLS ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-slate-900">Public Self-Service Registration</div>
                <div className="text-[11px] text-slate-500">Allow new restaurants to register via onboarding page</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('allowPublicRegistrations')}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5',
                  settings.allowPublicRegistrations ? 'bg-[#D97706]' : 'bg-slate-200'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white shadow-md transition-transform',
                    settings.allowPublicRegistrations ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Session Auto-Expire
                </label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#D97706]"
                  value={settings.sessionTimeoutHours}
                  onChange={e => setSettings({ ...settings, sessionTimeoutHours: Number(e.target.value) })}
                >
                  <option value={1}>1 Hour</option>
                  <option value={4}>4 Hours (Standard)</option>
                  <option value={8}>8 Hours (Full Shift)</option>
                  <option value={24}>24 Hours</option>
                  <option value={168}>7 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Audit Log Retention
                </label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#D97706]"
                  value={settings.auditRetentionDays}
                  onChange={e => setSettings({ ...settings, auditRetentionDays: Number(e.target.value) })}
                >
                  <option value={30}>30 Days</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days (Recommended)</option>
                  <option value={365}>1 Year</option>
                  <option value={9999}>Indefinite</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Global Broadcast & Maintenance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#D97706] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Broadcast & System Notices</h2>
              <p className="text-[11px] text-slate-500">Live communication with all connected restaurant managers</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                Global Announcement Banner
              </label>
              <input
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D97706] focus:ring-4 focus:ring-[#D97706]/10"
                placeholder="e.g. Scheduled system upgrade on Sunday at 2:00 AM UTC."
                value={settings.broadcastAnnouncement}
                onChange={e => setSettings({ ...settings, broadcastAnnouncement: e.target.value })}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Leave empty to hide the announcement banner on merchant portals.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between py-2 mb-2">
                <div>
                  <div className="text-xs font-bold text-slate-900">Emergency Maintenance Mode</div>
                  <div className="text-[11px] text-slate-500">Locks non-admin users out with a maintenance message</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('maintenanceMode')}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5',
                    settings.maintenanceMode ? 'bg-rose-600' : 'bg-slate-200'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full bg-white shadow-md transition-transform',
                      settings.maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>

              {settings.maintenanceMode && (
                <div className="mt-2 animate-in fade-in">
                  <label className="block text-[11px] font-bold text-rose-700 uppercase mb-1">
                    Maintenance Notice
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3.5 py-2 bg-rose-50/50 border border-rose-200 rounded-xl text-xs text-rose-900 focus:outline-none focus:border-rose-400"
                    value={settings.maintenanceNotice}
                    onChange={e => setSettings({ ...settings, maintenanceNotice: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subscription Plan Tiers */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#D97706] flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">SaaS Plan Tiers & Features</h2>
                <p className="text-[11px] text-slate-500">Subscription pricing and bundled platform capabilities</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map(p => (
              <div key={p.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-900">{p.label} Tier</span>
                    <span className="text-xs font-bold text-[#D97706]">RM {p.price}/mo</span>
                  </div>
                  <ul className="space-y-2 mt-4">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500">
                  Default billing cycle: Monthly
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}
