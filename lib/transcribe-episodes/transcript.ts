import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import type { FailResponse } from '@lib/transcribe-episodes/types.js';
import {
  chooseCutPoints, splitMp3IntoChunks, whisperChunk, mergeChunkTranscripts,
} from '@lib/transcribe-episodes/audioChunk.js';
import type { Episode } from '@lib/transcribe-episodes/episode.js';
import {
  paths, hasTranscript, hasVad, readVad, writeTranscript,
} from '@lib/shared/artifacts.js';
import { fromSeconds, type Duration } from '@lib/shared/duration.js';
import { VENV_PYTHON, VENV_WHISPER } from '@lib/shared/paths.js';
import {
  CHUNK_TARGET_MINUTES, CHUNK_INITIAL_WINDOW_MINUTES, CHUNK_MAX_WINDOW_MINUTES,
} from '@lib/config/audio.js';
import { WHISPER_PROMPT } from '@lib/config/llm.js';

export interface ToTranscribe {
  episodeNumber: number;
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
}

export interface Transcript {
  ok: true;
  episodeNumber: number;
  path: string;
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
const execFileAsync = promisify(execFile);

/**
 * Count tokens a string uses in Whisper's multilingual tokenizer.
 */
async function countTokens(text: string): Promise<number> {
  const script = `
from whisper.tokenizer import get_tokenizer
t = get_tokenizer(multilingual=True)
print(len(t.encode(${JSON.stringify(text)})))
  `.trim();

  const { stdout } = await execFileAsync(VENV_PYTHON, ['-c', script]);
  return parseInt(stdout.trim(), 10);
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
    WHISPER_PROMPT.names.join(', '),
    WHISPER_PROMPT.basicInfo,
  ].filter(Boolean).join('. ').replace('..', '.');

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
  force: boolean,
): Promise<ToTranscribe | undefined> {
  if (hasTranscript(episode.episodeNumber) && !force) {
    return undefined;
  }

  const prompt = await makePrompt(episode.title, episode.description);

  return {
    episodeNumber: episode.episodeNumber,
    mp3: {
      url: episode.mp3Url,
      path: paths(episode.episodeNumber).mp3,
      audioDuration: episode.duration,
    },
    prompt: {
      payload: prompt.prompt,
      tokenCount: prompt.tokenCount,
      isOverLimit: prompt.isOverLimit,
    },
  };
}

/**
 * Runs Whisper on an episode in ~15-minute chunks split on speech gaps
 * detected by Silero VAD. Merges per-chunk outputs into a single
 * transcript with absolute timestamps and saves it to disk.
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
        '  .venv/bin/pip install openai-whisper silero-vad',
      );
    }

    // Read pre-computed VAD file for chunk splitting.
    if (!hasVad(toTranscribe.episodeNumber)) {
      return { ok: false, error: `VAD file not found for #${toTranscribe.episodeNumber}` };
    }
    const vad = readVad(toTranscribe.episodeNumber);

    const cutPoints = chooseCutPoints(vad.gaps, vad.duration, {
      targetChunkMinutes: CHUNK_TARGET_MINUTES,
      initialWindowMinutes: CHUNK_INITIAL_WINDOW_MINUTES,
      maxWindowMinutes: CHUNK_MAX_WINDOW_MINUTES,
    });

    // Whisper each chunk sequentially.
    const startTime = performance.now();
    const chunks = await splitMp3IntoChunks(toTranscribe.mp3.path, cutPoints);
    const chunkResults: { startSeconds: number; json: unknown }[] = [];

    for (const chunk of chunks) {
      const { jsonPath, exitCode } = await whisperChunk(
        chunk.path,
        model,
        toTranscribe.prompt.payload,
        VENV_WHISPER,
      );

      if (exitCode !== 0) {
        return {
          ok: false,
          error: `Whisper exited with code ${exitCode} on chunk ${chunk.index}`,
        };
      }

      if (!existsSync(jsonPath)) {
        return {
          ok: false,
          error: `Whisper output not found at ${jsonPath} for chunk ${chunk.index}`,
        };
      }

      chunkResults.push({
        startSeconds: chunk.startSeconds,
        json: JSON.parse(readFileSync(jsonPath, 'utf8')) as unknown,
      });
    }

    const workDuration = fromSeconds((performance.now() - startTime) / 1000);

    // Merge all chunk transcripts with rebased timestamps.
    const merged = mergeChunkTranscripts(chunkResults);

    if (merged.text === '') {
      return { ok: false, error: 'Whisper transcript is empty' };
    }

    const wordCount = merged.text.split(/\s+/).filter(Boolean).length;
    const characterCount = merged.text.length;

    const path = writeTranscript(toTranscribe.episodeNumber, merged);

    return {
      ok: true,
      episodeNumber: toTranscribe.episodeNumber,
      path,
      stats: {
        words: wordCount,
        characters: characterCount,
        tokenInput: toTranscribe.prompt.tokenCount,
        audioDuration: toTranscribe.mp3.audioDuration,
        workDuration,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
