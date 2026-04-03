import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

export { ROOT };
export const OUTPUTS_DIR = resolve(ROOT, 'outputs');
export const LOG_PATH = resolve(ROOT, 'LOG');
export const TMP_DIR = '/tmp';
export const VENV_PYTHON = resolve(ROOT, '.venv/bin/python');
export const VENV_WHISPER = resolve(ROOT, '.venv/bin/whisper');
export const DIST_DIR = resolve(ROOT, 'dist');
export const DIST_IMG_DIR = resolve(ROOT, 'dist/img');
export const SITE_DIR = resolve(ROOT, 'site');
export const SITE_DATA_DIR = resolve(ROOT, 'site/_data');
export const SITE_EPISODES_DIR = resolve(ROOT, 'site/_episodes');
