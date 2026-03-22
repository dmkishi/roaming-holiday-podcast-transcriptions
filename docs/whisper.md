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

**Note**: Whisper prompts are not instructional like LLMs. Instead, it's better
understood as a tool to guide the style of transcription.

See: <https://developers.openai.com/cookbook/examples/whisper_prompting_guide>
