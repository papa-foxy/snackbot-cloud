import React, { useState, useMemo } from 'react';
import {
  Search, Plus, RefreshCw, Eye, Pencil, Ban, CheckCircle2,
  Store, Building2, Users, ChevronRight, AlertTriangle,
  ArrowUpDown, ArrowUp, ArrowDown, Download, CheckSquare, Square,
  Filter, ChevronLeft, ChevronsLeft, ChevronsRight, Layers
} from 'lucide-react';
import { Merchant, PLANS } from '../types';
import { MerchantDrawer } from './MerchantDrawer';
import { NewMerchantModal } from './NewMerchantModal';
import { cn } from '../../../utils/cn';

interface MerchantsTabProps {
  merchants: Merchant[];
  loading: boolean;
  onRefresh: () => void;
  setMerchants: React.Dispatch<React.SetStateAction<Merchant[]>>;
  onImpersonate: (id: string, name: string, write: boolean) => void;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
}

type SortField = 'name' | 'plan' | 'branch_count' | 'staff_count' | 'plan_mrr' | 'plan_status' | 'joined_date';

export function MerchantsTab({
  merchants,
  loading,
  onRefresh,
  setMerchants,
  onImpersonate,
  onUpdateStatus,
}: MerchantsTabProps) {
  // Search & Filter State
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('joined_date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Drawers
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  // Helper to detect demo accounts
  const isDemoMerchant = (m: Merchant) =>
    (m.business_type ?? '').toLowerCase() === 'demo' || m.name.toLowerCase().includes('demo');

  // Extract unique cities for filter dropdown
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    merchants.forEach(m => {
      if (m.city && m.city.trim()) set.add(m.city.trim());
    });
    return Array.from(set).sort();
  }, [merchants]);

  // Global counts
  const counts = {
    all: merchants.length,
    active: merchants.filter(m => m.plan_status === 'active').length,
    pending: merchants.filter(m => m.plan_status === 'pending').length,
    suspended: merchants.filter(m => m.plan_status === 'suspended').length,
    demo: merchants.filter(isDemoMerchant).length,
  };

  // 1. Filter Engine
  const filteredMerchants = useMemo(() => {
    return merchants.filter(m => {
      // Text search across name, owner, email, city, and ID
      if (q.trim()) {
        const query = q.toLowerCase();
        const matches =
          m.name?.toLowerCase().includes(query) ||
          m.owner_name?.toLowerCase().includes(query) ||
          m.owner_email?.toLowerCase().includes(query) ||
          m.city?.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Status filter tab
      if (statusFilter === 'demo') {
        if (!isDemoMerchant(m)) return false;
      } else if (statusFilter !== 'all') {
        if (m.plan_status !== statusFilter) return false;
      }

      // Plan tier filter dropdown
      if (planFilter !== 'all' && m.plan !== planFilter) {
        return false;
      }

      // City filter dropdown
      if (cityFilter !== 'all' && m.city !== cityFilter) {
        return false;
      }

      return true;
    });
  }, [merchants, q, statusFilter, planFilter, cityFilter]);

  // 2. Sorting Engine
  const sortedMerchants = useMemo(() => {
    return [...filteredMerchants].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'plan_mrr') {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else if (sortField === 'branch_count' || sortField === 'staff_count') {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else if (sortField === 'joined_date') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else {
        valA = (valA ?? '').toString().toLowerCase();
        valB = (valB ?? '').toString().toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredMerchants, sortField, sortAsc]);

  // 3. Pagination Engine
  const totalPages = Math.max(1, Math.ceil(sortedMerchants.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedMerchants = sortedMerchants.slice(startIndex, startIndex + pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Bulk Selection Handlers
  const isAllCurrentPageSelected = paginatedMerchants.length > 0 && paginatedMerchants.every(m => selectedIds.has(m.id));

  const handleToggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (isAllCurrentPageSelected) {
      paginatedMerchants.forEach(m => next.delete(m.id));
    } else {
      paginatedMerchants.forEach(m => next.add(m.id));
    }
    setSelectedIds(next);
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Bulk Status Update
  const handleBulkStatus = async (status: 'active' | 'suspended') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Are you sure you want to set ${ids.length} restaurants to ${status}?`)) return;

    for (const id of ids) {
      await onUpdateStatus(id, status);
    }
    setSelectedIds(new Set());
  };

  // CSV Export Engine
  const handleExportCSV = () => {
    const rows = sortedMerchants.map(m => ({
      ID: m.id,
      Name: m.name,
      Owner: m.owner_name || '',
      Email: m.owner_email || '',
      Phone: m.owner_phone || '',
      City: m.city || '',
      Plan: m.plan,
      Status: m.plan_status,
      Outlets: m.branch_count || 0,
      Staff: m.staff_count || 0,
      MRR: m.plan_mrr || 99,
      Joined: m.joined_date || '',
    }));

    if (rows.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = Object.keys(rows[0]).join(',');
    const csvContent = [
      headers,
      ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `snackbot-restaurants-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1 inline" />;
    }
    return sortAsc
      ? <ArrowUp className="w-3 h-3 text-[#D97706] ml-1 inline" />
      : <ArrowDown className="w-3 h-3 text-[#D97706] ml-1 inline" />;
  };

  return (
    <div className="space-y-4">
      {/* ── Top Bar: Title & Primary Actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Restaurants Directory
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {filteredMerchants.length.toLocaleString()} {filteredMerchants.length === 1 ? 'account' : 'accounts'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Scalable multi-tenant manager with instant filtering, sorting, pagination, and bulk controls.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            title="Export filtered records to CSV"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </button>
          <button
            onClick={onRefresh}
            title="Refresh database"
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-all"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin text-[#D97706]')} />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#D97706] hover:bg-[#B45309] shadow-md shadow-amber-600/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Restaurant
          </button>
        </div>
      </div>

      {/* ── Filters & Controls Bar ── */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2.5">
          <div className="flex rounded-xl bg-slate-100/70 p-1 gap-1 overflow-x-auto scrollbar-none">
            {(['all', 'active', 'pending', 'suspended', 'demo'] as const).map(f => (
              <button
                key={f}
                onClick={() => {
                  setStatusFilter(f);
                  setPage(1);
                }}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap',
                  statusFilter === f
                    ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                {f} <span className="opacity-60 text-[10px] ml-0.5">({counts[f]})</span>
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500">
            Showing <span className="font-bold text-slate-800">{Math.min(filteredMerchants.length, startIndex + 1)}</span> to{' '}
            <span className="font-bold text-slate-800">{Math.min(filteredMerchants.length, startIndex + pageSize)}</span> of{' '}
            <span className="font-bold text-slate-800">{filteredMerchants.length.toLocaleString()}</span>
          </div>
        </div>

        {/* Search & Sub-filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-6 lg:col-span-7 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 focus-within:bg-white focus-within:border-[#D97706] focus-within:ring-2 focus-within:ring-[#D97706]/10 transition-all">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 outline-none"
              placeholder="Search by restaurant name, owner, email, city, or ID…"
              value={q}
              onChange={e => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            {q && (
              <button onClick={() => setQ('')} className="text-xs text-slate-400 hover:text-slate-700">
                ×
              </button>
            )}
          </div>

          {/* Plan Filter */}
          <div className="sm:col-span-3 lg:col-span-3">
            <select
              value={planFilter}
              onChange={e => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#D97706] text-slate-700 font-medium"
            >
              <option value="all">All Plans ({merchants.length})</option>
              {PLANS.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label} Plan (RM {p.price}/mo)
                </option>
              ))}
            </select>
          </div>

          {/* City Filter */}
          <div className="sm:col-span-3 lg:col-span-2">
            <select
              value={cityFilter}
              onChange={e => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#D97706] text-slate-700 font-medium"
            >
              <option value="all">All Locations</option>
              {uniqueCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Bulk Action Bar (Visible when >= 1 item checked) */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <CheckSquare className="w-4 h-4 text-amber-600" />
              <span>{selectedIds.size} restaurant{selectedIds.size > 1 ? 's' : ''} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkStatus('active')}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 shadow-xs"
              >
                Approve Selected
              </button>
              <button
                onClick={() => handleBulkStatus('suspended')}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 shadow-xs"
              >
                Suspend Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-800 underline ml-2"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Scalable Data Table ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none">
                <th className="w-10 px-4 py-2.5 text-center">
                  <button onClick={handleToggleSelectAll} className="text-slate-400 hover:text-slate-700">
                    {isAllCurrentPageSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#D97706]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="text-left px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('name')}>
                  Restaurant {renderSortIndicator('name')}
                </th>
                <th className="text-left px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('plan')}>
                  Plan {renderSortIndicator('plan')}
                </th>
                <th className="text-center px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('branch_count')}>
                  Outlets {renderSortIndicator('branch_count')}
                </th>
                <th className="text-center px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('staff_count')}>
                  Staff {renderSortIndicator('staff_count')}
                </th>
                <th className="text-left px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('plan_mrr')}>
                  MRR {renderSortIndicator('plan_mrr')}
                </th>
                <th className="text-left px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('plan_status')}>
                  Status {renderSortIndicator('plan_status')}
                </th>
                <th className="text-left px-3 py-2.5 cursor-pointer group" onClick={() => handleSort('joined_date')}>
                  Joined {renderSortIndicator('joined_date')}
                </th>
                <th className="text-right px-4 py-2.5">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-xs text-slate-400">
                    Loading restaurant directory…
                  </td>
                </tr>
              ) : paginatedMerchants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-xs text-slate-400">
                    No restaurants match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedMerchants.map(m => {
                  const isChecked = selectedIds.has(m.id);
                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        'hover:bg-amber-50/20 transition-colors group cursor-pointer text-xs',
                        isChecked && 'bg-amber-50/30'
                      )}
                      onClick={() => setSelectedMerchant(m)}
                    >
                      <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleToggleRow(m.id)} className="text-slate-400 hover:text-slate-700">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#D97706]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200/80 text-[#D97706] font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-[#D97706] transition-colors leading-tight">
                              {m.name}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {m.owner_name ? `${m.owner_name} · ` : ''}{m.city || 'Malaysia'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <span className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border',
                          m.plan === 'enterprise' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          m.plan === 'premium'    ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        )}>
                          {m.plan}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-center font-medium text-slate-700 tabular-nums">
                        {m.branch_count ?? 0}
                      </td>

                      <td className="px-3 py-2.5 text-center font-medium text-slate-700 tabular-nums">
                        {m.staff_count ?? 0}
                      </td>

                      <td className="px-3 py-2.5 font-bold text-[#D97706] tabular-nums">
                        RM {m.plan_mrr || 99}
                      </td>

                      <td className="px-3 py-2.5">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border capitalize',
                          m.plan_status === 'active'    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          m.plan_status === 'suspended' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        )}>
                          <span className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            m.plan_status === 'active' ? 'bg-emerald-500' :
                            m.plan_status === 'suspended' ? 'bg-rose-500' : 'bg-amber-500'
                          )} />
                          {m.plan_status}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-[11px] text-slate-400 tabular-nums">
                        {m.joined_date?.slice(0, 10) || '—'}
                      </td>

                      <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onImpersonate(m.id, m.name, false)}
                            title="View as Merchant (Read-Only)"
                            className="p-1 rounded-lg text-slate-400 hover:text-[#D97706] hover:bg-amber-50 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onImpersonate(m.id, m.name, true)}
                            title="Act as Merchant (Write Access)"
                            className="p-1 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {m.plan_status === 'active' ? (
                            <button
                              onClick={() => onUpdateStatus(m.id, 'suspended')}
                              title="Suspend"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onUpdateStatus(m.id, 'active')}
                              title="Activate / Approve"
                              className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer ── */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#D97706]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Page Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(1)}
              disabled={currentPage <= 1}
              title="First Page"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              title="Previous Page"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-3 py-1 font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              title="Next Page"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={currentPage >= totalPages}
              title="Last Page"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedMerchant && (
        <MerchantDrawer
          merchant={selectedMerchant}
          onClose={() => setSelectedMerchant(null)}
          onImpersonate={onImpersonate}
          onUpdateStatus={onUpdateStatus}
          onMerchantUpdated={updated => {
            setMerchants(prev => prev.map(m => (m.id === updated.id ? updated : m)));
            setSelectedMerchant(updated);
          }}
          onMerchantDeleted={deletedId => {
            setMerchants(prev => prev.filter(m => m.id !== deletedId));
            setSelectedMerchant(null);
          }}
        />
      )}

      {/* New Merchant Modal */}
      {showNewModal && (
        <NewMerchantModal
          onClose={() => setShowNewModal(false)}
          onSaved={newM => {
            setMerchants(prev => [newM, ...prev]);
            setShowNewModal(false);
          }}
        />
      )}
    </div>
  );
}
