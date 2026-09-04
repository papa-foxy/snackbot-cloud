import { useState, useEffect } from 'react';
import { Receipt, AlertTriangle, X, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';

interface TransactionReceiptModalProps {
  order: any;
  onClose: () => void;
}

export function TransactionReceiptModal({ order, onClose }: TransactionReceiptModalProps) {
  const [items, setItems]         = useState<any[]>([]);
  const [business, setBusiness]   = useState<any>(null);
  const [branch, setBranch]       = useState<any>(null);
  const [orderRaw, setOrderRaw]   = useState<any>(null);
  const [tableName, setTableName] = useState('');
  const [staffName, setStaffName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [payment, setPayment]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!order?.id) return;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const merchantId = order.merchant_id;

        // 1. Business info (store header)
        const { data: biz } = await supabase
          .from('business')
          .select('name, address, contact_number, receipt_header, receipt_footer, logo_url, sst_number, ssm_number')
          .eq('id', merchantId)
          .single();
        setBusiness(biz || null);

        // 2. Fetch raw/full order to ensure we have branch_id etc.
        const { data: rawOrd } = await supabase
          .from('orders')
          .select('*')
          .eq('id', order.id)
          .single();
        setOrderRaw(rawOrd || null);

        // 3. Fetch branch details
        const branchId = order.branch_id || rawOrd?.branch_id;
        if (branchId) {
          const { data: br } = await supabase
            .from('branches')
            .select('name, address, phone')
            .eq('id', branchId)
            .maybeSingle();
          setBranch(br || null);
        } else {
          setBranch(null);
        }

        // 4. Order items
        const { data: rawItems, error: itemErr } = await supabase
          .from('order_items')
          .select('id, menu_id, variant_id, quantity, unit_price, subtotal, notes, status, modifier_note')
          .eq('order_id', order.id);
        if (itemErr) throw new Error(itemErr.message);

        // 5. Menu names
        const menuIds = [...new Set((rawItems || []).map((i: any) => i.menu_id).filter(Boolean))];
        let menuMap: Record<string, string> = {};
        if (menuIds.length > 0) {
          const { data: menus } = await supabase.from('menu').select('id, name').in('id', menuIds);
          (menus || []).forEach((m: any) => { menuMap[m.id] = m.name; });
        }

        // 6. Variant names
        const variantIds = [...new Set((rawItems || []).map((i: any) => i.variant_id).filter(Boolean))];
        let variantMap: Record<string, string> = {};
        if (variantIds.length > 0) {
          const { data: variants } = await supabase.from('menu_variants').select('id, name').in('id', variantIds);
          (variants || []).forEach((v: any) => { variantMap[v.id] = v.name; });
        }

        setItems((rawItems || []).map((i: any) => ({
          ...i,
          menuName:    menuMap[i.menu_id]      || 'Unknown item',
          variantName: variantMap[i.variant_id] || null,
        })));

        // 7. Table name
        const tableId = order.table_id || rawOrd?.table_id;
        if (tableId) {
          const { data: tbl } = await supabase.from('tables').select('table_number').eq('id', tableId).single();
          setTableName(tbl?.table_number ? `Table ${tbl.table_number}` : '');
        } else {
          setTableName('');
        }

        // 8. Staff name (waiter or cashier)
        const staffId = rawOrd?.waiter_id || rawOrd?.cashier_id || order.waiter_id || order.cashier_id;
        if (staffId) {
          const { data: user } = await supabase.from('users').select('name').eq('id', staffId).maybeSingle();
          setStaffName(user?.name || '');
        } else {
          setStaffName('');
        }

        // 9. Customer name
        const customerId = rawOrd?.customer_id || order.customer_id;
        if (customerId) {
          const { data: cust } = await supabase.from('customers').select('name').eq('id', customerId).maybeSingle();
          setCustomerName(cust?.name || '');
        } else {
          setCustomerName('');
        }

        // 10. Payment details
        const { data: payments } = await supabase
          .from('payments')
          .select('method, amount, amount_tendered, change_amount, reference_no, status')
          .eq('order_id', order.id)
          .order('created_at', { ascending: false })
          .limit(1);
        setPayment(payments?.[0] || null);

      } catch (e: any) {
        setError(e.message || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [order?.id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const subtotal      = Number(order.subtotal || 0);
  const discount      = Number(order.discount || 0);
  const serviceCharge = 0;
  const tax           = Number(order.tax      || 0);
  const total         = Number(order.total    || 0);
  const isVoided      = order.status === 'voided' || order.status === 'cancelled';
  const isRefunded    = order.status === 'refunded';

  const amountTendered = payment?.amount_tendered != null ? Number(payment.amount_tendered) : null;
  const change         = payment?.change_amount != null ? Number(payment.change_amount) : null;
  const payMethod      = payment?.method || order.payment_method || '';

  const orderTypeLabel = (type: string) => {
    switch (type) {
      case 'dine_in': return 'Dine-in';
      case 'takeaway': return 'Takeaway';
      case 'delivery': return 'Delivery';
      default: return type ? type.replace(/_/g, ' ') : '';
    }
  };

  const methodDisplayName = (code: string) => {
    if (!code) return '—';
    switch (code.toLowerCase()) {
      case 'cash': return 'Cash';
      case 'card': return 'Card';
      case 'ewallet':
      case 'e_wallet': return 'E-Wallet';
      case 'qr': return 'QR Pay';
      case 'alipay':
      case 'alipay+': return 'Alipay+';
      case 'duitnow': return 'DuitNow';
      default: return code;
    }
  };

  const dottedLine = (
    <div className="flex my-3 select-none">
      {Array.from({ length: 36 }).map((_, idx) => (
        <div key={idx} className="flex-1 h-[1px] bg-gray-300 dark:bg-neutral-700 mx-[1px]" />
      ))}
    </div>
  );

  const renderRow = (label: string, value: string, bold = false, valueColor?: string) => (
    <div className={cn("flex justify-between items-start py-0.5 text-xs font-mono", bold && "font-bold")}>
      <span className="text-gray-500 dark:text-neutral-400">{label}</span>
      <span className={cn("text-gray-800 dark:text-neutral-200 text-right ml-8 capitalize font-medium", valueColor)}>{value || '—'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative bg-white dark:bg-neutral-900 text-gray-800 dark:text-neutral-100 rounded-2xl shadow-2xl w-full max-w-[420px] max-h-[780px] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center bg-white dark:bg-neutral-900 shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-4.5 h-4.5 text-indigo-500" />
            <span className="font-bold text-gray-900 dark:text-white text-sm">Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            {isVoided && (
              <span className="bg-red-100 text-red-700 font-extrabold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                VOIDED
              </span>
            )}
            {isRefunded && (
              <span className="bg-amber-100 text-amber-700 font-extrabold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                REFUNDED
              </span>
            )}
            <button onClick={onClose} className="p-1 rounded-full bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
              <X className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto px-7 py-5 bg-gray-50 dark:bg-neutral-950">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs text-gray-400 dark:text-neutral-500">Loading receipt details...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-rose-500 font-mono text-xs">{error}</div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
              
              {/* HEADER */}
              <div className="text-center">
                <h4 className="text-sm font-extrabold tracking-widest font-mono text-gray-900 dark:text-white">RECEIPT</h4>
                {dottedLine}
                <div className="mt-2">
                  <h5 className="text-sm font-bold tracking-wider uppercase text-gray-900 dark:text-white">
                    {branch?.name ? branch.name : (business?.name || 'Snackbot')}
                  </h5>
                  {(branch?.address || business?.address) && (
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-1 whitespace-pre-wrap leading-relaxed">
                      {branch?.address || business?.address}
                    </p>
                  )}
                  {(branch?.phone || business?.phone) && (
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-0.5">
                      Tel: {branch?.phone || business?.phone}
                    </p>
                  )}
                  {(business?.ssm_number || business?.sst_number) && (
                    <div className="text-[10px] text-gray-400 dark:text-neutral-500 mt-1.5 space-y-0.5 font-mono">
                      {business?.ssm_number && <p>SSM: {business.ssm_number}</p>}
                      {business?.sst_number && <p>SST ID: {business.sst_number}</p>}
                    </div>
                  )}
                  {business?.receipt_header && (
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-2 italic leading-relaxed">
                      {business.receipt_header}
                    </p>
                  )}
                </div>
              </div>

              {dottedLine}

              {/* TRANSACTION METADATA */}
              <div className="space-y-0.5">
                {renderRow('Receipt No.', order.order_number || order.id?.slice(0, 8).toUpperCase(), true)}
                {renderRow('Date', new Date(order.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }))}
                {renderRow('Time', new Date(order.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true }))}
                {renderRow('Order Type', orderTypeLabel(order.order_type))}
                {tableName && renderRow('Table', tableName)}
                {(() => {
                  const pax = Number(orderRaw?.pax || orderRaw?.guest_count || 0);
                  return pax > 0 ? renderRow('Pax', String(pax)) : null;
                })()}
                {staffName && renderRow('Staff', staffName)}
                {customerName && renderRow('Customer', customerName)}
              </div>

              {dottedLine}

              {/* ITEMIZED ORDER */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Items</p>
                <div className="space-y-3 font-mono">
                  {items.map((item, i) => {
                    const isRefundedItem = item.status === 'refunded' || item.status === 'cancelled' || isVoided;
                    const lineTotal = Number(item.subtotal || (Number(item.unit_price || 0) * Number(item.quantity || 1)));
                    const displayName = item.variantName ? `${item.menuName} (${item.variantName})` : item.menuName;
                    
                    return (
                      <div key={i} className="text-xs">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-2 flex-1 min-w-0">
                            <span className="text-gray-400 dark:text-neutral-500 shrink-0 w-6">{item.quantity}×</span>
                            <span className={cn('font-medium text-gray-800 dark:text-neutral-200', isRefundedItem && 'line-through text-gray-400 dark:text-neutral-500')}>
                              {displayName}
                            </span>
                          </div>
                          <span className={cn('font-semibold shrink-0 ml-4 text-gray-900 dark:text-white', isRefundedItem && 'line-through text-gray-400 dark:text-neutral-500')}>
                            RM {lineTotal.toFixed(2)}
                          </span>
                        </div>
                        {item.quantity > 1 && (
                          <div className="text-[10px] text-gray-400 dark:text-neutral-500 pl-6 mt-0.5">
                            @ RM {Number(item.unit_price || 0).toFixed(2)} each
                          </div>
                        )}
                        {item.modifier_note && (
                          <div className="text-[10px] text-gray-400 dark:text-neutral-500 pl-6 mt-0.5">
                            + {item.modifier_note}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-[10px] text-gray-400 dark:text-neutral-500 pl-6 mt-0.5 italic">
                            Note: {item.notes}
                          </div>
                        )}
                        {isRefundedItem && (
                          <div className="text-[10px] text-red-500 pl-6 mt-1 flex items-center gap-1 font-semibold">
                            <AlertTriangle className="w-3 h-3 shrink-0" /> {isVoided ? 'Voided' : 'Refunded / Cancelled'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {dottedLine}

              {/* FINANCIAL SUMMARY */}
              <div className="space-y-1">
                {renderRow('Subtotal', `RM ${subtotal.toFixed(2)}`)}
                {discount > 0 && (
                  <div className="flex justify-between py-0.5 text-xs font-mono">
                    <span className="text-gray-500 dark:text-neutral-400">Discount</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">- RM {discount.toFixed(2)}</span>
                  </div>
                )}
                {serviceCharge > 0 && renderRow('Service Charge (10%)', `RM ${serviceCharge.toFixed(2)}`)}
                {tax > 0 && renderRow('Service Tax (6%)', `RM ${tax.toFixed(2)}`)}
                
                <div className="flex justify-between items-baseline mt-3 pt-3 border-t border-gray-200 dark:border-neutral-800">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">GRAND TOTAL</span>
                  <span className={cn('text-base font-extrabold text-gray-900 dark:text-white',
                    (isVoided || isRefunded) && 'text-red-500 dark:text-red-400 line-through'
                  )}>
                    RM {total.toFixed(2)}
                  </span>
                </div>
              </div>

              {dottedLine}

              {/* PAYMENT DETAILS */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Payment</p>
                <div className="space-y-0.5">
                  {renderRow('Method', methodDisplayName(payMethod))}
                  {amountTendered != null && renderRow('Tendered', `RM ${amountTendered.toFixed(2)}`)}
                  {change != null && change >= 0 && renderRow('Change', `RM ${change.toFixed(2)}`, true)}
                  <div className="flex justify-between py-0.5 text-xs font-mono">
                    <span className="text-gray-500 dark:text-neutral-400">Status</span>
                    <span className={cn('font-bold',
                      isVoided || isRefunded ? 'text-red-500 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'
                    )}>
                      {isVoided ? 'VOIDED' : isRefunded ? 'REFUNDED' : 'PAID'}
                    </span>
                  </div>
                </div>
              </div>

              {dottedLine}

              {/* FOOTER */}
              <div className="text-center text-[11px] text-gray-500 dark:text-neutral-400 space-y-2 mt-2">
                {business?.receipt_footer ? (
                  <p className="italic whitespace-pre-wrap">{business.receipt_footer}</p>
                ) : (
                  <>
                    <p className="font-bold text-gray-900 dark:text-white">Thank you for dining with us!</p>
                    <p>We hope to see you again soon.</p>
                  </>
                )}

                {business?.wifi_password && (
                  <p className="text-[10px] text-gray-400 dark:text-neutral-500 flex items-center justify-center gap-1 mt-2 font-mono">
                    <Clock className="w-3.5 h-3.5 inline text-gray-400" /> Wi-Fi: {business.wifi_password}
                  </p>
                )}

                {(business?.instagram || business?.facebook) && (
                  <div className="flex justify-center gap-3 text-[10px] text-gray-400 dark:text-neutral-500 mt-1 font-mono">
                    {business?.instagram && <span>IG: @{business.instagram}</span>}
                    {business?.facebook && <span>FB: {business.facebook}</span>}
                  </div>
                )}

                <p className="text-[9px] text-gray-400 dark:text-neutral-500 pt-3 font-mono">
                  Generated {new Date().toLocaleString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                </p>
              </div>

            </div>
          )}
        </div>

        {/* Dialog Close Button Bar */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-neutral-800 flex bg-white dark:bg-neutral-900 shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
