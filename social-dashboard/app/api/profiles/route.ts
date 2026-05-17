import { NextResponse } from "next/server";
import { loadProfiles } from "@/lib/profiles";

export async function GET() {
  try {
    const profiles = await loadProfiles();
    return NextResponse.json({ profiles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profiles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
