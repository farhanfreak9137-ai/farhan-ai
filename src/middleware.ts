import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyRequestAuth, isPublicEndpoint } from '@/lib/security/auth';
import { checkRateLimit, getClientIp, RATE_LIMIT_TIERS } from '@/lib/security/rateLimiter';
import { getConfig } from '@/lib/config';

// CSP Policy omitting legacy headers
const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const config = getConfig();

  // Determine rate limit tier
  let tier = RATE_LIMIT_TIERS.general;
  if (pathname.startsWith('/api/computer-control')) {
    tier = RATE_LIMIT_TIERS.computer;
  } else if (pathname === '/api/voice/events') {
    tier = RATE_LIMIT_TIERS.events;
  } else if (pathname.startsWith('/api/voice')) {
    tier = RATE_LIMIT_TIERS.voice;
  } else if (pathname === '/api/health') {
    tier = RATE_LIMIT_TIERS.health;
  } else if (pathname.startsWith('/api/orchestrate') || pathname.startsWith('/api/workflows')) {
    tier = RATE_LIMIT_TIERS.sensitive;
  }

  // Check rate limit
  const clientIp = getClientIp(req);
  const rateLimitResult = checkRateLimit(`${clientIp}:${tier.maxRequests}`, tier);

  if (!rateLimitResult.allowed) {
    const res = NextResponse.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        limit: rateLimitResult.limit,
        resetAt: rateLimitResult.resetAt,
      },
      { status: 429 }
    );
    res.headers.set('RateLimit-Limit', String(rateLimitResult.limit));
    res.headers.set('RateLimit-Remaining', '0');
    res.headers.set('RateLimit-Reset', String(Math.ceil(rateLimitResult.resetAt / 1000)));
    res.headers.set('Retry-After', String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)));
    return applySecurityHeaders(res, config.isProduction);
  }

  // Protect ALL sensitive API endpoints in production mode (both GET and POST/PUT/DELETE)
  // Public access is strictly limited to /api/health
  if (pathname.startsWith('/api/')) {
    const authResult = verifyRequestAuth(req, pathname);
    if (!authResult.authorized) {
      const res = NextResponse.json(
        {
          error: authResult.statusCode === 403 ? 'Forbidden' : 'Unauthorized',
          message: authResult.reason || 'Authentication required',
        },
        { status: authResult.statusCode || 401 }
      );
      return applySecurityHeaders(res, config.isProduction);
    }
  }

  // Continue request
  const response = NextResponse.next();

  // Attach rate limit headers
  response.headers.set('RateLimit-Limit', String(rateLimitResult.limit));
  response.headers.set('RateLimit-Remaining', String(rateLimitResult.remaining));
  response.headers.set('RateLimit-Reset', String(Math.ceil(rateLimitResult.resetAt / 1000)));

  return applySecurityHeaders(response, config.isProduction);
}

function applySecurityHeaders(res: NextResponse, isProduction: boolean): NextResponse {
  res.headers.set('Content-Security-Policy', CSP_HEADER);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), interest-cohort=()');

  // Modern HSTS in production
  if (isProduction) {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return res;
}

export const config = {
  matcher: [
    // Apply to all API routes
    '/api/:path*',
  ],
};
