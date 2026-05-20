Roaming Holiday Podcast Transcriptions
================================================================================
CLI tool that downloads and transcribes episodes of the Roaming Holiday podcast
by episode number, and builds a static site from the output.

Install
--------------------------------------------------------------------------------
```sh
pnpm install

# 1. Create a Python venv (environment manager) at `.venv`.
# 2. pip install into it.
#
# Packages:
#   - Silero VAD is used to split audio files into chunks before transcription.
#   - Essentia is used to detect audio fades.
python3 -m venv .venv
.venv/bin/pip install whisper-timestamped silero-vad essentia

# ffmpeg is required for audio decoding and chunking.
brew install ffmpeg
```

Usage
--------------------------------------------------------------------------------
### Transcribe
Runs the full pipeline for an episode from download to paragraph sidecar. Reads
the RSS feed, downloads the MP3 to `/tmp/`, transcribes it using Whisper, and
writes a metadata sidecar and transcript to `episodes/`.

```sh
# Transcribe a single or multiple episodes
pnpm transcribe 101 [102 103]

# Select Whisper model (default: `base`)
pnpm transcribe 101 --model small

# Skip the transcript pipeline and only re-run tail stages from existing
# transcripts. Tail stages (paragraphs, paragraph groups) always regenerate
# when they run, so they have no force flags.
pnpm transcribe 101 --only-paragraphs  # Rebuild paragraphs + groups only

# Force transcript-pipeline stages to re-run. Forcing a stage cascades to
# every downstream stage that consumes its output (rss → download → vad →
# transcribe). `--force-rss` is isolated: refetching the feed only refreshes
# metadata. Fade runs in the paragraph phase, so `--force-fade` is valid in
# `--only-paragraphs` mode; `--force-download` also cascades into fade.
pnpm transcribe 101 --force-rss         # Bypass the RSS feed ETag cache
pnpm transcribe 101 --force-download    # Re-download the MP3
pnpm transcribe 101 --force-vad         # Re-run VAD
pnpm transcribe 101 --force-fade        # Re-run fade detection
pnpm transcribe 101 --force-transcribe  # Re-generate the transcript
pnpm transcribe 101 --force-all
```

### Build Site
Builds the static site from the transcription output. Reads episode metadata
and transcripts from `episodes/` and compiles them into a Eleventy site in
`www/`.

```sh
# Build the site data and the static site using the transcription output
pnpm www:build

# Serve the site locally and watch
pnpm www:dev
```

Models
--------------------------------------------------------------------------------
### Transcription Models (OpenAI Whisper)
The default model is `base` and yields satisfactory results. The "Time and
Speed" figures below are from an Apple M1 machine transcribing a 1 hour episode.

| Model    | Params | Disk    | Time        | Accuracy        |
| -------- | ------ | ------- | ----------- | --------------- |
| tiny     |  39 M  |  ~75 MB |  8 m (7.5×) | Not bad         |
| base*    |  74 M  | ~140 MB | 15 m (4×)   | Good enough     |
| small    | 244 M  | ~460 MB | 50 m (1.2×) | Not much better |
| medium   | 769 M  | ~1.5 GB |  ?          | ?               |
| large-v3 | 1.5 B  | ~3.0 GB |  ?          | ?               |

*Default model

Output Files
--------------------------------------------------------------------------------
All output goes to `episodes/`.

- **Transcription**: `0179 [2026-03-18] Approaching Yinghanling in insane heat--base.json`
  Whisper's JSON output with full text, segment timestamps, and per-segment
  confidence scores.

- **Metadata sidecar**: `0179 [2026-03-18] Approaching Yinghanling in insane heat.meta.json`
  Episode metadata from the RSS feed (title, date, description, duration,
  image URL, MP3 URL). Written before transcription starts.

- **Run log**: `transcribe-20260320T120000.log`
  Per-run log capturing all CLI output, progress, and errors.

MP3 Caching
--------------------------------------------------------------------------------
MP3s are downloaded to `/tmp/` (e.g., `/tmp/RH0179.mp3`). If a file already
exists with matching size, the download is skipped. This avoids re-downloading
when re-transcribing with a different model. Files in `/tmp/` are cleaned up by
the OS.
