/**
 * Shared Auth Design System Tokens & Style Classes
 * Provides a unified luxury Espresso Noir & Amber Gold aesthetic across all Auth & Onboarding pages.
 */

export const AUTH_STYLES = {
  // Brand Colors
  amber: '#D97706',
  amberDark: '#B45309',
  espressoBg: '#0F0E0D',
  iconBadgeBg: '#D97706',
  iconBadgeBorder: '#D97706',

  // Card Container
  card: 'relative z-10 bg-white rounded-3xl shadow-2xl shadow-black/40 border border-white/10 overflow-hidden p-6 md:p-8',
  
  // Icon Badge Container (e.g. Utensils, Building, Lock)
  iconBadge: 'bg-[#D97706] text-white p-3 rounded-2xl w-fit shadow-lg shadow-amber-600/30 mx-auto mb-4',

  // Primary Button
  primaryButton: 'w-full py-3.5 px-4 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white font-semibold text-sm transition-all shadow-lg shadow-[#D97706]/25 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 cursor-pointer',

  // Secondary Button
  secondaryButton: 'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-amber-200 text-amber-700 hover:bg-amber-50 transition-all cursor-pointer',

  // Text Input
  input: 'w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#D97706] focus:ring-4 focus:ring-[#D97706]/15 transition-all',

  // Disabled Input
  disabledInput: 'w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed',

  // Amber Tag / Badge
  badge: 'text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold',

  // Back Link
  backLink: 'inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#D97706] font-medium transition-colors',

  // Form Label
  label: 'block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5',
};
