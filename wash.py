#!/usr/bin/env python3
"""
Audio Wash — batch-process MP4 files in ./raw with FFmpeg:
  - remove audio (-an)
  - strip metadata (-map_metadata -1)
  - horizontal flip plus ~5% center zoom/crop (re-encoded video)
Writes results to ./clean with the same base filenames.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ZOOM_PERCENT = 5
VIDEO_FILTER = (
    f"hflip,scale=iw*{100 + ZOOM_PERCENT}/100:ih*{100 + ZOOM_PERCENT}/100,"
    f"crop=iw*100/(100+{ZOOM_PERCENT}):ih*100/(100+{ZOOM_PERCENT}):"
    f"(iw-iw*100/(100+{ZOOM_PERCENT}))/2:(ih-ih*100/(100+{ZOOM_PERCENT}))/2"
)


def find_ffmpeg() -> str | None:
    return shutil.which("ffmpeg")


def wash_one(ffmpeg: str, src: Path, dst: Path) -> subprocess.CompletedProcess[str]:
    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "warning",
        "-y",
        "-i",
        str(src.resolve()),
        "-vf",
        VIDEO_FILTER,
        "-an",
        "-map_metadata",
        "-1",
        "-dn",
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "medium",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(dst.resolve()),
    ]
    return subprocess.run(
        cmd,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def main() -> int:
    root = Path(__file__).resolve().parent
    raw_dir = root / "raw"
    clean_dir = root / "clean"
    raw_dir.mkdir(parents=True, exist_ok=True)
    clean_dir.mkdir(parents=True, exist_ok=True)

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        print("ffmpeg not found on PATH; install FFmpeg and retry.", file=sys.stderr)
        return 1

    inputs = sorted(p for p in raw_dir.iterdir() if p.is_file() and p.suffix.lower() == ".mp4")
    if not inputs:
        print(f"No .mp4 files in {raw_dir}. Add videos and run again.")
        return 0

    failed = False
    for src in inputs:
        dst = clean_dir / src.name
        print(f"{src.name} -> {dst.name}")
        r = wash_one(ffmpeg, src, dst)
        if r.returncode != 0:
            failed = True
            sys.stderr.write(r.stderr or "ffmpeg exited with errors.\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
