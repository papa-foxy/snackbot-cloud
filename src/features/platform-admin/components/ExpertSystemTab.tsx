import React, { useState, useMemo } from 'react';
import {
  Activity, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle,
  ArrowUpRight, RefreshCw, Filter, Search, ChevronRight,
  TrendingUp, Users, Store, DollarSign, Zap, Clock, ShieldCheck, Mail, Bot
} from 'lucide-react';
import { Merchant, StaffUser, PageTab } from '../types';
import { DiagnosticFinding, PlatformHealthReport, Severity, DiagnosticCategory, RemediationAction } from '../expert-system/types';
import { runPlatformDiagnostic } from '../expert-system/engine';
import { AIExecutiveDiagnosisCard } from './AIExecutiveDiagnosisCard';
import { AIFindingModal } from './AIFindingModal';
import { AICopilotDrawer } from './AICopilotDrawer';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';

interface ExpertSystemTabProps {
  merchants: Merchant[];
  superadmins: StaffUser[];
  keepalive: { last_ping: string; ping_count: number } | null;
  onRefreshData: () => Promise<void>;
  onNavigateTab: (tab: PageTab) => void;
  onMerchantUpdated: (m: Merchant) => void;
}

export function ExpertSystemTab({
  merchants,
  superadmins,
  keepalive,
  onRefreshData,
  onNavigateTab,
  onMerchantUpdated,
}: ExpertSystemTabProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [aiCopilotOpen, setAiCopilotOpen] = useState(false);
  const [selectedFindingForAI, setSelectedFindingForAI] = useState<DiagnosticFinding | null>(null);

  // Run the rule inference engine
  const report: PlatformHealthReport = useMemo(() => {
    return runPlatformDiagnostic({
      merchants,
      superadmins,
      keepalive,
    });
  }, [merchants, superadmins, keepalive]);

  const handleManualScan = async () => {
    setIsScanning(true);
    await onRefreshData();
    setIsScanning(false);
    setActionSuccess('Full platform diagnostic scan completed. All 14 rules re-evaluated.');
    setTimeout(() => setActionSuccess(''), 4000);
  };

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return report.findings.filter(f => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          f.title.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.merchantName?.toLowerCase().includes(q) ||
          f.ruleCode.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [report.findings, severityFilter, categoryFilter, searchTerm]);

  // Execute 1-Click Remediation
  const handleExecuteRemediation = async (finding: DiagnosticFinding, action: RemediationAction) => {
    setExecutingActionId(action.id);
    setActionSuccess('');

    try {
      if (action.type === 'update_status' && action.targetId) {
        // Approve / Activate
        const { error } = await supabase
          .from('business')
          .update({ plan_status: action.payload.status })
          .eq('id', action.targetId);

        if (!error) {
          const target = merchants.find(m => m.id === action.targetId);
          if (target) {
            onMerchantUpdated({ ...target, plan_status: action.payload.status });
          }
          setActionSuccess(`Successfully updated ${finding.merchantName} to ${action.payload.status}.`);
        }
      } else if (action.type === 'upgrade_plan' && action.targetId) {
        // Upgrade Plan
        const { error } = await supabase
          .from('business')
          .update({ plan: action.payload.plan, plan_mrr: action.payload.mrr })
          .eq('id', action.targetId);

        if (!error) {
          const target = merchants.find(m => m.id === action.targetId);
          if (target) {
            onMerchantUpdated({ ...target, plan: action.payload.plan, plan_mrr: action.payload.mrr });
          }
          setActionSuccess(`Upgraded ${finding.merchantName} to ${action.payload.plan.toUpperCase()} plan (MRR updated).`);
        }
      } else if (action.type === 'create_branch' && action.targetId) {
        // Create Main Outlet
        const { error } = await supabase
          .from('branches')
          .insert({
            merchant_id: action.targetId,
            name: action.payload.name || 'Main Outlet',
            is_active: true,
          });

        if (!error) {
          await onRefreshData();
          setActionSuccess(`Initialized default outlet for ${finding.merchantName}.`);
        }
      } else if (action.type === 'trigger_keepalive') {
        // Execute Keepalive Ping
        const timestamp = new Date().toISOString();
        const nextPing = (keepalive?.ping_count ?? 1) + 1;
        await supabase
          .from('_keepalive')
          .upsert({ id: 1, last_ping: timestamp, ping_count: nextPing });

        await onRefreshData();
        setActionSuccess('Supabase keepalive heartbeat sent successfully!');
      } else if (action.type === 'contact_owner' && action.payload?.email) {
        // Open prefilled email
        const subject = encodeURIComponent(`SnackBot Onboarding Support - ${action.payload.name}`);
        const body = encodeURIComponent(
          `Hi ${action.payload.name},\n\nWe noticed you haven't processed orders yet on SnackBot Cloud. Our customer success team is here to help you set up your menu and POS terminal.\n\nBest regards,\nSnackBot Platform Team`
        );
        window.open(`mailto:${action.payload.email}?subject=${subject}&body=${body}`, '_blank');
        setActionSuccess(`Opened support email compose for ${action.payload.email}.`);
      } else if (action.type === 'navigate' && action.payload?.tab) {
        onNavigateTab(action.payload.tab as PageTab);
      }
    } catch (err: any) {
      alert(`Remediation failed: ${err.message}`);
    } finally {
      setExecutingActionId(null);
      setTimeout(() => setActionSuccess(''), 5000);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Top Hero: Health Score & Executive Rating ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          {/* Circular Score Badge */}
          <div className="relative flex items-center justify-center shrink-0">
            <div className={cn(
              'w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-bold text-white shadow-md',
              report.overallScore >= 90 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/20' :
              report.overallScore >= 75 ? 'bg-gradient-to-br from-[#D97706] to-[#B45309] shadow-amber-500/20' :
              'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/20'
            )}>
              <span className="text-2xl tracking-tight leading-none">{report.overallScore}</span>
              <span className="text-[10px] font-bold opacity-80 uppercase mt-0.5">/ 100</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Platform Health Score</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
                report.overallScore >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                report.overallScore >= 75 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-rose-50 text-rose-700 border-rose-200'
              )}>
                Grade {report.grade}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1 tracking-tight">
              {report.overallScore >= 90 ? 'Platform is Operating Optimally' :
               report.overallScore >= 75 ? 'Platform Requires Minor Maintenance' :
               'Platform Integrity Needs Immediate Attention'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Knowledge inference engine scanned <span className="font-semibold text-slate-700">{merchants.length} restaurants</span> across 14 operational rules.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5 self-stretch sm:self-auto flex-wrap">
          <button
            onClick={() => setAiCopilotOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100/80 border border-amber-300/80 shadow-2xs transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Ask AI Copilot</span>
          </button>

          <button
            onClick={handleManualScan}
            disabled={isScanning}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isScanning && 'animate-spin')} />
            {isScanning ? 'Diagnosing…' : 'Run Full Diagnostics'}
          </button>
        </div>
      </div>

      {/* ── Sub-System Category Health Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Churn Risk', key: 'churn_risk', icon: Users, score: report.categoryScores.churn_risk },
          { label: 'Monetization', key: 'monetization', icon: DollarSign, score: report.categoryScores.monetization },
          { label: 'Operations', key: 'operational', icon: Store, score: report.categoryScores.operational },
          { label: 'System Integrity', key: 'system_integrity', icon: Zap, score: report.categoryScores.system_integrity },
          { label: 'Platform Security', key: 'security', icon: ShieldCheck, score: report.categoryScores.security },
        ].map(cat => (
          <div key={cat.key} className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">{cat.label}</span>
              <cat.icon className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-base font-bold text-slate-900">{cat.score}%</span>
              <span className={cn(
                'text-[10px] font-semibold',
                cat.score >= 90 ? 'text-emerald-600' : cat.score >= 75 ? 'text-amber-600' : 'text-rose-600'
              )}>
                {cat.score >= 90 ? 'Strong' : cat.score >= 75 ? 'Fair' : 'Attention'}
              </span>
            </div>
            <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-2">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  cat.score >= 90 ? 'bg-emerald-500' : cat.score >= 75 ? 'bg-[#D97706]' : 'bg-rose-500'
                )}
                style={{ width: `${cat.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── AI Executive Diagnosis & Strategic Levers Card ── */}
      <AIExecutiveDiagnosisCard
        report={report}
        merchants={merchants}
        superadmins={superadmins}
        keepalive={keepalive}
      />

      {/* Success Toast */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {/* ── Filter Bar & Search ── */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Severity Tabs */}
          <div className="flex rounded-lg bg-slate-100/70 p-1 gap-1 overflow-x-auto scrollbar-none">
            {[
              { id: 'all', label: 'All Issues', count: report.totalFindings },
              { id: 'critical', label: 'Critical', count: report.criticalCount },
              { id: 'high', label: 'High', count: report.highCount },
              { id: 'medium', label: 'Medium', count: report.mediumCount },
              { id: 'low', label: 'Low', count: report.lowCount },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSeverityFilter(tab.id)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-all whitespace-nowrap',
                  severityFilter === tab.id
                    ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {tab.label} <span className="opacity-60 text-[10px] ml-0.5">({tab.count})</span>
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500">
            Showing <span className="font-bold text-slate-800">{filteredFindings.length}</span> diagnostic rule findings
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-8 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 focus-within:bg-white focus-within:border-[#D97706] focus-within:ring-2 focus-within:ring-[#D97706]/10 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 outline-none"
              placeholder="Search findings by restaurant name, rule code, or description…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-xs text-slate-400 hover:text-slate-700">
                ×
              </button>
            )}
          </div>

          <div className="sm:col-span-4">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#D97706] text-slate-700 font-medium"
            >
              <option value="all">All Diagnostic Domains</option>
              <option value="churn_risk">Tenant Churn Risk</option>
              <option value="monetization">Revenue & Upsells</option>
              <option value="operational">Operational Delays</option>
              <option value="system_integrity">System & Keepalive</option>
              <option value="security">Security & Privileges</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Diagnostic Findings List ── */}
      <div className="space-y-2.5">
        {filteredFindings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white shadow-xs">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-800">Zero Rule Violations Found</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              All monitored tenant accounts, monetization thresholds, and database operations satisfy current rule policies.
            </p>
          </div>
        ) : (
          filteredFindings.map(finding => {
            const isExecuting = executingActionId === finding.action?.id;

            return (
              <div
                key={finding.id}
                className={cn(
                  'p-4 rounded-xl border bg-white shadow-xs transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4',
                  finding.severity === 'critical' ? 'border-rose-300/80 bg-rose-50/20' :
                  finding.severity === 'high'     ? 'border-amber-300/80 bg-amber-50/20' :
                  'border-slate-200 hover:border-amber-300'
                )}
              >
                {/* Finding Details */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                      finding.severity === 'critical' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                      finding.severity === 'high'     ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      finding.severity === 'medium'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    )}>
                      {finding.severity}
                    </span>

                    <span className="text-[10px] font-semibold text-slate-400 font-mono">
                      {finding.ruleCode}
                    </span>

                    {finding.merchantName && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {finding.merchantName}
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400">
                      Impact: -{finding.impactScore} pts
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 leading-tight">
                    {finding.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {finding.description}
                  </p>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <span className="font-bold text-amber-700">Recommended Action:</span>
                    <span>{finding.recommendation}</span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
                  <button
                    onClick={() => setSelectedFindingForAI(finding)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all flex items-center gap-1.5 shadow-2xs"
                    title="Generate AI Root Cause & Tailored Outreach"
                  >
                    <Bot className="w-3.5 h-3.5 text-[#D97706]" />
                    <span>AI Deep Dive</span>
                  </button>

                  {finding.action && (
                    <button
                      onClick={() => handleExecuteRemediation(finding, finding.action!)}
                      disabled={isExecuting}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5',
                        finding.severity === 'critical'
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-[#D97706] hover:bg-[#B45309] text-white'
                      )}
                    >
                      {isExecuting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Remediating…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          {finding.action.label}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* AI Finding Deep Dive Modal */}
      <AIFindingModal
        finding={selectedFindingForAI}
        merchant={merchants.find(m => m.id === selectedFindingForAI?.merchantId)}
        onClose={() => setSelectedFindingForAI(null)}
      />

      {/* AI Superadmin Copilot Drawer */}
      <AICopilotDrawer
        isOpen={aiCopilotOpen}
        onClose={() => setAiCopilotOpen(false)}
        report={report}
        merchants={merchants}
      />
    </div>
  );
}
