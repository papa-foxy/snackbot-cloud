import { useState, useCallback, useEffect } from 'react';
import {
  LayoutDashboard, Store, ShieldCheck, Settings,
  LogOut, Menu, X, UtensilsCrossed, Activity, Sparkles, BarChart3
} from 'lucide-react';
import { Merchant, PageTab, StaffUser } from '../types';
import { OverviewTab } from '../components/OverviewTab';
import { AnalyticsTab } from '../components/AnalyticsTab';
import { MerchantsTab } from '../components/MerchantsTab';
import { AdminsTab } from '../components/AdminsTab';
import { AccessLogTab } from '../components/AccessLogTab';
import { SettingsTab } from '../components/SettingsTab';
import { ExpertSystemTab } from '../components/ExpertSystemTab';
import { GlobalAIChatbot } from '../components/GlobalAIChatbot';
import { MerchantDrawer } from '../components/MerchantDrawer';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';

interface PlatformAdminProps {
  user: { id: string; name: string; email: string };
  onLogout: () => void;
  onImpersonate: (merchantId: string, merchantName: string, writeAccess: boolean) => void;
}

export function PlatformAdmin({ user, onLogout, onImpersonate }: PlatformAdminProps) {
  const [activeTab, setActiveTab] = useState<PageTab>('overview');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [superadmins, setSuperadmins] = useState<StaffUser[]>([]);
  const [keepalive, setKeepalive] = useState<{ last_ping: string; ping_count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedMerchantForDrawer, setSelectedMerchantForDrawer] = useState<Merchant | null>(null);
  const [isAIChatbotOpen, setIsAIChatbotOpen] = useState(false);
  const [aiChatbotInitialPrompt, setAiChatbotInitialPrompt] = useState<string | undefined>(undefined);

  // Platform Aggregates
  const [totalGMV, setTotalGMV] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchPlatformData = useCallback(async () => {
    setLoading(true);

    // 1. Fetch businesses / merchants
    const { data: bizData } = await supabase
      .from('business')
      .select('id, name, owner_name, owner_email, owner_phone, city, business_type, plan, plan_status, plan_mrr, joined_date, created_at')
      .order('joined_date', { ascending: false });

    // 2. Fetch platform orders to calculate GMV
    const { data: orderData } = await supabase
      .from('orders')
      .select('id, total, merchant_id');

    const ordersList = orderData || [];
    const calculatedGMV = ordersList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    setTotalGMV(calculatedGMV);
    setTotalOrders(ordersList.length);

    // 3. Fetch superadmins & keepalive for Expert System diagnostics
    const [{ data: adminData }, { data: keepaliveData }] = await Promise.all([
      supabase.from('users').select('*').eq('is_platform_admin', true),
      supabase.from('_keepalive').select('last_ping, ping_count').eq('id', 1).maybeSingle(),
    ]);
    setSuperadmins((adminData as StaffUser[]) || []);
    setKeepalive(keepaliveData || null);

    if (bizData) {
      // 4. Enrich each merchant with live branch & staff counts and order totals
      const enriched = await Promise.all(
        bizData.map(async m => {
          const [{ count: bc }, { count: sc }] = await Promise.all([
            supabase.from('branches').select('id', { count: 'exact', head: true }).eq('merchant_id', m.id),
            supabase.from('users').select('id', { count: 'exact', head: true }).eq('merchant_id', m.id),
          ]);

          const merchantOrders = ordersList.filter(o => o.merchant_id === m.id);
          const merchantGMV = merchantOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

          return {
            ...m,
            branch_count: bc ?? 0,
            staff_count: sc ?? 0,
            order_count: merchantOrders.length,
            total_gmv: merchantGMV,
          };
        })
      );
      setMerchants(enriched);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlatformData();
  }, [fetchPlatformData]);

  const totalMRR = merchants
    .filter(m => m.plan_status === 'active')
    .reduce((sum, m) => sum + (m.plan_mrr || 99), 0);

  const activeCt = merchants.filter(m => m.plan_status === 'active').length;
  const pendingCt = merchants.filter(m => m.plan_status === 'pending').length;

  const handleUpdateStatus = async (id: string, status: string) => {
    await supabase.from('business').update({ plan_status: status }).eq('id', id);
    setMerchants(prev => prev.map(m => (m.id === id ? { ...m, plan_status: status } : m)));
  };

  const navItems: { id: PageTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',      label: 'Overview',        icon: LayoutDashboard },
    { id: 'expert_system', label: 'Platform Doctor', icon: Sparkles       },
    { id: 'merchants',     label: 'Restaurants',     icon: Store           },
    { id: 'admins',        label: 'Superadmins',     icon: ShieldCheck     },
    { id: 'access_log',    label: 'Access Log',      icon: Activity        },
    { id: 'settings',      label: 'Settings',        icon: Settings        },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#FBFBFA] text-slate-800 font-sans">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 shrink-0 shadow-xs',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#D97706] text-white flex items-center justify-center shadow-md shadow-amber-600/30">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                SnackBot
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-300">
                  SaaS
                </span>
              </div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-amber-700 mt-0.5">
                Superadmin Portal
              </div>
            </div>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left group',
                  isActive
                    ? 'bg-amber-500/10 text-amber-900 font-bold border border-amber-200/70 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <item.icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive ? 'text-[#D97706]' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
                <span className="flex-1">{item.label}</span>
                {item.id === 'merchants' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {merchants.length}
                  </span>
                )}
                {item.id === 'expert_system' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    Live
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Current Superadmin Card */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-slate-200/80 mb-2 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#D97706] font-bold flex items-center justify-center text-xs shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">{user.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-all font-semibold"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main View Pane ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 z-30 shadow-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#D97706] text-white flex items-center justify-center shadow-sm">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-900">SnackBot Platform</span>
          </div>

          <div className="w-7 h-7 rounded-xl bg-amber-100 text-[#D97706] font-bold flex items-center justify-center text-xs">
            {user.name.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <div className="w-full max-w-[1560px] mx-auto">
            {activeTab === 'overview' && (
              <OverviewTab
                merchants={merchants}
                totalMRR={totalMRR}
                totalGMV={totalGMV}
                totalOrders={totalOrders}
                activeCt={activeCt}
                pendingCt={pendingCt}
                loading={loading}
                onNavigate={setActiveTab}
                onImpersonate={onImpersonate}
                onInspectMerchant={m => setSelectedMerchantForDrawer(m)}
                onOpenAIChat={prompt => {
                  setAiChatbotInitialPrompt(prompt);
                  setIsAIChatbotOpen(true);
                }}
              />
            )}

            {activeTab === 'expert_system' && (
              <ExpertSystemTab
                merchants={merchants}
                superadmins={superadmins}
                keepalive={keepalive}
                onRefreshData={fetchPlatformData}
                onNavigateTab={setActiveTab}
                onMerchantUpdated={m => setMerchants(prev => prev.map(old => old.id === m.id ? m : old))}
              />
            )}

            {activeTab === 'merchants' && (
              <MerchantsTab
                merchants={merchants}
                loading={loading}
                onRefresh={fetchPlatformData}
                setMerchants={setMerchants}
                onImpersonate={onImpersonate}
                onUpdateStatus={handleUpdateStatus}
              />
            )}

            {activeTab === 'admins' && (
              <AdminsTab currentUser={user} />
            )}

            {activeTab === 'access_log' && (
              <AccessLogTab />
            )}

            {activeTab === 'settings' && (
              <SettingsTab />
            )}
          </div>
        </main>
      </div>

      {/* Drawer for Inspecting Merchant from Analytics */}
      {selectedMerchantForDrawer && (
        <MerchantDrawer
          merchant={selectedMerchantForDrawer}
          onClose={() => setSelectedMerchantForDrawer(null)}
          onImpersonate={onImpersonate}
          onMerchantUpdated={m => {
            setMerchants(prev => prev.map(old => old.id === m.id ? m : old));
            setSelectedMerchantForDrawer(m);
          }}
          onMerchantDeleted={id => {
            setMerchants(prev => prev.filter(m => m.id !== id));
            setSelectedMerchantForDrawer(null);
          }}
        />
      )}

      {/* Omnipresent Global AI Chatbot Across All Platform Admin Pages */}
      <GlobalAIChatbot
        activeTab={activeTab}
        onNavigateTab={setActiveTab}
        merchants={merchants}
        totalMRR={totalMRR}
        totalGMV={totalGMV}
        totalOrders={totalOrders}
        isOpen={isAIChatbotOpen}
        onToggleOpen={setIsAIChatbotOpen}
        initialPrompt={aiChatbotInitialPrompt}
      />
    </div>
  );
}