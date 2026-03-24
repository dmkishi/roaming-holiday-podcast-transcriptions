import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_PATH = resolve(import.meta.dirname, '../LOG');
const STRIP_ANSI = /\x1b\[[0-9;]*m/g;

export type Logger = {
  /** Console output only — show progress on-screen */
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;

  /** File output only — show events in the log file */
  record: (level: 'info' | 'warn' | 'error', msg: string, details?: Record<string, string>) => void;
};

function formatDetails(details: Record<string, string>, indent: number): string {
  const pad = ' '.repeat(indent);
  return Object.entries(details)
    .map(([key, value]) => `${pad}- ${key}: ${value}`)
    .join('\n');
}

export function createLogger(): Logger {
  // Blank line as session separator
  appendFileSync(LOG_PATH, '\n');

  return {
    info: (msg: string) => console.log(msg),
    warn: (msg: string) => console.error(`[WARN] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`),

    record: (level, msg, details) => {
      const timestamp = new Date().toISOString().slice(0, 17);
      const tag = `[${level.toUpperCase()}]`.padEnd(7);
      const prefix = `${timestamp} ${tag} - `;
      const plain = msg.replace(STRIP_ANSI, '');
      let line = `${prefix}${plain}`;

      if (details && Object.keys(details).length > 0) {
        line += '\n' + formatDetails(details, prefix.length);
      }

      appendFileSync(LOG_PATH, line + '\n');
    },
  };
}
