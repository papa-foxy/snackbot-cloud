import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import { CreditCard, Hash, TrendingUp } from 'lucide-react';
import { fmt, COLORS } from '../constants';
import { Section, StatCard, FlexTable } from '../components/Primitives';
import { PAYMENT_COLS } from '../columns';

interface PaymentTransactionsSectionProps {
  loading: boolean;
  totalOrders: number;
  aov: number;
  paymentData: any[];
}

export function PaymentTransactionsSection({
  loading,
  totalOrders,
  aov,
  paymentData
}: PaymentTransactionsSectionProps) {
  const payTotal = paymentData.reduce((s, p) => s + p.value, 0);

  return (
    <Section title="Payment & Transactions" icon={CreditCard} color="emerald">
      <div className="p-5 grid grid-cols-3 gap-3 border-b border-gray-100 dark:border-[var(--sb-border)]">
        <StatCard label="Total Transactions" value={String(totalOrders)}         icon={Hash}       color="emerald" loading={loading} />
        <StatCard label="Avg Payment"         value={fmt(aov)}                   icon={TrendingUp} color="emerald" loading={loading} />
        <StatCard label="Payment Methods"     value={String(paymentData.length)} icon={CreditCard} color="emerald" loading={loading} />
      </div>
      <div className="p-5 flex gap-6 flex-wrap">
        {!loading && paymentData.length > 0 && (
          <div className="w-40 h-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                  {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => [`RM ${Number(v).toFixed(2)}`]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          {paymentData.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-gray-600 dark:text-neutral-400 capitalize flex-1">{p.name}</span>
              <span className="font-semibold text-gray-800 dark:text-neutral-200">{fmt(p.value)}</span>
              <span className="text-gray-400 dark:text-neutral-500">{p.count} txn</span>
            </div>
          ))}
        </div>
      </div>
      <FlexTable cols={PAYMENT_COLS} rows={paymentData} extra={{ total: payTotal }} tableId="payment" />
    </Section>
  );
}
