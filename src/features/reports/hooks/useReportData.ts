import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { DateRange, ActiveFilter, TableStats } from '../types';

export function getStoredMerchantId(): string | null {
  try {
    const stored = localStorage.getItem('snackbot_user');
    if (!stored) return null;
    return JSON.parse(stored)?.merchant_id ?? null;
  } catch { return null; }
}

export async function resolveMerchantId(): Promise<string | null> {
  const fromStorage = getStoredMerchantId();
  if (fromStorage) return fromStorage;
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const { data } = await supabase.from('users').select('merchant_id').eq('auth_id', authUser.id).single();
    if (data?.merchant_id) {
      try {
        const raw = localStorage.getItem('snackbot_user');
        if (raw) { const p = JSON.parse(raw); p.merchant_id = data.merchant_id; localStorage.setItem('snackbot_user', JSON.stringify(p)); }
      } catch { /* non-critical */ }
      return data.merchant_id;
    }
  } catch { /* non-critical */ }
  return null;
}

export function useReportData(dateRange: DateRange, activeFilters: ActiveFilter[], overrideMerchantId?: string | null) {
  const [loading, setLoading]           = useState(true);
  const [lastSynced, setLastSynced]     = useState<Date | null>(null);
  const [orderTypeOptions, setOrderTypeOptions] = useState<string[]>([]);
  const [paymentOptions, setPaymentOptions]     = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions]   = useState<string[]>([]);
  const [menuItemOptions, setMenuItemOptions]   = useState<{ id: string; name: string }[]>([]);
  const [totalSales, setTotalSales]       = useState(0);
  const [grossSales, setGrossSales]       = useState(0);
  const [netSales, setNetSales]           = useState(0);
  const [totalOrders, setTotalOrders]     = useState(0);
  const [aov, setAov]                     = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [totalTax, setTotalTax]           = useState(0);
  const [refundCount, setRefundCount]     = useState(0);
  const [refundAmount, setRefundAmount]   = useState(0);
  const [dailySales, setDailySales]       = useState<any[]>([]);
  const [hourlySales, setHourlySales]     = useState<any[]>([]);
  const [totalSalesRows, setTotalSalesRows] = useState<any[]>([]);
  const [netSalesRows, setNetSalesRows]     = useState<any[]>([]);
  const [grossSalesRows, setGrossSalesRows] = useState<any[]>([]);
  const [aovRows, setAovRows]               = useState<any[]>([]);
  const [hourlyRows, setHourlyRows]         = useState<any[]>([]);
  const [refundRows, setRefundRows]         = useState<any[]>([]);
  const [discountRows, setDiscountRows]     = useState<any[]>([]);
  const [transactionRows, setTransactionRows] = useState<any[]>([]);
  const [topItems, setTopItems]         = useState<any[]>([]);
  const [worstItems, setWorstItems]     = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [paymentData, setPaymentData]   = useState<any[]>([]);
  const [orderTypeData, setOrderTypeData] = useState<any[]>([]);
  const [tableStats, setTableStats]     = useState<TableStats>({ total: 0, occupied: 0, available: 0, occupancyRate: 0 });
  const [staffData, setStaffData]       = useState<any[]>([]);
  const [shiftData, setShiftData]       = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);

  // EOD & Session States
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [eodReports, setEodReports] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    const merchantId = overrideMerchantId ?? await resolveMerchantId();
    if (!merchantId) { console.error('useReportData: no merchant_id'); setLoading(false); return; }

    try {
      // 1. Fetch branches for the merchant
      const { data: branchList } = await supabase
        .from('branches')
        .select('id, name')
        .eq('merchant_id', merchantId);
      const fetchedBranches = branchList || [];
      setBranches(fetchedBranches);

      let currentBranchId = selectedBranchId;
      if (!currentBranchId && fetchedBranches.length > 0) {
        currentBranchId = fetchedBranches[0].id;
        setSelectedBranchId(currentBranchId);
      }

      // 2. Fetch orders filtered by merchant and branch
      let orderQuery = supabase
        .from('orders')
        .select('id, order_number, total, subtotal, tax, discount, payment_method, order_type, status, created_at, waiter_id, cashier_id, table_id, notes, customer_id, branch_id')
        .eq('merchant_id', merchantId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: true });

      if (currentBranchId) {
        orderQuery = orderQuery.eq('branch_id', currentBranchId);
      }

      const typeValues = activeFilters.filter(f => f.type === 'order_type').map(f => f.value);
      if (typeValues.length > 0) orderQuery = orderQuery.in('order_type', typeValues);
      const payValues = activeFilters.filter(f => f.type === 'payment_method').map(f => f.value);
      if (payValues.length > 0) orderQuery = orderQuery.in('payment_method', payValues);

      const { data: allOrders } = await orderQuery;
      const orders          = allOrders || [];
      const completedOrders = orders.filter((o: any) => o.status === 'completed');
      const refundedOrders  = orders.filter((o: any) => ['cancelled', 'voided', 'refunded'].includes(o.status));

      if (orderTypeOptions.length === 0 || paymentOptions.length === 0) {
        let optsQuery = supabase.from('orders').select('order_type, payment_method').eq('merchant_id', merchantId).eq('status', 'completed');
        if (currentBranchId) optsQuery = optsQuery.eq('branch_id', currentBranchId);
        const { data: opts } = await optsQuery;
        setOrderTypeOptions([...new Set((opts || []).map((o: any) => o.order_type).filter(Boolean))]);
        setPaymentOptions([...new Set((opts || []).map((o: any) => o.payment_method).filter(Boolean))]);
      }

      const { data: menuList } = await supabase.from('menu').select('id, name, category_id, base_price, menu_categories(name)').eq('merchant_id', merchantId);
      if (menuItemOptions.length === 0 && menuList) setMenuItemOptions(menuList.map((m: any) => ({ id: m.id, name: m.name })));

      const { data: catList } = await supabase.from('menu_categories').select('id, name').eq('merchant_id', merchantId);
      if (categoryOptions.length === 0 && catList) setCategoryOptions(catList.map((c: any) => c.name));

      const categoryValues = activeFilters.filter(f => f.type === 'category').map(f => f.value);
      const menuItemValues = activeFilters.filter(f => f.type === 'menu_item').map(f => f.value);
      const hasItemFilters = categoryValues.length > 0 || menuItemValues.length > 0;

      let safeOrders = [...completedOrders];
      const allOrderIds = safeOrders.map((o: any) => o.id);
      let orderItems: any[] = [];

      if (allOrderIds.length > 0) {
        let itemQ = supabase.from('order_items').select('menu_id, quantity, subtotal, order_id').in('order_id', allOrderIds);
        if (menuItemValues.length > 0) itemQ = itemQ.in('menu_id', menuItemValues);
        const { data: items } = await itemQ;
        orderItems = items || [];
        if (categoryValues.length > 0) {
          orderItems = orderItems.filter(oi => {
            const m = menuList?.find((x: any) => x.id === oi.menu_id);
            return categoryValues.includes((m as any)?.menu_categories?.name || '');
          });
        }
        if (hasItemFilters) {
          const qualIds = new Set(orderItems.map(oi => oi.order_id));
          safeOrders = safeOrders.filter((o: any) => qualIds.has(o.id));
        }
      }

      const gross = safeOrders.reduce((s: number, o: any) => s + Number(o.subtotal || 0), 0);
      const disc  = safeOrders.reduce((s: number, o: any) => s + Number(o.discount || 0), 0);
      const tax   = safeOrders.reduce((s: number, o: any) => s + Number(o.tax || 0), 0);
      const total = safeOrders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      const net   = total - disc - tax;
      setGrossSales(gross); setTotalDiscount(disc); setTotalTax(tax);
      setTotalSales(total); setNetSales(net < 0 ? 0 : net);
      setTotalOrders(safeOrders.length);
      setAov(safeOrders.length ? total / safeOrders.length : 0);
      setRefundCount(refundedOrders.length);
      setRefundAmount(refundedOrders.reduce((s: number, o: any) => s + Number(o.total || 0), 0));

      type DayBucket = {
        date: string; revenue: number; orders: number; gross: number; tax: number;
        discount: number; refunds: number; net: number; subtotal: number;
        ordersWithDiscount: number; topOrderType: string;
        byType: Record<string, number>; byTypeCount: Record<string, number>;
      };
      type HourBucket = { hour: string; revenue: number; orders: number; discount: number };

      const dailyMap: Record<string, DayBucket>  = {};
      const hourlyMap: Record<number, HourBucket> = {};

      safeOrders.forEach((o: any) => {
        const day  = new Date(o.created_at).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
        const hour = new Date(o.created_at).getHours();
        const rev  = Number(o.total    || 0);
        const dis  = Number(o.discount || 0);
        const tx   = Number(o.tax      || 0);
        const sub  = Number(o.subtotal || 0);
        const ot   = o.order_type || 'unknown';

        if (!dailyMap[day]) dailyMap[day] = {
          date: day, revenue: 0, orders: 0, gross: 0, tax: 0, discount: 0,
          refunds: 0, net: 0, subtotal: 0, ordersWithDiscount: 0, topOrderType: '',
          byType: {}, byTypeCount: {},
        };
        dailyMap[day].revenue  += rev; dailyMap[day].gross    += sub;
        dailyMap[day].tax      += tx;  dailyMap[day].discount += dis;
        dailyMap[day].subtotal += sub; dailyMap[day].orders   += 1;
        if (dis > 0) dailyMap[day].ordersWithDiscount += 1;
        dailyMap[day].byType[ot]      = (dailyMap[day].byType[ot]      || 0) + rev;
        dailyMap[day].byTypeCount[ot] = (dailyMap[day].byTypeCount[ot] || 0) + 1;

        if (!hourlyMap[hour]) hourlyMap[hour] = { hour: `${String(hour).padStart(2, '0')}:00`, revenue: 0, orders: 0, discount: 0 };
        hourlyMap[hour].revenue  += rev;
        hourlyMap[hour].orders   += 1;
        hourlyMap[hour].discount += dis;
      });

      refundedOrders.forEach((o: any) => {
        const day = new Date(o.created_at).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
        if (dailyMap[day]) dailyMap[day].refunds += Number(o.total || 0);
      });

      const dailyArr = Object.values(dailyMap).map(d => ({
        ...d,
        net: Math.max(0, d.revenue - d.discount - d.tax - d.refunds),
        topOrderType: Object.entries(d.byTypeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      }));

      setDailySales(dailyArr); setTotalSalesRows(dailyArr);
      setNetSalesRows(dailyArr.map(d => ({ date: d.date, gross: d.revenue, discount: d.discount, tax: d.tax, refunds: d.refunds, net: d.net, orders: d.orders })));
      setGrossSalesRows(dailyArr.map(d => ({ date: d.date, gross: d.revenue, orders: d.orders, subtotal: d.subtotal, tax: d.tax, discount: d.discount, byType: d.byType })));
      setAovRows(dailyArr.map(d => ({
        date: d.date,
        aov:         d.orders ? d.revenue / d.orders : 0,
        orders:      d.orders, revenue: d.revenue,
        aovDineIn:   d.byTypeCount['dine_in']  ? d.byType['dine_in']  / d.byTypeCount['dine_in']  : 0,
        aovTakeaway: d.byTypeCount['takeaway'] ? d.byType['takeaway'] / d.byTypeCount['takeaway'] : 0,
        aovDelivery: d.byTypeCount['delivery'] ? d.byType['delivery'] / d.byTypeCount['delivery'] : 0,
      })));

      const hourlyArr = Array.from({ length: 24 }, (_, h) =>
        hourlyMap[h] || { hour: `${String(h).padStart(2, '0')}:00`, revenue: 0, orders: 0, discount: 0 }
      );
      setHourlySales(hourlyArr); setHourlyRows(hourlyArr);

      setRefundRows(refundedOrders.map((o: any) => ({
        ...o, date: new Date(o.created_at).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
      })));
      setDiscountRows(
        dailyArr.filter(d => d.discount > 0 || d.orders > 0).map(d => ({
          date: d.date, discount: d.discount, ordersWithDiscount: d.ordersWithDiscount,
          revenue: d.revenue, topOrderType: d.topOrderType,
        }))
      );

      // Transactions (individual orders)
      const txRows = [...safeOrders, ...refundedOrders]
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((o: any) => ({
          ...o,
          time: new Date(o.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }),
          date: new Date(o.created_at).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
        }));
      setTransactionRows(txRows);

      // Payment
      const payMap: Record<string, any> = {};
      safeOrders.forEach((o: any) => {
        const m = o.payment_method || 'Unknown';
        if (!payMap[m]) payMap[m] = { name: m, value: 0, count: 0, discount: 0, refundCount: 0, refundAmount: 0 };
        payMap[m].value += Number(o.total || 0); payMap[m].count += 1; payMap[m].discount += Number(o.discount || 0);
      });
      refundedOrders.forEach((o: any) => {
        const m = o.payment_method || 'Unknown';
        if (payMap[m]) { payMap[m].refundCount += 1; payMap[m].refundAmount += Number(o.total || 0); }
      });
      setPaymentData(Object.values(payMap).map(p => ({ ...p, value: +p.value.toFixed(2) })));

      const typeMap: Record<string, number> = {};
      safeOrders.forEach((o: any) => { const t = o.order_type || 'Unknown'; typeMap[t] = (typeMap[t] || 0) + 1; });
      setOrderTypeData(Object.entries(typeMap).map(([name, value]) => ({ name, value })));

      // Menu items
      const filteredIds = safeOrders.map((o: any) => o.id);
      if (filteredIds.length > 0) {
        let relevantItems = orderItems;
        if (!hasItemFilters) {
          const { data: allItems } = await supabase.from('order_items').select('menu_id, quantity, subtotal, order_id').in('order_id', filteredIds);
          relevantItems = allItems || [];
        }
        const itemMap: Record<string, any> = {};
        relevantItems.forEach((oi: any) => {
          const m       = menuList?.find((x: any) => x.id === oi.menu_id) as any;
          const name    = m?.name || 'Unknown';
          const cat     = m?.menu_categories?.name || 'Uncategorized';
          const ord     = safeOrders.find((o: any) => o.id === oi.order_id) as any;
          const itemDisc = ord ? Number(ord.discount || 0) / Math.max(1, relevantItems.filter((x: any) => x.order_id === oi.order_id).length) : 0;
          if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0, category: cat, orderCount: 0, discount: 0 };
          itemMap[name].qty += oi.quantity; itemMap[name].revenue += Number(oi.subtotal || 0);
          itemMap[name].orderCount += 1; itemMap[name].discount += itemDisc;
        });
        const sorted = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue);
        setTopItems(sorted.slice(0, 10)); setWorstItems([...sorted].reverse().slice(0, 10));

        const catMap: Record<string, any> = {};
        relevantItems.forEach((oi: any) => {
          const m   = menuList?.find((x: any) => x.id === oi.menu_id) as any;
          const cat = m?.menu_categories?.name || 'Uncategorized';
          const ord = safeOrders.find((o: any) => o.id === oi.order_id) as any;
          const itemDisc = ord ? Number(ord.discount || 0) / Math.max(1, relevantItems.filter((x: any) => x.order_id === oi.order_id).length) : 0;
          if (!catMap[cat]) catMap[cat] = { name: cat, value: 0, orders: 0, pct: 0, discount: 0 };
          catMap[cat].value += Number(oi.subtotal || 0); catMap[cat].orders += 1; catMap[cat].discount += itemDisc;
        });
        const catTotal = Object.values(catMap).reduce((s, v) => s + v.value, 0);
        setCategoryData(Object.values(catMap).sort((a, b) => b.value - a.value).map(c => ({ ...c, value: +c.value.toFixed(2), pct: catTotal ? Math.round((c.value / catTotal) * 100) : 0 })));
      } else {
        setTopItems([]); setWorstItems([]); setCategoryData([]);
      }

      // Staff
      const { data: users } = await supabase.from('users').select('id, name, role').eq('merchant_id', merchantId);
      const staffMap: Record<string, any> = {};
      safeOrders.forEach((o: any) => {
        const uid  = o.waiter_id || o.cashier_id; if (!uid) return;
        const u    = (users || []).find((x: any) => x.id === uid) as any;
        const name = u?.name || uid.slice(0, 8);
        if (!staffMap[uid]) staffMap[uid] = { name, revenue: 0, orders: 0 };
        staffMap[uid].revenue += Number(o.total || 0); staffMap[uid].orders += 1;
      });
      setStaffData(Object.values(staffMap).sort((a, b) => b.revenue - a.revenue));

      const shiftMap: Record<string, any> = {};
      safeOrders.forEach((o: any) => {
        const h     = new Date(o.created_at).getHours();
        const shift = h >= 6 && h < 14 ? 'Morning (6–14)' : h >= 14 && h < 22 ? 'Afternoon (14–22)' : 'Night (22–6)';
        if (!shiftMap[shift]) shiftMap[shift] = { name: shift, revenue: 0, orders: 0 };
        shiftMap[shift].revenue += Number(o.total || 0); shiftMap[shift].orders += 1;
      });
      setShiftData(Object.values(shiftMap));

      // Tables
      let tablesQuery = supabase.from('tables').select('id, status').eq('merchant_id', merchantId);
      if (currentBranchId) tablesQuery = tablesQuery.eq('branch_id', currentBranchId);
      const { data: tables } = await tablesQuery;
      const tArr = tables || []; const occupied = tArr.filter((t: any) => t.status === 'occupied').length;
      setTableStats({ total: tArr.length, occupied, available: tArr.length - occupied, occupancyRate: tArr.length ? Math.round((occupied / tArr.length) * 100) : 0 });

      // Inventory
      let invQuery = supabase.from('inventory').select('id, name, quantity, min_stock_level, unit, cost_per_unit, supplier').eq('merchant_id', merchantId);
      if (currentBranchId) invQuery = invQuery.eq('branch_id', currentBranchId);
      const { data: inv } = await invQuery;
      const invArr = inv || [];
      setLowStockItems(invArr.filter((i: any) => Number(i.quantity) <= Number(i.min_stock_level)).sort((a: any, b: any) => Number(a.quantity) - Number(b.quantity)));
      setInventoryData(invArr.sort((a: any, b: any) => Number(a.quantity) - Number(b.quantity)).slice(0, 15));

      // EOD Reports & Sessions Fetch
      if (currentBranchId) {
        const fromDateStr = dateRange.from.toISOString().split('T')[0];
        const toDateStr = dateRange.to.toISOString().split('T')[0];
        const { data: eodData } = await supabase.rpc('get_eod_reports', {
          p_merchant_id: merchantId,
          p_branch_id: currentBranchId,
          p_from_date: fromDateStr,
          p_to_date: toDateStr,
        });
        setEodReports(eodData || []);

        const { data: shiftData } = await supabase
          .from('shifts')
          .select('*, users(name)')
          .eq('merchant_id', merchantId)
          .eq('branch_id', currentBranchId)
          .gte('clock_in', dateRange.from.toISOString())
          .lte('clock_in', dateRange.to.toISOString())
          .order('clock_in', { ascending: false });
        setShifts(shiftData || []);
      } else {
        setEodReports([]);
        setShifts([]);
      }

      setLastSynced(new Date());
    } catch (err) {
      console.error('Report error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, activeFilters, overrideMerchantId, selectedBranchId]);

  useEffect(() => { fetchReportData(); }, [fetchReportData]);
  useEffect(() => {
    const ch = supabase.channel('reports-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchReportData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchReportData]);

  return {
    loading, lastSynced, fetchReportData,
    orderTypeOptions, paymentOptions, categoryOptions, menuItemOptions,
    totalSales, grossSales, netSales, totalOrders, aov,
    totalDiscount, totalTax, refundCount, refundAmount,
    dailySales, hourlySales, totalSalesRows, netSalesRows, grossSalesRows,
    aovRows, hourlyRows, refundRows, discountRows, transactionRows,
    topItems, worstItems, categoryData, paymentData, orderTypeData,
    tableStats, staffData, shiftData, lowStockItems, inventoryData,
    branches, selectedBranchId, setSelectedBranchId, eodReports, shifts,
  };
}
