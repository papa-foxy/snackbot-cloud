import React, { useState } from 'react';
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { PlatformHealthReport } from '../expert-system/types';
import { Merchant, StaffUser } from '../types';
import { generateExecutiveDiagnosis, AIExecutiveDiagnosisResult } from '../expert-system/aiService';
import { cn } from '../../../utils/cn';

interface AIExecutiveDiagnosisCardProps {
  report: PlatformHealthReport;
  merchants: Merchant[];
  superadmins: StaffUser[];
  keepalive: { last_ping: string; ping_count: number } | null;
}

export function AIExecutiveDiagnosisCard({
  report,
  merchants,
  superadmins,
  keepalive,
}: AIExecutiveDiagnosisCardProps) {
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<AIExecutiveDiagnosisResult | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateExecutiveDiagnosis(report, merchants, superadmins, keepalive);
      setDiagnosis(res);
      setLastGeneratedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Failed to generate AI executive diagnosis:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-500/5 via-white to-amber-500/10 p-5 shadow-xs transition-all relative overflow-hidden">
      {/* Ambient background decoration */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#D97706] to-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-600/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706] bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded-full">
                Gemini AI Powered
              </span>
              {lastGeneratedAt && (
                <span className="text-[10px] text-slate-400">Updated at {lastGeneratedAt}</span>
              )}
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
              AI Executive Platform Diagnosis & Growth Levers
            </h2>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs shrink-0',
            loading
              ? 'bg-amber-400 cursor-not-allowed'
              : 'bg-[#D97706] hover:bg-[#B45309] active:scale-95 shadow-amber-600/20'
          )}
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Platform Telemetry…</span>
            </>
          ) : diagnosis ? (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-Diagnose with AI</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate AI Strategic Briefing</span>
            </>
          )}
        </button>
      </div>

      {/* Body Content */}
      {!diagnosis && !loading && (
        <div className="mt-4 pt-4 border-t border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-600 text-xs">
          <p>
            Generate an AI-driven strategic briefing that synthesizes multi-tenant revenue levers, churn indicators, and operational bottlenecks across all {merchants.length} restaurants.
          </p>
          <button
            onClick={handleGenerate}
            className="text-[#D97706] hover:text-[#B45309] font-bold text-xs inline-flex items-center gap-1 shrink-0"
          >
            Start Analysis <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading && !diagnosis && (
        <div className="mt-5 py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <span className="text-xs font-medium">Synthesizing platform telemetry with Gemini AI…</span>
        </div>
      )}

      {diagnosis && (
        <div className="mt-4 pt-4 border-t border-amber-100/80 space-y-4 relative z-10 animate-in fade-in duration-300">
          {/* Executive Summary */}
          <div className="p-3.5 rounded-xl bg-white/80 backdrop-blur-xs border border-amber-200/60 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/80 block mb-1">
              Executive Posture Summary
            </span>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {diagnosis.summary}
            </p>
          </div>

          {/* Strategic Levers & Churn Alerts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Revenue Levers */}
            <div className="p-3.5 rounded-xl bg-white/70 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs mb-2">
                <TrendingUp className="w-4 h-4" />
                <span>Revenue & Growth Levers</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {diagnosis.strategicLevers.map((lever, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{lever}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Churn & Dormancy Risks */}
            <div className="p-3.5 rounded-xl bg-white/70 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-xs mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Retention & Churn Warnings</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {diagnosis.churnAlerts.map((alert, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                    <span>{alert}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recommended Priority Actions */}
          <div className="p-3.5 rounded-xl bg-white/70 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs mb-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#D97706]" />
              <span>Prioritized AI Remediation Sequence</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {diagnosis.recommendedActions.map((action, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-slate-900 truncate">{action.title}</span>
                    <span className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase shrink-0',
                      action.priority === 'Urgent' ? 'bg-rose-100 text-rose-800' :
                      action.priority === 'High' ? 'bg-amber-100 text-amber-800' :
                      'bg-blue-100 text-blue-800'
                    )}>
                      {action.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {action.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
