OpenAI Whisper (Python)
================================================================================

CLI
--------------------------------------------------------------------------------
Run whisper CLI directly:
```sh
.venv/bin/whisper --help
```

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

Prompt
--------------------------------------------------------------------------------
- `lib/config/prompts.ts`
- `lib/transcribe/whisper.ts`

See <https://developers.openai.com/cookbook/examples/whisper_prompting_guide>.
