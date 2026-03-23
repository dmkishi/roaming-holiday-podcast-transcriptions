OpenAI Whisper (Python)
================================================================================

CLI
--------------------------------------------------------------------------------
Run whisper CLI directly:
```sh
.venv/bin/whisper --help
```

Prompt
--------------------------------------------------------------------------------
Whisper is conditioned with a three-part prompt to improve transcription
accuracy for proper nouns and place names:

1. **Base prompt** — general podcast context (author name, location, etc.) Edit
   the `BASE_PROMPT` constant in `lib/config/prompts.ts` to change this.
2. **Episode title** — from the RSS feed.
3. **Episode description** — from the RSS feed (typically lists area names
   discussed.)

**Note**: Whisper prompts are not instructional like LLMs. Instead, it is a tool
to guide the transcription style.

See: <https://developers.openai.com/cookbook/examples/whisper_prompting_guide>

Output
--------------------------------------------------------------------------------
```json
{
   "text": "Transcribed text.",
   "segments": [
    {
      "id": 0,
      "seek": 0,
      "start": 0.0,
      "end": 14.74,
      "text": " Transcribed text",
      "tokens": [ 50364, 1042, 11, 3076, 13, 286 ],
      "temperature": 0.0,
      "avg_logprob": -0.19577014446258545,
      "compression_ratio": 1.4627659574468086,
      "no_speech_prob": 0.16989535093307495
    }
   ],
   "language": "en"
}
```
