import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");
  if (!file) {
    return NextResponse.json({ error: "Missing file query parameter" }, { status: 400 });
  }

  const safeName = path.basename(file);
  const fullPath = path.join(process.cwd(), "tmp", "gurblander", "clean", safeName);

  try {
    await fs.access(fullPath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const data = await fs.readFile(fullPath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${safeName}"`
    }
  });
}
