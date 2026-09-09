// src/lib/automation/policies.ts
import { TaskType, AutomationPolicyLevel, AutomationPolicyDecision } from './types';

/**
 * Keywords and patterns that trigger strict DENIAL.
 */
const DENIED_PATTERNS = [
  /password/i,
  /credential/i,
  /secret_key/i,
  /api_key.*extract/i,
  /token.*extract/i,
  /cookie.*extract/i,
  /auth.*bypass/i,
  /bypass.*auth/i,
  /captcha.*bypass/i,
  /bypass.*captcha/i,
  /financial.*transfer/i,
  /stripe.*charge/i,
  /credit_card/i,
  /bank.*account/i,
  /shell.*exec/i,
  /child_process/i,
  /eval\(/i,
  /powershell/i,
  /cmd\.exe/i,
  /rm -rf/i,
  /format c:/i,
  /drop table/i,
  /unrestricted.*desktop/i,
];

/**
 * Keywords and patterns that require EXPLICIT HUMAN APPROVAL before background execution.
 */
const APPROVAL_REQUIRED_PATTERNS = [
  /submit.*application/i,
  /send.*message/i,
  /send.*email/i,
  /post.*social/i,
  /upload.*file.*external/i,
  /modify.*account/i,
  /update.*external/i,
  /delete.*record/i,
  /consequential.*computer/i,
  /apply.*job/i,
];

/**
 * Evaluates whether a proposed automation task and its payload are safe, require human approval, or are denied.
 */
export function evaluateAutomationPolicy(
  taskType: TaskType,
  taskPayload: Record<string, unknown>
): AutomationPolicyDecision {
  const payloadStr = JSON.stringify(taskPayload);

  // 1. Strict DENIED Checks
  for (const pattern of DENIED_PATTERNS) {
    if (pattern.test(payloadStr) || pattern.test(taskType)) {
      return {
        level: 'DENIED',
        allowed: false,
        reason: `Task triggers prohibited security boundary: matched pattern ${pattern.source}.`,
      };
    }
  }

  // Explicit check for code injection
  if (
    taskPayload.code ||
    taskPayload.script ||
    taskPayload.eval ||
    taskPayload.command ||
    taskPayload.shell
  ) {
    return {
      level: 'DENIED',
      allowed: false,
      reason: 'Direct code or shell execution inside automation payload is prohibited.',
    };
  }

  // 2. REQUIRES_APPROVAL Checks
  for (const pattern of APPROVAL_REQUIRED_PATTERNS) {
    if (pattern.test(payloadStr) || pattern.test(taskType)) {
      return {
        level: 'REQUIRES_APPROVAL',
        allowed: true,
        reason: `Task involves consequential external actions: matched pattern ${pattern.source}.`,
        requiredApprovalAction: 'EXTERNAL_CONSEQUENTIAL_MUTATION',
      };
    }
  }

  if (taskPayload.action === 'submit' || taskPayload.submit === true) {
    return {
      level: 'REQUIRES_APPROVAL',
      allowed: true,
      reason: 'Consequential submission action requires explicit human approval.',
      requiredApprovalAction: 'EXTERNAL_SUBMIT',
    };
  }

  // If payload contains computer control action:
  if (taskPayload.computerAction) {
    const act = String(taskPayload.computerAction).toLowerCase();
    if (act === 'click' || act === 'fill' || act === 'type' || act === 'submit') {
      return {
        level: 'REQUIRES_APPROVAL',
        allowed: true,
        reason: `Computer control action '${act}' requires explicit human approval in background execution.`,
        requiredApprovalAction: `COMPUTER_CONTROL_${act.toUpperCase()}`,
      };
    }
  }

  // 3. SAFE_BACKGROUND Tasks
  switch (taskType) {
    case 'opportunity_monitor':
    case 'research_monitor':
    case 'workflow_monitor':
    case 'personal_summary':
      return {
        level: 'SAFE_BACKGROUND',
        allowed: true,
      };

    case 'custom': {
      // Safe custom tasks must be explicitly read-only or analysis
      const action = String(taskPayload.action || '').toLowerCase();
      if (
        action.includes('read') ||
        action.includes('search') ||
        action.includes('rank') ||
        action.includes('summarize') ||
        action.includes('inspect') ||
        action.includes('draft') ||
        action.includes('index')
      ) {
        return {
          level: 'SAFE_BACKGROUND',
          allowed: true,
        };
      }

      // Default safe classification if no forbidden signals
      return {
        level: 'SAFE_BACKGROUND',
        allowed: true,
      };
    }

    default:
      return {
        level: 'REQUIRES_APPROVAL',
        allowed: true,
        reason: `Unknown task type '${taskType}' requires explicit human verification.`,
      };
  }
}
