import { promises as fs } from "fs";
import path from "path";
import { chromium, type Page } from "playwright";
import { NextResponse } from "next/server";
import { loadProfiles, type Platform, type Profile } from "@/lib/profiles";

const ADS_POWER_BASE = "http://local.adspower.net:50325/api/v1/browser";

type DeploymentLog = {
  profileId: string;
  accountName: string;
  platform: Platform;
  status: "success" | "failed";
  message: string;
};

async function uploadToPlatform(page: Page, platform: Platform, videoPath: string, caption: string) {
  // Placeholder for real automation selectors/workflows per platform.
  await page.goto("about:blank");
  await page.setContent(
    `<html><body><pre>${JSON.stringify(
      { platform, videoPath, caption },
      null,
      2
    )}</pre></body></html>`
  );
}

function extractWsEndpoint(startPayload: unknown): string | null {
  const payload = startPayload as
    | { data?: { ws?: { puppeteer?: string } | string }; ws?: { puppeteer?: string } | string }
    | undefined;
  const fromData = payload?.data?.ws;
  const fromTop = payload?.ws;

  const pick = (value: unknown): string | null => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "puppeteer" in value) {
      const v = (value as { puppeteer?: unknown }).puppeteer;
      return typeof v === "string" ? v : null;
    }
    return null;
  };

  return pick(fromData) ?? pick(fromTop);
}

async function stopAdsPowerProfile(profileId: string) {
  const stopURL = new URL(`${ADS_POWER_BASE}/stop`);
  stopURL.searchParams.set("user_id", profileId);
  await fetch(stopURL.toString(), { method: "GET", cache: "no-store" });
}

async function saveUploadedVideo(file: File): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "tmp", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = path.extname(file.name) || ".mp4";
  const base = path.basename(file.name, ext).replace(/[^a-zA-Z0-9-_]/g, "_");
  const fileName = `${Date.now()}_${base}${ext}`;
  const fullPath = path.join(uploadsDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);
  return fullPath;
}

function parseProfileIds(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("video");
    const caption = String(formData.get("caption") ?? "");
    const selectedIds = parseProfileIds(formData.get("profileIds"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing video upload" }, { status: 400 });
    }
    if (selectedIds.length === 0) {
      return NextResponse.json({ error: "No profiles selected" }, { status: 400 });
    }

    const videoPath = await saveUploadedVideo(file);
    const allProfiles = await loadProfiles();
    const selectedProfiles = allProfiles.filter((p) => selectedIds.includes(p.id));

    const logs: DeploymentLog[] = [];

    for (const profile of selectedProfiles) {
      let connected = false;
      try {
        const startURL = new URL(`${ADS_POWER_BASE}/start`);
        startURL.searchParams.set("user_id", profile.profileId);
        const startResponse = await fetch(startURL.toString(), { method: "GET", cache: "no-store" });
        const startPayload = (await startResponse.json()) as unknown;
        const wsEndpoint = extractWsEndpoint(startPayload);

        if (!wsEndpoint) {
          throw new Error("AdsPower start succeeded but websocket endpoint was missing");
        }

        const browser = await chromium.connectOverCDP(wsEndpoint);
        connected = true;
        const context = browser.contexts()[0] ?? (await browser.newContext());
        const page = context.pages()[0] ?? (await context.newPage());

        await uploadToPlatform(page, profile.platform, videoPath, caption);
        await browser.close();
        connected = false;

        logs.push({
          profileId: profile.profileId,
          accountName: profile.name,
          platform: profile.platform,
          status: "success",
          message: "Upload placeholder executed successfully"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown deployment failure";
        logs.push({
          profileId: profile.profileId,
          accountName: profile.name,
          platform: profile.platform,
          status: "failed",
          message
        });
      } finally {
        try {
          await stopAdsPowerProfile(profile.profileId);
        } catch {
          // Intentionally ignore stop failures to avoid breaking the sequence.
        }
        if (connected) {
          // If connectOverCDP worked but later calls failed before browser.close(),
          // AdsPower stop will terminate the profile; continue loop regardless.
        }
      }
    }

    return NextResponse.json({
      videoPath,
      total: selectedProfiles.length,
      success: logs.filter((l) => l.status === "success").length,
      failed: logs.filter((l) => l.status === "failed").length,
      logs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected deploy error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
