export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type DiagnosticCategory =
  | 'churn_risk'
  | 'monetization'
  | 'operational'
  | 'security'
  | 'system_integrity';

export interface RemediationAction {
  id: string;
  label: string;
  type: 'update_status' | 'upgrade_plan' | 'trigger_keepalive' | 'create_branch' | 'contact_owner' | 'navigate';
  targetId?: string;
  payload?: any;
}

export interface DiagnosticFinding {
  id: string;
  ruleCode: string;
  title: string;
  category: DiagnosticCategory;
  severity: Severity;
  merchantId?: string;
  merchantName?: string;
  description: string;
  recommendation: string;
  impactScore: number; // Point deduction from health score
  action?: RemediationAction;
  detectedAt: string;
}

export interface PlatformHealthReport {
  overallScore: number; // 0 to 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  categoryScores: Record<DiagnosticCategory, number>; // 0 to 100
  totalChecksRun: number;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: DiagnosticFinding[];
  generatedAt: string;
}
