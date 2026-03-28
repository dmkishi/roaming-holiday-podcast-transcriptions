import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { FailResponse } from '@lib/types.js';
import type { Episode } from '@lib/episode.js';
import { fromSeconds, type Duration } from '@lib/utils/duration.js';
import { episodePaths, findTranscript } from '@lib/utils/paths.js';
import { WHISPER_PROMPT } from '@lib/config/llm.js';
import { TMP_DIR, VENV_PYTHON, VENV_WHISPER } from '@lib/config/paths.js';

export interface ToTranscribe {
  episodeNumber: number;
  title: string;
  description: string;
  mp3: {
    url: string;
    path: string;
    audioDuration: Duration;
  };
  prompt: {
    payload: string;
    tokenCount: number;
    isOverLimit: boolean;
  };
  path: string;
}

export interface Transcript {
  ok: true;
  episodeNumber: number;
  path: string;
  title: string;
  description: string;
  stats: {
    words: number;
    characters: number;
    tokenInput: number;
    audioDuration: Duration;
    workDuration: Duration;
  };
}

export type TranscriptResponse = FailResponse | Transcript;

export const PROMPT_TOKEN_LIMIT = 224;

/**
 * Count tokens a string uses in Whisper's multilingual tokenizer.
 */
function countTokens(text: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const script = `
from whisper.tokenizer import get_tokenizer
t = get_tokenizer(multilingual=True)
print(len(t.encode(${JSON.stringify(text)})))
    `.trim();

    execFile(VENV_PYTHON, ['-c', script], (error, stdout) => {
      if (error) return reject(error);
      resolve(parseInt(stdout.trim(), 10));
    });
  });
}

/**
 * Provide proper nouns to condition Whisper to recognize and spell them
 * correctly.
 *
 * IMPORTANT: The prompt is limited to 224 tokens and overages result in
 * truncation from the BEGINNING of the prompt. Warnings should be emitted in
 * the event of overages but, to minimize its impact, the prompt content is
 * ordered from LEAST to MOST important:
 *
 * 1. Episode title - tends to be broadly descriptive but does not always
 *      contain place names.
 * 2. Episode description - when present, is a list of place names.
 * 3. Place names
 * 4. Basic info
 */
export async function makePrompt(title: string, description?: string): Promise<{
  prompt: string;
  tokenCount: number;
  isOverLimit: boolean;
}> {
  const prompt = [
    title,
    description,
    WHISPER_PROMPT.placeNames,
    WHISPER_PROMPT.basicInfo,
  ].filter(Boolean).join(' ');

  const tokenCount = await countTokens(prompt);
  const isOverLimit = tokenCount > PROMPT_TOKEN_LIMIT;

  return { prompt, tokenCount, isOverLimit };
}

/**
 * Make a transcription request for an episode, skipping if a transcript
 * already exists (unless forced).
 */
export async function makeToTranscribe(
  episode: Episode,
  model: string,
  force: boolean,
): Promise<ToTranscribe | undefined> {
  if (!force && findTranscript(episode.episodeNumber, model)) return undefined;

  const prompt = await makePrompt(episode.title, episode.description);
  const { transcript: path } = episodePaths({ episodeNumber: episode.episodeNumber, model });

  return {
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    description: episode.description,
    mp3: {
      url: episode.mp3Url,
      path: join(TMP_DIR, basename(new URL(episode.mp3Url).pathname)),
      audioDuration: episode.duration,
    },
    prompt: {
      payload: prompt.prompt,
      tokenCount: prompt.tokenCount,
      isOverLimit: prompt.isOverLimit,
    },
    path,
  };
}

/**
 * Runs PythonOpenAI Whisper on an episode with an initial prompt and saves the
 * transcript to disk. Returns transcript metadata on success but the transcript
 * content is not returned directly and must be re-read.
 */
export async function promptTranscript(
  toTranscribe: ToTranscribe,
  model: string,
): Promise<TranscriptResponse> {
  try {
    if (!existsSync(VENV_WHISPER)) {
      throw new Error(
        `Whisper not found at ${VENV_WHISPER}\n` +
        'Set up the Python venv:\n' +
        '  python3 -m venv .venv\n' +
        '  .venv/bin/pip install openai-whisper',
      );
    }

    const args = [
      toTranscribe.mp3.path,
      '--model', model,
      '--output_format', 'json',
      '--output_dir', TMP_DIR,
      '--language', 'en',
      '--verbose', 'True',
      '--initial_prompt', toTranscribe.prompt.payload,
    ];

    const startTime = performance.now();

    const exitCode = await new Promise<number | null>((resolvePromise) => {
      const proc = spawn(VENV_WHISPER, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      proc.on('close', (code) => resolvePromise(code));
    });

    const workDuration = fromSeconds((performance.now() - startTime) / 1000);

    if (exitCode !== 0) {
      return {
        ok: false,
        error: `Whisper exited with code ${exitCode}`,
      };
    }

    const whisperOutputName = basename(toTranscribe.mp3.path).replace(/\.[^.]+$/, '') + '.json';
    const whisperOutputPath = join(TMP_DIR, whisperOutputName);

    if (!existsSync(whisperOutputPath)) {
      return {
        ok: false,
        error: `Whisper output not found at ${whisperOutputPath}`,
      };
    }

    const json = readFileSync(whisperOutputPath, 'utf-8');
    const text: string = JSON.parse(json).text ?? '';
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const characterCount = text.length;

    mkdirSync(dirname(toTranscribe.path), { recursive: true });
    writeFileSync(toTranscribe.path, json);

    return {
      ok: true,
      episodeNumber: toTranscribe.episodeNumber,
      path: toTranscribe.path,
      title: toTranscribe.title,
      description: toTranscribe.description,
      stats: {
        words: wordCount,
        characters: characterCount,
        tokenInput: toTranscribe.prompt.tokenCount,
        audioDuration: toTranscribe.mp3.audioDuration,
        workDuration,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
