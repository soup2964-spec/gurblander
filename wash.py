#!/usr/bin/env python3
"""
Audio Wash — batch-process MP4 files with FFmpeg:

  Inputs (non-recursive, top-level .mp4 only):
    ./raw/
    ./cursor-uploads/   ← put Cursor/@-referenced or saved-chat files here

  For each file:
    - remove original audio and replace with generated silent AAC audio
    - strip metadata (-map_metadata -1)
    - horizontal flip plus ~5% center zoom/crop (re-encoded video)

  Outputs: ./clean/ with the same base filenames.

  Duplicate basenames across folders: earlier folder wins (`raw/` before `cursor-uploads/`).
"""

from __future__ import annotations

import argparse
import os
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

SOURCE_DIRS_DEFAULT: tuple[tuple[str, Path], ...] = (
    ("raw", Path("raw")),
    ("cursor-uploads", Path("cursor-uploads")),
)


def _valid_ffmpeg_path(path: str | None) -> str | None:
    if not path:
        return None
    p = Path(path.strip().strip('"')).expanduser()
    if p.is_file():
        return str(p)
    return None


def find_ffmpeg(explicit_path: str | None = None) -> str | None:
    """
    Resolve ffmpeg executable path.
    Priority:
      1) explicit function arg
      2) AUDIO_WASH_FFMPEG_PATH env
      3) FFMPEG_PATH env
      4) PATH lookup (ffmpeg / ffmpeg.exe)
    """
    for candidate in (
        explicit_path,
        os.getenv("AUDIO_WASH_FFMPEG_PATH"),
        os.getenv("FFMPEG_PATH"),
    ):
        resolved = _valid_ffmpeg_path(candidate)
        if resolved:
            return resolved
    return shutil.which("ffmpeg") or shutil.which("ffmpeg.exe")


def wash_one(ffmpeg: str, src: Path, dst: Path) -> subprocess.CompletedProcess[str]:
    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "warning",
        "-y",
        "-i",
        str(src.resolve()),
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-vf",
        VIDEO_FILTER,
        "-map_metadata",
        "-1",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-dn",
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "medium",
        "-profile:v",
        "main",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
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


def ensure_folders(root: Path) -> dict[str, Path]:
    """Create and return the known project folders."""
    folders = {
        "raw": root / "raw",
        "cursor_uploads": root / "cursor-uploads",
        "clean": root / "clean",
    }
    for p in folders.values():
        p.mkdir(parents=True, exist_ok=True)
    return folders


def process_file(ffmpeg: str, src: Path, clean_dir: Path) -> tuple[bool, str]:
    """
    Process one MP4 and return (ok, message).
    The output filename always includes a `_cleaned` suffix.
    """
    stem = src.stem
    if not stem.lower().endswith("_cleaned"):
        stem = f"{stem}_cleaned"
    dst = clean_dir / f"{stem}{src.suffix}"
    result = wash_one(ffmpeg, src, dst)
    if result.returncode != 0:
        return False, (result.stderr or "ffmpeg exited with errors.\n").strip()
    return True, f"clean/{dst.name}"


def collect_sources(root: Path, only: list[str] | None) -> list[tuple[str, Path]]:
    """Pairs of (relative dir label for logging, mp4 Path). Dedupe basenames."""

    defs = SOURCE_DIRS_DEFAULT
    if only is not None:
        allowed = {o.strip().strip("/").replace("\\", "/") for o in only}
        defs = tuple((name, path) for name, path in defs if path.as_posix() in allowed)
        unknown = allowed - {p.as_posix() for _, p in defs}
        for u in sorted(unknown):
            print(f"Unknown --only value: {u!r} (use raw and/or cursor-uploads)", file=sys.stderr)

    seen_key: dict[str, Path] = {}
    jobs: list[tuple[str, Path]] = []

    for label, rel in defs:
        d = root / rel
        d.mkdir(parents=True, exist_ok=True)
        for src in sorted(p for p in d.iterdir() if p.is_file() and p.suffix.lower() == ".mp4"):
            key = src.name.casefold()
            if key in seen_key:
                prior = seen_key[key]
                print(f"Skipping {src.relative_to(root)} ({src.name}); already queued from {prior.parent.name}/")
                continue
            seen_key[key] = src
            jobs.append((label, src))

    return jobs


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Strip audio / metadata and re-encode MP4s via FFmpeg.")
    p.add_argument(
        "--only",
        action="append",
        metavar="DIR",
        help="Only scan this folder (repeatable): raw | cursor-uploads (default: both).",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    root = Path(__file__).resolve().parent
    folders = ensure_folders(root)
    clean_dir = folders["clean"]

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        print("ffmpeg not found on PATH; install FFmpeg and retry.", file=sys.stderr)
        return 1

    jobs = collect_sources(root, args.only)

    if not jobs:
        print(
            "No .mp4 files found in scanned folders "
            "(put files in ./raw or ./cursor-uploads, then run again).",
        )
        return 0

    failed = False
    for label, src in jobs:
        stem = src.stem
        if not stem.lower().endswith("_cleaned"):
            stem = f"{stem}_cleaned"
        dst = clean_dir / f"{stem}{src.suffix}"
        rel = src.relative_to(root)
        print(f"[{label}] {rel} -> clean/{dst.name}")
        r = wash_one(ffmpeg, src, dst)
        if r.returncode != 0:
            failed = True
            sys.stderr.write(r.stderr or "ffmpeg exited with errors.\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
