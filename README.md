Roaming Holiday Podcast Transcriptions
================================================================================
An end-to-end toolchain for the Roaming Holiday Podcast Transcription website.
It fetches episodes from the podcast RSS feed, transcribes them with Whisper
(word-level timestamps, speech-gap and fade detection for paragraphing), and
builds an Eleventy static site deployed to GitHub Pages at
<https://dmkishi.github.io/roaming-holiday-podcast-transcriptions/>.

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
Runs the full pipeline for an episode from download to transcript. Reads the RSS
feed, downloads the MP3 to `/tmp/`, transcribes it using Whisper, and writes an
RSS sidecar and transcript to `episodes/`.

```sh
# Transcribe a single episode, multiple episodes, or a range of episodes.
pnpm transcribe 101 [102 103] [120-129]

# Select Whisper model (default: `base`)
pnpm transcribe 101 --model small

# Skip the transcript pipeline and only re-run tail stages from existing
# transcripts. Tail stages (paragraphs, paragraph groups) always regenerate
# when they run, so they have no force flags.
#
# Note: Combining this with a transcript-stage force flag (--force-all/rss/
# download/gaps/transcribe) is rejected as a contradiction; only --force-fade is
# valid here.
pnpm transcribe 101 --only-paragraphs  # Rebuild paragraphs + groups only

# Force transcript-pipeline stages to re-run. Forcing a stage cascades to
# every downstream stage that consumes its output (rss → download → gaps →
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
  - `NNN.rss.json` Episode data from the RSS feed.
  - `NNN.audio-gaps.json` Silence gaps in audio.
  - `NNN.audio-fade.json` Fade-out/fade-in pairs in audio.
  - `NNN.transcript.json` Transcript segmented into paragraphs and paragraph
    groups with word-level timing.
- `/tmp/`
  - `NNN.mp3`
  - `NNN.pcm`
  - `NNN.chunk-NN.mp3`
  - `NNN.chunk-NN.mp3.words.json`

Build
--------------------------------------------------------------------------------
Builds the static site from the transcription output at `episodes/`. Reads
episode metadata and transcripts from `episodes/` and compiles the Eleventy site
in `www/src` into static output in `www/dist` (what the deploy publishes). After
Eleventy runs, Pagefind indexes `www/dist` to power the site's client-side
full-text search.

```sh
# Build the static site (Eleventy) and index it (Pagefind).
pnpm www:build

# Serve the site locally and watch. (Skips the Pagefind index, so search reflects
# the last `www:build` or is absent entirely until the first build.
pnpm www:dev
```

Deploy
--------------------------------------------------------------------------------
Publishes `www/dist` to the `gh-pages` branch, which GitHub Pages serves at
<https://dmkishi.github.io/roaming-holiday-podcast-transcriptions/>. The build
runs locally because CI cannot reproduce it: the `episodes/` inputs are
gitignored and too large to commit, so `www/dist` on `main` stays gitignored and
only the rendered output is published. Additionally, because the site serves
from a project-repo subpath, all internal URLs are prefixed with
`/roaming-holiday-podcast-transcriptions/`.

### One-time Setup
The repo must be **public** (GitHub Pages requires it on the free plan.)
```sh
# First publish: builds `www/dist/` locally and creates the gh-pages branch.
pnpm www:deploy

# Point GitHub Pages at the branch (needs `gh auth login`). Alternatively use
# Settings → Pages → Deploy from a branch → gh-pages / root.
gh api -X POST repos/dmkishi/roaming-holiday-podcast-transcriptions/pages \
  -f 'source[branch]=gh-pages' -f 'source[path]=/'
```

### Usage
```sh
# Builds `www/dist/` locally and force-push it to gh-pages as a single commit.
pnpm www:deploy
```

Upload Cloudflare
--------------------------------------------------------------------------------
Upload episode markdown files to Cloudflare.

Website
--------------------------------------------------------------------------------
### Analytics
<https://cloud.umami.is/analytics/us/websites/fd878e03-5c0c-4633-bee0-131855510981>

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
