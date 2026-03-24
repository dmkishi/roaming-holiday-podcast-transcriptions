import pc from 'picocolors';

export const print = {
  info: (msg = '') => console.log(msg),
  warn: (msg: string) => console.error(`${pc.yellow('[WARN]')} ${msg}`),
  error: (msg: string) => console.error(`${pc.red('[ERROR]')} ${msg}`),
};
