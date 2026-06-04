import { relative, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..', '..');
export const TMP_DIR = '/tmp';

export const LOG_PATH = resolve(ROOT, 'LOG');
export const OUTPUTS_DIR = resolve(ROOT, 'episodes');
export const VENV_PYTHON = resolve(ROOT, '.venv/bin/python');
export const VENV_WHISPER = resolve(ROOT, '.venv/bin/whisper_timestamped');
export const VAD_SCRIPT = resolve(ROOT, 'scripts/vad.py');
export const FADE_SCRIPT = resolve(ROOT, 'scripts/fade.py');
export const FFMPEG = 'ffmpeg';

export const SITE_DIR = resolve(ROOT, 'www/src');
export const SITE_DATA_DIR = resolve(SITE_DIR, '_data');
export const SITE_EPISODES_DIR = resolve(SITE_DIR, '_episodes');
export const SITE_IMG_DIR = resolve(SITE_DIR, 'img');
export const SITE_EPISODES_IMG_DIR = resolve(SITE_IMG_DIR, 'episodes');

export const SITE_DIST_DIR = resolve(ROOT, 'www/dist');
export const SITE_DIST_EPISODES_DIR = resolve(SITE_DIST_DIR, 'episodes');

export function episodeUrl(episodeNumber: number): string {
  return `/episodes/${episodeNumber}.html`;
}

export function toRelative(absolutePath: string): string {
  return relative(ROOT, absolutePath);
}
