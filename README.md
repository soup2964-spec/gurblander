# Gurblander

Small utility to normalize MP4 files with FFmpeg: strips the audio track, drops container metadata mappings, mirrors the picture, and applies a subtle center zoom/crop so pixels are resampled differently from the originals. Video-only files are written under `clean/`.

## Requirements

- Python 3.10+
- [FFmpeg](https://ffmpeg.org/) on your `PATH`, built with libx264 (typical builds include it)

For the web dashboard, install:

```bash
pip install -r requirements.txt
```

## Quick Start (Dashboard)

Run a local dev server with upload + download UI:

```bash
python app.py
```

Open:

`http://127.0.0.1:5000`

Flow:

1. Upload one `.mp4`
2. Server saves it to `raw/`
3. FFmpeg processes it
4. Download from the cleaned files list (`*_cleaned.mp4`)

## CLI Layout

Source MP4 files (same folder depth as examples — **non-recursive**):

```
raw/*.mp4
cursor-uploads/*.mp4   ← Cursor / workspace hand-off (see below)
```

Outputs:

```
clean/*_cleaned.mp4
```

The script/server creates `raw/`, `cursor-uploads/`, and `clean/` if missing.

### Using this from Cursor (“uploads”)

Cursor chat and Composer attachments are **not** written to one official public “upload” path on disk. To process something you pasted or attached:

1. **Open this repo folder** (`gurblander`) as your workspace in Cursor when you’re working with files.
2. **Save or copy** the `.mp4` into **`cursor-uploads/`** inside the project — e.g. right‑click attachment → save, or `@`-reference a workspace file once it lives there like `cursor-uploads/myvideo.mp4`.
3. Run `python wash.py`.

The script scans **`raw/` first**, then **`cursor-uploads/`**. If the same filename exists in both, the copy from `raw/` is used and the other is skipped.

## What it does (per file)

| Step | FFmpeg idea |
|------|----------------|
| Scrub original audio + add silent track | `-f lavfi -i anullsrc ... -map 1:a:0 -c:a aac -shortest` |
| Drop metadata mappings | `-map_metadata -1` |
| Horizontal mirror + ~5 % zoom crop | `-vf "hflip,scale=...,crop=..."` |

Video is re-encoded with `libx264` (`-crf 18`), `yuv420p`, and `+faststart` for `.mp4`.

## Usage

From this project folder:

```bash
python wash.py
```

Scan only one side:

```bash
python wash.py --only cursor-uploads
python wash.py --only raw --only cursor-uploads
```

## GitHub

`raw/`, `clean/`, and `cursor-uploads/` are ignored — only source code/docs are tracked.

```bash
git add app.py wash.py requirements.txt README.md LICENSE .gitignore
git commit -m "Your message"
git push
```

## Legal / ethics

Altering media can have legal consequences depending on jurisdiction, licensing, contracts, platform terms of service, and how you obtained the originals. Use this tool only where you have the right to process the content.

## License

Released into the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — see `LICENSE`.
