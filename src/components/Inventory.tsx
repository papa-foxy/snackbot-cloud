import React, { useState, useEffect, useRef } from 'react';
import {
  Search, ChefHat, X, Filter,
  Plus, Loader2, Sparkles,
  Trash2, Edit2, Package, AlertTriangle,
  TrendingUp, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../contexts/TranslationContext';
import { cn } from '../utils/cn';
import { GoogleGenAI } from "@google/genai";
import { useDataLoader } from '../hooks/useDataLoader';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'in_stock', 'low_stock', 'out_of_stock'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const statusFilterLabels: Record<StatusFilter, string> = {
  all: 'All',
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
};

// ─────────────────────────────────────────────────────────────────────────────
// InventoryHeader
// ─────────────────────────────────────────────────────────────────────────────

interface InventoryHeaderProps {
  analyzing: boolean;
  onAIAnalysis: () => void;
  onAddNew: () => void;
}

function InventoryHeader({ analyzing, onAIAnalysis, onAddNew }: InventoryHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('inventory.title', 'Inventory Management')}</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 dark:text-neutral-400 mt-1">{t('inventory.subtitle', 'Track and manage your stock levels.')}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onAIAnalysis}
          disabled={analyzing}
          className="flex items-center px-4 py-2 bg-white dark:bg-[var(--sb-card)] dark:bg-[var(--sb-card)] border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 rounded-lg text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {t('inventory.aiAnalysis', 'AI Stock Analysis')}
        </button>
        <button
          onClick={onAddNew}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('inventory.addNew', 'Add Item')}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AIAnalysisPanel
// ─────────────────────────────────────────────────────────────────────────────

interface AIAnalysisPanelProps {
  showAnalysis: boolean;
  setShowAnalysis: (show: boolean) => void;
  analysisResult: any[];
  missingItems: any[];
  items: any[];
  onApplyRestock: (recommendation: any) => void;
  onAddMissingItem: (missing: any) => void;
}

function AIAnalysisPanel({
  showAnalysis, setShowAnalysis, analysisResult, missingItems, items, onApplyRestock, onAddMissingItem
}: AIAnalysisPanelProps) {
  const restockRef = useRef<HTMLDivElement>(null);
  const missingRef = useRef<HTMLDivElement>(null);

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, dir: 'left' | 'right') => {
    ref.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  };

  if (!showAnalysis) return null;
  return (
    <div className="bg-indigo-50 border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 rounded-xl p-6 animate-in fade-in slide-in-from-top-4 duration-300 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          AI Stock Analysis
        </h3>
        <button onClick={() => setShowAnalysis(false)} className="text-indigo-400 hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      {analysisResult.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Restock Recommendations
              <span className="text-xs bg-indigo-200 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-100 px-2 py-0.5 rounded-full font-semibold">{analysisResult.length}</span>
            </h4>
            <div className="flex gap-1">
              <button onClick={() => scroll(restockRef, 'left')}
                className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-indigo-100 dark:border-neutral-700 text-indigo-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => scroll(restockRef, 'right')}
                className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-indigo-100 dark:border-neutral-700 text-indigo-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div ref={restockRef} className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {analysisResult.map((res, idx) => {
              const exists = items.some(i => i.name.toLowerCase() === res.item_name.toLowerCase());
              return (
                <div key={idx} className="bg-white dark:bg-neutral-900 p-4 rounded-lg border border-indigo-100 dark:border-neutral-800 shadow-sm shrink-0 w-64 snap-start flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-gray-900 dark:text-neutral-100">{res.item_name}</h4>
                    <span className={cn(
                      "text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ml-2",
                      res.priority === 'High' ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200" :
                        res.priority === 'Medium' ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200" :
                          "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                    )}>
                      {res.priority}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-neutral-300 flex-1">{res.reason}</p>
                  <div className="flex items-center justify-between pt-2 mt-3 border-t border-gray-100 dark:border-neutral-800">
                    <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">Suggested Add:</span>
                    <span className="text-sm font-bold text-indigo-600">+{res.suggested_add}</span>
                  </div>
                  <button
                    onClick={() => onApplyRestock(res)}
                    className={cn(
                      "mt-3 w-full py-1.5 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1",
                      exists ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700"
                    )}
                  >
                    {exists ? (
                      <><TrendingUp className="w-3 h-3" />Apply Restock +{res.suggested_add}</>
                    ) : (
                      <><Plus className="w-3 h-3" />Add to Inventory</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {missingItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
              <ChefHat className="w-4 h-4" />
              Missing Ingredients
              <span className="text-xs bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100 px-2 py-0.5 rounded-full font-semibold">{missingItems.length}</span>
              <span className="text-xs text-amber-600 dark:text-amber-200 font-normal">— used in menu recipes but not tracked in inventory</span>
            </h4>
            <div className="flex gap-1">
              <button onClick={() => scroll(missingRef, 'left')}
                className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-amber-100 dark:border-neutral-700 text-amber-400 hover:text-amber-600 hover:border-amber-300 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => scroll(missingRef, 'right')}
                className="p-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-amber-100 dark:border-neutral-700 text-amber-400 hover:text-amber-600 hover:border-amber-300 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div ref={missingRef} className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {missingItems.map((m, idx) => (
              <div key={idx} className="bg-white dark:bg-neutral-900 p-4 rounded-lg border border-amber-100 dark:border-neutral-800 shadow-sm shrink-0 w-64 snap-start flex flex-col">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-bold text-gray-900 dark:text-neutral-100 text-sm">{m.ingredient_name}</h4>
                  <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 font-bold px-2 py-0.5 rounded ml-2 shrink-0">Missing</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mb-1">
                  Used in: <span className="font-medium text-gray-700 dark:text-neutral-200">{m.used_in}</span>
                </p>
                {m.reason
                  ? <p className="text-xs text-gray-400 dark:text-neutral-500 italic flex-1">{m.reason}</p>
                  : <div className="flex-1" />}
                <div className="flex items-center justify-between pt-2 mt-3 border-t border-gray-100 dark:border-neutral-800 mb-3">
                  <span className="text-xs font-medium text-gray-500 dark:text-neutral-400">Suggested unit:</span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded">{m.suggested_unit}</span>
                </div>
                <button
                  onClick={() => onAddMissingItem(m)}
                  className="w-full py-1.5 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600"
                >
                  <Plus className="w-3 h-3" />
                  Add to Inventory
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysisResult.length === 0 && missingItems.length === 0 && (
        <div className="py-8 text-center text-indigo-400 dark:text-indigo-300 italic text-sm">
          No recommendations at this time. Your inventory looks good!
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-indigo-400 dark:text-indigo-300">
        <Info className="w-4 h-4" />
        Analysis is based on recent sales patterns, current stock levels, and menu recipes.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InventoryFilters
// ─────────────────────────────────────────────────────────────────────────────

interface InventoryFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  menuFilter: string;
  setMenuFilter: (filter: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  menuItems: any[];
  items: any[];
  getItemStatus: (item: any) => StatusFilter;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

function InventoryFilters({
  searchQuery, setSearchQuery, menuFilter, setMenuFilter, statusFilter, setStatusFilter,
  menuItems, items, getItemStatus, hasActiveFilters, onClearFilters
}: InventoryFiltersProps) {
  return (
    <div className="p-4 border-b border-gray-200 dark:border-[var(--sb-border)] dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50/50 dark:bg-neutral-900 space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500" />
          <input
            type="text"
            placeholder="Search by name, SKU, unit, status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 dark:border-neutral-600 dark:border-neutral-700 rounded-lg text-sm w-full bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 dark:text-neutral-100 placeholder:text-gray-400 dark:text-neutral-500 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {menuItems.length > 0 && (
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-gray-400 dark:text-neutral-500 shrink-0" />
            <select
              value={menuFilter}
              onChange={e => setMenuFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:border-neutral-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 dark:text-neutral-100"
            >
              <option value="all">All Menu Items</option>
              {menuItems.map(mi => (
                <option key={mi.id} value={mi.id}>{mi.name}</option>
              ))}
            </select>
          </div>
        )}

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-2 py-1.5 text-xs text-gray-500 dark:text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-1 border border-gray-200 dark:border-[var(--sb-border)] dark:border-neutral-700 rounded-lg hover:border-red-200 dark:hover:border-red-500/30 bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500 shrink-0" />
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              statusFilter === s
                ? s === 'all' ? "bg-indigo-600 text-white border-indigo-600"
                  : s === 'in_stock' ? "bg-emerald-600 text-white border-emerald-600"
                    : s === 'low_stock' ? "bg-amber-500 text-white border-amber-500"
                      : "bg-red-600 text-white border-red-600"
                : "bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 dark:text-neutral-300 border-gray-300 dark:border-neutral-600 dark:border-neutral-700 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-300"
            )}
          >
            {statusFilterLabels[s]}
            {s !== 'all' && (
              <span className={cn("ml-1.5 font-bold", statusFilter === s ? "opacity-80" : "text-gray-400 dark:text-neutral-500 dark:text-neutral-500")}>
                {items.filter(i => getItemStatus(i) === s).length}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InventoryTable
// ─────────────────────────────────────────────────────────────────────────────

interface InventoryTableProps {
  loading: boolean;
  filteredItems: any[];
  items: any[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  getItemStatus: (item: any) => StatusFilter;
  onEdit: (item: any) => void;
  onDelete: (id: string, name: string) => void;
  menuFilter: string;
  menuItems: any[];
}

function InventoryTable({
  loading, filteredItems, items, hasActiveFilters, onClearFilters,
  getItemStatus, onEdit, onDelete, menuFilter, menuItems
}: InventoryTableProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-neutral-800/50 dark:bg-neutral-900 text-gray-500 dark:text-neutral-500 dark:text-neutral-400 font-medium border-b border-gray-200 dark:border-[var(--sb-border)] dark:border-neutral-800">
            <tr>
              <th className="px-6 py-3">{t('inventory.item', 'Item')}</th>
              <th className="px-6 py-3">{t('inventory.sku', 'SKU')}</th>
              <th className="px-6 py-3">{t('inventory.stock', 'Stock')}</th>
              <th className="px-6 py-3">{t('inventory.minLevel', 'Min. Level')}</th>
              <th className="px-6 py-3">{t('inventory.status', 'Status')}</th>
              <th className="px-6 py-3 text-right">{t('inventory.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-neutral-500 dark:text-neutral-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  {t('common.loading', 'Loading...')}
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-neutral-500 dark:text-neutral-400">
                  <Package className="w-12 h-12 text-gray-200 dark:text-neutral-700 mx-auto mb-3" />
                  <p className="font-medium">{t('inventory.noData', 'No inventory items found.')}</p>
                  {hasActiveFilters && (
                    <button onClick={onClearFilters} className="mt-2 text-xs text-indigo-600 dark:text-indigo-300 hover:underline">
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const status = getItemStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-gray-50 dark:bg-neutral-800/50 dark:hover:bg-neutral-800/60">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 dark:text-neutral-100 dark:text-neutral-100">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-neutral-500 dark:text-neutral-400 font-mono text-xs">
                      {item.sku || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-neutral-100 dark:text-neutral-100">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-neutral-500 dark:text-neutral-400">
                      {item.min_stock_level} {item.unit}
                    </td>
                    <td className="px-6 py-4">
                      {status === 'out_of_stock' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {t('inventory.outOfStock', 'Out of Stock')}
                        </span>
                      ) : status === 'low_stock' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {t('inventory.lowStock', 'Low Stock')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                          {t('inventory.inStock', 'In Stock')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => onEdit(item)} className="p-1 text-gray-400 dark:text-neutral-500 dark:text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete(item.id, item.name)} className="p-1 text-gray-400 dark:text-neutral-500 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-300 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && items.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-100 dark:border-[var(--sb-border)] dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50/50 dark:bg-neutral-900 text-xs text-gray-400 dark:text-neutral-500 dark:text-neutral-500 flex items-center justify-between">
          <span>
            Showing <span className="font-semibold text-gray-600 dark:text-neutral-400 dark:text-neutral-300">{filteredItems.length}</span> of <span className="font-semibold text-gray-600 dark:text-neutral-400 dark:text-neutral-300">{items.length}</span> items
          </span>
          {menuFilter !== 'all' && (
            <span className="flex items-center gap-1">
              <ChefHat className="w-3 h-3" />
              Filtered by: <span className="font-medium text-indigo-600 dark:text-indigo-300">{menuItems.find(m => m.id === menuFilter)?.name}</span>
            </span>
          )}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InventoryModals
// ─────────────────────────────────────────────────────────────────────────────

interface InventoryModalsProps {
  isModalOpen: boolean;
  editingItem: any;
  formData: any;
  saving: boolean;
  deleteModal: { isOpen: boolean; id: string; name: string } | null;
  onCloseModal: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSave: (e: React.FormEvent) => void;
  onCloseDeleteModal: () => void;
  onConfirmDelete: () => void;
  setFormData: (data: any) => void;
}

function InventoryModals({
  isModalOpen, editingItem, formData, saving, deleteModal,
  onCloseModal, onChange, onSave, onCloseDeleteModal, onConfirmDelete, setFormData
}: InventoryModalsProps) {
  const { t } = useTranslation();
  return (
    <>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-transparent dark:border-neutral-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[var(--sb-border)] dark:border-neutral-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 dark:text-neutral-100">
                {editingItem ? t('inventory.editItem', 'Edit Item') : t('inventory.addItem', 'Add Item')}
              </h3>
              <button onClick={onCloseModal} className="text-gray-400 dark:text-neutral-500 hover:text-gray-500 dark:text-neutral-500 dark:hover:text-neutral-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={onSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 dark:text-neutral-300 mb-1">{t('inventory.itemName', 'Item Name')}</label>
                <input
                  type="text" name="name" value={formData.name || ''} onChange={onChange} required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:border-neutral-700 rounded-lg bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    {t('inventory.sku', 'SKU')} <span className="text-gray-400 dark:text-neutral-500 font-normal text-xs">(optional)</span>
                  </label>
                  <input
                    type="text" name="sku" value={formData.sku || ''} onChange={onChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:border-neutral-700 rounded-lg bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 dark:text-neutral-300 mb-1">{t('inventory.unit', 'Unit')}</label>
                  <select
                    name="unit"
                    value={['pcs', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'bottle', 'can', 'bag'].includes(formData.unit) ? formData.unit : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        setFormData((prev: any) => ({ ...prev, unit: e.target.value }));
                      } else {
                        setFormData((prev: any) => ({ ...prev, unit: '' }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:border-neutral-700 rounded-lg bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="pcs">pcs — Pieces</option>
                    <option value="kg">kg — Kilogram</option>
                    <option value="g">g — Gram</option>
                    <option value="l">l — Litre</option>
                    <option value="ml">ml — Millilitre</option>
                    <option value="box">box — Box</option>
                    <option value="pack">pack — Pack</option>
                    <option value="bottle">bottle — Bottle</option>
                    <option value="can">can — Can</option>
                    <option value="bag">bag — Bag</option>
                    <option value="custom">✏️ Custom...</option>
                  </select>
                  {!['pcs', 'kg', 'g', 'l', 'ml', 'box', 'pack', 'bottle', 'can', 'bag'].includes(formData.unit) && (
                    <input
                      type="text" name="unit" value={formData.unit || ''} onChange={onChange}
                      placeholder="Type custom unit..." autoFocus
                      className="w-full mt-2 px-3 py-2 border border-indigo-300 dark:border-indigo-500/40 rounded-lg bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 dark:text-neutral-300 mb-1">{t('inventory.quantity', 'Quantity')}</label>
                  <input
                    type="number" name="quantity" value={formData.quantity || 0} onChange={onChange}
                    required min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:border-neutral-700 rounded-lg bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 dark:text-neutral-300 mb-1">{t('inventory.minLevel', 'Minimum Stock Level')}</label>
                  <input
                    type="number" name="min_stock_level" value={formData.min_stock_level || 0} onChange={onChange}
                    required min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:border-neutral-700 rounded-lg bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={onCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 dark:text-neutral-200 bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:bg-neutral-800/50 dark:hover:bg-neutral-800">
                  {t('common.cancel', 'Cancel')}
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t('common.save', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-transparent dark:border-neutral-800">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/15 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 dark:text-neutral-100 text-center mb-1">Delete Item</h3>
              <p className="text-sm text-gray-500 dark:text-neutral-500 dark:text-neutral-400 text-center mb-6">
                Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-neutral-100 dark:text-neutral-100">"{deleteModal.name}"</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={onCloseDeleteModal}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 dark:text-neutral-200 bg-white dark:bg-[var(--sb-card)] dark:bg-neutral-900 border border-gray-300 dark:border-neutral-600 dark:border-neutral-700 rounded-lg hover:bg-gray-50 dark:bg-neutral-800/50 dark:hover:bg-neutral-800">
                  {t('common.cancel', 'Cancel')}
                </button>
                <button onClick={onConfirmDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                  {t('common.delete', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory (main export)
// ─────────────────────────────────────────────────────────────────────────────

export function Inventory() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [menuFilter, setMenuFilter] = useState<string>('all');

  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const getLocalMerchantId = () => {
    try { return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null; }
    catch { return null; }
  };
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : getLocalMerchantId();

  useEffect(() => {
    const params = (window as any).__appNavigateParams;
    if (params?.filter === 'low_stock') {
      setStatusFilter('low_stock');
      (window as any).__appNavigateParams = undefined;
    }
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string } | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  // After
  const [analysisResult, setAnalysisResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inv_analysis_result') || '[]'); } catch { return []; }
  });
  const [missingItems, setMissingItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inv_missing_items') || '[]'); } catch { return []; }
  });
  const [showAnalysis, setShowAnalysis] = useState(() => {
    return localStorage.getItem('inv_show_analysis') === 'true';
  });

  const fetchData = async () => {
    if (!activeMerchantId) return { items: [], menuItems: [] };
    const [invRes, menuRes] = await Promise.all([
      supabase.from('inventory').select('*').eq('merchant_id', activeMerchantId).order('name'),
      supabase.from('menu').select('id, name, menu_item_ingredients(inventory_id, quantity)').eq('merchant_id', activeMerchantId).order('name'),
    ]);
    if (invRes.error) throw invRes.error;
    return { items: invRes.data || [], menuItems: menuRes.data || [] };
  };

  const { data, loading, refetch } = useDataLoader(`inventory_${activeMerchantId}`, fetchData);

  useEffect(() => { if (activeMerchantId) refetch(); }, [activeMerchantId]);

  const items = data?.items || [];
  const menuItems = data?.menuItems || [];

  const handleOpenModal = (item: any = null, prefill: any = null) => {
    setEditingItem(item);
    if (item) setFormData({ ...item });
    else if (prefill) setFormData(prefill);
    else setFormData({ name: '', sku: '', quantity: 0, unit: 'pcs', min_stock_level: 10 });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => { setIsModalOpen(false); setEditingItem(null); setFormData({}); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMerchantId) return;
    setSaving(true);
    try {
      if (editingItem) {
        const { name, sku, quantity, unit, min_stock_level } = formData;
        const { error } = await supabase
          .from('inventory')
          .update({ name, sku, quantity, unit, min_stock_level })  // ✅ only safe fields
          .eq('id', editingItem.id);
        if (error) throw error; setAlert({ type: 'success', message: t('inventory.saveSuccess', 'Item updated successfully!') });
      } else {
        const { error } = await supabase.from('inventory').insert([{ ...formData, merchant_id: activeMerchantId }]);
        if (error) throw error;
        setAlert({ type: 'success', message: t('inventory.addSuccess', 'Item added successfully!') });
      }
      handleCloseModal();
      refetch();
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || t('inventory.saveError', 'Failed to save item.') });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => setDeleteModal({ isOpen: true, id, name });

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;
    const { id } = deleteModal;
    setDeleteModal(null);
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      refetch();
      setAlert({ type: 'success', message: t('inventory.deleteSuccess', 'Item deleted successfully!') });
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || t('inventory.deleteError', 'Failed to delete item.') });
    }
  };

  const getItemStatus = (item: any): StatusFilter => {
    if (item.quantity <= 0) return 'out_of_stock';
    if (item.quantity <= item.min_stock_level) return 'low_stock';
    return 'in_stock';
  };

  const menuFilteredIds = React.useMemo<Set<string>>(() => {
    if (menuFilter === 'all') return new Set();
    const mi = menuItems.find((m: any) => m.id === menuFilter);
    if (!mi) return new Set();
    return new Set((mi.menu_item_ingredients || []).map((ing: any) => ing.inventory_id));
  }, [menuFilter, menuItems]);

  const filteredItems = items.filter((item: any) => {
    const q = searchQuery.toLowerCase();
    const status = getItemStatus(item);
    const statusLabel = status === 'out_of_stock' ? 'out of stock' : status === 'low_stock' ? 'low stock' : 'in stock';
    const matchesSearch = !q || item.name.toLowerCase().includes(q) || item.sku?.toLowerCase().includes(q) || item.unit?.toLowerCase().includes(q) || statusLabel.includes(q);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesMenu = menuFilter === 'all' || menuFilteredIds.has(item.id);
    return matchesSearch && matchesStatus && matchesMenu;
  });

  const handleApplyRestock = async (recommendation: any) => {
    try {
      const inventoryItem = items.find((i: any) => i.name.toLowerCase() === recommendation.item_name.toLowerCase());
      if (!inventoryItem) {
        const name = recommendation.item_name.toLowerCase();
        let guessedUnit = 'pcs';
        if (name.includes('oil') || name.includes('sauce') || name.includes('milk') || name.includes('water')) guessedUnit = 'l';
        else if (name.includes('flour') || name.includes('sugar') || name.includes('rice') || name.includes('salt') || name.includes('chicken') || name.includes('beef') || name.includes('meat')) guessedUnit = 'kg';
        else if (name.includes('powder') || name.includes('spice') || name.includes('chili')) guessedUnit = 'g';
        else if (name.includes('bottle')) guessedUnit = 'bottle';
        else if (name.includes('box')) guessedUnit = 'box';
        else if (name.includes('bag')) guessedUnit = 'bag';
        else if (name.includes('can')) guessedUnit = 'can';
        else if (name.includes('pack')) guessedUnit = 'pack';
        handleOpenModal(null, { name: recommendation.item_name, quantity: recommendation.suggested_add, unit: guessedUnit, min_stock_level: Math.floor(recommendation.suggested_add * 0.2), sku: '' });
        return;
      }
      const newQuantity = inventoryItem.quantity + recommendation.suggested_add;
      const { error } = await supabase.from('inventory').update({ quantity: newQuantity }).eq('id', inventoryItem.id);
      if (error) throw error;
      await supabase.from('inventory_logs').insert([{
        inventory_id: inventoryItem.id, type: 'restock',
        quantity_change: recommendation.suggested_add,
        stock_before: inventoryItem.quantity, stock_after: newQuantity,
        notes: `AI suggested restock: ${recommendation.reason}`,
        merchant_id: activeMerchantId
      }]);
      setAlert({ type: 'success', message: `Restocked "${recommendation.item_name}" by +${recommendation.suggested_add}` });
      setAnalysisResult((prev: any[]) => prev.filter(r => r.item_name !== recommendation.item_name));
      refetch();
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Failed to apply restock.' });
    }
  };

  const handleAddMissingItem = (missing: any) => {
    handleOpenModal(null, { name: missing.ingredient_name, quantity: 0, unit: missing.suggested_unit || 'pcs', min_stock_level: 5, sku: '' });
    setMissingItems((prev: any[]) => prev.filter(m => m.ingredient_name !== missing.ingredient_name));
  };

  const handleAIAnalysis = async () => {
    if (!activeMerchantId) return;
    setAnalyzing(true);
    try {
      const { data: orders } = await supabase
        .from('orders').select('items, created_at')
        .eq('merchant_id', activeMerchantId)
        .order('created_at', { ascending: false }).limit(100);

      const { data: menu } = await supabase
        .from('menu').select('id, name, menu_item_ingredients(inventory_id, quantity)')
        .eq('merchant_id', activeMerchantId);

      const inventoryData = items.map((i: any) => ({ id: i.id, name: i.name, current_stock: i.quantity, unit: i.unit, min_level: i.min_stock_level }));
      const salesSummary = orders?.map(o => o.items) || [];
      const apiKey = (import.meta.env as any).VITE_GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are analyzing a restaurant POS inventory system.

Current inventory: ${JSON.stringify(inventoryData)}
Recent sales: ${JSON.stringify(salesSummary)}
Menu items with recipes: ${JSON.stringify(menu)}

Task 1 - RESTOCK: For inventory items running low based on sales patterns, suggest restocks.
Task 2 - MISSING: Based on the menu item names and common cooking knowledge, identify typical ingredients that would be needed to prepare these menu items but are NOT currently listed by name in the inventory. These are items the restaurant should add to their inventory to properly track stock.

Return a single JSON object:
{
  "restock": [{ "item_name": string, "suggested_add": number, "reason": string, "priority": "High"|"Medium"|"Low" }],
  "missing": [{ "ingredient_name": string, "used_in": string, "suggested_unit": "kg"|"g"|"l"|"ml"|"pcs"|"bottle"|"can"|"bag"|"pack"|"box", "reason": string }]
}`,
        config: { responseMimeType: "application/json" }
      });
      const result = JSON.parse(response.text || '{"restock":[],"missing":[]}');
      setAnalysisResult(result.restock || []);
      setMissingItems(result.missing || []);
      setShowAnalysis(true);
      localStorage.setItem('inv_analysis_result', JSON.stringify(result.restock || []));
      localStorage.setItem('inv_missing_items', JSON.stringify(result.missing || []));
      localStorage.setItem('inv_show_analysis', 'true');
    } catch (error) {
      console.error('AI Analysis failed', error);
      setAlert({ type: 'error', message: 'Failed to run AI stock analysis.' });
    } finally {
      setAnalyzing(false);
    }
  };

  const hasActiveFilters = statusFilter !== 'all' || menuFilter !== 'all' || !!searchQuery;
  const clearFilters = () => { setStatusFilter('all'); setMenuFilter('all'); setSearchQuery(''); };

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  return (
    <div className="space-y-6">
      <InventoryHeader analyzing={analyzing} onAIAnalysis={handleAIAnalysis} onAddNew={() => handleOpenModal()} />

      <AIAnalysisPanel
        showAnalysis={showAnalysis}
        setShowAnalysis={(val: boolean) => {
          setShowAnalysis(val);
          localStorage.setItem('inv_show_analysis', String(val));
        }}
        analysisResult={analysisResult}
        missingItems={missingItems}
        items={items}
        onApplyRestock={handleApplyRestock}
        onAddMissingItem={handleAddMissingItem}
      />

      {alert && (
        <div className={cn(
          "px-4 py-3 rounded-lg text-sm font-medium border animate-in fade-in slide-in-from-top-2",
          alert.type === 'success'
            ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/20"
            : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-500/20"
        )}>
          {alert.message}
        </div>
      )}

      <div className="bg-white dark:bg-[var(--sb-card)] dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] dark:border-[var(--sb-border)] shadow-sm overflow-hidden">
        <InventoryFilters
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          menuFilter={menuFilter} setMenuFilter={setMenuFilter}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          menuItems={menuItems} items={items} getItemStatus={getItemStatus}
          hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters}
        />
        <InventoryTable
          loading={loading} filteredItems={filteredItems} items={items}
          hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters}
          getItemStatus={getItemStatus} onEdit={handleOpenModal} onDelete={handleDeleteClick}
          menuFilter={menuFilter} menuItems={menuItems}
        />
      </div>

      <InventoryModals
        isModalOpen={isModalOpen} editingItem={editingItem} formData={formData}
        saving={saving} deleteModal={deleteModal}
        onCloseModal={handleCloseModal} onChange={handleChange} onSave={handleSave}
        onCloseDeleteModal={() => setDeleteModal(null)} onConfirmDelete={handleDeleteConfirm}
        setFormData={setFormData}
      />
    </div>
  );
}