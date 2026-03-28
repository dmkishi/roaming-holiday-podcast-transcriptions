import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

export { ROOT };
export const OUTPUTS_DIR = resolve(ROOT, 'outputs');
export const LOG_PATH = resolve(ROOT, 'LOG');
export const TMP_DIR = '/tmp';
export const VENV_PYTHON = resolve(ROOT, '.venv/bin/python');
export const VENV_WHISPER = resolve(ROOT, '.venv/bin/whisper');
