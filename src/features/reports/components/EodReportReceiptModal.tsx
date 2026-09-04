import { Receipt, X } from 'lucide-react';
import { fmt } from '../constants';
import { cn } from '../../../utils/cn';

interface EodReportReceiptModalProps {
  eod: any;
  onClose: () => void;
}

export function EodReportReceiptModal({ eod, onClose }: EodReportReceiptModalProps) {
  const d = (val: any) => Number(val || 0);
  const s = (val: any) => String(val || '');

  const grossSales = d(eod.gross_sales);
  const discount = d(eod.discount);
  const tax = d(eod.tax);
  const grandTotal = d(eod.grand_total);
  const cashSales = d(eod.cash_sales);
  const cardSales = d(eod.card_sales);
  const ewalletSales = d(eod.ewallet_sales);
  const qrSales = d(eod.qr_sales);
  const completedOrds = d(eod.completed_orders);
  const voidedOrds = d(eod.voided_orders);
  const voidedAmount = d(eod.voided_amount);
  const openingCash = d(eod.opening_cash);
  const closingCash = d(eod.closing_cash);
  const expectedCash = d(eod.expected_cash);
  const cashVariance = d(eod.cash_variance);
  const printedBy = s(eod.printed_by);

  const netSales = grossSales - discount;
  const avgBasket = completedOrds > 0 ? grandTotal / completedOrds : 0;
  const totalTendered = cashSales + cardSales + ewalletSales + qrSales;
  const variance = totalTendered - grandTotal;

  const reportDateStr = eod.report_date ? new Date(eod.report_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const generatedAtStr = eod.generated_at ? new Date(eod.generated_at).toLocaleString('en-MY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  const dottedLine = <div className="border-t border-dashed border-gray-400 dark:border-neutral-500 my-2" />;
  const solidLine = <div className="border-t border-gray-400 dark:border-neutral-500 my-3" />;

  const renderRow = (label: string, value: string, isBold = false, isLarge = false) => (
    <div className={cn("flex justify-between py-0.5 font-mono text-xs", isBold && "font-bold", isLarge && "text-sm font-bold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  const renderIndentRow = (label: string, value: string) => (
    <div className="flex justify-between py-0.5 font-mono text-xs text-gray-500 dark:text-neutral-400 pl-4">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative bg-white dark:bg-neutral-900 text-gray-800 dark:text-neutral-100 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-gray-900 dark:text-white">Z-Report — End of Day</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="w-5.5 h-5.5 text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200" />
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 select-none bg-gray-50 dark:bg-neutral-950">
          <div className="max-w-sm mx-auto p-4 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-sm rounded-lg">
            <div className="text-center mb-4">
              <h4 className="font-mono text-sm font-bold tracking-wider uppercase">BRANCH CLOSEOUT</h4>
              <p className="font-mono text-[10px] text-gray-500 dark:text-neutral-400">END-OF-DAY REPORT — Z-CLOSE</p>
            </div>
            
            {solidLine}

            {renderRow("Date", reportDateStr)}
            {renderRow("Report ID", s(eod.id).substring(0, 8).toUpperCase())}
            {renderRow("Cashier", printedBy)}
            {renderRow("Opening Cash", fmt(openingCash))}
            {generatedAtStr && renderRow("Generated", generatedAtStr)}

            {solidLine}

            <p className="font-mono text-xs font-bold text-gray-500 dark:text-neutral-400 py-1">1. SALES & REVENUE</p>
            {dottedLine}
            {renderRow("Gross Sales", fmt(grossSales))}
            {dottedLine}
            {renderIndentRow("Discounts", `- ${fmt(discount)}`)}
            {renderIndentRow("Voided / Cancelled", `- ${fmt(voidedAmount)}`)}
            {dottedLine}
            {renderRow("Net Sales", fmt(netSales), true)}
            {renderIndentRow("SST / Tax", `+ ${fmt(tax)}`)}
            {dottedLine}
            {renderRow("GRAND TOTAL", fmt(grandTotal), true, true)}

            {solidLine}

            <p className="font-mono text-xs font-bold text-gray-500 dark:text-neutral-400 py-1">2. TENDER BREAKDOWN</p>
            {dottedLine}
            {renderRow("Cash", fmt(cashSales))}
            {renderRow("Card", fmt(cardSales))}
            {renderRow("E-Wallet", fmt(ewalletSales))}
            {renderRow("QR / DuitNow", fmt(qrSales))}
            {dottedLine}
            {renderRow("Total Tendered", fmt(totalTendered), true)}
            {renderRow("Variance", `${variance >= 0 ? "+" : ""}${fmt(variance)}`)}
            {renderRow("Status", Math.abs(variance) < 0.01 ? "BALANCED" : "DISCREPANCY", true)}

            {solidLine}

            <p className="font-mono text-xs font-bold text-gray-500 dark:text-neutral-400 py-1">3. CASH DRAWER</p>
            {dottedLine}
            {renderRow("Opening Float", fmt(openingCash))}
            {renderRow("Cash Sales", `+ ${fmt(cashSales)}`)}
            {dottedLine}
            {renderRow("Expected in Drawer", fmt(expectedCash), true)}
            {renderRow("Actual Cash Counted", fmt(closingCash), true)}
            {dottedLine}
            {renderRow(
              "Over / Short", 
              `${cashVariance >= 0 ? "+" : ""}${fmt(cashVariance)} (${Math.abs(cashVariance) < 0.01 ? "EXACT" : cashVariance > 0 ? "OVER" : "SHORT"})`, 
              true
            )}

            {solidLine}

            <p className="font-mono text-xs font-bold text-gray-500 dark:text-neutral-400 py-1">4. OPERATIONS</p>
            {dottedLine}
            {renderRow("Completed Orders", String(completedOrds))}
            {renderRow("Voided Orders", `${voidedOrds} (${fmt(voidedAmount)})`)}
            {renderRow("Avg Basket Size", fmt(avgBasket))}

            {solidLine}

            <div className="text-center text-[9px] text-gray-400 dark:text-neutral-500 space-y-1 mt-4">
              <p>MANAGER APPROVED · ACCOUNTING COPY</p>
              <p>Retain for 7 years per Malaysian tax regulation.</p>
              <p className="font-bold mt-2">*** END OF REPORT ***</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
