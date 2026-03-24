import { spawn } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { SingleBar, Presets } from 'cli-progress';
import { BASE_PROMPT } from '@lib/config/prompts.js';
import { parseDuration } from '@lib/duration.js';

const VENV_WHISPER = resolve(import.meta.dirname, '../../.venv/bin/whisper');

export interface TranscribeOptions {
  model: string;
  title: string;
  description: string;
}

export interface TranscribeResult {
  outputPath: string;
  wallTimeSeconds: number;
}

/**
 * Make prompt for Whisper by combining the base prompt with the episode title
 * and description.
 */
export function makePrompt(title: string, description: string): string {
  return [BASE_PROMPT, title, description].filter(Boolean).join(' ');
}

/**
 * Requests OpenAI Whisper to transcribe an audio file (shows progress bar.)
 */
export async function transcribe(
  audioPath: string,
  outputPath: string,
  durationSeconds: number,
  options: TranscribeOptions,
): Promise<TranscribeResult> {
  if (!existsSync(VENV_WHISPER)) {
    throw new Error(
      `Whisper not found at ${VENV_WHISPER}\n` +
        'Set up the Python venv:\n' +
        '  python3 -m venv .venv\n' +
        '  .venv/bin/pip install openai-whisper',
    );
  }

  const args = [
    audioPath,
    '--model', options.model,
    '--output_format', 'json',
    '--output_dir', join(outputPath, '..'),
    '--language', 'en',
    '--verbose', 'True',
    '--initial_prompt', makePrompt(options.title, options.description),
  ];

  const bar = new SingleBar(
    {
      format: 'Transcribing [{bar}] {percentage}% | {value}s / {total}s',
    },
    Presets.shades_classic,
  );
  bar.start(durationSeconds, 0);

  const startTime = performance.now();

  const exitCode = await new Promise<number | null>((resolvePromise) => {
    const proc = spawn(VENV_WHISPER, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timestampRegex = /\[\d[\d:.]*\s*-->\s*(\d[\d:.]*)\]/;

    let stderrBuffer = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop()!;
      for (const line of lines) {
        const match = line.match(timestampRegex);
        if (match) {
          const endSec = parseDuration(match[1]).seconds;
          bar.update(Math.min(Math.round(endSec), durationSeconds));
        }
      }
    });

    proc.on('close', (code) => {
      bar.update(durationSeconds);
      bar.stop();
      resolvePromise(code);
    });
  });

  const wallTimeSeconds = (performance.now() - startTime) / 1000;

  if (exitCode !== 0) {
    throw new Error(`Whisper exited with code ${exitCode}`);
  }

  const outputDir = join(outputPath, '..');
  const whisperOutputName = basename(audioPath).replace(/\.[^.]+$/, '') + '.json';
  const whisperOutput = join(outputDir, whisperOutputName);
  if (existsSync(whisperOutput)) {
    renameSync(whisperOutput, outputPath);
  }

  return {
    outputPath,
    wallTimeSeconds,
  };
}
