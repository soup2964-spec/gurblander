#!/usr/bin/env python3
"""
Local dashboard for Gurblander.

Features:
- Upload one MP4 from the browser
- Process with FFmpeg (strip audio/metadata, hflip + 5% zoom/crop)
- Download the cleaned result
"""

from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, flash, redirect, render_template_string, request, send_from_directory, url_for
from werkzeug.utils import secure_filename

from wash import ensure_folders, find_ffmpeg, process_file

APP_TITLE = "Gurblander Dashboard"
ALLOWED_EXTENSIONS = {".mp4"}
HTML = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{ title }}</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; }
      .card { border: 1px solid #ddd; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; }
      .btn { background: #111; color: #fff; border: 0; border-radius: 8px; padding: 0.6rem 0.9rem; cursor: pointer; }
      .muted { color: #555; font-size: 0.95rem; }
      .ok { color: #0b7a2d; }
      .err { color: #a12622; }
      ul { padding-left: 1.1rem; }
    </style>
  </head>
  <body>
    <h1>{{ title }}</h1>
    <p class="muted">Upload an MP4, process it with FFmpeg, then download the cleaned output.</p>

    {% with messages = get_flashed_messages(with_categories=true) %}
      {% if messages %}
        <div class="card">
          {% for category, message in messages %}
            <div class="{{ 'ok' if category == 'success' else 'err' }}">{{ message }}</div>
          {% endfor %}
        </div>
      {% endif %}
    {% endwith %}

    <div class="card">
      <form method="post" action="{{ url_for('upload') }}" enctype="multipart/form-data">
        <label for="ffmpeg_path">FFmpeg path (optional)</label><br />
        <input
          id="ffmpeg_path"
          name="ffmpeg_path"
          type="text"
          placeholder="C:\\path\\to\\ffmpeg.exe"
          value="{{ ffmpeg_path }}"
          style="width: 100%; margin: 0.25rem 0 0.75rem; padding: 0.5rem;"
        />
        <label for="video">Video file (.mp4)</label><br />
        <input id="video" name="video" type="file" accept=".mp4,video/mp4" required />
        <div style="margin-top: 0.8rem;">
          <button class="btn" type="submit">Upload and Process</button>
        </div>
      </form>
      <form method="post" action="{{ url_for('detect_ffmpeg') }}" style="margin-top: 0.6rem;">
        <button class="btn" type="submit">Auto-detect FFmpeg</button>
      </form>
      <p class="muted" style="margin:0.8rem 0 0;">
        FFmpeg status:
        {% if ffmpeg_resolved %}
          <span class="ok">{{ ffmpeg_resolved }}</span>
        {% else %}
          <span class="err">Not detected</span>
        {% endif %}
      </p>
    </div>

    <div class="card">
      <h3 style="margin-top: 0;">Available cleaned files</h3>
      {% if clean_files %}
        <ul>
          {% for filename in clean_files %}
            <li>
              <a href="{{ url_for('download', filename=filename) }}">{{ filename }}</a>
            </li>
          {% endfor %}
        </ul>
      {% else %}
        <p class="muted">No processed files yet.</p>
      {% endif %}
    </div>
  </body>
</html>
"""

ROOT = Path(__file__).resolve().parent
FOLDERS = ensure_folders(ROOT)
RAW_DIR = FOLDERS["raw"]
CLEAN_DIR = FOLDERS["clean"]

app = Flask(__name__)
app.secret_key = "gurblander-dev"
app.config["FFMPEG_PATH"] = ""


def _clean_files() -> list[str]:
    return sorted(p.name for p in CLEAN_DIR.iterdir() if p.is_file() and p.suffix.lower() == ".mp4")


def _detect_ffmpeg_from_common_paths() -> str | None:
    # Honor currently configured/env paths first.
    preconfigured = find_ffmpeg(app.config.get("FFMPEG_PATH", ""))
    if preconfigured:
        return preconfigured

    home = Path.home()
    local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
    program_files = Path(os.environ.get("ProgramFiles", r"C:\Program Files"))
    program_files_x86 = Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"))

    fixed_candidates = [
        Path(r"C:\ffmpeg\bin\ffmpeg.exe"),
        home / "ffmpeg" / "bin" / "ffmpeg.exe",
        local_app_data / "Microsoft" / "WinGet" / "Links" / "ffmpeg.exe",
        local_app_data / "Microsoft" / "WindowsApps" / "ffmpeg.exe",
        home / "scoop" / "apps" / "ffmpeg" / "current" / "bin" / "ffmpeg.exe",
        Path(r"C:\ProgramData\chocolatey\bin\ffmpeg.exe"),
        program_files / "ffmpeg" / "bin" / "ffmpeg.exe",
        program_files_x86 / "ffmpeg" / "bin" / "ffmpeg.exe",
    ]
    for c in fixed_candidates:
        if c.is_file():
            return str(c)

    # Check common extracted package names in Downloads.
    downloads = home / "Downloads"
    if downloads.exists():
        for pattern in ("ffmpeg*/bin/ffmpeg.exe", "*ffmpeg*/bin/ffmpeg.exe"):
            for hit in sorted(downloads.glob(pattern)):
                if hit.is_file():
                    return str(hit)

    # Winget package extraction location.
    winget_packages = local_app_data / "Microsoft" / "WinGet" / "Packages"
    if winget_packages.exists():
        for hit in sorted(winget_packages.glob("**/bin/ffmpeg.exe")):
            if hit.is_file():
                return str(hit)

    return None


@app.get("/")
def index():
    ffmpeg_override = app.config.get("FFMPEG_PATH", "")
    return render_template_string(
        HTML,
        title=APP_TITLE,
        clean_files=_clean_files(),
        ffmpeg_path=ffmpeg_override,
        ffmpeg_resolved=find_ffmpeg(ffmpeg_override),
    )


@app.post("/upload")
def upload():
    ffmpeg_override = (request.form.get("ffmpeg_path") or "").strip()
    if ffmpeg_override:
        app.config["FFMPEG_PATH"] = ffmpeg_override
    ffmpeg = find_ffmpeg(app.config.get("FFMPEG_PATH", ""))
    if not ffmpeg:
        auto = _detect_ffmpeg_from_common_paths()
        if auto:
            app.config["FFMPEG_PATH"] = auto
            ffmpeg = auto
            flash(f"Auto-detected ffmpeg: {auto}", "success")
    if not ffmpeg:
        flash(
            "FFmpeg not found. Add ffmpeg.exe path above or set GURBLANDER_FFMPEG_PATH / FFMPEG_PATH.",
            "error",
        )
        return redirect(url_for("index"))

    f = request.files.get("video")
    if not f or not f.filename:
        flash("Choose a .mp4 file first.", "error")
        return redirect(url_for("index"))

    filename = secure_filename(f.filename)
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        flash("Only .mp4 files are allowed.", "error")
        return redirect(url_for("index"))

    src = RAW_DIR / filename
    f.save(src)

    ok, message = process_file(ffmpeg, src, CLEAN_DIR)
    if not ok:
        # Clean up broken output if ffmpeg partially wrote a file.
        broken = CLEAN_DIR / filename
        if broken.exists():
            broken.unlink(missing_ok=True)
        flash(f"Processing failed: {message}", "error")
        return redirect(url_for("index"))

    flash(f"Done: {filename} -> {message}", "success")
    return redirect(url_for("index"))


@app.post("/detect-ffmpeg")
def detect_ffmpeg():
    detected = _detect_ffmpeg_from_common_paths()
    if detected:
        app.config["FFMPEG_PATH"] = detected
        flash(f"Detected ffmpeg: {detected}", "success")
    else:
        flash("Could not auto-detect ffmpeg.exe. Paste full path manually.", "error")
    return redirect(url_for("index"))


@app.get("/download/<path:filename>")
def download(filename: str):
    safe_name = Path(filename).name
    return send_from_directory(CLEAN_DIR, safe_name, as_attachment=True)


if __name__ == "__main__":
    # Dev server (local only)
    app.run(host="127.0.0.1", port=5000, debug=True)
