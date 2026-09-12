import { z } from 'zod';

/** Action classification literals */
export const SafeAction = z.literal('SAFE');
export const RequiresApprovalAction = z.literal('REQUIRES_APPROVAL');
export const DenyAction = z.literal('DENY');

/** Result of policy evaluation */
export const PolicyDecisionSchema = z.object({
  allowed: z.boolean(),
  requiresApproval: z.boolean(),
  reason: z.string().optional(),
  classification: z.union([SafeAction, RequiresApprovalAction, DenyAction]),
});
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

/** Payload schemas */
export const CreateSessionPayload = z.object({});
export const NavigatePayload = z.object({ url: z.string().url() });
export const ClickPayload = z.object({ elementId: z.string() });
export const TypePayload = z.object({ elementId: z.string(), text: z.string() });
export const FillPayload = z.object({ data: z.record(z.string(), z.string()) });
export const ScrollPayload = z.object({ deltaY: z.number() });
export const WaitPayload = z.object({ ms: z.number().int().positive() });
export const ScreenshotPayload = z.object({});
export const ClosePayload = z.object({});
export const ObservePayload = z.object({});
export const GoBackPayload = z.object({});
export const GoForwardPayload = z.object({});

export const SaveSessionPayload = z.object({});
export const ExtractGigsPayload = z.object({ platform: z.string().optional() });

/** Main request schema with strict discriminated union by action */
export const ComputerActionRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('createSession'), sessionId: z.string().optional(), payload: CreateSessionPayload }),
  z.object({ action: z.literal('navigate'), sessionId: z.string().optional(), payload: NavigatePayload }),
  z.object({ action: z.literal('click'), sessionId: z.string().optional(), payload: ClickPayload }),
  z.object({ action: z.literal('type'), sessionId: z.string().optional(), payload: TypePayload }),
  z.object({ action: z.literal('fill'), sessionId: z.string().optional(), payload: FillPayload }),
  z.object({ action: z.literal('scroll'), sessionId: z.string().optional(), payload: ScrollPayload }),
  z.object({ action: z.literal('wait'), sessionId: z.string().optional(), payload: WaitPayload }),
  z.object({ action: z.literal('screenshot'), sessionId: z.string().optional(), payload: ScreenshotPayload }),
  z.object({ action: z.literal('close'), sessionId: z.string().optional(), payload: ClosePayload }),
  z.object({ action: z.literal('observe'), sessionId: z.string().optional(), payload: ObservePayload }),
  z.object({ action: z.literal('goBack'), sessionId: z.string().optional(), payload: GoBackPayload }),
  z.object({ action: z.literal('goForward'), sessionId: z.string().optional(), payload: GoForwardPayload }),
  z.object({ action: z.literal('saveSession'), sessionId: z.string().optional(), payload: SaveSessionPayload }),
  z.object({ action: z.literal('extractGigs'), sessionId: z.string().optional(), payload: ExtractGigsPayload }),
]);
export type ComputerActionRequest = z.infer<typeof ComputerActionRequestSchema>;

/**
 * Decodes an IPv4 representation (dot-decimal, octal, hex, or 32-bit integer) into 4 bytes.
 * Returns null if not a valid IPv4 address.
 */
function parseIpv4Bytes(rawHost: string): [number, number, number, number] | null {
  // Pure integer (decimal or hex)
  if (/^0x[0-9a-f]+$/i.test(rawHost)) {
    const num = parseInt(rawHost, 16);
    if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
      return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255];
    }
  }

  if (/^\d+$/.test(rawHost)) {
    const num = parseInt(rawHost, 10);
    if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
      return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255];
    }
  }

  // Dotted notation (parts may be decimal, hex 0x, or octal 0)
  const parts = rawHost.split('.');
  if (parts.length === 4) {
    const bytes: number[] = [];
    for (const part of parts) {
      let val: number;
      if (/^0x[0-9a-f]+$/i.test(part)) {
        val = parseInt(part, 16);
      } else if (/^0[0-7]+$/.test(part)) {
        val = parseInt(part, 8);
      } else if (/^\d+$/.test(part)) {
        val = parseInt(part, 10);
      } else {
        return null;
      }
      if (isNaN(val) || val < 0 || val > 255) return null;
      bytes.push(val);
    }
    return [bytes[0], bytes[1], bytes[2], bytes[3]];
  }

  return null;
}

/**
 * Checks if a host is loopback, RFC 1918 private, link-local, cloud metadata, or internal.
 */
function isPrivateOrInternalHost(rawHost: string): boolean {
  let host = rawHost.toLowerCase().trim();

  // Strip IPv6 brackets
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }

  // Hostname string checks
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal' ||
    host === 'instance-data'
  ) {
    return true;
  }

  // IPv6 checks
  if (
    host === '::1' ||
    host === '0:0:0:0:0:0:0:1' ||
    host === '::' ||
    host.startsWith('fe80:') ||
    host.startsWith('fe9') ||
    host.startsWith('fea') ||
    host.startsWith('feb') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return true;
  }

  // IPv6 mapped IPv4 (e.g. ::ffff:127.0.0.1)
  if (host.startsWith('::ffff:')) {
    const mappedIpv4 = host.replace('::ffff:', '');
    return isPrivateOrInternalHost(mappedIpv4);
  }

  // Check IPv4 forms
  const ipv4 = parseIpv4Bytes(host);
  if (ipv4) {
    const [b1, b2] = ipv4;
    // 0.0.0.0/8 (Current network)
    if (b1 === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (b1 === 127) return true;
    // 10.0.0.0/8 (Private)
    if (b1 === 10) return true;
    // 172.16.0.0/12 (Private)
    if (b1 === 172 && b2 >= 16 && b2 <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (b1 === 192 && b2 === 168) return true;
    // 169.254.0.0/16 (Link-Local & Cloud Metadata e.g. AWS/GCP 169.254.169.254)
    if (b1 === 169 && b2 === 254) return true;
    // 100.64.0.0/10 (Carrier Grade NAT)
    if (b1 === 100 && b2 >= 64 && b2 <= 127) return true;
    // 224.0.0.0/4 (Multicast / Reserved)
    if (b1 >= 224) return true;
  }

  return false;
}

/** Helper to decide if a URL is safe against policy */
export function isUrlSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Strictly require HTTP or HTTPS - block dangerous schemes (javascript:, data:, file:, vbscript:, etc.)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // CRITICAL SECURITY ENFORCEMENT:
    // Private, loopback, link-local, and cloud metadata addresses are UNCONDITIONALLY
    // blocked in ALL modes (including permissive mode) to prevent SSRF.
    if (isPrivateOrInternalHost(hostname)) {
      return false;
    }

    const rawMode = process.env.ALLOWLIST_MODE;
    const allowlistMode = (rawMode && rawMode !== 'undefined') ? rawMode : 'strict'; // strict | permissive
    const rawAllowlist = process.env.COMPUTER_ALLOWLIST;
    const allowlist = (rawAllowlist && rawAllowlist !== 'undefined')
      ? rawAllowlist.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [];

    // In strict mode, domain must match the configured allowlist
    if (allowlistMode === 'strict') {
      if (allowlist.length === 0) return false;
      const normalizedHost = hostname.replace(/^www\./, '');
      return allowlist.some((allowedDomain) => {
        const cleanAllowed = allowedDomain.replace(/^www\./, '');
        return normalizedHost === cleanAllowed || normalizedHost.endsWith(`.${cleanAllowed}`);
      });
    }

    // In permissive mode, allow any non-private, non-internal public URL
    return allowlistMode === 'permissive';
  } catch {
    return false;
  }
}

/** Evaluate request against policy */
export function evaluatePolicy(request: ComputerActionRequest): PolicyDecision {
  const supportedActions = new Set([
    'createSession',
    'navigate',
    'click',
    'type',
    'fill',
    'scroll',
    'wait',
    'screenshot',
    'close',
    'observe',
    'goBack',
    'goForward',
    'saveSession',
    'extractGigs',
  ]);

  // Actions requiring human authorization before execution
  const approvalActions = new Set(['navigate', 'click', 'type', 'fill', 'screenshot']);

  if (!supportedActions.has(request.action)) {
    return PolicyDecisionSchema.parse({
      allowed: false,
      requiresApproval: false,
      classification: 'DENY',
      reason: `Unsupported action '${request.action}'`,
    });
  }

  // URL safety check for navigation
  if (request.action === 'navigate') {
    const url = (request.payload as any)?.url as string;
    if (!url || !isUrlSafe(url)) {
      return PolicyDecisionSchema.parse({
        allowed: false,
        requiresApproval: false,
        classification: 'DENY',
        reason: 'URL not allowed by domain allowlist policy',
      });
    }
  }

  const requires = approvalActions.has(request.action);
  return PolicyDecisionSchema.parse({
    allowed: true,
    requiresApproval: requires,
    classification: requires ? 'REQUIRES_APPROVAL' : 'SAFE',
  });
}
