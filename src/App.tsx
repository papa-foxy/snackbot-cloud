/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';

import { TranslationProvider }            from './contexts/TranslationContext';
import { SettingsProvider, useSettings }  from './contexts/SettingsContext';
import { ImpersonationProvider, useImpersonation } from './contexts/ImpersonationContext';

import { Sidebar }          from './components/Sidebar';
import { Login, ResetPassword } from './components/Login';
import { PlatformAdmin }    from './components/PlatformAdmin';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { Dashboard }        from './components/Dashboard';
import { Reports }          from './components/Reports';
import { LHDN }             from './components/LHDN';
import { Settings }         from './components/Settings';
import { MenuManagement }   from './components/MenuManagement';
import { AuditLogs }        from './components/AuditLogs';
import { Inventory }        from './components/Inventory';
import { Users }            from './components/Users';
import { Loyalty }          from './components/Loyalty';
import { Promotions }       from './components/Promotions';
import { QRManagement }     from './components/QRManagement';
import { CloudSync }        from './components/CloudSync';
import { BranchesList }     from './components/BranchesList';
import { TaxManagement }    from './components/TaxManagement';
import { AIAssistant }      from './components/AIAssistant';
import { TableOrderPage, QrRedirect } from './components/Tableorderpage';
import { AcceptInvitePage } from './components/AcceptInvitePage';
import { DemoOnboardingPage } from './components/DemoOnboardingPage';
import { cn }               from './utils/cn';

function detectQrRoute(): 'order' | 'qr_redirect' | 'accept_invite' | 'demo_onboarding' | 'reset_password' | null {
  const rawPath = window.location.pathname;
  const normalizedPath = '/' + rawPath.replace(/^\/+|\/+$/g, '');
  if (normalizedPath === '/order' || normalizedPath.startsWith('/order?')) return 'order';
  if (normalizedPath.startsWith('/qr/'))                              return 'qr_redirect';
  if (normalizedPath === '/accept-invite')                            return 'accept_invite';
  if (normalizedPath === '/demo-onboarding')                          return 'demo_onboarding';
  if (normalizedPath === '/reset-password')                           return 'reset_password';
  return null;
}

const PAGE_TITLES: Record<string, string> = {
  dashboard:  'Dashboard',
  reports:    'Sales Reports',
  menu:       'Menu Management',
  inventory:  'Inventory',
  branches:   'Branch Management',
  tables_qr:  'Tables & QR',
  users:      'Staff & Users',
  promotions: 'Promotions',
  loyalty:    'Loyalty & Rewards',
  tax:        'Tax Management',
  lhdn:       'LHDN E-Invoice',
  cloud_sync: 'Cloud Sync',
  audit:      'Audit Logs',
  settings:   'Settings',
};

function AppContent({
  activeTab, setActiveTab, user, handleLogout,
  isSidebarOpen, setIsSidebarOpen,
  pageTitle,
}: any) {
  const { themeColors, settings } = useSettings();
  const { isImpersonating }       = useImpersonation();

  const isDark = settings.theme === 'dark'
    || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const mainBg    = isDark ? { backgroundColor: 'var(--sb-main)' } : {};
  const headerSty = isDark ? { backgroundColor: 'var(--sb-main)', borderColor: 'var(--sb-border)' } : {};

  return (
    <div
      style={isDark ? { backgroundColor: 'var(--sb-main)', color: '#f5f5f5' } : {}}
      className="flex h-screen bg-[#f0f2f5] text-black font-sans overflow-hidden"
    >
      <ImpersonationBanner />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className={cn('flex-1 flex flex-col h-screen overflow-hidden', isImpersonating && 'pt-9')}>

        {/* Mobile header */}
        <header style={headerSty} className="lg:hidden h-14 bg-white dark:bg-[var(--sb-main)] border-b border-gray-200 dark:border-[var(--sb-border)] flex items-center px-4 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className={cn(
              'p-2 -ml-2 mr-2 rounded-lg transition-colors',
              isDark ? 'text-neutral-300' : 'text-gray-600 hover:bg-[#f0f2f5]'
            )}
            onMouseEnter={e => { if (isDark) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sb-card)'; }}
            onMouseLeave={e => { if (isDark) (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className={cn('font-bold text-base tracking-tight truncate', isDark ? themeColors.text : 'text-black')}>
            {pageTitle}
          </span>
        </header>

        {/* Main content area */}
        <main style={mainBg} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#f0f2f5]">
          {activeTab === 'dashboard'  && <Dashboard  onNavigatePage={setActiveTab} />}
          {activeTab === 'reports'    && <Reports />}
          {activeTab === 'menu'       && <MenuManagement />}
          {activeTab === 'inventory'  && <Inventory />}
          {activeTab === 'users'      && <Users currentUser={user} />}
          {activeTab === 'loyalty'    && <Loyalty />}
          {activeTab === 'promotions' && <Promotions />}
          {activeTab === 'tables_qr'  && <QRManagement />}
          {activeTab === 'cloud_sync' && <CloudSync />}
          {activeTab === 'lhdn'       && <LHDN />}
          {activeTab === 'audit'      && <AuditLogs />}
          {activeTab === 'settings'   && <Settings onNavigatePage={setActiveTab} />}
          {activeTab === 'tax'        && <TaxManagement />}
          {activeTab.startsWith('branches') && <BranchesList activeTab={activeTab} />}
        </main>
      </div>

      <AIAssistant
        onNavigate={(sectionId) => {
          setActiveTab('settings');
          setTimeout(() => {
            document.getElementById(`setting-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }}
        onNavigatePage={(tab) => setActiveTab(tab)}
      />
    </div>
  );
}

function AppInner() {
  const [activeTab, setActiveTab]         = useState('dashboard');
  const [user, setUser]                   = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { isImpersonating, startImpersonation, endImpersonation } = useImpersonation();

  const qrType = detectQrRoute();
  if (qrType === 'order')         return <TableOrderPage />;
  if (qrType === 'qr_redirect')   return <QrRedirect />;
  if (qrType === 'accept_invite') return <AcceptInvitePage />;
  if (qrType === 'demo_onboarding') return <DemoOnboardingPage />;
  if (qrType === 'reset_password') return <ResetPassword />;

  useEffect(() => {
    (window as any).__appNavigate = (path: string) => {
      setActiveTab(path.replace(/^\//, '') || 'dashboard');
    };
    return () => { delete (window as any).__appNavigate; };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('snackbot_user');
    if (stored) { try { setUser(JSON.parse(stored)); } catch {} }
  }, []);

  const handleLogin          = (userData: any) => { setUser(userData); localStorage.setItem('snackbot_user', JSON.stringify(userData)); };
  const handleLogout         = () => { if (isImpersonating) endImpersonation(); setUser(null); localStorage.removeItem('snackbot_user'); };
  const handleSetActiveTab   = (tab: string) => setActiveTab(tab);
  const handleImpersonate    = async (merchantId: string, merchantName: string, writeAccess: boolean) => {
    await startImpersonation(merchantId, merchantName, writeAccess);
    setActiveTab('dashboard');
  };

  if (!user) return <Login onLogin={handleLogin} />;

  if (user.is_platform_admin && !isImpersonating) {
    return (
      <>
        <ImpersonationBanner />
        <PlatformAdmin user={user} onLogout={handleLogout} onImpersonate={handleImpersonate} />
      </>
    );
  }

  const pageTitle = PAGE_TITLES[activeTab] ?? activeTab.replace(/-|_/g, ' ');

  return (
    <AppContent
      activeTab={activeTab}
      setActiveTab={handleSetActiveTab}
      user={user}
      handleLogout={handleLogout}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      pageTitle={pageTitle}
    />
  );
}

export default function App() {
  const qrType = detectQrRoute();
  if (qrType === 'order' || qrType === 'qr_redirect') {
    return (
      <TranslationProvider>
        {qrType === 'order' ? <TableOrderPage /> : <QrRedirect />}
      </TranslationProvider>
    );
  }

  return (
    <TranslationProvider>
      <SettingsProvider>
        <ImpersonationProvider>
          <AppInner />
        </ImpersonationProvider>
      </SettingsProvider>
    </TranslationProvider>
  );
}