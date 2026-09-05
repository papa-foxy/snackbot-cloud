export interface Merchant {
  id: string;
  name: string;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  city: string | null;
  business_type: string | null;
  category?: string | null;
  plan: string;
  plan_status: string;
  plan_mrr: number;
  joined_date: string | null;
  created_at?: string;
  branch_count?: number;
  staff_count?: number;
  order_count?: number;
  total_gmv?: number;
}

export interface Branch {
  id: string;
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  merchant_id: string;
  table_rows?: number;
  table_cols?: number;
  created_at?: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  pin?: string;
  is_active: boolean;
  is_platform_admin?: boolean;
  merchant_id?: string;
  created_at?: string;
  last_login?: string;
}

export interface ImpersonationLog {
  id: string;
  admin_user_id?: string;
  admin_email?: string;
  merchant_id: string;
  started_at: string;
  ended_at: string | null;
  is_write_access: boolean;
  merchant_name?: string;
  merchant_email?: string;
  metadata?: any;
}

export interface PlatformSettings {
  requireTwoFactor: boolean;
  enforceRLS: boolean;
  sessionTimeoutHours: number;
  auditRetentionDays: number;
  maintenanceMode: boolean;
  maintenanceNotice: string;
  broadcastAnnouncement: string;
  allowPublicRegistrations: boolean;
}

export type PageTab = 'overview' | 'analytics' | 'expert_system' | 'merchants' | 'admins' | 'access_log' | 'settings';

export interface PlanConfig {
  id: string;
  label: string;
  price: number;
  accent: string;
  ring: string;
  bg: string;
  text: string;
  features: string[];
}

export const PLANS: PlanConfig[] = [
  {
    id: 'basic',
    label: 'Basic',
    price: 99,
    accent: '#64748b',
    ring: 'ring-slate-200',
    bg: 'bg-slate-50 text-slate-600',
    text: 'text-slate-500',
    features: ['1 Branch Outlet', 'Up to 3 Staff Accounts', 'Standard Reports', 'Cloud POS Sync']
  },
  {
    id: 'premium',
    label: 'Premium',
    price: 299,
    accent: '#D97706',
    ring: 'ring-amber-200',
    bg: 'bg-amber-50 text-amber-700',
    text: 'text-amber-600',
    features: ['Up to 5 Branches', 'Unlimited Staff', 'AI Assistant Insights', 'LHDN E-Invoice', 'Priority Support']
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    price: 599,
    accent: '#B45309',
    ring: 'ring-amber-300',
    bg: 'bg-amber-100/70 text-amber-900',
    text: 'text-amber-700',
    features: ['Unlimited Branches', 'Custom Domain', 'Dedicated Account Manager', 'Custom API Integrations', 'SLA Guarantee']
  },
];

export const getPlan = (id: string): PlanConfig => PLANS.find(p => p.id === id) ?? PLANS[0];
