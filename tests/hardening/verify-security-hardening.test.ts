import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { validateConfig, getConfigDiagnostics, resetConfigCache } from '../../src/lib/config';
import { isUrlSafe } from '../../src/lib/computer/policyEngine';
import { getClientIp, checkRateLimit, resetRateLimits, RATE_LIMIT_TIERS } from '../../src/lib/security/rateLimiter';
import { verifyRequestAuth, isPublicEndpoint } from '../../src/lib/security/auth';
import { client, ensureDatabaseReady } from '../../src/lib/db';
import { runMigrations, getAppliedMigrations } from '../../src/lib/db/migrations';
import { createDatabaseBackup, verifyDatabaseIntegrity, listBackups } from '../../src/lib/db/backup';
import { logAuditEvent, queryAuditLogs, scrubSecrets } from '../../src/lib/audit';
import { metrics } from '../../src/lib/observability/metrics';

describe('Objective 8: Production Hardening, Security, Deployment & Reliability', () => {
  before(async () => {
    await ensureDatabaseReady();
  });

  // ---------------------------------------------------------------------------
  // 1. Configuration & Secrets Validation
  // ---------------------------------------------------------------------------
  describe('1. Configuration & Secrets Validation', () => {
    test('rejects production configuration missing FARHAN_AUTH_TOKEN', () => {
      assert.throws(
        () => {
          validateConfig({
            NODE_ENV: 'production',
            DEPLOYMENT_MODE: 'production',
            FARHAN_AUTH_TOKEN: '',
          });
        },
        /FARHAN_AUTH_TOKEN is strictly required in production mode/
      );
    });

    test('rejects production configuration with weak or short FARHAN_AUTH_TOKEN', () => {
      assert.throws(
        () => {
          validateConfig({
            NODE_ENV: 'production',
            DEPLOYMENT_MODE: 'production',
            FARHAN_AUTH_TOKEN: 'short-token',
          });
        },
        /at least 16 characters long/
      );

      assert.throws(
        () => {
          validateConfig({
            NODE_ENV: 'production',
            DEPLOYMENT_MODE: 'production',
            FARHAN_AUTH_TOKEN: 'change-me-please-super-long-token',
          });
        },
        /default or weak placeholder/
      );
    });

    test('accepts valid production configuration with high-entropy token', () => {
      const cfg = validateConfig({
        NODE_ENV: 'production',
        DEPLOYMENT_MODE: 'production',
        FARHAN_AUTH_TOKEN: 'sec_f8a9e14d3b76250ca2e838194cf9b071',
        AI_PROVIDER: 'mock',
        TRUSTED_PROXIES: '127.0.0.1, 10.0.0.1',
      });
      assert.strictEqual(cfg.isProduction, true);
      assert.strictEqual(cfg.trustedProxiesList.length, 2);
      assert.ok(cfg.trustedProxiesList.includes('127.0.0.1'));
      assert.ok(cfg.trustedProxiesList.includes('10.0.0.1'));
    });

    test('getConfigDiagnostics never exposes raw secrets or tokens', () => {
      const diag = getConfigDiagnostics();
      assert.strictEqual(typeof diag.hasAuthToken, 'boolean');
      assert.strictEqual(typeof diag.hasGeminiKey, 'boolean');
      assert.strictEqual(typeof diag.hasOpenAiKey, 'boolean');
      assert.strictEqual(typeof (diag as any).FARHAN_AUTH_TOKEN, 'undefined');
      assert.strictEqual(typeof (diag as any).GEMINI_API_KEY, 'undefined');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Computer Control SSRF Protection & URL Sanitization
  // ---------------------------------------------------------------------------
  describe('2. Computer Control SSRF Hardening', () => {
    test('unconditionally blocks loopback and localhost in all modes', () => {
      // Loopbacks
      assert.strictEqual(isUrlSafe('http://localhost:3000'), false);
      assert.strictEqual(isUrlSafe('http://127.0.0.1:8080/admin'), false);
      assert.strictEqual(isUrlSafe('http://0.0.0.0:8000'), false);
      assert.strictEqual(isUrlSafe('http://[::1]/status'), false);
    });

    test('unconditionally blocks cloud metadata and instance services', () => {
      assert.strictEqual(isUrlSafe('http://169.254.169.254/latest/meta-data/'), false);
      assert.strictEqual(isUrlSafe('http://metadata.google.internal/computeMetadata/v1/'), false);
      assert.strictEqual(isUrlSafe('http://instance-data/latest/meta-data'), false);
    });

    test('unconditionally blocks RFC 1918 private subnets', () => {
      assert.strictEqual(isUrlSafe('http://10.0.0.1/internal'), false);
      assert.strictEqual(isUrlSafe('http://172.16.0.5:8080'), false);
      assert.strictEqual(isUrlSafe('http://192.168.1.1/router'), false);
    });

    test('blocks alternate IP representations (decimal integers, hex, octal)', () => {
      // Decimal representation of 127.0.0.1 = 2130706433
      assert.strictEqual(isUrlSafe('http://2130706433/'), false);
      // Hex representation of 127.0.0.1 = 0x7f000001
      assert.strictEqual(isUrlSafe('http://0x7f000001/'), false);
      // Dotted hex
      assert.strictEqual(isUrlSafe('http://0x7f.0.0.1/'), false);
    });

    test('blocks dangerous non-HTTP schemes', () => {
      assert.strictEqual(isUrlSafe('file:///etc/passwd'), false);
      assert.strictEqual(isUrlSafe('javascript:alert(1)'), false);
      assert.strictEqual(isUrlSafe('data:text/html,<b>pwned</b>'), false);
    });

    test('allows legitimate public web URLs matching allowlist or in permissive mode', () => {
      const origMode = process.env.ALLOWLIST_MODE;
      const origAllowlist = process.env.COMPUTER_ALLOWLIST;
      try {
        process.env.ALLOWLIST_MODE = 'strict';
        process.env.COMPUTER_ALLOWLIST = 'indeed.com, linkedin.com';
        assert.strictEqual(isUrlSafe('https://www.indeed.com/viewjob?jk=123'), true);
        assert.strictEqual(isUrlSafe('https://linkedin.com/jobs/search'), true);
        assert.strictEqual(isUrlSafe('https://malicious-site.com/login'), false);

        process.env.ALLOWLIST_MODE = 'permissive';
        assert.strictEqual(isUrlSafe('https://github.com/trending'), true);
        // Even in permissive mode, private IP must STILL be blocked
        assert.strictEqual(isUrlSafe('http://127.0.0.1:3000'), false);
        assert.strictEqual(isUrlSafe('http://169.254.169.254'), false);
      } finally {
        process.env.ALLOWLIST_MODE = origMode;
        process.env.COMPUTER_ALLOWLIST = origAllowlist;
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Rate Limiter & Safe Proxy Handling
  // ---------------------------------------------------------------------------
  describe('3. Rate Limiter & Proxy Security', () => {
    before(() => {
      resetRateLimits();
    });

    test('does not trust X-Forwarded-For if peer is not in TRUSTED_PROXIES', () => {
      const req = new Request('http://localhost:3000/api/orchestrate', {
        headers: {
          'x-forwarded-for': '203.0.113.195',
        },
      });

      // Direct connection peer is 198.51.100.2 (untrusted)
      const ip = getClientIp(req, '198.51.100.2');
      // Must NOT trust the spoofed 203.0.113.195; returns the direct peer IP
      assert.strictEqual(ip, '198.51.100.2');
    });

    test('sliding window rate limiter blocks requests exceeding max quota', () => {
      const tier = { windowMs: 10_000, maxRequests: 3 };
      const testKey = 'test-client-ip-rate-limit';

      // First 3 requests must be allowed
      assert.strictEqual(checkRateLimit(testKey, tier).allowed, true);
      assert.strictEqual(checkRateLimit(testKey, tier).allowed, true);
      assert.strictEqual(checkRateLimit(testKey, tier).allowed, true);

      // 4th request must be rejected
      const fourth = checkRateLimit(testKey, tier);
      assert.strictEqual(fourth.allowed, false);
      assert.strictEqual(fourth.remaining, 0);
      assert.ok(fourth.resetAt > Date.now());
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Server-Side Authentication & Endpoint Protection
  // ---------------------------------------------------------------------------
  describe('4. Authentication & Production Scope', () => {
    test('/api/health is an intentionally public endpoint', () => {
      assert.strictEqual(isPublicEndpoint('/api/health'), true);
      assert.strictEqual(isPublicEndpoint('/api/health/'), true);
      assert.strictEqual(isPublicEndpoint('/api/memory'), false);
      assert.strictEqual(isPublicEndpoint('/api/documents'), false);
      assert.strictEqual(isPublicEndpoint('/api/ready'), false);
    });

    test('verifyRequestAuth permits /api/health unconditionally', () => {
      const req = new Request('http://localhost:3000/api/health');
      const auth = verifyRequestAuth(req);
      assert.strictEqual(auth.authorized, true);
    });

    test('in production mode, rejects unauthenticated access to sensitive endpoints', () => {
      const origEnv = process.env.NODE_ENV;
      const origMode = process.env.DEPLOYMENT_MODE;
      const origToken = process.env.FARHAN_AUTH_TOKEN;

      try {
        (process.env as any).NODE_ENV = 'production';
        process.env.DEPLOYMENT_MODE = 'production';
        process.env.FARHAN_AUTH_TOKEN = 'sec_f8a9e14d3b76250ca2e838194cf9b071';
        resetConfigCache();

        // 1. Sensitive GET endpoint without token -> Rejected 401
        const unauthReq = new Request('http://localhost:3000/api/memory');
        const resUnauth = verifyRequestAuth(unauthReq);
        assert.strictEqual(resUnauth.authorized, false);
        assert.strictEqual(resUnauth.statusCode, 401);

        // 2. Sensitive endpoint with invalid token -> Rejected 403
        const wrongReq = new Request('http://localhost:3000/api/workflows', {
          headers: { Authorization: 'Bearer wrong-secret-token' },
        });
        const resWrong = verifyRequestAuth(wrongReq);
        assert.strictEqual(resWrong.authorized, false);
        assert.strictEqual(resWrong.statusCode, 403);

        // 3. Sensitive endpoint with valid token -> Allowed
        const validReq = new Request('http://localhost:3000/api/documents', {
          headers: { Authorization: 'Bearer sec_f8a9e14d3b76250ca2e838194cf9b071' },
        });
        const resValid = verifyRequestAuth(validReq);
        assert.strictEqual(resValid.authorized, true);

        // 4. Custom header x-farhan-token also works
        const customHeaderReq = new Request('http://localhost:3000/api/ready', {
          headers: { 'x-farhan-token': 'sec_f8a9e14d3b76250ca2e838194cf9b071' },
        });
        const resCustom = verifyRequestAuth(customHeaderReq);
        assert.strictEqual(resCustom.authorized, true);
      } finally {
        (process.env as any).NODE_ENV = origEnv;
        process.env.DEPLOYMENT_MODE = origMode;
        process.env.FARHAN_AUTH_TOKEN = origToken;
        resetConfigCache();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Database Migrations & Version Tracking
  // ---------------------------------------------------------------------------
  describe('5. Database Migrations Tracking', () => {
    test('tracks real baseline schema and versioned migrations in schema_migrations', async () => {
      const applied = await getAppliedMigrations(client);
      assert.ok(applied.length >= 2, 'Must have at least baseline and audit migrations applied');

      const ids = applied.map((m) => m.id);
      assert.ok(ids.includes('001_baseline_schema'), '001_baseline_schema must be recorded');
      assert.ok(ids.includes('002_audit_logs'), '002_audit_logs must be recorded');
    });

    test('migration runner is idempotent and safe to re-execute', async () => {
      const result = await runMigrations(client);
      assert.strictEqual(result.alreadyUpToDate, true);
      assert.strictEqual(result.applied.length, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Database Backup, Integrity & Recovery
  // ---------------------------------------------------------------------------
  describe('6. Database Backup & Integrity Check', () => {
    test('database passes PRAGMA integrity_check', async () => {
      const integrity = await verifyDatabaseIntegrity(client);
      assert.strictEqual(integrity.ok, true);
      assert.strictEqual(integrity.result.toLowerCase(), 'ok');
    });

    test('creates verified backup with WAL checkpointing and checksum', async () => {
      const backup = await createDatabaseBackup({ maxRetained: 5 });
      assert.ok(backup.id.startsWith('backup-'));
      assert.ok(backup.filename.endsWith('.db'));
      assert.strictEqual(backup.integrityVerified, true);
      assert.strictEqual(typeof backup.checksum, 'string');
      assert.strictEqual(backup.checksum.length, 64); // SHA-256 hex length
      assert.ok(backup.sizeBytes > 0);

      const allBackups = listBackups();
      assert.ok(allBackups.length > 0);
      assert.ok(allBackups.some((b) => b.filename === backup.filename));
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Append-Only Audit Logging & Secret Scrubbing
  // ---------------------------------------------------------------------------
  describe('7. Audit Logging & Secret Scrubbing', () => {
    test('scrubSecrets removes sensitive credentials recursively', () => {
      const dirty = {
        user: 'farhan',
        apiKey: 'sk-1234567890abcdef',
        nested: {
          password: 'supersecretpassword',
          farhanAuthToken: 'my-token',
          safeField: 42,
        },
        items: [{ token: 'abc' }, { label: 'normal' }],
      };

      const clean = scrubSecrets(dirty) as any;
      assert.strictEqual(clean.user, 'farhan');
      assert.strictEqual(clean.apiKey, '[REDACTED]');
      assert.strictEqual(clean.nested.password, '[REDACTED]');
      assert.strictEqual(clean.nested.farhanAuthToken, '[REDACTED]');
      assert.strictEqual(clean.nested.safeField, 42);
      assert.strictEqual(clean.items[0].token, '[REDACTED]');
      assert.strictEqual(clean.items[1].label, 'normal');
    });

    test('persists audit event to SQLite and retrieves via queryAuditLogs', async () => {
      const testActor = `test_operator_${Date.now()}`;
      await logAuditEvent({
        eventType: 'approval_granted',
        actor: testActor,
        action: 'test_action_execution',
        status: 'SUCCESS',
        details: { actionId: 'act-123', secretToken: 'should-be-scrubbed' },
      });

      const logs = await queryAuditLogs({ actor: testActor, limit: 1 });
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].actor, testActor);
      assert.strictEqual(logs[0].eventType, 'approval_granted');
      assert.strictEqual(logs[0].status, 'SUCCESS');
      assert.strictEqual(logs[0].details?.secretToken, '[REDACTED]');
      assert.strictEqual(logs[0].details?.actionId, 'act-123');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Observability & Metrics
  // ---------------------------------------------------------------------------
  describe('8. Observability & Metrics Collection', () => {
    test('records requests, statuses, and agent executions accurately', () => {
      metrics.recordRequest('/api/health', 200, 5);
      metrics.recordRequest('/api/orchestrate', 400, 25);
      metrics.recordAgentRun('career-agent', true);
      metrics.recordAgentRun('career-agent', false);

      const summary = metrics.getSummary();
      assert.ok(summary.totalRequests >= 2);
      assert.ok(summary.totalErrors >= 1);
      assert.strictEqual(summary.requestsByStatus['200'] >= 1, true);
      assert.strictEqual(summary.requestsByStatus['400'] >= 1, true);
      assert.ok(summary.agentRuns['career-agent'].total >= 2);
      assert.ok(summary.agentRuns['career-agent'].successful >= 1);
      assert.ok(summary.agentRuns['career-agent'].failed >= 1);
    });
  });
});
