import { getConfig } from '@/lib/config';

/**
 * ARCHITECTURE NOTE:
 * This rate limiter uses an in-memory sliding-window log per client IP/key.
 * It is intentionally designed for single-node / single-instance deployment.
 * It is NOT distributed across multiple server instances (e.g. cluster/multi-pod).
 * For multi-instance scaling, a shared backing store (e.g. Redis/Valkey) would be required.
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

// Preset rate limit tiers
export const RATE_LIMIT_TIERS: Record<string, RateLimitConfig> = {
  general: { windowMs: 60_000, maxRequests: 60 },
  sensitive: { windowMs: 60_000, maxRequests: 20 },
  computer: { windowMs: 60_000, maxRequests: 20 },
  voice: { windowMs: 60_000, maxRequests: 60 },
  events: { windowMs: 60_000, maxRequests: 300 },
  health: { windowMs: 60_000, maxRequests: 120 },
  auth: { windowMs: 60_000, maxRequests: 10 },
};

// In-memory sliding log: key -> timestamp array
const requestLogs = new Map<string, number[]>();

// Last cleanup timestamp
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

function cleanupOldEntries(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, timestamps] of requestLogs.entries()) {
    // Retain timestamps within the last 5 minutes
    const valid = timestamps.filter((t) => now - t < 300_000);
    if (valid.length === 0) {
      requestLogs.delete(key);
    } else {
      requestLogs.set(key, valid);
    }
  }
}

/**
 * Safely resolves client IP address.
 * CRITICAL SECURITY REQUIREMENT:
 * Does NOT blindly trust `X-Forwarded-For` or `X-Real-IP`.
 * Only trusts forwarding headers if the immediate peer/remote address matches
 * the explicitly configured `TRUSTED_PROXIES` allowlist.
 */
export function getClientIp(req: Request, directRemoteIp?: string): string {
  const config = getConfig();
  const trustedProxies = new Set(config.trustedProxiesList);

  // If no directRemoteIp provided, try to extract from standard Node/Next socket properties
  const immediateIp = directRemoteIp || (req as any).socket?.remoteAddress || '127.0.0.1';

  // Only if the immediate connection is from an explicitly trusted proxy do we inspect forwarding headers
  if (trustedProxies.has(immediateIp)) {
    const xForwardedFor = req.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      // First IP in list is client
      const ips = xForwardedFor.split(',').map((s) => s.trim());
      if (ips[0]) return ips[0];
    }

    const xRealIp = req.headers.get('x-real-ip');
    if (xRealIp) return xRealIp.trim();
  }

  return immediateIp;
}

/**
 * Checks and records rate limit using sliding window algorithm.
 */
export function checkRateLimit(
  key: string,
  tier: RateLimitConfig = RATE_LIMIT_TIERS.general
): RateLimitResult {
  const now = Date.now();
  cleanupOldEntries(now);

  const windowStart = now - tier.windowMs;
  const existingTimestamps = requestLogs.get(key) || [];

  // Filter timestamps within current sliding window
  const activeTimestamps = existingTimestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= tier.maxRequests) {
    const oldest = activeTimestamps[0];
    const resetAt = oldest + tier.windowMs;
    return {
      allowed: false,
      limit: tier.maxRequests,
      remaining: 0,
      resetAt,
    };
  }

  // Record this request
  activeTimestamps.push(now);
  requestLogs.set(key, activeTimestamps);

  const oldest = activeTimestamps[0];
  const resetAt = oldest + tier.windowMs;

  return {
    allowed: true,
    limit: tier.maxRequests,
    remaining: Math.max(0, tier.maxRequests - activeTimestamps.length),
    resetAt,
  };
}

/**
 * Reset rate limit storage (useful in tests).
 */
export function resetRateLimits(): void {
  requestLogs.clear();
  lastCleanup = Date.now();
}
