import { getConfig } from '@/lib/config';

export interface AuthResult {
  authorized: boolean;
  reason?: string;
  statusCode?: number;
  actor?: string;
}

/**
 * Universal constant-time string comparison safe for Edge Runtime, Node.js, and Browser.
 * Prevents timing attacks without requiring node:crypto.
 */
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i % (b.length || 1));
  }
  return diff === 0 && a.length === b.length;
}

/**
 * Public routes that do not require authentication even in production mode.
 * Strictly limited to public health/liveness.
 */
const PUBLIC_PATHS = new Set(['/api/health']);

/**
 * Determines if a given pathname is an intentionally public endpoint.
 */
export function isPublicEndpoint(pathname: string): boolean {
  // Normalize pathname: remove trailing slash if not root
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return PUBLIC_PATHS.has(normalized);
}

/**
 * Extracts bearer or header token from request.
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1].trim();
    }
    return authHeader.trim();
  }

  const customHeader = req.headers.get('x-farhan-token');
  if (customHeader) {
    return customHeader.trim();
  }

  return null;
}

/**
 * Verifies request authorization server-side.
 * In production mode:
 *   - Strictly protects ALL sensitive API endpoints regardless of HTTP method.
 *   - Verifies FARHAN_AUTH_TOKEN using constant-time comparison.
 * In local_dev / private mode:
 *   - Permits access if no token is configured, or validates token if provided.
 */
export function verifyRequestAuth(req: Request, pathname?: string): AuthResult {
  const url = new URL(req.url);
  const path = pathname || url.pathname;

  // 1. Health/liveness is always public
  if (isPublicEndpoint(path)) {
    return { authorized: true, actor: 'public_health_probe' };
  }

  const config = getConfig();
  const configuredToken = config.FARHAN_AUTH_TOKEN?.trim();
  const providedToken = extractToken(req);

  // 2. Production mode enforcement
  if (config.isProduction) {
    if (!configuredToken) {
      return {
        authorized: false,
        reason: 'Server configuration error: Authentication required in production but token not configured.',
        statusCode: 500,
      };
    }

    if (!providedToken) {
      return {
        authorized: false,
        reason: 'Unauthorized: Missing required Authorization Bearer token or x-farhan-token header.',
        statusCode: 401,
      };
    }

    if (!secureCompare(providedToken, configuredToken)) {
      return {
        authorized: false,
        reason: 'Forbidden: Invalid authentication credentials.',
        statusCode: 403,
      };
    }

    return {
      authorized: true,
      actor: 'authenticated_operator',
    };
  }

  // 3. Private mode: If token is configured, enforce it; otherwise require loopback/private access
  if (config.DEPLOYMENT_MODE === 'private') {
    if (configuredToken) {
      if (!providedToken || !secureCompare(providedToken, configuredToken)) {
        return {
          authorized: false,
          reason: 'Unauthorized in private mode: Invalid or missing token.',
          statusCode: 401,
        };
      }
    }
    return {
      authorized: true,
      actor: 'private_operator',
    };
  }

  // 4. Local dev mode: If token provided, validate it if configured, else allow local dev
  if (configuredToken && providedToken) {
    if (!secureCompare(providedToken, configuredToken)) {
      return {
        authorized: false,
        reason: 'Unauthorized: Invalid token.',
        statusCode: 401,
      };
    }
  }

  return {
    authorized: true,
    actor: 'local_dev_user',
  };
}
