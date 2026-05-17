"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type WashResponse = {
  ok: boolean;
  ffmpegPath: string;
  inputName: string;
  outputName: string;
  downloadPath: string;
};

export default function AudioWashPage() {
  const [file, setFile] = useState<File | null>(null);
  const [ffmpegPath, setFfmpegPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WashResponse | null>(null);

  async function onWash() {
    setError(null);
    setResult(null);
    if (!file) {
      setError("Please choose a .mp4 file.");
      return;
    }

    setLoading(true);
    try {
      const body = new FormData();
      body.set("video", file);
      if (ffmpegPath.trim()) body.set("ffmpegPath", ffmpegPath.trim());

      const res = await fetch("/api/audio-wash", { method: "POST", body });
      const payload = (await res.json()) as WashResponse & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Audio wash failed");
      setResult(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audio wash failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <section className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-rose-900">Audio Wash Dashboard</h1>
          <a className="text-sm font-medium text-blue-700 hover:underline" href="/">
            Go to Distributor Dashboard
          </a>
        </div>
        <p className="mt-2 text-sm text-rose-700">
          Upload one MP4 and generate a cleaned output with silent AAC audio + visual transform.
        </p>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-rose-900">Video file (.mp4)</label>
            <input
              className="rounded-md border border-rose-300 bg-white px-3 py-2 text-sm"
              type="file"
              accept="video/mp4,.mp4"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-rose-900">FFmpeg path (optional)</label>
            <input
              className="rounded-md border border-rose-300 bg-white px-3 py-2 text-sm"
              placeholder="C:\\path\\to\\ffmpeg.exe"
              value={ffmpegPath}
              onChange={(e) => setFfmpegPath(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={onWash} disabled={loading}>
              {loading ? "Processing..." : "Clean Video"}
            </Button>
          </div>

          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

          {result ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p>Done: {result.outputName}</p>
              <p className="break-all text-xs text-emerald-700">FFmpeg: {result.ffmpegPath}</p>
              <a className="mt-2 inline-block font-medium text-blue-700 hover:underline" href={result.downloadPath}>
                Download cleaned file
              </a>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
