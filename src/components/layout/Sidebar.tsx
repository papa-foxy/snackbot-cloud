import React from 'react';
import {
  LayoutDashboard, BarChart3, FileText, Settings as SettingsIcon,
  Store, GitBranch, LogOut, MenuSquare, ShieldAlert, Package,
  X, Gift, Ticket, Users as UsersIcon, Armchair, Cloud, Receipt,

} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../contexts/TranslationContext';
import { useSettings } from '../../contexts/SettingsContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ activeTab, setActiveTab, user, onLogout, isOpen = true, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const { settings, themeColors, updateSetting } = useSettings();
  const showLabels = settings.toggles?.sidebarLabels ?? true;

  // ── Derive isDark at render time ──────────────────────────────────────────
  // Checks both explicit 'dark' setting and system preference
  const isDark = settings.theme === 'dark'
    || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);



  // ── Inline styles using CSS vars defined in SettingsContext ───────────────
  // SettingsContext always sets these vars on <html>:
  //   --sb-sidebar: #111111   (sidebar bg)
  //   --sb-card:    #222222   (card / hover bg)
  //   --sb-border:  #2E2E2E   (dividers)
  const S = {
    sidebar: isDark ? { backgroundColor: 'var(--sb-sidebar)', borderColor: 'var(--sb-border)' } : {},
    border:  isDark ? { borderColor: 'var(--sb-border)' } : {},
    card:    isDark ? { backgroundColor: 'var(--sb-card)' } : {},
  };

  // Hover helpers that can't be done via Tailwind when using CSS vars
  const onHoverIn  = (e: React.MouseEvent) => { if (isDark) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sb-card)'; };
  const onHoverOut = (e: React.MouseEvent) => { if (isDark) (e.currentTarget as HTMLElement).style.backgroundColor = ''; };
  const onHoverInRed  = (e: React.MouseEvent) => { if (isDark) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(127,29,29,0.3)'; };
  const onHoverOutRed = (e: React.MouseEvent) => { if (isDark) (e.currentTarget as HTMLElement).style.backgroundColor = ''; };

  const navCategories = [
    {
      id: 'operations',
      label: t('nav.operations', 'Operations'),
      items: [
        { id: 'dashboard', label: t('nav.dashboard', 'Dashboard'),     icon: LayoutDashboard },
        { id: 'reports',   label: t('nav.reports',   'Sales Reports'), icon: BarChart3 },
      ],
    },
    {
      id: 'management',
      label: t('nav.management', 'Management'),
      items: [
        { id: 'menu',      label: t('nav.menu',      'Menu Management'),   icon: MenuSquare },
        { id: 'inventory', label: t('nav.inventory', 'Inventory'),         icon: Package },
        { id: 'branches',  label: t('nav.branches',  'Branch Management'), icon: GitBranch },
        { id: 'tables_qr', label: t('nav.tables_qr', 'Tables & QR'),       icon: Armchair },
        { id: 'users',     label: t('nav.users',     'Staff & Users'),     icon: UsersIcon },
      ],
    },
    {
      id: 'marketing',
      label: t('nav.marketing', 'Marketing'),
      items: [
        { id: 'promotions', label: t('nav.promotions', 'Promotions'),        icon: Ticket },
        { id: 'loyalty',    label: t('nav.loyalty',    'Loyalty & Rewards'), icon: Gift },
      ],
    },
    {
      id: 'compliance',
      label: t('nav.compliance', 'Compliance'),
      items: [
        { id: 'tax',  label: t('nav.tax',  'Tax Management'), icon: Receipt },
        { id: 'lhdn', label: t('nav.lhdn', 'MyInvoice'), icon: FileText },
      ],
    },
    {
      id: 'system',
      label: t('nav.system', 'System'),
      items: [
        { id: 'cloud_sync', label: t('nav.cloud_sync', 'Cloud Sync'), icon: Cloud },
        { id: 'audit',      label: t('nav.audit',      'Audit Logs'), icon: ShieldAlert },
        { id: 'settings',   label: t('nav.settings',   'Settings'),   icon: SettingsIcon },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      {/* ── Sidebar shell ── */}
      <aside
        style={S.sidebar}
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out',
          'bg-white dark:bg-[var(--sb-main)] border-r border-gray-200 dark:border-[var(--sb-border)]',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          showLabels ? 'w-64' : 'w-20'
        )}
      >
        {/* ── Logo row ── */}
        <div
          style={S.border}
          className={cn(
            'h-14 flex items-center border-b border-gray-200 dark:border-[var(--sb-border)] shrink-0',
            showLabels ? 'justify-between px-4' : 'justify-center px-2'
          )}
        >
          <div className="flex items-center">
            {/* Accent-coloured icon box */}
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
              isDark ? themeColors.bg : themeColors.bgLight,
              showLabels ? 'mr-2.5' : ''
            )}>
              <Store className={cn("w-4 h-4", isDark ? "text-white" : themeColors.text)} />
            </div>
            {showLabels && (
              <span className={cn(
                'font-bold text-base tracking-tight',
                isDark ? 'text-neutral-100' : 'text-black'
              )}>
                SnackBot POS
              </span>
            )}
          </div>

          {/* Mobile close button */}
          {showLabels && (
            <button
              onClick={onClose}
              onMouseEnter={onHoverIn}
              onMouseLeave={onHoverOut}
              className={cn(
                'lg:hidden p-1.5 rounded-md transition-colors',
                isDark ? 'text-neutral-400 hover:text-neutral-100' : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-4">
          {navCategories.map((category) => (
            <div key={category.id}>
              {showLabels && (
                <p className={cn(
                  'text-xs font-semibold uppercase tracking-wider px-2 mb-1',
                  isDark ? 'text-neutral-500' : 'text-gray-400'
                )}>
                  {category.label}
                </p>
              )}
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (onClose && window.innerWidth < 1024) onClose();
                      }}
                      title={!showLabels ? item.label : undefined}
                      // Active state uses --sb-card in dark mode
                      style={isActive && isDark ? S.card : {}}
                      onMouseEnter={!isActive ? onHoverIn : undefined}
                      onMouseLeave={!isActive ? onHoverOut : undefined}
                      className={cn(
                        'w-full flex items-center py-2 text-sm font-medium rounded-lg transition-colors',
                        showLabels ? 'px-2' : 'justify-center px-0',
                        isActive
                          ? isDark
                            ? 'text-neutral-100'
                            : cn(themeColors.bgLight, themeColors.textLight)
                          : isDark
                            ? 'text-neutral-400 hover:text-neutral-100'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-black'
                      )}
                    >
                      <Icon className={cn(
                        'w-4 h-4 shrink-0',
                        showLabels ? 'mr-2.5' : '',
                        isActive
                          ? isDark
                            ? 'text-[color:var(--color-primary)]'
                            : themeColors.text
                          : isDark ? 'text-neutral-500' : 'text-gray-400'
                      )} />
                      {showLabels && item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div
          style={S.border}
          className="p-3 border-t border-gray-200 shrink-0"
        >
          <div className={cn(
            'flex items-center gap-2',
            showLabels ? 'justify-between' : 'flex-col justify-center'
          )}>

            {/* Avatar + name */}
            <div className="flex items-center overflow-hidden min-w-0">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                themeColors.bgLight, themeColors.textLight
              )}>
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              {showLabels && (
                <div className="ml-2 overflow-hidden">
                  <p className={cn('text-xs font-medium truncate', isDark ? 'text-neutral-100' : 'text-black')}>
                    {user?.name || 'User'}
                  </p>
                  <p className={cn('text-xs truncate', isDark ? 'text-neutral-400' : 'text-gray-500')}>
                    {user?.email || ''}
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className={cn('flex items-center gap-1 shrink-0', !showLabels && 'flex-col')}>



              {/* Logout — only shown when labels visible */}
              {showLabels && (
                <button
                  onClick={onLogout}
                  title={t('nav.logout', 'Logout')}
                  onMouseEnter={onHoverInRed}
                  onMouseLeave={onHoverOutRed}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    isDark
                      ? 'text-neutral-400 hover:text-red-400'
                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  )}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Collapsed: logout below theme toggle */}
          {!showLabels && (
            <button
              onClick={onLogout}
              title={t('nav.logout', 'Logout')}
              onMouseEnter={onHoverInRed}
              onMouseLeave={onHoverOutRed}
              className={cn(
                'mt-1 w-full flex justify-center p-1.5 rounded-lg transition-colors',
                isDark
                  ? 'text-neutral-400 hover:text-red-400'
                  : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
              )}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}