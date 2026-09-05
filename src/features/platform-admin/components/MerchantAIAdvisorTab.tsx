import React, { useState } from 'react';
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Mail, Phone, Copy, Check, ExternalLink } from 'lucide-react';
import { Merchant } from '../types';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../../../utils/cn';

interface MerchantAIAdvisorTabProps {
  merchant: Merchant;
}

interface AIAdvisorResult {
  healthRating: string;
  healthScore: number;
  summary: string;
  growthOpportunities: string[];
  operationalRisks: string[];
  recommendedPlanAction: string;
  outreachDraft: {
    channel: 'Email' | 'WhatsApp';
    subject?: string;
    message: string;
  };
}

export function MerchantAIAdvisorTab({ merchant }: MerchantAIAdvisorTabProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAdvisorResult | null>(null);
  const [copied, setCopied] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const apiKey = (import.meta.env as any).VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('Gemini API key missing');

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
You are the Chief Customer Success & Revenue AI Advisor for SnackBot POS Cloud in Malaysia.
Analyze this specific restaurant merchant account:

MERCHANT PROFILE:
- Restaurant Name: ${merchant.name}
- Business Category: ${merchant.business_type || 'Restaurant'}
- City: ${merchant.city || 'Malaysia'}
- Current Plan: ${merchant.plan.toUpperCase()} (MRR: RM ${merchant.plan_mrr || 99}/month)
- Status: ${merchant.plan_status}
- Branches: ${merchant.branch_count ?? 0}
- Staff Count: ${merchant.staff_count ?? 0}
- Total Orders Processed: ${merchant.order_count ?? 0}
- Total GMV: RM ${(merchant.total_gmv ?? 0).toFixed(2)}
- Owner: ${merchant.owner_name} (${merchant.owner_email || 'No email'}, Phone: ${merchant.owner_phone || 'No phone'})

TASK:
Provide a tailored merchant health and growth advisory report formatted strictly as JSON with this schema:
{
  "healthRating": "Optimal" | "Healthy" | "At Risk" | "Critical Attention",
  "healthScore": number (0 to 100),
  "summary": "2 concise sentences evaluating this merchant's operational adoption and revenue health.",
  "growthOpportunities": [
    "Growth or upsell opportunity 1",
    "Growth or upsell opportunity 2"
  ],
  "operationalRisks": [
    "Operational or churn risk 1",
    "Operational or churn risk 2"
  ],
  "recommendedPlanAction": "Clear advice on plan tier (e.g. Keep on Basic, Upgrade to Premium, or Offer Discount)",
  "outreachDraft": {
    "channel": "Email",
    "subject": "Professional email subject line",
    "message": "Friendly, consultative message ready to send to ${merchant.owner_name}."
  }
}
Return valid JSON only without markdown fences.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      let raw = response.text?.trim() || '';
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
      }
      setAnalysis(JSON.parse(raw));
    } catch (err) {
      console.warn('AI Advisor fallback triggered:', err);
      const isPending = merchant.plan_status === 'pending';
      const noOrders = (merchant.order_count ?? 0) === 0;

      setAnalysis({
        healthRating: isPending ? 'Pending Activation' : noOrders ? 'At Risk' : 'Healthy',
        healthScore: isPending ? 30 : noOrders ? 45 : 85,
        summary: `${merchant.name} is currently ${merchant.plan_status} on the ${merchant.plan.toUpperCase()} tier with ${merchant.order_count ?? 0} orders recorded.`,
        growthOpportunities: [
          merchant.plan === 'basic' && (merchant.order_count ?? 0) > 20
            ? 'Upgrade to Premium tier (+RM 200/mo) for inventory tracking and multi-branch support.'
            : 'Configure QR table ordering to boost diner ticket sizes and throughput.',
          'Add multi-station Kitchen Display System (KDS) for faster prep times.'
        ],
        operationalRisks: [
          (merchant.branch_count ?? 0) === 0 ? 'No active branches provisioned — POS terminal cannot synchronize.' : 'Ensure daily shift reconciliation is completed.',
          noOrders ? 'Zero order transactions indicates merchant hasn’t launched live yet.' : 'Monitor cashier void rates.'
        ],
        recommendedPlanAction: merchant.plan === 'basic' ? 'Evaluate for Premium upgrade once 2nd outlet opens.' : 'Retain on current tier.',
        outreachDraft: {
          channel: 'Email',
          subject: `How can we assist ${merchant.name} with your SnackBot POS setup?`,
          message: `Hi ${merchant.owner_name},\n\nI hope your restaurant operations are running smoothly!\n\nOur customer onboarding specialist noticed your SnackBot Cloud setup for ${merchant.name}. We would love to offer a complimentary 10-minute session to ensure your menu and table QR codes are fully optimized.\n\nBest regards,\nSnackBot Success Team`
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!analysis?.outreachDraft) return;
    const fullText = `${analysis.outreachDraft.subject ? `Subject: ${analysis.outreachDraft.subject}\n\n` : ''}${analysis.outreachDraft.message}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Box */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5 border border-amber-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#D97706] text-white flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              AI Tenant Health & Growth Advisor
            </h4>
            <p className="text-[11px] text-slate-500">
              Evaluate {merchant.name} against platform operational and revenue benchmarks.
            </p>
          </div>
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing…</span>
            </>
          ) : analysis ? (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-Analyze</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate AI Assessment</span>
            </>
          )}
        </button>
      </div>

      {!analysis && !loading && (
        <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
          Click "Generate AI Assessment" to generate bespoke growth recommendations, plan upsell readiness, and pre-composed owner outreach.
        </div>
      )}

      {analysis && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Health Score and Posture */}
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tenant Health Index
                </span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                  analysis.healthScore >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  analysis.healthScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-rose-50 text-rose-700 border-rose-200'
                )}>
                  {analysis.healthRating}
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-1.5 leading-relaxed font-medium">
                {analysis.summary}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col items-center justify-center shrink-0">
              <span className="text-lg font-bold text-amber-900">{analysis.healthScore}</span>
              <span className="text-[9px] font-bold text-amber-700 uppercase">/ 100</span>
            </div>
          </div>

          {/* Growth Levers & Operational Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs mb-2">
                <TrendingUp className="w-4 h-4" />
                <span>Growth & Upsell Levers</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {analysis.growthOpportunities.map((opp, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{opp}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-xs mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Operational & Retention Risks</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {analysis.operationalRisks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Plan Recommendation */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-200 text-xs">
            <span className="font-bold text-amber-900 block mb-0.5 text-[11px] uppercase tracking-wider">
              Subscription Recommendation
            </span>
            <span className="text-slate-800 font-medium">{analysis.recommendedPlanAction}</span>
          </div>

          {/* Pre-Composed Outreach Draft */}
          {analysis.outreachDraft && (
            <div className="p-3.5 rounded-xl bg-slate-900 text-white text-xs shadow-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-bold text-amber-400 text-[11px] uppercase tracking-wider">
                    Personalized Outreach to {merchant.owner_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-all"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  {merchant.owner_email && (
                    <button
                      onClick={() => {
                        const subj = encodeURIComponent(analysis.outreachDraft.subject || 'SnackBot Support');
                        const bdy = encodeURIComponent(analysis.outreachDraft.message);
                        window.open(`mailto:${merchant.owner_email}?subject=${subj}&body=${bdy}`, '_blank');
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D97706] hover:bg-[#B45309] text-white text-[11px] font-semibold transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Email
                    </button>
                  )}
                </div>
              </div>

              {analysis.outreachDraft.subject && (
                <div className="text-[11px] text-slate-400 mb-2 pb-1.5 border-b border-slate-800">
                  <strong className="text-slate-300">Subject:</strong> {analysis.outreachDraft.subject}
                </div>
              )}

              <pre className="text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                {analysis.outreachDraft.message}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
