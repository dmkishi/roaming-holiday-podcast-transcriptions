import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');
export const OUTPUTS_DIR = resolve(ROOT, 'episodes');
export const LOG_PATH = resolve(ROOT, 'LOG');
export const TMP_DIR = '/tmp';
export const VENV_PYTHON = resolve(ROOT, '.venv/bin/python');
export const VENV_WHISPER = resolve(ROOT, '.venv/bin/whisper');
export const SITE_DIR = resolve(ROOT, 'www/src');
export const SITE_DATA_DIR = resolve(SITE_DIR, '_data');
export const SITE_EPISODES_DIR = resolve(SITE_DIR, '_episodes');
export const SITE_IMG_DIR = resolve(SITE_DIR, 'img');
export const SITE_EPISODES_IMG_DIR = resolve(SITE_IMG_DIR, 'episodes');
