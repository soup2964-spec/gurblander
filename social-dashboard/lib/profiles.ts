import { promises as fs } from "fs";
import path from "path";

export type Platform = "tiktok" | "instagram" | "other";

export type Profile = {
  id: string;
  name: string;
  profileId: string;
  platform: Platform;
};

const profilesPath = path.join(process.cwd(), "profiles.json");

export async function loadProfiles(): Promise<Profile[]> {
  const file = await fs.readFile(profilesPath, "utf8");
  const parsed = JSON.parse(file) as Profile[];
  return parsed;
}
