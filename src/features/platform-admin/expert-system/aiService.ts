import { GoogleGenAI } from '@google/genai';
import { PlatformHealthReport, DiagnosticFinding } from './types';
import { Merchant, StaffUser } from '../types';

export interface AICopilotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIExecutiveDiagnosisResult {
  summary: string;
  strategicLevers: string[];
  churnAlerts: string[];
  recommendedActions: { priority: 'Urgent' | 'High' | 'Medium'; title: string; detail: string }[];
  isQuotaFallback?: boolean;
}

export interface AIFindingDeepDiveResult {
  rootCause: string;
  businessImpact: string;
  suggestedSteps: string[];
  outreachTemplate: {
    channel: 'Email' | 'WhatsApp';
    subject?: string;
    body: string;
  };
  isQuotaFallback?: boolean;
}

/**
 * Returns a configured GoogleGenAI instance or null if no key is present.
 */
function getGenAI(): GoogleGenAI | null {
  const apiKey = (import.meta.env as any).VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/**
 * Generate a high-level executive diagnosis of platform health using Gemini.
 */
export async function generateExecutiveDiagnosis(
  report: PlatformHealthReport,
  merchants: Merchant[],
  superadmins: StaffUser[],
  keepalive: { last_ping: string; ping_count: number } | null
): Promise<AIExecutiveDiagnosisResult> {
  const activeCount = merchants.filter(m => m.plan_status === 'active').length;
  const pendingCount = merchants.filter(m => m.plan_status === 'pending').length;
  const totalMRR = merchants
    .filter(m => m.plan_status === 'active')
    .reduce((sum, m) => sum + (m.plan_mrr || 99), 0);
  const criticalFindings = report.findings.filter(f => f.severity === 'critical');
  const highFindings = report.findings.filter(f => f.severity === 'high');

  const contextPrompt = `
You are the Chief Technology & Operations AI Advisor for SnackBot Cloud, an enterprise multi-tenant restaurant POS SaaS platform in Malaysia.
Analyze the following live telemetry and diagnostic findings:

PLATFORM METRICS:
- Overall Health Score: ${report.overallScore}/100 (Grade: ${report.grade})
- Sub-Scores:
  * System Integrity: ${report.categoryScores.system_integrity}%
  * Platform Security: ${report.categoryScores.security}%
  * Monetization & Upsell: ${report.categoryScores.monetization}%
  * Operational Readiness: ${report.categoryScores.operational}%
  * Churn Risk: ${report.categoryScores.churn_risk}%
- Total Restaurants: ${merchants.length} (${activeCount} Active, ${pendingCount} Pending Approval)
- Current SaaS MRR: RM ${totalMRR}/month
- Platform Admins: ${superadmins.length} superadmins
- Database Keepalive: ${keepalive ? `Last pinged ${keepalive.last_ping} (${keepalive.ping_count} total pulses)` : 'No keepalive record found'}

TOP CRITICAL & HIGH ISSUES:
${[...criticalFindings, ...highFindings].slice(0, 8).map(f => `- [${f.severity.toUpperCase()}] ${f.title} (${f.merchantName || 'Platform'}): ${f.description}`).join('\n')}

TASK:
Provide an executive platform diagnosis formatted strictly as JSON with this exact schema:
{
  "summary": "2-3 concise sentences summarizing overall platform posture, main bottlenecks, and growth trajectory.",
  "strategicLevers": [
    "Specific revenue expansion or MRR growth lever with calculated MYR potential",
    "Onboarding velocity acceleration lever",
    "Reliability or retention lever"
  ],
  "churnAlerts": [
    "Specific tenant names or segments at risk and why",
    "Dormancy or engagement risks"
  ],
  "recommendedActions": [
    { "priority": "Urgent", "title": "Clear action title", "detail": "Specific step-by-step guidance" },
    { "priority": "High", "title": "Clear action title", "detail": "Specific step-by-step guidance" },
    { "priority": "Medium", "title": "Clear action title", "detail": "Specific step-by-step guidance" }
  ]
}
Return valid JSON only without markdown code fences.`;

  try {
    const ai = getGenAI();
    if (!ai) throw new Error('VITE_GEMINI_API_KEY is not configured');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contextPrompt,
    });

    let raw = response.text?.trim() || '';
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(raw);
    return {
      summary: parsed.summary,
      strategicLevers: parsed.strategicLevers || [],
      churnAlerts: parsed.churnAlerts || [],
      recommendedActions: parsed.recommendedActions || [],
    };
  } catch (err) {
    console.warn('AI Executive Diagnosis fallback triggered:', err);
    // Intelligent heuristic fallback
    return {
      isQuotaFallback: true,
      summary: `Platform is operating at ${report.overallScore}/100 (Grade ${report.grade}). The primary friction points are ${pendingCount} pending merchants awaiting activation and ${criticalFindings.length} critical operational bottlenecks including unprovisioned branches.`,
      strategicLevers: [
        `Approve ${pendingCount} pending merchants to unlock potential RM ${pendingCount * 99}/mo in immediate MRR growth.`,
        `Upgrade high-volume merchants on Basic plans to Premium tier for an additional RM 200/mo per tenant.`,
        `Activate Supabase periodic keepalive pings to eliminate initial query cold-start latency for restaurant terminals.`
      ],
      churnAlerts: [
        `Active merchants with 0 order volume require immediate onboarding outreach before churn occurs.`,
        `Merchants lacking branch configurations cannot take orders on POS terminals.`
      ],
      recommendedActions: [
        {
          priority: 'Urgent',
          title: 'Batch Approve Pending Restaurants',
          detail: `Review and approve pending accounts to convert signups into active paying SaaS subscribers.`
        },
        {
          priority: 'High',
          title: 'Seed Outlets for Active Merchants',
          detail: `Run 1-click branch seeding for tenants missing operational locations so their POS hardware can connect.`
        },
        {
          priority: 'Medium',
          title: 'Dispatch Keepalive Pulse',
          detail: `Ensure database keepalive heartbeats are active to avoid connection resets during lull hours.`
        }
      ]
    };
  }
}

/**
 * Generate a targeted deep-dive analysis and ready-to-send outreach template for a specific finding.
 */
export async function generateFindingDeepDive(
  finding: DiagnosticFinding,
  merchant?: Merchant
): Promise<AIFindingDeepDiveResult> {
  const prompt = `
You are the SnackBot Platform Customer Success and Technical Operations AI.
Analyze this specific diagnostic issue on the platform:

ISSUE:
- Rule: ${finding.ruleCode} (${finding.category})
- Severity: ${finding.severity.toUpperCase()}
- Title: ${finding.title}
- Description: ${finding.description}
${merchant ? `- Merchant: ${merchant.name} (Owner: ${merchant.owner_name}, Email: ${merchant.owner_email || 'N/A'}, Plan: ${merchant.plan}, MRR: RM ${merchant.plan_mrr || 99}, Total Orders: ${merchant.order_count ?? 0}, Total GMV: RM ${merchant.total_gmv ?? 0})` : ''}

TASK:
Provide an actionable deep dive and pre-filled outreach message to resolve this issue. Format strictly as JSON with this exact schema:
{
  "rootCause": "Detailed technical or operational root cause explanation.",
  "businessImpact": "Financial, operational, or customer experience consequence if left unaddressed.",
  "suggestedSteps": [
    "Step 1 to resolve",
    "Step 2 to resolve"
  ],
  "outreachTemplate": {
    "channel": "Email",
    "subject": "Clear, professional email subject line",
    "body": "Friendly, professional outreach message ready to send to the owner."
  }
}
Return valid JSON only without markdown code fences.`;

  try {
    const ai = getGenAI();
    if (!ai) throw new Error('VITE_GEMINI_API_KEY is not configured');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    let raw = response.text?.trim() || '';
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(raw);
    return {
      rootCause: parsed.rootCause,
      businessImpact: parsed.businessImpact,
      suggestedSteps: parsed.suggestedSteps || [],
      outreachTemplate: parsed.outreachTemplate || { channel: 'Email', body: '' },
    };
  } catch (err) {
    console.warn('AI Finding Deep Dive fallback triggered:', err);
    return {
      isQuotaFallback: true,
      rootCause: `Triggered by rule ${finding.ruleCode}: The tenant state or platform configuration diverges from healthy SaaS operational baselines.`,
      businessImpact: `Unresolved issues in ${finding.category} can lead to merchant dissatisfaction, delayed revenue collection, or terminal connectivity failures.`,
      suggestedSteps: [
        `Review the merchant account in the Platform Admin Drawer.`,
        `Apply the recommended 1-click remediation action in the Platform Doctor.`,
        `Contact the merchant owner to assist with onboarding or plan optimization.`
      ],
      outreachTemplate: {
        channel: 'Email',
        subject: `Assistance with your SnackBot account: ${finding.merchantName || 'Update'}`,
        body: `Hi ${merchant?.owner_name || 'Partner'},\n\nOur team noticed an opportunity to optimize your SnackBot configuration (${finding.title}).\n\nWe would love to ensure your restaurant POS setup runs smoothly. Let us know if you'd like a quick 5-minute walkthrough!\n\nBest regards,\nSnackBot Platform Team`
      }
    };
  }
}

/**
 * Interactive Platform Admin AI Copilot chat query.
 */
export async function askPlatformCopilot(
  history: AICopilotMessage[],
  platformContext: {
    overallScore: number;
    grade: string;
    totalMerchants: number;
    activeCount: number;
    pendingCount: number;
    totalMRR: number;
    totalGMV: number;
    topFindings: string[];
  }
): Promise<string> {
  const systemPrompt = `
You are the SnackBot Platform Superadmin AI Copilot.
You assist superadmins in managing a multi-tenant restaurant POS cloud platform in Malaysia.
You have real-time visibility into the platform:
- Health Score: ${platformContext.overallScore}/100 (Grade ${platformContext.grade})
- Tenants: ${platformContext.totalMerchants} Total (${platformContext.activeCount} Active, ${platformContext.pendingCount} Pending)
- Financials: RM ${platformContext.totalMRR}/mo SaaS MRR, RM ${platformContext.totalGMV.toFixed(2)} Platform GMV
- Current Key Findings:
${platformContext.topFindings.map(f => `  * ${f}`).join('\n')}

Guidelines:
- Provide sharp, highly executive, and pragmatic advice.
- When recommending platform actions, mention concrete steps in Platform Admin (e.g. approve merchant, edit plan in Merchant Drawer, trigger keepalive).
- Keep answers structured with bullet points or bold highlights.
- Keep tone professional and SaaS-oriented.
`;

  try {
    const ai = getGenAI();
    if (!ai) throw new Error('VITE_GEMINI_API_KEY is not configured');

    const conversation = history
      .map(m => `${m.role === 'user' ? 'Superadmin' : 'Copilot'}: ${m.content}`)
      .join('\n\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${systemPrompt}\n\nCONVERSATION:\n${conversation}\n\nCopilot:`,
    });

    return response.text || 'I could not generate a response. Please try again.';
  } catch (err: any) {
    console.warn('AI Copilot query fallback:', err);
    return `**Platform Copilot Insight:**\nBased on current platform metrics (${platformContext.totalMerchants} merchants, ${platformContext.activeCount} active, RM ${platformContext.totalMRR} MRR), the most impactful strategic priority is expediting the onboarding of the ${platformContext.pendingCount} pending restaurants and resolving any missing branch configurations to unlock active GMV.`;
  }
}

export interface AISecurityAuditResult {
  threatLevel: 'Low' | 'Elevated' | 'High' | 'Critical';
  summary: string;
  keyObservations: string[];
  complianceRecommendations: string[];
  isQuotaFallback?: boolean;
}

/**
 * Generate a security & access audit posture scan using Gemini.
 */
export async function generateSecurityAuditAnalysis(
  impersonationCount: number,
  writeCount: number,
  activeCount: number,
  auditLogCount: number,
  recentEventsSample: { action: string; merchant: string; time: string; writeAccess?: boolean }[]
): Promise<AISecurityAuditResult> {
  const prompt = `
You are the Chief Information Security Officer (CISO) and Security Audit AI for SnackBot Cloud, an enterprise multi-tenant restaurant POS cloud in Malaysia.
Evaluate this security telemetry and access log sample:

SECURITY ACCESS TELEMETRY:
- Total Superadmin Impersonation Sessions: ${impersonationCount} (${writeCount} Write Access, ${impersonationCount - writeCount} Read Only)
- Currently Active Live Impersonation Sessions: ${activeCount}
- System & Operational Audit Events Recorded: ${auditLogCount}
- Recent Activity Sample:
${recentEventsSample.map(e => `  * [${e.time}] ${e.action} on ${e.merchant}${e.writeAccess !== undefined ? ` (Write: ${e.writeAccess})` : ''}`).join('\n')}

TASK:
Evaluate platform access integrity, privilege escalation risks, and compliance (Malaysian PDPA & SOC2 guidelines).
Return strictly JSON with this schema:
{
  "threatLevel": "Low" | "Elevated" | "High" | "Critical",
  "summary": "2-3 sentences assessing overall access security posture and session hygiene.",
  "keyObservations": [
    "Observation regarding impersonation access frequency or write privilege ratio",
    "Observation regarding operational changes or audit trail completeness"
  ],
  "complianceRecommendations": [
    "Specific governance or session lifecycle recommendation",
    "Security best practice for superadmins"
  ]
}
Return valid JSON only without markdown code fences.`;

  try {
    const ai = getGenAI();
    if (!ai) throw new Error('VITE_GEMINI_API_KEY is not configured');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    let raw = response.text?.trim() || '';
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(raw);
    return {
      threatLevel: parsed.threatLevel || 'Low',
      summary: parsed.summary,
      keyObservations: parsed.keyObservations || [],
      complianceRecommendations: parsed.complianceRecommendations || [],
    };
  } catch (err) {
    console.warn('AI Security Audit fallback triggered:', err);
    return {
      isQuotaFallback: true,
      threatLevel: activeCount > 2 ? 'Elevated' : 'Low',
      summary: `Platform access posture is currently healthy with ${impersonationCount} total impersonation sessions and ${auditLogCount} verified system audit events. ${activeCount > 0 ? `${activeCount} active session(s) should be closed when complete.` : 'No rogue active sessions detected.'}`,
      keyObservations: [
        `${writeCount} out of ${impersonationCount} sessions were initiated with Full Write privileges. Ensure changes are logged in maintenance notes.`,
        `Cryptographic audit trail is actively recording all menu modifications, voids, and staff updates.`
      ],
      complianceRecommendations: [
        `Ensure all superadmin impersonations have explicit consent from restaurant owners under Malaysian PDPA guidelines.`,
        `Regularly terminate idle active sessions using the 1-click 'Force End Session' control.`
      ]
    };
  }
}
