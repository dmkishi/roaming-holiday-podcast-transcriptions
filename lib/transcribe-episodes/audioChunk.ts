import { execFile, spawn } from 'node:child_process';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import type { z } from 'zod';
import type { Gap } from '#lib/transcribe-episodes/audioGaps.ts';
import { TMP_DIR, FFMPEG } from '#lib/shared/paths.ts';
import { WhisperOutputSchema } from '#lib/shared/schemas.ts';

interface ChunkSpec {
  index: number;
  startSeconds: number;
  endSeconds: number;
  path: string;
}

export interface CutPointOptions {
  targetChunkMinutes: number;
  initialWindowMinutes: number;
  maxWindowMinutes: number;
}

type WhisperSegment =
  NonNullable<z.infer<typeof WhisperOutputSchema>['segments']>[number];

interface MergedTranscript {
  text: string;
  segments: WhisperSegment[];
}

// eslint-disable-next-line typescript/strict-void-return
const execFileAsync = promisify(execFile);

/**
 * Choose cut points for chunking. Always includes 0 and totalDuration.
 *
 * For each target boundary, picks the midpoint of the longest gap within a
 * search window that widens incrementally. Falls back to a hard cut at the
 * exact target time if no gap is found.
 */
export function chooseCutPoints(
  gaps: readonly Gap[],
  totalDuration: number,
  opts: CutPointOptions,
): number[] {
  const targetChunkSeconds = opts.targetChunkMinutes * 60;

  if (totalDuration <= targetChunkSeconds) {
    return [0, totalDuration];
  }

  const cuts: number[] = [0];
  let target = targetChunkSeconds;

  while (target < totalDuration) {
    const bestGap = findBestGap(gaps, target, opts);
    const cutPoint = bestGap ? (bestGap.start + bestGap.end) / 2 : target;

    if (totalDuration - cutPoint > targetChunkSeconds * 0.1) {
      cuts.push(cutPoint);
    }

    target = cutPoint + targetChunkSeconds;
  }

  cuts.push(totalDuration);
  return cuts;
}

/**
 * Find the best gap near a target time within a given window range. Prefers the
 * longest gap; ties broken by proximity to target.
 */
function findBestGap(
  gaps: readonly Gap[],
  target: number,
  opts: CutPointOptions,
): Gap | undefined {
  const step = opts.initialWindowMinutes * 60;
  const max = opts.maxWindowMinutes * 60;
  for (let window = step; window <= max; window += step) {
    const lo = target - window;
    const hi = target + window;
    const candidates = gaps.filter((g) => g.end > lo && g.start < hi);

    if (candidates.length > 0) {
      return candidates.reduce((a, b) => {
        if (b.duration !== a.duration) return b.duration > a.duration ? b : a;
        const distA = Math.abs((a.start + a.end) / 2 - target);
        const distB = Math.abs((b.start + b.end) / 2 - target);
        return distB < distA ? b : a;
      });
    }
  }
  return undefined;
}

/**
 * Merge per-chunk Whisper JSON outputs into a single transcript. Offsets every
 * segment's (and word's) start/end by the chunk's position in the original
 * audio and reassigns sequential ids.
 */
export function mergeChunkTranscripts(
  chunks: readonly { startSeconds: number; json: unknown }[],
): MergedTranscript {
  const segments: MergedTranscript['segments'] = [];
  const texts: string[] = [];

  for (const chunk of chunks) {
    const parsed = WhisperOutputSchema.parse(chunk.json);
    if (parsed.text) {
      texts.push(parsed.text.trim());
    }
    if (parsed.segments) {
      for (const seg of parsed.segments) {
        segments.push({
          id: segments.length,
          start: seg.start + chunk.startSeconds,
          end: seg.end + chunk.startSeconds,
          text: seg.text,
          words: seg.words.map((word) => ({
            ...word,
            start: word.start + chunk.startSeconds,
            end: word.end + chunk.startSeconds,
          })),
        });
      }
    }
  }

  return { text: texts.join(' '), segments };
}

// -----------------------------------------------------------------------------
// I/O helpers
// -----------------------------------------------------------------------------
/**
 * Cut the source MP3 into chunks using ffmpeg stream copy (no re-encode).
 */
export async function splitMp3IntoChunks(
  mp3Path: string,
  cutPoints: readonly number[],
): Promise<ChunkSpec[]> {
  const base = basename(mp3Path).replace(/\.[^.]+$/u, '');
  const chunks: ChunkSpec[] = [];

  for (let i = 0; i < cutPoints.length - 1; i++) {
    const startSeconds = cutPoints[i]!;
    const endSeconds = cutPoints[i + 1]!;
    const chunkPath = join(TMP_DIR, `${base}.chunk-${String(i).padStart(2, '0')}.mp3`);

    await execFileAsync(FFMPEG, [
      '-y',
      '-ss', String(startSeconds),
      '-to', String(endSeconds),
      '-i', mp3Path,
      '-c', 'copy',
      chunkPath,
    ]);

    chunks.push({ index: i, startSeconds, endSeconds, path: chunkPath });
  }

  return chunks;
}

/**
 * Run Whisper on a single chunk MP3.
 */
export async function whisperChunk(
  chunkPath: string,
  model: string,
  prompt: string,
  whisperBin: string,
): Promise<{ jsonPath: string; exitCode: number | null }> {
  const args = [
    chunkPath,
    '--model', model,
    '--output_format', 'json',
    '--output_dir', TMP_DIR,
    '--language', 'en',
    '--verbose', 'True',
    '--initial_prompt', prompt,
    // whisper-timestamped defaults to greedy decoding; --accurate restores
    // openai-whisper's beam search + temperature fallback so transcription text
    // stays consistent with the existing corpus.
    '--accurate',
  ];

  const exitCode = await new Promise<number | null>((resolve) => {
    const proc = spawn(whisperBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.on('close', (code) => { resolve(code); });
  });

  const jsonName = basename(chunkPath) + '.words.json';
  return { jsonPath: join(TMP_DIR, jsonName), exitCode };
}
