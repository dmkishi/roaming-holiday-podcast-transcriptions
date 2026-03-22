import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const LOG_DIR = resolve(import.meta.dirname, '../logs');

export type Logger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export function createLogger(): Logger {
  mkdirSync(LOG_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const logPath = join(LOG_DIR, `${timestamp}.log`);

  const write = (level: string, msg: string) => {
    const line = `${msg}`;
    if (level === 'error' || level === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
    // Strip ANSI color codes before writing to log file
    appendFileSync(logPath, line.replace(/\x1b\[[0-9;]*m/g, '') + '\n');
  };

  return {
    info: (msg: string) => write('info', msg),
    warn: (msg: string) => write('warn', `[WARN] ${msg}`),
    error: (msg: string) => write('error', `[ERROR] ${msg}`),
  };
}
