import { Star, TrendingDown, Layers, UtensilsCrossed } from 'lucide-react';
import { Section, SkeletonRows, FlexTable } from '../components/Primitives';
import { TOP_ITEMS_COLS, CATEGORY_COLS } from '../columns';

interface MenuInsightsSectionProps {
  loading: boolean;
  topItems: any[];
  worstItems: any[];
  categoryData: any[];
}

export function MenuInsightsSection({
  loading,
  topItems,
  worstItems,
  categoryData
}: MenuInsightsSectionProps) {
  const topTotal = topItems.reduce((s, i) => s + i.revenue, 0);

  return (
    <Section title="Menu Insights" icon={UtensilsCrossed} color="amber">
      <div className="border-b border-gray-100 dark:border-[var(--sb-border)]">
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Top-Selling Items</span>
        </div>
        {loading ? <SkeletonRows /> : <FlexTable cols={TOP_ITEMS_COLS} rows={topItems} extra={{ totalRev: topTotal }} tableId="top-items" />}
      </div>
      <div className="border-b border-gray-100 dark:border-[var(--sb-border)]">
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-rose-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Worst-Selling Items</span>
        </div>
        {loading ? <SkeletonRows count={3} /> : <FlexTable cols={TOP_ITEMS_COLS} rows={worstItems} extra={{ totalRev: topTotal }} tableId="worst-items" />}
      </div>
      <div>
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-neutral-200">Category Performance</span>
        </div>
        {loading ? <SkeletonRows count={3} /> : <FlexTable cols={CATEGORY_COLS} rows={categoryData} tableId="category" />}
      </div>
    </Section>
  );
}
