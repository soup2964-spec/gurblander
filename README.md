# Audio Wash

Small utility to normalize MP4 files with FFmpeg: strips the audio track, drops container metadata mappings, mirrors the picture, and applies a subtle center zoom/crop so pixels are resampled differently from the originals. Video-only files are written next door under `clean/`.

## Requirements

- Python 3.10+
- [FFmpeg](https://ffmpeg.org/) on your `PATH`, built with libx264 (typical builds include it)

No extra Python packages are required.

## Layout

Put source files here:

```
raw/*.mp4
```

Outputs go to:

```
clean/*.mp4
```

Creating `raw` and `clean` is automatic (they are created the first time you run the script).

## What it does (per file)

| Step | FFmpeg idea |
|------|----------------|
| Strip audio | `-an` |
| Drop metadata mappings | `-map_metadata -1` |
| Horizontal mirror + ~5 % zoom crop | `-vf "hflip,scale=...,crop=..."` |

Video is re-encoded with `libx264` (`-crf 18`), `yuv420p`, and `+faststart` for `.mp4`.

## Usage

From this project folder:

```bash
python wash.py
```

Only **non-recursive** `*.mp4` files directly inside `raw/` are processed.

## GitHub

Initialize a new repository in this directory, add the tracked files, and push:

```bash
git init
git add wash.py README.md LICENSE .gitignore
git commit -m "Initial commit: Audio Wash"
```

Media folders `raw/` and `clean/` stay out of version control via `.gitignore`.

## Legal / ethics

Altering media can have legal consequences depending on jurisdiction, licensing, contracts, platform terms of service, and how you obtained the originals. Use this tool only where you have the right to process the content.

## License

Released into the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — see `LICENSE`.
