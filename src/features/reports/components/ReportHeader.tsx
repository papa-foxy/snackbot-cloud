import { useState, useRef, useEffect } from 'react';
import {
  RefreshCw, SlidersHorizontal, Sparkles, X, Eye, CheckSquare, Square,
  Calendar, ChevronDown, Download
} from 'lucide-react';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn } from '../../../utils/cn';
import { DateRange, InsightSection } from '../types';
import { DATE_PRESETS, INSIGHT_CONFIGS, colorMap } from '../constants';

interface ReportHeaderProps {
  lastSynced: Date | null;
  loading: boolean;
  dateRange: DateRange;
  onDateRangeChange: (r: DateRange) => void;
  visibleInsights: InsightSection[];
  onToggleInsight: (id: InsightSection) => void;
  showAiDrawer: boolean;
  onToggleAiDrawer: () => void;
  onRefresh: () => void;
  onExportCSV: () => void;
  showFilter: boolean;
  onToggleFilter: () => void;
  branches: { id: string; name: string }[];
  selectedBranchId: string;
  onBranchChange: (id: string) => void;
}

export function ReportHeader({
  lastSynced,
  loading,
  dateRange,
  onDateRangeChange,
  visibleInsights,
  onToggleInsight,
  showAiDrawer,
  onToggleAiDrawer,
  onRefresh,
  onExportCSV,
  showFilter,
  onToggleFilter,
  branches,
  selectedBranchId,
  onBranchChange
}: ReportHeaderProps) {
  const { themeColors } = useSettings();
  const [showDatePicker, setShowDatePicker]         = useState(false);
  const [customFrom, setCustomFrom]                 = useState('');
  const [customTo, setCustomTo]                     = useState('');
  const [showInsightSelector, setShowInsightSelector] = useState(false);
  const insightSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (insightSelectorRef.current && !insightSelectorRef.current.contains(e.target as Node)) setShowInsightSelector(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    onDateRangeChange({ from: new Date(customFrom), to: new Date(customTo), label: `${customFrom} → ${customTo}` });
    setShowDatePicker(false);
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          Business Reports
          {loading && <RefreshCw className={cn('w-4 h-4 animate-spin', themeColors.text)} />}
        </h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1 flex items-center gap-2">
          {lastSynced && <span className="text-xs text-gray-400 dark:text-neutral-500">Last synced {lastSynced.toLocaleTimeString()}</span>}
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-600 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live Data
          </span>
        </p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {/* Filter toggle */}
        <button onClick={onToggleFilter}
          className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border',
            showFilter
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              : 'bg-white dark:bg-[var(--sb-card)] text-gray-700 dark:text-neutral-300 border-gray-300 dark:border-neutral-600 hover:bg-gray-50')}>
          <SlidersHorizontal className="w-4 h-4" />
          {showFilter ? 'Hide Filters' : 'Show Filters'}
        </button>

        {/* AI Insights */}
        <button onClick={onToggleAiDrawer}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm',
            showAiDrawer
              ? `${themeColors.bg} text-white ring-4 ${themeColors.bgLight.replace('bg-', 'ring-')}`
              : `bg-white dark:bg-[var(--sb-card)] ${themeColors.text} border ${themeColors.border} hover:${themeColors.bgLight}`)}>
          <Sparkles className={cn('w-4 h-4', showAiDrawer ? 'text-white' : themeColors.text)} />
          AI Insights
          {showAiDrawer && <X className="w-3.5 h-3.5 ml-1 opacity-60" />}
        </button>

        {/* Insight Visibility Selector */}
        <div className="relative" ref={insightSelectorRef}>
          <button onClick={() => setShowInsightSelector(p => !p)}
            className={cn('flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors',
              showInsightSelector ? `${themeColors.bg} text-white border-transparent` : 'bg-white dark:bg-[var(--sb-card)] text-gray-700 dark:text-neutral-300 border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:bg-neutral-800/50')}>
            <Eye className="w-4 h-4" /> Insights
            <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full leading-none',
              showInsightSelector ? `bg-white dark:bg-[var(--sb-card)] ${themeColors.text}` : `${themeColors.bgLight} ${themeColors.textLight}`)}>
              {visibleInsights.length}/{INSIGHT_CONFIGS.length}
            </span>
          </button>
          {showInsightSelector && (
            <div className="absolute right-0 mt-1 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl shadow-xl z-20 w-72 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50">
                <p className="text-xs font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wide">Visible Insight Sections</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Select which sections appear on the report</p>
              </div>
              <div className="p-2 space-y-1">
                {INSIGHT_CONFIGS.map(cfg => {
                  const active = visibleInsights.includes(cfg.id);
                  const c = colorMap[cfg.color]; const Icon = cfg.icon;
                  return (
                    <button key={cfg.id} onClick={() => onToggleInsight(cfg.id)}
                      className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                        active ? cn(c.bg, c.border, 'border') : 'hover:bg-gray-50 dark:bg-neutral-800/50 border border-transparent')}>
                      <div className={cn('p-1.5 rounded-md', active ? 'bg-white dark:bg-[var(--sb-card)] shadow-sm' : 'bg-gray-100 dark:bg-neutral-800')}>
                        <Icon className={cn('w-3.5 h-3.5', active ? c.text : 'text-gray-400 dark:text-neutral-500')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-semibold', active ? 'text-gray-900 dark:text-neutral-100' : 'text-gray-500 dark:text-neutral-500')}>{cfg.label}</p>
                        <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">{cfg.description}</p>
                      </div>
                      {active ? <CheckSquare className={cn('w-4 h-4 shrink-0', c.text)} /> : <Square className="w-4 h-4 shrink-0 text-gray-300" />}
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-2 border-t border-gray-100 dark:border-[var(--sb-border)] flex gap-2">
                <button onClick={() => INSIGHT_CONFIGS.forEach(c => !visibleInsights.includes(c.id) && onToggleInsight(c.id))}
                  className={cn('flex-1 text-xs font-medium py-1', themeColors.text, 'hover:opacity-80')}>Show all</button>
                <button onClick={() => INSIGHT_CONFIGS.forEach(c => visibleInsights.includes(c.id) && onToggleInsight(c.id))}
                  className="flex-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 font-medium py-1">Hide all</button>
              </div>
            </div>
          )}
        </div>

        {/* Refresh */}
        <button onClick={onRefresh} disabled={loading}
          className="p-2 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg text-gray-500 dark:text-neutral-500 hover:bg-gray-50 dark:bg-neutral-800/50 disabled:opacity-50" title="Refresh">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>

        {/* Branch Selector */}
        {branches.length > 0 && (
          <div className="relative">
            <select
              value={selectedBranchId}
              onChange={e => onBranchChange(e.target.value)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id} className="bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date picker */}
        <div className="relative">
          <button onClick={() => setShowDatePicker(p => !p)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:bg-neutral-800/50">
            <Calendar className="w-4 h-4" />{dateRange.label}<ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500" />
          </button>
          {showDatePicker && (
            <div className="absolute right-0 mt-1 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl shadow-xl z-20 w-72 overflow-hidden">
              {DATE_PRESETS.map(r => (
                <button key={r.label} onClick={() => { onDateRangeChange(r); setShowDatePicker(false); }}
                  className={cn('block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:bg-neutral-800/50 border-b border-gray-100 dark:border-[var(--sb-border)] last:border-0',
                    dateRange.label === r.label ? `${themeColors.text} font-semibold ${themeColors.bgLight}` : 'text-gray-700 dark:text-neutral-300')}>
                  {r.label}
                </button>
              ))}
              <div className="p-3 border-t border-gray-100 dark:border-[var(--sb-border)] space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Custom Range</p>
                <div className="flex gap-2">
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className={cn('flex-1 px-2 py-1.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-xs focus:outline-none focus:ring-2', `focus:ring-${themeColors.bg.split('-')[1]}-500`)} />
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    className={cn('flex-1 px-2 py-1.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-xs focus:outline-none focus:ring-2', `focus:ring-${themeColors.bg.split('-')[1]}-500`)} />
                </div>
                <button onClick={applyCustomRange} className={cn('w-full py-1.5 text-white text-xs font-semibold rounded-lg hover:opacity-90', themeColors.bg)}>Apply</button>
              </div>
            </div>
          )}
        </div>

        {/* Export */}
        <button onClick={onExportCSV}
          className={cn('flex items-center gap-2 px-3 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm', themeColors.bg)}>
          <Download className="w-4 h-4" />Export CSV
        </button>
      </div>
    </div>
  );
}
