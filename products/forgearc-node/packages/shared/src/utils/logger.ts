export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  requestId?: string;
  [key: string]: unknown;
}

// Log level hierarchy for filtering
const LOG_LEVEL_PRIORITY: Record<string, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Level colors/symbols for local dev
const LEVEL_SYMBOLS: Record<string, string> = {
  DEBUG: '🔍',
  INFO: '✅',
  WARN: '⚠️',
  ERROR: '❌',
};

class Logger {
  private context: LogContext = {};
  private minLevel: number;
  private isLocal: boolean;

  constructor() {
    // Default to WARN in production (less verbose), INFO if explicitly set
    const configuredLevel = process.env.LOG_LEVEL?.toUpperCase() || 'WARN';
    this.minLevel = LOG_LEVEL_PRIORITY[configuredLevel] ?? LOG_LEVEL_PRIORITY.WARN;
    this.isLocal = process.env.IS_LOCAL === 'true' || process.env.AWS_SAM_LOCAL === 'true';
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= this.minLevel;
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    // Use simple format for local development
    if (this.isLocal) {
      const symbol = LEVEL_SYMBOLS[level] || '•';
      const time = new Date().toLocaleTimeString();
      let output = `${symbol} [${time}] ${message}`;

      if (data !== undefined) {
        if (typeof data === 'object' && data !== null) {
          // Format objects more readably
          const formatted = JSON.stringify(data, null, 2);
          if (formatted.length < 100) {
            output += ` ${formatted}`;
          } else {
            output += `\n${formatted}`;
          }
        } else {
          output += ` ${data}`;
        }
      }
      return output;
    }

    // JSON format for CloudWatch in production
    const logEntry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
    };
    if (data !== undefined) {
      logEntry.data = data;
    }
    return JSON.stringify(logEntry);
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, data));
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, data));
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, data));
    }
  }

  error(message: string, error?: Error | unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      let errorData: unknown;

      if (error instanceof Error) {
        // Simplified error format for local dev
        if (this.isLocal) {
          errorData = {
            type: error.name,
            message: error.message,
          };
        } else {
          errorData = { name: error.name, message: error.message, stack: error.stack };
        }
      } else {
        errorData = error;
      }

      console.error(this.formatMessage(LogLevel.ERROR, message, errorData));
    }
  }
}

export const logger = new Logger();
