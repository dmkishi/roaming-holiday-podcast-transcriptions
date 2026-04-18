import { existsSync, statSync, writeFileSync } from 'node:fs';

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

export async function downloadMp3(
  url: string,
  path: string,
  force: boolean,
): Promise<Mp3Response> {
  if (!force && existsSync(path)) {
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
