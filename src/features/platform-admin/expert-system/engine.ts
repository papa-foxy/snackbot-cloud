import { Merchant, StaffUser } from '../types';
import { DiagnosticFinding, PlatformHealthReport, DiagnosticCategory, Severity } from './types';

interface EngineInput {
  merchants: Merchant[];
  superadmins: StaffUser[];
  keepalive: { last_ping: string; ping_count: number } | null;
}

export function runPlatformDiagnostic({
  merchants,
  superadmins,
  keepalive,
}: EngineInput): PlatformHealthReport {
  const findings: DiagnosticFinding[] = [];
  const now = new Date().getTime();

  // Helper to detect demo accounts
  const isDemo = (m: Merchant) =>
    (m.business_type ?? '').toLowerCase() === 'demo' || m.name.toLowerCase().includes('demo');

  // Helper to calculate days since date
  const getDaysSince = (dateStr: string | null | undefined): number => {
    if (!dateStr) return 0;
    const past = new Date(dateStr).getTime();
    if (isNaN(past)) return 0;
    return Math.max(0, Math.floor((now - past) / (1000 * 60 * 60 * 24)));
  };

  // ── RULE 1: Pending Approval Bottleneck ──
  merchants.forEach(m => {
    if (m.plan_status === 'pending') {
      const days = getDaysSince(m.joined_date || m.created_at);
      const isDelayed = days >= 2;
      findings.push({
        id: `pending_${m.id}`,
        ruleCode: 'RULE_UNAPPROVED_PENDING',
        title: `Pending Approval: ${m.name}`,
        category: 'operational',
        severity: isDelayed ? 'high' : 'medium',
        merchantId: m.id,
        merchantName: m.name,
        description: `${m.name} has been awaiting account approval for ${days === 0 ? 'today' : `${days} day(s)`}.`,
        recommendation: 'Review account details and approve access to allow the merchant to begin configuring their menu and taking orders.',
        impactScore: isDelayed ? 6 : 3,
        action: {
          id: `act_approve_${m.id}`,
          label: 'Approve Restaurant',
          type: 'update_status',
          targetId: m.id,
          payload: { status: 'active' },
        },
        detectedAt: new Date().toISOString(),
      });
    }
  });

  // ── RULE 2: Active Account with Zero Outlets (Critical Setup Block) ──
  merchants.forEach(m => {
    if (m.plan_status === 'active' && (!m.branch_count || m.branch_count === 0) && !isDemo(m)) {
      findings.push({
        id: `nobranch_${m.id}`,
        ruleCode: 'RULE_ACTIVE_NO_BRANCH',
        title: `No Branch Outlet: ${m.name}`,
        category: 'operational',
        severity: 'critical',
        merchantId: m.id,
        merchantName: m.name,
        description: `${m.name} is marked active, but has 0 branch outlets created. Ordering and POS terminals cannot function without an outlet.`,
        recommendation: 'Initialize a default outlet for this merchant so their tables and menus can be mapped properly.',
        impactScore: 10,
        action: {
          id: `act_branch_${m.id}`,
          label: 'Create Main Branch',
          type: 'create_branch',
          targetId: m.id,
          payload: { name: 'Main Outlet' },
        },
        detectedAt: new Date().toISOString(),
      });
    }
  });

  // ── RULE 3: Plan Limit Exceeded - Monetization Upsell ──
  merchants.forEach(m => {
    if (m.plan === 'basic' && m.plan_status === 'active') {
      const hasMultipleBranches = (m.branch_count || 0) > 1;
      const hasManyStaff = (m.staff_count || 0) > 3;

      if (hasMultipleBranches || hasManyStaff) {
        findings.push({
          id: `upsell_${m.id}`,
          ruleCode: 'RULE_OVERCAPACITY_BASIC',
          title: `Upsell Opportunity: ${m.name}`,
          category: 'monetization',
          severity: 'medium',
          merchantId: m.id,
          merchantName: m.name,
          description: `${m.name} is on Basic tier (RM 99/mo) but operates ${m.branch_count ?? 0} branches and ${m.staff_count ?? 0} staff accounts.`,
          recommendation: 'Upgrade this tenant to Premium (RM 299/mo) to unlock official multi-outlet support and gain +RM 200/mo MRR.',
          impactScore: 2,
          action: {
            id: `act_upgrade_${m.id}`,
            label: 'Upgrade to Premium (+RM 200/mo)',
            type: 'upgrade_plan',
            targetId: m.id,
            payload: { plan: 'premium', mrr: 299 },
          },
          detectedAt: new Date().toISOString(),
        });
      }
    }
  });

  // ── RULE 4: Churn Risk - Inactive Active Account ──
  merchants.forEach(m => {
    if (m.plan_status === 'active' && !isDemo(m)) {
      const days = getDaysSince(m.joined_date || m.created_at);
      const orders = m.order_count ?? 0;
      if (orders === 0 && days > 7) {
        findings.push({
          id: `churn_${m.id}`,
          ruleCode: 'RULE_CHURN_INACTIVE',
          title: `Churn Risk (Zero Orders): ${m.name}`,
          category: 'churn_risk',
          severity: days > 21 ? 'high' : 'medium',
          merchantId: m.id,
          merchantName: m.name,
          description: `${m.name} has been active for ${days} days but has recorded 0 customer orders.`,
          recommendation: `Reach out to ${m.owner_name || 'the owner'} (${m.owner_email || 'No email'}) to assist with hardware setup and menu upload.`,
          impactScore: days > 21 ? 8 : 4,
          action: {
            id: `act_contact_${m.id}`,
            label: 'Contact Merchant Owner',
            type: 'contact_owner',
            targetId: m.id,
            payload: { email: m.owner_email, phone: m.owner_phone, name: m.name },
          },
          detectedAt: new Date().toISOString(),
        });
      }
    }
  });

  // ── RULE 5: Expiring Sandbox / Demo Accounts ──
  merchants.forEach(m => {
    if (isDemo(m)) {
      const days = getDaysSince(m.joined_date || m.created_at);
      if (days >= 14) {
        findings.push({
          id: `demo_${m.id}`,
          ruleCode: 'RULE_DEMO_EXPIRING',
          title: `Trial Ready to Convert: ${m.name}`,
          category: 'churn_risk',
          severity: 'low',
          merchantId: m.id,
          merchantName: m.name,
          description: `Sandbox demo restaurant has reached day ${days} of trial testing.`,
          recommendation: 'Contact the prospect to transition from sandbox demo to paid production subscription.',
          impactScore: 1,
          action: {
            id: `act_convert_${m.id}`,
            label: 'Convert to Production (Basic)',
            type: 'upgrade_plan',
            targetId: m.id,
            payload: { plan: 'basic', mrr: 99 },
          },
          detectedAt: new Date().toISOString(),
        });
      }
    }
  });

  // ── RULE 6: Supabase Keepalive Integrity Check ──
  if (keepalive?.last_ping) {
    const keepaliveDays = getDaysSince(keepalive.last_ping);
    if (keepaliveDays >= 5) {
      findings.push({
        id: 'keepalive_overdue',
        ruleCode: 'RULE_KEEPALIVE_RECENCY',
        title: 'Supabase Keepalive Heartbeat Overdue',
        category: 'system_integrity',
        severity: keepaliveDays >= 6 ? 'critical' : 'high',
        description: `Last automated database ping was ${keepaliveDays} day(s) ago (${new Date(keepalive.last_ping).toLocaleDateString()}). Supabase pauses inactive projects after 7 days.`,
        recommendation: 'Execute an immediate database keepalive heartbeat to reset Supabase auto-pause timer.',
        impactScore: keepaliveDays >= 6 ? 15 : 8,
        action: {
          id: 'act_ping_keepalive',
          label: 'Trigger Keepalive Heartbeat Now',
          type: 'trigger_keepalive',
        },
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // ── RULE 7: Single Superadmin Redundancy Warning ──
  if (superadmins.length <= 1) {
    findings.push({
      id: 'single_admin_risk',
      ruleCode: 'RULE_SUPERADMIN_REDUNDANCY',
      title: 'Single Platform Admin Redundancy Risk',
      category: 'security',
      severity: 'low',
      description: `Only ${superadmins.length === 1 ? '1 platform superadmin' : '0 platform superadmins'} currently configured. If credentials are lost, platform recovery will be difficult.`,
      recommendation: 'Designate at least one secondary administrator account for disaster recovery.',
      impactScore: 2,
      action: {
        id: 'act_nav_admins',
        label: 'Manage Superadmin Accounts',
        type: 'navigate',
        payload: { tab: 'admins' },
      },
      detectedAt: new Date().toISOString(),
    });
  }

  // ── CALCULATE HEALTH SCORE & GRADES ──
  const totalImpact = findings.reduce((sum, f) => sum + f.impactScore, 0);
  const overallScore = Math.max(15, Math.min(100, 100 - totalImpact));

  const grade =
    overallScore >= 95 ? 'A+' :
    overallScore >= 88 ? 'A' :
    overallScore >= 78 ? 'B' :
    overallScore >= 68 ? 'C' :
    overallScore >= 50 ? 'D' : 'F';

  // Category Scores
  const categories: DiagnosticCategory[] = [
    'churn_risk',
    'monetization',
    'operational',
    'security',
    'system_integrity',
  ];

  const categoryScores: Record<DiagnosticCategory, number> = {
    churn_risk: 100,
    monetization: 100,
    operational: 100,
    security: 100,
    system_integrity: 100,
  };

  categories.forEach(cat => {
    const catImpact = findings
      .filter(f => f.category === cat)
      .reduce((sum, f) => sum + f.impactScore, 0);
    categoryScores[cat] = Math.max(20, Math.min(100, 100 - catImpact * 3));
  });

  return {
    overallScore,
    grade,
    categoryScores,
    totalChecksRun: merchants.length * 5 + 3,
    totalFindings: findings.length,
    criticalCount: findings.filter(f => f.severity === 'critical').length,
    highCount: findings.filter(f => f.severity === 'high').length,
    mediumCount: findings.filter(f => f.severity === 'medium').length,
    lowCount: findings.filter(f => f.severity === 'low').length,
    findings: findings.sort((a, b) => {
      const order: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
      return order[b.severity] - order[a.severity];
    }),
    generatedAt: new Date().toISOString(),
  };
}
