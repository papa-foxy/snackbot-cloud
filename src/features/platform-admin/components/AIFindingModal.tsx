import React, { useState, useEffect } from 'react';
import { X, Sparkles, Copy, Check, Mail, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { DiagnosticFinding } from '../expert-system/types';
import { Merchant } from '../types';
import { generateFindingDeepDive, AIFindingDeepDiveResult } from '../expert-system/aiService';

interface AIFindingModalProps {
  finding: DiagnosticFinding | null;
  merchant?: Merchant;
  onClose: () => void;
}

export function AIFindingModal({ finding, merchant, onClose }: AIFindingModalProps) {
  const [loading, setLoading] = useState(true);
  const [deepDive, setDeepDive] = useState<AIFindingDeepDiveResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!finding) return;
    let isMounted = true;
    setLoading(true);
    setDeepDive(null);

    generateFindingDeepDive(finding, merchant)
      .then(res => {
        if (isMounted) setDeepDive(res);
      })
      .catch(err => {
        console.error('Failed to generate finding deep dive:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [finding, merchant]);

  if (!finding) return null;

  const handleCopyOutreach = () => {
    if (!deepDive?.outreachTemplate) return;
    const textToCopy = `${deepDive.outreachTemplate.subject ? `Subject: ${deepDive.outreachTemplate.subject}\n\n` : ''}${deepDive.outreachTemplate.body}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenEmail = () => {
    if (!merchant?.owner_email || !deepDive?.outreachTemplate) return;
    const subject = encodeURIComponent(deepDive.outreachTemplate.subject || `SnackBot Support: ${finding.title}`);
    const body = encodeURIComponent(deepDive.outreachTemplate.body);
    window.open(`mailto:${merchant.owner_email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-white to-amber-500/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D97706] text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                  AI Deep Dive & Outreach
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md font-mono bg-slate-100 text-slate-600 border border-slate-200">
                  {finding.ruleCode}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                {finding.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Target Merchant Reference */}
          {finding.merchantName && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Target Restaurant:</span>{' '}
                <strong className="text-slate-800">{finding.merchantName}</strong>
              </div>
              {merchant?.owner_email && (
                <span className="text-slate-500 font-mono text-[11px]">{merchant.owner_email}</span>
              )}
            </div>
          )}

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-[#D97706]" />
              <span className="text-xs font-medium">Generating technical root cause & outreach draft…</span>
            </div>
          )}

          {deepDive && (
            <>
              {/* Root Cause & Impact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/60 text-xs">
                  <span className="font-bold text-amber-900 block mb-1 text-[11px] uppercase tracking-wider">
                    Root Cause Analysis
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {deepDive.rootCause}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/60 text-xs">
                  <span className="font-bold text-rose-900 block mb-1 text-[11px] uppercase tracking-wider">
                    Business & Platform Impact
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {deepDive.businessImpact}
                  </p>
                </div>
              </div>

              {/* Recommended Action Steps */}
              {deepDive.suggestedSteps?.length > 0 && (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs">
                  <span className="font-bold text-slate-900 block mb-2 text-[11px] uppercase tracking-wider">
                    Recommended Resolution Protocol
                  </span>
                  <ul className="space-y-1.5 text-slate-600">
                    {deepDive.suggestedSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Personalized Outreach Template */}
              {deepDive.outreachTemplate && (
                <div className="p-3.5 rounded-xl bg-slate-900 text-white text-xs shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-bold text-amber-400 text-[11px] uppercase tracking-wider">
                        Tailored Outreach Draft
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyOutreach}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-all"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy Draft'}
                      </button>
                      {merchant?.owner_email && (
                        <button
                          onClick={handleOpenEmail}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D97706] hover:bg-[#B45309] text-white text-[11px] font-semibold transition-all shadow-xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Compose Email
                        </button>
                      )}
                    </div>
                  </div>

                  {deepDive.outreachTemplate.subject && (
                    <div className="text-[11px] text-slate-400 mb-2 pb-1.5 border-b border-slate-800">
                      <strong className="text-slate-300">Subject:</strong> {deepDive.outreachTemplate.subject}
                    </div>
                  )}

                  <pre className="text-xs text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">
                    {deepDive.outreachTemplate.body}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
