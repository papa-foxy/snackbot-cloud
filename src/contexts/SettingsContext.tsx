import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ToggleState } from '../features/settings';

// ── Get current merchant ID from localStorage ─────────────────────────────────
function getMerchantId(): string {
  try {
    return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? '';
  } catch {
    return '';
  }
}

export interface ThemeColors {
  bg: string;
  text: string;
  bgLight: string;
  textLight: string;
  border: string;
}

export interface SettingsState {
  toggles:        ToggleState;
  theme:          'light' | 'dark' | 'system';
  tableViewStyle: 'grid' | 'list';
  density:        'comfortable' | 'compact' | 'spacious';
  fontSize:       'small' | 'medium' | 'large';
  accentColor:    string;
  animationSpeed: 'fast' | 'normal' | 'slow' | 'none';
  language:       string;
}

interface SettingsContextType {
  settings:      SettingsState;
  loading:       boolean;
  themeColors:   ThemeColors;
  setToggle:     (key: keyof ToggleState) => (v: boolean) => void;
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}

// ── Appearance-only toggles ───────────────────────────────────────────────────
const defaultToggles: ToggleState = {
  sidebarLabels: true,
  highContrast:  false,
  showLogo: true, showTax: true, showQr: false, autoPrint: false,
  eInvoiceAuto: false, autoConsolidate: false,
  negativeStock: false, hideOutOfStock: true, priceOverride: false,
  scheduledItems: false, modifierRequired: false,
  tableMerge: false, tableTransfer: false, autoRelease: false,
  qrOrdering: false, autoClose: false,
  lowStockAlert: false, autoDeduction: false, ingredientTracking: false,
  advancedAnalytics: false,
  lowStockNotif: true, unpaidAlert: true, vipAlert: false,
  scheduledAlert: false, emailSummary: false,
  offlineMode: false,
  loyaltyEnable: false, promoCode: false,
  twoFactor: false, ipRestriction: false,
  darkMode: false, splitBill: true, partialPayment: true,
  taxInclusive: false,
};

const defaultSettings: SettingsState = {
  toggles:        defaultToggles,
  theme:          'light',
  tableViewStyle: 'grid',
  density:        'comfortable',
  fontSize:       'medium',
  accentColor:    'bg-indigo-600',
  animationSpeed: 'normal',
  language:       'en',
};

// ── Map DB row → SettingsState ────────────────────────────────────────────────
function dbToSettings(row: any): Partial<SettingsState> {
  return {
    theme:          row.theme            ?? 'light',
    tableViewStyle: row.table_view_style ?? 'grid',
    density:        row.density          ?? 'comfortable',
    fontSize:       row.font_size        ?? 'medium',
    accentColor:    row.accent_color     ?? 'bg-indigo-600',
    animationSpeed: row.animation_speed  ?? 'normal',
    language:       row.language         ?? 'en',
    toggles: {
      ...defaultToggles,
      sidebarLabels: row.sidebar_labels ?? true,
      highContrast:  row.high_contrast  ?? false,
    },
  };
}

// ── Map SettingsState key → DB column ─────────────────────────────────────────
function settingsKeyToCol(key: keyof SettingsState): string {
  const map: Partial<Record<keyof SettingsState, string>> = {
    tableViewStyle: 'table_view_style',
    fontSize:       'font_size',
    accentColor:    'accent_color',
    animationSpeed: 'animation_speed',
  };
  return map[key] ?? key;
}

// ── Accent → ThemeColors (Tailwind classes) ───────────────────────────────────
function getThemeColors(accentColor: string): ThemeColors {
  switch (accentColor) {
    case 'bg-emerald-600': return { bg: 'bg-emerald-600', text: 'text-emerald-600', bgLight: 'bg-emerald-50', textLight: 'text-emerald-700', border: 'border-emerald-200' };
    case 'bg-rose-600':    return { bg: 'bg-rose-600',    text: 'text-rose-600',    bgLight: 'bg-rose-50',    textLight: 'text-rose-700',    border: 'border-rose-200'    };
    case 'bg-amber-500':   return { bg: 'bg-amber-500',   text: 'text-amber-600',   bgLight: 'bg-amber-50',   textLight: 'text-amber-700',   border: 'border-amber-200'   };
    case 'bg-blue-600':    return { bg: 'bg-blue-600',    text: 'text-blue-600',    bgLight: 'bg-blue-50',    textLight: 'text-blue-700',    border: 'border-blue-200'    };
    case 'bg-purple-600':  return { bg: 'bg-purple-600',  text: 'text-purple-600',  bgLight: 'bg-purple-50',  textLight: 'text-purple-700',  border: 'border-purple-200'  };
    case 'bg-indigo-600':
    default:               return { bg: 'bg-indigo-600',  text: 'text-indigo-600',  bgLight: 'bg-indigo-50',  textLight: 'text-indigo-700',  border: 'border-indigo-200'  };
  }
}

// ── Accent → CSS hex palette ──────────────────────────────────────────────────
const colorHexMap: Record<string, { main: string; light: string; dark: string; text: string; border: string }> = {
  'bg-emerald-600': { main: '#10B981', light: '#ECFDF5', dark: '#047857', text: '#059669', border: '#A7F3D0' },
  'bg-rose-600':    { main: '#F43F5E', light: '#FFF1F2', dark: '#BE123C', text: '#E11D48', border: '#FECDD3' },
  'bg-amber-500':   { main: '#f59e0b', light: '#fffbeb', dark: '#d97706', text: '#d97706', border: '#fde68a' },
  'bg-blue-600':    { main: '#3B82F6', light: '#EFF6FF', dark: '#1d4ed8', text: '#3B82F6', border: '#BFDBFE' },
  'bg-purple-600':  { main: '#9333ea', light: '#faf5ff', dark: '#7e22ce', text: '#9333ea', border: '#e9d5ff' },
  'bg-indigo-600':  { main: '#4f46e5', light: '#eef2ff', dark: '#4338ca', text: '#4f46e5', border: '#c7d2fe' },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(() => {
    const saved = localStorage.getItem('app_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultSettings, ...parsed, toggles: { ...defaultToggles, ...parsed.toggles } };
      } catch {}
    }
    return defaultSettings;
  });
  const [loading, setLoading] = useState(true);

  // ── Fetch appearance from Supabase on mount ────────────────────────────────
  useEffect(() => {
    async function fetchAppearance() {
      const merchantId = getMerchantId();
      if (!merchantId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('business')
        .select('theme, table_view_style, density, font_size, accent_color, animation_speed, sidebar_labels, high_contrast, language')
        .eq('id', merchantId)
        .single();

      if (!error && data) {
        const fromDb = dbToSettings(data);
        setSettings(prev => {
          const merged = { ...prev, ...fromDb, toggles: { ...prev.toggles, ...fromDb.toggles } };
          localStorage.setItem('app_settings', JSON.stringify(merged));
          return merged;
        });
      }
      setLoading(false);
    }
    fetchAppearance();
  }, []);

  // ── Apply Settings & CSS Variables ───────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    const mq   = window.matchMedia?.('(prefers-color-scheme: dark)');

    const applyAll = () => {
      const isDark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && (mq?.matches ?? false));
      root.classList.toggle('dark', isDark);

      if (isDark) {
        root.style.setProperty('--sb-sidebar', '#0F172A');
        root.style.setProperty('--sb-main',    '#0F172A');
        root.style.setProperty('--sb-card',    '#1E293B');
        root.style.setProperty('--sb-border',  '#334155');
        root.style.setProperty('--text-main',  '#F8FAFC');
      } else {
        root.style.setProperty('--sb-sidebar', '#FFFFFF');
        root.style.setProperty('--sb-main',    '#FFFFFF');
        root.style.setProperty('--sb-card',    '#F8FAFC');
        root.style.setProperty('--sb-border',  '#E2E8F0');
        root.style.setProperty('--text-main',  '#000000');
      }

      // High Contrast
      root.classList.toggle('high-contrast', settings.toggles.highContrast);

      // Font Size
      root.classList.remove('text-sm', 'text-base', 'text-lg');
      if (settings.fontSize === 'small')  root.classList.add('text-sm');
      if (settings.fontSize === 'medium') root.classList.add('text-base');
      if (settings.fontSize === 'large')  root.classList.add('text-lg');

      // Animation speed
      root.classList.remove('motion-reduce', 'duration-75', 'duration-300', 'duration-700');
      if (settings.animationSpeed === 'none')       root.classList.add('motion-reduce');
      else if (settings.animationSpeed === 'fast')  root.classList.add('duration-75');
      else if (settings.animationSpeed === 'slow')  root.classList.add('duration-700');
      else                                          root.classList.add('duration-300');

      // Density
      root.setAttribute('data-density', settings.density);

      // Accent colour CSS variables
      const palette = colorHexMap[settings.accentColor] ?? colorHexMap['bg-indigo-600'];
      let primaryMain = palette.main;
      if (settings.accentColor === 'bg-blue-600' && isDark) {
        primaryMain = '#60A5FA';
      }

      root.style.setProperty('--color-primary',        primaryMain);
      root.style.setProperty('--color-primary-light',  palette.light);
      root.style.setProperty('--color-primary-dark',   palette.dark);
      root.style.setProperty('--color-primary-text',   palette.text);
      root.style.setProperty('--color-primary-border', palette.border);
    };

    applyAll();

    // Persist locally
    localStorage.setItem('app_settings', JSON.stringify(settings));

    if (settings.theme === 'system' && mq) {
      mq.addEventListener('change', applyAll);
      return () => mq.removeEventListener('change', applyAll);
    }
  }, [
    settings.accentColor,
    settings.animationSpeed,
    settings.density,
    settings.fontSize,
    settings.toggles.highContrast,
    settings.theme,
    settings,
  ]);

  // ── Save a setting to Supabase ─────────────────────────────────────────────
  const persistSetting = useCallback(async (col: string, value: any) => {
    const merchantId = getMerchantId();
    if (!merchantId) return;

    const { error } = await supabase
      .from('business')
      .update({ [col]: value })
      .eq('id', merchantId);
    if (error) console.error('Failed to save setting:', col, error.message);
  }, []);

  // ── updateSetting ──────────────────────────────────────────────────────────
  const updateSetting = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));

    if (key === 'toggles') {
      const t = value as ToggleState;
      persistSetting('sidebar_labels', t.sidebarLabels);
      persistSetting('high_contrast',  t.highContrast);
    } else {
      persistSetting(settingsKeyToCol(key), value);
    }
  }, [persistSetting]);

  // ── setToggle (legacy API) ─────────────────────────────────────────────────
  const setToggle = useCallback((key: keyof ToggleState) => (v: boolean) => {
    setSettings(prev => ({
      ...prev,
      toggles: { ...prev.toggles, [key]: v },
    }));
    if (key === 'sidebarLabels') persistSetting('sidebar_labels', v);
    if (key === 'highContrast')  persistSetting('high_contrast',  v);
  }, [persistSetting]);

  return (
    <SettingsContext.Provider value={{ settings, loading, themeColors: getThemeColors(settings.accentColor), setToggle, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}