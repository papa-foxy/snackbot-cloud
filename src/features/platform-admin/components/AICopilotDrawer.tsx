import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Send, Bot, User, RefreshCw, MessageSquare } from 'lucide-react';
import { PlatformHealthReport } from '../expert-system/types';
import { Merchant } from '../types';
import { askPlatformCopilot, AICopilotMessage } from '../expert-system/aiService';
import { cn } from '../../../utils/cn';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  report: PlatformHealthReport;
  merchants: Merchant[];
}

const QUICK_PROMPTS = [
  'Which restaurants have the highest churn risk and why?',
  'How can we increase platform MRR to RM 2,000/mo?',
  'Draft a welcome email sequence for our pending restaurants.',
  'Analyze database keepalive status and suggest improvements.',
];

export function AICopilotDrawer({ isOpen, onClose, report, merchants }: AICopilotDrawerProps) {
  const [messages, setMessages] = useState<AICopilotMessage[]>([
    {
      role: 'assistant',
      content: `Hello! I am your Platform Superadmin AI Copilot. I have analyzed your ${merchants.length} restaurants and current platform health (${report.overallScore}/100, Grade ${report.grade}). How can I assist you with platform operations, revenue optimization, or churn prevention today?`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeCount = merchants.filter(m => m.plan_status === 'active').length;
  const pendingCount = merchants.filter(m => m.plan_status === 'pending').length;
  const totalMRR = merchants
    .filter(m => m.plan_status === 'active')
    .reduce((sum, m) => sum + (m.plan_mrr || 99), 0);
  const totalGMV = merchants.reduce((sum, m) => sum + (m.total_gmv || 0), 0);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: AICopilotMessage = { role: 'user', content: textToSend };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setLoading(true);

    try {
      const reply = await askPlatformCopilot(updatedHistory, {
        overallScore: report.overallScore,
        grade: report.grade,
        totalMerchants: merchants.length,
        activeCount,
        pendingCount,
        totalMRR,
        totalGMV,
        topFindings: report.findings.slice(0, 6).map(f => `${f.title} (${f.merchantName || 'Platform'})`),
      });

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error('AI Copilot query failed:', err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an issue generating a response. Please try again.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 border-l border-slate-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-white to-amber-500/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#D97706] to-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-600/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Platform AI Copilot</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-300">
                  Gemini
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                SaaS Strategy & Operations Advisor
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Prompts Carousel / Strip */}
        <div className="p-3 bg-slate-50 border-b border-slate-100 overflow-x-auto flex gap-2 shrink-0 scrollbar-none">
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              disabled={loading}
              className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-amber-900 hover:border-amber-300 hover:bg-amber-50/50 whitespace-nowrap transition-all shadow-2xs shrink-0 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-2.5',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-amber-100 text-[#D97706] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={cn(
                  'max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-[#D97706] text-white font-medium rounded-tr-xs'
                    : 'bg-slate-50 text-slate-800 border border-slate-200/80 rounded-tl-xs'
                )}
              >
                {msg.content}
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs text-[11px] font-bold">
                  A
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D97706]" />
              <span>Copilot is analyzing platform metrics…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-100 bg-white">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Copilot about tenants, revenue, churn, or bottlenecks…"
              disabled={loading}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#D97706] focus:ring-2 focus:ring-amber-500/10 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white disabled:opacity-40 transition-all shadow-xs shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
