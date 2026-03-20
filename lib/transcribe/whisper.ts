import { spawn } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { SingleBar, Presets } from 'cli-progress';

const VENV_WHISPER = resolve(import.meta.dirname, '../../.venv/bin/whisper');

/**
 * The Whisper prompt is not instructional but instead provides context about
 * the style and speech patterns of the podcast. Here, we include proper nouns
 * and names to help Whisper recognize and spell them correctly.
 */
const BASE_PROMPT = `
  "Roaming Holiday" is a travel podcast by Keith McNally of Fredericton, New
  Brunswick. He travels through Asia, mainly Japan, South Korea, and Taiwan.
`.trim();

export interface TranscribeOptions {
  model: string;
  title: string;
  description: string;
}

export interface TranscribeResult {
  outputPath: string;
  wallTimeSeconds: number;
}

export function buildPrompt(title: string, description: string): string {
  return [BASE_PROMPT, title, description].filter(Boolean).join(' ');
}

export async function transcribe(
  audioPath: string,
  outputDir: string,
  durationSeconds: number,
  outputStem: string,
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

  const prompt = buildPrompt(options.title, options.description);

  const args = [
    audioPath,
    '--model', options.model,
    '--output_format', 'json',
    '--output_dir', outputDir,
    '--language', 'en',
    '--verbose', 'True',
    '--initial_prompt', prompt,
  ];

  const bar = new SingleBar(
    {
      format: 'Transcribing [{bar}] {percentage}% | {value}s / {total}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
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
          const endSec = parseTimestamp(match[1]);
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

  // Rename Whisper output to the desired filename
  const whisperOutputName = basename(audioPath).replace(/\.[^.]+$/, '') + '.json';
  const whisperOutput = join(outputDir, whisperOutputName);
  const finalOutput = join(outputDir, `${outputStem}--${options.model}.json`);

  if (existsSync(whisperOutput)) {
    renameSync(whisperOutput, finalOutput);
  }

  return {
    outputPath: finalOutput,
    wallTimeSeconds,
  };
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}
