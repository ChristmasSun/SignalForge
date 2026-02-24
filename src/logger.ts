interface LoggerOptions {
  json: boolean;
}

export interface LogMeta {
  [key: string]: unknown;
}

export function createLogger(options: LoggerOptions) {
  const emit = (level: 'info' | 'warn' | 'error', message: string, meta?: LogMeta): void => {
    if (options.json) {
      const payload = {
        ts: new Date().toISOString(),
        level,
        message,
        ...(meta ?? {}),
      };
      console.log(JSON.stringify(payload));
      return;
    }

    const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
    const prefix = level === 'info' ? '' : `[${level.toUpperCase()}] `;
    console.log(`${prefix}${message}${suffix}`);
  };

  return {
    info: (message: string, meta?: LogMeta) => emit('info', message, meta),
    warn: (message: string, meta?: LogMeta) => emit('warn', message, meta),
    error: (message: string, meta?: LogMeta) => emit('error', message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
