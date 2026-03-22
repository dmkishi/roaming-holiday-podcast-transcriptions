Roaming Holiday Podcast Transcriptions
================================================================================
CLI tool that downloads episodes of the Roaming Holiday podcast by episode
number and transcribes them using OpenAI's Whisper.

Install
--------------------------------------------------------------------------------
```sh
pnpm install

# OpenAI Whisper is a Python package. (i) Create a Python venv (environment
# manager) at `.venv` then (ii) pip install into it.
python3 -m venv .venv
.venv/bin/pip install openai-whisper

# Copy the example env file and add your OpenAI API key (used to summarize
# transcriptions).
cp .env.example .env
```

Usage
--------------------------------------------------------------------------------
The command reads the RSS feed, locates the episode, downloads the MP3 to
`/tmp/`, saves a metadata sidecar, and then transcribes the episode.

```sh
# Transcribe a single or multiple episodes
pnpm transcribe 101 [102 103]

# Use a different Whisper model
pnpm transcribe 101 --model small

# Overwrite existing transcriptions
pnpm transcribe 101 --force

# Summarize a single or multiple episodes
pnpm summarize 101 [102 103]

# Summarize using a different transcription model
pnpm summarize 101 --model small

# Overwrite existing summaries
pnpm summarize 101 --force
```

Models
--------------------------------------------------------------------------------
### Transcription Models (OpenAI Whisper)
The default model is `base` and yields satisfactory results. The "Time and
Speed" figures below are from an Apple M1 machine transcribing a 1 hour episode.

| Model    | Params | Disk    | Time        | Accuracy        |
| -------- | ------ | ------- | ----------- | --------------- |
| tiny     |  39 M  |  ~75 MB |  8 m (7.5×) | Not bad         |
| base     |  74 M  | ~140 MB | 15 m (4×)   | Good enough     |
| small    | 244 M  | ~460 MB | 50 m (1.2×) | Not much better |
| medium   | 769 M  | ~1.5 GB |  ?          | ?               |
| large-v3 | 1.5 B  | ~3.0 GB |  ?          | ?               |

### Summarization Models (OpenAI)
| Model        | Input 1M | Output 1M | Tokens 1h  | Cost 1h | Accuracy  |
| ------------ | -------- | --------- | ---------- | ------- | --------- |
| GPT-4o       |    $2.50 |    $10.00 | 11,240/201 |  $0.030 | Decent    |
| GPT-4o-mini  |    $0.15 |     $0.60 | "          |  $0.018 |           |
| GPT-4.1      |    $2.00 |     $8.00 | "          |  $0.024 |           |
| GPT-4.1-mini |    $0.40 |     $1.60 | "          |  $0.005 | Very good |

See <https://developers.openai.com/api/docs/pricing>

Output Files
--------------------------------------------------------------------------------
All output goes to `transcriptions/`. For episode 179 with `--model base`:

- **Transcription**: `0179 [2026-03-18] Approaching Yinghanling in insane heat--base.json`
  Whisper's JSON output with full text, segment timestamps, and per-segment
  confidence scores.

- **Metadata sidecar**: `0179 [2026-03-18] Approaching Yinghanling in insane heat.meta.json`
  Episode metadata from the RSS feed (title, date, description, duration,
  image URL, MP3 URL). Written before transcription starts.

- **Run log**: `transcribe-20260320T120000.log`
  Per-run log capturing all CLI output, progress, errors, and the final
  summary.

MP3 Caching
--------------------------------------------------------------------------------
MP3s are downloaded to `/tmp/` (e.g., `/tmp/RH0179.mp3`). If a file already
exists with matching size, the download is skipped. This avoids re-downloading
when re-transcribing with a different model. Files in `/tmp/` are cleaned up by
the OS.
