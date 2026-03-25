import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Temporal } from '@js-temporal/polyfill';

type LogLevel = 'info' | 'warn' | 'error';
type LogDetails = Record<string, string>;

const LOG_PATH = resolve(import.meta.dirname, '../LOG');
const STRIP_ANSI = /\x1b\[[0-9;]*m/g;
let isFirstWrite = true;

/**
 * Format sub-items with indentation.
 */
function formatDetails(details: LogDetails, indent: number): string {
  const pad = ' '.repeat(indent);
  return Object.entries(details)
    .map(([key, value]) => `${pad}- ${key}: ${value}`)
    .join('\n');
}

function record(level: LogLevel, msg: string, details?: LogDetails) {
  if (isFirstWrite) {
    appendFileSync(LOG_PATH, '\n');
    isFirstWrite = false;
  }

  const timestamp = Temporal.Now.plainDateTimeISO().toString().slice(0, 16);
  const tag = `[${level.toUpperCase()}]`.padEnd(7);
  const prefix = `${timestamp} ${tag} - `;
  const plain = msg.replace(STRIP_ANSI, '');
  let line = `${prefix}${plain}`;

  if (details && Object.keys(details).length > 0) {
    line += '\n' + formatDetails(details, prefix.length);
  }

  appendFileSync(LOG_PATH, line + '\n');
}

export const log = {
  info: (msg: string, details?: LogDetails) => record('info', msg, details),
  warn: (msg: string, details?: LogDetails) => record('warn', msg, details),
  error: (msg: string, details?: LogDetails) => record('error', msg, details),
};
