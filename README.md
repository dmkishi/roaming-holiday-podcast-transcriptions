Roaming Holiday Podcast Transcriptions
================================================================================
CLI tool that downloads and transcribes episodes of the Roaming Holiday podcast
by episode number, and builds a static site from the output.

Install
--------------------------------------------------------------------------------
```sh
pnpm install

# Create a Python venv (environment manager) at `.venv`.
python3 -m venv .venv

# pip install packages into the venv:
#
# - whisper-timestamped transcribes with word-level timestamps and confidence.
# - silero-vad detects audio and speech gaps for chunking and paragraphing.
# - essentia detects audio fades.
.venv/bin/pip install whisper-timestamped silero-vad essentia

# ffmpeg is required for audio decoding and chunking.
brew install ffmpeg
```

Transcribe
--------------------------------------------------------------------------------
Runs the full pipeline for an episode from download to paragraph sidecar. Reads
the RSS feed, downloads the MP3 to `/tmp/`, transcribes it using Whisper, and
writes a metadata sidecar and transcript to `episodes/`.

### Usage
```sh
# Transcribe a single episode, multiple episodes, or a range of episodes.
pnpm transcribe 101 [102 103] [120-129]

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
pnpm transcribe 101 --force-rss         # Re-download the RSS feed
pnpm transcribe 101 --force-download    # Re-download the MP3
pnpm transcribe 101 --force-gaps        # Re-run gap detection
pnpm transcribe 101 --force-fade        # Re-run fade detection
pnpm transcribe 101 --force-transcribe  # Re-generate the transcript
pnpm transcribe 101 --force-all
```

### Outputs
- `LOG` Per-run log capturing CLI output and errors.
- `episodes/`
  - `N.metadata.json` Episode metadata from the RSS feed.
  - `N.audio-gaps.json` Silence gaps in audio.
  - `N.transcript.json` Raw JSON output from whisper-timestamped.
  - `N.audio-fade.json` Fade-out/fade-in pairs in audio.
  - `N.transcript.paragraph.json` Transcript segmented into paragraphs and
    paragraph groups with word-level timing.
- `/tmp/`
  - `N.mp3`
  - `N.chunk-NN.mp3`
  - `N.chunk-NN.mp3.words.json`
  - `N.pcm`

Build
--------------------------------------------------------------------------------
Builds the static site from the transcription output. Reads episode metadata
and transcripts from `episodes/` and compiles them into an Eleventy site in
`www/`.

### Usage
```sh
# Build the site data and the static site using the transcription output
pnpm build-www

# Serve the site locally and watch
pnpm dev-www
```

Upload Cloudflare
--------------------------------------------------------------------------------
Upload episode markdown files to Cloudflare.

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
