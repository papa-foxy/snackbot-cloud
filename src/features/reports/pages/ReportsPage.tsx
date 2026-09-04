import { useState } from 'react';
import { EyeOff } from 'lucide-react';
import { useImpersonation } from '../../../contexts/ImpersonationContext';
import { DATE_PRESETS } from '../constants';
import { DateRange, ActiveFilter, FilterType, InsightSection } from '../types';
import { useReportData } from '../hooks/useReportData';
import { FilterSidebar } from '../components/FilterSidebar';
import { ReportHeader } from '../components/ReportHeader';
import { AIInsightDrawer } from '../components/AIInsightDrawer';
import { SalesRevenueSection } from '../sections/SalesRevenueSection';
import { MenuInsightsSection } from '../sections/MenuInsightsSection';
import { PaymentTransactionsSection } from '../sections/PaymentTransactionsSection';
import { TableCustomerSection } from '../sections/TableCustomerSection';
import { StaffShiftSection } from '../sections/StaffShiftSection';
import { InventoryStockSection } from '../sections/InventoryStockSection';
import { EodReportsSection } from '../sections/EodReportsSection';
import { SessionReportsSection } from '../sections/SessionReportsSection';

export function ReportsPage() {
  const [dateRange, setDateRange]       = useState<DateRange>(DATE_PRESETS[0]);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const [showFilter, setShowFilter] = useState<boolean>(() => {
    try { return localStorage.getItem('reports_show_filter') === 'true'; } catch { return false; }
  });

  const handleToggleFilter = () => {
    setShowFilter(prev => {
      const next = !prev;
      try { localStorage.setItem('reports_show_filter', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const toggleFilter = (type: FilterType, value: string, label: string) => {
    setActiveFilters(prev => {
      const exists = prev.find(f => f.type === type && f.value === value);
      if (exists) return prev.filter(f => !(f.type === type && f.value === value));
      return [...prev, { id: `${type}-${value}`, type, value, label }];
    });
  };
  const isActive     = (type: FilterType, value: string) => activeFilters.some(f => f.type === type && f.value === value);
  const removeFilter = (id: string) => setActiveFilters(prev => prev.filter(f => f.id !== id));
  const clearAll     = () => setActiveFilters([]);

  const [visibleInsights, setVisibleInsights] = useState<InsightSection[]>([
    'sales_revenue', 'menu_insights', 'payment_transactions',
  ]);
  const toggleInsight = (id: InsightSection) =>
    setVisibleInsights(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const show = (id: InsightSection) => visibleInsights.includes(id);

  const [showAiDrawer, setShowAiDrawer] = useState(false);

  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : null;

  const data = useReportData(dateRange, activeFilters, activeMerchantId);

  const handleExportCSV = () => {
    const rows: any[] = [
      ['Period', dateRange.label], [],
      ['Total Sales', `RM ${data.totalSales.toFixed(2)}`],
      ['Gross Sales', `RM ${data.grossSales.toFixed(2)}`],
      ['Net Sales',   `RM ${data.netSales.toFixed(2)}`],
      ['Total Orders', data.totalOrders],
      ['AOV',         `RM ${data.aov.toFixed(2)}`],
      ['Discounts',   `RM ${data.totalDiscount.toFixed(2)}`],
      ['Tax',         `RM ${data.totalTax.toFixed(2)}`],
      ['Refunds',     data.refundCount], [],
      ['Item', 'Qty', 'Revenue'],
      ...data.topItems.map(i => [i.name, i.qty, i.revenue.toFixed(2)]), [],
      ['Category', 'Revenue', '%'],
      ...data.categoryData.map(c => [c.name, c.value, `${c.pct}%`]), [],
      ['Payment', 'Revenue', 'Count'],
      ...data.paymentData.map(p => [p.name, p.value, p.count]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `report-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="flex gap-6">
      {showFilter && (
        <FilterSidebar
          activeFilters={activeFilters}
          orderTypeOptions={data.orderTypeOptions}
          paymentOptions={data.paymentOptions}
          categoryOptions={data.categoryOptions}
          menuItemOptions={data.menuItemOptions}
          onToggleFilter={toggleFilter}
          onRemoveFilter={removeFilter}
          onClearAll={clearAll}
          isActive={isActive}
        />
      )}

      <div className="flex-1 min-w-0 space-y-5">
        <ReportHeader
          lastSynced={data.lastSynced}
          loading={data.loading}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          visibleInsights={visibleInsights}
          onToggleInsight={toggleInsight}
          showAiDrawer={showAiDrawer}
          onToggleAiDrawer={() => setShowAiDrawer(p => !p)}
          onRefresh={data.fetchReportData}
          onExportCSV={handleExportCSV}
          showFilter={showFilter}
          onToggleFilter={() => handleToggleFilter()}
          branches={data.branches}
          selectedBranchId={data.selectedBranchId}
          onBranchChange={data.setSelectedBranchId}
        />

        <AIInsightDrawer
          show={showAiDrawer}
          onClose={() => setShowAiDrawer(false)}
          dateRange={dateRange}
          activeFilters={activeFilters}
          loading={data.loading}
          totalSales={data.totalSales}
          netSales={data.netSales}
          grossSales={data.grossSales}
          totalOrders={data.totalOrders}
          aov={data.aov}
          totalDiscount={data.totalDiscount}
          refundCount={data.refundCount}
          topItems={data.topItems}
          categoryData={data.categoryData}
          paymentData={data.paymentData}
          staffData={data.staffData}
        />

        {visibleInsights.length === 0 && (
          <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm p-12 text-center">
            <EyeOff className="w-10 h-10 text-gray-300 dark:text-neutral-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-neutral-300 font-medium">No insight sections selected</p>
            <p className="text-gray-400 dark:text-neutral-500 text-sm mt-1">
              Click the <strong>Insights</strong> button above to choose which sections to display.
            </p>
          </div>
        )}

        {show('sales_revenue')        && (
          <SalesRevenueSection
            loading={data.loading}
            totalSales={data.totalSales}
            grossSales={data.grossSales}
            netSales={data.netSales}
            totalOrders={data.totalOrders}
            aov={data.aov}
            totalDiscount={data.totalDiscount}
            totalTax={data.totalTax}
            refundCount={data.refundCount}
            refundAmount={data.refundAmount}
            dailySales={data.dailySales}
            hourlySales={data.hourlySales}
            totalSalesRows={data.totalSalesRows}
            netSalesRows={data.netSalesRows}
            grossSalesRows={data.grossSalesRows}
            aovRows={data.aovRows}
            hourlyRows={data.hourlyRows}
            refundRows={data.refundRows}
            discountRows={data.discountRows}
            transactionRows={data.transactionRows}
          />
        )}
        {show('menu_insights')        && (
          <MenuInsightsSection
            loading={data.loading}
            topItems={data.topItems}
            worstItems={data.worstItems}
            categoryData={data.categoryData}
          />
        )}
        {show('payment_transactions') && (
          <PaymentTransactionsSection
            loading={data.loading}
            totalOrders={data.totalOrders}
            aov={data.aov}
            paymentData={data.paymentData}
          />
        )}
        {show('table_customer')       && (
          <TableCustomerSection
            loading={data.loading}
            tableStats={data.tableStats}
            totalOrders={data.totalOrders}
          />
        )}
        {show('staff_shift')          && (
          <StaffShiftSection
            loading={data.loading}
            staffData={data.staffData}
            shiftData={data.shiftData}
          />
        )}
        {show('inventory_stock')      && (
          <InventoryStockSection
            loading={data.loading}
            lowStockItems={data.lowStockItems}
            inventoryData={data.inventoryData}
          />
        )}
        {show('eod_reports')          && (
          <EodReportsSection
            loading={data.loading}
            eodReports={data.eodReports}
          />
        )}
        {show('session_reports')      && (
          <SessionReportsSection
            loading={data.loading}
            shifts={data.shifts}
            transactionRows={data.transactionRows}
          />
        )}
      </div>
    </div>
  );
}
