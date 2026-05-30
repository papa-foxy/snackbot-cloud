// ============================================================================
// SettingsAll.tsx — All Settings components combined into a single file
// Includes: types, constants, primitives, helpers, section components,
//           sidebar, search bar, AI assistant, and main Settings component
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings2, GitBranch, Users, CreditCard, FileText, UtensilsCrossed,
  LayoutGrid, Package, BarChart3, Bell, Cloud, Gift, Shield, Palette,
  ChevronDown, ChevronUp, Search, AlertTriangle, Info, Save,
  Camera, Upload, Loader2, Plus, Trash2, GripVertical, Check, X,
  Edit2, Eye, EyeOff, Download, Database, RefreshCw, CheckCircle2,
  Sun, Moon, Monitor, Sparkles, ExternalLink, LayoutDashboard,
  Bot, Send, Lightbulb, ArrowRight, Key, Terminal, ShieldCheck, Copy,
  Utensils, ShoppingCart,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/cn';
import { useSettings } from '../contexts/SettingsContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { useTranslation } from '../contexts/TranslationContext';

// ============================================================================
// TYPES
// ============================================================================

export interface SettingSection {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  badge?: string;
  description: string;
}

export interface ToggleState {
  showLogo: boolean;
  showTax: boolean;
  showQr: boolean;
  autoPrint: boolean;
  eInvoiceAuto: boolean;
  autoConsolidate: boolean;
  negativeStock: boolean;
  hideOutOfStock: boolean;
  priceOverride: boolean;
  scheduledItems: boolean;
  modifierRequired: boolean;
  tableMerge: boolean;
  tableTransfer: boolean;
  autoRelease: boolean;
  qrOrdering: boolean;
  autoClose: boolean;
  lowStockAlert: boolean;
  autoDeduction: boolean;
  ingredientTracking: boolean;
  advancedAnalytics: boolean;
  lowStockNotif: boolean;
  unpaidAlert: boolean;
  vipAlert: boolean;
  scheduledAlert: boolean;
  emailSummary: boolean;
  offlineMode: boolean;
  loyaltyEnable: boolean;
  promoCode: boolean;
  twoFactor: boolean;
  ipRestriction: boolean;
  darkMode: boolean;
  splitBill: boolean;
  partialPayment: boolean;
  taxInclusive: boolean;
  sidebarLabels: boolean;
  highContrast: boolean;
}

export interface SectionProps {
  toggles: ToggleState;
  setToggle: (key: keyof ToggleState) => (v: boolean) => void;
  searchQuery: string;
  forceOpen: boolean;
  onToggle: () => void;
  merchantId: string;
  onNavigatePage?: (tab: string) => void;
}


// ============================================================================
// MERCHANT ID HELPER — used by all sections for RLS-compliant upserts
// ============================================================================

function getMerchantId(): string {
  try {
    return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? '';
  } catch { return ''; }
}

function getUpdatedBy(): string | null {
  try {
    return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.id ?? null;
  } catch { return null; }
}



// ============================================================================
// CONSTANTS
// ============================================================================

export const SECTIONS: SettingSection[] = [
  { id: 'general', label: 'General', icon: Settings2, color: 'indigo', description: 'Business info, receipt, currency' },
  { id: 'branch', label: 'Branch / Outlet', icon: GitBranch, color: 'blue', description: 'Multi-branch, devices, tables' },
  { id: 'devices', label: 'POS Devices', icon: Monitor, color: 'blue', description: 'POS terminal setup codes per branch' },
  { id: 'users', label: 'Users & Roles', icon: Users, color: 'violet', description: 'Permissions, PIN, shift rules' },
  { id: 'payment', label: 'Payment', icon: CreditCard, color: 'emerald', description: 'Methods, rounding, split bill' },
  { id: 'tax', label: 'Tax & Compliance', icon: FileText, color: 'amber', badge: 'LHDN', description: 'SST, e-Invoice, numbering' },
  { id: 'menu', label: 'Menu Behaviour', icon: UtensilsCrossed, color: 'orange', description: 'Stock rules, overrides, modifiers' },
  { id: 'table', label: 'Table Management', icon: LayoutGrid, color: 'cyan', description: 'Merge, transfer, QR ordering' },
  { id: 'inventory', label: 'Inventory', icon: Package, color: 'teal', description: 'Alerts, deduction, tracking' },
  { id: 'dashboard', label: 'Dashboard & Reports', icon: BarChart3, color: 'indigo', description: 'Metrics, charts, layout prefs' },
  { id: 'notification', label: 'Notifications', icon: Bell, color: 'rose', description: 'Alerts, email summaries' },
  { id: 'cloud', label: 'Cloud & Sync', icon: Cloud, color: 'sky', description: 'Sync, offline, backup, API' },
  { id: 'loyalty', label: 'Loyalty & Promos', icon: Gift, color: 'pink', description: 'Points, promo codes, expiry' },
  { id: 'security', label: 'Security', icon: Shield, color: 'slate', description: '2FA, session, audit logs' },
  { id: 'appearance', label: 'Appearance & UI', icon: Palette, color: 'purple', description: 'Theme, layout, language' },
];

export const colorMap: Record<string, {
  bg: string; text: string; border: string; light: string; active: string; dot: string;
}> = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', light: 'bg-indigo-100', active: 'bg-indigo-600 text-white', dot: 'bg-indigo-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', light: 'bg-blue-100', active: 'bg-blue-600 text-white', dot: 'bg-blue-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', light: 'bg-violet-100', active: 'bg-violet-600 text-white', dot: 'bg-violet-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', light: 'bg-emerald-100', active: 'bg-emerald-600 text-white', dot: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', light: 'bg-amber-100', active: 'bg-amber-500 text-white', dot: 'bg-amber-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', light: 'bg-orange-100', active: 'bg-orange-500 text-white', dot: 'bg-orange-500' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', light: 'bg-cyan-100', active: 'bg-cyan-600 text-white', dot: 'bg-cyan-500' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', light: 'bg-teal-100', active: 'bg-teal-600 text-white', dot: 'bg-teal-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', light: 'bg-rose-100', active: 'bg-rose-600 text-white', dot: 'bg-rose-500' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', light: 'bg-sky-100', active: 'bg-sky-600 text-white', dot: 'bg-sky-500' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200', light: 'bg-pink-100', active: 'bg-pink-600 text-white', dot: 'bg-pink-500' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', light: 'bg-slate-100', active: 'bg-slate-700 text-white', dot: 'bg-slate-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', light: 'bg-purple-100', active: 'bg-purple-600 text-white', dot: 'bg-purple-500' },
};

export const SECTION_SNIPPETS: Record<string, string[]> = {
  general: ['Business Name', 'SSM Registration Number', 'Tax Identification Number', 'SST Registration Number', 'Contact Number', 'Currency', 'Time Zone', 'Address', 'Receipt Header Text', 'Receipt Footer Text', 'Show Logo on Receipt', 'Show Tax Breakdown', 'Show QR Code on Receipt', 'Auto-Print After Payment', 'Logo', 'Upload Logo'],
  branch: ['Branch Code', 'Default Tax Rate', 'Operating Hours', 'Table Layout Configuration', 'Add Branch', 'KL Main Branch', 'PJ Outlet'],
  devices: ['POS Setup Code', 'Activation Code', 'First Time Setup', 'POS Terminal', 'Generate Code', 'Revoke Code', 'Branch Code', 'pos_code', 'Pair Device', 'Reset Code'],
  users: ['Apply Discount', 'Void Order', 'Reopen Bill', 'Edit Table', 'View Reports', 'Override Price', 'Login Method', 'Max Discount Limit', 'Shift Auto Clock-In', 'Role Permissions', 'Manager', 'Supervisor', 'Cashier', 'Waiter'],
  payment: ['Cash', 'Card', 'E-Wallet', 'Online Transfer', 'Default Payment Method', 'Rounding Rule', 'Split Bill', 'Partial Payment', '5 sen rounding', 'Pay Before Eating', 'Pay After Eating', 'Payment Timing', 'Counter Service', 'Dine In', 'Bill Flow'],
  tax: ['LHDN', 'Client ID', 'Client Secret', 'Environment', 'SST Rate', 'Invoice Number Format', 'Credit Note', 'Refund Number', 'Tax Inclusive Pricing', 'Auto E-Invoice Submission', 'Auto-Consolidate Daily', 'Consolidation Time', 'MyInvois'],
  menu: ['Allow Negative Stock', 'Auto-Hide Out-of-Stock', 'Allow Price Override', 'Enable Scheduled Items', 'Require Modifier Selection'],
  table: ['Enable Table Merging', 'Enable Table Transfer', 'Auto-Release Idle Tables', 'Enable QR Code Ordering', 'Auto-Close Table After Payment', 'Default Dining Duration'],
  inventory: ['Low Stock Alert', 'Auto Stock Deduction', 'Ingredient-Level Tracking', 'Low Stock Threshold', 'Supplier'],
  dashboard: ['Default Date Range', 'Default Chart Type', 'Layout Mode', 'Enable Advanced Analytics'],
  notification: ['Low Stock Alert', 'Unpaid Order Alert', 'VIP Customer Alert', 'Scheduled Item Activation', 'Daily Sales Summary Email', 'Summary Email Address'],
  cloud: ['Sync Frequency', 'Conflict Resolution', 'Offline Mode', 'Export All Data', 'Backup Now', 'Restore from Backup'],
  loyalty: ['Enable Loyalty Program', 'Points per RM Spent', 'Points Expiry', 'Enable Promo Codes', 'Scheduled Promotions'],
  security: ['Session Timeout', 'Audit Log Retention', 'Two-Factor Authentication', 'IP Restriction'],
  appearance: ['Theme', 'Light', 'Dark', 'System', 'Table View Style', 'Density', 'Language', 'System Language', 'Google Gemini AI'],
};

// ============================================================================
// PRIMITIVES
// ============================================================================

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1',
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[var(--sb-card)] shadow transition-transform',
        checked ? 'translate-x-6' : 'translate-x-1'
      )} />
    </button>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
        props.className
      )}
    />
  );
}

function SelectField({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-[var(--sb-card)]',
        props.className
      )}
    >
      {children}
    </select>
  );
}

function InfoBox({
  children,
  color = 'blue',
}: {
  children: React.ReactNode;
  color?: 'blue' | 'amber' | 'rose' | 'emerald';
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };
  return (
    <div className={cn('p-3.5 rounded-lg text-sm border flex gap-2', styles[color])}>
      <Info className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

// ============================================================================
// SEARCH HELPERS
// ============================================================================

function hasMatch(text: string, q: string): boolean {
  return !!q && text.toLowerCase().includes(q.toLowerCase());
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100 rounded-sm px-0.5 not-italic font-inherit">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function HField({
  label,
  description,
  children,
  searchQuery,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  searchQuery?: string;
}) {
  const q = searchQuery || '';
  return (
    <div>
      <label className={cn(
        'block text-sm font-medium mb-1',
        hasMatch(label, q) ? 'text-yellow-800 dark:text-yellow-300' : 'text-gray-700 dark:text-neutral-300 dark:text-gray-300'
      )}>
        {q ? <Highlight text={label} query={q} /> : label}
      </label>
      {description && (
        <p className="text-xs text-gray-500 dark:text-neutral-500 dark:text-gray-400 dark:text-neutral-500 mb-1.5">
          {q ? <Highlight text={description} query={q} /> : description}
        </p>
      )}
      {children}
    </div>
  );
}

function HToggleRow({
  label,
  description,
  checked,
  onChange,
  warning,
  searchQuery,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warning?: string;
  searchQuery?: string;
}) {
  const q = searchQuery || '';
  const hit = hasMatch(label, q) || hasMatch(description || '', q);
  return (
    <div className={cn(
      'flex items-start justify-between py-3 gap-4 rounded-lg px-2 -mx-2 transition-colors',
      hit && q ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
    )}>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          hit && q ? 'text-yellow-900 dark:text-yellow-200' : 'text-gray-900 dark:text-neutral-100 dark:text-gray-100'
        )}>
          {q ? <Highlight text={label} query={q} /> : label}
        </p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-neutral-500 dark:text-gray-400 dark:text-neutral-500 mt-0.5">
            {q ? <Highlight text={description} query={q} /> : description}
          </p>
        )}
        {warning && checked && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />{warning}
          </p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ============================================================================
// SECTION CARD & SUBSECTION
// ============================================================================

function SubSection({
  title,
  children,
  searchQuery,
}: {
  title: string;
  children: React.ReactNode;
  searchQuery?: string;
}) {
  const q = searchQuery || '';
  return (
    <div className="p-5 border-b border-gray-100 dark:border-[var(--sb-border)] dark:border-gray-700/60 last:border-0">
      <h3 className={cn(
        'text-xs font-bold uppercase tracking-widest mb-4',
        hasMatch(title, q) ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-400 dark:text-neutral-500 dark:text-gray-500 dark:text-neutral-500'
      )}>
        {q ? <Highlight text={title} query={q} /> : title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  color,
  badge,
  children,
  defaultOpen = false,
  forceOpen,
  onToggle,
  searchQuery,
  snippets,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  onToggle?: () => void;
  searchQuery?: string;
  snippets?: string[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [userOpened, setUserOpened] = useState(false);
  useEffect(() => { if (!searchQuery) setUserOpened(false); }, [searchQuery]);

  const c = colorMap[color];
  const q = searchQuery || '';
  const isSearching = !!q;
  const titleHit = isSearching && hasMatch(title, q);
  const snippetHits = snippets?.filter(s => hasMatch(s, q)) ?? [];
  const totalHits = (titleHit ? 1 : 0) + snippetHits.length;
  const hasAnyMatch = totalHits > 0;

  let isOpen: boolean;
  if (isSearching) {
    isOpen = userOpened;
  } else {
    isOpen = forceOpen !== undefined ? forceOpen : open;
  }

  const showPreview = isSearching && !isOpen && hasAnyMatch;
  if (isSearching && !hasAnyMatch) return null;

  return (
    <div className={cn(
      'bg-white dark:bg-[var(--sb-card)] dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden scroll-mt-4 transition-all duration-200',
      isSearching
        ? 'border-yellow-300 dark:border-yellow-600 ring-2 ring-yellow-300 dark:ring-yellow-600/50'
        : 'border-gray-200 dark:border-[var(--sb-border)] dark:border-gray-700'
    )}>
      <button
        onClick={() => {
          if (isSearching) { setUserOpened(p => !p); }
          else { setOpen(p => !p); onToggle?.(); }
        }}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:bg-neutral-800/50/60 dark:hover:bg-gray-800/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn('p-2 rounded-lg shrink-0', c.bg, 'dark:opacity-90')}>
            <Icon className={cn('w-5 h-5', c.text)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 dark:text-neutral-100 dark:text-gray-100">
                {isSearching ? <Highlight text={title} query={q} /> : title}
              </span>
              {badge && (
                <span className={cn('px-1.5 py-0.5 rounded text-xs font-bold', c.light, c.text)}>
                  {badge}
                </span>
              )}
              {isSearching && totalHits > 0 && !isOpen && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700">
                  {totalHits} match{totalHits !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        {isOpen
          ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-neutral-500 dark:text-gray-500 dark:text-neutral-500 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-neutral-500 dark:text-gray-500 dark:text-neutral-500 shrink-0" />}
      </button>

      {showPreview && (
        <div className="border-t border-yellow-100 dark:border-yellow-800/50 bg-yellow-50/50 dark:bg-yellow-900/10 px-5 py-3">
          <p className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold mb-2 flex items-center gap-1.5">
            <Search className="w-3 h-3" />Click to expand and see all matches
          </p>
          <div className="space-y-1">
            {snippetHits.slice(0, 6).map((s, i) => (
              <div key={i} className="text-xs text-gray-600 dark:text-neutral-400 dark:text-gray-400 dark:text-neutral-500 flex items-center gap-2 py-0.5">
                <span className="w-1 h-1 rounded-full bg-yellow-400 dark:bg-yellow-500 shrink-0" />
                <Highlight text={s} query={q} />
              </div>
            ))}
            {snippetHits.length > 6 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                +{snippetHits.length - 6} more…
              </p>
            )}
          </div>
        </div>
      )}

      {isOpen && (
        <div className="border-t border-gray-100 dark:border-[var(--sb-border)] dark:border-gray-700/60">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SIDEBAR NAV
// ============================================================================

function SidebarNav({ activeSection, onNavigate }: { activeSection: string; onNavigate: (id: string) => void }) {
  return (
    <aside className="w-56 shrink-0 hidden lg:block">
      <div className="bg-white dark:bg-[var(--sb-card)] dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] dark:border-gray-700 shadow-sm overflow-hidden sticky top-4">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--sb-border)] dark:border-gray-700 bg-gray-50 dark:bg-neutral-800/50 dark:bg-gray-800/60">
          <p className="text-xs font-bold text-gray-500 dark:text-neutral-500 dark:text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Settings</p>
        </div>
        <nav className="p-2 space-y-0.5 max-h-[calc(100vh-10rem)] overflow-y-auto">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const c = colorMap[s.color];
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onNavigate(s.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors',
                  isActive ? cn(c.active, 'shadow-sm') : 'hover:bg-gray-50 dark:bg-neutral-800/50 dark:hover:bg-gray-800 text-gray-600 dark:text-neutral-400 dark:text-gray-400 dark:text-neutral-500'
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-medium truncate">{s.label}</span>
                {s.badge && (
                  <span className={cn(
                    'ml-auto text-xs font-bold px-1 rounded',
                    isActive ? 'bg-white dark:bg-[var(--sb-card)]/20 text-white' : cn(c.light, c.text)
                  )}>
                    {s.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-100 dark:border-[var(--sb-border)] dark:border-gray-700">
          <div className="flex items-center justify-center gap-1.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs text-gray-400 dark:text-neutral-500">Changes save automatically</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// SEARCH BAR
// ============================================================================

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { themeColors } = useSettings();
  const q = value.toLowerCase();

  const sectionHasMatch = (id: string, sectionTitle: string) => {
    if (!value) return false;
    if (hasMatch(sectionTitle, q)) return true;
    return (SECTION_SNIPPETS[id] || []).some(s => hasMatch(s, q));
  };

  const noResults = value && !SECTIONS.some(s => sectionHasMatch(s.id, s.label));

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500 dark:text-gray-500 dark:text-neutral-500 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Search all settings"
          className={cn(
            'w-full pl-10 pr-10 py-2.5 text-sm border rounded-lg shadow-sm transition-colors',
            'bg-white dark:bg-[var(--sb-card)] text-gray-900 dark:text-neutral-100 placeholder-gray-400 border-gray-300 dark:border-neutral-600',
            'dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:border-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent',
            'dark:focus:ring-indigo-500'
          )}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 dark:text-gray-500 dark:text-neutral-500 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {noResults && (
        <div className="bg-white dark:bg-[var(--sb-card)] dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] dark:border-gray-700 shadow-sm p-10 text-center">
          <Search className="w-8 h-8 text-gray-300 dark:text-gray-600 dark:text-neutral-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-neutral-500 dark:text-gray-400 dark:text-neutral-500 font-medium">
            No matches for "<span className="text-gray-800 dark:text-neutral-200 dark:text-gray-200">{value}</span>"
          </p>
          <button
            onClick={() => onChange('')}
            className={cn('mt-3 text-sm font-medium hover:opacity-80 transition-opacity', themeColors.text)}
          >
            Clear search
          </button>
        </div>
      )}
    </>
  );
}

// ============================================================================
// AI SETTINGS ASSISTANT
// ============================================================================

interface AIMessage {
  role: 'user' | 'assistant';
  text: string;
  suggestions?: Array<{ label: string; sectionId: string }>;
}

const SUGGESTED_PROMPTS = [
  'How do I set up e-Invoice for LHDN?',
  'Where can I limit cashier discounts?',
  'How to enable offline mode?',
  'How do I add a new branch?',
  'Where do I change the receipt language?',
  'How to set up loyalty points?',
];

const SETTINGS_KNOWLEDGE = `
You are a helpful assistant for a Malaysian restaurant POS system settings page.
You help users find the right settings and explain how things work.
The settings page has these sections:
- General: Business name, SSM number, TIN, SST number, contact, currency (MYR/SGD/USD), timezone, address, logo upload, receipt header/footer text, show logo/tax/QR on receipt, auto-print after payment.
- Branch / Outlet: Add/manage branches, branch code, tax rate per branch, operating hours, table grid layout.
- POS Devices: Generate and manage POS setup codes (stored as pos_code on each branch). One code per branch. Used for first-time POS terminal setup — staff enter the code on the terminal to sync all data.
- Users & Roles: Role permissions matrix (Manager, Supervisor, Cashier, Waiter). Login method (PIN/password), max discount limit per cashier, shift auto clock-in/out.
- Payment: Enable/disable Cash, Card, E-Wallet, DuitNow. Default payment method. Malaysia 5-sen rounding rule. Split bill. Partial payment. Payment Timing — choose between "Pay Before Eating" (counter service/fast food, payment collected at order) or "Pay After Eating" (dine-in restaurants, bill requested when customer is ready to leave). This setting reflects to the POS terminal checkout flow.
- Tax & Compliance (LHDN badge): LHDN MyInvois API — environment, client ID, client secret. Auto e-Invoice submission. Auto-consolidate daily B2C. SST rate, invoice number format, credit note prefix, refund prefix.
- Menu Behaviour: Allow negative stock, auto-hide out-of-stock items, allow price override, enable scheduled items, require modifier selection.
- Table Management: Enable table merging, table transfer, auto-release idle tables, QR code ordering, auto-close table after payment, default dining duration.
- Inventory: Low stock alert, auto stock deduction, ingredient-level tracking, low stock threshold number.
- Dashboard & Reports: Default date range, default chart type, layout mode, enable advanced analytics.
- Notifications: Low stock alert popup, unpaid order alert, VIP customer alert, scheduled item activation alert, daily sales summary email.
- Cloud & Sync: Sync frequency, conflict resolution, offline mode toggle. Export data, backup now, restore from backup.
- Loyalty & Promos: Enable loyalty program, points per RM spent, points expiry days. Enable promo codes, scheduled promotions.
- Security: Session timeout, audit log retention, two-factor authentication for managers, IP restriction.
- Appearance & UI: Theme (light/dark/system), table view style, density, language — uses Google Gemini AI to translate.

Always:
1. Be concise and practical.
2. Tell the user exactly which section to go to.
3. Mention warnings or tips where relevant.
4. Respond in a friendly, helpful tone.
5. When referencing a section, wrap it like: [Section Name](section_id) — e.g. [Tax & Compliance](tax).
`;

function parseAIResponse(text: string): { cleanText: string; suggestions: Array<{ label: string; sectionId: string }> } {
  const suggestions: Array<{ label: string; sectionId: string }> = [];
  const cleanText = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, sectionId) => {
    if (SECTIONS.find(s => s.id === sectionId)) suggestions.push({ label, sectionId });
    return `**${label}**`;
  });
  return { cleanText, suggestions };
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return (
      <span key={i}>
        {parts.map((p, j) =>
          j % 2 === 1 ? <strong key={j} className="font-semibold text-gray-900 dark:text-neutral-100">{p}</strong> : p
        )}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
}

function AISettingsAssistant({ onNavigate }: { onNavigate: (sectionId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pulsing, setPulsing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) setPulsing(false); }, [open]);
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: AIMessage = { role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const apiKey = (import.meta.env as any).VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setMessages(prev => [...prev, { role: 'assistant', text: 'AI service not configured. Please set VITE_GEMINI_API_KEY in your environment.' }]);
        setLoading(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const conversationText = [...messages, userMsg]
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n\n');
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `${SETTINGS_KNOWLEDGE}\n\nConversation:\n${conversationText}\n\nPlease respond to the user's latest question.`,
      });
      const rawText = response.text || 'Sorry, I could not get a response. Please try again.';
      const { cleanText, suggestions } = parseAIResponse(rawText);
      setMessages(prev => [...prev, { role: 'assistant', text: cleanText, suggestions }]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong.';
      const isQuota = /quota|exceed|limit|resource_exhausted|429/i.test(String(errorMsg));
      setMessages(prev => [...prev, { role: 'assistant', text: isQuota ? 'AI usage exceeded. Please try again later.' : errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl transition-all duration-300',
          'bg-indigo-600 hover:bg-indigo-700 text-white',
          pulsing && 'animate-pulse',
          open && 'opacity-0 pointer-events-none scale-90'
        )}
        title="Ask AI about settings"
      >
        <div className="relative">
          <Bot className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full" />
        </div>
        <span className="text-sm font-semibold whitespace-nowrap">Ask AI</span>
        <Sparkles className="w-3.5 h-3.5 opacity-75" />
      </button>

      <div className={cn(
        'fixed bottom-0 right-0 z-50 flex flex-col bg-white dark:bg-[var(--sb-card)] border-l border-t border-gray-200 dark:border-[var(--sb-border)] shadow-2xl transition-all duration-300 ease-in-out',
        'w-full sm:w-[400px] rounded-tl-2xl',
        open ? 'h-[600px] opacity-100 translate-y-0' : 'h-0 opacity-0 translate-y-4 pointer-events-none'
      )}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gradient-to-r from-indigo-600 to-violet-600 rounded-tl-2xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-[var(--sb-card)]/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Settings Assistant</p>
              <p className="text-xs text-indigo-200 leading-tight">Ask me anything about settings</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-lg bg-white dark:bg-[var(--sb-card)]/10 hover:bg-white dark:bg-[var(--sb-card)]/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-neutral-800/50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                  <p className="text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
                    Hi! I can help you find the right settings and explain how they work. What are you trying to do?
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Lightbulb className="w-3 h-3" />Suggestions
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
                msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-gray-50 dark:bg-neutral-800/50 text-gray-700 dark:text-neutral-300 rounded-tl-sm'
              )}>
                {msg.role === 'assistant' ? renderMarkdown(msg.text) : msg.text}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {msg.suggestions.map((s, j) => {
                      const section = SECTIONS.find(sec => sec.id === s.sectionId);
                      if (!section) return null;
                      const c = colorMap[section.color];
                      const Icon = section.icon;
                      return (
                        <button
                          key={j}
                          onClick={() => { onNavigate(s.sectionId); setOpen(false); }}
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
                    })}
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

        <div className="px-3 py-3 border-t border-gray-100 dark:border-[var(--sb-border)] shrink-0">
          <div className="flex items-end gap-2 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about any setting…"
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

      {open && (
        <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" onClick={() => setOpen(false)} />
      )}
    </>
  );
}

// ============================================================================
// GENERAL SECTION
// ============================================================================

interface GeneralSettings {
  business_name: string; ssm_number: string; tin_number: string; sst_number: string;
  contact_number: string; currency: string; timezone: string; address: string; logo_url: string;
  receipt_header: string; receipt_footer: string;
  showLogo: boolean; showTax: boolean; showQr: boolean; autoPrint: boolean;
}

const GENERAL_DEFAULTS: GeneralSettings = {
  business_name: '', ssm_number: '', tin_number: '', sst_number: '',
  contact_number: '', currency: 'MYR', timezone: 'Asia/Kuala_Lumpur',
  address: '', logo_url: '',
  receipt_header: 'Thank you for dining with us!', receipt_footer: 'Please come again :)',
  showLogo: true, showTax: true, showQr: false, autoPrint: false,
};

const GENERAL_BOOL_KEYS: (keyof GeneralSettings)[] = ['showLogo', 'showTax', 'showQr', 'autoPrint'];
const GENERAL_ALL_KEYS = Object.keys(GENERAL_DEFAULTS) as (keyof GeneralSettings)[];

function GeneralSection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<GeneralSettings>(GENERAL_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    async function fetchSettings() {
      setLoading(true);
      const { data, error } = await supabase.from('settings').select('key, value')
        .eq('merchant_id', merchantId)
        .is('branch_id', null)
        .in('key', GENERAL_ALL_KEYS.map(k => `general_${k}`));
      if (error) { setError(error.message); setLoading(false); return; }
      const mapped: Partial<GeneralSettings> = {};
      for (const row of data ?? []) {
        const key = row.key.replace('general_', '') as keyof GeneralSettings;
        if (!(key in GENERAL_DEFAULTS)) continue;
        (mapped as Record<string, any>)[key] = GENERAL_BOOL_KEYS.includes(key) ? row.value === 'true' : row.value;
      }
      setSettings(prev => ({ ...prev, ...mapped }));
      setLoading(false);
    }
    fetchSettings();
  }, [merchantId]);

  async function handleToggle(key: keyof GeneralSettings) {
    const newVal = !(settings[key] as boolean);
    setSettings(prev => ({ ...prev, [key]: newVal }));

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("You must be logged in to save settings.");
      return;
    }

    // RLS policy checks merchant_id = get_my_merchant_id() - pass merchant_id and use correct onConflict target
    const { error } = await supabase.from('settings').upsert(
      {
        key: `general_${key}`,
        value: String(newVal),
        description: `General setting: ${key}`,
        merchant_id: merchantId,
        branch_id: null,
        updated_by: getUpdatedBy(),
      },
      { onConflict: 'merchant_id,key' }
    );

    if (error) {
      console.error("Supabase upsert error:", error);
      setError(error.message);
      setSettings(prev => ({ ...prev, [key]: !newVal }));
    }
  }

  function handleChange(key: keyof GeneralSettings) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setSettings(prev => ({ ...prev, [key]: e.target.value }));
  }

  function handleBlur(key: keyof GeneralSettings) {
    return async (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      // RLS policy checks merchant_id = get_my_merchant_id() - pass merchant_id and use correct onConflict target
      const { error } = await supabase.from('settings').upsert(
        {
          key: `general_${key}`,
          value: e.target.value,
          description: `General setting: ${key}`,
          merchant_id: merchantId,
          branch_id: null,
          updated_by: getUpdatedBy(),
        },
        { onConflict: 'merchant_id,key' }
      );
      if (error) {
        console.error("Supabase upsert error:", error);
        setError(error.message);
      }
    };
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('menu-images').upload(fileName, file, { upsert: true });
      let url: string;
      if (uploadError) {
        url = await new Promise(res => { const r = new FileReader(); r.onloadend = () => res(r.result as string); r.readAsDataURL(file); });
      } else {
        url = supabase.storage.from('menu-images').getPublicUrl(fileName).data.publicUrl;
      }
      setSettings(prev => ({ ...prev, logo_url: url }));
      // RLS policy checks merchant_id = get_my_merchant_id() - pass merchant_id and use correct onConflict target
      const { error: upsertError } = await supabase.from('settings').upsert(
        {
          key: 'general_logo_url',
          value: url,
          description: 'Business logo URL',
          merchant_id: merchantId,
          branch_id: null,
          updated_by: getUpdatedBy(),
        },
        { onConflict: 'merchant_id,key' }
      );
      if (upsertError) console.error("Supabase upsert error:", upsertError);
    } catch { setError('Failed to upload logo.'); }
    finally { setLogoUploading(false); }
  }

  return (
    <div id="setting-general" className="scroll-mt-4">
      <SectionCard title="General Settings" icon={Settings2} color="indigo" defaultOpen={true}
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.general}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div>
        ) : (
          <>
            <SubSection title="Business Information" searchQuery={searchQuery}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <HField label="Business Name" searchQuery={searchQuery}>
                  <Input type="text" value={settings.business_name} onChange={handleChange('business_name')} onBlur={handleBlur('business_name')} placeholder="Maju Jaya Sdn Bhd" />
                </HField>
                <HField label="SSM Registration Number" searchQuery={searchQuery}>
                  <Input type="text" value={settings.ssm_number} onChange={handleChange('ssm_number')} onBlur={handleBlur('ssm_number')} placeholder="202001012345" />
                </HField>
                <HField label="Tax Identification Number (TIN)" searchQuery={searchQuery}>
                  <Input type="text" value={settings.tin_number} onChange={handleChange('tin_number')} onBlur={handleBlur('tin_number')} placeholder="IG1234567890" />
                </HField>
                <HField label="SST Registration Number" searchQuery={searchQuery}>
                  <Input type="text" value={settings.sst_number} onChange={handleChange('sst_number')} onBlur={handleBlur('sst_number')} placeholder="W10-2008-32000001" />
                </HField>
                <HField label="Contact Number" searchQuery={searchQuery}>
                  <Input type="tel" value={settings.contact_number} onChange={handleChange('contact_number')} onBlur={handleBlur('contact_number')} placeholder="+603-2100 1234" />
                </HField>
                <HField label="Currency" searchQuery={searchQuery}>
                  <SelectField value={settings.currency} onChange={handleChange('currency')} onBlur={handleBlur('currency')}>
                    <option value="MYR">MYR – Malaysian Ringgit</option>
                    <option value="SGD">SGD – Singapore Dollar</option>
                    <option value="USD">USD – US Dollar</option>
                  </SelectField>
                </HField>
                <HField label="Time Zone" searchQuery={searchQuery}>
                  <SelectField value={settings.timezone} onChange={handleChange('timezone')} onBlur={handleBlur('timezone')}>
                    <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur (GMT+8)</option>
                    <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                  </SelectField>
                </HField>
                <HField label="Address" description="Full registered business address" searchQuery={searchQuery}>
                  <textarea rows={2} value={settings.address} onChange={handleChange('address')} onBlur={handleBlur('address')}
                    placeholder="123, Jalan Bukit Bintang, 55100 Kuala Lumpur"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
                </HField>
              </div>
            </SubSection>

            <SubSection title="Logo" searchQuery={searchQuery}>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-600 flex items-center justify-center bg-gray-50 dark:bg-neutral-800/50 overflow-hidden shrink-0">
                  {logoUploading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400 dark:text-neutral-500" />
                    : settings.logo_url ? <img src={settings.logo_url} className="w-full h-full object-contain" alt="logo" />
                      : <Camera className="w-6 h-6 text-gray-300" />}
                </div>
                <div>
                  <button onClick={() => fileRef.current?.click()} disabled={logoUploading}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:bg-neutral-800/50 disabled:opacity-50">
                    <Upload className="w-4 h-4" /> Upload Logo
                  </button>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1.5">PNG or SVG, max 512KB. Recommended 256x256px.</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </div>
            </SubSection>

            <SubSection title="Receipt Configuration" searchQuery={searchQuery}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <HField label="Receipt Header Text" searchQuery={searchQuery}>
                  <Input type="text" value={settings.receipt_header} onChange={handleChange('receipt_header')} onBlur={handleBlur('receipt_header')} placeholder="Thank you for dining with us!" />
                </HField>
                <HField label="Receipt Footer Text" searchQuery={searchQuery}>
                  <Input type="text" value={settings.receipt_footer} onChange={handleChange('receipt_footer')} onBlur={handleBlur('receipt_footer')} placeholder="Please come again :)" />
                </HField>
              </div>
              <div className="divide-y divide-gray-100 mt-2 rounded-lg overflow-hidden">
                <HToggleRow label="Show Logo on Receipt" checked={settings.showLogo} onChange={() => handleToggle('showLogo')} searchQuery={searchQuery} />
                <HToggleRow label="Show Tax Breakdown" checked={settings.showTax} onChange={() => handleToggle('showTax')} searchQuery={searchQuery} />
                <HToggleRow label="Show QR Code on Receipt" checked={settings.showQr} onChange={() => handleToggle('showQr')} description="Displays a QR linking to digital receipt" searchQuery={searchQuery} />
                <HToggleRow label="Auto-Print After Payment" checked={settings.autoPrint} onChange={() => handleToggle('autoPrint')} searchQuery={searchQuery} />
              </div>
            </SubSection>
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================================
// BRANCH SECTION
// ============================================================================

interface Branch {
  id: string; name: string; code: string; tax_rate: number;
  open_time: string; close_time: string; is_active: boolean;
}

const navigateTo = (path: string) => {
  if ((window as any).__appNavigate) (window as any).__appNavigate(path);
  else window.location.href = path;
};

function BranchSection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function writeAudit(action: string, targetName: string, metadata?: Record<string, any>) {
    if (!merchantId) return;
    try {
      await supabase.from('audit_logs').insert({
        action,
        target_name: targetName,
        metadata: metadata ?? null,
        merchant_id: merchantId,
      });
    } catch {
      // non-critical
    }
  }

  useEffect(() => { fetchBranches(); }, []);

  async function fetchBranches() {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from('branches')
      .select('id, name, code, tax_rate, open_time, close_time, is_active')
      .eq('merchant_id', merchantId)
      .order('created_at');
    if (error) setError(error.message);
    else setBranches(data ?? []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this branch? This cannot be undone.')) return;
    const target = branches.find(b => b.id === id);
    setBranches(prev => prev.filter(b => b.id !== id));
    const { error } = await supabase.from('branches').delete().eq('id', id).eq('merchant_id', merchantId);
    if (error) { setError(error.message); fetchBranches(); }
    else await writeAudit('settings_branch_deleted', target?.name ?? 'Branch', { branch_id: id });
  }

  return (
    <div id="setting-branch" className="scroll-mt-4">
      <SectionCard title="Branch / Outlet Settings" icon={GitBranch} color="blue"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.branch}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        <SubSection title="Branches" searchQuery={searchQuery}>
          <InfoBox color="blue">Manage all your outlets from one place. Each branch can have its own tax rate, hours, menu, staff, and table layout.</InfoBox>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div>
          ) : (
            <div className="space-y-2 mt-2">
              {branches.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-[var(--sb-border)] rounded-lg bg-gray-50 dark:bg-neutral-800/50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${b.is_active ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400 dark:text-neutral-500'}`}>
                    {b.code}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-neutral-200">{b.name}</p>
                      {!b.is_active && <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 rounded-full">Inactive</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-neutral-500">Tax: {b.tax_rate}% · Hours: {b.open_time} – {b.close_time}</p>
                  </div>
                  <button onClick={() => navigateTo(`/branches/${b.id}`)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Manage
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="text-xs text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={() => navigateTo('/branches/new')}
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-blue-300 rounded-lg text-sm text-blue-600 font-medium hover:bg-blue-50 w-full justify-center">
                <Plus className="w-4 h-4" /> Add Branch
              </button>
            </div>
          )}
        </SubSection>
      </SectionCard>
    </div>
  );
}

// ============================================================================
// POS DEVICE SETUP SECTION
// ============================================================================

interface POSBranch {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  pos_code: string | null;
}

function generatePosCode(): string {
  const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${seg()}-${seg()}`;
}

function PosCodeCell({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const segments = code.split('-');

  function handleCopy() {
    navigator.clipboard.writeText(code).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        {segments.map((seg, i) => (
          <React.Fragment key={i}>
            <span className={cn(
              'font-mono text-sm font-bold tracking-widest px-2 py-1 rounded-md border transition-all select-none',
              visible
                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800'
                : 'text-gray-300 dark:text-neutral-600 bg-gray-50 dark:bg-neutral-800 border-gray-100 dark:border-neutral-700'
            )}>
              {visible ? seg : '••••'}
            </span>
            {i < segments.length - 1 && (
              <span className="text-gray-300 dark:text-neutral-600 text-xs font-bold">–</span>
            )}
          </React.Fragment>
        ))}
      </div>
      <button
        onClick={() => setVisible(p => !p)}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        title={visible ? 'Hide code' : 'Reveal code'}
      >
        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={handleCopy}
        disabled={!visible}
        className={cn(
          'p-1.5 rounded-md transition-all duration-150',
          copied
            ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
            : visible
              ? 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
              : 'text-gray-200 dark:text-neutral-700 cursor-not-allowed'
        )}
        title={visible ? 'Copy code' : 'Reveal code first'}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function PosBranchRow({
  branch,
  onGenerate,
  onRevoke,
  generating,
  revoking,
}: {
  branch: POSBranch;
  onGenerate: (id: string) => void;
  onRevoke: (id: string) => void;
  generating: boolean;
  revoking: boolean;
}) {
  const hasCode = !!branch.pos_code;
  return (
    <div className={cn(
      'rounded-xl border p-4 transition-colors',
      hasCode
        ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-900/10'
        : 'border-gray-200 dark:border-[var(--sb-border)] bg-white dark:bg-[var(--sb-card)]'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
            branch.is_active
              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
              : 'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500'
          )}>
            {branch.code}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200 truncate">{branch.name}</p>
              {!branch.is_active && (
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 rounded-full shrink-0">Inactive</span>
              )}
            </div>
            {hasCode ? (
              <PosCodeCell code={branch.pos_code!} />
            ) : (
              <p className="text-xs text-gray-400 dark:text-neutral-500 italic flex items-center gap-1">
                <Terminal className="w-3 h-3 shrink-0" />
                No code — POS terminal cannot log in to this branch
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {hasCode ? (
            <button
              onClick={() => onRevoke(branch.id)}
              disabled={revoking}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-500 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 transition-colors"
            >
              {revoking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Revoke
            </button>
          ) : (
            <button
              onClick={() => onGenerate(branch.id)}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
              Generate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DevicesSection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [branches, setBranches] = useState<POSBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true); setError(null);
    const { data, error: err } = await supabase
      .from('branches')
      .select('id, name, code, is_active, pos_code')
      .eq('merchant_id', merchantId)
      .order('created_at');
    if (err) setError(err.message);
    else setBranches(data ?? []);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  async function handleGenerate(branchId: string) {
    setGeneratingId(branchId); setError(null);
    const newCode = generatePosCode();
    const { error: err } = await supabase.from('branches').update({ pos_code: newCode }).eq('id', branchId);
    if (err) setError(err.message);
    else setBranches(prev => prev.map(b => b.id === branchId ? { ...b, pos_code: newCode } : b));
    setGeneratingId(null);
  }

  async function handleRevoke(branchId: string) {
    if (!confirm('Revoke this code? The POS terminal for this branch will need a new code to log in.')) return;
    setRevokingId(branchId); setError(null);
    const { error: err } = await supabase.from('branches').update({ pos_code: null }).eq('id', branchId);
    if (err) setError(err.message);
    else setBranches(prev => prev.map(b => b.id === branchId ? { ...b, pos_code: null } : b));
    setRevokingId(null);
  }

  return (
    <div id="setting-devices" className="scroll-mt-4">
      <SectionCard
        title="POS Device Setup"
        icon={Monitor}
        color="blue"
        forceOpen={forceOpen}
        onToggle={onToggle}
        searchQuery={searchQuery}
        snippets={SECTION_SNIPPETS.devices}
      >
        {error && (
          <div className="mx-5 mt-5 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <SubSection title="Branch Setup Codes" searchQuery={searchQuery}>
          <InfoBox color="blue">
            Each branch has one POS setup code stored in <code className="font-mono text-xs bg-blue-100 dark:bg-blue-900/40 px-1 rounded">branches.pos_code</code>. On first launch, the POS terminal asks for this code and then pulls all settings, menu, and staff data for that branch automatically.
          </InfoBox>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 dark:text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading branches…
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-gray-200 dark:border-neutral-700 rounded-xl">
              <Monitor className="w-8 h-8 text-gray-200 dark:text-neutral-700 mx-auto mb-2" />
              <p className="text-sm text-gray-400 dark:text-neutral-500">No branches found</p>
              <p className="text-xs text-gray-300 dark:text-neutral-600 mt-1">Add a branch first under Branch / Outlet settings</p>
            </div>
          ) : (
            <div className="space-y-2">
              {branches.map(branch => (
                <PosBranchRow
                  key={branch.id}
                  branch={branch}
                  onGenerate={handleGenerate}
                  onRevoke={handleRevoke}
                  generating={generatingId === branch.id}
                  revoking={revokingId === branch.id}
                />
              ))}
            </div>
          )}
        </SubSection>

        <SubSection title="How It Works" searchQuery={searchQuery}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { icon: Key, n: '1', title: 'Generate code', desc: 'Click Generate on a branch to create its pos_code' },
              { icon: Terminal, n: '2', title: 'Enter on POS app', desc: 'Staff opens the POS terminal and taps First Time Setup' },
              { icon: ShieldCheck, n: '3', title: 'Auto-sync', desc: 'Menu, staff, and settings download to that terminal instantly' },
            ] as const).map(({ icon: Icon, n, title, desc }) => (
              <div key={n} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-neutral-800/40 rounded-xl border border-gray-100 dark:border-neutral-800">
                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                  {n}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-neutral-300">{title}</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </SubSection>
      </SectionCard>
    </div>
  );
}

// ============================================================================
// USERS SECTION
// ============================================================================

const ALL_PERMS = ['discount', 'void', 'reopen', 'edit_table', 'reports', 'price_override'];
const PERM_LABEL: Record<string, string> = {
  discount: 'Apply Discount', void: 'Void Order', reopen: 'Reopen Bill',
  edit_table: 'Edit Table', reports: 'View Reports', price_override: 'Override Price',
};
const ROLES = [
  { name: 'Manager', perms: ['discount', 'void', 'reopen', 'edit_table', 'reports', 'price_override'] },
  { name: 'Supervisor', perms: ['discount', 'void', 'edit_table', 'reports'] },
  { name: 'Cashier', perms: ['discount'] },
  { name: 'Waiter', perms: ['edit_table'] },
];

function UsersSection({ searchQuery, forceOpen, onToggle }: SectionProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'Waiter', password: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const merchantId = getLocalMerchantId();
  console.log("Current Merchant ID from LocalStorage:", merchantId);

  async function writeAudit(action: string, targetName: string, metadata?: Record<string, any>) {
    if (!merchantId) return;
    try {
      await supabase.from('audit_logs').insert({
        action,
        target_name: targetName,
        metadata: metadata ?? null,
        merchant_id: merchantId,
      });
    } catch {
      // non-critical
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('*').eq('merchant_id', merchantId).order('name');
      if (error) throw error;
      setUsers(data || []);
    } catch (error) { console.error('Failed to fetch users', error); }
    finally { setLoading(false); }
  };

  const handleOpenModal = (user: any = null) => {
    setEditingUser(user);
    setFormData(user
      ? { name: user.name || '', email: user.email || '', role: user.role || 'Waiter', password: '', is_active: user.is_active ?? true }
      : { name: '', email: '', role: 'Waiter', password: '', is_active: true });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload: any = { name: formData.name, email: formData.email, role: formData.role, is_active: formData.is_active };
      if (formData.password) { payload.password = formData.password; payload.password_hash = formData.password; }
      if (editingUser) {
        const { error } = await supabase.from('users').update(payload).eq('id', editingUser.id).eq('merchant_id', merchantId);
        if (error) throw error;
        await writeAudit('settings_user_updated', formData.name, { user_id: editingUser.id, role: formData.role });
      } else {
        const { error } = await supabase.from('users').insert([{ ...payload, merchant_id: merchantId }]);
        if (error) throw error;
        await writeAudit('settings_user_created', formData.name, { role: formData.role });
      }
      setIsModalOpen(false); fetchUsers();
    } catch (error) { console.error('Failed to save user', error); alert('Failed to save user'); }
    finally { setSaving(false); }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const target = users.find(u => u.id === id);
      const { error } = await supabase.from('users').delete().eq('id', id).eq('merchant_id', merchantId);
      if (error) throw error;
      await writeAudit('settings_user_deleted', target?.name ?? 'User', { user_id: id });
      fetchUsers();
    } catch (error) { console.error('Failed to delete user', error); alert('Failed to delete user'); }
  };

  return (
    <div id="setting-users" className="scroll-mt-4">
      <SectionCard title="Users & Role Permissions" icon={Users} color="violet"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.users}>
        <SubSection title="User Management" searchQuery={searchQuery}>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500 dark:text-neutral-500">Manage staff accounts and their roles.</p>
            <button onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
              <Plus className="w-4 h-4" /> Add User
            </button>
          </div>
          <div className="overflow-x-auto border border-gray-200 dark:border-[var(--sb-border)] rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-200 dark:border-[var(--sb-border)]">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-neutral-500">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-neutral-500">Email / PIN</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-neutral-500">Role</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-neutral-500">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-500 dark:text-neutral-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-neutral-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-neutral-500">No users found.</td></tr>
                ) : users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:bg-neutral-800/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-neutral-100">{user.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-neutral-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-50 text-violet-700 text-xs font-medium">
                        <Shield className="w-3 h-3" />{user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_active
                        ? <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">Active</span>
                        : <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 text-xs font-medium">Disabled</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenModal(user)} className="p-1.5 text-gray-400 dark:text-neutral-500 hover:text-violet-600 rounded-md hover:bg-violet-50"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 text-gray-400 dark:text-neutral-500 hover:text-red-600 rounded-md hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SubSection>

        <SubSection title="Role Permissions Matrix" searchQuery={searchQuery}>
          <InfoBox color="amber">Restricting permissions prevents fraud and accidental changes. Require confirmation for role changes.</InfoBox>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[var(--sb-border)]">
                  <th className="text-left py-2 pr-4 text-xs font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Role</th>
                  {ALL_PERMS.map(p => (
                    <th key={p} className="text-center py-2 px-2 text-xs font-semibold text-gray-500 dark:text-neutral-500 whitespace-nowrap">{PERM_LABEL[p]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ROLES.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:bg-neutral-800/50">
                    <td className="py-3 pr-4 font-medium text-gray-800 dark:text-neutral-200 whitespace-nowrap">{r.name}</td>
                    {ALL_PERMS.map(p => (
                      <td key={p} className="py-3 px-2 text-center">
                        {r.perms.includes(p) ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <X className="w-4 h-4 text-gray-200 mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="mt-3 flex items-center gap-2 px-4 py-2 border border-dashed border-violet-300 rounded-lg text-sm text-violet-600 font-medium hover:bg-violet-50">
            <Plus className="w-4 h-4" />Add Custom Role
          </button>
        </SubSection>

        <SubSection title="Staff Settings" searchQuery={searchQuery}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HField label="Login Method" searchQuery={searchQuery}>
              <SelectField defaultValue="pin">
                <option value="pin">PIN Login</option>
                <option value="password">Password</option>
                <option value="both">PIN + Password</option>
              </SelectField>
            </HField>
            <HField label="Max Discount Limit per Cashier" searchQuery={searchQuery}>
              <Input type="text" defaultValue="10%" placeholder="e.g. 15%" />
            </HField>
          </div>
          <HToggleRow label="Shift Auto Clock-In / Clock-Out" description="Staff automatically clocked in/out based on schedule" checked={true} onChange={() => { }} searchQuery={searchQuery} />
        </SubSection>
      </SectionCard>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[var(--sb-border)]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">{editingUser ? 'Edit User' : 'Add User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 dark:text-neutral-500 hover:text-gray-500 dark:text-neutral-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Name</label>
                <Input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Email / PIN</label>
                <Input type="text" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Password {editingUser && <span className="text-gray-400 dark:text-neutral-500 font-normal">(leave blank to keep current)</span>}
                </label>
                <Input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required={!editingUser} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Role</label>
                <SelectField value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                  <option value="Manager">Manager</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Waiter">Waiter</option>
                </SelectField>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="is_active" checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-violet-600 rounded border-gray-300 dark:border-neutral-600 focus:ring-violet-500" />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-neutral-300">Account is active</label>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:bg-neutral-800/50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PAYMENT SECTION
// ============================================================================

interface PaymentMethod { id: string; name: string; code: string; is_active: boolean; sort_order: number; }
interface PaymentSettings {
  default_payment_method: string;
  rounding_rule: string;
  split_bill_enabled: boolean;
  partial_payment_enabled: boolean;
  pay_before_eat: boolean;
}

function SortableMethod({ method, onToggle, onDelete }: { method: PaymentMethod; onToggle: (id: string, current: boolean) => void; onDelete: (id: string) => void; key?: React.Key }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: method.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined }}
      className="flex items-center justify-between p-3 border border-gray-200 dark:border-[var(--sb-border)] rounded-lg bg-white dark:bg-[var(--sb-card)]">
      <div className="flex items-center gap-2">
        <button className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-neutral-500 touch-none" {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4" />
        </button>
        <CreditCard className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
        <span className="text-sm font-medium text-gray-800 dark:text-neutral-200">{method.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <Toggle checked={method.is_active} onChange={() => onToggle(method.id, method.is_active)} />
        <button onClick={() => onDelete(method.id)} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function PaymentSection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<PaymentSettings>({
    default_payment_method: 'cash',
    rounding_rule: 'nearest5',
    split_bill_enabled: true,
    partial_payment_enabled: false,
    pay_before_eat: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newMethodName, setNewMethodName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  async function writeAudit(action: string, targetName: string, metadata?: Record<string, any>) {
    if (!merchantId) return;
    try {
      await supabase.from('audit_logs').insert({
        action,
        target_name: targetName,
        metadata: metadata ?? null,
        merchant_id: merchantId,
      });
    } catch {
      // non-critical
    }
  }

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true); setError(null);
    try {
      const [methodsRes, settingsRes] = await Promise.all([
        supabase.from('payment_methods').select('*').eq('merchant_id', merchantId).order('sort_order'),
        supabase.from('settings').select('key, value').in('key', [
          'default_payment_method',
          'rounding_rule',
          'split_bill_enabled',
          'partial_payment_enabled',
          'pay_before_eat',
        ]).eq('merchant_id', merchantId),
      ]);
      if (methodsRes.error) throw methodsRes.error;
      if (settingsRes.error) throw settingsRes.error;
      setMethods(methodsRes.data ?? []);
      const mapped: Partial<PaymentSettings> = {};
      for (const row of settingsRes.data ?? []) {
        if (
          row.key === 'split_bill_enabled' ||
          row.key === 'partial_payment_enabled' ||
          row.key === 'pay_before_eat'
        ) {
          (mapped as any)[row.key] = row.value === 'true';
        } else {
          (mapped as any)[row.key] = row.value;
        }
      }
      setSettings(prev => ({ ...prev, ...mapped }));
    } catch (err: any) { setError(err.message ?? 'Failed to load payment settings'); }
    finally { setLoading(false); }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const reordered = arrayMove(methods, methods.findIndex(m => m.id === active.id), methods.findIndex(m => m.id === over.id));
    setMethods(reordered);
    await Promise.all(reordered.map((m: PaymentMethod, i) => supabase.from('payment_methods').update({ sort_order: i + 1 }).eq('id', m.id).eq('merchant_id', merchantId)));
    await writeAudit('settings_payment_methods_reordered', 'Payment Methods', { count: reordered.length });
  }

  async function handleToggleMethod(id: string, current: boolean) {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, is_active: !current } : m));
    const { error } = await supabase.from('payment_methods').update({ is_active: !current }).eq('id', id).eq('merchant_id', merchantId);
    if (error) { setError(error.message); setMethods(prev => prev.map(m => m.id === id ? { ...m, is_active: current } : m)); }
    else await writeAudit('settings_payment_method_toggled', 'Payment Method', { method_id: id, is_active: !current });
  }

  async function handleDeleteMethod(id: string) {
    const target = methods.find(m => m.id === id);
    setMethods(prev => prev.filter(m => m.id !== id));
    const { error } = await supabase.from('payment_methods').delete().eq('id', id).eq('merchant_id', merchantId);
    if (error) { setError(error.message); fetchAll(); }
    else await writeAudit('settings_payment_method_deleted', target?.name ?? 'Payment Method', { method_id: id });
  }

  async function handleAddMethod() {
    if (!newMethodName.trim()) return;
    setSaving(true); setError(null);
    const code = newMethodName.trim().toLowerCase().replace(/\s+/g, '_');
    const { data, error } = await supabase.from('payment_methods').insert({ name: newMethodName.trim(), code, is_active: true, sort_order: methods.length + 1, merchant_id: merchantId }).select().single();
    if (error) setError(error.message);
    else {
      setMethods(prev => [...prev, data]);
      await writeAudit('settings_payment_method_created', newMethodName.trim(), { code });
      setNewMethodName('');
      setShowAddForm(false);
    }
    setSaving(false);
  }

  async function handleSaveSetting(key: string, value: string) {
    const isBool = key === 'split_bill_enabled' || key === 'partial_payment_enabled' || key === 'pay_before_eat';
    setSettings(prev => ({ ...prev, [key]: isBool ? value === 'true' : value }));
    const { error } = await supabase.from('settings').upsert(
      { key, value, description: `Payment setting: ${key}`, merchant_id: merchantId, branch_id: null, updated_by: getUpdatedBy() },
      { onConflict: 'merchant_id,key' }
    );
    if (error) setError(error.message);
    else await writeAudit('settings_payment_updated', key, { value });
  }

  return (
    <div id="setting-payment" className="scroll-mt-4">
      <SectionCard title="Payment Settings" icon={CreditCard} color="emerald"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.payment}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

        {/* ── Payment Methods ── */}
        <SubSection title="Payment Methods" searchQuery={searchQuery}>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div>
          ) : (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={methods.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {methods.map(m => <SortableMethod key={m.id} method={m} onToggle={handleToggleMethod} onDelete={handleDeleteMethod} />)}
                  </div>
                </SortableContext>
              </DndContext>
              {showAddForm ? (
                <div className="flex items-center gap-2 p-3 mt-2 border border-emerald-200 rounded-lg bg-emerald-50">
                  <input autoFocus type="text" placeholder="e.g. Boost, Maybank QR..." value={newMethodName}
                    onChange={e => setNewMethodName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddMethod()}
                    className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-neutral-200 placeholder-gray-400" />
                  <button onClick={handleAddMethod} disabled={saving || !newMethodName.trim()} className="text-xs px-3 py-1 bg-emerald-600 text-white rounded-md disabled:opacity-50">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                  </button>
                  <button onClick={() => { setShowAddForm(false); setNewMethodName(''); }} className="text-xs px-3 py-1 border border-gray-200 dark:border-[var(--sb-border)] rounded-md text-gray-500 dark:text-neutral-500">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 w-full p-3 mt-2 border border-dashed border-gray-300 dark:border-neutral-600 rounded-lg text-sm text-gray-500 dark:text-neutral-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                  <Plus className="w-4 h-4" /> Add Payment Method
                </button>
              )}
            </>
          )}
        </SubSection>

        {/* ── Rules & Defaults ── */}
        <SubSection title="Rules & Defaults" searchQuery={searchQuery}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HField label="Default Payment Method" searchQuery={searchQuery}>
              <SelectField value={settings.default_payment_method} onChange={e => handleSaveSetting('default_payment_method', e.target.value)}>
                {methods.filter(m => m.is_active).map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
              </SelectField>
            </HField>
            <HField label="Rounding Rule (Malaysia 5 sen)" searchQuery={searchQuery}>
              <SelectField value={settings.rounding_rule} onChange={e => handleSaveSetting('rounding_rule', e.target.value)}>
                <option value="nearest5">Round to nearest 5 sen</option>
                <option value="up5">Round up to 5 sen</option>
                <option value="none">No rounding</option>
              </SelectField>
            </HField>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 dark:border-[var(--sb-border)] overflow-hidden mt-2">
            <HToggleRow label="Split Bill" checked={settings.split_bill_enabled} onChange={() => handleSaveSetting('split_bill_enabled', String(!settings.split_bill_enabled))} description="Allow splitting bills between customers" searchQuery={searchQuery} />
            <HToggleRow label="Partial Payment" checked={settings.partial_payment_enabled} onChange={() => handleSaveSetting('partial_payment_enabled', String(!settings.partial_payment_enabled))} description="Accept partial amounts with outstanding balance" searchQuery={searchQuery} />
          </div>
        </SubSection>

        {/* ── Payment Timing (NEW) ── */}
        <SubSection title="Payment Timing" searchQuery={searchQuery}>
          <InfoBox color="amber">
            Controls when customers pay. This reflects directly to the POS terminal checkout flow — affecting how staff are prompted and when tables are released.
          </InfoBox>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Pay After Eating */}
            <button
              onClick={() => handleSaveSetting('pay_before_eat', 'false')}
              className={cn(
                'relative flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1',
                !settings.pay_before_eat
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-600 shadow-sm'
                  : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-[var(--sb-card)] hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/10'
              )}
            >
              {!settings.pay_before_eat && (
                <span className="absolute top-3 right-3 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" /> Active
                </span>
              )}
              <div className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
                !settings.pay_before_eat
                  ? 'bg-emerald-100 dark:bg-emerald-900/40'
                  : 'bg-gray-100 dark:bg-neutral-800'
              )}>
                <Utensils className={cn(
                  'w-5 h-5',
                  !settings.pay_before_eat ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-neutral-500'
                )} />
              </div>
              <div>
                <p className={cn(
                  'text-sm font-semibold',
                  !settings.pay_before_eat ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-neutral-300'
                )}>
                  Pay After Eating
                </p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 leading-relaxed">
                  Bill is requested when the customer is ready to leave. Best for dine-in restaurants and cafes.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['Dine-In', 'Fine Dining', 'Café'].map(tag => (
                  <span key={tag} className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    !settings.pay_before_eat
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500'
                  )}>
                    {tag}
                  </span>
                ))}
              </div>
            </button>

            {/* Pay Before Eating */}
            <button
              onClick={() => handleSaveSetting('pay_before_eat', 'true')}
              className={cn(
                'relative flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1',
                settings.pay_before_eat
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-600 shadow-sm'
                  : 'border-gray-200 dark:border-neutral-600 bg-white dark:bg-[var(--sb-card)] hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/10'
              )}
            >
              {settings.pay_before_eat && (
                <span className="absolute top-3 right-3 flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" /> Active
                </span>
              )}
              <div className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
                settings.pay_before_eat
                  ? 'bg-emerald-100 dark:bg-emerald-900/40'
                  : 'bg-gray-100 dark:bg-neutral-800'
              )}>
                <ShoppingCart className={cn(
                  'w-5 h-5',
                  settings.pay_before_eat ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-neutral-500'
                )} />
              </div>
              <div>
                <p className={cn(
                  'text-sm font-semibold',
                  settings.pay_before_eat ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-neutral-300'
                )}>
                  Pay Before Eating
                </p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 leading-relaxed">
                  Payment is collected at point of order. Best for counter service, fast food, and takeaway outlets.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['Fast Food', 'Counter Service', 'Takeaway'].map(tag => (
                  <span key={tag} className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    settings.pay_before_eat
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500'
                  )}>
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          </div>

          {/* POS impact note */}
          <div className={cn(
            'mt-4 flex items-start gap-3 p-3.5 rounded-lg border text-sm transition-colors',
            settings.pay_before_eat
              ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
          )}>
            <Info className={cn(
              'w-4 h-4 shrink-0 mt-0.5',
              settings.pay_before_eat ? 'text-amber-500 dark:text-amber-400' : 'text-blue-500 dark:text-blue-400'
            )} />
            <div>
              <p className={cn(
                'font-semibold text-xs mb-0.5',
                settings.pay_before_eat ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'
              )}>
                POS Behaviour: {settings.pay_before_eat ? 'Pay Before Eating' : 'Pay After Eating'}
              </p>
              <p className={cn(
                'text-xs leading-relaxed',
                settings.pay_before_eat ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
              )}>
                {settings.pay_before_eat
                  ? 'The POS terminal will require payment to be completed before the order is sent to the kitchen. Table will not be opened until payment is confirmed.'
                  : 'The POS terminal will send orders to the kitchen immediately. Staff will request payment when the customer asks for the bill. Table is released after payment.'}
              </p>
            </div>
          </div>
        </SubSection>
      </SectionCard>
    </div>
  );
}

// ============================================================================
// TAX SECTION
// ============================================================================

interface LhdnSettings {
  lhdn_environment: string; lhdn_client_id: string; lhdn_client_secret: string;
  lhdn_einvoice_auto: boolean; lhdn_auto_consolidate: boolean; lhdn_consolidation_time: string;
  invoice_number_format: string; credit_note_prefix: string; refund_number_prefix: string;
  tax_inclusive: boolean; sst_rate: string;
}

const LHDN_DEFAULTS: LhdnSettings = {
  lhdn_environment: 'sandbox', lhdn_client_id: '', lhdn_client_secret: '',
  lhdn_einvoice_auto: false, lhdn_auto_consolidate: false, lhdn_consolidation_time: '23:50',
  invoice_number_format: 'INV-{YYYY}-{0000}', credit_note_prefix: 'CN-{YYYY}-{0000}', refund_number_prefix: 'RF-{YYYY}-{0000}',
  tax_inclusive: false, sst_rate: '0',
};
const LHDN_BOOL: (keyof LhdnSettings)[] = ['lhdn_einvoice_auto', 'lhdn_auto_consolidate', 'tax_inclusive'];
const LHDN_KEYS = Object.keys(LHDN_DEFAULTS) as (keyof LhdnSettings)[];

function TaxSection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [lhdn, setLhdn] = useState<LhdnSettings>(LHDN_DEFAULTS);
  const [lhdnLoading, setLhdnLoading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    async function fetchLhdn() {
      const { data, error } = await supabase.from('settings').select('key, value')
        .eq('merchant_id', merchantId)
        .is('branch_id', null)
        .in('key', LHDN_KEYS.map(k => `tax_${k}`));
      if (error) { setError(error.message); setLhdnLoading(false); return; }
      const mapped: Partial<LhdnSettings> = {};
      for (const row of data ?? []) {
        const key = row.key.replace('tax_', '') as keyof LhdnSettings;
        if (!(key in LHDN_DEFAULTS)) continue;
        (mapped as Record<string, any>)[key] = LHDN_BOOL.includes(key) ? row.value === 'true' : row.value;
      }
      setLhdn(prev => ({ ...prev, ...mapped }));
      setLhdnLoading(false);
    }
    fetchLhdn();
  }, [merchantId]);

  async function handleLhdnToggle(key: keyof LhdnSettings) {
    const newVal = !(lhdn[key] as boolean);
    setLhdn(prev => ({ ...prev, [key]: newVal }));
    const { error } = await supabase.from('settings').upsert(
      {
        key: `tax_${key}`,
        value: String(newVal),
        description: `Tax: ${key}`,
        merchant_id: merchantId,
        branch_id: null,
        updated_by: getUpdatedBy(),
      },
      { onConflict: 'merchant_id,key' }
    );
    if (error) { setError(error.message); setLhdn(prev => ({ ...prev, [key]: !newVal })); }
  }

  function handleLhdnChange(key: keyof LhdnSettings) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setLhdn(prev => ({ ...prev, [key]: e.target.value }));
  }

  function handleLhdnBlur(key: keyof LhdnSettings) {
    return async (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { error } = await supabase.from('settings').upsert(
        {
          key: `tax_${key}`,
          value: e.target.value,
          description: `Tax: ${key}`,
          merchant_id: merchantId,
          branch_id: null,
          updated_by: getUpdatedBy(),
        },
        { onConflict: 'merchant_id,key' }
      );
      if (error) setError(error.message);
    };
  }

  return (
    <div id="setting-tax" className="scroll-mt-4">
      <SectionCard title="Tax & Compliance" icon={FileText} color="amber" badge="LHDN"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.tax}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}
        <SubSection title="POS Tax Settings" searchQuery={searchQuery}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HField label="SST Rate (%)" searchQuery={searchQuery}>
              <Input type="number" value={lhdn.sst_rate} onChange={handleLhdnChange('sst_rate')} onBlur={handleLhdnBlur('sst_rate')} placeholder="e.g. 6" />
            </HField>
          </div>
          <div className="mt-2 divide-y divide-gray-100 rounded-lg overflow-hidden border border-gray-100 dark:border-[var(--sb-border)]">
            <HToggleRow label="Tax Inclusive" description="Prices already include tax (e.g. GST-inclusive)" checked={lhdn.tax_inclusive} onChange={() => handleLhdnToggle('tax_inclusive')} searchQuery={searchQuery} />
          </div>
        </SubSection>
        <SubSection title="Invoice & Receipt Settings" searchQuery={searchQuery}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HField label="Invoice Number Format" searchQuery={searchQuery}>
              <Input type="text" value={lhdn.invoice_number_format} onChange={handleLhdnChange('invoice_number_format')} onBlur={handleLhdnBlur('invoice_number_format')} placeholder="INV-{YYYY}-{0000}" className="font-mono text-sm" />
            </HField>
            <HField label="Credit Note Prefix" searchQuery={searchQuery}>
              <Input type="text" value={lhdn.credit_note_prefix} onChange={handleLhdnChange('credit_note_prefix')} onBlur={handleLhdnBlur('credit_note_prefix')} placeholder="CN-{YYYY}-{0000}" className="font-mono text-sm" />
            </HField>
            <HField label="Refund Number Prefix" searchQuery={searchQuery}>
              <Input type="text" value={lhdn.refund_number_prefix} onChange={handleLhdnChange('refund_number_prefix')} onBlur={handleLhdnBlur('refund_number_prefix')} placeholder="RF-{YYYY}-{0000}" className="font-mono text-sm" />
            </HField>
          </div>
        </SubSection>
        <SubSection title="LHDN MyInvois API" searchQuery={searchQuery}>
          <InfoBox color="blue">These credentials connect your POS to LHDN MyInvois for automated e-Invoice submission.</InfoBox>
          {lhdnLoading ? (
            <div className="flex items-center justify-center py-6 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div className="md:col-span-2">
                  <HField label="Environment" searchQuery={searchQuery}>
                    <SelectField value={lhdn.lhdn_environment} onChange={handleLhdnChange('lhdn_environment')} onBlur={handleLhdnBlur('lhdn_environment')}>
                      <option value="sandbox">Sandbox (Testing)</option>
                      <option value="production">Production (Live)</option>
                    </SelectField>
                  </HField>
                </div>
                <div className="md:col-span-2">
                  <HField label="Client ID" searchQuery={searchQuery}>
                    <Input type="text" value={lhdn.lhdn_client_id} onChange={handleLhdnChange('lhdn_client_id')} onBlur={handleLhdnBlur('lhdn_client_id')} placeholder="lhdn-client-id-xxxxxxxx" className="font-mono text-sm" />
                  </HField>
                </div>
                <div className="md:col-span-2">
                  <HField label="Client Secret" searchQuery={searchQuery}>
                    <div className="relative">
                      <Input type={showSecret ? 'text' : 'password'} value={lhdn.lhdn_client_secret} onChange={handleLhdnChange('lhdn_client_secret')} onBlur={handleLhdnBlur('lhdn_client_secret')} placeholder="••••••••••••••••" className="font-mono text-sm pr-10" />
                      <button type="button" onClick={() => setShowSecret(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400">
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </HField>
                </div>
              </div>
              <HToggleRow label="Auto E-Invoice Submission" description="Automatically submit e-invoices to LHDN upon order completion" checked={lhdn.lhdn_einvoice_auto} onChange={() => handleLhdnToggle('lhdn_einvoice_auto')} warning="Ensure credentials are valid before enabling in production" searchQuery={searchQuery} />
              <HToggleRow label="Auto-Consolidate Daily (B2C)" description="Submit consolidated daily receipts at end of day" checked={lhdn.lhdn_auto_consolidate} onChange={() => handleLhdnToggle('lhdn_auto_consolidate')} searchQuery={searchQuery} />
              {lhdn.lhdn_auto_consolidate && (
                <div className="ml-1 mt-2">
                  <HField label="Consolidation Time" searchQuery={searchQuery}>
                    <Input type="time" value={lhdn.lhdn_consolidation_time} onChange={handleLhdnChange('lhdn_consolidation_time')} onBlur={handleLhdnBlur('lhdn_consolidation_time')} className="w-32" />
                  </HField>
                </div>
              )}
            </>
          )}
        </SubSection>
      </SectionCard>
    </div>
  );
}

// ============================================================================
// MENU SECTION
// ============================================================================

interface MenuSettings { negativeStock: boolean; hideOutOfStock: boolean; priceOverride: boolean; scheduledItems: boolean; modifierRequired: boolean; }
const MENU_DEFAULTS: MenuSettings = { negativeStock: false, hideOutOfStock: true, priceOverride: false, scheduledItems: false, modifierRequired: false };
const MENU_KEYS = Object.keys(MENU_DEFAULTS) as (keyof MenuSettings)[];

function MenuSection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [settings, setSettings] = useState<MenuSettings>(MENU_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    async function fetchSettings() {
      setLoading(true);
      const { data, error } = await supabase.from('settings').select('key, value')
        .eq('merchant_id', merchantId)
        .is('branch_id', null)
        .in('key', MENU_KEYS.map(k => `menu_${k}`));
      if (error) { setError(error.message); setLoading(false); return; }
      const mapped: Partial<MenuSettings> = {};
      for (const row of data ?? []) {
        const key = row.key.replace('menu_', '') as keyof MenuSettings;
        if (key in MENU_DEFAULTS) mapped[key] = row.value === 'true';
      }
      setSettings(prev => ({ ...prev, ...mapped }));
      setLoading(false);
    }
    fetchSettings();
  }, [merchantId]);

  async function handleToggle(key: keyof MenuSettings) {
    const newVal = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newVal }));
    const { error } = await supabase.from('settings').upsert(
      {
        key: `menu_${key}`,
        value: String(newVal),
        description: `Menu setting: ${key}`,
        merchant_id: merchantId,
        branch_id: null,
        updated_by: getUpdatedBy(),
      },
      { onConflict: 'merchant_id,key' }
    );
    if (error) { setError(error.message); setSettings(prev => ({ ...prev, [key]: !newVal })); }
  }

  return (
    <div id="setting-menu" className="scroll-mt-4">
      <SectionCard title="Menu Behaviour Settings" icon={UtensilsCrossed} color="orange"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.menu}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        <SubSection title="Stock & Display Rules" searchQuery={searchQuery}>
          {loading ? <div className="flex items-center justify-center py-8 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div> : (
            <div className="divide-y divide-gray-100 rounded-lg overflow-hidden">
              <HToggleRow label="Allow Negative Stock" checked={settings.negativeStock} onChange={() => handleToggle('negativeStock')} warning="Items can be ordered even when out of stock" searchQuery={searchQuery} />
              <HToggleRow label="Auto-Hide Out-of-Stock Items" checked={settings.hideOutOfStock} onChange={() => handleToggle('hideOutOfStock')} description="Automatically remove sold-out items from menu view" searchQuery={searchQuery} />
              <HToggleRow label="Allow Price Override" checked={settings.priceOverride} onChange={() => handleToggle('priceOverride')} description="Cashiers can manually change item prices" warning="May require Supervisor permission" searchQuery={searchQuery} />
              <HToggleRow label="Enable Scheduled Items" checked={settings.scheduledItems} onChange={() => handleToggle('scheduledItems')} description="Show/hide items based on time of day (e.g. breakfast menu)" searchQuery={searchQuery} />
              <HToggleRow label="Require Modifier Selection" checked={settings.modifierRequired} onChange={() => handleToggle('modifierRequired')} description="Force selection of required options (e.g. size, spice level)" searchQuery={searchQuery} />
            </div>
          )}
        </SubSection>
      </SectionCard>
    </div>
  );
}

// ============================================================================
// TABLE SECTION
// ============================================================================

interface TableSettings { tableMerge: boolean; tableTransfer: boolean; autoRelease: boolean; qrOrdering: boolean; autoClose: boolean; defaultDiningDuration: string; }
const TABLE_DEFAULTS: TableSettings = { tableMerge: false, tableTransfer: false, autoRelease: false, qrOrdering: false, autoClose: false, defaultDiningDuration: '60' };
const TABLE_BOOL_KEYS: (keyof TableSettings)[] = ['tableMerge', 'tableTransfer', 'autoRelease', 'qrOrdering', 'autoClose'];
const TABLE_ALL_KEYS = Object.keys(TABLE_DEFAULTS) as (keyof TableSettings)[];

function TableSection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [settings, setSettings] = useState<TableSettings>(TABLE_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    async function fetchSettings() {
      setLoading(true);
      const { data, error } = await supabase.from('settings').select('key, value')
        .eq('merchant_id', merchantId)
        .is('branch_id', null)
        .in('key', TABLE_ALL_KEYS.map(k => `table_${k}`));
      if (error) { setError(error.message); setLoading(false); return; }
      const mapped: Partial<TableSettings> = {};
      for (const row of data ?? []) {
        const key = row.key.replace('table_', '') as keyof TableSettings;
        if (!(key in TABLE_DEFAULTS)) continue;
        (mapped as Record<string, any>)[key] = TABLE_BOOL_KEYS.includes(key) ? row.value === 'true' : row.value;
      }
      setSettings(prev => ({ ...prev, ...mapped }));
      setLoading(false);
    }
    fetchSettings();
  }, [merchantId]);

  async function handleToggle(key: keyof TableSettings) {
    const newVal = !(settings[key] as boolean);
    setSettings(prev => ({ ...prev, [key]: newVal }));
    const { error } = await supabase.from('settings').upsert(
      {
        key: `table_${key}`,
        value: String(newVal),
        description: `Table setting: ${key}`,
        merchant_id: merchantId,
        branch_id: null,
        updated_by: getUpdatedBy(),
      },
      { onConflict: 'merchant_id,key' }
    );
    if (error) { setError(error.message); setSettings(prev => ({ ...prev, [key]: !newVal })); }
  }

  function handleChange(key: keyof TableSettings) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, [key]: e.target.value }));
  }

  function handleBlur(key: keyof TableSettings) {
    return async (e: React.FocusEvent<HTMLInputElement>) => {
      const { error } = await supabase.from('settings').upsert(
        {
          key: `table_${key}`,
          value: e.target.value,
          description: `Table setting: ${key}`,
          merchant_id: merchantId,
          branch_id: null,
          updated_by: getUpdatedBy(),
        },
        { onConflict: 'merchant_id,key' }
      );
      if (error) setError(error.message);
    };
  }

  return (
    <div id="setting-table" className="scroll-mt-4">
      <SectionCard title="Table Management Settings" icon={LayoutGrid} color="cyan"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.table}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        {loading ? <div className="flex items-center justify-center py-10 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div> : (
          <SubSection title="Table Behaviour" searchQuery={searchQuery}>
            <div className="divide-y divide-gray-100 rounded-lg overflow-hidden">
              <HToggleRow label="Enable Table Merging" checked={settings.tableMerge} onChange={() => handleToggle('tableMerge')} description="Allow combining multiple tables for large groups" searchQuery={searchQuery} />
              <HToggleRow label="Enable Table Transfer" checked={settings.tableTransfer} onChange={() => handleToggle('tableTransfer')} description="Move orders between tables mid-session" searchQuery={searchQuery} />
              <HToggleRow label="Auto-Release Idle Tables" checked={settings.autoRelease} onChange={() => handleToggle('autoRelease')} description="Mark table as available after set idle duration" searchQuery={searchQuery} />
              <HToggleRow label="Enable QR Code Ordering" checked={settings.qrOrdering} onChange={() => handleToggle('qrOrdering')} description="Customers scan QR at table to order digitally" searchQuery={searchQuery} />
              <HToggleRow label="Auto-Close Table After Payment" checked={settings.autoClose} onChange={() => handleToggle('autoClose')} description="Automatically free table once bill is settled" searchQuery={searchQuery} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <HField label="Default Dining Duration (minutes)" description="Used for occupancy analytics" searchQuery={searchQuery}>
                <Input type="number" value={settings.defaultDiningDuration} onChange={handleChange('defaultDiningDuration')} onBlur={handleBlur('defaultDiningDuration')} />
              </HField>
            </div>
          </SubSection>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================================
// INVENTORY SECTION
// ============================================================================

interface InventorySettings { lowStockAlert: boolean; autoDeduction: boolean; ingredientTracking: boolean; lowStockThreshold: string; }
const INV_DEFAULTS: InventorySettings = { lowStockAlert: false, autoDeduction: false, ingredientTracking: false, lowStockThreshold: '10' };
const INV_BOOL_KEYS: (keyof InventorySettings)[] = ['lowStockAlert', 'autoDeduction', 'ingredientTracking'];
const INV_ALL_KEYS = Object.keys(INV_DEFAULTS) as (keyof InventorySettings)[];

function InventorySection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [settings, setSettings] = useState<InventorySettings>(INV_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    async function fetchSettings() {
      setLoading(true);
      const { data, error } = await supabase.from('settings').select('key, value')
        .eq('merchant_id', merchantId)
        .is('branch_id', null)
        .in('key', INV_ALL_KEYS.map(k => `inventory_${k}`));
      if (error) { setError(error.message); setLoading(false); return; }
      const mapped: Partial<InventorySettings> = {};
      for (const row of data ?? []) {
        const key = row.key.replace('inventory_', '') as keyof InventorySettings;
        if (!(key in INV_DEFAULTS)) continue;
        (mapped as Record<string, any>)[key] = INV_BOOL_KEYS.includes(key) ? row.value === 'true' : row.value;
      }
      setSettings(prev => ({ ...prev, ...mapped }));
      setLoading(false);
    }
    fetchSettings();
  }, [merchantId]);

  async function handleToggle(key: keyof InventorySettings) {
    const newVal = !(settings[key] as boolean);
    setSettings(prev => ({ ...prev, [key]: newVal }));
    const { error } = await supabase.from('settings').upsert(
      {
        key: `inventory_${key}`,
        value: String(newVal),
        description: `Inventory setting: ${key}`,
        merchant_id: merchantId,
        branch_id: null,
        updated_by: getUpdatedBy(),
      },
      { onConflict: 'merchant_id,key' }
    );
    if (error) { setError(error.message); setSettings(prev => ({ ...prev, [key]: !newVal })); }
  }

  function handleChange(key: keyof InventorySettings) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, [key]: e.target.value }));
  }

  function handleBlur(key: keyof InventorySettings) {
    return async (e: React.FocusEvent<HTMLInputElement>) => {
      const { error } = await supabase.from('settings').upsert(
        {
          key: `inventory_${key}`,
          value: e.target.value,
          description: `Inventory setting: ${key}`,
          merchant_id: merchantId,
          branch_id: null,
          updated_by: getUpdatedBy(),
        },
        { onConflict: 'merchant_id,key' }
      );
      if (error) setError(error.message);
    };
  }

  return (
    <div id="setting-inventory" className="scroll-mt-4">
      <SectionCard title="Inventory Settings" icon={Package} color="teal"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.inventory}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        {loading ? <div className="flex items-center justify-center py-10 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div> : (
          <SubSection title="Stock Controls" searchQuery={searchQuery}>
            <div className="divide-y divide-gray-100 rounded-lg overflow-hidden">
              <HToggleRow label="Low Stock Alert" checked={settings.lowStockAlert} onChange={() => handleToggle('lowStockAlert')} description="Notify staff when items fall below minimum level" searchQuery={searchQuery} />
              <HToggleRow label="Auto Stock Deduction" checked={settings.autoDeduction} onChange={() => handleToggle('autoDeduction')} description="Automatically reduce inventory when orders are placed" searchQuery={searchQuery} />
              <HToggleRow label="Ingredient-Level Tracking" checked={settings.ingredientTracking} onChange={() => handleToggle('ingredientTracking')} description="Track raw ingredients consumed per dish (requires recipe mapping)" searchQuery={searchQuery} />
            </div>
            <HField label="Default Low Stock Threshold" description="Alert when quantity falls at or below this level" searchQuery={searchQuery}>
              <Input type="number" value={settings.lowStockThreshold} onChange={handleChange('lowStockThreshold')} onBlur={handleBlur('lowStockThreshold')} className="w-32" />
            </HField>
          </SubSection>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================================
// DASHBOARD SECTION
// ============================================================================

interface DashboardSettings { defaultDateRange: string; defaultChartType: string; advancedAnalytics: boolean; }
const DASH_DEFAULTS: DashboardSettings = { defaultDateRange: '30', defaultChartType: 'bar', advancedAnalytics: false };
const DASH_BOOL_KEYS: (keyof DashboardSettings)[] = ['advancedAnalytics'];
const DASH_ALL_KEYS = Object.keys(DASH_DEFAULTS) as (keyof DashboardSettings)[];

function DashboardSection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [settings, setSettings] = useState<DashboardSettings>(DASH_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    async function fetchSettings() {
      setLoading(true);
      const { data, error } = await supabase.from('settings').select('key, value')
        .eq('merchant_id', merchantId)
        .is('branch_id', null)
        .in('key', DASH_ALL_KEYS.map(k => `dashboard_${k}`));
      if (error) { setError(error.message); setLoading(false); return; }
      const mapped: Partial<DashboardSettings> = {};
      for (const row of data ?? []) {
        const key = row.key.replace('dashboard_', '') as keyof DashboardSettings;
        if (!(key in DASH_DEFAULTS)) continue;
        (mapped as Record<string, any>)[key] = DASH_BOOL_KEYS.includes(key) ? row.value === 'true' : row.value;
      }
      setSettings(prev => ({ ...prev, ...mapped }));
      setLoading(false);
    }
    fetchSettings();
  }, [merchantId]);

  async function handleToggle(key: keyof DashboardSettings) {
    const newVal = !(settings[key] as boolean);
    setSettings(prev => ({ ...prev, [key]: newVal }));
    const { error } = await supabase.from('settings').upsert(
      {
        key: `dashboard_${key}`,
        value: String(newVal),
        description: `Dashboard setting: ${key}`,
        merchant_id: merchantId,
        branch_id: null,
        updated_by: getUpdatedBy(),
      },
      { onConflict: 'merchant_id,key' }
    );
    if (error) { setError(error.message); setSettings(prev => ({ ...prev, [key]: !newVal })); }
  }

  function handleSelect(key: keyof DashboardSettings) {
    return async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      setSettings(prev => ({ ...prev, [key]: value }));
      const { error } = await supabase.from('settings').upsert(
        {
          key: `dashboard_${key}`,
          value,
          description: `Dashboard setting: ${key}`,
          merchant_id: merchantId,
          branch_id: null,
          updated_by: getUpdatedBy(),
        },
        { onConflict: 'merchant_id,key' }
      );
      if (error) setError(error.message);
    };
  }

  return (
    <div id="setting-dashboard" className="scroll-mt-4">
      <SectionCard title="Dashboard & Report Customization" icon={BarChart3} color="indigo"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.dashboard}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        {loading ? <div className="flex items-center justify-center py-10 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div> : (
          <SubSection title="Metrics & Layout" searchQuery={searchQuery}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HField label="Default Date Range" searchQuery={searchQuery}>
                <SelectField value={settings.defaultDateRange} onChange={handleSelect('defaultDateRange')}>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 3 Months</option>
                </SelectField>
              </HField>
              <HField label="Default Chart Type" searchQuery={searchQuery}>
                <SelectField value={settings.defaultChartType} onChange={handleSelect('defaultChartType')}>
                  <option value="area">Area Chart</option>
                  <option value="bar">Bar Chart</option>
                  <option value="line">Line Chart</option>
                </SelectField>
              </HField>
            </div>
            <HToggleRow label="Enable Advanced Analytics" description="Show detailed breakdowns, AOV trends, and cohort analysis" checked={settings.advancedAnalytics} onChange={() => handleToggle('advancedAnalytics')} searchQuery={searchQuery} />
          </SubSection>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================================
// NOTIFICATION SECTION
// ============================================================================

interface NotificationSettings { lowStockNotif: boolean; unpaidAlert: boolean; vipAlert: boolean; scheduledAlert: boolean; emailSummary: boolean; summaryEmail: string; }
const NOTIF_DEFAULTS: NotificationSettings = { lowStockNotif: false, unpaidAlert: false, vipAlert: false, scheduledAlert: false, emailSummary: false, summaryEmail: '' };
const NOTIF_BOOL_KEYS: (keyof NotificationSettings)[] = ['lowStockNotif', 'unpaidAlert', 'vipAlert', 'scheduledAlert', 'emailSummary'];
const NOTIF_ALL_KEYS = Object.keys(NOTIF_DEFAULTS) as (keyof NotificationSettings)[];

function NotificationSection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [settings, setSettings] = useState<NotificationSettings>(NOTIF_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    async function fetchSettings() {
      setLoading(true);
      const { data, error } = await supabase.from('settings').select('key, value')
        .eq('merchant_id', merchantId)
        .is('branch_id', null)
        .in('key', NOTIF_ALL_KEYS.map(k => `notification_${k}`));
      if (error) { setError(error.message); setLoading(false); return; }
      const mapped: Partial<NotificationSettings> = {};
      for (const row of data ?? []) {
        const key = row.key.replace('notification_', '') as keyof NotificationSettings;
        if (!(key in NOTIF_DEFAULTS)) continue;
        (mapped as Record<string, any>)[key] = NOTIF_BOOL_KEYS.includes(key) ? row.value === 'true' : row.value;
      }
      setSettings(prev => ({ ...prev, ...mapped }));
      setLoading(false);
    }
    fetchSettings();
  }, [merchantId]);

  async function handleToggle(key: keyof NotificationSettings) {
    const newVal = !(settings[key] as boolean);
    setSettings(prev => ({ ...prev, [key]: newVal }));
    const { error } = await supabase.from('settings').upsert(
      {
        key: `notification_${key}`,
        value: String(newVal),
        description: `Notification setting: ${key}`,
        merchant_id: merchantId,
        branch_id: null,
        updated_by: getUpdatedBy(),
      },
      { onConflict: 'merchant_id,key' }
    );
    if (error) { setError(error.message); setSettings(prev => ({ ...prev, [key]: !newVal })); }
  }

  function handleChange(key: keyof NotificationSettings) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, [key]: e.target.value }));
  }

  function handleBlur(key: keyof NotificationSettings) {
    return async (e: React.FocusEvent<HTMLInputElement>) => {
      const { error } = await supabase.from('settings').upsert(
        {
          key: `notification_${key}`,
          value: e.target.value,
          description: `Notification setting: ${key}`,
          merchant_id: merchantId,
          branch_id: null,
          updated_by: getUpdatedBy(),
        },
        { onConflict: 'merchant_id,key' }
      );
      if (error) setError(error.message);
    };
  }

  return (
    <div id="setting-notification" className="scroll-mt-4">
      <SectionCard title="Notification Settings" icon={Bell} color="rose"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.notification}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        {loading ? <div className="flex items-center justify-center py-10 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div> : (
          <SubSection title="Alert Toggles" searchQuery={searchQuery}>
            <div className="divide-y divide-gray-100 rounded-lg overflow-hidden">
              <HToggleRow label="Low Stock Alert" checked={settings.lowStockNotif} onChange={() => handleToggle('lowStockNotif')} description="Pop-up alert when inventory falls below threshold" searchQuery={searchQuery} />
              <HToggleRow label="Unpaid Order Alert" checked={settings.unpaidAlert} onChange={() => handleToggle('unpaidAlert')} description="Warn staff of orders pending payment past timeout" searchQuery={searchQuery} />
              <HToggleRow label="VIP Customer Alert" checked={settings.vipAlert} onChange={() => handleToggle('vipAlert')} description="Notify front-of-house when a VIP customer checks in" searchQuery={searchQuery} />
              <HToggleRow label="Scheduled Item Activation" checked={settings.scheduledAlert} onChange={() => handleToggle('scheduledAlert')} description="Alert when a timed menu item goes live" searchQuery={searchQuery} />
              <HToggleRow label="Daily Sales Summary Email" checked={settings.emailSummary} onChange={() => handleToggle('emailSummary')} description="Send end-of-day sales report to manager email" searchQuery={searchQuery} />
            </div>
            {settings.emailSummary && (
              <HField label="Summary Email Address" description="Where to send daily report" searchQuery={searchQuery}>
                <Input type="email" value={settings.summaryEmail} onChange={handleChange('summaryEmail')} onBlur={handleBlur('summaryEmail')} placeholder="manager@yourbusiness.com" />
              </HField>
            )}
          </SubSection>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================================
// CLOUD SECTION
// ============================================================================

interface CloudSettings { syncFrequency: string; conflictResolution: string; offlineMode: boolean; }
const CLOUD_DEFAULTS: CloudSettings = { syncFrequency: 'realtime', conflictResolution: 'server', offlineMode: false };
const CLOUD_BOOL_KEYS: (keyof CloudSettings)[] = ['offlineMode'];
const CLOUD_ALL_KEYS = Object.keys(CLOUD_DEFAULTS) as (keyof CloudSettings)[];

function CloudSection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [settings, setSettings] = useState<CloudSettings>(CLOUD_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<Record<string, 'idle' | 'loading' | 'done'>>({ export: 'idle', backup: 'idle', restore: 'idle' });

  useEffect(() => {
    if (!merchantId) return;
    async function fetchSettings() {
      setLoading(true);
      const { data, error } = await supabase.from('settings').select('key, value')
        .eq('merchant_id', merchantId)
        .is('branch_id', null)
        .in('key', CLOUD_ALL_KEYS.map(k => `cloud_${k}`));
      if (error) { setError(error.message); setLoading(false); return; }
      const mapped: Partial<CloudSettings> = {};
      for (const row of data ?? []) {
        const key = row.key.replace('cloud_', '') as keyof CloudSettings;
        if (!(key in CLOUD_DEFAULTS)) continue;
        (mapped as Record<string, any>)[key] = CLOUD_BOOL_KEYS.includes(key) ? row.value === 'true' : row.value;
      }
      setSettings(prev => ({ ...prev, ...mapped }));
      setLoading(false);
    }
    fetchSettings();
  }, [merchantId]);

  async function handleToggle(key: keyof CloudSettings) {
    const newVal = !(settings[key] as boolean);
    setSettings(prev => ({ ...prev, [key]: newVal }));
    const { error } = await supabase.from('settings').upsert(
      {
        key: `cloud_${key}`,
        value: String(newVal),
        description: `Cloud setting: ${key}`,
        merchant_id: merchantId,
        branch_id: null,
        updated_by: getUpdatedBy(),
      },
      { onConflict: 'merchant_id,key' }
    );
    if (error) { setError(error.message); setSettings(prev => ({ ...prev, [key]: !newVal })); }
  }

  function handleSelect(key: keyof CloudSettings) {
    return async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      setSettings(prev => ({ ...prev, [key]: value }));
      const { error } = await supabase.from('settings').upsert(
        {
          key: `cloud_${key}`,
          value,
          description: `Cloud setting: ${key}`,
          merchant_id: merchantId,
          branch_id: null,
          updated_by: getUpdatedBy(),
        },
        { onConflict: 'merchant_id,key' }
      );
      if (error) setError(error.message);
    };
  }

  async function handleAction(action: 'export' | 'backup' | 'restore') {
    setActionState(prev => ({ ...prev, [action]: 'loading' }));
    try {
      if (action === 'export') {
        const [orders, menu, inventory, customers] = await Promise.all([
          supabase.from('orders').select('*'), supabase.from('menu').select('*'),
          supabase.from('inventory').select('*'), supabase.from('customers').select('*'),
        ]);
        const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), orders: orders.data ?? [], menu: menu.data ?? [], inventory: inventory.data ?? [], customers: customers.data ?? [] }, null, 2)], { type: 'application/json' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `pos-export-${new Date().toISOString().slice(0, 10)}.json` });
        a.click(); URL.revokeObjectURL(a.href);
      } else if (action === 'backup') {
        const { data: settingsData } = await supabase.from('settings').select('*');
        const blob = new Blob([JSON.stringify({ backed_up_at: new Date().toISOString(), settings: settingsData ?? [] }, null, 2)], { type: 'application/json' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `pos-backup-${new Date().toISOString().slice(0, 10)}.json` });
        a.click(); URL.revokeObjectURL(a.href);
        await supabase.from('audit_logs').insert([{ event: 'Manual Backup', details: 'User triggered manual settings backup', status: 'success' }]);
      } else if (action === 'restore') {
        const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          try {
            const payload = JSON.parse(await file.text());
            if (payload.settings) {
              const mappedSettings = payload.settings.map((s: any) => ({
                ...s,
                branch_id: s.branch_id !== undefined ? s.branch_id : null,
                updated_by: getUpdatedBy()
              }));
              await supabase.from('settings').upsert(mappedSettings, { onConflict: 'merchant_id,key' });
              await supabase.from('audit_logs').insert([{ event: 'Settings Restored', details: `Restored from file: ${file.name}`, status: 'success' }]);
            }
          } catch { setError('Invalid backup file.'); }
        };
        input.click();
      }
      setActionState(prev => ({ ...prev, [action]: 'done' }));
      setTimeout(() => setActionState(prev => ({ ...prev, [action]: 'idle' })), 2500);
    } catch (err: any) { setError(err.message ?? 'Action failed.'); setActionState(prev => ({ ...prev, [action]: 'idle' })); }
  }

  const ActionButton = ({ action, icon: Icon, label, colorClass }: { action: 'export' | 'backup' | 'restore'; icon: React.ElementType; label: string; colorClass: string; }) => {
    const state = actionState[action];
    return (
      <button onClick={() => handleAction(action)} disabled={state === 'loading'}
        className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${colorClass}`}>
        {state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : state === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Icon className="w-4 h-4" />}
        {label}
      </button>
    );
  };

  return (
    <div id="setting-cloud" className="scroll-mt-4">
      <SectionCard title="Cloud & Sync Settings" icon={Cloud} color="sky"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.cloud}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        {loading ? <div className="flex items-center justify-center py-10 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div> : (
          <>
            <SubSection title="Sync Options" searchQuery={searchQuery}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <HField label="Sync Frequency" searchQuery={searchQuery}>
                  <SelectField value={settings.syncFrequency} onChange={handleSelect('syncFrequency')}>
                    <option value="realtime">Real-time</option>
                    <option value="5min">Every 5 minutes</option>
                    <option value="manual">Manual only</option>
                  </SelectField>
                </HField>
                <HField label="Conflict Resolution" searchQuery={searchQuery}>
                  <SelectField value={settings.conflictResolution} onChange={handleSelect('conflictResolution')}>
                    <option value="server">Server wins</option>
                    <option value="local">Local wins</option>
                    <option value="ask">Ask each time</option>
                  </SelectField>
                </HField>
              </div>
              <HToggleRow label="Offline Mode" description="Continue taking orders without internet — syncs automatically when reconnected" checked={settings.offlineMode} onChange={() => handleToggle('offlineMode')} searchQuery={searchQuery} />
            </SubSection>
            <SubSection title="Data Management" searchQuery={searchQuery}>
              <div className="flex flex-wrap gap-3">
                <ActionButton action="export" icon={Download} label="Export All Data" colorClass="border-sky-300 text-sky-700 hover:bg-sky-50" />
                <ActionButton action="backup" icon={Database} label="Backup Now" colorClass="border-sky-300 text-sky-700 hover:bg-sky-50" />
                <ActionButton action="restore" icon={RefreshCw} label="Restore from Backup" colorClass="border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:bg-neutral-800/50" />
              </div>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-3">Export downloads orders, menu, inventory and customers as JSON. Backup saves your current settings. Restore uploads a previous backup file.</p>
            </SubSection>
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================================
// LOYALTY SECTION
// ============================================================================

interface LoyaltySettings { loyaltyEnable: boolean; pointsPerRm: string; pointsExpiry: string; promoCode: boolean; scheduledPromotions: boolean; }
const LOYALTY_DEFAULTS: LoyaltySettings = { loyaltyEnable: false, pointsPerRm: '1', pointsExpiry: '365', promoCode: false, scheduledPromotions: false };
const LOYALTY_BOOL_KEYS: (keyof LoyaltySettings)[] = ['loyaltyEnable', 'promoCode', 'scheduledPromotions'];
const LOYALTY_ALL_KEYS = Object.keys(LOYALTY_DEFAULTS) as (keyof LoyaltySettings)[];

function LoyaltySection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [settings, setSettings] = useState<LoyaltySettings>(LOYALTY_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    async function fetchSettings() {
      setLoading(true);
      const { data, error } = await supabase.from('settings').select('key, value')
        .eq('merchant_id', merchantId)
        .is('branch_id', null)
        .in('key', LOYALTY_ALL_KEYS.map(k => `loyalty_${k}`));
      if (error) { setError(error.message); setLoading(false); return; }
      const mapped: Partial<LoyaltySettings> = {};
      for (const row of data ?? []) {
        const key = row.key.replace('loyalty_', '') as keyof LoyaltySettings;
        if (!(key in LOYALTY_DEFAULTS)) continue;
        (mapped as Record<string, any>)[key] = LOYALTY_BOOL_KEYS.includes(key) ? row.value === 'true' : row.value;
      }
      setSettings(prev => ({ ...prev, ...mapped }));
      setLoading(false);
    }
    fetchSettings();
  }, [merchantId]);

  async function handleToggle(key: keyof LoyaltySettings) {
    const newVal = !(settings[key] as boolean);
    setSettings(prev => ({ ...prev, [key]: newVal }));
    const { error } = await supabase.from('settings').upsert(
      {
        key: `loyalty_${key}`,
        value: String(newVal),
        description: `Loyalty setting: ${key}`,
        merchant_id: merchantId,
        branch_id: null,
        updated_by: getUpdatedBy(),
      },
      { onConflict: 'merchant_id,key' }
    );
    if (error) { setError(error.message); setSettings(prev => ({ ...prev, [key]: !newVal })); }
  }

  function handleChange(key: keyof LoyaltySettings) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, [key]: e.target.value }));
  }

  function handleBlur(key: keyof LoyaltySettings) {
    return async (e: React.FocusEvent<HTMLInputElement>) => {
      const { error } = await supabase.from('settings').upsert(
        {
          key: `loyalty_${key}`,
          value: e.target.value,
          description: `Loyalty setting: ${key}`,
          merchant_id: merchantId,
          branch_id: null,
          updated_by: getUpdatedBy(),
        },
        { onConflict: 'merchant_id,key' }
      );
      if (error) setError(error.message);
    };
  }

  return (
    <div id="setting-loyalty" className="scroll-mt-4">
      <SectionCard title="Loyalty & Promotion Settings" icon={Gift} color="pink"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.loyalty}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        {loading ? <div className="flex items-center justify-center py-10 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div> : (
          <>
            <SubSection title="Loyalty Program" searchQuery={searchQuery}>
              <HToggleRow label="Enable Loyalty Program" description="Customers earn points redeemable for discounts" checked={settings.loyaltyEnable} onChange={() => handleToggle('loyaltyEnable')} searchQuery={searchQuery} />
              {settings.loyaltyEnable && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <HField label="Points per RM Spent" searchQuery={searchQuery}>
                    <Input type="number" value={settings.pointsPerRm} onChange={handleChange('pointsPerRm')} onBlur={handleBlur('pointsPerRm')} />
                  </HField>
                  <HField label="Points Expiry (days)" searchQuery={searchQuery}>
                    <Input type="number" value={settings.pointsExpiry} onChange={handleChange('pointsExpiry')} onBlur={handleBlur('pointsExpiry')} placeholder="Leave blank for no expiry" />
                  </HField>
                </div>
              )}
            </SubSection>
            <SubSection title="Promotions" searchQuery={searchQuery}>
              <HToggleRow label="Enable Promo Codes" checked={settings.promoCode} onChange={() => handleToggle('promoCode')} description="Staff can apply promo codes at checkout" searchQuery={searchQuery} />
              <HToggleRow label="Scheduled Promotions" checked={settings.scheduledPromotions} onChange={() => handleToggle('scheduledPromotions')} description="Auto-activate promotions based on date/time rules" searchQuery={searchQuery} />
            </SubSection>
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================================
// SECURITY SECTION
// ============================================================================

interface SecuritySettings { sessionTimeout: string; auditLogRetention: string; twoFactor: boolean; ipRestriction: boolean; }
const SEC_DEFAULTS: SecuritySettings = { sessionTimeout: '30', auditLogRetention: '90', twoFactor: false, ipRestriction: false };
const SEC_BOOL_KEYS: (keyof SecuritySettings)[] = ['twoFactor', 'ipRestriction'];
const SEC_ALL_KEYS = Object.keys(SEC_DEFAULTS) as (keyof SecuritySettings)[];

function SecuritySection({ searchQuery, forceOpen, onToggle, merchantId }: SectionProps) {
  const [settings, setSettings] = useState<SecuritySettings>(SEC_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    async function fetchSettings() {
      setLoading(true);
      const { data, error } = await supabase.from('settings').select('key, value')
        .eq('merchant_id', merchantId)
        .is('branch_id', null)
        .in('key', SEC_ALL_KEYS.map(k => `security_${k}`));
      if (error) { setError(error.message); setLoading(false); return; }
      const mapped: Partial<SecuritySettings> = {};
      for (const row of data ?? []) {
        const key = row.key.replace('security_', '') as keyof SecuritySettings;
        if (!(key in SEC_DEFAULTS)) continue;
        (mapped as Record<string, any>)[key] = SEC_BOOL_KEYS.includes(key) ? row.value === 'true' : row.value;
      }
      setSettings(prev => ({ ...prev, ...mapped }));
      setLoading(false);
    }
    fetchSettings();
  }, [merchantId]);

  async function handleToggle(key: keyof SecuritySettings) {
    const newVal = !(settings[key] as boolean);
    setSettings(prev => ({ ...prev, [key]: newVal }));
    const { error } = await supabase.from('settings').upsert(
      {
        key: `security_${key}`,
        value: String(newVal),
        description: `Security setting: ${key}`,
        merchant_id: merchantId,
        branch_id: null,
        updated_by: getUpdatedBy(),
      },
      { onConflict: 'merchant_id,key' }
    );
    if (error) { setError(error.message); setSettings(prev => ({ ...prev, [key]: !newVal })); }
  }

  function handleChange(key: keyof SecuritySettings) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, [key]: e.target.value }));
  }

  function handleBlur(key: keyof SecuritySettings) {
    return async (e: React.FocusEvent<HTMLInputElement>) => {
      const { error } = await supabase.from('settings').upsert(
        {
          key: `security_${key}`,
          value: e.target.value,
          description: `Security setting: ${key}`,
          merchant_id: merchantId,
          branch_id: null,
          updated_by: getUpdatedBy(),
        },
        { onConflict: 'merchant_id,key' }
      );
      if (error) setError(error.message);
    };
  }

  return (
    <div id="setting-security" className="scroll-mt-4">
      <SectionCard title="Security Settings" icon={Shield} color="slate"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.security}>
        {error && <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
        {loading ? <div className="flex items-center justify-center py-10 text-gray-400 dark:text-neutral-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...</div> : (
          <SubSection title="Access Controls" searchQuery={searchQuery}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HField label="Session Timeout (minutes)" description="Auto-logout after inactivity" searchQuery={searchQuery}>
                <Input type="number" value={settings.sessionTimeout} onChange={handleChange('sessionTimeout')} onBlur={handleBlur('sessionTimeout')} />
              </HField>
              <HField label="Audit Log Retention (days)" searchQuery={searchQuery}>
                <Input type="number" value={settings.auditLogRetention} onChange={handleChange('auditLogRetention')} onBlur={handleBlur('auditLogRetention')} />
              </HField>
            </div>
            <div className="divide-y divide-gray-100 rounded-lg overflow-hidden mt-2">
              <HToggleRow label="Two-Factor Authentication (Manager)" description="Require OTP for manager-level actions" checked={settings.twoFactor} onChange={() => handleToggle('twoFactor')} searchQuery={searchQuery} />
              <HToggleRow label="IP Restriction" description="Restrict POS access to allowlisted IP ranges only" checked={settings.ipRestriction} onChange={() => handleToggle('ipRestriction')} warning="Ensure your static IP is added before enabling" searchQuery={searchQuery} />
            </div>
          </SubSection>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================================
// APPEARANCE SECTION
// ============================================================================

function AppearanceSection({ searchQuery, forceOpen, onToggle }: SectionProps) {
  const { language, setLanguage } = useTranslation();
  const { settings, updateSetting } = useSettings();

  return (
    <div id="setting-appearance" className="scroll-mt-4">
      <SectionCard title="Appearance & UI Settings" icon={Palette} color="purple"
        forceOpen={forceOpen} onToggle={onToggle} searchQuery={searchQuery} snippets={SECTION_SNIPPETS.appearance}>
        <SubSection title="Theme & Layout" searchQuery={searchQuery}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HField label="Theme" searchQuery={searchQuery}>
              <div className="flex gap-2">
                {([['Light', Sun, 'light'], ['Dark', Moon, 'dark'], ['System', Monitor, 'system']] as const).map(([l, Icon, value]) => (
                  <button key={value} onClick={() => updateSetting('theme', value)}
                    className={cn('flex-1 flex flex-col items-center gap-1 py-3 border rounded-lg text-xs font-medium transition-colors',
                      settings.theme === value
                        ? 'border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'border-gray-200 dark:border-[var(--sb-border)] text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:bg-neutral-800/50 dark:border-gray-600 dark:text-gray-400 dark:text-neutral-500 dark:hover:bg-gray-800')}>
                    <Icon className="w-4 h-4" />{l}
                  </button>
                ))}
              </div>
            </HField>
            <HField label="Table View Style" searchQuery={searchQuery}>
              <SelectField value={settings.tableViewStyle} onChange={e => updateSetting('tableViewStyle', e.target.value as any)}>
                <option value="grid">Grid</option>
                <option value="list">List</option>
              </SelectField>
            </HField>
            <HField label="Density" searchQuery={searchQuery}>
              <SelectField value={settings.density} onChange={e => updateSetting('density', e.target.value as any)}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
                <option value="spacious">Spacious</option>
              </SelectField>
            </HField>
            <HField label="Font Size" searchQuery={searchQuery}>
              <SelectField value={settings.fontSize} onChange={e => updateSetting('fontSize', e.target.value as any)}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </SelectField>
            </HField>
          </div>
        </SubSection>
        <SubSection title="Customization" searchQuery={searchQuery}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HField label="Accent Color" searchQuery={searchQuery}>
              <div className="flex gap-2">
                {['bg-indigo-600', 'bg-emerald-600', 'bg-rose-600', 'bg-amber-500', 'bg-blue-600', 'bg-purple-600'].map(color => (
                  <button key={color} onClick={() => updateSetting('accentColor', color)}
                    className={cn('w-8 h-8 rounded-full border-2 transition-transform hover:scale-110', color,
                      settings.accentColor === color ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-gray-900' : 'border-transparent')} />
                ))}
              </div>
            </HField>
            <HField label="Animation Speed" searchQuery={searchQuery}>
              <SelectField value={settings.animationSpeed} onChange={e => updateSetting('animationSpeed', e.target.value as any)}>
                <option value="fast">Fast</option>
                <option value="normal">Normal</option>
                <option value="slow">Slow</option>
                <option value="none">Reduce Motion</option>
              </SelectField>
            </HField>
          </div>
          <HToggleRow label="Show Sidebar Labels" description="Display text labels next to icons in the sidebar" checked={settings.toggles?.sidebarLabels ?? true}
            onChange={() => updateSetting('toggles', { ...settings.toggles, sidebarLabels: !(settings.toggles?.sidebarLabels ?? true) })} searchQuery={searchQuery} />
          <HToggleRow label="High Contrast Mode" description="Increase contrast for better readability" checked={settings.toggles?.highContrast ?? false}
            onChange={() => updateSetting('toggles', { ...settings.toggles, highContrast: !(settings.toggles?.highContrast ?? false) })} searchQuery={searchQuery} />
        </SubSection>
        <SubSection title="Language & Translation" searchQuery={searchQuery}>
          <div className="bg-purple-50 text-purple-800 p-3.5 rounded-lg text-sm border border-purple-200 flex gap-2 mb-4 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
            <span>The system uses <strong>Google Gemini AI</strong> to automatically translate the interface to your preferred language.</span>
          </div>
          <HField label="System Language" searchQuery={searchQuery}>
            <SelectField value={language} onChange={e => { setLanguage(e.target.value); updateSetting('language', e.target.value); }}>
              <option value="en">English (Default)</option>
              <option value="ms">Bahasa Melayu</option>
              <option value="zh">Chinese (Simplified)</option>
              <option value="ta">Tamil</option>
            </SelectField>
          </HField>
        </SubSection>
      </SectionCard>
    </div>
  );
}

// ============================================================================
// MAIN SETTINGS COMPONENT
// ============================================================================

interface BranchInfo { id: string; name: string; code: string; }

function getLocalMerchantId(): string {
  try {
    return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? '';
  } catch { return ''; }
}

export function Settings({ onNavigatePage }: { onNavigatePage?: (tab: string) => void }) {
  const [activeSection, setActiveSection] = useState('general');
  const [openSection, setOpenSection] = useState<string | null>('general');
  const [sectionSearch, setSectionSearch] = useState('');
  const { settings, setToggle } = useSettings();
  const toggles = settings.toggles;
  
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const activeMerchantId = (isImpersonating ? impersonatedMerchantId : getLocalMerchantId()) ?? '';

  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranchId, setCurrentBranchId] = useState<string>('');

  useEffect(() => {
    if (!activeMerchantId) return;
    const fetchBranches = async () => {
      const { data } = await supabase.from('branches').select('id, name, code')
        .eq('merchant_id', activeMerchantId).eq('is_active', true).order('name', { ascending: true });
      const list = data ?? [];
      setBranches(list);
      if (list.length > 0) setCurrentBranchId(list[0].id);
    };
    fetchBranches();
  }, [activeMerchantId]);

  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    setOpenSection(sectionId);
    setTimeout(() => {
      document.getElementById(`setting-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const sectionProps = (id: string) => ({
    toggles,
    setToggle,
    searchQuery: sectionSearch,
    forceOpen: openSection === id,
    onToggle: () => setOpenSection(p => p === id ? null : id),
    merchantId: activeMerchantId,
  });

  return (
    <div className="flex gap-6 max-w-7xl">
      <SidebarNav activeSection={activeSection} onNavigate={handleNavigate} />

      <div className="flex-1 min-w-0 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">Configure your POS system, branches, users, and integrations.</p>
        </div>

        <SearchBar value={sectionSearch} onChange={setSectionSearch} />

        <GeneralSection      {...sectionProps('general')} />
        <BranchSection       {...sectionProps('branch')} onNavigatePage={onNavigatePage} />
        <DevicesSection      {...sectionProps('devices')} />
        <UsersSection        {...sectionProps('users')} />
        <PaymentSection      {...sectionProps('payment')} />
        <TaxSection          {...sectionProps('tax')} />
        <MenuSection         {...sectionProps('menu')} />
        <TableSection        {...sectionProps('table')} />
        <InventorySection    {...sectionProps('inventory')} />
        <DashboardSection    {...sectionProps('dashboard')} />
        <NotificationSection {...sectionProps('notification')} />
        <CloudSection        {...sectionProps('cloud')} />
        <LoyaltySection      {...sectionProps('loyalty')} />
        <SecuritySection     {...sectionProps('security')} />
        <AppearanceSection   {...sectionProps('appearance')} />
      </div>

      <AISettingsAssistant onNavigate={handleNavigate} />
    </div>
  );
}