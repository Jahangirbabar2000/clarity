import { NextResponse } from "next/server";
import { getLibraryHealth } from "@/lib/integrations/github";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgName = url.searchParams.get("orgName");
  const repo = url.searchParams.get("repo");
  try {
    return NextResponse.json(await getLibraryHealth(orgName, repo));
  } catch {
    return NextResponse.json({ hasData: false, upToDate: 0, minorUpdates: 0, criticalCVEs: 0, sample: [] });
  }
}
