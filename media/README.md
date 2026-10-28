# Introduction Video

This is a real-UI introduction, **not a model generation benchmark or a paid-provider demo**.
Screenshots were captured from the isolated local Alpha without a provider API key.
The two selected references are screenshots of this same workspace, not generated art.

Narration is synthesized with macOS `say` (Tingting). No external music, stock media,
customer content, production screenshots or provider credentials are included.

Requirements: macOS, FFmpeg/FFprobe, and the project's Python/Pillow environment.

```sh
uv run python media/render_launch.py
```

Outputs are ignored under `output/launch/`: landscape/portrait 1080p videos,
bilingual burned-in captions, separate Chinese/English SRT files, covers and a
SHA-256 provenance manifest. The source captures are in `docs/images/`.

On another OS, replace the local `say` call with an appropriately licensed TTS
implementation and disclose it. Do not silently substitute synthetic screens or
claim model generation that has not been verified.
