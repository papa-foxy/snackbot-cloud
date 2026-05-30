import React, { useState, useRef, useEffect } from 'react';
import {
  Bot, Send, Lightbulb, ArrowRight, X, Sparkles,
  LayoutDashboard, BarChart3, MenuSquare, Package, GitBranch,
  Armchair, Users, Ticket, Gift, Receipt, FileText,
  Cloud, ShieldAlert, Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { SECTIONS, colorMap } from './Settings';  // for settings section chips
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

interface AIMessage {
  role: 'user' | 'assistant';
  text: string;
  suggestions?: Suggestion[];
}

// A suggestion can navigate to a settings section OR a top-level app page
interface Suggestion {
  label: string;
  type: 'section' | 'page';
  id: string; // sectionId for settings, tabId for pages
}

// ── App pages map (matches Sidebar.tsx tab IDs exactly) ──────────────────────

const APP_PAGES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  dashboard:  { label: 'Dashboard',        icon: LayoutDashboard, color: 'indigo' },
  reports:    { label: 'Sales Reports',     icon: BarChart3,       color: 'blue'   },
  menu:       { label: 'Menu Management',   icon: MenuSquare,      color: 'violet' },
  inventory:  { label: 'Inventory',         icon: Package,         color: 'amber'  },
  branches:   { label: 'Branch Management', icon: GitBranch,       color: 'teal'   },
  tables_qr:  { label: 'Tables & QR',       icon: Armchair,        color: 'cyan'   },
  users:      { label: 'Staff & Users',     icon: Users,           color: 'pink'   },
  promotions: { label: 'Promotions',        icon: Ticket,          color: 'orange' },
  loyalty:    { label: 'Loyalty & Rewards', icon: Gift,            color: 'rose'   },
  tax:        { label: 'Tax Management',    icon: Receipt,         color: 'green'  },
  lhdn:       { label: 'LHDN E-Invoice',    icon: FileText,        color: 'lime'   },
  cloud_sync: { label: 'Cloud Sync',        icon: Cloud,           color: 'sky'    },
  audit:      { label: 'Audit Logs',        icon: ShieldAlert,     color: 'red'    },
  settings:   { label: 'Settings',          icon: SettingsIcon,    color: 'gray'   },
};

// Tailwind color classes for page chips (can't be dynamic in Tailwind)
const PAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  blue:   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'   },
  violet: { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  amber:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'  },
  teal:   { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200'   },
  cyan:   { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200'   },
  pink:   { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200'   },
  orange: { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  rose:   { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'   },
  green:  { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200'  },
  lime:   { bg: 'bg-lime-50',    text: 'text-lime-700',    border: 'border-lime-200'   },
  sky:    { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200'    },
  red:    { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200'    },
  gray:   { bg: 'bg-gray-50 dark:bg-neutral-800/50',    text: 'text-gray-700 dark:text-neutral-300',    border: 'border-gray-200 dark:border-[var(--sb-border)]'   },
};

// ── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  'How do I set up e-Invoice for LHDN?',
  'Where can I limit cashier discounts?',
  'How to add a new menu item?',
  'How do I add a new branch?',
  'Where do I change the receipt language?',
  'How to set up loyalty points?',
];

// ── AI system knowledge ──────────────────────────────────────────────────────

const SYSTEM_KNOWLEDGE = `
You are a helpful assistant for SnackBot POS — a Malaysian restaurant point-of-sale system.
You help users find the right page or setting and explain how things work.

THE APP HAS THESE MAIN PAGES (use page navigation links for these):
- Dashboard [page:dashboard] — daily sales overview, live orders, quick stats
- Sales Reports [page:reports] — revenue charts, order history, export data
- Menu Management [page:menu] — add/edit menu items, categories, variants, addons, pricing
- Inventory [page:inventory] — stock levels, low stock alerts, ingredient tracking
- Branch Management [page:branches] — add/manage outlet locations, branch codes, KDS stations
- Tables & QR [page:tables_qr] — table layout, QR code ordering setup
- Staff & Users [page:users] — invite staff, assign roles, manage permissions
- Promotions [page:promotions] — promo codes, discounts, buy-X-get-Y deals
- Loyalty & Rewards [page:loyalty] — loyalty points program, tiers, redemption
- Tax Management [page:tax] — tax configs, SST, per-category tax rules
- LHDN E-Invoice [page:lhdn] — Malaysian MyInvois API setup, e-invoice submission
- Cloud Sync [page:cloud_sync] — sync frequency, offline mode, backup & restore
- Audit Logs [page:audit] — activity history, security events
- Settings [page:settings] — all system configuration (see sections below)

THE SETTINGS PAGE HAS THESE SECTIONS (use section navigation links for these):
- General [section:general]: Business name, SSM number, TIN, SST number, contact, currency (MYR/SGD/USD), timezone, address, logo upload, receipt header/footer, show logo/tax/QR on receipt, auto-print.
- Branch / Outlet [section:branch]: Add/manage branches, branch code, tax rate per branch, operating hours, table grid layout.
- Users & Roles [section:users]: Role permissions matrix (Manager, Supervisor, Cashier, Waiter), login method (PIN/password), max discount limit, shift auto clock-in/out.
- Payment [section:payment]: Enable/disable Cash, Card, E-Wallet (TnG/GrabPay), DuitNow. Malaysia 5-sen rounding rule. Split bill. Partial payment.
- Tax & Compliance [section:tax]: LHDN MyInvois API — environment, client ID/secret. Auto e-Invoice, SST rate (6%), invoice number format.
- Menu Behaviour [section:menu]: Allow negative stock, auto-hide out-of-stock, price override, scheduled items, require modifier.
- Table Management [section:table]: Table merging, transfer, auto-release idle tables, QR ordering, auto-close after payment.
- Inventory [section:inventory]: Low stock alert threshold, auto stock deduction, ingredient-level tracking.
- Dashboard & Reports [section:dashboard]: Default date range, chart type, layout mode, advanced analytics.
- Notifications [section:notifications]: Low stock popup, unpaid order alert, VIP alert, daily sales summary email.
- Cloud & Sync [section:cloud]: Sync frequency (real-time/5min/manual), conflict resolution, offline mode, export, backup.
- Loyalty & Promos [section:loyalty]: Enable loyalty program, points per RM, points expiry, promo codes.
- Security [section:security]: Session timeout, audit log retention, 2FA for managers, IP restriction.
- Appearance & UI [section:appearance]: Theme (light/dark/system), table view, density, language (EN/BM/CN/Tamil).

NAVIGATION LINK FORMAT:
- For app pages: [Label](page:tabId) — e.g. [Menu Management](page:menu)
- For settings sections: [Label](section:sectionId) — e.g. [Tax & Compliance](section:tax)

RULES:
1. Be concise and practical — 2-4 sentences max unless the user asks for detail.
2. Always include at least one navigation link when referring to a page or section.
3. Mention warnings or tips where relevant.
4. Respond in a friendly tone. This is a Malaysian F&B business context.
5. If the user asks something unrelated to the POS system, politely redirect them.
`;

// ── Parse AI response for navigation links ───────────────────────────────────

function parseAIResponse(text: string): { cleanText: string; suggestions: Suggestion[] } {
  const suggestions: Suggestion[] = [];

  const cleanText = text.replace(/\[([^\]]+)\]\((page|section):([^)]+)\)/g, (_, label, type, id) => {
    if (type === 'page' && APP_PAGES[id]) {
      suggestions.push({ label, type: 'page', id });
    } else if (type === 'section' && SECTIONS.find(s => s.id === id)) {
      suggestions.push({ label, type: 'section', id });
    }
    return `**${label}**`;
  });

  // Deduplicate suggestions by id
  const seen = new Set<string>();
  const unique = suggestions.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  return { cleanText, suggestions: unique };
}

// ── Simple markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i, arr) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return (
      <span key={i}>
        {parts.map((p, j) =>
          j % 2 === 1
            ? <strong key={j} className="font-semibold text-gray-900 dark:text-neutral-100">{p}</strong>
            : p
        )}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

// ── Component ────────────────────────────────────────────────────────────────

interface AIAssistantProps {
  onNavigate?: (sectionId: string) => void;   // settings section navigation
  onNavigatePage?: (tabId: string) => void;   // ✅ NEW: app page navigation via setActiveTab
}

export function AIAssistant({ onNavigate, onNavigatePage }: AIAssistantProps) {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulsing, setPulsing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const getActiveMerchantId = () => {
    try {
      return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null;
    } catch {
      return null;
    }
  };
  const writeAiAudit = async (action: string, metadata: Record<string, any>) => {
    const merchantId = getActiveMerchantId();
    if (!merchantId) return;
    try {
      await supabase.from('audit_logs').insert({
        action,
        user_name: 'System',
        target_name: 'AIAssistant',
        metadata,
        merchant_id: merchantId,
      });
    } catch {
      // non-critical
    }
  };

  useEffect(() => { if (open) setPulsing(false); }, [open]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open]);

  // ── Handle a suggestion chip click ─────────────────────────────────────
  const handleSuggestionClick = (s: Suggestion) => {
    if (s.type === 'page') {
      onNavigatePage?.(s.id);   // navigate to app tab
      setOpen(false);
    } else {
      onNavigate?.(s.id);       // scroll to settings section
      setOpen(false);
    }
  };

  // ── Send message ────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: AIMessage = { role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n');

      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${history}\nAssistant:`,
        config: { systemInstruction: SYSTEM_KNOWLEDGE },
      });
      await writeAiAudit('ai_assistant_prompt_sent', { prompt: userMsg.text.slice(0, 300) });

      const rawText = response.text || 'Sorry, I could not get a response. Please try again.';
      const { cleanText, suggestions } = parseAIResponse(rawText);
      setMessages(prev => [...prev, { role: 'assistant', text: cleanText, suggestions }]);
    } catch (err) {
      console.error(err);
      await writeAiAudit('ai_assistant_prompt_failed', { prompt: userMsg.text.slice(0, 300) });
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Something went wrong. Please check your connection and try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Render suggestion chip ──────────────────────────────────────────────
  const renderChip = (s: Suggestion, j: number) => {
    if (s.type === 'page') {
      const page = APP_PAGES[s.id];
      if (!page) return null;
      const c = PAGE_COLORS[page.color] ?? PAGE_COLORS.gray;
      const Icon = page.icon;
      return (
        <button
          key={j}
          onClick={() => handleSuggestionClick(s)}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:scale-105',
            c.bg, c.text, c.border
          )}
        >
          <Icon className="w-3 h-3" />
          {s.label}
          <ArrowRight className="w-2.5 h-2.5 opacity-60" />
        </button>
      );
    } else {
      // Settings section chip — use existing colorMap
      const section = SECTIONS.find(sec => sec.id === s.id);
      if (!section) return null;
      const c = colorMap[section.color];
      const Icon = section.icon;
      return (
        <button
          key={j}
          onClick={() => handleSuggestionClick(s)}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:scale-105',
            c.bg, c.text, c.border
          )}
        >
          <Icon className="w-3 h-3" />
          {s.label}
          <ArrowRight className="w-2.5 h-2.5 opacity-60" />
        </button>
      );
    }
  };

  // ── JSX ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl transition-all duration-300',
          'bg-indigo-600 hover:bg-indigo-700 text-white',
          pulsing && 'animate-pulse',
          open && 'opacity-0 pointer-events-none scale-90'
        )}
        title="Ask AI"
      >
        <div className="relative">
          <Bot className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-indigo-600" />
        </div>
        <span className="text-sm font-semibold whitespace-nowrap">Ask AI</span>
        <Sparkles className="w-3.5 h-3.5 opacity-75" />
      </button>

      {/* Slide-in panel */}
      <div className={cn(
        'fixed bottom-0 right-0 z-50 flex flex-col bg-white dark:bg-[var(--sb-card)] border-l border-t border-gray-200 dark:border-[var(--sb-border)] shadow-2xl transition-all duration-300 ease-in-out',
        'w-full sm:w-[400px] rounded-tl-2xl',
        open ? 'h-[600px] opacity-100 translate-y-0' : 'h-0 opacity-0 translate-y-4 pointer-events-none'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gradient-to-r from-indigo-600 to-violet-600 rounded-tl-2xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">SnackBot Assistant</p>
              <p className="text-xs text-indigo-200 leading-tight">Ask anything — I'll take you there</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-neutral-800/50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                  <p className="text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
                    Hi! Ask me anything about your POS system — I can help you find pages, configure settings, and explain how features work.
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3 h-3" /> Suggestions
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTED_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(p)}
                      className="text-left text-sm text-gray-600 dark:text-neutral-400 px-3 py-2 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all flex items-center gap-2 group"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 shrink-0 transition-colors" />
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                </div>
              )}
              <div className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-gray-50 dark:bg-neutral-800/50 text-gray-700 dark:text-neutral-300 rounded-tl-sm'
              )}>
                {msg.role === 'assistant' ? renderMarkdown(msg.text) : msg.text}

                {/* Navigation chips */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {msg.suggestions.map((s, j) => renderChip(s, j))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-gray-100 dark:border-[var(--sb-border)] shrink-0">
          <div className="flex items-end gap-2 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about any page or setting…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-800 dark:text-neutral-200 placeholder-gray-400 resize-none focus:outline-none leading-relaxed max-h-28"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all mb-0.5',
                input.trim() && !loading
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-gray-200 text-gray-400 dark:text-neutral-500 cursor-not-allowed'
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}