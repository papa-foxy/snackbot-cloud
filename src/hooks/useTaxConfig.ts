import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface TaxConfig {
  id:                 string;
  name:               string;
  code:               string;               // e.g. 'SST', 'SC'
  rate:               number;
  type:               'percentage' | 'fixed' | 'service_charge';
  applies_to:         'all' | 'category' | 'item' | 'order';
  is_inclusive:       boolean;
  is_active:          boolean;
  display_on_receipt: boolean;
  priority:           number;               // higher = evaluated first
}

export interface TaxItemOverride {
  menu_item_id:  string;
  tax_config_id: string;
  is_exempt:     boolean;
}

export interface TaxCategoryRule {
  category_id:   string;
  tax_config_id: string;
  is_exempt:     boolean;
}

export interface TaxLineItem {
  tax_config_id: string;
  name:          string;
  code:          string;
  rate:          number;
  type:          'percentage' | 'fixed' | 'service_charge';
  amount:        number;
  is_inclusive:  boolean;
}

export interface TaxResult {
  subtotal:    number;
  tax_lines:   TaxLineItem[];
  total_tax:   number;
  grand_total: number;
}

// ── Full tax context loaded from DB ───────────────────────────────────────────
export interface TaxContext {
  configs:         TaxConfig[];
  itemOverrides:   TaxItemOverride[];
  categoryRules:   TaxCategoryRule[];
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLUTION CHAIN (priority order — highest specificity wins):
//
//  1. Item-level override (is_exempt → skip ALL taxes for this item)
//  2. Item-level override (specific tax_config_id → use only that tax)
//  3. Category-level rule (is_exempt → skip taxes for items in this category)
//  4. Category-level rule (specific tax_config_id → use only that tax)
//  5. Global tax_config (applies_to = 'all' → applies to everything)
//  6. Order-level taxes (applied after subtotal, not per-item)
//
//  v2 (not yet active):
//  7. Branch/location override
//  8. Customer type rule (corporate/government/export)
//  9. Tax exemption certificate
// ─────────────────────────────────────────────────────────────────────────────

function computeTaxAmount(config: TaxConfig, base: number): number {
  if (config.type === 'fixed') {
    return config.is_inclusive ? 0 : config.rate;
  }
  // percentage or service_charge
  if (config.is_inclusive) {
    return base - base / (1 + config.rate / 100);
  }
  return base * (config.rate / 100);
}

// ── Calculate tax for one line item ───────────────────────────────────────────
export function calculateItemTax(
  subtotal:   number,
  ctx:        TaxContext,
  menuItemId?: string,
  categoryId?: string,
): TaxLineItem[] {
  const { configs, itemOverrides, categoryRules } = ctx;

  // Step 1 — check item-level override
  if (menuItemId) {
    const overrides = itemOverrides.filter(o => o.menu_item_id === menuItemId);

    // Fully exempt at item level
    if (overrides.some(o => o.is_exempt)) return [];

    // Item has specific tax config(s) assigned
    if (overrides.length > 0) {
      return overrides.flatMap(o => {
        const cfg = configs.find(c => c.id === o.tax_config_id && c.is_active);
        if (!cfg || cfg.applies_to === 'order') return [];
        const amount = computeTaxAmount(cfg, subtotal);
        return [{
          tax_config_id: cfg.id, name: cfg.name, code: cfg.code,
          rate: cfg.rate, type: cfg.type,
          amount: parseFloat(amount.toFixed(2)),
          is_inclusive: cfg.is_inclusive,
        }];
      });
    }
  }

  // Step 2 — check category-level rule
  if (categoryId) {
    const catRules = categoryRules.filter(r => r.category_id === categoryId);

    // Exempt at category level
    if (catRules.some(r => r.is_exempt)) return [];

    // Category has specific tax config(s)
    if (catRules.length > 0) {
      return catRules.flatMap(r => {
        const cfg = configs.find(c => c.id === r.tax_config_id && c.is_active);
        if (!cfg || cfg.applies_to === 'order') return [];
        const amount = computeTaxAmount(cfg, subtotal);
        return [{
          tax_config_id: cfg.id, name: cfg.name, code: cfg.code,
          rate: cfg.rate, type: cfg.type,
          amount: parseFloat(amount.toFixed(2)),
          is_inclusive: cfg.is_inclusive,
        }];
      });
    }
  }

  // Step 3 — fall back to global 'all' taxes
  const globalConfigs = configs
    .filter(c => c.is_active && c.applies_to === 'all')
    .sort((a, b) => b.priority - a.priority);

  return globalConfigs.map(cfg => {
    const amount = computeTaxAmount(cfg, subtotal);
    return {
      tax_config_id: cfg.id, name: cfg.name, code: cfg.code,
      rate: cfg.rate, type: cfg.type,
      amount: parseFloat(amount.toFixed(2)),
      is_inclusive: cfg.is_inclusive,
    };
  });
}

// ── Calculate tax for a full order ────────────────────────────────────────────
export interface OrderItem {
  id?:          string;
  menu_item_id?: string;
  category_id?:  string;
  subtotal:      number;
}

export function calculateOrderTax(items: OrderItem[], ctx: TaxContext): TaxResult {
  const orderSubtotal = parseFloat(items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));

  // Aggregate per-item taxes
  const aggregated: Record<string, TaxLineItem> = {};
  for (const item of items) {
    const lines = calculateItemTax(item.subtotal, ctx, item.menu_item_id, item.category_id);
    for (const line of lines) {
      if (aggregated[line.tax_config_id]) {
        aggregated[line.tax_config_id].amount = parseFloat(
          (aggregated[line.tax_config_id].amount + line.amount).toFixed(2)
        );
      } else {
        aggregated[line.tax_config_id] = { ...line };
      }
    }
  }

  // Order-level taxes (service charge etc.) — applied on subtotal
  const orderLevelConfigs = ctx.configs
    .filter(c => c.is_active && c.applies_to === 'order')
    .sort((a, b) => b.priority - a.priority);

  for (const cfg of orderLevelConfigs) {
    const amount = computeTaxAmount(cfg, orderSubtotal);
    if (aggregated[cfg.id]) {
      aggregated[cfg.id].amount = parseFloat((aggregated[cfg.id].amount + amount).toFixed(2));
    } else {
      aggregated[cfg.id] = {
        tax_config_id: cfg.id, name: cfg.name, code: cfg.code,
        rate: cfg.rate, type: cfg.type,
        amount: parseFloat(amount.toFixed(2)),
        is_inclusive: cfg.is_inclusive,
      };
    }
  }

  const tax_lines = Object.values(aggregated);
  const exclusiveTax = tax_lines
    .filter(l => !l.is_inclusive)
    .reduce((s, l) => s + l.amount, 0);

  const total_tax   = parseFloat(tax_lines.reduce((s, l) => s + l.amount, 0).toFixed(2));
  const grand_total = parseFloat((orderSubtotal + exclusiveTax).toFixed(2));

  return { subtotal: orderSubtotal, tax_lines, total_tax, grand_total };
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useTaxConfig(merchantId?: string) {
  const [ctx, setCtx]       = useState<TaxContext>({ configs: [], itemOverrides: [], categoryRules: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    
    // Get active merchant ID if not provided
    let activeMerchantId = merchantId;
    if (!activeMerchantId) {
      try {
        activeMerchantId = JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null;
      } catch {
        activeMerchantId = null;
      }
    }
    
    // If no merchant ID, don't fetch
    if (!activeMerchantId) {
      setCtx({ configs: [], itemOverrides: [], categoryRules: [] });
      setLoading(false);
      return;
    }

    const [cfgRes, itemRes, catRes] = await Promise.all([
      supabase.from('tax_config').select('*').eq('merchant_id', activeMerchantId).order('priority', { ascending: false }),
      supabase.from('tax_item_override').select('*').eq('merchant_id', activeMerchantId),
      supabase.from('tax_category_rule').select('*').eq('merchant_id', activeMerchantId),
    ]);

    if (cfgRes.error)  { setError(cfgRes.error.message);  setLoading(false); return; }
    if (itemRes.error) { setError(itemRes.error.message); setLoading(false); return; }
    if (catRes.error)  { setError(catRes.error.message);  setLoading(false); return; }

    setCtx({
      configs:       cfgRes.data  ?? [],
      itemOverrides: itemRes.data ?? [],
      categoryRules: catRes.data  ?? [],
    });
    setLoading(false);
  }, [merchantId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Convenience: active configs only
  const activeConfigs = ctx.configs.filter(c => c.is_active);

  return { ...ctx, activeConfigs, loading, error, refetch: fetch };
}