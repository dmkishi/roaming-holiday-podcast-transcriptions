import pc from 'picocolors';
import { log } from '#lib/shared/logger.js';

function joinLines(msg: string | string[]) {
  if (!Array.isArray(msg)) return msg;
  const lastLine = msg.length - 1;
  return msg.map((line, i) => i < lastLine ? `${line}\n` : line).join('');
}

export const print = {
  info: (msg: string) => { console.log(msg); },
  warn: (msg: string) => { console.error(`${pc.yellow('[WARN]')} ${msg}`); },
  error: (msg: string) => { console.error(`${pc.red('[ERROR]')} ${msg}`); },
  emptyLine: () => { console.log(''); },
};

export const printLog = {
  info: (msg: string | string[]) => { const m = joinLines(msg); print.info(m); log.info(m); },
  warn: (msg: string | string[]) => { const m = joinLines(msg); print.warn(m); log.warn(m); },
  error: (msg: string | string[]) => { const m = joinLines(msg); print.error(m); log.error(m); },
};
