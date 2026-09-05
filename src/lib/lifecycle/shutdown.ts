import { client } from '@/lib/db';
import { playwrightComputerProvider } from '@/lib/computer/playwrightProvider';
import { logAuditEvent } from '@/lib/audit';
import { logger } from '@/lib/observability/logger';

export interface ShutdownReport {
  timestamp: string;
  walFlushed: boolean;
  browserClosed: boolean;
  auditLogged: boolean;
}

let isShuttingDown = false;
let handlersRegistered = false;

/**
 * Executes graceful shutdown procedure.
 */
export async function performGracefulShutdown(signal: string = 'MANUAL'): Promise<ShutdownReport> {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress, ignoring signal: ${signal}`);
    return {
      timestamp: new Date().toISOString(),
      walFlushed: false,
      browserClosed: false,
      auditLogged: false,
    };
  }

  isShuttingDown = true;
  logger.info(`[Lifecycle] Initiating graceful shutdown (signal: ${signal})...`);

  let walFlushed = false;
  let browserClosed = false;
  let auditLogged = false;

  // 1. Log audit event
  try {
    await logAuditEvent({
      eventType: 'system_shutdown',
      actor: 'system_lifecycle',
      action: `graceful_shutdown_${signal}`,
      status: 'SUCCESS',
      details: { signal, timestamp: new Date().toISOString() },
    });
    auditLogged = true;
  } catch (err) {
    logger.warn('Failed to log audit event during shutdown', {}, err);
  }

  // 2. Close active browser sessions and terminate Chromium
  try {
    await playwrightComputerProvider.closeBrowser();
    browserClosed = true;
    logger.info('[Lifecycle] Browser processes cleanly terminated.');
  } catch (err) {
    logger.warn('Failed to close browser sessions during shutdown', {}, err);
  }

  // 3. Flush SQLite WAL checkpoint
  try {
    await client.execute('PRAGMA wal_checkpoint(TRUNCATE);');
    walFlushed = true;
    logger.info('[Lifecycle] SQLite WAL successfully checkpointed and truncated.');
  } catch (err) {
    logger.warn('Failed to checkpoint SQLite WAL during shutdown', {}, err);
  }

  const report: ShutdownReport = {
    timestamp: new Date().toISOString(),
    walFlushed,
    browserClosed,
    auditLogged,
  };

  logger.info('[Lifecycle] Graceful shutdown completed.', report as unknown as Record<string, unknown>);
  return report;
}

/**
 * Registers process signal handlers (SIGTERM, SIGINT).
 */
export function registerShutdownHandlers(): void {
  if (handlersRegistered || process.env.NODE_ENV === 'test') return;
  handlersRegistered = true;

  const handleSignal = async (sig: string) => {
    logger.info(`Received ${sig}, starting graceful shutdown...`);
    try {
      await performGracefulShutdown(sig);
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));
}
