import { useState } from 'react';
import {
  Cell, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, BarChart3, TrendingUp, Percent, Receipt, Hash, AlertTriangle, ShoppingBag, Clock
} from 'lucide-react';
import { fmt } from '../constants';
import { Section, StatCard, SubTableHeader, SkeletonRows, FlexTable } from '../components/Primitives';
import { TransactionReceiptModal } from '../components/TransactionReceiptModal';
import {
  TOTAL_SALES_COLS, NET_SALES_COLS, GROSS_SALES_COLS, AOV_COLS,
  HOURLY_COLS, REFUND_COLS, DISCOUNT_COLS, TRANSACTION_COLS
} from '../columns';

interface SalesRevenueSectionProps {
  loading: boolean;
  totalSales: number;
  grossSales: number;
  netSales: number;
  totalOrders: number;
  aov: number;
  totalDiscount: number;
  totalTax: number;
  refundCount: number;
  refundAmount: number;
  dailySales: any[];
  hourlySales: any[];
  totalSalesRows: any[];
  netSalesRows: any[];
  grossSalesRows: any[];
  aovRows: any[];
  hourlyRows: any[];
  refundRows: any[];
  discountRows: any[];
  transactionRows: any[];
}

export function SalesRevenueSection({
  loading,
  totalSales,
  grossSales,
  netSales,
  totalOrders,
  aov,
  totalDiscount,
  totalTax,
  refundCount,
  refundAmount,
  dailySales,
  hourlySales,
  totalSalesRows,
  netSalesRows,
  grossSalesRows,
  aovRows,
  hourlyRows,
  refundRows,
  discountRows,
  transactionRows
}: SalesRevenueSectionProps) {
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const maxRev   = Math.max(...hourlyRows.map((r: any) => r.revenue));
  const peakHour = hourlyRows.find((r: any) => r.revenue === maxRev && maxRev > 0)?.hour;

  return (
    <Section title="Sales & Revenue" icon={DollarSign} color="indigo"
      badge={!loading && totalSales > 0 ? (
        <div className="flex gap-2">
          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">↑ 12% vs last period</span>
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">Peak: {peakHour}:00</span>
        </div>
      ) : undefined}>

      <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-gray-100 dark:border-[var(--sb-border)]">
        <StatCard label="Total Sales"     value={fmt(totalSales)}     icon={DollarSign}    color="indigo"  loading={loading} sub={`${totalOrders} orders`} trend="+12.5%" />
        <StatCard label="Gross Sales"     value={fmt(grossSales)}     icon={BarChart3}     color="blue"    loading={loading} sub="Before deductions" />
        <StatCard label="Net Sales"       value={fmt(netSales)}       icon={TrendingUp}    color="emerald" loading={loading} sub="After tax & discount" trend="+8.2%" />
        <StatCard label="Avg Order Value" value={fmt(aov)}            icon={Percent}       color="amber"   loading={loading} sub="Revenue ÷ orders" />
        <StatCard label="Total Discount"  value={fmt(totalDiscount)}  icon={Receipt}       color="rose"    loading={loading} />
        <StatCard label="Total Tax"       value={fmt(totalTax)}       icon={Hash}          color="purple"  loading={loading} />
        <StatCard label="Refunds/Voids"   value={String(refundCount)} icon={AlertTriangle} color="rose"    loading={loading} sub={fmt(refundAmount)} />
        <StatCard label="Total Orders"    value={String(totalOrders)} icon={ShoppingBag}   color="indigo"  loading={loading} />
      </div>

      {/* Total Sales Daily */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-indigo-600 to-indigo-500" icon={DollarSign} title="Total Sales – Daily Breakdown" subtitle="Sum of all completed orders per day" />
        <div className="px-5 pb-3 pt-3 bg-white dark:bg-[var(--sb-card)]">
          {loading ? <div className="h-40 bg-gray-50 dark:bg-neutral-800/50 animate-pulse rounded-lg" /> : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailySales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={v => `RM${v}`} />
                  <Tooltip formatter={(v: any) => [`RM ${Number(v).toFixed(2)}`, 'Revenue']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        {loading ? <SkeletonRows /> : <FlexTable cols={TOTAL_SALES_COLS} rows={totalSalesRows} extra={{ total: totalSales }} tableId="total-sales" />}
      </div>

      {/* Net Sales */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-emerald-600 to-emerald-500" icon={TrendingUp} title="Net Sales – After Discounts, Refunds & Tax" subtitle="Gross − Discounts − Tax − Refunds" />
        {loading ? <SkeletonRows /> : <FlexTable cols={NET_SALES_COLS} rows={netSalesRows} tableId="net-sales" />}
      </div>

      {/* Gross Sales */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-blue-600 to-blue-500" icon={BarChart3} title="Gross Sales – Before Deductions" subtitle="Raw subtotal before tax, discounts, refunds" />
        {loading ? <SkeletonRows /> : <FlexTable cols={GROSS_SALES_COLS} rows={grossSalesRows} extra={{ total: grossSales }} tableId="gross-sales" />}
      </div>

      {/* AOV */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-amber-500 to-amber-400" icon={Percent} title="Average Order Value (AOV)" subtitle="Revenue ÷ number of orders" />
        {loading ? <SkeletonRows /> : <FlexTable cols={AOV_COLS} rows={aovRows} extra={{ avg: aov }} tableId="aov" />}
      </div>

      {/* Hourly */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-violet-600 to-violet-500" icon={Clock} title="Sales by Hour – Peak Period Analysis" subtitle="Peak hour highlighted in amber" />
        {loading ? <div className="h-40 bg-gray-50 dark:bg-neutral-800/50 animate-pulse rounded-lg mx-5 mt-3 mb-3" /> : (
          <div className="px-5 pb-3 pt-3 bg-white dark:bg-[var(--sb-card)]">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlySales} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} tickFormatter={v => `RM${v}`} />
                  <Tooltip formatter={(v: any) => [`RM ${Number(v).toFixed(2)}`, 'Revenue']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }} />
                  <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                    {hourlyRows.map((r: any, i: number) => <Cell key={i} fill={r.revenue === maxRev && maxRev > 0 ? '#f59e0b' : '#7c3aed'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {loading ? <SkeletonRows count={6} /> : <FlexTable cols={HOURLY_COLS} rows={hourlyRows} extra={{ total: totalSales, peakHour }} tableId="hourly" noPagination />}
      </div>

      {/* Refunds */}
      <div className="mx-5 mb-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-rose-600 to-rose-500" icon={AlertTriangle} title="Refunds & Voids" subtitle="Cancelled / voided orders in period"
          badge={refundRows.length > 0 ? <span className="text-xs bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">{refundRows.length}</span> : undefined} />
        {loading ? <SkeletonRows count={3} /> : refundRows.length === 0
          ? <p className="px-5 py-4 text-sm text-emerald-600 font-medium">✓ No refunds or voids in this period</p>
          : <FlexTable cols={REFUND_COLS} rows={refundRows} tableId="refunds" onRowClick={setSelectedTx} />}
      </div>

      {/* Discounts */}
      <div className="mx-5 mb-5 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-orange-500 to-orange-400" icon={Receipt} title="Discounts Given" subtitle="Total discount applied per day" />
        {loading ? <SkeletonRows /> : <FlexTable cols={DISCOUNT_COLS} rows={discountRows} tableId="discounts" />}
        {!loading && discountRows.length > 0 && (
          <div className="px-5 py-3 bg-orange-50 border-t border-orange-100 flex flex-wrap gap-6 text-xs">
            <span className="text-gray-600 dark:text-neutral-400">Total Discounts: <strong className="text-orange-700">{fmt(totalDiscount)}</strong></span>
            <span className="text-gray-600 dark:text-neutral-400">% of Total Sales: <strong className="text-orange-700">{totalSales ? ((totalDiscount / totalSales) * 100).toFixed(1) : 0}%</strong></span>
            <span className="text-gray-600 dark:text-neutral-400">Avg Discount/Order: <strong className="text-orange-700">{totalOrders ? fmt(totalDiscount / totalOrders) : '—'}</strong></span>
          </div>
        )}
      </div>

      {/* Sales by Transaction */}
      <div className="mx-5 mb-5 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] overflow-visible shadow-sm">
        <SubTableHeader gradient="bg-gradient-to-r from-teal-600 to-teal-500" icon={Receipt} title="Sales by Transaction" subtitle="Click a row to view receipt"
          badge={transactionRows.length > 0 ? <span className="text-xs bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">{transactionRows.length}</span> : undefined} />
        {loading ? <SkeletonRows count={5} /> : transactionRows.length === 0
          ? <p className="px-5 py-4 text-sm text-gray-400 dark:text-neutral-500">No transactions in this period</p>
          : <FlexTable cols={TRANSACTION_COLS} rows={transactionRows} tableId="transactions" onRowClick={setSelectedTx} />}
      </div>

      {/* Receipt modal */}
      {selectedTx && <TransactionReceiptModal order={selectedTx} onClose={() => setSelectedTx(null)} />}
    </Section>
  );
}
