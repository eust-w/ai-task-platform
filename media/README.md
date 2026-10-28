# Introduction Video

This is a real-UI introduction, **not a model generation benchmark or a paid-provider demo**.
Screenshots were captured from the isolated local Alpha without a provider API key.
The two selected references are screenshots of this same workspace, not generated art.

Narration is synthesized with macOS `say` (Tingting). No external music, stock media,
customer content, production screenshots or provider credentials are included.

Requirements: macOS, FFmpeg/FFprobe, and the project's Python/Pillow environment.

```sh
uv run python media/render_launch.py
uv run python media/render_covers.py
```

Outputs are ignored under `output/launch/`: landscape/portrait 1080p videos,
bilingual burned-in captions, separate Chinese/English SRT files, covers and a
SHA-256 provenance manifest. The source captures are in `docs/images/`.
The second command reflows the same title and screenshot into 3:4 and 4:3 covers,
so platform cover selection does not crop the product name. It requires the macOS
Hiragino Sans GB font. Covers are separate outputs from the video manifest.

Release assets and verified watch links are listed in
[publication status](../docs/launch/publication.md).

On another OS, replace the local `say` call with an appropriately licensed TTS
implementation and disclose it. Do not silently substitute synthetic screens or
claim model generation that has not been verified.
