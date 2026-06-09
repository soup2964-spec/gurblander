"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/profiles";

type DeployResponse = {
  total: number;
  success: number;
  failed: number;
  videoPath: string;
  logs: Array<{
    profileId: string;
    accountName: string;
    platform: string;
    status: "success" | "failed";
    message: string;
  }>;
};

export default function Page() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeployResponse | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profiles", { cache: "no-store" });
        const payload = (await res.json()) as { profiles?: Profile[]; error?: string };
        if (!res.ok || !payload.profiles) throw new Error(payload.error ?? "Failed to load profiles");
        setProfiles(payload.profiles);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profiles");
      } finally {
        setLoadingProfiles(false);
      }
    }
    void load();
  }, []);

  const allSelected = useMemo(
    () => profiles.length > 0 && profiles.every((p) => selected.has(p.id)),
    [profiles, selected]
  );

  function toggleProfile(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(profiles.map((p) => p.id)));
    else setSelected(new Set());
  }

  async function onDeploy() {
    setError(null);
    setResult(null);

    if (!file) return setError("Please choose a video file.");
    if (selected.size === 0) return setError("Please select at least one account.");

    setDeploying(true);
    try {
      const body = new FormData();
      body.set("video", file);
      body.set("caption", caption);
      body.set("profileIds", JSON.stringify(Array.from(selected)));

      const res = await fetch("/api/deploy", {
        method: "POST",
        body
      });
      const payload = (await res.json()) as DeployResponse & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Deploy failed");
      setResult(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10">
      <section className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-rose-900">Local Social Distribution Dashboard</h1>
          <a className="text-sm font-medium text-blue-700 hover:underline" href="/gurblander">
            Open Gurblander Dashboard
          </a>
        </div>
        <p className="mt-2 text-sm text-rose-700">
          Upload a video, write your caption, select AdsPower profiles, and run sequential local automation.
        </p>

        <div className="mt-6 grid gap-5">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-rose-900" htmlFor="video">
              Video file (.mp4)
            </label>
            <input
              id="video"
              className="rounded-md border border-rose-300 bg-white px-3 py-2 text-sm"
              type="file"
              accept="video/mp4,.mp4"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-rose-900" htmlFor="caption">
              Caption
            </label>
            <Textarea
              id="caption"
              placeholder="Write caption text..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          <div className="grid gap-3 rounded-md border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-rose-900">Accounts</h2>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-rose-800">
                <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(Boolean(v))} />
                Select all
              </label>
            </div>

            {loadingProfiles ? (
              <p className="text-sm text-rose-700">Loading profiles...</p>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-rose-700">No profiles found in `profiles.json`.</p>
            ) : (
              <ul className="grid gap-2">
                {profiles.map((profile) => (
                  <li key={profile.id} className="rounded border border-rose-200 bg-white p-3">
                    <label className="flex cursor-pointer items-center gap-3">
                      <Checkbox
                        checked={selected.has(profile.id)}
                        onCheckedChange={(v) => toggleProfile(profile.id, Boolean(v))}
                      />
                      <span className="text-sm text-rose-900">
                        {profile.name}{" "}
                        <span className="text-rose-600">
                          ({profile.platform} / {profile.profileId})
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button disabled={deploying || loadingProfiles} onClick={onDeploy}>
              {deploying ? "Deploying..." : "Deploy"}
            </Button>
            <span className="text-sm text-rose-700">Runs selected profiles sequentially on this machine.</span>
          </div>

          {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

          {result ? (
            <div className="rounded-md border border-rose-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-rose-900">Result</h3>
              <p className="mt-1 text-sm text-rose-700">
                Total: {result.total} | Success: {result.success} | Failed: {result.failed}
              </p>
              <p className="mt-1 break-all text-xs text-rose-600">Saved video: {result.videoPath}</p>
              <ul className="mt-3 grid gap-2">
                {result.logs.map((log) => (
                  <li
                    key={`${log.profileId}-${log.accountName}`}
                    className={`rounded border p-2 text-sm ${
                      log.status === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {log.accountName} ({log.platform}): {log.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
