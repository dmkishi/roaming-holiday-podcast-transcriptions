import { existsSync, statSync, writeFileSync } from 'node:fs';
import type { ToTranscribe } from '@lib/transcribe/transcript.js';

type Mp3Response =
  | {
      status: 'failed';
      error: string;
    }
  | {
      status: 'downloaded' | 'alreadyDownloaded';
      sizeMB: number;
    };

const BYTES_PER_MB = 1024 * 1024;

export async function downloadMp3(toTranscribe: ToTranscribe): Promise<Mp3Response> {
  const { mp3: { url, path } } = toTranscribe;

  if (existsSync(path)) {
    return {
      status: 'alreadyDownloaded',
      sizeMB: Math.round(statSync(path).size / BYTES_PER_MB),
    };
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        status: 'failed',
        error: `HTTP ${res.status}`,
      };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(path, buffer);

    return {
      status: 'downloaded',
      sizeMB: Math.round(buffer.byteLength / BYTES_PER_MB),
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
