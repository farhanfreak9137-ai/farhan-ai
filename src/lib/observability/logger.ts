import { scrubSecrets } from '@/lib/audit';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: string;
  stack?: string;
}

class StructuredLogger {
  private formatLog(level: LogLevel, message: string, context?: Record<string, unknown>, err?: unknown): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context) {
      entry.context = scrubSecrets(context) as Record<string, unknown>;
    }

    if (err instanceof Error) {
      entry.error = err.message;
      if (process.env.NODE_ENV !== 'production') {
        entry.stack = err.stack;
      }
    } else if (err) {
      entry.error = String(err);
    }

    return entry;
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      const entry = this.formatLog('debug', message, context);
      console.debug(JSON.stringify(entry));
    }
  }

  public info(message: string, context?: Record<string, unknown>): void {
    const entry = this.formatLog('info', message, context);
    console.log(JSON.stringify(entry));
  }

  public warn(message: string, context?: Record<string, unknown>, err?: unknown): void {
    const entry = this.formatLog('warn', message, context, err);
    console.warn(JSON.stringify(entry));
  }

  public error(message: string, err?: unknown, context?: Record<string, unknown>): void {
    const entry = this.formatLog('error', message, context, err);
    console.error(JSON.stringify(entry));
  }
}

export const logger = new StructuredLogger();
