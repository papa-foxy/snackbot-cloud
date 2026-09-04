import React from 'react';

export type FilterType = 'order_type' | 'payment_method' | 'category' | 'menu_item';

export interface ActiveFilter {
  id: string;
  type: FilterType;
  label: string;
  value: string;
}

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

export type InsightSection =
  | 'sales_revenue'
  | 'menu_insights'
  | 'payment_transactions'
  | 'table_customer'
  | 'staff_shift'
  | 'inventory_stock'
  | 'eod_reports'
  | 'session_reports';

export interface InsightConfig {
  id: InsightSection;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

export interface ColDef {
  id: string;
  label: string;
  defaultVisible: boolean;
  render: (row: any, i: number, extra?: any) => React.ReactNode;
  headerClass?: string;
  cellClass?: string;
}

export interface DailySalesRow {
  date: string;
  revenue: number;
  orders: number;
  gross: number;
  tax: number;
  discount: number;
  refunds: number;
  net: number;
  subtotal: number;
  ordersWithDiscount: number;
  topOrderType: string;
  byType: Record<string, number>;
  byTypeCount: Record<string, number>;
}

export interface TableStats {
  total: number;
  occupied: number;
  available: number;
  occupancyRate: number;
}
