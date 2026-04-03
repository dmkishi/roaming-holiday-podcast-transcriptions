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
# transcripts).
cp .env.example .env
```

Usage
--------------------------------------------------------------------------------
### Transcribe
The command reads the RSS feed, locates the episode, downloads the MP3 to
`/tmp/`, saves a metadata sidecar, and then transcribes the episode.

```sh
# Transcribe a single or multiple episodes
pnpm transcribe 101 [102 103]

# Use a different Whisper transcription model
pnpm transcribe 101 --model small

# Overwrite existing transcripts
pnpm transcribe 101 --force
```

### Build Site
```sh
# Build the site data and the static site using the transcription output
pnpm site:build

# Serve the site locally and watch
pnpm site:watch
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

### Summarization Models (OpenAI)
Estimated costs per select models at one million tokens. Evaluated with episode #179 where its transcript consisted of about 47,000 characters. With a careful
prompt, token consumption was input of ~12,000 and output of ~400.

| Model        | Input | Output |  Cost |  200x | Quality   |
| ------------ | ----- | ------ | ----- | ----- | --------- |
| gpt-5.4-mini | $0.75 |  $4.50 |  ¢1.1 | $2.20 | Very good |
| gpt-4.1*     | $2.00 |  $8.00 |  ¢2.7 | $5.40 | Very good |
| gpt-4o       | $2.50 | $10.00 |  ¢3.0 | $6.00 | Decent    |
| gpt-4.1-mini | $0.40 |  $1.60 |  ¢0.6 | $1.20 | Decent    |

*Default model

Compare [pricing](https://developers.openai.com/api/docs/pricing) and [models](https://developers.openai.com/api/docs/models).

Output Files
--------------------------------------------------------------------------------
All output goes to `transcripts/`. For episode 179 with `--model base`:

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
