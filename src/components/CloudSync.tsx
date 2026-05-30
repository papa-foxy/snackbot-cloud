import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud, RefreshCw, CheckCircle2, AlertCircle,
  Database, Wifi, WifiOff, Clock,
  ArrowUpCircle, History, ShieldCheck, HardDrive,
  Trash2, Download, AlertTriangle, X, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/cn';
import { useTranslation } from '../contexts/TranslationContext';
import { useImpersonation } from '../contexts/ImpersonationContext';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface BackupLog {
  id: string;
  merchant_id: string;
  file_path: string;
  file_size_bytes: number;
  status: 'success' | 'error';
  notes: string | null;
  created_at: string;
}

interface CloudStats {
  totalBackups: number;
  successCount: number;
  errorCount: number;
  totalBytes: number;
  lastBackupAt: string | null;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─────────────────────────────────────────────
// DELETE CONFIRM MODAL
// ─────────────────────────────────────────────

function DeleteModal({
  log,
  onConfirm,
  onCancel,
  deleting,
}: {
  log: BackupLog;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl shadow-2xl border border-gray-200 dark:border-[var(--sb-border)] w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">Delete Backup?</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
              This will permanently remove the backup file from cloud storage. This action cannot be undone.
            </p>
          </div>
          <button onClick={onCancel} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-neutral-800/60 rounded-xl px-4 py-3 mb-5 text-xs text-gray-600 dark:text-neutral-400 font-mono break-all">
          {log.file_path}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] text-sm font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LOG ROW
// ─────────────────────────────────────────────

function LogRow({
  log,
  onDelete,
  onDownload,
}: {
  log: BackupLog;
  onDelete: (log: BackupLog) => void;
  onDownload: (log: BackupLog) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSuccess = log.status === 'success';

  return (
    <div className="border-b border-gray-50 dark:border-[var(--sb-border)] last:border-0">
      <div
        className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/70 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer group"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Status icon */}
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
          isSuccess ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500',
        )}>
          {isSuccess
            ? <CheckCircle2 className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 dark:text-neutral-100 truncate">
              {log.notes ?? 'Backup'}
            </span>
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
              isSuccess
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
            )}>
              {log.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-400 dark:text-neutral-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelative(log.created_at)}
            </span>
            {log.file_size_bytes > 0 && (
              <span className="text-xs text-gray-400 dark:text-neutral-500 flex items-center gap-1">
                <Database className="w-3 h-3" />
                {formatBytes(log.file_size_bytes)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {isSuccess && log.file_path && (
            <button
              onClick={() => onDownload(log)}
              title="Download backup"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(log)}
            title="Delete backup"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <ChevronDown className={cn(
          'w-4 h-4 text-gray-300 dark:text-neutral-600 shrink-0 transition-transform duration-200',
          expanded && 'rotate-180',
        )} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-4 pt-1 bg-gray-50/50 dark:bg-neutral-800/30 border-t border-gray-100 dark:border-[var(--sb-border)] animate-in slide-in-from-top-1 duration-150">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div>
              <dt className="text-gray-400 dark:text-neutral-500 font-medium mb-0.5">Date & Time</dt>
              <dd className="text-gray-700 dark:text-neutral-300 font-semibold">{formatDateTime(log.created_at)}</dd>
            </div>
            <div>
              <dt className="text-gray-400 dark:text-neutral-500 font-medium mb-0.5">File Size</dt>
              <dd className="text-gray-700 dark:text-neutral-300 font-semibold">{formatBytes(log.file_size_bytes)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-400 dark:text-neutral-500 font-medium mb-0.5">Storage Path</dt>
              <dd className="text-gray-700 dark:text-neutral-300 font-mono break-all">{log.file_path || '—'}</dd>
            </div>
            {log.notes && (
              <div className="col-span-2">
                <dt className="text-gray-400 dark:text-neutral-500 font-medium mb-0.5">Notes</dt>
                <dd className="text-gray-700 dark:text-neutral-300">{log.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export function CloudSync() {
  const { t } = useTranslation();
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const activeMerchantId = (isImpersonating ? impersonatedMerchantId : 
    (JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null)) ?? '';

  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [stats, setStats] = useState<CloudStats>({
    totalBackups: 0,
    successCount: 0,
    errorCount: 0,
    totalBytes: 0,
    lastBackupAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupLog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  // ── Online/offline listener ──────────────────
  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // ── Toast auto-dismiss ───────────────────────
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // ── Fetch logs + compute stats ───────────────
  const fetchLogs = useCallback(async () => {
    if (!activeMerchantId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      let query = supabase
        .from('backup_logs')
        .select('*')
        .eq('merchant_id', activeMerchantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as BackupLog[];
      setLogs(rows);

      // Compute stats from all rows (unfiltered summary)
      const { data: allRows } = await supabase
        .from('backup_logs')
        .select('status, file_size_bytes, created_at')
        .eq('merchant_id', activeMerchantId)
        .order('created_at', { ascending: false });

      if (allRows) {
        const total = allRows.length;
        const ok = allRows.filter(r => r.status === 'success').length;
        const bytes = allRows.reduce((acc, r) => acc + (r.file_size_bytes ?? 0), 0);
        setStats({
          totalBackups: total,
          successCount: ok,
          errorCount: total - ok,
          totalBytes: bytes,
          lastBackupAt: allRows[0]?.created_at ?? null,
        });
      }
    } catch (err) {
      console.error('Failed to fetch backup logs', err);
      showToast('Failed to load backup history', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, activeMerchantId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ── Realtime subscription ────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('backup_logs_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'backup_logs',
      }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLogs]);

  // ── Helpers ──────────────────────────────────
  const showToast = (text: string, type: 'success' | 'error') => setToastMsg({ text, type });

  const handleSyncNow = async () => {
    setSyncing(true);
    await fetchLogs();
    setSyncing(false);
    showToast('Sync refreshed', 'success');
  };

  const handleDownload = async (log: BackupLog) => {
    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .createSignedUrl(log.file_path, 60); // 60 second signed URL
      if (error) throw error;
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = log.file_path.split('/').pop() ?? 'backup.json.gz';
      a.click();
    } catch {
      showToast('Failed to generate download link', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Remove from storage if a real file path exists
      if (deleteTarget.file_path) {
        const { error: storageErr } = await supabase.storage
          .from('backups')
          .remove([deleteTarget.file_path]);
        if (storageErr) throw storageErr;
      }

      // Remove metadata row
      const { error: dbErr } = await supabase
        .from('backup_logs')
        .delete()
        .eq('id', deleteTarget.id);
      if (dbErr) throw dbErr;

      showToast('Backup deleted', 'success');
      setDeleteTarget(null);
      await fetchLogs();
    } catch (err) {
      showToast('Failed to delete backup', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Storage usage % ──────────────────────────
  const QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB — adjust to your plan
  const usedPct = Math.min((stats.totalBytes / QUOTA_BYTES) * 100, 100);
  const successRate = stats.totalBackups > 0
    ? Math.round((stats.successCount / stats.totalBackups) * 100)
    : 100;

  // ─────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Toast notification ─────────────────── */}
      {toastMsg && (
        <div className={cn(
          'fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold animate-in slide-in-from-top-2 duration-300',
          toastMsg.type === 'success'
            ? 'bg-emerald-500 text-white'
            : 'bg-red-500 text-white',
        )}>
          {toastMsg.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toastMsg.text}
          <button onClick={() => setToastMsg(null)} className="ml-2 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Delete modal ───────────────────────── */}
      {deleteTarget && (
        <DeleteModal
          log={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* ── Header ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Cloud className="w-6 h-6 text-sky-600" />
            {t('cloud.title', 'Cloud & Sync')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
            Monitor backup history and cloud connectivity for SnackBot.
          </p>
        </div>
        <button
          onClick={handleSyncNow}
          disabled={syncing || !isOnline}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-sm font-semibold hover:bg-sky-700 transition-all shadow-md shadow-sky-100 disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
          {syncing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Status cards ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Connection */}
        <div className={cn(
          'p-5 rounded-2xl border-2 flex flex-col gap-3 transition-all',
          isOnline ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30'
                   : 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30',
        )}>
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            isOnline ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                     : 'bg-red-100 text-red-600 dark:bg-red-900/30',
          )}>
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Connection</p>
            <p className="text-base font-bold text-gray-900 dark:text-neutral-100 mt-0.5">
              {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Total Backups */}
        <div className="bg-white dark:bg-[var(--sb-card)] p-5 rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm flex flex-col gap-3">
          <div className="w-10 h-10 bg-sky-50 text-sky-600 dark:bg-sky-900/20 rounded-xl flex items-center justify-center">
            <ArrowUpCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Total Backups</p>
            <p className="text-base font-bold text-gray-900 dark:text-neutral-100 mt-0.5">{stats.totalBackups}</p>
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white dark:bg-[var(--sb-card)] p-5 rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm flex flex-col gap-3">
          <div className="w-10 h-10 bg-violet-50 text-violet-600 dark:bg-violet-900/20 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Success Rate</p>
            <p className={cn(
              'text-base font-bold mt-0.5',
              successRate === 100 ? 'text-emerald-600' : successRate >= 80 ? 'text-amber-500' : 'text-red-500',
            )}>
              {successRate}%
            </p>
          </div>
        </div>

        {/* Last Backup */}
        <div className="bg-white dark:bg-[var(--sb-card)] p-5 rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm flex flex-col gap-3">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Last Backup</p>
            <p className="text-base font-bold text-gray-900 dark:text-neutral-100 mt-0.5">
              {stats.lastBackupAt ? formatRelative(stats.lastBackupAt) : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main grid ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Backup log list ─────────────────────────────── */}
        <div className="lg:col-span-2 bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden flex flex-col">

          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-[var(--sb-border)] flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-bold text-gray-900 dark:text-neutral-100 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              Backup History
            </h3>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-lg p-1">
              {(['all', 'success', 'error'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all',
                    statusFilter === f
                      ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200',
                  )}
                >
                  {f}
                  {f === 'error' && stats.errorCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 rounded-full text-[9px] font-bold">
                      {stats.errorCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-[var(--sb-border)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-4 animate-pulse flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-neutral-800 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 dark:bg-neutral-800 rounded w-1/3" />
                    <div className="h-2.5 bg-gray-100 dark:bg-neutral-800 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <div className="w-12 h-12 bg-gray-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center">
                  <Cloud className="w-6 h-6 text-gray-300 dark:text-neutral-600" />
                </div>
                <p className="font-semibold text-gray-700 dark:text-neutral-300">No backups found</p>
                <p className="text-sm text-gray-400 dark:text-neutral-500">
                  {statusFilter === 'all'
                    ? 'Run a backup from the Backup settings panel to get started.'
                    : `No ${statusFilter} backups in history.`}
                </p>
              </div>
            ) : (
              logs.map(log => (
                <LogRow
                  key={log.id}
                  log={log}
                  onDelete={setDeleteTarget}
                  onDownload={handleDownload}
                />
              ))
            )}
          </div>

          {/* Footer count */}
          {logs.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 dark:border-[var(--sb-border)] text-xs text-gray-400 dark:text-neutral-500">
              Showing {logs.length} record{logs.length !== 1 ? 's' : ''}
              {statusFilter !== 'all' && ` · filtered by "${statusFilter}"`}
            </div>
          )}
        </div>

        {/* ── Right sidebar ─────────────────────────────── */}
        <div className="space-y-5">

          {/* Cloud Configuration */}
          <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm p-5">
            <h3 className="font-bold text-gray-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-gray-400" />
              Cloud Configuration
            </h3>
            <div className="space-y-3">
              <ConfigRow label="Sync Frequency" value="Real-time" />
              <ConfigRow label="Conflict Policy" value="Server Wins" />
              <ConfigRow label="Encryption" value="AES-256" valueClass="text-emerald-600 dark:text-emerald-400" />
              <ConfigRow label="Compression" value="GZip" />
              <ConfigRow label="Bucket" value="backups" monospace />

              {/* Storage bar */}
              <div className="pt-3 border-t border-gray-100 dark:border-[var(--sb-border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">Cloud Storage Used</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-neutral-100">
                    {formatBytes(stats.totalBytes)} / 500 MB
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      usedPct > 80 ? 'bg-red-500' : usedPct > 60 ? 'bg-amber-400' : 'bg-sky-500',
                    )}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 dark:text-neutral-600 mt-1">{usedPct.toFixed(1)}% used</p>
              </div>
            </div>
          </div>

          {/* Backup summary */}
          <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm p-5">
            <h3 className="font-bold text-gray-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-400" />
              Summary
            </h3>
            <div className="space-y-3">
              <ConfigRow label="Successful" value={String(stats.successCount)} valueClass="text-emerald-600 dark:text-emerald-400" />
              <ConfigRow label="Failed" value={String(stats.errorCount)} valueClass={stats.errorCount > 0 ? 'text-red-500' : undefined} />
              <ConfigRow label="Total Size" value={formatBytes(stats.totalBytes)} />
              {stats.lastBackupAt && (
                <ConfigRow label="Last Backup" value={formatDateTime(stats.lastBackupAt)} />
              )}
            </div>
          </div>

          {/* Offline card */}
          <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-sky-100 dark:shadow-none">
            <HardDrive className="w-7 h-7 mb-3 opacity-50" />
            <h3 className="font-bold text-base mb-1.5">Offline Protection</h3>
            <p className="text-sm text-sky-100 leading-relaxed">
              Your data is automatically cached locally. If connection drops, SnackBot continues working and syncs when reconnected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TINY HELPER COMPONENTS
// ─────────────────────────────────────────────

function ConfigRow({
  label,
  value,
  valueClass,
  monospace,
}: {
  label: string;
  value: string;
  valueClass?: string;
  monospace?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-gray-500 dark:text-neutral-500 shrink-0">{label}</span>
      <span className={cn(
        'text-sm font-bold text-gray-900 dark:text-neutral-100 text-right truncate',
        monospace && 'font-mono text-xs',
        valueClass,
      )}>
        {value}
      </span>
    </div>
  );
}