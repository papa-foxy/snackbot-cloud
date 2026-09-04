import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCheck2,
  Download,
  RefreshCw,
  RotateCcw,
  Building2,
  ShieldCheck,
  ListChecks,
  ChevronDown,
  X,
  PackagePlus,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../../utils/cn';
import { supabase } from '../../../lib/supabase';
import { useImpersonation } from '../../../contexts/ImpersonationContext';

// ─── Merchant helper ──────────────────────────────────────────────────────────

function getMerchantId(): string {
  try {
    return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? '';
  } catch { return ''; }
}

function getCurrentUserId(): string | null {
  try {
    return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.id ?? null;
  } catch { return null; }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LhdnStatus =
  | 'pending'
  | 'pending_consolidation'
  | 'submitted'
  | 'failed'
  | 'retrying';

type BatchStatus =
  | 'draft'
  | 'queued'
  | 'processing'
  | 'submitted'
  | 'validated'
  | 'failed';

type TabId = 'pending' | 'batches' | 'submitted' | 'errors' | 'audit';

interface Outlet {
  id: string;
  name: string;
}

// Individual order eligible for batching
interface EligibleOrder {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  gst_amount: number;
  lhdn_status: LhdnStatus;
  branch_id: string;
  outlet_name: string;
  batch_id: string | null;
}

// Consolidated batch document
interface Batch {
  id: string;
  batch_number: string;
  branch_id: string;
  outlet_name: string;
  total_orders: number;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  status: BatchStatus;
  created_at: string;
  submitted_at?: string;
  validated_at?: string;
  error_message?: string;
  retry_count: number;
  invoice_id?: string;
  // items expanded for preview
  items?: EligibleOrder[];
}

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
  outcome: 'success' | 'error' | 'warn' | 'info';
  batch_id?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RETRY_DELAYS_MINUTES = [5, 15, 45, 135, 405];
const MAX_RETRIES = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextRetryDelay(retryCount: number): number {
  return RETRY_DELAYS_MINUTES[Math.min(retryCount, RETRY_DELAYS_MINUTES.length - 1)];
}

function formatRetryTime(isoString?: string): string {
  if (!isoString) return '—';
  return format(new Date(isoString), 'dd MMM, HH:mm');
}

function generateInvoiceId(): string {
  return `INV-MY-${String(Math.floor(Math.random() * 900000 + 100000))}`;
}

function generateAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Mock API ─────────────────────────────────────────────────────────────────

async function submitBatchToMyInvois(
  batch: Batch
): Promise<{ success: boolean; invoice_id?: string; error?: string }> {
  await new Promise((res) => setTimeout(res, 1800));
  if (Math.random() < 0.05) {
    return { success: false, error: 'LHDN-ERR-504: Gateway timeout' };
  }
  return { success: true, invoice_id: generateInvoiceId() };
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateOrders(orders: EligibleOrder[]): ValidationResult {
  const errors: string[] = [];
  for (const o of orders) {
    if (!o.order_number) errors.push(`${o.id}: missing order_number`);
    if (!o.branch_id)    errors.push(`${o.id}: missing branch_id`);
    if (o.total <= 0)    errors.push(`${o.order_number}: total must be > 0`);
    if (o.gst_amount < 0) errors.push(`${o.order_number}: negative GST`);
  }
  return { valid: errors.length === 0, errors };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, colorClass, bgClass,
}: {
  label: string; value: number | string;
  icon: React.ElementType; colorClass: string; bgClass: string;
}) {
  return (
    <div className="bg-white dark:bg-[var(--sb-card)] p-5 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm flex items-center gap-4">
      <div className={cn('p-3 rounded-lg', bgClass, colorClass)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-neutral-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const map: Record<BatchStatus, string> = {
    draft:      'bg-gray-100 text-gray-700',
    queued:     'bg-amber-100 text-amber-800',
    processing: 'bg-blue-100 text-blue-800',
    submitted:  'bg-emerald-100 text-emerald-800',
    validated:  'bg-indigo-100 text-indigo-800',
    failed:     'bg-red-100 text-red-800',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', map[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function AuditDot({ outcome }: { outcome: AuditEntry['outcome'] }) {
  const map = { success: 'bg-emerald-500', error: 'bg-red-500', warn: 'bg-amber-500', info: 'bg-blue-500' };
  return <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1.5', map[outcome])} />;
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-1.5 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
      <div className="h-full bg-indigo-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
    </div>
  );
}

// Batch preview modal — shows all orders inside a draft batch before submit
function BatchPreviewModal({
  batch, onClose, onSubmit, submitting,
}: {
  batch: Batch; onClose: () => void;
  onSubmit: (batch: Batch) => void; submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-[var(--sb-border)]">
          <div>
            <p className="font-semibold text-gray-900 dark:text-neutral-100">{batch.batch_number}</p>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5">{batch.outlet_name} · {batch.total_orders} orders</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order list */}
        <div className="px-6 py-3 max-h-64 overflow-y-auto space-y-1">
          {(batch.items ?? []).map((o) => (
            <div key={o.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 dark:border-neutral-800 last:border-0">
              <span className="font-mono text-xs text-gray-700 dark:text-neutral-300">{o.order_number}</span>
              <span className="text-gray-500 dark:text-neutral-500 text-xs">{format(new Date(o.created_at), 'dd MMM HH:mm')}</span>
              <span className="font-medium text-gray-800 dark:text-neutral-200">RM {o.total.toFixed(2)}</span>
            </div>
          ))}
          {(!batch.items || batch.items.length === 0) && (
            <p className="text-sm text-gray-400 dark:text-neutral-500 py-4 text-center">No items loaded</p>
          )}
        </div>

        {/* Totals */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-neutral-800/50 rounded-b-none space-y-1 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-neutral-400">
            <span>Subtotal</span><span>RM {batch.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-neutral-400">
            <span>Tax (SST)</span><span>RM {batch.tax_total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 dark:text-neutral-100 pt-1 border-t border-gray-200 dark:border-neutral-700">
            <span>Grand Total</span><span>RM {batch.grand_total.toFixed(2)}</span>
          </div>
        </div>

        <div className="px-6 pb-5 pt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 dark:border-[var(--sb-border)] text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(batch)}
            disabled={submitting || batch.status !== 'draft'}
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit to LHDN'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LHDN() {
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const activeMerchantId = (isImpersonating ? impersonatedMerchantId : getMerchantId()) ?? '';

  // Eligible unpacked orders (not yet in any batch)
  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrder[]>([]);
  // All batches for this merchant
  const [batches, setBatches] = useState<Batch[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [submittingBatchId, setSubmittingBatchId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState(0);
  const [previewBatch, setPreviewBatch] = useState<Batch | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [outletFilter, setOutletFilter] = useState<string>('all');

  // ── Audit helper ─────────────────────────────────────────────────────────────

  function pushAudit(
    action: string,
    detail: string,
    outcome: AuditEntry['outcome'],
    batch_id?: string
  ) {
    setAuditLog((prev) => [
      { id: generateAuditId(), timestamp: new Date().toISOString(), action, detail, outcome, batch_id },
      ...prev.slice(0, 199),
    ]);
  }

  // ── Fetch eligible orders (pending tab) ──────────────────────────────────────

  const fetchEligibleOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, order_number, created_at, total, gst_amount,' +
          ' lhdn_status, branch_id, batch_id,' +
          ' branches(id, name)'
        )
        .eq('merchant_id', activeMerchantId)
        .eq('lhdn_required', true)
        .eq('payment_status', 'paid')
        .eq('status', 'completed')
        .is('deleted_at', null)
        .is('batch_id', null)                                     // not yet batched
        .in('lhdn_status', ['pending', 'pending_consolidation'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: EligibleOrder[] = (data || []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        created_at: o.created_at,
        total: o.total ?? 0,
        gst_amount: o.gst_amount ?? 0,
        lhdn_status: o.lhdn_status,
        branch_id: o.branch_id ?? '',
        outlet_name: o.branches?.name ?? 'Branch ' + (o.branch_id ?? '').slice(0, 8),
        batch_id: o.batch_id ?? null,
      }));

      setEligibleOrders(mapped);

      // Derive unique outlets for filter dropdown
      const uniqueOutlets: Outlet[] = Array.from(
        new Map(mapped.map((o) => [o.branch_id, { id: o.branch_id, name: o.outlet_name }])).values()
      );
      setOutlets(uniqueOutlets);

      pushAudit('Orders synced', `${mapped.length} eligible records`, 'info');
    } catch (err: any) {
      console.error('fetchEligibleOrders failed', err);
      pushAudit('Sync failed', err?.message ?? err?.details ?? err?.hint ?? JSON.stringify(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [activeMerchantId]);

  // ── Fetch batches ─────────────────────────────────────────────────────────────

  const fetchBatches = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('einvoice_batches')
        .select('*, branches(name)')
        .eq('merchant_id', activeMerchantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBatches(
        (data || []).map((b: any) => ({
          ...b,
          outlet_name: b.branches?.name ?? 'Branch ' + (b.branch_id ?? '').slice(0, 8),
        }))
      );
    } catch (err: any) {
      console.error('fetchBatches failed', err);
    }
  }, [activeMerchantId]);

  useEffect(() => {
    fetchEligibleOrders();
    fetchBatches();
  }, [fetchEligibleOrders, fetchBatches]);

  // ── Computed ──────────────────────────────────────────────────────────────────

  const filteredOrders = eligibleOrders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || o.order_number.toLowerCase().includes(q) || o.outlet_name.toLowerCase().includes(q);
    const matchesOutlet = outletFilter === 'all' || o.branch_id === outletFilter;
    return matchesSearch && matchesOutlet;
  });

  const pendingCount    = eligibleOrders.length;
  const batchCount      = batches.length;
  const submittedCount  = batches.filter((b) => b.status === 'submitted' || b.status === 'validated').length;
  const failedCount     = batches.filter((b) => b.status === 'failed').length;

  const selectedOrders  = eligibleOrders.filter((o) => selectedOrderIds.includes(o.id));
  const selectedTotal   = selectedOrders.reduce((s, o) => s + o.total, 0);
  const selectedTax     = selectedOrders.reduce((s, o) => s + o.gst_amount, 0);

  // ── Create batch from selected orders ────────────────────────────────────────

  async function handleCreateBatch() {
    if (selectedOrderIds.length === 0 || creatingBatch) return;

    const selected = eligibleOrders.filter((o) => selectedOrderIds.includes(o.id));

    // Validate
    const { valid, errors } = validateOrders(selected);
    if (!valid) {
      pushAudit('Validation failed', errors.slice(0, 3).join('; '), 'error');
      alert(`Cannot create batch — fix these issues:\n\n${errors.join('\n')}`);
      return;
    }

    // Group by branch — one batch per branch
    const byBranch = selected.reduce<Record<string, EligibleOrder[]>>((acc, o) => {
      if (!acc[o.branch_id]) acc[o.branch_id] = [];
      acc[o.branch_id].push(o);
      return acc;
    }, {});

    setCreatingBatch(true);

    try {
      // Get the authenticated user's ID to satisfy the foreign key constraint pointing to auth.users(id)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const authUserId = authUser?.id ?? getCurrentUserId();

      for (const [branchId, orders] of Object.entries(byBranch)) {
        const outletName = orders[0].outlet_name;
        const subtotal   = orders.reduce((s, o) => s + o.total, 0);
        const taxTotal   = orders.reduce((s, o) => s + o.gst_amount, 0);
        const grandTotal = subtotal; // total already includes tax from POS

        // 1. Create the batch record
        const { data: batchData, error: batchErr } = await supabase
          .from('einvoice_batches')
          .insert({
            batch_number: `BATCH-${format(new Date(), 'yyyyMMdd')}-${String(Date.now()).slice(-4)}`,
            merchant_id:  activeMerchantId,
            branch_id:    branchId,
            batch_type:   'consolidated',
            total_orders: orders.length,
            subtotal:     parseFloat(subtotal.toFixed(2)),
            tax_total:    parseFloat(taxTotal.toFixed(2)),
            grand_total:  parseFloat(grandTotal.toFixed(2)),
            status:       'draft',
            submitted_by: authUserId,
            // batch_number generated by DB function via trigger (or set manually below)
          })
          .select('id')
          .single();

        if (batchErr || !batchData) throw batchErr ?? new Error('Batch insert returned no data');

        const batchId = batchData.id;

        // 2. Insert batch items
        const items = orders.map((o) => ({
          batch_id:     batchId,
          order_id:     o.id,
          order_number: o.order_number,
          amount:       o.total,
          tax:          o.gst_amount,
        }));

        const { error: itemsErr } = await supabase
          .from('einvoice_batch_items')
          .insert(items);

        if (itemsErr) throw itemsErr;

        // 3. Stamp orders with batch_id and move to pending_consolidation
        const { error: ordersErr } = await supabase
          .from('orders')
          .update({
            batch_id:             batchId,
            lhdn_status:          'pending_consolidation',
            lhdn_submission_type: 'consolidated',
          })
          .in('id', orders.map((o) => o.id))
          .eq('merchant_id', activeMerchantId);

        if (ordersErr) throw ordersErr;

        pushAudit(
          'Batch created',
          `${outletName} · ${orders.length} orders · RM ${grandTotal.toFixed(2)}`,
          'success',
          batchId
        );
      }

      // Refresh both lists
      await Promise.all([fetchEligibleOrders(), fetchBatches()]);
      setSelectedOrderIds([]);
      setActiveTab('batches');
    } catch (err: any) {
      console.error('handleCreateBatch error', err);
      const msg = err?.message ?? err?.details ?? err?.hint ?? JSON.stringify(err);
      pushAudit('Batch creation failed', msg, 'error');
      alert(`Failed to create batch:\n${msg}`);
    } finally {
      setCreatingBatch(false);
    }
  }

  // ── Load batch items for preview ──────────────────────────────────────────────

  async function handlePreviewBatch(batch: Batch) {
    try {
      const { data, error } = await supabase
        .from('einvoice_batch_items')
        .select('order_id, order_number, amount, tax, created_at')
        .eq('batch_id', batch.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setPreviewBatch({
        ...batch,
        items: (data || []).map((i: any) => ({
          id: i.order_id,
          order_number: i.order_number,
          created_at: i.created_at,
          total: i.amount,
          gst_amount: i.tax,
          lhdn_status: 'pending_consolidation',
          branch_id: batch.branch_id,
          outlet_name: batch.outlet_name,
          batch_id: batch.id,
        })),
      });
    } catch (err: any) {
      alert(`Failed to load batch items: ${err?.message ?? err?.details ?? err?.hint ?? JSON.stringify(err)}`);
    }
  }

  // ── Submit a draft batch to LHDN ─────────────────────────────────────────────

  async function handleSubmitBatch(batch: Batch) {
    if (submittingBatchId || batch.status !== 'draft') return;

    setSubmittingBatchId(batch.id);
    setBatchProgress(10);
    setPreviewBatch(null);

    try {
      // Mark batch as processing
      await supabase
        .from('einvoice_batches')
        .update({ status: 'processing' })
        .eq('id', batch.id)
        .eq('merchant_id', activeMerchantId);

      setBatches((prev) => prev.map((b) => b.id === batch.id ? { ...b, status: 'processing' } : b));

      pushAudit('Submission started', `${batch.batch_number} · ${batch.total_orders} orders`, 'info', batch.id);
      setBatchProgress(40);

      await new Promise((r) => setTimeout(r, 300));
      pushAudit('Generating XML & signature', `${batch.batch_number} · SHA-256/RSA`, 'info', batch.id);
      setBatchProgress(70);

      const result = await submitBatchToMyInvois(batch);
      setBatchProgress(90);

      if (result.success && result.invoice_id) {
        const now = new Date().toISOString();

        // Update batch
        await supabase
          .from('einvoice_batches')
          .update({
            status:       'submitted',
            invoice_id:   result.invoice_id,
            submitted_at: now,
          })
          .eq('id', batch.id)
          .eq('merchant_id', activeMerchantId);

        // Update all orders in this batch
        await supabase
          .from('orders')
          .update({
            lhdn_status:    'submitted',
            lhdn_submitted:  true,
            submitted_at:    now,
            invoice_id:      result.invoice_id,
          })
          .eq('batch_id', batch.id)
          .eq('merchant_id', activeMerchantId);

        setBatches((prev) =>
          prev.map((b) =>
            b.id === batch.id
              ? { ...b, status: 'submitted', invoice_id: result.invoice_id, submitted_at: now }
              : b
          )
        );

        pushAudit(
          'Batch submitted',
          `${batch.batch_number} · ${result.invoice_id} · RM ${batch.grand_total.toFixed(2)}`,
          'success',
          batch.id
        );
        setActiveTab('submitted');
      } else {
        const nextRetry = new Date(
          Date.now() + getNextRetryDelay(batch.retry_count) * 60 * 1000
        ).toISOString();

        await supabase
          .from('einvoice_batches')
          .update({
            status:        'failed',
            retry_count:   batch.retry_count + 1,
            error_message: result.error,
          })
          .eq('id', batch.id)
          .eq('merchant_id', activeMerchantId);

        setBatches((prev) =>
          prev.map((b) =>
            b.id === batch.id
              ? { ...b, status: 'failed', retry_count: b.retry_count + 1, error_message: result.error }
              : b
          )
        );

        pushAudit('Submission failed', `${batch.batch_number} · ${result.error}`, 'error', batch.id);
      }
    } catch (err: any) {
      console.error('handleSubmitBatch error', err);
      await supabase
        .from('einvoice_batches')
        .update({ status: 'failed', error_message: err?.message ?? err?.details ?? err?.hint ?? JSON.stringify(err) })
        .eq('id', batch.id)
        .eq('merchant_id', activeMerchantId);
      pushAudit('Submission error', err?.message ?? err?.details ?? err?.hint ?? JSON.stringify(err), 'error', batch.id);
    } finally {
      setBatchProgress(100);
      await new Promise((r) => setTimeout(r, 300));
      setSubmittingBatchId(null);
      setBatchProgress(0);
    }
  }

  // ── Retry failed batch ────────────────────────────────────────────────────────

  async function handleRetryBatch(batch: Batch) {
    if (batch.retry_count >= MAX_RETRIES) {
      alert(`Maximum retries (${MAX_RETRIES}) reached. Manual intervention required.`);
      return;
    }
    // Reset to draft so handleSubmitBatch can run it again
    await supabase
      .from('einvoice_batches')
      .update({ status: 'draft', error_message: null })
      .eq('id', batch.id)
      .eq('merchant_id', activeMerchantId);

    setBatches((prev) =>
      prev.map((b) => b.id === batch.id ? { ...b, status: 'draft', error_message: undefined } : b)
    );

    pushAudit('Retry queued', `${batch.batch_number} · attempt ${batch.retry_count + 1}`, 'warn', batch.id);
    await handleSubmitBatch({ ...batch, status: 'draft' });
  }

  // ── Sync ──────────────────────────────────────────────────────────────────────

  async function handleSync() {
    setSyncing(true);
    await Promise.all([fetchEligibleOrders(), fetchBatches()]);
    setSyncing(false);
  }

  // ── Selection helpers ─────────────────────────────────────────────────────────

  function toggleOrder(id: string) {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    const visibleIds = filteredOrders.map((o) => o.id);
    const allSelected = visibleIds.every((id) => selectedOrderIds.includes(id));
    setSelectedOrderIds(allSelected ? [] : visibleIds);
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'pending',   label: 'Pending',   count: pendingCount },
    { id: 'batches',   label: 'Batches',   count: batchCount },
    { id: 'submitted', label: 'Submitted', count: submittedCount },
    { id: 'errors',    label: 'Errors',    count: failedCount },
    { id: 'audit',     label: 'Audit Log' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-neutral-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-3" />
        <span className="text-sm">Loading e-Invoice data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            </div>
            LHDN e-Invoice
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1 ml-13">
            Batch and submit consolidated invoices to MyInvois
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 dark:border-[var(--sb-border)] rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Orders"    value={pendingCount}   icon={Clock}       colorClass="text-amber-600"   bgClass="bg-amber-50 dark:bg-amber-900/20" />
        <StatCard label="Batches"           value={batchCount}     icon={ListChecks}  colorClass="text-blue-600"    bgClass="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard label="Submitted"         value={submittedCount} icon={FileCheck2}  colorClass="text-emerald-600" bgClass="bg-emerald-50 dark:bg-emerald-900/20" />
        <StatCard label="Failed"            value={failedCount}    icon={AlertCircle} colorClass="text-red-600"     bgClass="bg-red-50 dark:bg-red-900/20" />
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-gray-200 dark:border-[var(--sb-border)]">
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'
              )}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-neutral-800 rounded-full">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ══ PENDING TAB ══ */}
      {activeTab === 'pending' && (
        <div className="space-y-4">

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-[var(--sb-border)] rounded-lg bg-white dark:bg-[var(--sb-card)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Outlet filter */}
            {outlets.length > 0 && (
              <div className="relative">
                <select
                  value={outletFilter}
                  onChange={(e) => setOutletFilter(e.target.value)}
                  className="pl-9 pr-8 py-2 text-sm border border-gray-200 dark:border-[var(--sb-border)] rounded-lg bg-white dark:bg-[var(--sb-card)] appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All outlets</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Create batch button */}
            <button
              onClick={handleCreateBatch}
              disabled={selectedOrderIds.length === 0 || creatingBatch}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              <PackagePlus className="w-4 h-4" />
              {creatingBatch
                ? 'Creating…'
                : selectedOrderIds.length > 0
                  ? `Create Batch (${selectedOrderIds.length})`
                  : 'Create Batch'}
            </button>
          </div>

          {/* Selection summary bar */}
          {selectedOrderIds.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm">
              <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                {selectedOrderIds.length} orders selected · RM {selectedTotal.toFixed(2)} · Tax RM {selectedTax.toFixed(2)}
              </span>
              <button onClick={() => setSelectedOrderIds([])} className="text-indigo-500 hover:text-indigo-700 text-xs">
                Clear
              </button>
            </div>
          )}

          {/* Orders table */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-neutral-500">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No eligible orders found</p>
              <p className="text-xs mt-1">Orders appear here when paid, completed, and not yet batched</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50">
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.includes(o.id))}
                        onChange={toggleAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-neutral-400">Order</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-neutral-400">Outlet</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-neutral-400">Date</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-neutral-400">Total</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-neutral-400">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => toggleOrder(o.id)}
                      className={cn(
                        'border-b border-gray-50 dark:border-neutral-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors',
                        selectedOrderIds.includes(o.id) && 'bg-indigo-50/50 dark:bg-indigo-900/10'
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(o.id)}
                          onChange={() => toggleOrder(o.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-neutral-200">{o.order_number}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-neutral-400">{o.outlet_name}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-neutral-500 text-xs">
                        {format(new Date(o.created_at), 'dd MMM, HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-neutral-200">
                        RM {o.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-neutral-500 text-xs">
                        RM {o.gst_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ BATCHES TAB ══ */}
      {activeTab === 'batches' && (
        <div className="space-y-3">
          {batches.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-neutral-500">
              <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No batches yet</p>
              <p className="text-xs mt-1">Select orders from the Pending tab and create a batch</p>
            </div>
          ) : (
            batches.map((b) => (
              <div key={b.id} className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-gray-800 dark:text-neutral-200">
                        {b.batch_number}
                      </span>
                      <BatchStatusBadge status={b.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">
                      {b.outlet_name} · {b.total_orders} orders · {format(new Date(b.created_at), 'dd MMM yyyy, HH:mm')}
                    </p>
                    {b.invoice_id && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono">{b.invoice_id}</p>
                    )}
                    {b.error_message && (
                      <p className="text-xs text-red-500 mt-0.5">{b.error_message}</p>
                    )}
                    {submittingBatchId === b.id && (
                      <div className="mt-2">
                        <ProgressBar progress={batchProgress} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">RM {b.grand_total.toFixed(2)}</p>
                      <p className="text-xs text-gray-400 dark:text-neutral-500">Tax RM {b.tax_total.toFixed(2)}</p>
                    </div>

                    <button
                      onClick={() => handlePreviewBatch(b)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                      title="Preview batch"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {b.status === 'draft' && (
                      <button
                        onClick={() => handleSubmitBatch(b)}
                        disabled={!!submittingBatchId}
                        className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        {submittingBatchId === b.id ? 'Submitting…' : 'Submit'}
                      </button>
                    )}

                    {b.status === 'failed' && b.retry_count < MAX_RETRIES && (
                      <button
                        onClick={() => handleRetryBatch(b)}
                        disabled={!!submittingBatchId}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Retry
                      </button>
                    )}

                    {(b.status === 'submitted' || b.status === 'validated') && (
                      <button className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-[var(--sb-border)] rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                        <Download className="w-3 h-3" />
                        PDF
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══ SUBMITTED TAB ══ */}
      {activeTab === 'submitted' && (
        <div className="space-y-3">
          {batches.filter((b) => b.status === 'submitted' || b.status === 'validated').length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-neutral-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No submitted batches yet</p>
            </div>
          ) : (
            batches
              .filter((b) => b.status === 'submitted' || b.status === 'validated')
              .map((b) => (
                <div key={b.id} className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-gray-800 dark:text-neutral-200">{b.batch_number}</span>
                        <BatchStatusBadge status={b.status} />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">
                        {b.outlet_name} · {b.total_orders} orders
                        {b.submitted_at && ` · Submitted ${format(new Date(b.submitted_at), 'dd MMM yyyy, HH:mm')}`}
                      </p>
                      {b.invoice_id && (
                        <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{b.invoice_id}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800 dark:text-neutral-200">RM {b.grand_total.toFixed(2)}</p>
                      <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mt-1">
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ══ ERRORS TAB ══ */}
      {activeTab === 'errors' && (
        <div className="space-y-3">
          {batches.filter((b) => b.status === 'failed').length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-neutral-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No failed batches</p>
            </div>
          ) : (
            batches
              .filter((b) => b.status === 'failed')
              .map((b) => (
                <div key={b.id} className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-red-200 dark:border-red-800/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-gray-800 dark:text-neutral-200">{b.batch_number}</span>
                        <BatchStatusBadge status={b.status} />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">
                        {b.outlet_name} · {b.total_orders} orders · Retry {b.retry_count}/{MAX_RETRIES}
                      </p>
                      {b.error_message && (
                        <p className="text-xs text-red-500 mt-1 font-mono">{b.error_message}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRetryBatch(b)}
                      disabled={!!submittingBatchId || b.retry_count >= MAX_RETRIES}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      <RotateCcw className={cn('w-3 h-3', submittingBatchId === b.id && 'animate-spin')} />
                      {submittingBatchId === b.id ? 'Retrying…' : 'Retry'}
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ══ AUDIT TAB ══ */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-hidden">
          {auditLog.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-neutral-500">
              <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No audit entries yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-neutral-800">
              {auditLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  <AuditDot outcome={entry.outcome} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-neutral-200">{entry.action}</span>
                      <span className="text-xs text-gray-400 dark:text-neutral-500 shrink-0">
                        {format(new Date(entry.timestamp), 'HH:mm:ss')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5 truncate">{entry.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Batch preview modal ── */}
      {previewBatch && (
        <BatchPreviewModal
          batch={previewBatch}
          onClose={() => setPreviewBatch(null)}
          onSubmit={handleSubmitBatch}
          submitting={submittingBatchId === previewBatch.id}
        />
      )}

    </div>
  );  
}