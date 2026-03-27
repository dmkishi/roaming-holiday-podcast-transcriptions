import { spawn, execFile } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { SingleBar, Presets } from 'cli-progress';
import { WHISPER_PROMPT } from '@lib/config/prompts.js';
import { parseDuration } from '@lib/duration.js';

const VENV_PYTHON = resolve(import.meta.dirname, '../../.venv/bin/python');
const VENV_WHISPER = resolve(import.meta.dirname, '../../.venv/bin/whisper');
export const PROMPT_TOKEN_LIMIT = 224;

interface TranscribeResult {
  outputPath: string;
  wallTimeSeconds: number;
}

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
 * Requests OpenAI Whisper to transcribe an audio file (shows progress bar.)
 */
export async function transcribe(opts: {
  audioPath: string;
  model: string;
  prompt: string;
  outputPath: string;
  durationSeconds: number;
}): Promise<TranscribeResult> {
  if (!existsSync(VENV_WHISPER)) {
    throw new Error(
      `Whisper not found at ${VENV_WHISPER}\n` +
        'Set up the Python venv:\n' +
        '  python3 -m venv .venv\n' +
        '  .venv/bin/pip install openai-whisper',
    );
  }

  const args = [
    opts.audioPath,
    '--model', opts.model,
    '--output_format', 'json',
    '--output_dir', join(opts.outputPath, '..'),
    '--language', 'en',
    '--verbose', 'True',
    '--initial_prompt', opts.prompt,
  ];

  const bar = new SingleBar(
    {
      format: 'Transcribing [{bar}] {percentage}% | {value}s / {total}s',
    },
    Presets.shades_classic,
  );
  bar.start(opts.durationSeconds, 0);

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
          bar.update(Math.min(Math.round(endSec), opts.durationSeconds));
        }
      }
    });

    proc.on('close', (code) => {
      bar.update(opts.durationSeconds);
      bar.stop();
      resolvePromise(code);
    });
  });

  const wallTimeSeconds = (performance.now() - startTime) / 1000;

  if (exitCode !== 0) {
    throw new Error(`Whisper exited with code ${exitCode}`);
  }

  const outputDir = join(opts.outputPath, '..');
  const whisperOutputName = basename(opts.audioPath).replace(/\.[^.]+$/, '') + '.json';
  const whisperOutput = join(outputDir, whisperOutputName);
  if (existsSync(whisperOutput)) {
    renameSync(whisperOutput, opts.outputPath);
  }

  return {
    outputPath: opts.outputPath,
    wallTimeSeconds,
  };
}
