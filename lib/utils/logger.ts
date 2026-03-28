import { appendFileSync } from 'node:fs';
import { Temporal } from '@js-temporal/polyfill';
import { LOG_PATH } from '@lib/config/paths.js';

type LogLevel = 'info' | 'warn' | 'error';

const STRIP_ANSI = /\x1b\[[0-9;]*m/g;
let isFirstWrite = true;

function toPlain(msg: string) {
  return msg.replace(STRIP_ANSI, '');
}

function record(level: LogLevel, msg: string) {
  if (isFirstWrite) {
    const horizontalRule = '-'.repeat(80) + '\n';
    appendFileSync(LOG_PATH, horizontalRule);
    isFirstWrite = false;
  }

  const timestamp = Temporal.Now.plainDateTimeISO().toString().slice(0, 16);
  const tag = `[${level.toUpperCase()}]`.padEnd(7);
  const context = `${timestamp} ${tag} - `;
  const indent = ' '.repeat(context.length);
  const [first, ...rest] = toPlain(msg).split('\n');
  const line = [context + first, ...rest.map(l => indent + l)].join('\n');

  appendFileSync(LOG_PATH, line + '\n');
}

export const log = {
  info: (msg: string) => record('info', msg),
  warn: (msg: string) => record('warn', msg),
  error: (msg: string) => record('error', msg),
};
