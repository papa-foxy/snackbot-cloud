import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, X, Send, Bot, User, RefreshCw, MessageSquare,
  ChevronDown, Minimize2, Maximize2, Compass, ExternalLink, ArrowRight
} from 'lucide-react';
import { Merchant, PageTab } from '../types';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../../../utils/cn';

interface GlobalAIChatbotProps {
  activeTab: PageTab;
  onNavigateTab: (tab: PageTab) => void;
  merchants: Merchant[];
  totalMRR: number;
  totalGMV: number;
  totalOrders: number;
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  initialPrompt?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const TAB_LABELS: Record<PageTab, string> = {
  overview: 'Dashboard Overview & Analytics',
  analytics: 'Dashboard Overview & Analytics',
  expert_system: 'Platform Doctor',
  merchants: 'Restaurants',
  admins: 'Superadmins',
  access_log: 'Access Log',
  settings: 'Settings',
};

const TAB_PROMPTS: Record<PageTab, string[]> = {
  overview: [
    'Analyze platform revenue trends and suggest growth levers.',
    'Give me a 30-second platform executive snapshot.',
    'Which restaurant business category generates the highest GMV?',
    'Compare active vs pending subscription revenue.',
  ],
  analytics: [
    'Analyze platform revenue trends and suggest growth levers.',
    'Which restaurant business category generates the highest GMV?',
    'How can we increase average order value across outlets?',
  ],
  expert_system: [
    'What is our weakest health category and why?',
    'What is the fastest way to fix critical findings?',
    'Explain how Supabase keepalive affects platform stability.',
  ],
  merchants: [
    'Which restaurants are at risk of churning due to zero orders?',
    'Which restaurants are ready for a Premium plan upgrade?',
    'How many restaurants are currently pending approval?',
  ],
  admins: [
    'Is platform superadmin redundancy sufficient?',
    'How do I invite and verify another superadmin?',
  ],
  access_log: [
    'Summarize recent merchant impersonation sessions.',
    'Are there any unusual access log patterns?',
  ],
  settings: [
    'Review platform security settings and 2FA policy.',
    'How does emergency maintenance mode impact active POS terminals?',
  ],
};

export function GlobalAIChatbot({
  activeTab,
  onNavigateTab,
  merchants,
  totalMRR,
  totalGMV,
  totalOrders,
  isOpen,
  onToggleOpen,
  initialPrompt,
}: GlobalAIChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello! I am your **Platform Superadmin AI Assistant**. I have real-time visibility across all ${merchants.length} restaurants, RM ${totalMRR}/mo in SaaS MRR, and platform operations.\n\nI see you are currently on **${TAB_LABELS[activeTab]}**. How can I help you today?`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Ctrl+J / Cmd+J to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        onToggleOpen(!isOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggleOpen]);

  // Handle external initial prompt
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      onToggleOpen(true);
      handleSendMessage(initialPrompt.trim());
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen]);

  const activeCount = merchants.filter(m => m.plan_status === 'active').length;
  const pendingCount = merchants.filter(m => m.plan_status === 'pending').length;

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: query };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    const systemPrompt = `
You are the SnackBot Platform Superadmin AI Copilot.
You assist the platform administrator managing a multi-tenant restaurant cloud platform in Malaysia.
The admin is CURRENTLY VIEWING the "${TAB_LABELS[activeTab]}" tab.

PLATFORM CONTEXT:
- Active Tab: ${TAB_LABELS[activeTab]} (id: ${activeTab})
- Total Restaurants: ${merchants.length} (${activeCount} Active, ${pendingCount} Pending)
- SaaS MRR: RM ${totalMRR}/month
- Platform GMV: RM ${totalGMV.toFixed(2)} across ${totalOrders} orders
- Available Tabs:
  * Overview: [Overview](tab:overview)
  * Analytics: [Analytics Dashboard](tab:analytics)
  * Platform Doctor: [Platform Doctor](tab:expert_system)
  * Restaurants: [Restaurants](tab:merchants)
  * Superadmins: [Superadmins](tab:admins)
  * Access Log: [Access Log](tab:access_log)
  * Settings: [Settings](tab:settings)

INSTRUCTIONS:
1. Provide sharp, executive, concise SaaS platform advice (2-4 sentences max per point).
2. When recommending that the user view a specific page or tab, include navigation link markdown in the format: [Label](tab:tabId) — e.g. [View Restaurants](tab:merchants) or [Open Analytics](tab:analytics).
3. If they ask about revenue, churn, bottlenecks, or security, synthesize real metrics.
4. Keep the tone professional, pragmatic, and helpful.
`;

    try {
      const apiKey = (import.meta.env as any).VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('Gemini API key missing');

      const ai = new GoogleGenAI({ apiKey });
      const conversation = updatedMessages
        .map(m => `${m.role === 'user' ? 'Superadmin' : 'Assistant'}: ${m.content}`)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${systemPrompt}\n\nCONVERSATION HISTORY:\n${conversation}\n\nAssistant:`,
      });

      const replyText = response.text || 'I could not generate an answer. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
    } catch (err) {
      console.warn('AI Chatbot query fallback triggered:', err);
      // Smart contextual fallback response
      let fallbackText = `**Platform Analysis for ${TAB_LABELS[activeTab]}:**\nCurrently managing ${merchants.length} restaurants (${activeCount} active, ${pendingCount} pending) generating RM ${totalMRR}/mo in SaaS MRR.`;

      if (activeTab === 'analytics') {
        fallbackText += `\n\nPlatform GMV stands at RM ${totalGMV.toFixed(2)} across ${totalOrders} orders. You can explore full transaction breakdowns or check out [Platform Doctor](tab:expert_system) for operational diagnostics.`;
      } else if (activeTab === 'merchants') {
        fallbackText += `\n\nYou have ${pendingCount} restaurants awaiting approval. You can approve them right here or review them in [Overview](tab:overview).`;
      } else {
        fallbackText += `\n\nWould you like to review [Platform Analytics](tab:analytics) or run a health check in [Platform Doctor](tab:expert_system)?`;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: fallbackText }]);
    } finally {
      setLoading(false);
    }
  };

  // Render navigation links in AI responses
  const renderMessageContent = (content: string) => {
    // Look for markdown links like [Label](tab:tabId)
    const parts = content.split(/(\[[^\]]+\]\(tab:[^)]+\))/g);

    return parts.map((part, index) => {
      const match = part.match(/\[([^\]]+)\]\(tab:([^)]+)\)/);
      if (match) {
        const label = match[1];
        const tabId = match[2] as PageTab;
        return (
          <button
            key={index}
            onClick={() => {
              onNavigateTab(tabId);
              // close or keep open
            }}
            className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold border border-amber-300 transition-all text-[11px] align-baseline shadow-2xs"
          >
            <span>{label}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        );
      }

      // Render bold markdown
      const subparts = part.split(/\*\*(.+?)\*\*/g);
      return (
        <span key={index}>
          {subparts.map((sp, j) =>
            j % 2 === 1 ? <strong key={j} className="font-bold text-slate-900">{sp}</strong> : sp
          )}
        </span>
      );
    });
  };

  return (
    <>
      {/* ── Floating Action Trigger (Bottom Right) ── */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-40">
          <button
            onClick={() => onToggleOpen(true)}
            className="group flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-tr from-[#D97706] to-amber-500 text-white shadow-xl shadow-amber-600/30 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all"
            title="Open Platform AI Chatbot (Ctrl + J)"
          >
            <div className="relative">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 border border-white" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold leading-tight flex items-center gap-1">
                Platform AI
                <span className="text-[9px] font-mono opacity-80 border border-white/40 px-1 rounded">
                  Ctrl+J
                </span>
              </div>
              <div className="text-[10px] text-amber-100 opacity-90 truncate max-w-[130px]">
                {TAB_LABELS[activeTab]}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* ── Floating Chat Window ── */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-[92vw] sm:w-[420px] h-[560px] max-h-[85vh] bg-white rounded-3xl border border-slate-200/90 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-gradient-to-r from-amber-500/10 via-white to-amber-500/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#D97706] text-white flex items-center justify-center shadow-md shadow-amber-600/20">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">Platform AI Copilot</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                    Gemini
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>Assisting on: <strong className="text-slate-600">{TAB_LABELS[activeTab]}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggleOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Minimize (Ctrl + J)"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contextual Quick Prompts */}
          <div className="px-3 py-2 bg-slate-50/70 border-b border-slate-100 overflow-x-auto flex gap-1.5 shrink-0 scrollbar-none">
            {(TAB_PROMPTS[activeTab] || TAB_PROMPTS.overview).map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                disabled={loading}
                className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-amber-900 hover:border-amber-300 hover:bg-amber-50 whitespace-nowrap transition-all shadow-2xs shrink-0 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Message Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex gap-2.5',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-amber-100 text-[#D97706] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl p-3 leading-relaxed shadow-2xs whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-[#D97706] text-white font-medium rounded-tr-xs'
                      : 'bg-slate-50 text-slate-800 border border-slate-200/80 rounded-tl-xs'
                  )}
                >
                  {renderMessageContent(msg.content)}
                </div>

                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold shadow-2xs">
                    SA
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D97706]" />
                <span>AI is analyzing across {merchants.length} restaurants…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-slate-100 bg-white">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={`Ask AI about ${TAB_LABELS[activeTab]} or platform…`}
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
      )}
    </>
  );
}
