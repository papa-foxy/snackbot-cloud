import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode, Printer, Download, Search,
  ExternalLink, CheckCircle2, AlertCircle,
  RefreshCw, Copy, Check, X, Loader2,
  ToggleLeft, ToggleRight, ChevronDown,
  Zap, Lock, Clock, Link, BarChart2,
  Pencil, Shield, ShieldOff,
  Layers, Building2, Plus, Trash2, Users, MapPin,
  LayoutGrid, List
} from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';
import { useTranslation } from '../../../contexts/TranslationContext';
import { useImpersonation } from '../../../contexts/ImpersonationContext'; // 👉 Added import

// ── Types ──────────────────────────────────────────────────────────────────────
interface TableRow {
  id: string;
  table_number: string;
  floor: string;
  area?: string;
  capacity?: number;
  status?: 'available' | 'occupied' | 'reserved';
  is_active?: boolean;
  floor_qr_disabled?: boolean;
}

interface QrConfig {
  id:                   string;
  table_id:             string;
  qr_type:              'static' | 'dynamic';
  short_code:           string;
  destination_url:      string;
  token:                string | null;
  token_expires_at:     string | null;
  session_timeout_mins: number;
  qr_disabled:          boolean;
  scan_count:           number;
  last_scan_at:         string | null;
  last_scan_device:     string | null;
  custom_url:           string | null;
}

interface QrSession {
  id:         string;
  table_id:   string;
  started_at: string;
  ended_at:   string | null;
  status:     'active' | 'closed';
  order_count?: number;
}

// Floor master switch is stored as floor_qr_disabled on each table row.
// All rows sharing the same floor name are updated together — no separate floors table needed.

interface TableQR extends TableRow {
  qr_url:              string;
  qr_data_url:         string | null;
  scan_count:          number;
  last_scan:           string | null;
  qr_config:           QrConfig | null;
  active_session:      QrSession | null;
  floor_qr_disabled:   boolean;
}

// ── QR URL builder ─────────────────────────────────────────────────────────────
function buildQrUrl(tableNumber: string, cfg?: QrConfig | null): string {
  if (cfg?.custom_url) return cfg.custom_url;
  const base = window.location.origin;
  if (cfg?.qr_type === 'dynamic' && cfg.short_code) {
    return `${base}/qr/${cfg.short_code}`;
  }
  const token = cfg?.token ?? '';
  const params = token ? `?table=${encodeURIComponent(tableNumber)}&token=${token}` : `?table=${encodeURIComponent(tableNumber)}`;
  return `${base}/order${params}`;
}

function generateShortCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => chars[b % chars.length]).join('');
}

function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#111827', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  });
}

// ── Add Table Modal ────────────────────────────────────────────────────────────
function AddTableModal({
  onSave,
  onClose,
}: {
  onSave:  (table: { table_number: string; capacity: number; floor: string; area: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity]       = useState(4);
  const [floor, setFloor]             = useState('');
  const [area, setArea]               = useState('indoor');
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState('');

  async function handleSave() {
    if (!tableNumber.trim()) { setErr('Table number is required.'); return; }
    setSaving(true);
    await onSave({ table_number: tableNumber.trim(), capacity, floor: floor.trim(), area });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Plus className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-neutral-100">Add New Table</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {err && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Table Number *</label>
              <input value={tableNumber} onChange={e => setTableNumber(e.target.value)}
                placeholder="e.g. T01"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Capacity</label>
              <input type="number" value={capacity} onChange={e => setCapacity(parseInt(e.target.value) || 2)} min={1} max={50}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Floor / Zone</label>
              <input value={floor} onChange={e => setFloor(e.target.value)}
                placeholder="Ground Floor"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Area</label>
              <select value={area} onChange={e => setArea(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="private">Private Room</option>
                <option value="bar">Bar</option>
              </select>
            </div>
          </div>
          <div className="px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700 flex items-start gap-2">
            <QrCode className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            A unique QR code with secure token will be auto-generated for this table.
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:text-neutral-100 rounded-xl hover:bg-gray-100 dark:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Table
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Table Modal ───────────────────────────────────────────────────────────
function EditTableModal({
  table,
  onSave,
  onClose,
}: {
  table:   TableQR;
  onSave:  (id: string, patch: { table_number: string; capacity: number; floor: string; area: string; status: 'available' | 'occupied' | 'reserved'; is_active: boolean }) => Promise<void>;
  onClose: () => void;
}) {
  const [tableNumber, setTableNumber] = useState(table.table_number);
  const [capacity, setCapacity]       = useState(table.capacity ?? 4);
  const [floor, setFloor]             = useState(table.floor ?? '');
  const [area, setArea]               = useState(table.area ?? 'indoor');
  const [status, setStatus]           = useState<'available' | 'occupied' | 'reserved'>(table.status ?? 'available');
  const [isActive, setIsActive]       = useState(table.is_active ?? true);
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState('');

  async function handleSave() {
    if (!tableNumber.trim()) { setErr('Table number is required.'); return; }
    setSaving(true);
    await onSave(table.id, { table_number: tableNumber.trim(), capacity, floor: floor.trim(), area, status, is_active: isActive });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-neutral-100">Edit Table</h3>
              <p className="text-xs text-gray-400 dark:text-neutral-500">Table {table.table_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {err && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Table Number *</label>
              <input value={tableNumber} onChange={e => setTableNumber(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Capacity</label>
              <input type="number" value={capacity} onChange={e => setCapacity(parseInt(e.target.value) || 1)} min={1} max={50}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Floor / Zone</label>
              <input value={floor} onChange={e => setFloor(e.target.value)} placeholder="Ground Floor"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Area</label>
              <select value={area} onChange={e => setArea(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="private">Private Room</option>
                <option value="bar">Bar</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5">Table Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['available', 'occupied', 'reserved'] as const).map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={cn('py-2.5 rounded-xl border-2 text-xs font-semibold capitalize transition-all',
                    status === s
                      ? s === 'available' ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : s === 'occupied' ? 'border-red-400 bg-red-50 text-red-700'
                        : 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-gray-200 dark:border-[var(--sb-border)] text-gray-500 dark:text-neutral-500 hover:border-gray-300 dark:border-neutral-600')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-200 dark:border-[var(--sb-border)]">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Table Active</p>
              <p className="text-xs text-gray-400 dark:text-neutral-500">Inactive tables won't accept QR scans</p>
            </div>
            <button type="button" onClick={() => setIsActive(p => !p)}>
              {isActive
                ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                : <ToggleLeft className="w-8 h-8 text-gray-300" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:text-neutral-100 rounded-xl hover:bg-gray-100 dark:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Table Modal ─────────────────────────────────────────────────────────
function DeleteTableModal({
  table,
  onConfirm,
  onClose,
}: {
  table:     TableQR;
  onConfirm: (id: string) => Promise<void>;
  onClose:   () => void;
}) {
  const [deleting, setDeleting]   = useState(false);
  const hasActiveSession = !!table.active_session;
  const isOccupied       = table.status === 'occupied';
  const blocked          = hasActiveSession || isOccupied;

  async function handleDelete() {
    setDeleting(true);
    await onConfirm(table.id);
    setDeleting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-neutral-100">Delete Table</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-[var(--sb-border)] rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center font-black text-gray-700 dark:text-neutral-300 text-sm">
              {table.table_number}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-neutral-100 text-sm">Table {table.table_number}</p>
              <p className="text-xs text-gray-400 dark:text-neutral-500 flex items-center gap-2">
                <Users className="w-3 h-3" /> {table.capacity ?? '—'} seats
                <MapPin className="w-3 h-3 ml-1" /> {table.floor || 'No floor'}
              </p>
            </div>
          </div>
          {blocked ? (
            <div className="space-y-2">
              {hasActiveSession && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span><strong>Active session running.</strong> Force close the session from Manage QR before deleting.</span>
                </div>
              )}
              {isOccupied && !hasActiveSession && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span><strong>Table is occupied.</strong> Change status to Available before deleting.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                This will permanently delete the table and its QR code. This action <strong>cannot be undone</strong>.
              </p>
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                QR config and session history will also be deleted.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:text-neutral-100 rounded-xl hover:bg-gray-100 dark:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting || blocked}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 disabled:opacity-40 transition-colors shadow-sm">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete Table
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Manage QR Modal ───────────────────────────────────────────────────────────
function ManageQrModal({
  table,
  onSave,
  onToggleDisabled,
  onRegenerateToken,
  onDownload,
  onPrint,
  onCopyUrl,
  onForceCloseSession,
  copiedId,
  onClose,
}: {
  table:               TableQR;
  onSave:              (tableId: string, patch: Partial<QrConfig>) => Promise<void>;
  onToggleDisabled:    (id: string, val: boolean) => Promise<void>;
  onRegenerateToken:   (table: TableQR) => Promise<void>;
  onDownload:          (table: TableQR) => void;
  onPrint:             (table: TableQR) => void;
  onCopyUrl:           (table: TableQR) => void;
  onForceCloseSession: (tableId: string, sessionId: string) => Promise<void>;
  copiedId:            string | null;
  onClose:             () => void;
}) {
  const cfg = table.qr_config;
  const [qrType, setQrType]           = useState<'static' | 'dynamic'>(cfg?.qr_type ?? 'static');
  const [customUrl, setCustomUrl]     = useState(cfg?.custom_url ?? '');
  const [sessionMins, setSessionMins] = useState(cfg?.session_timeout_mins ?? 30);
  const [saving, setSaving]           = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [closingSession, setClosingSession] = useState(false);

  const disabled  = cfg?.qr_disabled ?? false;
  const isDynamic = qrType === 'dynamic';
  const lastScan  = cfg?.last_scan_at ? new Date(cfg.last_scan_at) : null;
  const isExpired = cfg?.token_expires_at ? new Date(cfg.token_expires_at) < new Date() : false;

  async function handleSave() {
    setSaving(true);
    await onSave(table.id, {
      qr_type:              qrType,
      custom_url:           customUrl.trim() || null,
      session_timeout_mins: sessionMins,
    });
    setSaving(false);
    onClose();
  }

  async function handleRegen() {
    setRegenLoading(true);
    await onRegenerateToken(table);
    setRegenLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-cyan-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-neutral-100">Manage QR — Table {table.table_number}</h3>
              <p className="text-xs text-gray-400 dark:text-neutral-500">{table.floor}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 overflow-y-auto flex-1">

          {/* QR Preview */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-2xl border border-gray-100 dark:border-[var(--sb-border)]">
            <div className={cn('w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border shrink-0 flex items-center justify-center bg-white dark:bg-[var(--sb-card)]',
              disabled ? 'border-red-200 grayscale opacity-60' : 'border-gray-200 dark:border-[var(--sb-border)]')}>
              {table.qr_data_url
                ? <img src={table.qr_data_url} alt="QR" className="w-full h-full object-contain" />
                : <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1',
                  isDynamic ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 border-gray-200 dark:border-[var(--sb-border)]')}>
                  {isDynamic ? <Zap className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                  {isDynamic ? 'Dynamic' : 'Static'}
                </span>
                {disabled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200 flex items-center gap-1">
                    <ShieldOff className="w-2.5 h-2.5" /> Disabled
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-neutral-500 font-mono truncate">{table.qr_url}</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => onDownload(table)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-400 hover:text-cyan-600 hover:border-cyan-300 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button onClick={() => onPrint(table)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-400 hover:text-cyan-600 hover:border-cyan-300 transition-colors">
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button onClick={() => onCopyUrl(table)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-lg text-xs font-medium text-gray-600 dark:text-neutral-400 hover:text-cyan-600 hover:border-cyan-300 transition-colors">
                  {copiedId === table.id
                    ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</>
                    : <><Copy className="w-3.5 h-3.5" /> Copy URL</>}
                </button>
              </div>
            </div>
          </div>

          {/* Enable / Disable */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-[var(--sb-border)]">
            <div className="flex items-center gap-3">
              {disabled
                ? <ShieldOff className="w-5 h-5 text-red-500 shrink-0" />
                : <Shield className="w-5 h-5 text-emerald-500 shrink-0" />}
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">QR Code {disabled ? 'Disabled' : 'Enabled'}</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500">{disabled ? 'Customers cannot scan.' : 'Customers can scan & order.'}</p>
              </div>
            </div>
            <button
              onClick={() => onToggleDisabled(table.id, !disabled)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                disabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100')}
            >
              {disabled ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
              {disabled ? 'Enable' : 'Disable'}
            </button>
          </div>

          {/* QR Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-2">QR Type</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { val: 'static',  icon: Lock, label: 'Static QR',  desc: 'Fixed URL — reprint if destination changes' },
                { val: 'dynamic', icon: Zap,  label: 'Dynamic QR', desc: 'Short redirect — change destination without reprinting' },
              ] as const).map(({ val, icon: Icon, label, desc }) => (
                <button key={val} type="button" onClick={() => setQrType(val)}
                  className={cn('text-left px-3 py-3 rounded-xl border-2 transition-all',
                    qrType === val ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200 dark:border-[var(--sb-border)] hover:border-gray-300 dark:border-neutral-600')}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn('w-4 h-4', qrType === val ? 'text-cyan-600' : 'text-gray-400 dark:text-neutral-500')} />
                    <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{label}</p>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-neutral-500">{desc}</p>
                </button>
              ))}
            </div>
            {isDynamic && cfg?.short_code && (
              <div className="mt-2 flex items-center justify-between px-3 py-2 bg-cyan-50 border border-cyan-100 rounded-lg flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs text-cyan-700">
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  Short code: <strong className="font-mono">{cfg.short_code}</strong>
                  {cfg.token_expires_at && (
                    <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                      isExpired ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700')}>
                      {isExpired ? 'Expired' : 'Active'}
                    </span>
                  )}
                </div>
                <button onClick={handleRegen} disabled={regenLoading}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[var(--sb-card)] border border-cyan-200 rounded-lg text-xs font-semibold text-cyan-700 hover:bg-cyan-100 transition-colors disabled:opacity-50">
                  {regenLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Regenerate Token
                </button>
              </div>
            )}
          </div>

          {/* Custom URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5" /> Custom Landing URL
              <span className="font-normal text-gray-400 dark:text-neutral-500">(optional)</span>
            </label>
            <input type="url" value={customUrl} onChange={e => setCustomUrl(e.target.value)}
              placeholder={`${window.location.origin}/order/table/${table.table_number}`}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm font-mono focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Leave blank to use the default table ordering URL.</p>
          </div>

          {/* Session Timeout */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Session Timeout
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="number" value={sessionMins} onChange={e => setSessionMins(parseInt(e.target.value) || 30)}
                min={5} max={480} step={5}
                className="w-24 px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
              <span className="text-sm text-gray-500 dark:text-neutral-500">minutes</span>
              <div className="flex gap-1 ml-auto">
                {[15, 30, 60, 120].map(m => (
                  <button key={m} type="button" onClick={() => setSessionMins(m)}
                    className={cn('px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      sessionMins === m ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 hover:bg-gray-200')}>
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Session */}
          <div className={cn('rounded-xl border p-4',
            table.active_session ? 'border-amber-200 bg-amber-50' : 'border-gray-200 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', table.active_session ? 'bg-amber-500 animate-pulse' : 'bg-gray-300')} />
                <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                  {table.active_session ? 'Active Session' : 'No Active Session'}
                </p>
              </div>
              {table.active_session && (
                <button
                  onClick={async () => {
                    setClosingSession(true);
                    await onForceCloseSession(table.id, table.active_session!.id);
                    setClosingSession(false);
                  }}
                  disabled={closingSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {closingSession ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  Force Close
                </button>
              )}
            </div>
            {table.active_session ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400 dark:text-neutral-500 font-semibold uppercase text-[10px]">Started</p>
                  <p className="text-gray-700 dark:text-neutral-300 font-medium mt-0.5">{new Date(table.active_session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-gray-400 dark:text-neutral-500 text-[10px]">{new Date(table.active_session.started_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 dark:text-neutral-500 font-semibold uppercase text-[10px]">Orders</p>
                  <p className="text-gray-700 dark:text-neutral-300 font-medium mt-0.5">{table.active_session.order_count ?? 0} order{(table.active_session.order_count ?? 0) !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1.5">Table is available. Session starts when customer scans the QR.</p>
            )}
          </div>

          {/* Analytics */}
          {cfg && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-2 flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5" /> Analytics
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase">Total Scans</p>
                  <p className="text-lg font-black text-gray-900 dark:text-neutral-100 mt-0.5">{cfg.scan_count}</p>
                </div>
                <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase">Last Scan</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-neutral-300 mt-0.5">
                    {lastScan ? lastScan.toLocaleDateString() : '—'}
                  </p>
                  {lastScan && <p className="text-[10px] text-gray-400 dark:text-neutral-500">{lastScan.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                </div>
                <div className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase">Device</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-neutral-300 mt-0.5 truncate">{cfg.last_scan_device ?? '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:text-neutral-100 rounded-xl hover:bg-gray-100 dark:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-xl hover:bg-cyan-700 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QR Grid Card ───────────────────────────────────────────────────────────────
function QRCard({
  table,
  floorDisabled,
  onOpenManage,
  onEdit,
  onDelete,
  copiedId,
}: {
  table:         TableQR;
  floorDisabled: boolean;
  onOpenManage:  (table: TableQR) => void;
  onEdit:        (table: TableQR) => void;
  onDelete:      (table: TableQR) => void;
  copiedId:      string | null;
}) {
  const cfg          = table.qr_config;
  const tableDisabled = cfg?.qr_disabled ?? false;
  const disabled      = tableDisabled || floorDisabled;   // effective disabled state
  const isDynamic     = cfg?.qr_type === 'dynamic';

  return (
    <div className={cn(
      'bg-white dark:bg-[var(--sb-card)] rounded-2xl border shadow-sm hover:shadow-md transition-all flex flex-col group overflow-hidden',
      disabled        ? 'border-red-200 opacity-70' :
      table.is_active ? 'border-gray-200 dark:border-[var(--sb-border)]'           : 'border-gray-100 dark:border-[var(--sb-border)] opacity-60'
    )}>
      <div className="p-4 sm:p-5 flex-1 flex flex-col items-center text-center">

        {/* Badges */}
        <div className="flex items-center gap-1.5 self-stretch mb-3 flex-wrap">
          {cfg && (
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1',
              isDynamic ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 border-gray-200 dark:border-[var(--sb-border)]')}>
              {isDynamic ? <Zap className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
              {isDynamic ? 'Dynamic' : 'Static'}
            </span>
          )}
          {tableDisabled && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200 flex items-center gap-1">
              <ShieldOff className="w-2.5 h-2.5" /> Disabled
            </span>
          )}
          {floorDisabled && !tableDisabled && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-orange-50 text-orange-600 border-orange-200 flex items-center gap-1">
              <Building2 className="w-2.5 h-2.5" /> Floor Offline
            </span>
          )}
        </div>

        {/* QR image */}
        <div className="relative mb-4 group-hover:scale-105 transition-transform duration-300">
          <div className={cn('w-32 h-32 sm:w-36 sm:h-36 rounded-xl overflow-hidden border bg-gray-50 dark:bg-neutral-800/50 flex items-center justify-center',
            disabled ? 'border-red-100' : 'border-gray-100 dark:border-[var(--sb-border)]')}>
            {table.qr_data_url
              ? <img src={table.qr_data_url} alt={`QR Table ${table.table_number}`}
                  className={cn('w-full h-full object-contain', disabled && 'grayscale opacity-50')} />
              : <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />}
          </div>
          {disabled && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl">
              {floorDisabled && !tableDisabled
                ? <Building2 className="w-8 h-8 text-orange-400 drop-shadow" />
                : <ShieldOff className="w-8 h-8 text-red-400 drop-shadow" />}
            </div>
          )}
        </div>

        <h3 className="text-base font-bold text-gray-900 dark:text-neutral-100">Table {table.table_number}</h3>
        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{table.floor}</p>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[var(--sb-border)] w-full grid grid-cols-2 gap-2">
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Scans</p>
            <p className="text-sm font-bold text-gray-900 dark:text-neutral-100">{cfg?.scan_count ?? table.scan_count}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Session</p>
            <div className="flex items-center justify-center gap-1">
              {table.active_session
                ? <><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /><span className="text-xs font-bold text-amber-600">Active</span></>
                : <span className="text-xs font-bold text-gray-300">—</span>}
            </div>
          </div>
          <div className="text-center col-span-2">
            <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Status</p>
            <div className="flex items-center justify-center gap-1">
              {!disabled && table.is_active
                ? <><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-xs font-bold text-emerald-600">Active</span></>
                : floorDisabled && !tableDisabled
                  ? <><Building2 className="w-3 h-3 text-orange-400" /><span className="text-xs font-bold text-orange-500">Floor Offline</span></>
                  : tableDisabled
                    ? <><ShieldOff className="w-3 h-3 text-red-400" /><span className="text-xs font-bold text-red-500">Disabled</span></>
                    : <><X className="w-3 h-3 text-gray-400 dark:text-neutral-500" /><span className="text-xs font-bold text-gray-400 dark:text-neutral-500">Inactive</span></>}
            </div>
          </div>
        </div>

        <button
          onClick={() => onOpenManage(table)}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 text-xs font-semibold rounded-xl border border-cyan-200 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> Manage QR
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-100 dark:border-[var(--sb-border)] flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-400 dark:text-neutral-500 truncate">
          {cfg?.last_scan_at
            ? `Last: ${new Date(cfg.last_scan_at).toLocaleDateString()}`
            : table.last_scan
              ? `Last: ${new Date(table.last_scan).toLocaleDateString()}`
              : 'Never scanned'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <a href={table.qr_url} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-cyan-600 hover:bg-cyan-50 transition-colors" title="View QR URL">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button onClick={() => onEdit(table)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit table">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(table)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete table">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QR List Row ────────────────────────────────────────────────────────────────
function QRListRow({
  table,
  floorDisabled,
  onOpenManage,
  onEdit,
  onDelete,
  copiedId,
  onCopyUrl,
  onDownload,
}: {
  table:         TableQR;
  floorDisabled: boolean;
  onOpenManage:  (table: TableQR) => void;
  onEdit:        (table: TableQR) => void;
  onDelete:      (table: TableQR) => void;
  copiedId:      string | null;
  onCopyUrl:     (table: TableQR) => void;
  onDownload:    (table: TableQR) => void;
}) {
  const cfg           = table.qr_config;
  const tableDisabled = cfg?.qr_disabled ?? false;
  const disabled      = tableDisabled || floorDisabled;
  const isDynamic     = cfg?.qr_type === 'dynamic';

  return (
    <div className={cn(
      'bg-white dark:bg-[var(--sb-card)] rounded-xl border transition-all hover:shadow-sm group',
      disabled        ? 'border-red-200 opacity-75' :
      table.is_active ? 'border-gray-200 dark:border-[var(--sb-border)]'           : 'border-gray-100 dark:border-[var(--sb-border)] opacity-60'
    )}>
      {/* Mobile layout (< sm) */}
      <div className="flex sm:hidden items-start gap-3 p-3.5">
        {/* QR thumb */}
        <div className={cn('w-14 h-14 rounded-lg overflow-hidden border shrink-0 bg-gray-50 dark:bg-neutral-800/50 flex items-center justify-center relative',
          disabled ? 'border-red-100 grayscale opacity-60' : 'border-gray-100 dark:border-[var(--sb-border)]')}>
          {table.qr_data_url
            ? <img src={table.qr_data_url} alt="" className="w-full h-full object-contain" />
            : <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />}
          {disabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-[var(--sb-card)]/40">
              <ShieldOff className="w-4 h-4 text-red-400" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900 dark:text-neutral-100 text-sm">Table {table.table_number}</p>
              <p className="text-xs text-gray-400 dark:text-neutral-500">{table.floor}{table.area ? ` · ${table.area}` : ''}</p>
            </div>
            {/* Status badge */}
            <span className={cn('shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border',
              !disabled && table.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              floorDisabled && !tableDisabled ? 'bg-orange-50 text-orange-600 border-orange-200' :
              tableDisabled ? 'bg-red-50 text-red-600 border-red-200' :
              'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 border-gray-200 dark:border-[var(--sb-border)]')}>
              {floorDisabled && !tableDisabled ? 'Floor Offline' : tableDisabled ? 'Disabled' : table.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Mini stats */}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-neutral-500">
            <span className="flex items-center gap-1">
              <BarChart2 className="w-3 h-3" /> {cfg?.scan_count ?? table.scan_count} scans
            </span>
            {table.active_session && (
              <span className="flex items-center gap-1 text-amber-600">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Session active
              </span>
            )}
            {isDynamic && (
              <span className="flex items-center gap-1 text-cyan-600">
                <Zap className="w-3 h-3" /> Dynamic
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <button onClick={() => onOpenManage(table)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-lg text-xs font-semibold transition-colors">
              <Pencil className="w-3 h-3" /> Manage QR
            </button>
            <button onClick={() => onDownload(table)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 dark:bg-neutral-800/50 hover:bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border border-gray-200 dark:border-[var(--sb-border)] rounded-lg text-xs font-medium transition-colors">
              <Download className="w-3 h-3" />
            </button>
            <button onClick={() => onCopyUrl(table)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 dark:bg-neutral-800/50 hover:bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 border border-gray-200 dark:border-[var(--sb-border)] rounded-lg text-xs font-medium transition-colors">
              {copiedId === table.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
            <button onClick={() => onEdit(table)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 dark:bg-neutral-800/50 hover:bg-indigo-50 text-gray-500 dark:text-neutral-500 hover:text-indigo-600 border border-gray-200 dark:border-[var(--sb-border)] rounded-lg text-xs font-medium transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => onDelete(table)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 dark:bg-neutral-800/50 hover:bg-red-50 text-gray-500 dark:text-neutral-500 hover:text-red-500 border border-gray-200 dark:border-[var(--sb-border)] rounded-lg text-xs font-medium transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop layout (≥ sm) */}
      <div className="hidden sm:flex items-center gap-4 px-4 py-3">
        {/* QR thumb */}
        <div className={cn('w-12 h-12 rounded-lg overflow-hidden border shrink-0 bg-gray-50 dark:bg-neutral-800/50 flex items-center justify-center relative',
          disabled ? 'border-red-100 grayscale opacity-60' : 'border-gray-100 dark:border-[var(--sb-border)]')}>
          {table.qr_data_url
            ? <img src={table.qr_data_url} alt="" className="w-full h-full object-contain" />
            : <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />}
          {disabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-[var(--sb-card)]/40">
              {floorDisabled && !tableDisabled
                ? <Building2 className="w-3.5 h-3.5 text-orange-400" />
                : <ShieldOff className="w-3.5 h-3.5 text-red-400" />}
            </div>
          )}
        </div>

        {/* Table number */}
        <div className="w-24 shrink-0">
          <p className="font-bold text-gray-900 dark:text-neutral-100 text-sm">Table {table.table_number}</p>
          <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5">{table.area ?? '—'}</p>
        </div>

        {/* Floor */}
        <div className="w-28 shrink-0 hidden md:block">
          <p className="text-sm text-gray-600 dark:text-neutral-400 truncate">{table.floor || '—'}</p>
          <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-0.5 flex items-center gap-1">
            <Users className="w-3 h-3" /> {table.capacity ?? '—'} seats
          </p>
        </div>

        {/* QR Type badge */}
        <div className="w-24 shrink-0 hidden lg:block">
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border',
            isDynamic ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 border-gray-200 dark:border-[var(--sb-border)]')}>
            {isDynamic ? <Zap className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
            {isDynamic ? 'Dynamic' : 'Static'}
          </span>
        </div>

        {/* Scans */}
        <div className="w-20 shrink-0 text-center hidden md:block">
          <p className="text-sm font-bold text-gray-900 dark:text-neutral-100">{cfg?.scan_count ?? table.scan_count}</p>
          <p className="text-[10px] text-gray-400 dark:text-neutral-500">scans</p>
        </div>

        {/* Session */}
        <div className="w-24 shrink-0 hidden lg:block">
          {table.active_session
            ? <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-semibold text-amber-600">Active</span>
              </div>
            : <span className="text-xs text-gray-300 font-medium">No session</span>}
        </div>

        {/* Status */}
        <div className="shrink-0">
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border',
            !disabled && table.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            floorDisabled && !tableDisabled ? 'bg-orange-50 text-orange-600 border-orange-200' :
            tableDisabled ? 'bg-red-50 text-red-600 border-red-200' :
            'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 border-gray-200 dark:border-[var(--sb-border)]')}>
            {floorDisabled && !tableDisabled
              ? <><Building2 className="w-2.5 h-2.5" /> Floor Offline</>
              : tableDisabled
                ? <><ShieldOff className="w-2.5 h-2.5" /> Disabled</>
                : table.is_active
                  ? <><CheckCircle2 className="w-2.5 h-2.5" /> Active</>
                  : <><X className="w-2.5 h-2.5" /> Inactive</>}
          </span>
        </div>

        {/* Last scan */}
        <div className="flex-1 min-w-0 hidden xl:block">
          <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">
            {cfg?.last_scan_at
              ? new Date(cfg.last_scan_at).toLocaleDateString()
              : 'Never scanned'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <button onClick={() => onOpenManage(table)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-lg text-xs font-semibold transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Manage QR
          </button>
          <button onClick={() => onDownload(table)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:bg-neutral-800 transition-colors" title="Download QR">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onCopyUrl(table)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-cyan-600 hover:bg-cyan-50 transition-colors" title="Copy URL">
            {copiedId === table.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <a href={table.qr_url} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-cyan-600 hover:bg-cyan-50 transition-colors" title="Open URL">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button onClick={() => onEdit(table)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(table)}
            className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Manage Modal ─────────────────────────────────────────────────────────
function BulkManageModal({
  tables,
  floors,
  onToggleDisabledBulk,
  onSaveGlobalDefaults,
  onClose,
}: {
  tables:               TableQR[];
  floors:               string[];
  onToggleDisabledBulk: (tableIds: string[], disable: boolean) => Promise<void>;
  onSaveGlobalDefaults: (patch: { qr_type: 'static' | 'dynamic'; session_timeout_mins: number }) => Promise<void>;
  onClose:              () => void;
}) {
  const [qrType, setQrType]           = useState<'static' | 'dynamic'>('static');
  const [sessionMins, setSessionMins] = useState(30);
  const [saving, setSaving]           = useState(false);
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  const activeCount   = tables.filter(t => !(t.qr_config?.qr_disabled)).length;
  const disabledCount = tables.length - activeCount;

  async function applyGlobal() {
    setSaving(true);
    await onSaveGlobalDefaults({ qr_type: qrType, session_timeout_mins: sessionMins });
    setSaving(false);
    onClose();
  }

  async function bulkByFloor(floor: string, disable: boolean) {
    setBulkLoading(floor + disable);
    const ids = tables.filter(t => t.floor === floor).map(t => t.id);
    await onToggleDisabledBulk(ids, disable);
    setBulkLoading(null);
  }

  async function bulkAll(disable: boolean) {
    setBulkLoading('all' + disable);
    await onToggleDisabledBulk(tables.map(t => t.id), disable);
    setBulkLoading(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Layers className="w-4 h-4 text-cyan-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-neutral-100">Manage All QR Codes</h3>
              <p className="text-xs text-gray-400 dark:text-neutral-500">{tables.length} tables · {activeCount} active · {disabledCount} disabled</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6 overflow-y-auto flex-1">

          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Enable / Disable — All Tables
            </p>
            <div className="flex gap-2">
              <button onClick={() => bulkAll(false)} disabled={bulkLoading === 'allfalse'}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                {bulkLoading === 'allfalse' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Enable All
              </button>
              <button onClick={() => bulkAll(true)} disabled={bulkLoading === 'alltrue'}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                {bulkLoading === 'alltrue' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                Disable All
              </button>
            </div>
          </div>

          {floors.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> By Floor
              </p>
              <div className="space-y-2">
                {floors.map(floor => {
                  const floorTables   = tables.filter(t => t.floor === floor);
                  const floorDisabled = floorTables.filter(t => t.qr_config?.qr_disabled).length;
                  return (
                    <div key={floor} className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-100 dark:border-[var(--sb-border)]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{floor}</p>
                        <p className="text-xs text-gray-400 dark:text-neutral-500">{floorTables.length} tables · {floorTables.length - floorDisabled} active</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => bulkByFloor(floor, false)} disabled={!!bulkLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
                          {bulkLoading === floor + 'false' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                          Enable
                        </button>
                        <button onClick={() => bulkByFloor(floor, true)} disabled={!!bulkLoading}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
                          {bulkLoading === floor + 'true' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
                          Disable
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 mb-3 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" /> Global Defaults
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 dark:text-neutral-500 mb-2">QR Type</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { val: 'static',  icon: Lock, label: 'Static QR',  desc: 'Fixed URL per table' },
                  { val: 'dynamic', icon: Zap,  label: 'Dynamic QR', desc: 'Short redirect URL' },
                ] as const).map(({ val, icon: Icon, label, desc }) => (
                  <button key={val} type="button" onClick={() => setQrType(val)}
                    className={cn('text-left px-3 py-2.5 rounded-xl border-2 transition-all',
                      qrType === val ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200 dark:border-[var(--sb-border)] hover:border-gray-300 dark:border-neutral-600')}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon className={cn('w-3.5 h-3.5', qrType === val ? 'text-cyan-600' : 'text-gray-400 dark:text-neutral-500')} />
                      <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">{label}</p>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-neutral-500">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 dark:text-neutral-500 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Session Timeout
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <input type="number" value={sessionMins}
                  onChange={e => setSessionMins(parseInt(e.target.value) || 30)}
                  min={5} max={480} step={5}
                  className="w-24 px-3 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
                <span className="text-sm text-gray-500 dark:text-neutral-500">minutes</span>
                <div className="flex gap-1 ml-auto">
                  {[15, 30, 60, 120].map(m => (
                    <button key={m} type="button" onClick={() => setSessionMins(m)}
                      className={cn('px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        sessionMins === m ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 hover:bg-gray-200')}>
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:text-neutral-100 rounded-xl hover:bg-gray-100 dark:bg-neutral-800 transition-colors">
            Close
          </button>
          <button onClick={applyGlobal} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-xl hover:bg-cyan-700 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Apply to All Tables
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Print Modal ────────────────────────────────────────────────────────────────
function PrintModal({
  tables,
  onClose,
}: {
  tables:  TableQR[];
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>QR Codes — Table Ordering</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: sans-serif; background: #fff; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; padding: 24px; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
            .card img { width: 140px; height: 140px; display: block; margin: 0 auto 10px; }
            .table-num { font-size: 16px; font-weight: 800; color: #111827; }
            .floor { font-size: 11px; color: #6b7280; margin-top: 2px; }
            .url { font-size: 9px; color: #0891b2; margin-top: 8px; word-break: break-all; }
            @media print { @page { margin: 12mm; } }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
              <Printer className="w-4 h-4 text-cyan-600" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-neutral-100">Print QR Codes ({tables.length})</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400 p-1.5 rounded-lg hover:bg-gray-100 dark:bg-neutral-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 bg-gray-50 dark:bg-neutral-800/50">
          <div ref={printRef}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {tables.map(t => (
                t.qr_data_url && (
                  <div key={t.id} className="border border-gray-200 dark:border-[var(--sb-border)] rounded-xl p-3 text-center bg-white dark:bg-[var(--sb-card)]">
                    <img src={t.qr_data_url} alt={`Table ${t.table_number}`} className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-2" />
                    <p className="font-extrabold text-gray-900 dark:text-neutral-100 text-sm">Table {t.table_number}</p>
                    <p className="text-[10px] text-gray-400 dark:text-neutral-500">{t.floor}</p>
                    <p className="text-[8px] text-cyan-600 mt-1 break-all">{t.qr_url}</p>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:text-neutral-100 rounded-xl hover:bg-gray-100 dark:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-xl hover:bg-cyan-700 transition-colors shadow-sm">
            <Printer className="w-4 h-4" /> Print Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function QRManagement() {
  const { t } = useTranslation();
  
  // 👉 Resolve active merchant ID
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const getLocalMerchantId = () => {
    try { return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null; }
    catch { return null; }
  };
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : getLocalMerchantId();

  const [tables, setTables]             = useState<TableQR[]>([]);
  const [loading, setLoading]           = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState<{ done: number; total: number } | null>(null);
  const [regenDone, setRegenDone]       = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [floorFilter, setFloorFilter]   = useState('');
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [printTargets, setPrintTargets] = useState<TableQR[] | null>(null);
  const [configTarget, setConfigTarget] = useState<TableQR | null>(null);
  const [bulkManageOpen, setBulkManageOpen] = useState(false);
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [editTarget, setEditTarget]     = useState<TableQR | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TableQR | null>(null);
  const [error, setError]               = useState<string | null>(null);
  // ── view mode toggle ──────────────────────────────────────────────
  const [viewMode, setViewMode]         = useState<'grid' | 'list'>('grid');
  const [infoBoxVisible, setInfoBoxVisible] = useState(true);
  const [floorControlOpen, setFloorControlOpen] = useState(false);

  // ── Fetch & enrich tables ───────────────────────────────────────────────
  const fetchTables = useCallback(async () => {
    if (!activeMerchantId) return; // Guard clause
    
    try {
      setLoading(true);
      setError(null);
      
      // 👉 Scope tables to the current merchant
      const { data: tableData, error: tableResError } = await supabase
        .from('tables')
        .select('*')
        .eq('merchant_id', activeMerchantId)
        .order('table_number');
        
      if (tableResError) throw tableResError;

      const tableIds = (tableData || []).map(t => t.id);

      let qrRes = { data: [] as any[] };
      let sessionRes = { data: [] as any[] };

      // 👉 Fetch configs & sessions for ONLY this merchant's tables
      if (tableIds.length > 0) {
        const [q, s] = await Promise.all([
          supabase.from('qr_config').select('*').in('table_id', tableIds),
          supabase.from('qr_sessions').select('*').eq('status', 'active').in('table_id', tableIds)
        ]);
        qrRes = q;
        sessionRes = s;
      }

      const qrMap = new Map<string, QrConfig>(
        (qrRes.data ?? []).map((r: QrConfig) => [r.table_id, r])
      );
      const sessionMap = new Map<string, QrSession>(
        (sessionRes.data ?? []).map((s: QrSession) => [s.table_id, s])
      );

      const rows: TableQR[] = (tableData || []).map(row => {
        const cfg = qrMap.get(row.id) ?? null;
        const qr_url = buildQrUrl(row.table_number, cfg);
        return {
          ...row,
          qr_url,
          qr_data_url:        null,
          scan_count:         cfg?.scan_count ?? row.scan_count ?? 0,
          last_scan:          cfg?.last_scan_at ?? row.last_scan ?? null,
          is_active:          row.is_active ?? true,
          floor_qr_disabled:  row.floor_qr_disabled ?? false,
          qr_config:          cfg,
          active_session:     sessionMap.get(row.id) ?? null,
        };
      });
      setTables(rows);

      const withQr = await Promise.all(
        rows.map(async row => ({
          ...row,
          qr_data_url: await generateQrDataUrl(row.qr_url),
        }))
      );
      setTables(withQr);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, [activeMerchantId]); // Dependency on merchantID

  useEffect(() => { fetchTables(); }, [fetchTables]);

  async function handleRegenerateAll() {
    setRegenerating(true);
    setRegenDone(false);
    setRegenProgress({ done: 0, total: tables.length });
    try {
      const updated: TableQR[] = [];
      for (const t of tables) {
        const qr_url      = buildQrUrl(t.table_number, t.qr_config);
        const qr_data_url = await generateQrDataUrl(qr_url);
        if (t.qr_config) {
          await supabase
            .from('qr_config')
            .update({ destination_url: qr_url })
            .eq('table_id', t.id);
        }
        const next = { ...t, qr_url, qr_data_url };
        updated.push(next);
        setTables(prev => prev.map(r => r.id === t.id ? next : r));
        setRegenProgress(prev => prev ? { ...prev, done: prev.done + 1 } : null);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to regenerate QR codes');
    } finally {
      setRegenerating(false);
      setRegenProgress(null);
      setRegenDone(true);
      setTimeout(() => setRegenDone(false), 4000);
    }
  }

  function handleDownload(table: TableQR) {
    if (!table.qr_data_url) return;
    const a = document.createElement('a');
    a.href     = table.qr_data_url;
    a.download = `qr-table-${table.table_number}.png`;
    a.click();
  }

  function handleDownloadAll() {
    tables.forEach(t => {
      if (!t.qr_data_url) return;
      const a = document.createElement('a');
      a.href     = t.qr_data_url;
      a.download = `qr-table-${t.table_number}.png`;
      a.click();
    });
  }

  function handlePrintSingle(table: TableQR) { setPrintTargets([table]); }

  function handleCopyUrl(table: TableQR) {
    navigator.clipboard.writeText(table.qr_url).then(() => {
      setCopiedId(table.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function handleToggleActive(id: string, val: boolean) {
    setTables(prev => prev.map(t => t.id === id ? { ...t, is_active: val } : t));
    await supabase.from('tables').update({ is_active: val }).eq('id', id);
  }

  async function handleToggleDisabled(id: string, val: boolean) {
    if (!activeMerchantId) return;
    setTables(prev => prev.map(t =>
      t.id === id ? { ...t, qr_config: t.qr_config ? { ...t.qr_config, qr_disabled: val } : null } : t
    ));
    await supabase.from('qr_config').upsert({ table_id: id, qr_disabled: val, merchant_id: activeMerchantId }, { onConflict: 'table_id' });
  }

  async function handleSaveConfig(tableId: string, patch: Partial<QrConfig>) {
    if (!activeMerchantId) return;
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    const short_code = table.qr_config?.short_code ?? generateShortCode();
    const payload = {
      table_id:             tableId,
      merchant_id:          activeMerchantId, // 👉 Inject merchant ID
      qr_type:              patch.qr_type              ?? table.qr_config?.qr_type              ?? 'static',
      short_code,
      token:                table.qr_config?.token      ?? generateToken(),
      token_expires_at:     table.qr_config?.token_expires_at ?? null,
      destination_url:      buildQrUrl(table.table_number, table.qr_config),
      custom_url:           patch.custom_url            ?? table.qr_config?.custom_url           ?? null,
      session_timeout_mins: patch.session_timeout_mins  ?? table.qr_config?.session_timeout_mins ?? 30,
      qr_disabled:          table.qr_config?.qr_disabled ?? false,
      scan_count:           table.qr_config?.scan_count  ?? 0,
    };
    const { data, error } = await supabase
      .from('qr_config').upsert(payload, { onConflict: 'table_id' }).select().single();
    if (error) { setError(error.message); return; }
    const newCfg = data as QrConfig;
    const newUrl = buildQrUrl(table.table_number, newCfg);
    await supabase.from('qr_config').update({ destination_url: newUrl }).eq('table_id', tableId);
    const newQr  = await generateQrDataUrl(newUrl);
    setTables(prev => prev.map(t =>
      t.id === tableId ? { ...t, qr_url: newUrl, qr_data_url: newQr, qr_config: { ...newCfg, destination_url: newUrl } } : t
    ));
  }

  async function handleRegenerateToken(table: TableQR) {
    const token            = generateToken();
    const token_expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('qr_config')
      .update({ token, token_expires_at }).eq('table_id', table.id);
    if (error) { setError(error.message); return; }

    const updatedCfg: QrConfig = { ...table.qr_config!, token, token_expires_at };
    const newUrl      = buildQrUrl(table.table_number, updatedCfg);
    const newQr       = await generateQrDataUrl(newUrl);

    await supabase.from('qr_config')
      .update({ destination_url: newUrl })
      .eq('table_id', table.id);

    setTables(prev => prev.map(t =>
      t.id === table.id
        ? { ...t, qr_url: newUrl, qr_data_url: newQr, qr_config: updatedCfg }
        : t
    ));
    setConfigTarget(prev =>
      prev?.id === table.id
        ? { ...prev, qr_url: newUrl, qr_data_url: newQr, qr_config: updatedCfg }
        : prev
    );
  }

  async function handleToggleFloor(floorName: string, disable: boolean) {
    if (!activeMerchantId) return;
    setTables(prev => prev.map(t =>
      t.floor === floorName ? { ...t, floor_qr_disabled: disable } : t
    ));
    const { error } = await supabase
      .from('tables')
      .update({ floor_qr_disabled: disable })
      .eq('floor', floorName)
      .eq('merchant_id', activeMerchantId); // 👉 Safety check
    if (error) {
      setTables(prev => prev.map(t =>
        t.floor === floorName ? { ...t, floor_qr_disabled: !disable } : t
      ));
      setError(error.message);
    }
  }

  async function handleToggleDisabledBulk(tableIds: string[], disable: boolean) {
    if (!activeMerchantId) return;
    setTables(prev => prev.map(t =>
      tableIds.includes(t.id) && t.qr_config
        ? { ...t, qr_config: { ...t.qr_config, qr_disabled: disable } } : t
    ));
    await Promise.all(tableIds.map(id =>
      supabase.from('qr_config').upsert({ table_id: id, qr_disabled: disable, merchant_id: activeMerchantId }, { onConflict: 'table_id' })
    ));
  }

  async function handleSaveGlobalDefaults(patch: { qr_type: 'static' | 'dynamic'; session_timeout_mins: number }) {
    if (!activeMerchantId) return;
    setTables(prev => prev.map(t =>
      t.qr_config ? { ...t, qr_config: { ...t.qr_config, ...patch } } : t
    ));
    await Promise.all(tables.map(t =>
      supabase.from('qr_config').upsert({ table_id: t.id, ...patch, merchant_id: activeMerchantId }, { onConflict: 'table_id' })
    ));
  }

  async function handleAddTable(data: { table_number: string; capacity: number; floor: string; area: string }) {
    if (!activeMerchantId) return;
    const { data: inserted, error: tErr } = await supabase
      .from('tables')
      // 👉 Inject merchant_id here
      .insert({ ...data, status: 'available', is_active: true, merchant_id: activeMerchantId })
      .select().single();
    if (tErr) { setError(tErr.message); return; }

    const token      = generateToken();
    const short_code = generateShortCode();
    const cfg_payload = {
      table_id: inserted.id, qr_type: 'static' as const, short_code, token,
      token_expires_at: null, destination_url: buildQrUrl(inserted.table_number),
      session_timeout_mins: 30, qr_disabled: false, scan_count: 0,
      merchant_id: activeMerchantId // 👉 Inject merchant_id here
    };
    const { data: newCfg, error: qErr } = await supabase.from('qr_config').insert(cfg_payload).select().single();
    if (qErr) { setError(qErr.message); }

    const cfg         = newCfg as QrConfig | null;
    const qr_url      = buildQrUrl(inserted.table_number, cfg);
    const qr_data_url = await generateQrDataUrl(qr_url);

    const newRow: TableQR = {
      ...inserted, qr_url, qr_data_url, scan_count: 0, last_scan: null, qr_config: cfg, active_session: null,
    };
    setTables(prev => [...prev, newRow].sort((a, b) => a.table_number.localeCompare(b.table_number)));
  }

  async function handleForceCloseSession(tableId: string, sessionId: string) {
    const { error } = await supabase.from('qr_sessions')
      .update({ status: 'closed', ended_at: new Date().toISOString() }).eq('id', sessionId);
    if (error) { setError(error.message); return; }
    await supabase.from('tables').update({ status: 'available' }).eq('id', tableId);
    setTables(prev => prev.map(t =>
      t.id === tableId ? { ...t, active_session: null, status: 'available' } : t
    ));
    setConfigTarget(prev => prev?.id === tableId ? { ...prev, active_session: null, status: 'available' } : prev);
  }

  async function handleEditTable(id: string, patch: {
    table_number: string; capacity: number; floor: string; area: string;
    status: 'available' | 'occupied' | 'reserved'; is_active: boolean;
  }) {
    const { error } = await supabase.from('tables').update(patch).eq('id', id);
    if (error) { setError(error.message); return; }

    const table      = tables.find(t => t.id === id);
    const numChanged = table && patch.table_number !== table.table_number;
    let qr_url       = table?.qr_url ?? '';
    let qr_data_url  = table?.qr_data_url ?? null;

    if (numChanged && table) {
      qr_url      = buildQrUrl(patch.table_number, table.qr_config);
      qr_data_url = await generateQrDataUrl(qr_url);
      if (table.qr_config) {
        await supabase.from('qr_config').update({ destination_url: qr_url }).eq('table_id', id);
      }
    }
    setTables(prev => prev.map(t =>
      t.id === id ? ({ ...t, ...patch, qr_url, qr_data_url } as TableQR) : t
    ));
  }

  async function handleDeleteTable(id: string) {
    const { error } = await supabase.from('tables').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    setTables(prev => prev.filter(t => t.id !== id));
  }

  const floors = [...new Set(tables.map(t => t.floor).filter(Boolean) as string[])].sort();

  // Floor disabled state: read floor_qr_disabled from the first table on that floor
  const floorDisabledMap = new Map<string, boolean>(
    floors.map(f => [f, tables.find(t => t.floor === f)?.floor_qr_disabled ?? false])
  );

  // A QR is truly active only when BOTH the floor master switch AND the table switch are on
  function isQrEffectivelyActive(table: TableQR): boolean {
    const floorDisabled = floorDisabledMap.get(table.floor) ?? false;
    const tableDisabled = table.qr_config?.qr_disabled ?? false;
    return table.is_active === true && !floorDisabled && !tableDisabled;
  }

  const filtered = tables.filter(t => {
    const matchSearch = !searchQuery ||
      t.table_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.floor?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFloor = !floorFilter || t.floor === floorFilter;
    return matchSearch && matchFloor;
  });

  const activeCount = tables.filter(t => isQrEffectivelyActive(t)).length;

  return (
    <>
      {addTableOpen && <AddTableModal onSave={handleAddTable} onClose={() => setAddTableOpen(false)} />}
      {editTarget && <EditTableModal table={editTarget} onSave={handleEditTable} onClose={() => setEditTarget(null)} />}
      {deleteTarget && <DeleteTableModal table={deleteTarget} onConfirm={handleDeleteTable} onClose={() => setDeleteTarget(null)} />}
      {bulkManageOpen && (
        <BulkManageModal tables={tables} floors={floors}
          onToggleDisabledBulk={handleToggleDisabledBulk}
          onSaveGlobalDefaults={handleSaveGlobalDefaults}
          onClose={() => setBulkManageOpen(false)} />
      )}
      {printTargets && <PrintModal tables={printTargets} onClose={() => setPrintTargets(null)} />}
      {configTarget && (
        <ManageQrModal
          table={configTarget}
          onSave={handleSaveConfig}
          onToggleDisabled={handleToggleDisabled}
          onRegenerateToken={handleRegenerateToken}
          onDownload={handleDownload}
          onPrint={handlePrintSingle}
          onCopyUrl={handleCopyUrl}
          onForceCloseSession={handleForceCloseSession}
          copiedId={copiedId}
          onClose={() => setConfigTarget(null)} />
      )}

      <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">

        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-600" />
              {t('qr.title', 'Table & QR Management')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-neutral-500 mt-0.5">
              Generate and manage QR codes for contactless table ordering.
            </p>
          </div>

          {/* Action buttons — scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0 sm:flex-wrap sm:justify-end">
            <button onClick={() => setAddTableOpen(true)} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 whitespace-nowrap shrink-0">
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Add Table
            </button>
            <button onClick={() => setBulkManageOpen(true)} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl text-xs sm:text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:bg-neutral-800/50 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Manage All QR
            </button>
            <button onClick={handleDownloadAll} disabled={loading || tables.every(t => !t.qr_data_url)}
              className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl text-xs sm:text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:bg-neutral-800/50 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0">
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Download All</span>
              <span className="sm:hidden">DL All</span>
            </button>
            <button onClick={() => setPrintTargets(filtered.filter(t => t.qr_data_url))}
              disabled={loading || filtered.every(t => !t.qr_data_url)}
              className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] rounded-xl text-xs sm:text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:bg-neutral-800/50 transition-all shadow-sm disabled:opacity-50 whitespace-nowrap shrink-0">
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Print All</span>
              <span className="sm:hidden">Print</span>
            </button>
            <button onClick={handleRegenerateAll} disabled={regenerating || loading}
              className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2 bg-cyan-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-cyan-700 transition-all shadow-md shadow-cyan-100 disabled:opacity-50 whitespace-nowrap shrink-0">
              <RefreshCw className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4', regenerating && 'animate-spin')} />
              {regenerating && regenProgress
                ? <span>{regenProgress.done}/{regenProgress.total}</span>
                : <>
                    <span className="hidden sm:inline">Regenerate All</span>
                    <span className="sm:hidden">Regen</span>
                  </>}
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* ── Regenerate progress bar ── */}
        {regenProgress && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-800">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Regenerating QR codes…
              </span>
              <span>{regenProgress.done} / {regenProgress.total}</span>
            </div>
            <div className="w-full h-1.5 bg-cyan-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${regenProgress.total > 0 ? (regenProgress.done / regenProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Regenerate done toast ── */}
        {regenDone && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              All {tables.length} QR codes regenerated successfully!
            </span>
            <button onClick={() => setRegenDone(false)} className="text-emerald-400 hover:text-emerald-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Info Box ── */}
        {infoBoxVisible && (
          <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-cyan-900">
                Contactless Ordering — {activeCount} of {tables.length} tables active
              </h4>
              <p className="text-xs text-cyan-700 mt-0.5">
                Customers scan these QR codes to view the menu and place orders from their phones.
              </p>
            </div>
            <button
              onClick={() => setInfoBoxVisible(false)}
              className="text-cyan-400 hover:text-cyan-600 p-0.5 rounded-lg hover:bg-cyan-100 transition-colors shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Search + Filter + View Toggle ── */}
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by table number or floor..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-[var(--sb-border)] rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            {floors.length > 1 && (
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={floorFilter}
                  onChange={e => setFloorFilter(e.target.value)}
                  className="appearance-none w-full sm:w-auto pl-3.5 pr-8 py-2.5 border border-gray-200 dark:border-[var(--sb-border)] rounded-xl text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-white dark:bg-[var(--sb-card)] text-gray-700 dark:text-neutral-300"
                >
                  <option value="">All Floors</option>
                  {floors.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-neutral-500 pointer-events-none" />
              </div>
            )}

            {/* View mode toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-neutral-800 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn('p-2 rounded-lg transition-all',
                  viewMode === 'grid' ? 'bg-white dark:bg-[var(--sb-card)] text-cyan-600 shadow-sm' : 'text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400')}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn('p-2 rounded-lg transition-all',
                  viewMode === 'list' ? 'bg-white dark:bg-[var(--sb-card)] text-cyan-600 shadow-sm' : 'text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400')}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Floor QR Controls (collapsible) ── */}
        {floors.length > 1 && (
          <div className="rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] bg-white dark:bg-[var(--sb-card)] overflow-hidden">
            {/* Clickable header — acts as toggle */}
            <button
              type="button"
              onClick={() => setFloorControlOpen(o => !o)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-neutral-800/50 hover:bg-gray-100 dark:bg-neutral-800 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-neutral-200">Floor QR Controls</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                  {floorControlOpen
                    ? 'Click to collapse'
                    : `${floors.length} floors · master switch overrides all tables on that floor`}
                </p>
              </div>
              {/* Show how many floors are currently offline */}
              {floors.filter(f => floorDisabledMap.get(f)).length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 shrink-0">
                  {floors.filter(f => floorDisabledMap.get(f)).length} offline
                </span>
              )}
              <ChevronDown className={cn(
                'w-4 h-4 text-gray-400 dark:text-neutral-500 shrink-0 transition-transform duration-200',
                floorControlOpen && 'rotate-180'
              )} />
            </button>

            {/* Collapsible floor rows */}
            {floorControlOpen && (
              <div className="divide-y divide-gray-100">
                {floors.map(floor => {
                  const floorOffline  = floorDisabledMap.get(floor) ?? false;
                  const floorTables   = tables.filter(t => t.floor === floor);
                  const tableOnCount  = floorTables.filter(t => !t.qr_config?.qr_disabled).length;
                  return (
                    <div key={floor} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200 truncate">{floor}</p>
                          {floorOffline && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-600 border border-orange-200">
                              Offline
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                          {floorTables.length} table{floorTables.length !== 1 ? 's' : ''} · {' '}
                          {floorOffline
                            ? <span className="text-orange-500 font-medium">floor master switch is OFF — all QRs blocked regardless of table setting</span>
                            : <><span className="text-emerald-600 font-medium">{tableOnCount} table{tableOnCount !== 1 ? 's' : ''} enabled</span>
                              {floorTables.length - tableOnCount > 0 && <span className="text-red-500 font-medium"> · {floorTables.length - tableOnCount} disabled</span>}</>
                          }
                        </p>
                      </div>
                      {/* Master toggle switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleFloor(floor, !floorOffline)}
                        className={cn(
                          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-200',
                          floorOffline ? 'bg-gray-200 border-gray-300 dark:border-neutral-600' : 'bg-emerald-500 border-emerald-600'
                        )}
                        title={floorOffline ? 'Turn floor online' : 'Turn floor offline'}
                      >
                        <span className={cn(
                          'inline-block h-4 w-4 rounded-full bg-white dark:bg-[var(--sb-card)] shadow-sm transition-transform duration-200',
                          floorOffline ? 'translate-x-0.5' : 'translate-x-5'
                        )} />
                      </button>
                    </div>
                  );
                })}
                {/* Legend */}
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-neutral-800/50 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-400 dark:text-neutral-500 leading-relaxed">
                    The floor switch is a <strong>master override</strong>. When a floor is offline, no QR on that floor will work — even if individual tables are enabled. Tables keep their own settings and resume normally when the floor goes back online.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Stats row ── */}
        {!loading && tables.length > 0 && (
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-neutral-500 flex-wrap">
            <span>Showing <strong className="text-gray-900 dark:text-neutral-100">{filtered.length}</strong> of {tables.length} tables</span>
            <span className="text-gray-300">·</span>
            <span><strong className="text-emerald-600">{activeCount}</strong> active</span>
            <span className="text-gray-300">·</span>
            <span><strong className="text-gray-900 dark:text-neutral-100">{tables.reduce((s, t) => s + t.scan_count, 0)}</strong> total scans</span>
          </div>
        )}

        {/* ── List view header (desktop only) ── */}
        {viewMode === 'list' && !loading && filtered.length > 0 && (
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider border-b border-gray-100 dark:border-[var(--sb-border)]">
            <div className="w-12 shrink-0" /> {/* QR thumb */}
            <div className="w-24 shrink-0">Table</div>
            <div className="w-28 shrink-0 hidden md:block">Floor</div>
            <div className="w-24 shrink-0 hidden lg:block">QR Type</div>
            <div className="w-20 shrink-0 text-center hidden md:block">Scans</div>
            <div className="w-24 shrink-0 hidden lg:block">Session</div>
            <div className="shrink-0">Status</div>
            <div className="flex-1 hidden xl:block">Last Scan</div>
            <div className="ml-auto shrink-0">Actions</div>
          </div>
        )}

        {/* ── Grid / List ── */}
        {loading ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] p-5 animate-pulse">
                  <div className="w-full aspect-square max-w-[144px] bg-gray-100 dark:bg-neutral-800 rounded-xl mx-auto mb-4" />
                  <div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-24 mx-auto mb-2" />
                  <div className="h-3 bg-gray-100 dark:bg-neutral-800 rounded w-16 mx-auto" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] p-4 animate-pulse flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-neutral-800 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-32" />
                    <div className="h-3 bg-gray-100 dark:bg-neutral-800 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-dashed border-gray-300 dark:border-neutral-600">
            <QrCode className="w-10 h-10 sm:w-12 sm:h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-neutral-500 font-semibold text-sm sm:text-base">No tables found</p>
            <p className="text-gray-400 dark:text-neutral-500 text-xs sm:text-sm mt-1">
              {searchQuery || floorFilter
                ? 'Try adjusting your search or filter.'
                : 'Add tables to generate QR codes.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {filtered.map((table, idx) => (
              <div key={table.id} className="relative">
                <QRCard
                  table={table}
                  floorDisabled={floorDisabledMap.get(table.floor) ?? false}
                  onOpenManage={t => setConfigTarget(t)}
                  onEdit={t => setEditTarget(t)}
                  onDelete={t => setDeleteTarget(t)}
                  copiedId={copiedId}
                />
                {/* Per-card generating overlay */}
                {regenProgress && idx >= regenProgress.done && (
                  <div className="absolute inset-0 rounded-2xl bg-white dark:bg-[var(--sb-card)]/80 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
                    <span className="text-[10px] font-semibold text-cyan-600">Generating…</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((table, idx) => (
              <div key={table.id} className="relative">
                <QRListRow
                  table={table}
                  floorDisabled={floorDisabledMap.get(table.floor) ?? false}
                  onOpenManage={t => setConfigTarget(t)}
                  onEdit={t => setEditTarget(t)}
                  onDelete={t => setDeleteTarget(t)}
                  copiedId={copiedId}
                  onCopyUrl={handleCopyUrl}
                  onDownload={handleDownload}
                />
                {/* Per-row generating overlay */}
                {regenProgress && idx >= regenProgress.done && (
                  <div className="absolute inset-0 rounded-xl bg-white dark:bg-[var(--sb-card)]/80 backdrop-blur-[2px] flex items-center justify-center gap-2 pointer-events-none">
                    <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                    <span className="text-xs font-semibold text-cyan-600">Generating…</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}