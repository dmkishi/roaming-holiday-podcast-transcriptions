import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { Episode } from '@lib/transcribe/rss.js';

const fakeEpisode: Episode = {
  episodeNumber: 42,
  title: 'Test Episode',
  pubDate: new Date('2025-01-15'),
  description: 'A test episode',
  duration: '0:10:00',
  durationSeconds: 600,
  imageUrl: 'https://example.com/img.jpg',
  mp3Url: 'https://example.com/RH0042.mp3',
};

const fakeTranscription = JSON.stringify({
  text: 'Hello world this is a test transcription with enough words.',
  segments: [
    { id: 0, seek: 0, start: 0, end: 10, text: 'Hello world', tokens: [1], temperature: 0, avg_logprob: -0.3, compression_ratio: 1.0, no_speech_prob: 0.01 },
  ],
  language: 'en',
});

// =============================================================================
// Mocks
// =============================================================================
vi.mock('@lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@lib/transcribe/rss.js', () => ({
  fetchEpisodes: vi.fn(),
  findEpisodes: vi.fn(),
}));

vi.mock('@lib/transcribe/download.js', () => ({
  downloadMp3: vi.fn(),
}));

vi.mock('@lib/transcribe/whisper.js', () => ({
  transcribe: vi.fn(),
}));

vi.mock('@lib/transcribe/stats.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lib/transcribe/stats.js')>();
  return { ...actual };
});

vi.mock('@lib/summarize/summarizeEpisode.js', () => ({
  summarizeEpisode: vi.fn(),
}));

vi.mock('@lib/paths.js', () => ({
  TRANSCRIPTIONS_DIR: '/tmp/test-transcriptions',
  episodePaths: vi.fn(() => ({
    meta: '/tmp/test-transcriptions/042.episode-meta.json',
    transcription: '/tmp/test-transcriptions/042.transcript__base.json',
    stats: '/tmp/test-transcriptions/042.transcript__base.stats.json',
    summary: '/tmp/test-transcriptions/042.transcript__base.summary__gpt-4o.json',
  })),
  transcriptionExists: vi.fn(),
  findTranscription: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => fakeTranscription),
  };
});

// =============================================================================
// Imports (after mocks)
// =============================================================================
import { runTranscriptionPipeline, runSummarizePipeline } from '@lib/pipeline.js';
import { fetchEpisodes, findEpisodes } from '@lib/transcribe/rss.js';
import { downloadMp3 } from '@lib/transcribe/download.js';
import { transcribe } from '@lib/transcribe/whisper.js';
import { summarizeEpisode } from '@lib/summarize/summarizeEpisode.js';
import { transcriptionExists, findTranscription } from '@lib/paths.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// Transcription pipeline
// =============================================================================
describe('runTranscriptionPipeline', () => {
  test('completes full pipeline for a valid episode', async () => {
    vi.mocked(fetchEpisodes).mockResolvedValue([fakeEpisode]);
    vi.mocked(findEpisodes).mockReturnValue({ found: [fakeEpisode], notFound: [] });
    vi.mocked(transcriptionExists).mockReturnValue(false);
    vi.mocked(downloadMp3).mockResolvedValue('/tmp/RH0042.mp3');
    vi.mocked(transcribe).mockResolvedValue({ outputPath: '/tmp/test-transcriptions/042.transcript__base.json', wallTimeSeconds: 30 });

    const result = await runTranscriptionPipeline({ episodes: [42] });

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({
      status: 'completed',
      episode: 42,
      title: 'Test Episode',
      summarized: false,
    });
  });

  test('returns not_found for episodes missing from RSS feed', async () => {
    vi.mocked(fetchEpisodes).mockResolvedValue([fakeEpisode]);
    vi.mocked(findEpisodes).mockReturnValue({ found: [], notFound: [999] });

    const result = await runTranscriptionPipeline({ episodes: [999] });

    expect(result.outcomes).toEqual([{ status: 'not_found', episode: 999 }]);
  });

  test('returns skipped when transcription exists and force is false', async () => {
    vi.mocked(fetchEpisodes).mockResolvedValue([fakeEpisode]);
    vi.mocked(findEpisodes).mockReturnValue({ found: [fakeEpisode], notFound: [] });
    vi.mocked(transcriptionExists).mockReturnValue(true);

    const result = await runTranscriptionPipeline({ episodes: [42], force: false });

    expect(result.outcomes).toEqual([
      { status: 'skipped', episode: 42, reason: 'transcription already exists' },
    ]);
    expect(downloadMp3).not.toHaveBeenCalled();
  });

  test('returns download_failed when download errors', async () => {
    vi.mocked(fetchEpisodes).mockResolvedValue([fakeEpisode]);
    vi.mocked(findEpisodes).mockReturnValue({ found: [fakeEpisode], notFound: [] });
    vi.mocked(transcriptionExists).mockReturnValue(false);
    vi.mocked(downloadMp3).mockRejectedValue(new Error('network timeout'));

    const result = await runTranscriptionPipeline({ episodes: [42] });

    expect(result.outcomes).toEqual([
      { status: 'download_failed', episode: 42, error: 'network timeout' },
    ]);
  });

  test('returns transcribe_failed when transcription errors', async () => {
    vi.mocked(fetchEpisodes).mockResolvedValue([fakeEpisode]);
    vi.mocked(findEpisodes).mockReturnValue({ found: [fakeEpisode], notFound: [] });
    vi.mocked(transcriptionExists).mockReturnValue(false);
    vi.mocked(downloadMp3).mockResolvedValue('/tmp/RH0042.mp3');
    vi.mocked(transcribe).mockRejectedValue(new Error('whisper crashed'));

    const result = await runTranscriptionPipeline({ episodes: [42] });

    expect(result.outcomes).toEqual([
      { status: 'transcribe_failed', episode: 42, error: 'whisper crashed' },
    ]);
  });

  test('continues processing remaining episodes after a failure', async () => {
    const ep43: Episode = { ...fakeEpisode, episodeNumber: 43, title: 'Second Episode' };

    vi.mocked(fetchEpisodes).mockResolvedValue([fakeEpisode, ep43]);
    vi.mocked(findEpisodes).mockReturnValue({ found: [fakeEpisode, ep43], notFound: [] });
    vi.mocked(transcriptionExists).mockReturnValue(false);
    vi.mocked(downloadMp3)
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce('/tmp/RH0043.mp3');
    vi.mocked(transcribe).mockResolvedValue({ outputPath: '/tmp/test-transcriptions/043.transcript__base.json', wallTimeSeconds: 20 });

    const result = await runTranscriptionPipeline({ episodes: [42, 43] });

    const statuses = result.outcomes.map((o) => o.status);
    expect(statuses).toContain('download_failed');
    expect(statuses).toContain('completed');
  });
});

// =============================================================================
// Summarization pipeline
// =============================================================================
describe('runSummarizePipeline', () => {
  test('returns no_transcription when no transcription file exists', async () => {
    vi.mocked(findTranscription).mockReturnValue(undefined);

    const result = await runSummarizePipeline({ episodes: [42] });

    expect(result.outcomes).toEqual([{ status: 'no_transcription', episode: 42 }]);
  });

  test('returns skipped when summary already exists', async () => {
    vi.mocked(findTranscription).mockReturnValue('/tmp/test-transcriptions/042.transcript__base.json');
    vi.mocked(summarizeEpisode).mockResolvedValue({ skipped: true });

    const result = await runSummarizePipeline({ episodes: [42] });

    expect(result.outcomes).toEqual([{ status: 'skipped', episode: 42 }]);
  });

  test('returns completed with result on success', async () => {
    const summaryResult = {
      summary: 'A great episode about travel.',
      sections: [{ title: 'Exploring Japan', sentences: 'We arrived in Tokyo early.' }],
      places: ['Tokyo', 'Kyoto'],
      keywords: ['travel', 'adventure'],
    };
    vi.mocked(findTranscription).mockReturnValue('/tmp/test-transcriptions/042.transcript__base.json');
    vi.mocked(summarizeEpisode).mockResolvedValue({ skipped: false, result: summaryResult });

    const result = await runSummarizePipeline({ episodes: [42] });

    expect(result.outcomes).toEqual([{
      status: 'completed',
      episode: 42,
      result: summaryResult,
    }]);
  });

  test('returns failed when summarization errors', async () => {
    vi.mocked(findTranscription).mockReturnValue('/tmp/test-transcriptions/042.transcript__base.json');
    vi.mocked(summarizeEpisode).mockRejectedValue(new Error('API rate limited'));

    const result = await runSummarizePipeline({ episodes: [42] });

    expect(result.outcomes).toEqual([
      { status: 'failed', episode: 42, error: 'API rate limited' },
    ]);
  });
});
