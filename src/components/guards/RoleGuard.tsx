// src/components/RoleGuard.tsx
import React from 'react';
import { ShieldOff } from 'lucide-react';

// Matches your actual DB role values exactly (lowercase as stored)
export type UserRole = 'Manager' | 'Supervisor' | 'cashier' | 'kitchen' | 'waiter';

const ROLE_RANK: Record<UserRole, number> = {
  Manager:    3,
  Supervisor: 2,
  cashier:    1,
  kitchen:    1,
  waiter:     1,
};

export function hasRole(userRole: UserRole, required: UserRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

export function hasAnyRole(userRole: UserRole, roles: UserRole[]): boolean {
  return roles.includes(userRole);
}

export function isStaffRole(role: UserRole): boolean {
  return ROLE_RANK[role] === 1;
}

interface RoleGuardProps {
  userRole: UserRole;
  requiredRole?: UserRole;
  allowedRoles?: UserRole[];
  children: React.ReactNode;
  showFallback?: boolean;
  fallback?: React.ReactNode;
}

/**
 * Usage:
 *   <RoleGuard userRole={user.role} requiredRole="Manager" showFallback>
 *     <SettingsPage />
 *   </RoleGuard>
 */
export function RoleGuard({ userRole, requiredRole, allowedRoles, children, showFallback = false, fallback }: RoleGuardProps) {
  const allowed = allowedRoles
    ? hasAnyRole(userRole, allowedRoles)
    : hasRole(userRole, requiredRole ?? 'cashier');

  if (allowed) return <>{children}</>;
  if (!showFallback) return null;

  return fallback ? <>{fallback}</> : (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
        <ShieldOff className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-200">Access Restricted</h2>
      <p className="text-sm text-gray-500 dark:text-neutral-500 max-w-xs">
        You don't have permission to view this page.
        {requiredRole && ` Requires ${requiredRole} access or higher.`}
      </p>
    </div>
  );
}

export function usePermission(userRole: UserRole) {
  return {
    can:          (r: UserRole)    => hasRole(userRole, r),
    canAny:       (rs: UserRole[]) => hasAnyRole(userRole, rs),
    role:         userRole,
    isManager:    userRole === 'Manager',
    isSupervisor: userRole === 'Supervisor',
    isStaff:      isStaffRole(userRole),
    isCashier:    userRole === 'cashier',
    isKitchen:    userRole === 'kitchen',
    isWaiter:     userRole === 'waiter',
  };
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  requiredRole: UserRole;
}

export function filterNavByRole(items: NavItem[], role: UserRole): NavItem[] {
  return items.filter(i => hasRole(role, i.requiredRole));
}