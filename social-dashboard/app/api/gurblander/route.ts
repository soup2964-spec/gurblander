import { existsSync, promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { NextResponse } from "next/server";

function cleanedName(filename: string): string {
  const ext = path.extname(filename) || ".mp4";
  const stem = path.basename(filename, ext);
  const nextStem = stem.toLowerCase().endsWith("_cleaned") ? stem : `${stem}_cleaned`;
  return `${nextStem}${ext}`;
}

function detectFfmpegPath(explicitPath?: string): string | null {
  const candidates = [
    explicitPath,
    process.env.GURBLANDER_FFMPEG_PATH,
    process.env.FFMPEG_PATH,
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WindowsApps", "ffmpeg.exe"),
    path.join(
      process.env.LOCALAPPDATA ?? "",
      "Microsoft",
      "WinGet",
      "Packages",
      "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
      "ffmpeg-8.1.1-full_build",
      "bin",
      "ffmpeg.exe"
    ),
    "ffmpeg"
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (c === "ffmpeg") return c;
    if (existsSync(c)) return c;
  }
  return null;
}

async function runFfmpeg(ffmpegPath: string, inputPath: string, outputPath: string): Promise<void> {
  const args = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-y",
    "-i",
    inputPath,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vf",
    "hflip,scale=1.05*iw:1.05*ih,crop=iw/1.05:ih/1.05,format=yuv420p",
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
    "-profile:v",
    "main",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    outputPath
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const file = data.get("video");
    const explicitFfmpeg = String(data.get("ffmpegPath") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing video upload" }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".mp4")) {
      return NextResponse.json({ error: "Only .mp4 files are supported" }, { status: 400 });
    }

    const ffmpegPath = detectFfmpegPath(explicitFfmpeg);
    if (!ffmpegPath) {
      return NextResponse.json(
        { error: "ffmpeg not found. Provide ffmpegPath or set GURBLANDER_FFMPEG_PATH." },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "tmp", "gurblander", "uploads");
    const cleanDir = path.join(process.cwd(), "tmp", "gurblander", "clean");
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(cleanDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const inputName = `${Date.now()}_${safeName}`;
    const outputName = cleanedName(inputName);
    const inputPath = path.join(uploadsDir, inputName);
    const outputPath = path.join(cleanDir, outputName);

    await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
    await runFfmpeg(ffmpegPath, inputPath, outputPath);

    return NextResponse.json({
      ok: true,
      ffmpegPath,
      inputName,
      outputName,
      downloadPath: `/api/gurblander/download?file=${encodeURIComponent(outputName)}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gurblander processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
