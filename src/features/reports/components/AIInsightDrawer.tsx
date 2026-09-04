import React, { useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { DateRange, ActiveFilter } from '../types';

export function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  const inlineFormat = (line: string): React.ReactNode => {
    const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (/^\*\*(.+)\*\*$/.test(part) || /^__(.+)__$/.test(part))
        return <strong key={idx} className="font-semibold text-gray-900 dark:text-neutral-100">{part.replace(/^\*\*|\*\*$|^__|__$/g, '')}</strong>;
      if (/^`(.+)`$/.test(part))
        return <code key={idx} className="px-1 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
      return part;
    });
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '' || line.trim() === '---') { nodes.push(<div key={i} className="h-2" />); i++; continue; }

    if (/^###\s+/.test(line)) {
      nodes.push(<h3 key={i} className="text-sm font-bold text-indigo-700 dark:text-indigo-400 mt-3 mb-1">{inlineFormat(line.replace(/^###\s+/, ''))}</h3>);
      i++; continue;
    }
    if (/^####\s+/.test(line)) {
      nodes.push(<h4 key={i} className="text-xs font-bold text-gray-800 dark:text-neutral-200 mt-2 mb-0.5">{inlineFormat(line.replace(/^####\s+/, ''))}</h4>);
      i++; continue;
    }
    if (/^##\s+/.test(line)) {
      nodes.push(<h2 key={i} className="text-base font-bold text-gray-900 dark:text-neutral-100 mt-3 mb-1">{inlineFormat(line.replace(/^##\s+/, ''))}</h2>);
      i++; continue;
    }
    if (/^#\s+/.test(line)) {
      nodes.push(<h1 key={i} className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-3 mb-1">{inlineFormat(line.replace(/^#\s+/, ''))}</h1>);
      i++; continue;
    }
    if (/^[\*\-]\s+/.test(line)) {
      nodes.push(
        <div key={i} className="flex gap-2 items-start text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
          <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
          <span>{inlineFormat(line.replace(/^[\*\-]\s+/, ''))}</span>
        </div>
      );
      i++; continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      nodes.push(
        <div key={i} className="flex gap-2 items-start text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
          <span className="text-indigo-500 font-semibold shrink-0 w-4">{num}.</span>
          <span>{inlineFormat(line.replace(/^\d+\.\s+/, ''))}</span>
        </div>
      );
      i++; continue;
    }
    nodes.push(<p key={i} className="text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">{inlineFormat(line)}</p>);
    i++;
  }

  return nodes;
}

interface AIInsightDrawerProps {
  show: boolean;
  onClose: () => void;
  dateRange: DateRange;
  activeFilters: ActiveFilter[];
  loading: boolean;
  totalSales: number;
  netSales: number;
  grossSales: number;
  totalOrders: number;
  aov: number;
  totalDiscount: number;
  refundCount: number;
  topItems: any[];
  categoryData: any[];
  paymentData: any[];
  staffData: any[];
}

export function AIInsightDrawer({
  show,
  onClose,
  dateRange,
  activeFilters,
  loading,
  totalSales,
  netSales,
  grossSales,
  totalOrders,
  aov,
  totalDiscount,
  refundCount,
  topItems,
  categoryData,
  paymentData,
  staffData
}: AIInsightDrawerProps) {
  const [aiInsight, setAiInsight]       = useState('');
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiUserPrompt, setAiUserPrompt] = useState('');
  const [aiError, setAiError]           = useState(false);
  const [aiErrorMessage, setAiErrorMessage] = useState<string | null>(null);

  const generateInsight = async () => {
    setAiLoading(true); setAiError(false); setAiErrorMessage(null); setAiInsight('');
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');

      const ctx = {
        period:        dateRange.label,
        totalSales:    totalSales.toFixed(2),
        netSales:      netSales.toFixed(2),
        grossSales:    grossSales.toFixed(2),
        totalOrders,
        aov:           aov.toFixed(2),
        totalDiscount: totalDiscount.toFixed(2),
        refundCount,
        topItems:      topItems.slice(0, 5),
        categoryData,
        paymentData,
        staffData:     staffData.slice(0, 5),
      };

      const prompt = `You are a restaurant business analyst. Analyze this POS data for ${ctx.period}.
Important: This is a Malaysian restaurant. Always use RM (Ringgit Malaysia) as the currency symbol, never use $ or USD.
${aiUserPrompt
  ? `The user specifically wants to know: "${aiUserPrompt}"\nFocus your analysis on answering this question, then add any critical insights.`
  : 'Give a concise 3-sentence performance summary and 3 specific actionable recommendations.'}
Be direct and data-driven.

Data: ${JSON.stringify(ctx)}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errMsg  = errBody?.error?.message || `HTTP ${res.status}`;
        throw new Error(res.status === 429 ? 'AI quota exceeded. Please try again later.' : errMsg);
      }

      const data = await res.json();
      const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const text = raw.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
      setAiInsight(text || 'No insight generated.');

    } catch (err: any) {
      console.error('Failed to generate AI insights:', err);
      const isQuota = err?.status === 429 || err?.statusCode === 429 ||
        String(err).includes('429') || String(err).toLowerCase().includes('quota') || String(err).toLowerCase().includes('resourceexhausted');
      const msg = isQuota ? 'AI quota exceeded. Please try again later.' : (err?.message || 'Unknown error');
      setAiError(true);
      setAiErrorMessage(msg);
      setAiInsight(msg);
    } finally {
      setAiLoading(false);
    }
  };

  if (!show) return null;
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-xl border border-indigo-100 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-sm shrink-0"><Sparkles className="w-5 h-5 text-indigo-600" /></div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">AI Sales Insights</h3>
            <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mb-2">
            {activeFilters.length > 0 ? `Filtered: ${activeFilters.map(f => f.label).join(', ')} · ` : ''}{dateRange.label}
          </p>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1">
              What would you like to know? <span className="font-normal text-gray-400 dark:text-neutral-500">(optional)</span>
            </label>
            <textarea value={aiUserPrompt} onChange={e => setAiUserPrompt(e.target.value)}
              placeholder="e.g. Why did sales drop on Tuesday? Which items should I promote? How can I improve AOV?"
              rows={2}
              className="w-full px-3 py-2 text-xs border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-[var(--sb-card)] placeholder-gray-400 resize-none" />
          </div>
          {aiInsight
            ? <div className={cn(aiError ? 'text-red-600' : '', 'mb-3 space-y-1')}>
                {aiError ? <p className="text-sm text-red-600">{aiInsight}</p> : renderMarkdown(aiInsight)}
              </div>
            : <p className="text-gray-500 dark:text-neutral-500 text-sm mb-3">Generate AI-powered insights based on your current report data.</p>}
          {aiErrorMessage && <p className="text-xs text-red-500 mt-1">{aiErrorMessage}</p>}
          <button onClick={generateInsight} disabled={aiLoading || loading}
            className="mt-3 flex items-center px-4 py-2 bg-white dark:bg-[var(--sb-card)] border border-indigo-200 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-50">
            {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {aiLoading ? 'Analyzing...' : aiInsight ? 'Regenerate' : 'Generate Insights'}
          </button>
        </div>
      </div>
    </div>
  );
}
