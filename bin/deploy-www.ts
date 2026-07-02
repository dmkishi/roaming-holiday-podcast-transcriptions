/**
 * Publishes the built site (`www/dist`) to the `gh-pages` branch.
 */
import fs from 'node:fs';
import path from 'node:path';
import { publish } from 'gh-pages';
import { print, printLog } from '#lib/shared/print.ts';

/**
 * `@types/gh-pages` omits the `cwd` property that the runtime `Git` object
 * passed to `beforeAdd` actually carries, so patch it back in here.
 */
declare module 'gh-pages' {
  interface Git {
    cwd: string;
  }
}

const root = path.join(import.meta.dirname, '..');
const distDir = path.join(root, 'www', 'dist');

if (!fs.existsSync(distDir)) {
  printLog.error(`Build output not found at ${distDir}. Run \`pnpm www:build\` first.`);
  process.exit(1);
}

printLog.info('Deploying www/dist to gh-pages...');

try {
  await publish(distDir, {
    branch: 'gh-pages',
    dest: '.',
    history: false,
    nojekyll: true,
    message: 'chore: Deploy site',
    beforeAdd(git) {
      // Make the published branch tree exactly equal to `www/dist`.
      const keep = new Set([...fs.readdirSync(distDir), '.git', '.nojekyll']);
      for (const entry of fs.readdirSync(git.cwd)) {
        if (!keep.has(entry)) {
          fs.rmSync(path.join(git.cwd, entry), { recursive: true, force: true });
        }
      }
      return Promise.resolve(git);
    },
  });
} catch (error) {
  printLog.error(`Deploy failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

print.emptyLine();
printLog.info('Done. Deployed www/dist to gh-pages.');
